from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.core.mail import send_mail
from django.utils import timezone
from bookings.models import Booking, BookingChatThread, BookingChatMessage
from ambulance.models import Ambulance, SuggestedRoute
from hospitals.models import Hospital
import json
import re


def _to_bool(val):
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(val)


def _to_float(val):
    try:
        if val in ("", None):
            return None
        return float(val)
    except (TypeError, ValueError):
        return None


def _to_int(val, default=0):
    try:
        if val in ("", None):
            return default
        return int(val)
    except (TypeError, ValueError):
        return default


def _safe_json_load(raw):
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def _target_role_from_metadata(raw):
    meta = _safe_json_load(raw)
    target = str(meta.get("target_role", "all") or "all").strip().lower()
    return target if target in {"all", "admin", "driver", "user"} else "all"


def _is_visible_to_role(message_obj, role):
    target = _target_role_from_metadata(getattr(message_obj, "metadata", ""))
    return target == "all" or target == role or getattr(message_obj, "sender_role", "") == role


def _thread_to_dict(t, include_last_message=True):
    data = {
        "id": t.id,
        "booking_id": t.booking_id,
        "user_email": t.user_email,
        "user_name": t.user_name,
        "driver_email": t.driver_email,
        "driver_name": t.driver_name,
        "admin_email": t.admin_email,
        "is_active": t.is_active,
        "user_online": t.user_online,
        "driver_online": t.driver_online,
        "admin_online": t.admin_online,
        "user_typing": t.user_typing,
        "driver_typing": t.driver_typing,
        "admin_typing": t.admin_typing,
        "user_last_seen_at": t.user_last_seen_at.isoformat() if t.user_last_seen_at else None,
        "driver_last_seen_at": t.driver_last_seen_at.isoformat() if t.driver_last_seen_at else None,
        "admin_last_seen_at": t.admin_last_seen_at.isoformat() if t.admin_last_seen_at else None,
        "last_message_at": t.last_message_at.isoformat() if t.last_message_at else None,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }
    if include_last_message:
        last = t.messages.order_by("-created_at").first()
        if last:
            data["last_message"] = _message_to_dict(last)
    return data


def _message_to_dict(m):
    target_role = _target_role_from_metadata(m.metadata)
    return {
        "id": m.id,
        "thread_id": m.thread_id,
        "sender_role": m.sender_role,
        "sender_name": m.sender_name,
        "message_type": m.message_type,
        "message": m.message,
        "metadata": m.metadata,
        "seen_by_user": m.seen_by_user,
        "seen_by_driver": m.seen_by_driver,
        "seen_by_admin": m.seen_by_admin,
        "target_role": target_role,
        "created_at": m.created_at.isoformat(),
    }


def _ensure_chat_thread(booking):
    amb_email = ""
    try:
        amb = Ambulance.objects.filter(id=booking.ambulance_id).first()
        amb_email = (amb.driver_email or "") if amb else ""
    except Exception:
        amb_email = ""
    thread, _ = BookingChatThread.objects.get_or_create(
        booking=booking,
        defaults={
            "user_email": booking.booked_by_email or "",
            "user_name": booking.booked_by or "",
            "driver_email": amb_email,
            "driver_name": booking.driver or "",
        },
    )
    changed = False
    if booking.booked_by_email and thread.user_email != booking.booked_by_email:
        thread.user_email = booking.booked_by_email
        changed = True
    if booking.booked_by and thread.user_name != booking.booked_by:
        thread.user_name = booking.booked_by
        changed = True
    if booking.driver and thread.driver_name != booking.driver:
        thread.driver_name = booking.driver
        changed = True
    if amb_email and thread.driver_email != amb_email:
        thread.driver_email = amb_email
        changed = True
    if changed:
        thread.save(update_fields=["user_email", "user_name", "driver_email", "driver_name", "updated_at"])
    return thread


def _push_system_chat(booking, message, message_type="update", metadata="", target_role="all"):
    thread = _ensure_chat_thread(booking)
    if target_role not in {"all", "admin", "driver", "user"}:
        target_role = "all"
    meta = _safe_json_load(metadata)
    meta["target_role"] = target_role
    BookingChatMessage.objects.create(
        thread=thread,
        sender_role="system",
        sender_name="SwiftRescue AI",
        message_type=message_type,
        message=message,
        metadata=json.dumps(meta),
    )
    thread.last_message_at = timezone.now()
    thread.save(update_fields=["last_message_at", "updated_at"])


def _chat_thread_id(booking):
    try:
        return booking.chat_thread.id
    except Exception:
        return None


def _build_modified_driver_report(booking, transcript):
    clean_transcript = str(transcript or "").strip()
    patient_name = str(booking.patient_name or booking.booked_by or "Unknown Patient").strip()
    pickup = str(booking.pickup_location or "-").strip()
    hospital_name = str(booking.assigned_hospital_name or booking.destination or "Pending Hospital").strip()
    driver_name = str(booking.driver or "Driver Team").strip()
    condition = str(booking.patient_condition or "").strip()
    vitals = str(booking.vitals_summary or "").strip()
    condition_line = condition if condition else "Condition details not provided."
    vitals_line = vitals if vitals else "Vitals pending from onboard assessment."
    if not clean_transcript:
        clean_transcript = "No transcript captured from mic input."
    return (
        f"SwiftRescue Driver Voice Report\n"
        f"Booking ID: #{booking.id}\n"
        f"Patient: {patient_name}\n"
        f"Pickup: {pickup}\n"
        f"Hospital: {hospital_name}\n"
        f"Driver: {driver_name}\n\n"
        f"Driver Observation:\n{condition_line}\n\n"
        f"Vitals Snapshot:\n{vitals_line}\n\n"
        f"Voice Transcript (raw):\n{clean_transcript}\n"
    )


def _extract_vitals_snippet(text):
    raw = str(text or "")
    pulse_match = re.search(r"(pulse|hr|heart rate)[^\d]*(\d{2,3})", raw, re.IGNORECASE)
    bp_match = re.search(r"(\d{2,3}\s*/\s*\d{2,3})", raw, re.IGNORECASE)
    spo2_match = re.search(r"(spo2|oxygen)[^\d]*(\d{2,3})", raw, re.IGNORECASE)
    parts = []
    if pulse_match:
        parts.append(f"Pulse {pulse_match.group(2)}")
    if bp_match:
        parts.append(f"BP {bp_match.group(1).replace(' ', '')}")
    if spo2_match:
        parts.append(f"SpO2 {spo2_match.group(2)}")
    return ", ".join(parts)


def _ai_refine_transcript(transcript):
    text = " ".join(str(transcript or "").strip().split())
    if not text:
        return {
            "patient_condition": "Condition details not captured from voice.",
            "vitals_summary": "",
            "refined_report": "No usable transcript was captured.",
        }
    normalized = text.lower()
    severity = "Moderate"
    if any(k in normalized for k in ["critical", "unconscious", "cardiac", "not breathing", "severe", "panic"]):
        severity = "High"
    if any(k in normalized for k in ["stable", "normal", "better"]):
        severity = "Low"
    vitals = _extract_vitals_snippet(text)
    condition = (
        "Patient appears serious and needs urgent clinical evaluation."
        if severity == "High"
        else "Patient condition requires observation and immediate triage."
    )
    refined = (
        f"Clinical Priority: {severity}\n"
        f"Primary Observation: {condition}\n"
        f"Driver Voice Summary: {text}\n"
        f"Recommended Action: Keep emergency team ready for immediate handover."
    )
    return {
        "patient_condition": condition,
        "vitals_summary": vitals,
        "refined_report": refined,
    }


def booking_to_dict(b):
    amb = Ambulance.objects.filter(id=b.ambulance_id).first()
    driver_email = (amb.driver_email or "") if amb else ""
    return {
        "id":               b.id,
        "ambulance_id":     b.ambulance_id,
        "ambulance_number": b.ambulance_number,
        "driver":           b.driver,
        "driver_email":     driver_email,
        "driver_contact":   b.driver_contact,
        "booked_by":        b.booked_by,
        "booked_by_email":  b.booked_by_email,
        "pickup_location":  b.pickup_location,
        "pickup_latitude":  b.pickup_latitude,
        "pickup_longitude": b.pickup_longitude,
        "pickup_landmark":  b.pickup_landmark,
        "pickup_city":      b.pickup_city,
        "pickup_district":  b.pickup_district,
        "patient_contact_number": b.patient_contact_number,
        "destination":      b.destination,
        "assigned_hospital_id": b.assigned_hospital_id,
        "assigned_hospital_name": b.assigned_hospital_name,
        "assigned_hospital_address": b.assigned_hospital_address,
        "assigned_hospital_contact": b.assigned_hospital_contact,
        "assigned_hospital_email": b.assigned_hospital_email,
        "hospital_assigned_at": b.hospital_assigned_at.isoformat() if b.hospital_assigned_at else None,
        "hospital_alert_sent": b.hospital_alert_sent,
        "hospital_alert_sent_at": b.hospital_alert_sent_at.isoformat() if b.hospital_alert_sent_at else None,
        "hospital_response": b.hospital_response,
        "hospital_response_note": b.hospital_response_note,
        "hospital_responded_at": b.hospital_responded_at.isoformat() if b.hospital_responded_at else None,
        "patient_name": b.patient_name,
        "patient_age": b.patient_age,
        "patient_gender": b.patient_gender,
        "attendant_name": b.attendant_name,
        "attendant_contact": b.attendant_contact,
        "patient_condition": b.patient_condition,
        "vitals_summary": b.vitals_summary,
        "driver_voice_transcript": b.driver_voice_transcript,
        "driver_modified_report": b.driver_modified_report,
        "driver_report_sent_at": b.driver_report_sent_at.isoformat() if b.driver_report_sent_at else None,
        "report_submitted_by": b.report_submitted_by,
        "report_submitted_at": b.report_submitted_at.isoformat() if b.report_submitted_at else None,
        "report_sent_to_hospital": b.report_sent_to_hospital,
        "report_sent_to_hospital_at": b.report_sent_to_hospital_at.isoformat() if b.report_sent_to_hospital_at else None,
        "insurance_full_name": b.insurance_full_name,
        "insurance_dob": b.insurance_dob,
        "insurance_gender": b.insurance_gender,
        "insurance_provider": b.insurance_provider,
        "insurance_policy_member_id": b.insurance_policy_member_id,
        "insurance_policy_holder_name": b.insurance_policy_holder_name,
        "insurance_government_id": b.insurance_government_id,
        "insurance_sum_insured": b.insurance_sum_insured,
        "insurance_emergency_nature": b.insurance_emergency_nature,
        "insurance_exclusions_waiting": b.insurance_exclusions_waiting,
        "insurance_status": b.insurance_status or "pending",
        "insurance_hospital_note": b.insurance_hospital_note,
        "insurance_submitted_by": b.insurance_submitted_by,
        "insurance_submitted_at": b.insurance_submitted_at.isoformat() if b.insurance_submitted_at else None,
        "insurance_reviewed_by": b.insurance_reviewed_by,
        "insurance_reviewed_at": b.insurance_reviewed_at.isoformat() if b.insurance_reviewed_at else None,
        "status":           b.status,
        "sent_to_driver":   b.sent_to_driver,
        "sent_to_driver_at": b.sent_to_driver_at.isoformat() if b.sent_to_driver_at else None,
        "driver_task_completed": b.driver_task_completed,
        "driver_task_completed_at": b.driver_task_completed_at.isoformat() if b.driver_task_completed_at else None,
        "driver_rejected_once": b.driver_rejected_once,
        "driver_rejected_at": b.driver_rejected_at.isoformat() if b.driver_rejected_at else None,
        "driver_rejection_reason": b.driver_rejection_reason,
        "reassigned_due_to_unavailability": b.reassigned_due_to_unavailability,
        "reassigned_at": b.reassigned_at.isoformat() if b.reassigned_at else None,
        "created_at":       b.created_at.strftime("%d %b %Y, %I:%M %p"),
        "is_read":          b.is_read,
        "chat_thread_id": _chat_thread_id(b),
    }


@csrf_exempt
def booking_list(request):

    if request.method == "GET":
        bookings = Booking.objects.all().order_by("-created_at")
        return JsonResponse([booking_to_dict(b) for b in bookings], safe=False)

    if request.method == "POST":
        data = json.loads(request.body or "{}")

        assigned_ambulance_id = _to_int(data.get("ambulance_id"), 0)
        assigned_ambulance_number = str(data.get("ambulance_number", "") or "").strip()
        assigned_driver = str(data.get("driver", "") or "").strip()
        assigned_driver_contact = str(data.get("driver_contact", "") or "").strip()

        b = Booking.objects.create(
            ambulance_id     = assigned_ambulance_id,
            ambulance_number = assigned_ambulance_number,
            driver           = assigned_driver,
            driver_contact   = assigned_driver_contact,
            booked_by        = data.get("booked_by", ""),
            booked_by_email  = data.get("booked_by_email", ""),
            pickup_location  = data.get("pickup_location", ""),
            pickup_latitude  = _to_float(data.get("pickup_latitude")),
            pickup_longitude = _to_float(data.get("pickup_longitude")),
            pickup_landmark  = data.get("pickup_landmark", ""),
            pickup_city      = data.get("pickup_city", ""),
            pickup_district  = data.get("pickup_district", ""),
            patient_contact_number = data.get("patient_contact_number", ""),
            destination      = "",
            status           = "pending",
        )
        _push_system_chat(
            b,
            f"Booking #{b.id} created. Pickup received at {b.pickup_location}. Admin dispatch team is reviewing now.",
            "update",
        )
        if assigned_ambulance_id <= 0:
            _push_system_chat(
                b,
                f"Booking #{b.id} is waiting for ambulance assignment from admin dispatch.",
                "update",
            )

        return JsonResponse(booking_to_dict(b), status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def booking_detail(request, id):

    try:
        b = Booking.objects.get(id=id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)

    if request.method == "GET":
        return JsonResponse(booking_to_dict(b))

    if request.method == "PATCH":
        data       = json.loads(request.body)
        new_status = data.get("status")
        send_to_driver = _to_bool(data.get("send_to_driver"))
        mark_driver_complete = _to_bool(data.get("driver_task_complete"))
        assign_hospital_id = data.get("assign_hospital_id")
        hospital_response = data.get("hospital_response")
        hospital_response_note = data.get("hospital_response_note", "")
        notify_user_hospital_ready = _to_bool(data.get("notify_user_hospital_ready"))
        patient_report = data.get("patient_report")
        send_report_to_hospital = _to_bool(data.get("send_report_to_hospital"))
        insurance_details = data.get("insurance_details")
        assign_ambulance_id = data.get("assign_ambulance_id")
        reassign_ambulance_id = data.get("reassign_ambulance_id")
        notify_user_reassigned = _to_bool(data.get("notify_user_reassigned", True))
        cancel_driver_request = _to_bool(data.get("cancel_driver_request"))

        if "is_read" in data:
            b.is_read = data["is_read"]

        if assign_hospital_id is not None:
            try:
                hosp = Hospital.objects.get(id=int(assign_hospital_id), is_active=True)
            except (Hospital.DoesNotExist, ValueError, TypeError):
                return JsonResponse({"error": "Valid hospital required"}, status=400)

            b.assigned_hospital_id = hosp.id
            b.assigned_hospital_name = hosp.name or ""
            b.assigned_hospital_address = hosp.address or ""
            b.assigned_hospital_contact = hosp.contact_number or ""
            b.assigned_hospital_email = hosp.email or ""
            b.hospital_assigned_at = timezone.now()
            b.destination = hosp.name or b.destination
            b.hospital_response = "pending"
            b.hospital_response_note = "Awaiting hospital approval based on bed/staff availability."
            b.hospital_responded_at = None

            if b.booked_by_email:
                try:
                    send_mail(
                        subject=f"🏥 Hospital Assigned — Booking #{b.id}",
                        message=f"""Namaskar {b.booked_by},

Aapki booking #{b.id} ke liye hospital assign kar diya gaya hai.

Hospital: {hosp.name}
Address: {hosp.address or '-'}
Contact: {hosp.contact_number or '-'}

Pickup: {b.pickup_location}
Ambulance: {b.ambulance_number}

— SwiftRescue Dispatch Team
""",
                        from_email="vashupanchal.cs@gmail.com",
                        recipient_list=[b.booked_by_email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print("User hospital assign email error:", e)
            _push_system_chat(
                b,
                f"Hospital assigned: {hosp.name}. Dispatch note: bed readiness workflow activated for Booking #{b.id}.",
                "update",
            )

            send_hospital_alert = _to_bool(data.get("send_hospital_alert", True))
            if send_hospital_alert and hosp.email:
                try:
                    send_mail(
                        subject=f"🚨 Emergency Alert — Incoming Patient (Booking #{b.id})",
                        message=f"""Emergency intake alert.

Patient Name: {b.booked_by}
Patient Email: {b.booked_by_email or '-'}
Patient Contact: {b.patient_contact_number or '-'}
Pickup Location: {b.pickup_location}
Landmark: {b.pickup_landmark or '-'}
City: {b.pickup_city or '-'}
District: {b.pickup_district or '-'}
Assigned Ambulance: {b.ambulance_number}
Driver: {b.driver} ({b.driver_contact or '-'})
Expected Destination: {hosp.name}

Please confirm readiness from hospital desk.

— SwiftRescue Control
""",
                        from_email="vashupanchal.cs@gmail.com",
                        recipient_list=[hosp.email],
                        fail_silently=True,
                    )
                    b.hospital_alert_sent = True
                    b.hospital_alert_sent_at = timezone.now()
                except Exception as e:
                    print("Hospital alert email error:", e)
            if b.hospital_alert_sent:
                _push_system_chat(
                    b,
                    f"Emergency alert sent to hospital desk ({hosp.name}). Waiting for readiness response.",
                    "alert",
                )

        target_ambulance_id = assign_ambulance_id if assign_ambulance_id is not None else reassign_ambulance_id
        is_reassign = reassign_ambulance_id is not None and assign_ambulance_id is None

        if target_ambulance_id is not None:
            try:
                new_amb = Ambulance.objects.get(id=int(target_ambulance_id))
            except (Ambulance.DoesNotExist, ValueError, TypeError):
                return JsonResponse({"error": "Valid ambulance required for assignment"}, status=400)

            if new_amb.status != "available":
                return JsonResponse({"error": "Selected ambulance is not available"}, status=400)

            old_amb_no = b.ambulance_number or "-"
            old_driver = b.driver or "-"

            b.ambulance_id = new_amb.id
            b.ambulance_number = new_amb.ambulance_number or b.ambulance_number
            b.driver = new_amb.driver or b.driver
            b.driver_contact = new_amb.driver_contact or b.driver_contact
            b.sent_to_driver = False
            b.sent_to_driver_at = None
            b.driver_task_completed = False
            b.driver_task_completed_at = None
            b.status = "confirmed"
            b.driver_rejected_once = False
            b.driver_rejection_reason = ""
            b.reassigned_due_to_unavailability = bool(is_reassign)
            b.reassigned_at = timezone.now() if is_reassign else None
            b.is_read = False

            if is_reassign and notify_user_reassigned and b.booked_by_email:
                try:
                    send_mail(
                        subject=f"🚑 Ambulance Reassigned — Booking #{b.id}",
                        message=f"""Namaskar {b.booked_by},

Driver unavailability ki wajah se aapki booking ke liye dusri ambulance assign ki gayi hai.

Booking ID: #{b.id}
Previous Ambulance: {old_amb_no} ({old_driver})
New Ambulance: {b.ambulance_number} ({b.driver})
Contact: {b.driver_contact or '-'}
Pickup: {b.pickup_location}
Hospital: {b.assigned_hospital_name or b.destination or '-'}

Hum aapki service bina delay continue kar rahe hain.

— SwiftRescue Dispatch Team
""",
                        from_email="vashupanchal.cs@gmail.com",
                        recipient_list=[b.booked_by_email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print("User reassignment email error:", e)
            if is_reassign:
                _push_system_chat(
                    b,
                    f"Ambulance reassigned due to previous unit unavailability. New unit: {b.ambulance_number} ({b.driver}).",
                    "update",
                )
            else:
                if b.booked_by_email:
                    try:
                        send_mail(
                            subject=f"🚑 Ambulance Assigned — Booking #{b.id}",
                            message=f"""Namaskar {b.booked_by},

Booking #{b.id} ke liye ambulance assign ho gayi hai.

Ambulance: {b.ambulance_number}
Driver: {b.driver}
Contact: {b.driver_contact or '-'}
Pickup: {b.pickup_location}
Hospital: {b.assigned_hospital_name or b.destination or 'Admin will assign'}

— SwiftRescue Dispatch Team
""",
                            from_email="vashupanchal.cs@gmail.com",
                            recipient_list=[b.booked_by_email],
                            fail_silently=True,
                        )
                    except Exception as e:
                        print("User ambulance assign email error:", e)
                _push_system_chat(
                    b,
                    f"Ambulance assigned by admin: {b.ambulance_number} ({b.driver}).",
                    "update",
                )

        # Hospital response is handled only by dedicated endpoint:
        # POST /api/bookings/<id>/hospital-response/
        # This prevents accidental auto-update from generic admin PATCH payloads.

        if notify_user_hospital_ready:
            if b.hospital_response != "ready":
                return JsonResponse({"error": "Hospital response is not ready"}, status=400)
            if not b.booked_by_email:
                return JsonResponse({"error": "User email missing"}, status=400)
            try:
                send_mail(
                    subject=f"✅ Hospital Ready — Booking #{b.id}",
                    message=f"""Namaskar {b.booked_by},

Hospital ne confirm kiya hai ki team ready hai.

Hospital: {b.assigned_hospital_name or b.destination or '-'}
Address: {b.assigned_hospital_address or '-'}
Contact: {b.assigned_hospital_contact or '-'}

Ambulance aapko pickup karke hospital le ja rahi hai.

— SwiftRescue Dispatch Team
""",
                    from_email="vashupanchal.cs@gmail.com",
                    recipient_list=[b.booked_by_email],
                    fail_silently=True,
                )
            except Exception as e:
                print("Notify user ready email error:", e)

        if isinstance(patient_report, dict):
            b.patient_name = str(patient_report.get("patient_name", "")).strip()
            b.patient_age = str(patient_report.get("patient_age", "")).strip()
            b.patient_gender = str(patient_report.get("patient_gender", "")).strip()
            b.attendant_name = str(patient_report.get("attendant_name", "")).strip()
            b.attendant_contact = str(patient_report.get("attendant_contact", "")).strip()
            b.patient_condition = str(patient_report.get("patient_condition", "")).strip()
            b.vitals_summary = str(patient_report.get("vitals_summary", "")).strip()
            b.report_submitted_by = str(patient_report.get("submitted_by", "")).strip() or b.driver or "Driver Team"
            b.report_submitted_at = timezone.now()

            try:
                send_mail(
                    subject=f"📝 Patient Condition Report — Booking #{b.id}",
                    message=f"""Patient report submitted by driver.

Booking ID: #{b.id}
Patient: {b.patient_name or b.booked_by}
Age: {b.patient_age or '-'}
Gender: {b.patient_gender or '-'}
Attendant: {b.attendant_name or '-'} ({b.attendant_contact or '-'})
Condition: {b.patient_condition or '-'}
Vitals: {b.vitals_summary or '-'}

Pickup: {b.pickup_location}
Hospital: {b.assigned_hospital_name or b.destination or '-'}
""",
                    from_email="vashupanchal.cs@gmail.com",
                    recipient_list=["vashupanchal.cs@gmail.com"],
                    fail_silently=True,
                )
            except Exception as e:
                print("Admin patient report email error:", e)
            _push_system_chat(
                b,
                f"Driver submitted patient condition form for Booking #{b.id}. Admin review pending.",
                "update",
            )

            # Hospital report is now sent manually by admin action:
            # PATCH { send_report_to_hospital: true }

        if send_report_to_hospital:
            if not b.assigned_hospital_email:
                return JsonResponse({"error": "Assigned hospital email missing"}, status=400)
            if not b.report_submitted_at:
                return JsonResponse({"error": "Patient report not submitted yet"}, status=400)
            try:
                send_mail(
                    subject=f"🧾 Patient Clinical Report — Booking #{b.id}",
                    message=f"""Incoming patient report.

Booking ID: #{b.id}
Patient: {b.patient_name or b.booked_by}
Age: {b.patient_age or '-'}
Gender: {b.patient_gender or '-'}
Attendant: {b.attendant_name or '-'} ({b.attendant_contact or '-'})
Condition: {b.patient_condition or '-'}
Vitals: {b.vitals_summary or '-'}

Pickup: {b.pickup_location}
Ambulance: {b.ambulance_number}
Driver: {b.driver} ({b.driver_contact or '-'})
""",
                    from_email="vashupanchal.cs@gmail.com",
                    recipient_list=[b.assigned_hospital_email],
                    fail_silently=True,
                )
                b.report_sent_to_hospital = True
                b.report_sent_to_hospital_at = timezone.now()
            except Exception as e:
                print("Hospital report email error:", e)
            if b.report_sent_to_hospital:
                _push_system_chat(
                    b,
                    "Patient clinical report forwarded to hospital intake desk.",
                    "update",
                )

        if isinstance(insurance_details, dict):
            def _pick_text(keys, fallback=""):
                for key in keys:
                    val = insurance_details.get(key, "")
                    if val is None:
                        continue
                    txt = str(val).strip()
                    if txt:
                        return txt
                return fallback

            b.insurance_full_name = _pick_text(["full_name", "patient_name", "fullName"], b.insurance_full_name)
            b.insurance_dob = _pick_text(["date_of_birth", "dob", "dateOfBirth"], b.insurance_dob)
            b.insurance_gender = _pick_text(["gender"], b.insurance_gender)
            b.insurance_provider = _pick_text(["insurance_provider", "provider", "insuranceProvider"], b.insurance_provider)
            b.insurance_policy_member_id = _pick_text(["policy_member_id", "member_id", "policyMemberId"], b.insurance_policy_member_id)
            b.insurance_policy_holder_name = _pick_text(["policy_holder_name", "holder_name", "policyHolderName"], b.insurance_policy_holder_name)
            b.insurance_government_id = _pick_text(["government_id", "govt_id", "governmentId"], b.insurance_government_id)
            b.insurance_sum_insured = _pick_text(["sum_insured", "sumInsured"], b.insurance_sum_insured)
            b.insurance_emergency_nature = _pick_text(["emergency_nature", "emergencyNature"], b.insurance_emergency_nature)
            b.insurance_exclusions_waiting = _pick_text(
                ["exclusions_waiting_period", "exclusions_waiting", "waiting_period", "exclusionsWaitingPeriod"],
                b.insurance_exclusions_waiting,
            )
            b.insurance_submitted_by = _pick_text(["submitted_by", "submittedBy"], b.insurance_submitted_by) or b.driver or "Ambulance Team"
            b.insurance_submitted_at = timezone.now()
            b.insurance_status = "pending"
            b.insurance_reviewed_by = ""
            b.insurance_reviewed_at = None
            b.insurance_hospital_note = "Awaiting hospital insurance approval."
            _push_system_chat(
                b,
                f"Medical insurance form submitted by ambulance team for Booking #{b.id}. Hospital verification pending.",
                "update",
            )

        if new_status:
            valid = {"pending", "confirmed", "completed", "cancelled"}
            if new_status not in valid:
                return JsonResponse({"error": f"Invalid status. Use: {valid}"}, status=400)
            b.status = new_status

            if new_status in ("pending", "cancelled"):
                b.sent_to_driver = False
                b.sent_to_driver_at = None
            if new_status == "completed":
                b.driver_task_completed = True
                b.driver_task_completed_at = timezone.now()

        if send_to_driver:
            if b.status != "confirmed":
                return JsonResponse({"error": "Booking must be confirmed before sending to driver"}, status=400)
            if not b.assigned_hospital_name:
                return JsonResponse({"error": "Assign hospital before sending booking to driver"}, status=400)
            if b.hospital_response != "ready":
                return JsonResponse({"error": "Hospital must be ready before sending booking to driver"}, status=400)
            if not b.sent_to_driver:
                b.sent_to_driver = True
                b.sent_to_driver_at = timezone.now()
                b.driver_rejection_reason = ""
                b.reassigned_due_to_unavailability = False

                try:
                    SuggestedRoute.objects.create(
                        ambulance_id=b.ambulance_id,
                        booking_id=b.id,
                        pickup_location=b.pickup_location or "",
                        destination=b.destination or "",
                        status="pending",
                    )
                except Exception as e:
                    print("Route create error:", e)

                try:
                    amb = Ambulance.objects.get(id=b.ambulance_id)
                    driver_email = amb.driver_email or ""
                    amb.status = "en_route"
                    amb.save()
                except Ambulance.DoesNotExist:
                    driver_email = ""

                if driver_email:
                    try:
                        send_mail(
                            subject=f"🚑 Dispatch Assigned — Booking #{b.id}",
                            message=f"""Namaskar {b.driver},

Admin ne aapko booking dispatch kar di hai.

━━━━━━━━━━━━━━━━━━━━━━
📋 Booking ID    : #{b.id}
👤 Patient       : {b.booked_by}
📧 Patient Email : {b.booked_by_email or 'N/A'}
📱 Contact       : {b.patient_contact_number or 'N/A'}
📍 Pickup        : {b.pickup_location}
🏙 City/District : {(b.pickup_city or '-')} / {(b.pickup_district or '-')}
🏥 Hospital      : {b.destination or 'Nearest available'}
🚑 Ambulance     : {b.ambulance_number}
━━━━━━━━━━━━━━━━━━━━━━

Driver dashboard me live route open karke mission start karein.

— SwiftRescue Dispatch Team
""",
                            from_email="vashupanchal.cs@gmail.com",
                            recipient_list=[driver_email],
                            fail_silently=True,
                        )
                    except Exception as e:
                        print("Dispatch email error:", e)
                _push_system_chat(
                    b,
                    f"Booking dispatched to driver {b.driver}. Live route and traffic updates are now active.",
                    "update",
                )

        if cancel_driver_request:
            if b.status != "confirmed":
                return JsonResponse({"error": "Only confirmed booking can be cancelled by driver"}, status=400)
            if b.sent_to_driver:
                b.sent_to_driver = False
                b.sent_to_driver_at = None
            b.driver_rejected_once = True
            b.driver_rejected_at = timezone.now()
            b.driver_rejection_reason = "Driver cancelled request"
            b.is_read = False

            try:
                SuggestedRoute.objects.filter(
                    ambulance_id=b.ambulance_id,
                    booking_id=b.id,
                    status__in=["pending", "accepted"],
                ).update(status="rejected")
            except Exception:
                pass

            try:
                amb = Ambulance.objects.get(id=b.ambulance_id)
                amb.status = "available"
                amb.save(update_fields=["status"])
            except Ambulance.DoesNotExist:
                pass
            _push_system_chat(
                b,
                f"Driver could not continue Booking #{b.id}. Admin reassignment required.",
                "request",
            )

        if mark_driver_complete:
            b.driver_task_completed = True
            b.driver_task_completed_at = timezone.now()
            b.status = "completed"

            try:
                amb = Ambulance.objects.get(id=b.ambulance_id)
                amb.status = "available"
                amb.save()
            except Ambulance.DoesNotExist:
                pass
            _push_system_chat(
                b,
                f"Driver marked Booking #{b.id} as completed. Patient handover done.",
                "update",
            )

        if b.status in ("completed", "cancelled"):
            try:
                amb = Ambulance.objects.get(id=b.ambulance_id)
                amb.status = "available"
                amb.save()
            except Ambulance.DoesNotExist:
                pass

        b.save()

        return JsonResponse(booking_to_dict(b))

    if request.method == "DELETE":
        b.delete()
        return JsonResponse({"status": "deleted"})

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def unread_count(request):
    count = Booking.objects.filter(is_read=False).count()
    return JsonResponse({"unread": count})


@csrf_exempt
def mark_all_read(request):
    if request.method == "POST":
        Booking.objects.filter(is_read=False).update(is_read=True)
        return JsonResponse({"status": "ok"})
    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def booking_hospital_response(request, id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    response = payload.get("hospital_response")
    note = payload.get("hospital_response_note", "")
    if response not in {"ready", "not_ready"}:
        return JsonResponse({"error": "hospital_response must be 'ready' or 'not_ready'"}, status=400)

    try:
        b = Booking.objects.get(id=id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)
    _ensure_chat_thread(b)

    b.hospital_response = response
    b.hospital_response_note = note
    b.hospital_responded_at = timezone.now()
    b.save(update_fields=["hospital_response", "hospital_response_note", "hospital_responded_at"])
    return JsonResponse(booking_to_dict(b))


@csrf_exempt
def booking_insurance_review(request, id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    review_status = str(payload.get("insurance_status", "")).strip().lower()
    review_note = str(payload.get("insurance_hospital_note", "")).strip()
    reviewed_by = str(payload.get("reviewed_by", "")).strip() or "Hospital Desk"
    if review_status not in {"approved", "rejected"}:
        return JsonResponse({"error": "insurance_status must be 'approved' or 'rejected'"}, status=400)

    try:
        b = Booking.objects.get(id=id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)

    has_insurance_payload = any(
        [
            str(b.insurance_full_name or "").strip(),
            str(b.insurance_provider or "").strip(),
            str(b.insurance_policy_member_id or "").strip(),
            str(b.insurance_policy_holder_name or "").strip(),
            str(b.insurance_government_id or "").strip(),
            str(b.insurance_sum_insured or "").strip(),
            str(b.insurance_emergency_nature or "").strip(),
            str(b.insurance_exclusions_waiting or "").strip(),
        ]
    )
    if not b.insurance_submitted_at and not has_insurance_payload:
        return JsonResponse({"error": "Insurance form not submitted yet"}, status=400)

    b.insurance_status = review_status
    b.insurance_hospital_note = review_note or (
        "Insurance approved by hospital."
        if review_status == "approved"
        else "Insurance rejected by hospital."
    )
    b.insurance_reviewed_by = reviewed_by
    b.insurance_reviewed_at = timezone.now()
    b.save(
        update_fields=[
            "insurance_status",
            "insurance_hospital_note",
            "insurance_reviewed_by",
            "insurance_reviewed_at",
        ]
    )
    _push_system_chat(
        b,
        (
            f"Insurance approved for Booking #{b.id}. Cashless verification completed."
            if review_status == "approved"
            else f"Insurance rejected for Booking #{b.id}. Alternate payment review required."
        ),
        "update",
    )
    return JsonResponse(booking_to_dict(b))


@csrf_exempt
def booking_driver_voice_refine(request, id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    try:
        Booking.objects.get(id=id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        payload = {}

    transcript = str(payload.get("transcript", "")).strip()
    if not transcript:
        return JsonResponse({"error": "Transcript required"}, status=400)
    refined = _ai_refine_transcript(transcript)
    return JsonResponse(refined)


@csrf_exempt
def booking_driver_voice_report(request, id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        b = Booking.objects.get(id=id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Not found"}, status=404)

    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        payload = {}

    transcript = str(payload.get("transcript", "")).strip()
    ai_modified_report = str(payload.get("ai_modified_report", "")).strip()
    driver_name = str(payload.get("driver_name", "")).strip() or b.driver or "Driver Team"
    auto_send_to_hospital = _to_bool(payload.get("send_to_hospital", True))
    manual_condition = str(payload.get("patient_condition", "")).strip()
    manual_vitals = str(payload.get("vitals_summary", "")).strip()

    if not transcript and not ai_modified_report and not manual_condition and not manual_vitals:
        return JsonResponse({"error": "Transcript or report text is required"}, status=400)

    refined = _ai_refine_transcript(transcript)
    b.patient_condition = manual_condition or refined.get("patient_condition", "")
    b.vitals_summary = manual_vitals or refined.get("vitals_summary", "")

    b.driver_voice_transcript = transcript
    b.report_submitted_by = driver_name
    b.report_submitted_at = timezone.now()
    b.driver_modified_report = ai_modified_report or _build_modified_driver_report(b, refined.get("refined_report", transcript))

    if auto_send_to_hospital:
        b.report_sent_to_hospital = True
        b.report_sent_to_hospital_at = timezone.now()
        b.driver_report_sent_at = timezone.now()
        if b.assigned_hospital_email:
            try:
                send_mail(
                    subject=f"🧾 Driver Voice Report — Booking #{b.id}",
                    message=b.driver_modified_report,
                    from_email="vashupanchal.cs@gmail.com",
                    recipient_list=[b.assigned_hospital_email],
                    fail_silently=True,
                )
            except Exception as exc:
                print("Driver voice report hospital email error:", exc)

    b.save(
        update_fields=[
            "patient_condition",
            "vitals_summary",
            "driver_voice_transcript",
            "driver_modified_report",
            "report_submitted_by",
            "report_submitted_at",
            "report_sent_to_hospital",
            "report_sent_to_hospital_at",
            "driver_report_sent_at",
        ]
    )

    _push_system_chat(
        b,
        f"Driver voice report submitted for Booking #{b.id}. Hospital handover report synchronized.",
        "update",
    )
    return JsonResponse(booking_to_dict(b))


@csrf_exempt
def chat_threads(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    role = (request.GET.get("role") or "").strip().lower()
    email = (request.GET.get("email") or "").strip().lower()
    name = (request.GET.get("name") or "").strip().lower()

    if role == "admin":
        for b in Booking.objects.all():
            _ensure_chat_thread(b)
    elif role == "user" and email:
        for b in Booking.objects.filter(booked_by_email__iexact=email):
            _ensure_chat_thread(b)
    elif role == "driver" and (email or name):
        if email:
            for b in Booking.objects.filter(driver__isnull=False):
                # best effort sync; driver_email may not be stored on booking
                _ensure_chat_thread(b)
        else:
            for b in Booking.objects.filter(driver__iexact=name):
                _ensure_chat_thread(b)

    qs = BookingChatThread.objects.select_related("booking").all().order_by("-updated_at")
    if role == "user":
        qs = qs.filter(user_email__iexact=email) if email else qs.none()
    elif role == "driver":
        if email:
            qs = qs.filter(driver_email__iexact=email)
        elif name:
            qs = qs.filter(driver_name__iexact=name)
        else:
            qs = qs.none()
    elif role == "admin":
        pass
    else:
        return JsonResponse({"error": "role must be admin/user/driver"}, status=400)

    payload = []
    for t in qs:
        booking = t.booking
        all_msgs = list(t.messages.all())
        unread_admin = sum(
            1
            for m in all_msgs
            if _is_visible_to_role(m, "admin") and m.sender_role != "admin" and not m.seen_by_admin
        )
        unread_driver = sum(
            1
            for m in all_msgs
            if _is_visible_to_role(m, "driver") and m.sender_role != "driver" and not m.seen_by_driver
        )
        unread_user = sum(
            1
            for m in all_msgs
            if _is_visible_to_role(m, "user") and m.sender_role != "user" and not m.seen_by_user
        )
        row = _thread_to_dict(t)
        row["booking"] = booking_to_dict(booking)
        row["unread"] = {"admin": unread_admin, "driver": unread_driver, "user": unread_user}
        payload.append(row)
    return JsonResponse(payload, safe=False)


@csrf_exempt
def booking_chat_thread(request, booking_id):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Booking not found"}, status=404)
    thread = _ensure_chat_thread(booking)
    return JsonResponse(_thread_to_dict(thread))


@csrf_exempt
def chat_messages(request, thread_id):
    try:
        thread = BookingChatThread.objects.select_related("booking").get(id=thread_id)
    except BookingChatThread.DoesNotExist:
        return JsonResponse({"error": "Thread not found"}, status=404)

    if request.method == "GET":
        viewer_role = str(request.GET.get("role", "")).strip().lower()
        if viewer_role in {"admin", "driver", "user"}:
            msgs = [_message_to_dict(m) for m in thread.messages.all() if _is_visible_to_role(m, viewer_role)]
        else:
            msgs = [_message_to_dict(m) for m in thread.messages.all()]
        return JsonResponse({"thread": _thread_to_dict(thread, include_last_message=False), "messages": msgs})

    if request.method == "POST":
        try:
            data = json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        sender_role = str(data.get("sender_role", "")).strip().lower()
        if sender_role not in {"admin", "driver", "user"}:
            return JsonResponse({"error": "sender_role must be admin/driver/user"}, status=400)
        sender_name = str(data.get("sender_name", "")).strip() or sender_role.title()
        message = str(data.get("message", "")).strip()
        message_type = str(data.get("message_type", "text")).strip().lower()
        metadata = data.get("metadata", "")
        target_role = str(data.get("target_role", "all")).strip().lower()
        if message_type not in {"text", "update", "request", "alert"}:
            message_type = "text"
        if target_role not in {"all", "admin", "driver", "user"}:
            target_role = "all"
        if not message:
            return JsonResponse({"error": "message required"}, status=400)
        metadata_obj = _safe_json_load(metadata) if isinstance(metadata, (str, dict)) else {}
        metadata_obj["target_role"] = target_role

        msg = BookingChatMessage.objects.create(
            thread=thread,
            sender_role=sender_role,
            sender_name=sender_name,
            message_type=message_type,
            message=message,
            metadata=json.dumps(metadata_obj),
        )
        thread.last_message_at = timezone.now()
        thread.save(update_fields=["last_message_at", "updated_at"])
        return JsonResponse(_message_to_dict(msg), status=201)

    if request.method == "DELETE":
        # Full thread chat clear
        thread.messages.all().delete()
        thread.last_message_at = None
        thread.save(update_fields=["last_message_at", "updated_at"])
        return JsonResponse({"status": "cleared"})

    return JsonResponse({"error": "Method not allowed"}, status=405)


@csrf_exempt
def chat_presence(request, thread_id):
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH only"}, status=405)
    try:
        thread = BookingChatThread.objects.get(id=thread_id)
    except BookingChatThread.DoesNotExist:
        return JsonResponse({"error": "Thread not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    role = str(data.get("role", "")).strip().lower()
    if role not in {"admin", "driver", "user"}:
        return JsonResponse({"error": "role must be admin/driver/user"}, status=400)

    online = _to_bool(data.get("online")) if "online" in data else None
    typing = _to_bool(data.get("typing")) if "typing" in data else None
    now = timezone.now()
    updates = ["updated_at"]

    if role == "admin":
        if online is not None:
            thread.admin_online = online
            thread.admin_last_seen_at = now
            updates += ["admin_online", "admin_last_seen_at"]
        if typing is not None:
            thread.admin_typing = typing
            updates.append("admin_typing")
    elif role == "driver":
        if online is not None:
            thread.driver_online = online
            thread.driver_last_seen_at = now
            updates += ["driver_online", "driver_last_seen_at"]
        if typing is not None:
            thread.driver_typing = typing
            updates.append("driver_typing")
    elif role == "user":
        if online is not None:
            thread.user_online = online
            thread.user_last_seen_at = now
            updates += ["user_online", "user_last_seen_at"]
        if typing is not None:
            thread.user_typing = typing
            updates.append("user_typing")

    thread.save(update_fields=list(dict.fromkeys(updates)))
    return JsonResponse(_thread_to_dict(thread))


@csrf_exempt
def chat_mark_read(request, thread_id):
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH only"}, status=405)
    try:
        thread = BookingChatThread.objects.get(id=thread_id)
    except BookingChatThread.DoesNotExist:
        return JsonResponse({"error": "Thread not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    role = str(data.get("role", "")).strip().lower()
    msgs = [m for m in thread.messages.all() if _is_visible_to_role(m, role) and m.sender_role != role]
    if role == "admin":
        ids = [m.id for m in msgs if not m.seen_by_admin]
        if ids:
            thread.messages.filter(id__in=ids).update(seen_by_admin=True)
    elif role == "driver":
        ids = [m.id for m in msgs if not m.seen_by_driver]
        if ids:
            thread.messages.filter(id__in=ids).update(seen_by_driver=True)
    elif role == "user":
        ids = [m.id for m in msgs if not m.seen_by_user]
        if ids:
            thread.messages.filter(id__in=ids).update(seen_by_user=True)
    else:
        return JsonResponse({"error": "role must be admin/driver/user"}, status=400)
    return JsonResponse({"status": "ok"})


@csrf_exempt
def chat_driver_request(request, thread_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    try:
        thread = BookingChatThread.objects.select_related("booking").get(id=thread_id)
    except BookingChatThread.DoesNotExist:
        return JsonResponse({"error": "Thread not found"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    issue_type = str(data.get("issue_type", "route_issue")).strip().lower()
    msg = str(data.get("message", "")).strip()
    if not msg:
        return JsonResponse({"error": "message required"}, status=400)

    chat = BookingChatMessage.objects.create(
        thread=thread,
        sender_role="driver",
        sender_name=data.get("sender_name") or thread.driver_name or "Driver",
        message_type="request",
        message=f"[{issue_type}] {msg}",
        metadata=json.dumps({"issue_type": issue_type, "target_role": "admin"}),
    )
    thread.last_message_at = timezone.now()
    thread.save(update_fields=["last_message_at", "updated_at"])
    _push_system_chat(
        thread.booking,
        f"Driver escalation received ({issue_type}). Admin control team will manage immediately.",
        "alert",
        target_role="admin",
    )
    return JsonResponse(_message_to_dict(chat), status=201)
