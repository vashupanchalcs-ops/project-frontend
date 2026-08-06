import json
from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.utils import timezone
from bookings.models import BookingChatThread, BookingChatMessage
from bookings.ai_engine import generate_ai_response
from bookings.communication import (
    create_booking_from_text,
    extract_voice_text,
    place_voice_callback,
    send_sms_confirmation,
)


def _serialize_message(m):
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
        "created_at": m.created_at.isoformat(),
    }


@shared_task
def generate_ai_reply_task(thread_id, prompt, role):
    thread = BookingChatThread.objects.filter(id=thread_id).first()
    if not thread:
        return {"ok": False, "error": "thread_not_found"}
    text = generate_ai_response(prompt or "", role or "user")
    msg = BookingChatMessage.objects.create(
        thread=thread,
        sender_role="system",
        sender_name="SwiftRescue AI",
        message_type="update",
        message=text,
        metadata=json.dumps({"source": "celery_ai_task"}),
    )
    thread.last_message_at = timezone.now()
    thread.save(update_fields=["last_message_at", "updated_at"])

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"booking_chat_{thread_id}",
            {"type": "chat.message", "message": _serialize_message(msg)},
        )
    return {"ok": True, "message_id": msg.id}


@shared_task
def process_voice_booking_task(payload):
    payload = payload or {}
    from_number = str(payload.get("from_number", "")).strip()
    transcript = extract_voice_text(payload)
    if not transcript:
        return {"ok": False, "error": "speech_not_detected"}

    try:
        booking = create_booking_from_text("voice", from_number, transcript)
    except Exception as exc:
        place_voice_callback(from_number, "Maaf kijiye, location samajh nahi aayi. Kripya dubara call karein.")
        send_sms_confirmation(from_number, "SwiftRescue: Location samajh nahi aayi. Kripya fir se call/SMS karein.")
        return {"ok": False, "error": str(exc)}

    confirmation = (
        f"Booking {booking.id} registered. Ambulance {booking.ambulance_number} assigned at {booking.pickup_location}."
    )
    send_sms_confirmation(from_number, f"SwiftRescue: {confirmation}")
    place_voice_callback(
        from_number,
        f"Aapki booking {booking.id} confirm ho gayi hai. Ambulance jaldi pahunch rahi hai.",
    )
    return {"ok": True, "booking_id": booking.id}


@shared_task
def process_sms_booking_task(payload):
    payload = payload or {}
    from_number = str(payload.get("from_number", "")).strip()
    body = str(payload.get("body", "")).strip()
    if not body:
        return {"ok": False, "error": "empty_sms_body"}

    try:
        booking = create_booking_from_text("sms", from_number, body)
    except Exception as exc:
        send_sms_confirmation(
            from_number,
            "SwiftRescue: SMS parse nahi ho paya. Format bhejein: AMBULANCE Loni Delhi",
        )
        return {"ok": False, "error": str(exc)}

    send_sms_confirmation(
        from_number,
        f"SwiftRescue: Booking #{booking.id} created. Ambulance {booking.ambulance_number} assigned for {booking.pickup_location}.",
    )
    return {"ok": True, "booking_id": booking.id}
