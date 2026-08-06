from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from hospitals.models import Hospital, HospitalStaff
from bookings.models import Booking
from ambulance.models import Ambulance
import json

def _default_hospital_registration(hosp_id):
    return f"HOSP-REG-{int(hosp_id):04d}"


def _default_hospital_contract_id(hosp_id):
    return f"HOSP-ID-{int(hosp_id):04d}"


def _safe_json(request):
    try:
        return json.loads((request.body or b"{}").decode("utf-8"))
    except Exception:
        return None


def hospital_to_dict(h):
    return {
        "id":                 h.id,
        "hospital_contract_id": h.hospital_contract_id,
        "name":               h.name,
        "registration_number": h.registration_number,
        "address":            h.address,
        "latitude":           h.latitude,
        "longitude":          h.longitude,
        "contact_number":     h.contact_number,
        "email":              h.email,
        "hospital_type":      h.hospital_type,
        "total_beds":         h.total_beds,
        "available_beds":     h.available_beds,
        "icu_beds":           h.icu_beds,
        "total_ventilators":  h.total_ventilators,
        "available_ventilators": h.available_ventilators,
        "specializations":    h.specializations,
        "facilities":         h.facilities,
        "emergency_services": h.emergency_services,
        "status":             h.status,
        "is_active":          h.is_active,
    }


def staff_to_dict(s):
    return {
        "id": s.id,
        "hospital_id": s.hospital_id,
        "full_name": s.full_name,
        "role": s.role,
        "specialization": s.specialization,
        "contact_number": s.contact_number,
        "email": s.email,
        "photo_data": s.photo_data,
        "banner_data": s.banner_data,
        "is_on_call": s.is_on_call,
        "is_active": s.is_active,
        "years_experience": s.years_experience,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


@csrf_exempt
def hospital_list(request):
    if request.method == "GET":
        hospitals = Hospital.objects.all()
        return JsonResponse([hospital_to_dict(h) for h in hospitals], safe=False)

    if request.method == "POST":
        data = _safe_json(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        h = Hospital.objects.create(
            hospital_contract_id = data.get("hospital_contract_id", ""),
            name               = data.get("name", ""),
            registration_number = data.get("registration_number", ""),
            address            = data.get("address", ""),
            latitude           = data.get("latitude", ""),
            longitude          = data.get("longitude", ""),
            contact_number     = data.get("contact_number", ""),
            email              = data.get("email", ""),
            hospital_type      = data.get("hospital_type", "private"),
            total_beds         = data.get("total_beds", 0),
            available_beds     = data.get("available_beds", 0),
            icu_beds           = data.get("icu_beds", 0),
            total_ventilators  = data.get("total_ventilators", 0),
            available_ventilators = data.get("available_ventilators", 0),
            specializations    = data.get("specializations", ""),
            facilities         = data.get("facilities", ""),
            emergency_services = data.get("emergency_services", False),
            status             = data.get("status", "closed"),
            is_active          = data.get("is_active", True),
        )
        if not str(h.registration_number or "").strip():
            h.registration_number = _default_hospital_registration(h.id)
        if not str(h.hospital_contract_id or "").strip():
            h.hospital_contract_id = _default_hospital_contract_id(h.id)
        h.save(update_fields=["registration_number", "hospital_contract_id"])
        return JsonResponse(hospital_to_dict(h), status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def hospital_detail(request, id):
    try:
        h = Hospital.objects.get(id=id)
    except Hospital.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse(hospital_to_dict(h))

    if request.method == "PUT":
        data = _safe_json(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        h.name               = data.get("name",               h.name)
        h.hospital_contract_id = data.get("hospital_contract_id", h.hospital_contract_id)
        h.registration_number = data.get("registration_number", h.registration_number)
        h.address            = data.get("address",            h.address)
        h.latitude           = data.get("latitude",           h.latitude)
        h.longitude          = data.get("longitude",          h.longitude)
        h.contact_number     = data.get("contact_number",     h.contact_number)
        h.email              = data.get("email",              h.email)
        h.hospital_type      = data.get("hospital_type",      h.hospital_type)
        h.total_beds         = data.get("total_beds",         h.total_beds)
        h.available_beds     = data.get("available_beds",     h.available_beds)
        h.icu_beds           = data.get("icu_beds",           h.icu_beds)
        h.total_ventilators  = data.get("total_ventilators",  h.total_ventilators)
        h.available_ventilators = data.get("available_ventilators", h.available_ventilators)
        h.specializations    = data.get("specializations",    h.specializations)
        h.facilities         = data.get("facilities",         h.facilities)
        h.emergency_services = data.get("emergency_services", h.emergency_services)
        h.status             = data.get("status",             h.status)
        h.is_active          = data.get("is_active",          h.is_active)
        h.save()
        return JsonResponse(hospital_to_dict(h))

    if request.method == "PATCH":
        data = _safe_json(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        if "registration_number" in data:
            h.registration_number = data["registration_number"]
        if "hospital_contract_id" in data:
            h.hospital_contract_id = data["hospital_contract_id"]
        if "available_beds" in data:
            h.available_beds = data["available_beds"]
        if "icu_beds" in data:
            h.icu_beds = data["icu_beds"]
        if "available_ventilators" in data:
            h.available_ventilators = data["available_ventilators"]
        if "emergency_services" in data:
            h.emergency_services = data["emergency_services"]
        if "is_active" in data:
            h.is_active = data["is_active"]
        if "status" in data:
            h.status = data["status"]
        if "facilities" in data:
            h.facilities = data["facilities"]
        if "specializations" in data:
            h.specializations = data["specializations"]
        h.save()
        return JsonResponse(hospital_to_dict(h))

    if request.method == "DELETE":
        h.delete()
        return JsonResponse({"status": "deleted"})

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def hospital_by_email(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    email = (request.GET.get("email", "") or "").strip().lower()
    if not email:
        return JsonResponse({"error": "email required"}, status=400)
    h = Hospital.objects.filter(email__iexact=email, is_active=True).first()
    if not h:
        return JsonResponse({"error": "Hospital profile not found"}, status=404)
    return JsonResponse(hospital_to_dict(h))


@csrf_exempt
def hospital_dashboard(request, id):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    try:
        hospital = Hospital.objects.get(id=id)
    except Hospital.DoesNotExist:
        return JsonResponse({"error": "Hospital not found"}, status=404)

    active_cases = Booking.objects.filter(
        assigned_hospital_id=hospital.id,
        status__in=["confirmed", "pending"],
    ).order_by("-id")[:100]

    queue = []
    for b in active_cases:
        amb = Ambulance.objects.filter(id=b.ambulance_id).first()
        queue.append({
            "booking_id": b.id,
            "patient_name": b.patient_name or b.booked_by or "Unknown",
            "patient_age": b.patient_age or "",
            "patient_gender": b.patient_gender or "",
            "contact_number": b.patient_contact_number or b.attendant_contact or "",
            "pickup_location": b.pickup_location,
            "destination": b.destination or b.assigned_hospital_name or "",
            "status": b.status,
            "hospital_response": b.hospital_response,
            "hospital_response_note": b.hospital_response_note,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "hospital_assigned_at": b.hospital_assigned_at.isoformat() if b.hospital_assigned_at else None,
            "hospital_responded_at": b.hospital_responded_at.isoformat() if b.hospital_responded_at else None,
            "ambulance_id": b.ambulance_id,
            "ambulance_number": b.ambulance_number,
            "driver_name": b.driver,
            "driver_contact": b.driver_contact,
            "driver_email": (amb.driver_email if amb else ""),
            "live_vitals": {
                "heart_rate": 78,
                "spo2": 96,
                "bp": "120/80",
            },
            "pre_diagnosis_note": b.patient_condition or "No pre-diagnosis note yet",
            "digital_handover": {
                "vitals_summary": b.vitals_summary or "",
                "patient_condition": b.patient_condition or "",
                "report_submitted_by": b.report_submitted_by or "",
                "report_submitted_at": b.report_submitted_at.isoformat() if b.report_submitted_at else None,
                "report_sent_to_hospital": b.report_sent_to_hospital,
                "driver_voice_transcript": b.driver_voice_transcript or "",
                "driver_modified_report": b.driver_modified_report or "",
                "driver_report_sent_at": b.driver_report_sent_at.isoformat() if b.driver_report_sent_at else None,
            },
            "insurance": {
                "full_name": b.insurance_full_name or "",
                "date_of_birth": b.insurance_dob or "",
                "gender": b.insurance_gender or "",
                "provider": b.insurance_provider or "",
                "policy_member_id": b.insurance_policy_member_id or "",
                "policy_holder_name": b.insurance_policy_holder_name or "",
                "government_id": b.insurance_government_id or "",
                "sum_insured": b.insurance_sum_insured or "",
                "emergency_nature": b.insurance_emergency_nature or "",
                "exclusions_waiting": b.insurance_exclusions_waiting or "",
                "status": b.insurance_status or "pending",
                "hospital_note": b.insurance_hospital_note or "",
                "submitted_by": b.insurance_submitted_by or "",
                "submitted_at": b.insurance_submitted_at.isoformat() if b.insurance_submitted_at else None,
                "reviewed_by": b.insurance_reviewed_by or "",
                "reviewed_at": b.insurance_reviewed_at.isoformat() if b.insurance_reviewed_at else None,
            },
            "ambulance_live": {
                "latitude": amb.latitude if amb else None,
                "longitude": amb.longitude if amb else None,
                "speed": amb.speed if amb else "0",
                "battery_percentage": amb.battery_percentage if amb else None,
                "status": amb.status if amb else "offline",
                "last_updated": amb.last_updated.isoformat() if amb and amb.last_updated else None,
            },
        })

    staff_qs = HospitalStaff.objects.filter(hospital=hospital).order_by("-is_on_call", "full_name")
    on_call_specialists = [
        staff_to_dict(s) for s in staff_qs.filter(role="doctor", is_on_call=True, is_active=True)
    ]

    redirect_suggestion = None
    if hospital.available_beds <= 0 or hospital.status == "full":
        alternate = (
            Hospital.objects.filter(is_active=True, status="active", available_beds__gt=0)
            .exclude(id=hospital.id)
            .order_by("-available_beds")
            .first()
        )
        if alternate:
            redirect_suggestion = {
                "hospital_id": alternate.id,
                "hospital_name": alternate.name,
                "available_beds": alternate.available_beds,
                "available_ventilators": alternate.available_ventilators,
                "contact_number": alternate.contact_number,
            }

    return JsonResponse({
        "hospital": hospital_to_dict(hospital),
        "summary": {
            "active_cases": len(queue),
            "icu_beds": hospital.icu_beds,
            "available_beds": hospital.available_beds,
            "available_ventilators": hospital.available_ventilators,
            "on_call_specialists": len(on_call_specialists),
            "last_sync": timezone.now().isoformat(),
        },
        "queue": queue,
        "on_call_specialists": on_call_specialists,
        "staff": [staff_to_dict(s) for s in staff_qs],
        "redirect_suggestion": redirect_suggestion,
    })


@csrf_exempt
def hospital_resources(request, id):
    try:
        hospital = Hospital.objects.get(id=id)
    except Hospital.DoesNotExist:
        return JsonResponse({"error": "Hospital not found"}, status=404)

    if request.method == "GET":
        return JsonResponse({
            "hospital_id": hospital.id,
            "available_beds": hospital.available_beds,
            "icu_beds": hospital.icu_beds,
            "available_ventilators": hospital.available_ventilators,
            "total_beds": hospital.total_beds,
            "total_ventilators": hospital.total_ventilators,
            "status": hospital.status,
            "specializations": hospital.specializations,
            "facilities": hospital.facilities,
        })

    if request.method == "PATCH":
        data = _safe_json(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        if "available_beds" in data:
            hospital.available_beds = max(0, int(data["available_beds"]))
        if "icu_beds" in data:
            hospital.icu_beds = max(0, int(data["icu_beds"]))
        if "available_ventilators" in data:
            hospital.available_ventilators = max(0, int(data["available_ventilators"]))
        if "status" in data:
            hospital.status = data["status"]
        if "specializations" in data:
            hospital.specializations = data["specializations"]
        if "facilities" in data:
            hospital.facilities = data["facilities"]
        hospital.save()
        return JsonResponse(hospital_to_dict(hospital))

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def hospital_staff_list(request, hospital_id):
    try:
        hospital = Hospital.objects.get(id=hospital_id)
    except Hospital.DoesNotExist:
        return JsonResponse({"error": "Hospital not found"}, status=404)

    if request.method == "GET":
        staff = HospitalStaff.objects.filter(hospital=hospital).order_by("-is_on_call", "full_name")
        return JsonResponse([staff_to_dict(s) for s in staff], safe=False)

    if request.method == "POST":
        data = _safe_json(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        staff = HospitalStaff.objects.create(
            hospital=hospital,
            full_name=data.get("full_name", "").strip(),
            role=data.get("role", "doctor"),
            specialization=data.get("specialization", ""),
            contact_number=data.get("contact_number", ""),
            email=data.get("email", ""),
            photo_data=data.get("photo_data", ""),
            banner_data=data.get("banner_data", ""),
            is_on_call=bool(data.get("is_on_call", False)),
            is_active=bool(data.get("is_active", True)),
            years_experience=int(data.get("years_experience", 0) or 0),
        )
        return JsonResponse(staff_to_dict(staff), status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def hospital_staff_detail(request, hospital_id, staff_id):
    try:
        Hospital.objects.get(id=hospital_id)
        staff = HospitalStaff.objects.get(id=staff_id, hospital_id=hospital_id)
    except (Hospital.DoesNotExist, HospitalStaff.DoesNotExist):
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse(staff_to_dict(staff))

    if request.method == "PATCH":
        data = _safe_json(request)
        if data is None:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)
        if "full_name" in data:
            staff.full_name = data["full_name"]
        if "role" in data:
            staff.role = data["role"]
        if "specialization" in data:
            staff.specialization = data["specialization"]
        if "contact_number" in data:
            staff.contact_number = data["contact_number"]
        if "email" in data:
            staff.email = data["email"]
        if "photo_data" in data:
            staff.photo_data = data["photo_data"]
        if "banner_data" in data:
            staff.banner_data = data["banner_data"]
        if "is_on_call" in data:
            staff.is_on_call = bool(data["is_on_call"])
        if "is_active" in data:
            staff.is_active = bool(data["is_active"])
        if "years_experience" in data:
            staff.years_experience = int(data["years_experience"] or 0)
        staff.save()
        return JsonResponse(staff_to_dict(staff))

    if request.method == "DELETE":
        staff.delete()
        return JsonResponse({"status": "deleted"})

    return JsonResponse({"error": "Method not allowed"}, status=405)
