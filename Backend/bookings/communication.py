import json
import math
import re
from typing import Dict, Optional, Tuple
from urllib import parse, request

from django.conf import settings
from django.utils import timezone

from ambulance.models import Ambulance
from bookings.models import Booking, BookingChatMessage, BookingChatThread


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _call_json(url: str, method: str = "GET", data: Optional[dict] = None, headers: Optional[dict] = None):
    payload = None
    final_headers = {"Content-Type": "application/json"}
    if headers:
        final_headers.update(headers)
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
    req = request.Request(url=url, data=payload, method=method, headers=final_headers)
    with request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8")
        if not body:
            return {}
        return json.loads(body)


def extract_booking_intent(raw_text: str) -> Dict[str, str]:
    text = _normalize_text(raw_text)
    if not text:
        return {"pickup_location": "", "destination": ""}

    body = text
    upper = body.upper()
    if upper.startswith("AMBULANCE"):
        body = body[len("AMBULANCE") :].strip(" :,-")

    destination = ""
    to_match = re.search(r"\b(?:to|for hospital|hospital)\b\s+(.+)$", body, flags=re.IGNORECASE)
    if to_match:
        destination = _normalize_text(to_match.group(1))
        body = _normalize_text(body[: to_match.start()])

    pickup = body
    pickup_patterns = [
        r"\b(?:main|mai|mein|me)\s+(.+?)(?:\s+h[uo]{1,2}n|\s+hoon|$)",
        r"\b(?:pickup|location|from|at)\s+(.+)$",
        r"\b(?:mujhe ambulance chahiye[, ]*)(.+)$",
    ]
    for pattern in pickup_patterns:
        match = re.search(pattern, body, flags=re.IGNORECASE)
        if match:
            pickup = _normalize_text(match.group(1))
            break

    # Hindi fillers remove
    pickup = re.sub(r"\b(chahiye|jaldi|please|kripya|urgent|emergency)\b", "", pickup, flags=re.IGNORECASE)
    pickup = _normalize_text(pickup.strip(" ,.-"))

    return {"pickup_location": pickup, "destination": destination}


def geocode_location(location_text: str) -> Tuple[Optional[float], Optional[float], str]:
    query = _normalize_text(location_text)
    if not query:
        return None, None, ""

    api_key = getattr(settings, "OPENCAGE_API_KEY", "").strip()
    if not api_key:
        return None, None, ""

    url = "https://api.opencagedata.com/geocode/v1/json?" + parse.urlencode(
        {"q": query, "key": api_key, "limit": 1, "countrycode": "in"}
    )
    try:
        payload = _call_json(url, method="GET", data=None, headers={"Content-Type": "application/json"})
    except Exception:
        return None, None, ""

    results = payload.get("results") or []
    if not results:
        return None, None, ""
    first = results[0]
    geometry = first.get("geometry") or {}
    components = first.get("components") or {}
    city = components.get("city") or components.get("town") or components.get("state_district") or ""
    district = components.get("county") or components.get("state_district") or components.get("state") or ""
    return geometry.get("lat"), geometry.get("lng"), _normalize_text(f"{city}, {district}".strip(", "))


def get_best_available_ambulance(pickup_lat: Optional[float], pickup_lng: Optional[float]) -> Optional[Ambulance]:
    qs = Ambulance.objects.filter(status="available").order_by("-last_updated")
    ambulances = list(qs)
    if not ambulances:
        return None

    if pickup_lat is None or pickup_lng is None:
        return ambulances[0]

    best = None
    best_distance = 10 ** 9
    for amb in ambulances:
        if amb.latitude is None or amb.longitude is None:
            continue
        try:
            dist = _haversine_km(float(pickup_lat), float(pickup_lng), float(amb.latitude), float(amb.longitude))
        except Exception:
            continue
        if dist < best_distance:
            best_distance = dist
            best = amb
    return best or ambulances[0]


def _phone_to_name(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    suffix = digits[-4:] if len(digits) >= 4 else digits
    return f"Caller {suffix}" if suffix else "Voice/SMS Caller"


def _push_system_chat(booking: Booking, message: str):
    thread, _ = BookingChatThread.objects.get_or_create(
        booking=booking,
        defaults={
            "user_email": booking.booked_by_email or "",
            "user_name": booking.booked_by or "",
            "driver_name": booking.driver or "",
        },
    )
    BookingChatMessage.objects.create(
        thread=thread,
        sender_role="system",
        sender_name="SwiftRescue Voice/SMS Bot",
        message_type="update",
        message=message,
        metadata=json.dumps({"source": "voice_sms_intake", "target_role": "all"}),
    )
    thread.last_message_at = timezone.now()
    thread.save(update_fields=["last_message_at", "updated_at"])


def create_booking_from_text(source: str, contact_number: str, transcript_text: str) -> Booking:
    parsed = extract_booking_intent(transcript_text)
    pickup = parsed.get("pickup_location") or ""
    destination = parsed.get("destination") or ""
    if not pickup:
        raise ValueError("Pickup location not detected from conversation/text.")

    pickup_lat, pickup_lng, city_district = geocode_location(
        f"{pickup}, {getattr(settings, 'VOICE_SMS_DEFAULT_COUNTRY', 'India')}"
    )
    city = ""
    district = ""
    if city_district:
        parts = [p.strip() for p in city_district.split(",") if p.strip()]
        if parts:
            city = parts[0]
            district = parts[-1]

    # Voice/SMS flow now follows the same dispatch workflow as web booking:
    # booking is created first, then admin assigns nearest ambulance.
    booking = Booking.objects.create(
        ambulance_id=0,
        ambulance_number="",
        driver="",
        driver_contact="",
        booked_by=_phone_to_name(contact_number),
        booked_by_email="",
        pickup_location=pickup,
        pickup_latitude=pickup_lat,
        pickup_longitude=pickup_lng,
        pickup_landmark="Voice/SMS booking",
        pickup_city=city,
        pickup_district=district,
        patient_contact_number=contact_number or "",
        destination=destination or "",
        status="pending",
    )
    _push_system_chat(
        booking,
        f"{source.upper()} booking captured: {pickup}. Booking #{booking.id} created and routed to admin dispatch queue.",
    )
    _push_system_chat(
        booking,
        f"Booking #{booking.id} is waiting for ambulance assignment from admin dispatch.",
    )
    return booking


def create_booking_from_call_fields(
    caller_name: str,
    city: str,
    district: str,
    landmark: str,
    contact_number: str,
    caller_email: str = "",
) -> Booking:
    pickup_text = _normalize_text(", ".join([landmark or "", city or "", district or ""]).strip(", "))
    transcript = f"Mujhe ambulance chahiye, main {pickup_text} mein hoon"
    booking = create_booking_from_text("voice", contact_number, transcript)
    # Always prefer exact caller-provided fields over inferred geocode fields
    caller_name_clean = _normalize_text(caller_name)[:100]
    city_clean = _normalize_text(city)[:120]
    district_clean = _normalize_text(district)[:120]
    landmark_clean = _normalize_text(landmark)[:200]
    pickup_clean = _normalize_text(
        ", ".join([part for part in [landmark_clean, city_clean, district_clean] if part])
    )

    if caller_name_clean:
        booking.booked_by = caller_name_clean
    email_clean = _normalize_text(caller_email)[:120]
    if email_clean:
        booking.booked_by_email = email_clean
    if pickup_clean:
        booking.pickup_location = pickup_clean
    if city_clean:
        booking.pickup_city = city_clean
    if district_clean:
        booking.pickup_district = district_clean
    if landmark_clean:
        booking.pickup_landmark = landmark_clean

    booking.save(
        update_fields=[
            "booked_by",
            "booked_by_email",
            "pickup_location",
            "pickup_city",
            "pickup_district",
            "pickup_landmark",
        ]
    )
    return booking


def transcribe_with_google_stt(audio_base64: str, language_code: str = "hi-IN") -> str:
    api_key = getattr(settings, "GOOGLE_SPEECH_API_KEY", "").strip()
    if not api_key or not audio_base64:
        return ""

    req_data = {
        "config": {
            "languageCode": language_code,
            "enableAutomaticPunctuation": True,
            "model": "latest_long",
        },
        "audio": {"content": audio_base64},
    }
    url = f"https://speech.googleapis.com/v1/speech:recognize?key={parse.quote(api_key)}"
    try:
        payload = _call_json(url, method="POST", data=req_data)
    except Exception:
        return ""
    results = payload.get("results") or []
    if not results:
        return ""
    alternatives = (results[0] or {}).get("alternatives") or []
    if not alternatives:
        return ""
    return _normalize_text((alternatives[0] or {}).get("transcript", ""))


def extract_voice_text(payload: Dict) -> str:
    for key in ("transcript", "speech_text", "SpeechResult", "speech_result", "text"):
        value = _normalize_text(str(payload.get(key, "")))
        if value:
            return value

    audio_base64 = _normalize_text(str(payload.get("audio_base64", "")))
    if audio_base64:
        text = transcribe_with_google_stt(audio_base64, language_code=str(payload.get("language", "hi-IN")))
        if text:
            return text
    return ""


def send_sms_confirmation(phone_number: str, message: str) -> bool:
    phone = _normalize_text(phone_number)
    if not phone:
        return False

    auth_key = getattr(settings, "MSG91_AUTH_KEY", "").strip()
    if not auth_key:
        return False
    sender = getattr(settings, "MSG91_SENDER", "SWIFTR")
    route = getattr(settings, "MSG91_ROUTE", "4")
    params = {
        "authkey": auth_key,
        "mobiles": re.sub(r"\D", "", phone),
        "message": message,
        "sender": sender,
        "route": route,
        "country": "91",
    }
    url = "https://api.msg91.com/api/sendhttp.php?" + parse.urlencode(params)
    try:
        with request.urlopen(url, timeout=20):
            return True
    except Exception:
        return False


def place_voice_callback(phone_number: str, message_text: str) -> bool:
    # Direct-call mode enabled: no external voice gateway callback.
    _ = (phone_number, message_text)
    return False
