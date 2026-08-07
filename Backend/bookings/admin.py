from django.contrib import admin
from .models import Booking, BookingChatThread, BookingChatMessage, VoiceBookingCall


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display  = ["id", "patient_name", "ambulance_number", "assigned_hospital_name", "hospital_response", "status", "created_at", "is_read"]
    list_filter   = ["status", "hospital_response", "insurance_status", "report_sent_to_hospital", "is_read"]
    search_fields = ["ambulance_number", "booked_by", "patient_name", "patient_contact_number", "pickup_location", "assigned_hospital_name"]
    ordering      = ["-created_at"]
    readonly_fields = [
        "created_at", "hospital_assigned_at", "hospital_alert_sent_at", "hospital_responded_at",
        "driver_report_sent_at", "report_submitted_at", "report_sent_to_hospital_at", "insurance_submitted_at",
        "insurance_reviewed_at", "sent_to_driver_at", "driver_task_completed_at", "driver_rejected_at", "reassigned_at",
    ]
    fieldsets = (
        ("Dispatch", {"fields": ("ambulance_id", "ambulance_number", "driver", "driver_contact", "status", "is_read", "created_at")} ),
        ("Patient & Pickup", {"fields": ("booked_by", "booked_by_email", "patient_name", "patient_age", "patient_gender", "patient_contact_number", "attendant_name", "attendant_contact", "pickup_location", "pickup_landmark", "pickup_city", "pickup_district", "pickup_latitude", "pickup_longitude", "destination")} ),
        ("Hospital Assignment", {"fields": ("assigned_hospital_id", "assigned_hospital_name", "assigned_hospital_address", "assigned_hospital_contact", "assigned_hospital_email", "hospital_assigned_at", "hospital_alert_sent", "hospital_alert_sent_at", "hospital_response", "hospital_response_note", "hospital_responded_at")} ),
        ("Clinical Handover", {"fields": ("patient_condition", "vitals_summary", "driver_voice_transcript", "driver_modified_report", "report_submitted_by", "report_submitted_at", "report_sent_to_hospital", "report_sent_to_hospital_at", "driver_report_sent_at")} ),
        ("Insurance", {"fields": ("insurance_full_name", "insurance_dob", "insurance_gender", "insurance_provider", "insurance_policy_member_id", "insurance_policy_holder_name", "insurance_government_id", "insurance_sum_insured", "insurance_emergency_nature", "insurance_exclusions_waiting", "insurance_status", "insurance_hospital_note", "insurance_submitted_by", "insurance_submitted_at", "insurance_reviewed_by", "insurance_reviewed_at")} ),
        ("Driver Workflow", {"fields": ("sent_to_driver", "sent_to_driver_at", "driver_task_completed", "driver_task_completed_at", "driver_rejected_once", "driver_rejected_at", "driver_rejection_reason", "reassigned_due_to_unavailability", "reassigned_at")} ),
    )


@admin.register(BookingChatThread)
class BookingChatThreadAdmin(admin.ModelAdmin):
    list_display = [
        "id", "booking", "user_name", "driver_name", "is_active",
        "user_online", "driver_online", "admin_online", "last_message_at", "updated_at",
    ]
    search_fields = ["booking__id", "user_name", "user_email", "driver_name", "driver_email"]
    list_filter = ["is_active", "user_online", "driver_online", "admin_online"]
    ordering = ["-updated_at"]


@admin.register(BookingChatMessage)
class BookingChatMessageAdmin(admin.ModelAdmin):
    list_display = ["id", "thread", "sender_role", "message_type", "created_at"]
    search_fields = ["thread__booking__id", "sender_name", "message"]
    list_filter = ["sender_role", "message_type", "seen_by_admin", "seen_by_driver", "seen_by_user"]
    ordering = ["-created_at"]


@admin.register(VoiceBookingCall)
class VoiceBookingCallAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "call_sid",
        "from_number",
        "call_status",
        "current_step",
        "caller_name",
        "city",
        "district",
        "is_confirmed",
        "booking",
        "updated_at",
    ]
    search_fields = ["call_sid", "from_number", "caller_name", "city", "district", "landmark"]
    list_filter = ["call_status", "current_step", "is_confirmed"]
    ordering = ["-updated_at"]
