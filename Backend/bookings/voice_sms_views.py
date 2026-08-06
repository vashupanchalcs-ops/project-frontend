import json
from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from bookings.communication import create_booking_from_call_fields
from bookings.models import VoiceBookingCall
from bookings.tasks import process_sms_booking_task, process_voice_booking_task


STEP_SEQUENCE = ["name", "city", "district", "landmark", "confirm"]
STEP_PROMPTS = {
    "name": "Kripya apna naam batayein.",
    "city": "Aap kis city mein hain? Kripya city ka naam boliye.",
    "district": "Kripya district ka naam boliye.",
    "landmark": "Kripya najdeeki landmark batayein.",
    "confirm": "Booking confirm karne ke liye 2 dabaiye. Cancel karne ke liye 1 dabaiye.",
}


def _pick(payload, *keys):
    for k in keys:
        val = payload.get(k)
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return ""


def _get_payload(request):
    if request.content_type and "application/json" in request.content_type:
        try:
            return json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return {}
    if request.method == "POST":
        return {k: v for k, v in request.POST.items()}
    return {}


def _xml(text):
    return HttpResponse(text, content_type="text/xml")


def _say_gather(prompt, action, input_mode="speech dtmf", num_digits=None):
    digits_part = f" numDigits='{num_digits}'" if num_digits else ""
    return f"""<?xml version='1.0' encoding='UTF-8'?>
<Response>
  <Gather input='{input_mode}'{digits_part} action='{action}' method='POST' timeout='6' speechTimeout='auto'>
    <Say language='hi-IN'>{prompt}</Say>
  </Gather>
  <Say language='hi-IN'>Mujhe response nahi mila. Kripya dobara call karein.</Say>
</Response>"""


def _value_from_payload(payload):
    for key in ("SpeechResult", "speech_result", "transcript", "speech_text", "text", "CallerInput", "input_text"):
        val = str(payload.get(key, "")).strip()
        if val:
            return val
    return ""


def _next_step(step):
    try:
        idx = STEP_SEQUENCE.index(step)
        return STEP_SEQUENCE[min(idx + 1, len(STEP_SEQUENCE) - 1)]
    except ValueError:
        return "confirm"


def _ensure_call_session(call_sid, from_number):
    call, _ = VoiceBookingCall.objects.get_or_create(
        call_sid=call_sid,
        defaults={"from_number": from_number, "call_status": "ringing", "current_step": "name"},
    )
    if from_number and call.from_number != from_number:
        call.from_number = from_number
        call.save(update_fields=["from_number", "updated_at"])
    return call


@csrf_exempt
def voice_hotline_info(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    return JsonResponse({"hotline_number": getattr(settings, "DIRECT_CALL_HOTLINE_NUMBER", "8882128534")})


@csrf_exempt
def voice_direct_booking(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    payload = _get_payload(request)
    return _handle_direct_booking_payload(payload)


def _handle_direct_booking_payload(payload):
    confirm_digit = _pick(payload, "confirm_digit", "Digits", "dtmf", "Call.Digits")
    caller_name = _pick(payload, "caller_name", "name", "patient_name", "PatientName")
    city = _pick(payload, "city", "City")
    district = _pick(payload, "district", "District")
    landmark = _pick(payload, "landmark", "Landmark", "pickup_landmark")
    caller_email = _pick(payload, "caller_email", "email", "Email", "caller_gmail")
    from_number = _pick(payload, "from_number", "From", "Call.From", "caller_number", "phone")
    if not from_number:
        from_number = str(payload.get("contact_number", "")).strip()

    if not caller_name or not city or not district or not landmark:
        return JsonResponse({"error": "caller_name, city, district, landmark are required"}, status=400)
    if confirm_digit not in {"1", "2"}:
        return JsonResponse({"error": "confirm_digit must be 1(cancel) or 2(confirm)"}, status=400)

    call = VoiceBookingCall.objects.create(
        call_sid=f"direct-{uuid4().hex}",
        from_number=from_number,
        call_status="in_progress",
        current_step="confirm",
        caller_name=caller_name[:120],
        city=city[:120],
        district=district[:120],
        landmark=landmark[:180],
    )

    if confirm_digit == "1":
        call.call_status = "ended"
        call.ended_at = timezone.now()
        call.save(update_fields=["call_status", "ended_at", "updated_at"])
        return JsonResponse(
            {
                "status": "cancelled",
                "message": "Booking cancelled by caller using digit 1.",
                "hotline_number": getattr(settings, "DIRECT_CALL_HOTLINE_NUMBER", "8882128534"),
            }
        )

    try:
        booking = create_booking_from_call_fields(
            caller_name=caller_name,
            city=city,
            district=district,
            landmark=landmark,
            contact_number=from_number,
            caller_email=caller_email,
        )
    except Exception as exc:
        call.call_status = "failed"
        call.ended_at = timezone.now()
        call.save(update_fields=["call_status", "ended_at", "updated_at"])
        return JsonResponse({"error": str(exc)}, status=400)

    call.is_confirmed = True
    call.booking = booking
    call.call_status = "completed"
    call.ended_at = timezone.now()
    call.save(update_fields=["is_confirmed", "booking", "call_status", "ended_at", "updated_at"])
    return JsonResponse(
        {
            "status": "confirmed",
            "booking_id": booking.id,
            "message": "Booking created and pushed into normal admin workflow.",
            "hotline_number": getattr(settings, "DIRECT_CALL_HOTLINE_NUMBER", "8882128534"),
        }
    )


@csrf_exempt
def exotel_voice_booking_webhook(request):
    """
    Exotel-ready endpoint.
    Expected mapped params from Exotel flow app:
    - From / Call.From
    - caller_name (or name)
    - city
    - district
    - landmark
    - confirm_digit (2 confirm, 1 cancel)
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    payload = _get_payload(request)
    # Reuse same direct booking contract
    if "confirm_digit" not in payload:
        payload["confirm_digit"] = _pick(payload, "Digits", "dtmf", "Call.Digits")
    if "from_number" not in payload:
        payload["from_number"] = _pick(payload, "From", "Call.From", "caller_number", "phone")
    if "caller_name" not in payload:
        payload["caller_name"] = _pick(payload, "name", "patient_name", "PatientName")
    if "city" not in payload:
        payload["city"] = _pick(payload, "City")
    if "district" not in payload:
        payload["district"] = _pick(payload, "District")
    if "landmark" not in payload:
        payload["landmark"] = _pick(payload, "Landmark", "pickup_landmark")

    return _handle_direct_booking_payload(payload)


@csrf_exempt
def voice_ivr_entry(request):
    if request.method not in {"GET", "POST"}:
        return JsonResponse({"error": "Method not allowed"}, status=405)
    payload = _get_payload(request)
    call_sid = str(payload.get("CallSid", "")).strip() or f"demo-{timezone.now().timestamp()}"
    from_number = str(payload.get("From", "")).strip()
    call = _ensure_call_session(call_sid, from_number)
    call.call_status = "in_progress"
    call.current_step = "name"
    call.attempts = 0
    call.ended_at = None
    call.save(update_fields=["call_status", "current_step", "attempts", "ended_at", "updated_at"])
    prompt = "SwiftRescue mein aapka swagat hai. Ambulance booking ke liye hum aapse kuch details lenge. " + STEP_PROMPTS["name"]
    return _xml(_say_gather(prompt, "/api/bookings/voice/step/"))


@csrf_exempt
def voice_ivr_step(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    payload = _get_payload(request)
    call_sid = str(payload.get("CallSid", "")).strip()
    from_number = str(payload.get("From", "")).strip()
    if not call_sid:
        return _xml(_say_gather("Call session missing. Kripya dobara call karein.", "/api/bookings/voice/incoming/"))

    call = _ensure_call_session(call_sid, from_number)
    call.call_status = "in_progress"
    current = call.current_step or "name"

    speech_value = _value_from_payload(payload)
    digit_value = str(payload.get("Digits", "")).strip()

    if current == "confirm":
        if digit_value == "2":
            if call.booking_id:
                msg = f"Aapki booking number {call.booking_id} pehle hi confirm ho chuki hai."
                call.call_status = "completed"
                call.ended_at = timezone.now()
                call.save(update_fields=["call_status", "ended_at", "updated_at"])
                return _xml(f"<?xml version='1.0' encoding='UTF-8'?><Response><Say language='hi-IN'>{msg}</Say></Response>")

            try:
                booking = create_booking_from_call_fields(
                    caller_name=call.caller_name or "",
                    city=call.city or "",
                    district=call.district or "",
                    landmark=call.landmark or "",
                    contact_number=call.from_number or "",
                )
            except Exception:
                call.call_status = "failed"
                call.ended_at = timezone.now()
                call.save(update_fields=["call_status", "ended_at", "updated_at"])
                return _xml(
                    "<?xml version='1.0' encoding='UTF-8'?><Response><Say language='hi-IN'>Maaf kijiye, booking create nahi ho payi. Kripya dobara call karein.</Say></Response>"
                )

            call.is_confirmed = True
            call.booking = booking
            call.call_status = "completed"
            call.ended_at = timezone.now()
            call.save(update_fields=["is_confirmed", "booking", "call_status", "ended_at", "updated_at"])
            msg = f"Dhanyavaad {call.caller_name or ''}. Aapki booking confirm ho gayi hai. Booking number {booking.id}. Admin dispatch team isse turant process karegi."
            return _xml(f"<?xml version='1.0' encoding='UTF-8'?><Response><Say language='hi-IN'>{msg}</Say></Response>")

        if digit_value == "1":
            call.call_status = "ended"
            call.ended_at = timezone.now()
            call.save(update_fields=["call_status", "ended_at", "updated_at"])
            return _xml(
                "<?xml version='1.0' encoding='UTF-8'?><Response><Say language='hi-IN'>Aapki booking request cancel kar di gayi hai. Dhanyavaad.</Say></Response>"
            )

        return _xml(
            _say_gather(
                "Booking confirm karne ke liye 2 dabaiye. Cancel karne ke liye 1 dabaiye.",
                "/api/bookings/voice/step/",
                input_mode="dtmf",
                num_digits=1,
            )
        )

    # Non-confirm step capture
    value = speech_value or digit_value
    if not value:
        call.attempts = (call.attempts or 0) + 1
        if call.attempts >= 2:
            call.call_status = "ended"
            call.ended_at = timezone.now()
            call.save(update_fields=["attempts", "call_status", "ended_at", "updated_at"])
            return _xml(
                "<?xml version='1.0' encoding='UTF-8'?><Response><Say language='hi-IN'>Response receive nahi hua. Kripya dubara call karein.</Say></Response>"
            )
        call.save(update_fields=["attempts", "updated_at"])
        return _xml(_say_gather(STEP_PROMPTS[current], "/api/bookings/voice/step/"))

    value = value.strip()
    if current == "name":
        call.caller_name = value[:120]
    elif current == "city":
        call.city = value[:120]
    elif current == "district":
        call.district = value[:120]
    elif current == "landmark":
        call.landmark = value[:180]

    call.attempts = 0
    next_step = _next_step(current)
    call.current_step = next_step
    call.save(update_fields=["caller_name", "city", "district", "landmark", "attempts", "current_step", "updated_at"])

    if next_step == "confirm":
        summary = (
            f"Kripya details confirm karein. Naam {call.caller_name}, city {call.city}, district {call.district}, landmark {call.landmark}. "
            + STEP_PROMPTS["confirm"]
        )
        return _xml(_say_gather(summary, "/api/bookings/voice/step/", input_mode="dtmf", num_digits=1))

    return _xml(_say_gather(STEP_PROMPTS[next_step], "/api/bookings/voice/step/"))


@csrf_exempt
def voice_call_status_callback(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    payload = _get_payload(request)
    call_sid = str(payload.get("CallSid", "")).strip()
    status = str(payload.get("CallStatus", "")).strip().lower()
    if not call_sid:
        return JsonResponse({"ok": True})
    call = VoiceBookingCall.objects.filter(call_sid=call_sid).first()
    if not call:
        return JsonResponse({"ok": True})

    mapped = {
        "ringing": "ringing",
        "in-progress": "in_progress",
        "completed": "completed",
        "busy": "failed",
        "no-answer": "failed",
        "failed": "failed",
        "canceled": "ended",
    }.get(status, call.call_status)
    call.call_status = mapped
    if mapped in {"completed", "failed", "ended"}:
        call.ended_at = timezone.now()
    call.save(update_fields=["call_status", "ended_at", "updated_at"])
    return JsonResponse({"ok": True})


@csrf_exempt
def voice_call_alert(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    active_window = timezone.now() - timedelta(minutes=3)
    active_qs = VoiceBookingCall.objects.filter(
        updated_at__gte=active_window,
        call_status__in=["ringing", "in_progress"],
    ).order_by("-updated_at")
    latest = active_qs.first()
    return JsonResponse(
        {
            "is_active_call": bool(latest),
            "active_count": active_qs.count(),
            "latest_call": {
                "call_sid": latest.call_sid if latest else "",
                "from_number": latest.from_number if latest else "",
                "step": latest.current_step if latest else "",
                "updated_at": latest.updated_at.isoformat() if latest else None,
            },
        }
    )


# Legacy voice webhook still supported (speech-only quick flow via Celery)
@csrf_exempt
def voice_booking_webhook(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    payload = _get_payload(request)
    task_payload = {
        "provider": payload.get("provider") or "voice",
        "from_number": payload.get("From") or payload.get("from") or payload.get("caller") or "",
        "transcript": payload.get("SpeechResult") or payload.get("speech_text") or payload.get("transcript") or "",
        "audio_base64": payload.get("audio_base64") or "",
        "language": payload.get("language") or "hi-IN",
        "raw": payload,
    }
    try:
        process_voice_booking_task.delay(task_payload)
    except Exception:
        process_voice_booking_task(task_payload)

    xml = """<?xml version='1.0' encoding='UTF-8'?>
<Response>
  <Say language='hi-IN'>Dhanyavaad. Aapki booking request receive ho gayi hai.</Say>
</Response>
"""
    return _xml(xml)


@csrf_exempt
def sms_booking_webhook(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    payload = _get_payload(request)
    task_payload = {
        "provider": payload.get("provider") or "sms",
        "from_number": payload.get("from") or payload.get("From") or payload.get("sender") or "",
        "body": payload.get("Body") or payload.get("message") or payload.get("text") or "",
        "raw": payload,
    }
    try:
        process_sms_booking_task.delay(task_payload)
    except Exception:
        process_sms_booking_task(task_payload)

    xml = """<?xml version='1.0' encoding='UTF-8'?>
<Response>
  <Message>SwiftRescue: Aapka ambulance request receive ho gaya hai. Booking process ho rahi hai.</Message>
</Response>
"""
    return _xml(xml)
