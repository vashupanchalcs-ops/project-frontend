from django.urls import path
from . import views
from . import voice_sms_views

urlpatterns = [
    path("voice/hotline/", voice_sms_views.voice_hotline_info),
    path("voice/direct-booking/", voice_sms_views.voice_direct_booking),
    path("voice/exotel-webhook/", voice_sms_views.exotel_voice_booking_webhook),
    path("voice/ivr/", voice_sms_views.voice_ivr_entry),
    path("voice/incoming/", voice_sms_views.voice_ivr_entry),
    path("voice/step/", voice_sms_views.voice_ivr_step),
    path("voice/status-callback/", voice_sms_views.voice_call_status_callback),
    path("voice/call-alert/", voice_sms_views.voice_call_alert),
    path("voice/webhook/", voice_sms_views.voice_booking_webhook),
    path("sms/webhook/", voice_sms_views.sms_booking_webhook),
    path("",             views.booking_list),
    path("unread/",      views.unread_count),
    path("mark-read/",   views.mark_all_read),
    path("chat/threads/", views.chat_threads),
    path("<int:booking_id>/chat/thread/", views.booking_chat_thread),
    path("chat/threads/<int:thread_id>/messages/", views.chat_messages),
    path("chat/threads/<int:thread_id>/presence/", views.chat_presence),
    path("chat/threads/<int:thread_id>/read/", views.chat_mark_read),
    path("chat/threads/<int:thread_id>/driver-request/", views.chat_driver_request),
    path("<int:id>/hospital-response/", views.booking_hospital_response),
    path("<int:id>/insurance-review/", views.booking_insurance_review),
    path("<int:id>/driver-voice-refine/", views.booking_driver_voice_refine),
    path("<int:id>/driver-voice-report/", views.booking_driver_voice_report),
    path("<int:id>/",    views.booking_detail),
]
