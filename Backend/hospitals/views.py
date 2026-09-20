from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from django.conf import settings
from django.db.models import Q
from django.contrib.auth.hashers import make_password, check_password
from hospitals.models import Hospital, HospitalStaff, HospitalBed
from bookings.models import Booking
from bookings.views import booking_to_dict
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
        "staff_id": getattr(s, "staff_id", ""),
        "registration_number": getattr(s, "registration_number", ""),
        "specialization": s.specialization,
        "contact_number": s.contact_number,
        "email": s.email,
        "photo_data": s.photo_data,
        "banner_data": s.banner_data,
        "is_on_call": s.is_on_call,
        "is_active": s.is_active,
        "is_busy": getattr(s, "is_busy", False),
        "assigned_booking_id": getattr(s, "assigned_booking_id", None),
        "years_experience": s.years_experience,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


def bed_to_dict(bed):
    return {
        "id": bed.id,
        "hospital_id": bed.hospital_id,
        "bed_number": bed.bed_number,
        "bed_type": bed.bed_type,
        "status": bed.status,
        "wing": bed.wing,
        "assigned_booking_id": bed.assigned_booking_id,
        "patient_name": bed.patient_name,
        "patient_age": bed.patient_age,
        "patient_gender": bed.patient_gender,
        "blood_group": bed.blood_group,
        "patient_phone": bed.patient_phone,
        "emergency_contact": bed.emergency_contact,
        "medical_condition": bed.medical_condition,
        "vitals_summary": bed.vitals_summary,
        "attending_doctor": bed.attending_doctor,
        "assigned_staff_json": bed.assigned_staff_json,
        "admission_time": bed.admission_time.isoformat() if bed.admission_time else None,
        "last_status_update": bed.last_status_update.isoformat() if bed.last_status_update else None,
        "created_at": bed.created_at.isoformat() if bed.created_at else None,
    }


@csrf_exempt
def hospital_beds(request, hospital_id):
    """GET all beds for a hospital (auto-seeds if none). PATCH a single bed."""
    try:
        hospital = Hospital.objects.get(id=hospital_id)
    except Hospital.DoesNotExist:
        return JsonResponse({"error": "Hospital not found"}, status=404)

    if request.method == "GET":
        beds = HospitalBed.objects.filter(hospital=hospital)
        # Auto-seed beds if none exist
        if not beds.exists():
            total_general = max(1, hospital.total_beds - hospital.icu_beds)
            total_icu = max(0, hospital.icu_beds)
            created = []
            for i in range(1, total_general + 1):
                b = HospitalBed.objects.create(
                    hospital=hospital,
                    bed_number=f"G-{i:03d}",
                    bed_type="general",
                    status="available",
                    wing="General Ward"
                )
                created.append(b)
            for i in range(1, total_icu + 1):
                b = HospitalBed.objects.create(
                    hospital=hospital,
                    bed_number=f"ICU-{i:03d}",
                    bed_type="icu",
                    status="available",
                    wing="ICU"
                )
                created.append(b)
            return JsonResponse([bed_to_dict(b) for b in created], safe=False)
        return JsonResponse([bed_to_dict(b) for b in beds], safe=False)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def hospital_bed_detail(request, bed_id):
    """PATCH a single bed's fields."""
    try:
        bed = HospitalBed.objects.get(id=bed_id)
    except HospitalBed.DoesNotExist:
        return JsonResponse({"error": "Bed not found"}, status=404)

    if request.method == "PATCH":
        import json as _json
        try:
            data = _json.loads(request.body)
        except Exception:
            data = {}
        allowed = [
            "status", "wing", "assigned_booking_id", "patient_name", "patient_age",
            "patient_gender", "blood_group", "patient_phone", "emergency_contact",
            "medical_condition", "vitals_summary", "attending_doctor",
            "assigned_staff_json", "admission_time"
        ]
        for field in allowed:
            if field in data:
                setattr(bed, field, data[field])
        bed.save()
        return JsonResponse(bed_to_dict(bed))

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def assign_bed_to_booking(request, hospital_id):
    """POST: assign the first available general bed to a booking."""
    import json as _json
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data = _json.loads(request.body)
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    booking_id = data.get("booking_id")
    if not booking_id:
        return JsonResponse({"error": "booking_id required"}, status=400)

    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Booking not found"}, status=404)

    bed_id = data.get("bed_id")
    bed = None
    if bed_id:
        bed = HospitalBed.objects.filter(id=bed_id).first()
    if not bed:
        bed_type_pref = str(data.get("bed_type", "general")).lower()
        bed = HospitalBed.objects.filter(hospital_id=hospital_id, bed_type=bed_type_pref, status="available").first()
    if not bed:
        # Fallback to any available bed in hospital
        bed = HospitalBed.objects.filter(hospital_id=hospital_id, status="available").first()
    if not bed:
        return JsonResponse({"error": "No available bed found in this hospital"}, status=409)

    # If this booking already held another bed (e.g. switching to ICU or different bed), free it
    if booking.assigned_bed_id and booking.assigned_bed_id != bed.id:
        old_bed = HospitalBed.objects.filter(id=booking.assigned_bed_id).first()
        if old_bed:
            old_bed.status = "available"
            old_bed.assigned_booking_id = None
            old_bed.patient_name = ""
            old_bed.patient_age = ""
            old_bed.patient_gender = ""
            old_bed.blood_group = ""
            old_bed.patient_phone = ""
            old_bed.emergency_contact = ""
            old_bed.medical_condition = ""
            old_bed.vitals_summary = ""
            old_bed.attending_doctor = ""
            old_bed.assigned_staff_json = "[]"
            old_bed.admission_time = None
            old_bed.save()

    # Assign target bed
    bed.status = "reserved"
    bed.assigned_booking_id = booking.id
    bed.patient_name = booking.patient_name or booking.booked_by or "Emergency Intake"
    bed.patient_age = booking.patient_age
    bed.patient_gender = booking.patient_gender
    bed.patient_phone = booking.patient_contact_number
    bed.medical_condition = booking.patient_condition or ("Critical Care Required" if bed.bed_type == "icu" else "General Inpatient Care")
    bed.vitals_summary = booking.vitals_summary
    bed.attending_doctor = booking.assigned_doctor_names
    bed.admission_time = timezone.now()
    bed.save()

    # Update booking
    booking.assigned_bed_id = bed.id
    booking.assigned_bed_number = bed.bed_number
    booking.assigned_bed_type = bed.bed_type
    booking.save()

    # Keep the complete team already allocated for this booking. Bed allocation
    # must not replace it with a smaller auto-selected team.
    existing_team = []
    try:
        parsed_team = _json.loads(booking.assigned_doctors_json or "[]")
        if isinstance(parsed_team, list):
            existing_team = parsed_team
    except Exception:
        existing_team = []
    if not existing_team and booking.assigned_doctor_names:
        names = [name.strip() for name in str(booking.assigned_doctor_names).split(",") if name.strip()]
        specs = [spec.strip() for spec in str(booking.assigned_doctor_specializations or "").split(",")]
        existing_team = [
            {
                "full_name": name,
                "role": (spec.split(":", 1)[0].strip() if ":" in spec else "care team"),
                "specialization": (spec.split(":", 1)[1].strip() if ":" in spec else (spec or "Assigned care")),
            }
            for index, name in enumerate(names)
            for spec in [specs[index] if index < len(specs) else "Assigned care"]
        ]
    if existing_team:
        bed.assigned_staff_json = _json.dumps(existing_team)
        bed.attending_doctor = booking.assigned_doctor_names or ", ".join(str(member.get("full_name") or member.get("name") or "") for member in existing_team)
        bed.save(update_fields=["assigned_staff_json", "attending_doctor", "last_status_update"])
        return JsonResponse({"bed": bed_to_dict(bed), "booking_id": booking_id})

    # Automatically attach the best available multidisciplinary team whenever
    # a bed is allocated; the response pages only display the result.
    condition = f"{booking.patient_condition} {booking.vitals_summary} {booking.destination}".lower()
    terms = [term for term in ("cardio", "neuro", "trauma", "orthopedic", "respiratory", "emergency", "icu") if term in condition]
    selected = []
    available = HospitalStaff.objects.filter(hospital_id=hospital_id, is_active=True, is_busy=False)
    for role in ("doctor", "nurse", "technician", "support"):
        candidates = list(available.filter(role=role))
        if candidates:
            candidates.sort(key=lambda s: (sum(t in (s.specialization or "").lower() for t in terms) * 100 + (s.is_on_call * 25) + s.years_experience * 3), reverse=True)
            selected.append(candidates[0])
    if selected:
        payload = [{"id": s.id, "full_name": s.full_name, "role": s.role, "specialization": s.specialization, "contact_number": s.contact_number, "years_experience": s.years_experience} for s in selected]
        for s in selected:
            s.is_active, s.is_busy, s.assigned_booking_id = True, True, booking.id
            s.save(update_fields=["is_active", "is_busy", "assigned_booking_id", "updated_at"])
        booking.assigned_doctors_json = json.dumps(payload)
        booking.assigned_doctor_names = ", ".join(s.full_name for s in selected)
        booking.assigned_doctor_specializations = ", ".join(f"{s.role}: {s.specialization or 'General'}" for s in selected)
        booking.assigned_doctor_contacts = ", ".join(s.contact_number for s in selected if s.contact_number)
        booking.doctors_assigned_at = timezone.now()
        booking.save(update_fields=["assigned_doctors_json", "assigned_doctor_names", "assigned_doctor_specializations", "assigned_doctor_contacts", "doctors_assigned_at"])
        bed.assigned_staff_json = json.dumps(payload)
        bed.attending_doctor = booking.assigned_doctor_names
        bed.save(update_fields=["assigned_staff_json", "attending_doctor", "last_status_update"])

    return JsonResponse({"bed": bed_to_dict(bed), "booking_id": booking_id})


@csrf_exempt
def assign_staff_team(request, hospital_id):
    """Build the best available multidisciplinary team for a booking."""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    data = _safe_json(request) or {}
    try:
        booking = Booking.objects.get(id=data.get("booking_id"), assigned_hospital_id=hospital_id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Booking not found for this hospital"}, status=404)

    requested_ids = {int(x) for x in (data.get("staff_ids") or []) if str(x).isdigit()}
    staff_qs = HospitalStaff.objects.filter(hospital_id=hospital_id).filter(
        Q(is_active=True, is_busy=False) | Q(id__in=requested_ids)
    )
    condition = f"{booking.patient_condition} {booking.vitals_summary} {booking.destination}".lower()
    specialty_terms = [term for term in ("cardio", "neuro", "trauma", "orthopedic", "respiratory", "emergency", "icu") if term in condition]
    team = []
    for role in ("doctor", "nurse", "technician", "support"):
        candidates = list(staff_qs.filter(role=role))
        requested = [s for s in candidates if s.id in requested_ids]
        if requested:
            candidates = requested
        if not candidates:
            continue
        candidates.sort(key=lambda s: (sum(term in (s.specialization or "").lower() for term in specialty_terms) * 100 + (s.is_on_call * 25) + (s.years_experience * 3)), reverse=True)
        team.append(candidates[0])

    if not team:
        return JsonResponse({"error": "No available hospital staff found"}, status=409)
    HospitalStaff.objects.filter(assigned_booking_id=booking.id).update(is_active=True, is_busy=False, assigned_booking_id=None)
    payload = [{"id": s.id, "full_name": s.full_name, "role": s.role, "specialization": s.specialization, "contact_number": s.contact_number, "years_experience": s.years_experience} for s in team]
    for s in team:
        s.is_active = True
        s.is_busy = True
        s.assigned_booking_id = booking.id
        s.save(update_fields=["is_active", "is_busy", "assigned_booking_id", "updated_at"])
    booking.assigned_doctors_json = json.dumps(payload)
    booking.assigned_doctor_names = ", ".join(s.full_name for s in team)
    booking.assigned_doctor_specializations = ", ".join(f"{s.role}: {s.specialization or 'General'}" for s in team)
    booking.assigned_doctor_contacts = ", ".join(s.contact_number for s in team if s.contact_number)
    booking.doctors_assigned_at = timezone.now()
    booking.save(update_fields=["assigned_doctors_json", "assigned_doctor_names", "assigned_doctor_specializations", "assigned_doctor_contacts", "doctors_assigned_at"])
    bed = HospitalBed.objects.filter(id=booking.assigned_bed_id).first() if booking.assigned_bed_id else None
    if bed:
        bed.assigned_staff_json = json.dumps(payload)
        bed.attending_doctor = booking.assigned_doctor_names
        bed.save(update_fields=["assigned_staff_json", "attending_doctor", "last_status_update"])
    return JsonResponse({"team": payload, "booking_id": booking.id, "bed": bed_to_dict(bed) if bed else None})


@csrf_exempt
def switch_to_icu_bed(request, hospital_id):
    """POST: switch patient from general bed to available ICU bed."""
    import json as _json
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)
    try:
        data = _json.loads(request.body)
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    booking_id = data.get("booking_id")
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Booking not found"}, status=404)

    # Get current general bed
    current_bed = HospitalBed.objects.filter(id=booking.assigned_bed_id).first() if booking.assigned_bed_id else None

    # Find available ICU bed
    icu_bed = HospitalBed.objects.filter(hospital_id=hospital_id, bed_type="icu", status="available").first()
    if not icu_bed:
        return JsonResponse({"error": "No available ICU beds"}, status=409)

    # Copy patient info to ICU bed
    if current_bed:
        icu_bed.patient_name = current_bed.patient_name
        icu_bed.patient_age = current_bed.patient_age
        icu_bed.patient_gender = current_bed.patient_gender
        icu_bed.blood_group = current_bed.blood_group
        icu_bed.patient_phone = current_bed.patient_phone
        icu_bed.emergency_contact = current_bed.emergency_contact
        icu_bed.medical_condition = current_bed.medical_condition
        icu_bed.vitals_summary = current_bed.vitals_summary
        icu_bed.attending_doctor = current_bed.attending_doctor
        icu_bed.assigned_staff_json = current_bed.assigned_staff_json
        icu_bed.admission_time = current_bed.admission_time

        # Free the general bed
        current_bed.status = "available"
        current_bed.assigned_booking_id = None
        current_bed.patient_name = ""
        current_bed.patient_age = ""
        current_bed.patient_gender = ""
        current_bed.blood_group = ""
        current_bed.patient_phone = ""
        current_bed.emergency_contact = ""
        current_bed.medical_condition = ""
        current_bed.vitals_summary = ""
        current_bed.attending_doctor = ""
        current_bed.assigned_staff_json = "[]"
        current_bed.admission_time = None
        current_bed.save()

    icu_bed.status = "occupied"
    icu_bed.assigned_booking_id = booking_id
    icu_bed.save()

    # Update booking
    booking.assigned_bed_id = icu_bed.id
    booking.assigned_bed_number = icu_bed.bed_number
    booking.assigned_bed_type = icu_bed.bed_type
    booking.save()

    return JsonResponse({"icu_bed": bed_to_dict(icu_bed), "freed_bed": bed_to_dict(current_bed) if current_bed else None})


def resolve_hospital_by_email(email):
    hospital = Hospital.objects.filter(email__iexact=email, is_active=True).first()
    if hospital or not getattr(settings, "DEBUG", False):
        return hospital
    active_hospitals = list(Hospital.objects.filter(is_active=True)[:2])
    if len(active_hospitals) == 1:
        return active_hospitals[0]
    return None


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
    h = resolve_hospital_by_email(email)
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

    hospital_filter = Q(assigned_hospital_id=hospital.id)
    if hospital.email:
        hospital_filter |= Q(assigned_hospital_email__iexact=hospital.email)
    if hospital.name:
        hospital_filter |= Q(assigned_hospital_name__iexact=hospital.name) | Q(destination__iexact=hospital.name)

    active_cases = (
        Booking.objects.filter(hospital_filter)
        .filter(
            Q(status__in=["confirmed", "pending"])
            | Q(report_sent_to_hospital=True)
            | Q(report_submitted_at__isnull=False)
        )
        .order_by("-id")[:100]
    )

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
            "pickup_latitude": b.pickup_latitude,
            "pickup_longitude": b.pickup_longitude,
            "destination": b.destination or b.assigned_hospital_name or "",
            "assigned_hospital_id": b.assigned_hospital_id,
            "assigned_hospital_name": b.assigned_hospital_name,
            "assigned_hospital_address": b.assigned_hospital_address,
            "assigned_hospital_contact": b.assigned_hospital_contact,
            "assigned_hospital_email": b.assigned_hospital_email,
            "status": b.status,
            "hospital_response": b.hospital_response,
            "hospital_response_note": b.hospital_response_note,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "hospital_assigned_at": b.hospital_assigned_at.isoformat() if b.hospital_assigned_at else None,
            "hospital_responded_at": b.hospital_responded_at.isoformat() if b.hospital_responded_at else None,
            "report_sent_to_hospital": b.report_sent_to_hospital,
            "report_sent_to_hospital_at": b.report_sent_to_hospital_at.isoformat() if b.report_sent_to_hospital_at else None,
            "report_submitted_by": b.report_submitted_by or "",
            "report_submitted_at": b.report_submitted_at.isoformat() if b.report_submitted_at else None,
            "assigned_doctors_json": getattr(b, "assigned_doctors_json", "[]"),
            "assigned_doctor_names": getattr(b, "assigned_doctor_names", ""),
            "assigned_doctor_specializations": getattr(b, "assigned_doctor_specializations", ""),
            "assigned_doctor_contacts": getattr(b, "assigned_doctor_contacts", ""),
            "doctors_assigned_at": b.doctors_assigned_at.isoformat() if getattr(b, "doctors_assigned_at", None) else None,
            "assigned_bed_id": getattr(b, "assigned_bed_id", None),
            "assigned_bed_number": getattr(b, "assigned_bed_number", ""),
            "assigned_bed_type": getattr(b, "assigned_bed_type", "general"),
            "icu_required": getattr(b, "icu_required", False),
            "icu_requested_at": b.icu_requested_at.isoformat() if getattr(b, "icu_requested_at", None) else None,
            "patient_condition": b.patient_condition or "",
            "vitals_summary": b.vitals_summary or "",
            "driver_modified_report": b.driver_modified_report or "",
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
        full_name = str(data.get("full_name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        staff_id_value = str(data.get("staff_id", "")).strip()
        registration_number = str(data.get("registration_number", "")).strip()
        if not full_name or not email or not staff_id_value or not registration_number:
            return JsonResponse({"error": "Name, email, Staff ID and Reg. No. are required"}, status=400)
        role = str(data.get("role", "doctor")).lower()
        if role not in dict(HospitalStaff.ROLE_CHOICES):
            return JsonResponse({"error": "Invalid staff role"}, status=400)
        duplicate = HospitalStaff.objects.filter(
            Q(staff_id__iexact=staff_id_value) | Q(registration_number__iexact=registration_number)
        ).exists()
        if duplicate:
            return JsonResponse({"error": "Staff ID or Reg. No. is already assigned to another staff member"}, status=409)
        staff = HospitalStaff.objects.create(
            hospital=hospital,
            full_name=full_name,
            role=role,
            staff_id=staff_id_value,
            registration_number=registration_number,
            # The hospital creates the staff identity only. Staff set their
            # password themselves during signup after Gmail OTP verification.
            password_hash="",
            specialization=data.get("specialization", ""),
            contact_number=data.get("contact_number", ""),
            email=email,
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
            staff.email = str(data["email"]).strip().lower()
        if "staff_id" in data or "registration_number" in data:
            next_staff_id = str(data.get("staff_id", staff.staff_id)).strip()
            next_registration_number = str(data.get("registration_number", staff.registration_number)).strip()
            if not next_staff_id or not next_registration_number:
                return JsonResponse({"error": "Staff ID and Reg. No. cannot be empty"}, status=400)
            duplicate = HospitalStaff.objects.filter(
                Q(staff_id__iexact=next_staff_id) | Q(registration_number__iexact=next_registration_number)
            ).exclude(id=staff.id).exists()
            if duplicate:
                return JsonResponse({"error": "Staff ID or Reg. No. is already assigned to another staff member"}, status=409)
            staff.staff_id = next_staff_id
            staff.registration_number = next_registration_number
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


def _staff_auth_payload(staff):
    return {
        "valid": True,
        "role": "staff",
        "staff_role": staff.role,
        "staff": staff_to_dict(staff),
        "hospital": hospital_to_dict(staff.hospital),
        "hospital_id": staff.hospital_id,
        "hospital_name": staff.hospital.name,
        "staff_id": staff.staff_id,
        "registration_number": staff.registration_number,
        "name": staff.full_name,
        "email": staff.email,
    }


@csrf_exempt
def staff_signup(request):
    """Set a staff password after the frontend has verified Gmail OTP."""
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = _safe_json(request) or {}
    email = str(data.get("email", "")).strip().lower()
    staff_id = str(data.get("staff_id", "")).strip()
    registration_number = str(data.get("registration_number", "")).strip()
    password = str(data.get("password", ""))
    if not all((email, staff_id, registration_number)):
        return JsonResponse({"error": "Email, Staff ID and Registration No. are required"}, status=400)
    if len(password) < 6:
        return JsonResponse({"error": "Password must be at least 6 characters"}, status=400)

    staff = HospitalStaff.objects.select_related("hospital").filter(
        email__iexact=email,
        staff_id__iexact=staff_id,
        registration_number__iexact=registration_number,
        is_active=True,
    ).first()
    if not staff:
        return JsonResponse({"error": "Staff details do not match the hospital records"}, status=401)
    if not staff.hospital.is_active:
        return JsonResponse({"error": "This hospital account is currently inactive"}, status=403)
    if staff.password_hash:
        return JsonResponse({"error": "Staff account is already set up. Please use Sign In."}, status=409)

    # The first request validates the hospital-issued identity before the
    # frontend sends Gmail OTP. Password is stored only after OTP succeeds.
    if data.get("verify_only"):
        return JsonResponse({"valid": True, "otp_required": True})

    staff.password_hash = make_password(password)
    staff.save(update_fields=["password_hash", "updated_at"])
    return JsonResponse(_staff_auth_payload(staff))


@csrf_exempt
def staff_login(request):
    """Authenticate a hospital staff member using hospital-issued credentials."""
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = _safe_json(request) or {}
    email = str(data.get("email", "")).strip().lower()
    staff_id = str(data.get("staff_id", "")).strip()
    registration_number = str(data.get("registration_number", "")).strip()
    password = str(data.get("password", ""))
    if not all((email, staff_id, registration_number, password)):
        return JsonResponse({"error": "Email, Staff ID, Registration No. and password are required"}, status=400)

    staff = HospitalStaff.objects.select_related("hospital").filter(
        email__iexact=email,
        staff_id__iexact=staff_id,
        registration_number__iexact=registration_number,
        is_active=True,
    ).first()
    if not staff or not staff.password_hash or not check_password(password, staff.password_hash):
        return JsonResponse({"error": "Staff details or password do not match hospital records"}, status=401)
    if not staff.hospital.is_active:
        return JsonResponse({"error": "This hospital account is currently inactive"}, status=403)

    return JsonResponse(_staff_auth_payload(staff))


@csrf_exempt
def staff_dashboard(request):
    """Return the signed-in staff profile and only cases assigned to them."""
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    staff_id = str(request.GET.get("staff_id", "")).strip()
    email = str(request.GET.get("email", "")).strip().lower()
    if not staff_id or not email:
        return JsonResponse({"error": "staff_id and email are required"}, status=400)
    staff = HospitalStaff.objects.select_related("hospital").filter(
        staff_id__iexact=staff_id,
        email__iexact=email,
        is_active=True,
    ).first()
    if not staff:
        return JsonResponse({"error": "Staff account not found or inactive"}, status=404)

    case_filter = Q(assigned_hospital_id=staff.hospital_id)
    if staff.hospital.email:
        case_filter |= Q(assigned_hospital_email__iexact=staff.hospital.email)
    if staff.hospital.name:
        case_filter |= Q(assigned_hospital_name__iexact=staff.hospital.name) | Q(destination__iexact=staff.hospital.name)

    cases = []
    for booking in Booking.objects.filter(case_filter).order_by("-id")[:200]:
        team = []
        try:
            parsed = json.loads(getattr(booking, "assigned_doctors_json", "[]") or "[]")
            team = parsed if isinstance(parsed, list) else []
        except (TypeError, ValueError):
            team = []
        assigned = any(
            str(member.get("id", "")) == str(staff.id)
            or str(member.get("staff_id", "")).lower() == staff.staff_id.lower()
            or str(member.get("full_name", member.get("name", ""))).strip().lower() == staff.full_name.strip().lower()
            for member in team if isinstance(member, dict)
        )
        assigned = assigned or staff.assigned_booking_id == booking.id
        if not assigned and staff.full_name:
            assigned = staff.full_name.strip().lower() in str(getattr(booking, "assigned_doctor_names", "")).lower()
        if not assigned:
            continue
        row = booking_to_dict(booking)
        row["assigned_team"] = team
        row["staff_role"] = staff.role
        cases.append(row)

    active_cases = [item for item in cases if item.get("status") not in {"completed", "cancelled"}]
    urgent_cases = [item for item in active_cases if any(
        token in f"{item.get('patient_condition', '')} {item.get('vitals_summary', '')}".lower()
        for token in ("critical", "cardiac", "stroke", "trauma", "icu", "emergency")
    )]
    completed_cases = [item for item in cases if item.get("status") == "completed"]
    team_members = sum(len(item.get("assigned_team") or []) for item in cases)
    return JsonResponse({
        "staff": staff_to_dict(staff),
        "hospital": hospital_to_dict(staff.hospital),
        "summary": {
            "assigned_cases": len(cases),
            "active_cases": len(active_cases),
            "urgent_cases": len(urgent_cases),
            "bed_allocated_cases": sum(1 for item in cases if item.get("assigned_bed_number")),
            "completed_cases": len(completed_cases),
            "team_members": team_members,
            "new_allocations": sum(1 for item in active_cases if item.get("doctors_assigned_at")),
        },
        "cases": cases,
    })


@csrf_exempt
def staff_notifications(request):
    """Return allocation alerts for every staff member on a booking team."""
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    staff_id = str(request.GET.get("staff_id", "")).strip()
    email = str(request.GET.get("email", "")).strip().lower()
    staff = HospitalStaff.objects.select_related("hospital").filter(staff_id__iexact=staff_id, email__iexact=email, is_active=True).first()
    if not staff:
        return JsonResponse({"error": "Staff account not found or inactive"}, status=404)
    hospital_filter = Q(assigned_hospital_id=staff.hospital_id)
    if staff.hospital.email:
        hospital_filter |= Q(assigned_hospital_email__iexact=staff.hospital.email)
    if staff.hospital.name:
        hospital_filter |= Q(assigned_hospital_name__iexact=staff.hospital.name) | Q(destination__iexact=staff.hospital.name)
    notifications = []
    for booking in Booking.objects.filter(hospital_filter).order_by("-doctors_assigned_at", "-id")[:100]:
        try:
            team = json.loads(getattr(booking, "assigned_doctors_json", "[]") or "[]")
        except (TypeError, ValueError):
            team = []
        assigned = any(isinstance(member, dict) and (str(member.get("id", "")) == str(staff.id) or str(member.get("staff_id", "")).lower() == staff.staff_id.lower() or str(member.get("full_name", member.get("name", ""))).strip().lower() == staff.full_name.strip().lower()) for member in team)
        if not assigned and staff.assigned_booking_id == booking.id:
            assigned = True
        if not assigned and staff.full_name:
            assigned = staff.full_name.strip().lower() in str(getattr(booking, "assigned_doctor_names", "")).lower()
        if not assigned:
            continue
        notifications.append({
            "id": f"staff-{staff.id}-booking-{booking.id}",
            "booking_id": booking.id,
            "title": f"Booking #{booking.id} is allocated to you",
            "message": f"{booking.patient_name or booking.booked_by or 'Patient'} · Start the care workflow at {booking.assigned_hospital_name or staff.hospital.name}.",
            "status": booking.status,
            "timestamp": getattr(booking, "doctors_assigned_at", None).isoformat() if getattr(booking, "doctors_assigned_at", None) else booking.created_at.isoformat(),
        })
    return JsonResponse({"notifications": notifications})
