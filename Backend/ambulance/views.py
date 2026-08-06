from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.core.mail import send_mail
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from ambulance.models import Ambulance, DriverLocation, SuggestedRoute
from ambulance.serializers import AmbulanceSerializer
import json
import random
import logging

logger = logging.getLogger(__name__)

def _default_ambulance_registration(amb_id):
    return f"AMB-REG-{int(amb_id):04d}"


def _default_ambulance_contract_id(amb_id):
    return f"AMB-ID-{int(amb_id):04d}"


def _has_active_dispatch_booking(ambulance_id):
    from bookings.models import Booking

    return Booking.objects.filter(
        ambulance_id=ambulance_id,
        status="confirmed",
        sent_to_driver=True,
        driver_task_completed=False,
    ).exists()


def _parse_json_body(request):
    try:
        raw = (request.body or b"").decode("utf-8").strip()
        if not raw:
            return {}
        return json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def home(request):
    return JsonResponse({"message": "SwiftRescue Backend Running"})


@csrf_exempt
def send_otp(request):
    if request.method == "POST":
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse(
                {"status": "error", "message": "Invalid JSON body"},
                status=400,
            )
        email = data.get("email")
        if not email:
            return JsonResponse({"status": "error", "message": "Email required"}, status=400)
        otp   = str(random.randint(100000, 999999))
        cache.set(f"otp_{email}", otp, timeout=300)

        print(f"\n{'='*40}", flush=True)
        print(f"[OTP] Email : {email}", flush=True)
        print(f"[OTP] Code  : {otp}", flush=True)
        print(f"{'='*40}\n", flush=True)

        email_configured = bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)
        if email_configured:
            try:
                send_mail(
                    "SwiftRescue OTP",
                    f"Your OTP is {otp}",
                    settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER,
                    [email],
                    fail_silently=False,
                )
                print(f"[OTP] Email sent to {email}", flush=True)
            except Exception as e:
                print(f"[OTP] Email failed: {e}", flush=True)
                if not settings.DEBUG:
                    return JsonResponse(
                        {
                            "status": "error",
                            "message": f"OTP email send failed: {str(e)}",
                        },
                        status=500,
                    )
        elif not settings.DEBUG:
            return JsonResponse(
                {
                    "status": "error",
                    "message": "OTP email config missing on backend. Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD.",
                },
                status=500,
            )

        response = {"status": "otp_sent"}
        if settings.DEBUG and not email_configured:
            response["dev_otp"] = otp
            response["message"] = "Email config missing; use dev_otp for local testing."
        return JsonResponse(response)
    return JsonResponse({"status": "error"})


@csrf_exempt
def verify_otp(request):
    if request.method == "POST":
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse(
                {"status": "error", "message": "Invalid JSON body"},
                status=400,
            )
        user_otp  = data.get("otp")
        email     = data.get("email")
        saved_otp = cache.get(f"otp_{email}")
        if saved_otp and user_otp == saved_otp:
            cache.delete(f"otp_{email}")
            return JsonResponse({"status": "success", "email": email})
        else:
            return JsonResponse({"status": "invalid", "message": "Galat OTP hai"})
    return JsonResponse({"status": "error"})


@csrf_exempt
def send_phone_otp(request):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "POST only"}, status=405)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse(
            {"status": "error", "message": "Invalid JSON body"},
            status=400,
        )
    phone = data.get("phone", "").strip().replace(" ", "").replace("+91", "").replace("+", "")

    if not phone or len(phone) != 10:
        return JsonResponse({"status": "error", "message": "Valid 10-digit phone number daalo"}, status=400)

    otp = str(random.randint(100000, 999999))
    cache.set(f"phone_otp_{phone}", otp, timeout=300)

    print(f"\n{'='*40}", flush=True)
    print(f"[PHONE OTP] Number : +91{phone}", flush=True)
    print(f"[PHONE OTP] Code   : {otp}", flush=True)
    print(f"{'='*40}\n", flush=True)

    return JsonResponse({"status": "otp_sent", "message": f"OTP +91{phone} pe bheja gaya"})


@csrf_exempt
def verify_phone_otp(request):
    if request.method != "POST":
        return JsonResponse({"status": "error", "message": "POST only"}, status=405)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse(
            {"status": "error", "message": "Invalid JSON body"},
            status=400,
        )
    phone     = data.get("phone", "").strip().replace(" ", "").replace("+91", "")
    user_otp  = data.get("otp", "").strip()
    saved_otp = cache.get(f"phone_otp_{phone}")

    if saved_otp and user_otp == saved_otp:
        cache.delete(f"phone_otp_{phone}")
        return JsonResponse({"status": "success", "phone": phone})
    else:
        return JsonResponse({"status": "invalid", "message": "Galat OTP hai ya expire ho gaya"})


def logout_view(request):
    request.session.flush()
    return JsonResponse({"status": "logout"})


@csrf_exempt
def validate_contract_access(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    role = str(data.get("role", "")).strip().lower()
    email = str(data.get("email", "")).strip().lower()
    contract_id_raw = str(data.get("contract_id", "")).strip()
    hospital_id_raw = str(data.get("hospital_id", "")).strip()
    registration_number = str(data.get("registration_number", "")).strip()

    if role not in {"driver", "hospital"}:
        return JsonResponse({"error": "role must be driver or hospital"}, status=400)
    if not email:
        return JsonResponse({"error": "email is required"}, status=400)
    if not registration_number:
        return JsonResponse({"error": "Registration number is required"}, status=400)

    normalized_reg = registration_number.replace(" ", "").lower()

    if role == "driver":
        if not contract_id_raw:
            return JsonResponse({"error": "Ambulance ID is required"}, status=400)
        normalized_contract = contract_id_raw.replace(" ", "").lower()
        amb = Ambulance.objects.filter(ambulance_contract_id__iexact=contract_id_raw).first()
        if not amb and contract_id_raw.isdigit():
            amb = Ambulance.objects.filter(id=int(contract_id_raw)).first()
        if amb and not str(amb.ambulance_contract_id or "").strip():
            amb.ambulance_contract_id = _default_ambulance_contract_id(amb.id)
            amb.save(update_fields=["ambulance_contract_id"])
        if not amb:
            return JsonResponse({"valid": False, "error": "Ambulance ID not found"}, status=404)

        amb_email = str(amb.driver_email or "").strip().lower()
        amb_reg = str(amb.registration_number or "").replace(" ", "").lower()
        amb_contract_id = str(amb.ambulance_contract_id or "").replace(" ", "").lower()
        if amb_contract_id and amb_contract_id != normalized_contract:
            return JsonResponse({"valid": False, "error": "Ambulance ID does not match contract"}, status=403)
        if amb_email != email:
            return JsonResponse({"valid": False, "error": "Driver email does not match contract"}, status=403)
        if not amb_reg or amb_reg != normalized_reg:
            return JsonResponse({"valid": False, "error": "Registration number does not match contract"}, status=403)

        return JsonResponse(
            {
                "valid": True,
                "role": "driver",
                "contract_id": amb.ambulance_contract_id or f"AMB-ID-{int(amb.id):04d}",
                "registration_number": amb.registration_number,
                "ambulance_id": amb.id,
                "ambulance_contract_id": amb.ambulance_contract_id,
                "ambulance_number": amb.ambulance_number,
                "driver_name": amb.driver,
            }
        )

    from hospitals.models import Hospital

    effective_hospital_id = hospital_id_raw or contract_id_raw
    if not effective_hospital_id:
        return JsonResponse({"error": "Valid hospital ID is required"}, status=400)
    normalized_hospital_id = effective_hospital_id.replace(" ", "").lower()

    hosp = Hospital.objects.filter(hospital_contract_id__iexact=effective_hospital_id, is_active=True).first()
    if not hosp and effective_hospital_id.isdigit():
        hosp = Hospital.objects.filter(id=int(effective_hospital_id), is_active=True).first()
    if hosp and not str(hosp.hospital_contract_id or "").strip():
        hosp.hospital_contract_id = f"HOSP-ID-{int(hosp.id):04d}"
        hosp.save(update_fields=["hospital_contract_id"])
    if not hosp:
        return JsonResponse({"valid": False, "error": "Hospital ID not found"}, status=404)

    hosp_email = str(hosp.email or "").strip().lower()
    hosp_reg = str(hosp.registration_number or "").replace(" ", "").lower()
    hosp_contract_id = str(hosp.hospital_contract_id or "").replace(" ", "").lower()
    if hosp_contract_id and hosp_contract_id != normalized_hospital_id:
        return JsonResponse({"valid": False, "error": "Hospital ID does not match contract"}, status=403)
    if hosp_email != email:
        return JsonResponse({"valid": False, "error": "Hospital email does not match contract"}, status=403)
    if not hosp_reg or hosp_reg != normalized_reg:
        return JsonResponse({"valid": False, "error": "Registration number does not match contract"}, status=403)

    return JsonResponse(
        {
            "valid": True,
            "role": "hospital",
            "contract_id": hosp.hospital_contract_id or f"HOSP-ID-{int(hosp.id):04d}",
            "registration_number": hosp.registration_number,
            "hospital_id": hosp.id,
            "hospital_contract_id": hosp.hospital_contract_id,
            "hospital_name": hosp.name,
        }
    )


def ambulance_to_dict(a):
    effective_status = a.status
    if effective_status == "en_route" and not _has_active_dispatch_booking(a.id):
        effective_status = "available"
    data = AmbulanceSerializer(a).data
    data["driver_email"] = data.get("driver_email") or ""
    data["ambulance_contract_id"] = data.get("ambulance_contract_id") or ""
    data["registration_number"] = data.get("registration_number") or ""
    data["status"] = effective_status
    if a.last_updated:
        data["last_updated"] = a.last_updated.strftime("%d %b %Y, %I:%M %p")
    return data


@csrf_exempt
def ambulance_list(request):
    if request.method == "GET":
        ambulances = Ambulance.objects.all()
        return JsonResponse([ambulance_to_dict(a) for a in ambulances], safe=False)

    if request.method == "POST":
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        a = Ambulance.objects.create(
            ambulance_contract_id = data.get("ambulance_contract_id", ""),
            ambulance_number  = data.get("ambulance_number", ""),
            registration_number = data.get("registration_number", ""),
            driver            = data.get("driver", ""),
            driver_contact    = data.get("driver_contact", ""),
            driver_email      = data.get("driver_email", ""),
            model             = data.get("model", ""),
            speed             = data.get("speed", "0"),
            status            = data.get("status", "available"),
            location          = data.get("location", ""),
            nearest_hospital  = data.get("nearest_hospital", ""),
            hospital_distance = data.get("hospital_distance", ""),
            eta_to_patient    = data.get("eta_to_patient", ""),
            eta_to_hospital   = data.get("eta_to_hospital", ""),
            latitude          = data.get("latitude"),
            longitude         = data.get("longitude"),
            battery_percentage = data.get("battery_percentage", 100),
        )
        if not str(a.registration_number or "").strip():
            a.registration_number = _default_ambulance_registration(a.id)
        if not str(a.ambulance_contract_id or "").strip():
            a.ambulance_contract_id = _default_ambulance_contract_id(a.id)
        a.save(update_fields=["registration_number", "ambulance_contract_id"])
        return JsonResponse(ambulance_to_dict(a), status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def ambulance_by_driver_email(request):
    email = request.GET.get("email", "")
    if not email:
        return JsonResponse({"error": "email parameter required"}, status=400)
    ambulances = Ambulance.objects.filter(driver_email=email)
    return JsonResponse([ambulance_to_dict(a) for a in ambulances], safe=False)


@csrf_exempt
def ambulance_detail(request, id):
    try:
        a = Ambulance.objects.get(id=id)
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse(ambulance_to_dict(a))

    if request.method == "PUT":
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        a.ambulance_number  = data.get("ambulance_number",  a.ambulance_number)
        a.ambulance_contract_id = data.get("ambulance_contract_id", a.ambulance_contract_id)
        a.registration_number = data.get("registration_number", a.registration_number)
        a.driver            = data.get("driver",            a.driver)
        a.driver_contact    = data.get("driver_contact",    a.driver_contact)
        a.driver_email      = data.get("driver_email",      a.driver_email)
        a.model             = data.get("model",             a.model)
        a.speed             = data.get("speed",             a.speed)
        a.status            = data.get("status",            a.status)
        a.location          = data.get("location",          a.location)
        a.nearest_hospital  = data.get("nearest_hospital",  a.nearest_hospital)
        a.hospital_distance = data.get("hospital_distance", a.hospital_distance)
        a.eta_to_patient    = data.get("eta_to_patient",    a.eta_to_patient)
        a.eta_to_hospital   = data.get("eta_to_hospital",   a.eta_to_hospital)
        a.latitude          = data.get("latitude",          a.latitude)
        a.longitude         = data.get("longitude",         a.longitude)
        a.battery_percentage = data.get("battery_percentage", a.battery_percentage)
        a.save()
        return JsonResponse(ambulance_to_dict(a))

    if request.method == "PATCH":
        data = _parse_json_body(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        if "driver"         in data: a.driver         = data["driver"]
        if "ambulance_contract_id" in data: a.ambulance_contract_id = data["ambulance_contract_id"]
        if "registration_number" in data: a.registration_number = data["registration_number"]
        if "driver_contact" in data: a.driver_contact = data["driver_contact"]
        if "driver_email"   in data: a.driver_email   = data["driver_email"]

        new_status = data.get("status")
        if new_status:
            valid = {"available", "en_route", "busy", "offline"}
            if new_status not in valid:
                return JsonResponse({"error": f"Invalid status. Use: {valid}"}, status=400)
            a.status = new_status

        if "latitude"          in data: a.latitude          = data["latitude"]
        if "longitude"         in data: a.longitude         = data["longitude"]
        if "location"          in data: a.location          = data["location"]
        if "speed"             in data: a.speed             = data["speed"]
        if "nearest_hospital"  in data: a.nearest_hospital  = data["nearest_hospital"]
        if "hospital_distance" in data: a.hospital_distance = data["hospital_distance"]
        if "eta_to_patient"    in data: a.eta_to_patient    = data["eta_to_patient"]
        if "eta_to_hospital"   in data: a.eta_to_hospital   = data["eta_to_hospital"]
        if "battery_percentage" in data: a.battery_percentage = data["battery_percentage"]

        a.save()
        return JsonResponse(ambulance_to_dict(a))

    if request.method == "DELETE":
        a.delete()
        return JsonResponse({"status": "deleted"})

    return JsonResponse({"error": "Method not allowed"}, status=405)


CHANGE_REQ_CACHE_KEY = "swiftrescue_change_requests"
CHANGE_REQ_TIMEOUT   = 86400 * 7


@csrf_exempt
def ambulance_change_request(request):
    if request.method == "GET":
        all_reqs = cache.get(CHANGE_REQ_CACHE_KEY) or []
        return JsonResponse(all_reqs, safe=False)

    if request.method == "POST":
        data = json.loads(request.body)
        data["status"] = "pending"
        all_reqs = cache.get(CHANGE_REQ_CACHE_KEY) or []
        already = any(
            r.get("driverEmail") == data.get("driverEmail") and
            r.get("newAmbId")    == data.get("newAmbId")    and
            r.get("status")      == "pending"
            for r in all_reqs
        )
        if already:
            return JsonResponse({"status": "already_pending", "message": "Aapki request pehle se pending hai"})
        all_reqs.insert(0, data)
        cache.set(CHANGE_REQ_CACHE_KEY, all_reqs, timeout=CHANGE_REQ_TIMEOUT)
        return JsonResponse({"status": "saved", "message": "Request admin ko bhej di gayi"})

    if request.method == "PATCH":
        data      = json.loads(request.body)
        timestamp = data.get("timestamp")
        action    = data.get("status")
        if action not in ("approved", "rejected"):
            return JsonResponse({"error": "status must be 'approved' or 'rejected'"}, status=400)
        all_reqs    = cache.get(CHANGE_REQ_CACHE_KEY) or []
        updated_req = None
        for r in all_reqs:
            if r.get("timestamp") == timestamp:
                r["status"] = action
                updated_req = r
                break
        if not updated_req:
            return JsonResponse({"error": "Request not found"}, status=404)
        cache.set(CHANGE_REQ_CACHE_KEY, all_reqs, timeout=CHANGE_REQ_TIMEOUT)
        if action == "approved":
            try:
                amb = Ambulance.objects.get(id=updated_req.get("newAmbId"))
                amb.driver         = updated_req.get("driverName", amb.driver)
                amb.driver_contact = updated_req.get("driverPhone", amb.driver_contact)
                amb.driver_email   = updated_req.get("driverEmail", amb.driver_email)
                amb.save()
            except Ambulance.DoesNotExist:
                pass
        driver_email  = updated_req.get("driverEmail", "")
        notif_key     = f"dr_server_notif_{driver_email}"
        driver_notifs = cache.get(notif_key) or []
        driver_notifs.insert(0, {
            "id":        f"req_{timestamp}",
            "type":      action,
            "title":     "✅ Request Approved!" if action == "approved" else "❌ Request Rejected",
            "message":   (
                f"Admin ne aapki {updated_req.get('newAmbNumber')} ambulance change request approve kar di!"
                if action == "approved"
                else f"Admin ne aapki {updated_req.get('newAmbNumber')} ambulance change request reject kar di."
            ),
            "ambNumber": updated_req.get("newAmbNumber"),
            "timestamp": timezone.now().isoformat(),
            "read":      False,
        })
        cache.set(notif_key, driver_notifs, timeout=CHANGE_REQ_TIMEOUT)
        return JsonResponse({"status": "updated", "action": action})

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def ambulance_change_request_delete(request):
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE only"}, status=405)
    data     = json.loads(request.body)
    all_reqs = cache.get(CHANGE_REQ_CACHE_KEY) or []
    if data.get("clear_all"):
        new_reqs = [r for r in all_reqs if r.get("status") == "pending"]
        cache.set(CHANGE_REQ_CACHE_KEY, new_reqs, timeout=CHANGE_REQ_TIMEOUT)
        removed = len(all_reqs) - len(new_reqs)
        return JsonResponse({"status": "deleted", "removed": removed})
    timestamp = data.get("timestamp")
    new_reqs  = [r for r in all_reqs if r.get("timestamp") != timestamp]
    if len(new_reqs) == len(all_reqs):
        return JsonResponse({"error": "Request not found"}, status=404)
    cache.set(CHANGE_REQ_CACHE_KEY, new_reqs, timeout=CHANGE_REQ_TIMEOUT)
    return JsonResponse({"status": "deleted"})


@csrf_exempt
def get_driver_notifications(request):
    if request.method == "GET":
        email     = request.GET.get("email", "")
        notif_key = f"dr_server_notif_{email}"
        notifs    = cache.get(notif_key) or []
        return JsonResponse(notifs, safe=False)
    if request.method == "POST":
        data      = json.loads(request.body)
        email     = data.get("email", "")
        notif_key = f"dr_server_notif_{email}"
        notifs    = cache.get(notif_key) or []
        updated   = [{ **n, "read": True } for n in notifs]
        cache.set(notif_key, updated, timeout=CHANGE_REQ_TIMEOUT)
        return JsonResponse({"status": "marked_read"})
    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def driver_ping(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = json.loads(request.body)
    try:
        ambulance = Ambulance.objects.get(id=data.get("ambulance_id"))
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "Ambulance not found"}, status=404)
    DriverLocation.objects.create(
        ambulance    = ambulance,
        driver_email = data.get("driver_email", ambulance.driver_email or ""),
        latitude     = data.get("latitude"),
        longitude    = data.get("longitude"),
        speed        = data.get("speed", 0),
    )
    ambulance.latitude  = data.get("latitude")
    ambulance.longitude = data.get("longitude")
    ambulance.speed     = str(data.get("speed", 0))
    ambulance.save()
    pending_route = SuggestedRoute.objects.filter(
        ambulance=ambulance, status="pending"
    ).order_by("-created_at").first()
    response_data = {"status": "ok"}
    if pending_route:
        response_data["pending_route"] = route_to_dict(pending_route)
    return JsonResponse(response_data)


def driver_location_to_dict(dl):
    return {
        "id":           dl.id,
        "ambulance_id": dl.ambulance_id,
        "driver_email": dl.driver_email,
        "latitude":     dl.latitude,
        "longitude":    dl.longitude,
        "speed":        dl.speed,
        "timestamp":    dl.timestamp.strftime("%d %b %Y, %I:%M %p"),
    }


@csrf_exempt
def save_driver_location(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = json.loads(request.body)
    try:
        ambulance = Ambulance.objects.get(id=data.get("ambulance_id"))
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "Ambulance not found"}, status=404)
    dl = DriverLocation.objects.create(
        ambulance    = ambulance,
        driver_email = data.get("driver_email", ambulance.driver_email or ""),
        latitude     = data.get("latitude"),
        longitude    = data.get("longitude"),
        speed        = data.get("speed", 0),
    )
    ambulance.latitude  = data.get("latitude")
    ambulance.longitude = data.get("longitude")
    ambulance.speed     = str(data.get("speed", 0))
    ambulance.save()
    return JsonResponse(driver_location_to_dict(dl), status=201)


@csrf_exempt
def get_driver_locations(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    email = request.GET.get("email", "")
    if email:
        qs = DriverLocation.objects.filter(driver_email=email).order_by("-timestamp")[:1]
    else:
        seen = {}
        for dl in DriverLocation.objects.select_related("ambulance").order_by("-timestamp"):
            if dl.ambulance_id not in seen:
                seen[dl.ambulance_id] = dl
        qs = seen.values()
    return JsonResponse([driver_location_to_dict(dl) for dl in qs], safe=False)


@csrf_exempt
def get_location_history(request, ambulance_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    limit   = int(request.GET.get("limit", 50))
    history = DriverLocation.objects.filter(ambulance_id=ambulance_id).order_by("-timestamp")[:limit]
    return JsonResponse([driver_location_to_dict(dl) for dl in history], safe=False)


# ✅ NEW — User ke live tracking ke liye driver ki latest location
@csrf_exempt
def get_driver_location_by_ambulance(request):
    """
    GET /api/driver/location/?ambulance_id=<id>
    Driver ki latest location return karta hai.
    UserBookingMap.jsx is API se live tracking karta hai.
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    ambulance_id = request.GET.get("ambulance_id")
    if not ambulance_id:
        return JsonResponse({"error": "ambulance_id parameter required"}, status=400)

    try:
        # DriverLocation table se latest record
        dl = DriverLocation.objects.filter(
            ambulance_id=ambulance_id
        ).order_by("-timestamp").first()

        if not dl:
            # Fallback: Ambulance table mein directly latitude/longitude check karo
            try:
                amb = Ambulance.objects.get(id=ambulance_id)
                if amb.latitude and amb.longitude:
                    return JsonResponse({
                        "ambulance_id":     amb.id,
                        "latitude":         float(amb.latitude),
                        "longitude":        float(amb.longitude),
                        "speed":            amb.speed or 0,
                        "driver_email":     amb.driver_email or "",
                        "driver_name":      amb.driver or "",
                        "ambulance_number": amb.ambulance_number or "",
                        "timestamp":        amb.last_updated.isoformat(),
                        "source":           "ambulance_table",
                    })
            except Ambulance.DoesNotExist:
                pass
            return JsonResponse({
                "ambulance_id":     int(ambulance_id),
                "latitude":         None,
                "longitude":        None,
                "speed":            0,
                "driver_email":     "",
                "driver_name":      "",
                "driver_contact":   "",
                "ambulance_number": "",
                "timestamp":        None,
                "source":           "none",
                "available":        False,
                "message":          "No location found for this ambulance",
            })

        # Ambulance se driver name fetch karo
        try:
            amb              = Ambulance.objects.get(id=ambulance_id)
            driver_name      = amb.driver or ""
            ambulance_number = amb.ambulance_number or ""
            driver_contact   = amb.driver_contact or ""
        except Ambulance.DoesNotExist:
            driver_name      = ""
            ambulance_number = ""
            driver_contact   = ""

        return JsonResponse({
            "ambulance_id":     dl.ambulance_id,
            "latitude":         float(dl.latitude)  if dl.latitude  else None,
            "longitude":        float(dl.longitude) if dl.longitude else None,
            "speed":            dl.speed or 0,
            "driver_email":     dl.driver_email or "",
            "driver_name":      driver_name,
            "driver_contact":   driver_contact,
            "ambulance_number": ambulance_number,
            "timestamp":        dl.timestamp.isoformat(),
            "source":           "driver_location_table",
            "available":        True,
        })

    except Exception as e:
        logger.error(f"get_driver_location_by_ambulance error: {e}")
        return JsonResponse({"error": str(e)}, status=500)


def route_to_dict(r):
    return {
        "id":               r.id,
        "ambulance_id":     r.ambulance_id,
        "pickup_location":  r.pickup_location,
        "destination":      r.destination,
        "polyline":         r.polyline,
        "distance_km":      r.distance_km,
        "duration":         r.duration,
        "status":           r.status,
        "created_at":       r.created_at.strftime("%d %b %Y, %I:%M %p"),
        "accepted_at":      r.accepted_at.strftime("%d %b %Y, %I:%M %p") if r.accepted_at else None,
        "completed_at":     r.completed_at.strftime("%d %b %Y, %I:%M %p") if r.completed_at else None,
    }


@csrf_exempt
def save_suggested_route(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = json.loads(request.body)
    try:
        ambulance = Ambulance.objects.get(id=data.get("ambulance_id"))
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "Ambulance not found"}, status=404)
    route = SuggestedRoute.objects.create(
        ambulance       = ambulance,
        pickup_location = data.get("pickup_location", ""),
        destination     = data.get("destination", ""),
        polyline        = data.get("polyline", ""),
        distance_km     = data.get("distance_km", ""),
        duration        = data.get("duration", ""),
        status          = "pending",
    )
    return JsonResponse(route_to_dict(route), status=201)


@csrf_exempt
def update_route_status(request, route_id):
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH only"}, status=405)
    try:
        route = SuggestedRoute.objects.get(id=route_id)
    except SuggestedRoute.DoesNotExist:
        return JsonResponse({"error": "Route not found"}, status=404)
    data       = json.loads(request.body)
    new_status = data.get("status")
    valid      = {"pending", "accepted", "rejected", "completed"}
    if new_status not in valid:
        return JsonResponse({"error": f"Invalid status. Use: {valid}"}, status=400)
    route.status = new_status
    if new_status == "accepted":
        route.accepted_at = timezone.now()
    elif new_status == "completed":
        route.completed_at = timezone.now()
    route.save()
    return JsonResponse(route_to_dict(route))


@csrf_exempt
def get_suggested_routes(request, ambulance_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    status = request.GET.get("status", "")
    qs = SuggestedRoute.objects.filter(ambulance_id=ambulance_id)
    if status:
        qs = qs.filter(status=status)
    return JsonResponse([route_to_dict(r) for r in qs], safe=False)


@csrf_exempt
def get_active_routes(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    routes = SuggestedRoute.objects.filter(
        status__in=["pending", "accepted"]
    ).select_related("ambulance")
    return JsonResponse([route_to_dict(r) for r in routes], safe=False)
