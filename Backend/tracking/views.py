"""
tracking/views.py
-----------------
REST endpoints consumed by Flutter Web on initial load.
"""
import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import TrackingSession, RouteVersion
from .consumers import _route_to_dict
from .service import trigger_reroute

logger = logging.getLogger("tracking.views")


def _auth_token(request) -> str:
    """Extract token from Authorization header or query param."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return request.GET.get("token", "").strip()


def _resolve_email_from_token(token: str, request=None) -> str:
    from django.conf import settings
    from django.core.cache import cache
    email = (
        cache.get(f"otp_verified:{token}")
        or cache.get(f"session:{token}")
        or cache.get(token)
        or ""
    )
    if not email and settings.DEBUG:
        if request:
            param_email = request.GET.get("email", "").strip()
            if param_email and "@" in param_email:
                return param_email
        if token and "@" in token:
            return token
    return email


def _check_booking_access(booking, email: str) -> bool:
    """Return True if email is authorised to view this booking's tracking data."""
    from django.conf import settings
    from ambulance.models import Ambulance
    from django.contrib.auth.models import User
    from hospitals.models import Hospital

    if not email:
        return bool(settings.DEBUG)
    if booking.booked_by_email and email.lower() == booking.booked_by_email.lower():
        return True
    try:
        amb = Ambulance.objects.get(id=booking.ambulance_id)
        if amb.driver_email and email.lower() == amb.driver_email.lower():
            return True
    except Ambulance.DoesNotExist:
        pass
    if User.objects.filter(email__iexact=email, is_staff=True).exists():
        return True
    hosp = Hospital.objects.filter(email__iexact=email, is_active=True).first()
    if hosp and booking.assigned_hospital_id == hosp.id:
        return True
    return bool(settings.DEBUG)


@csrf_exempt
def tracking_session_detail(request, booking_id: int):
    """
    GET /api/tracking/{booking_id}/
    Flutter calls this on load to get the full current tracking snapshot.
    Requires ?token=<otp_session_token> or Authorization: Bearer <token>.
    """
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)

    token = _auth_token(request)
    email = _resolve_email_from_token(token, request=request)

    from bookings.models import Booking
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Booking not found"}, status=404)

    if not _check_booking_access(booking, email):
        return JsonResponse({"error": "Unauthorized"}, status=403)

    try:
        session = TrackingSession.objects.get(booking_id=booking_id, is_active=True)
    except TrackingSession.DoesNotExist:
        return JsonResponse({"error": "No active tracking session"}, status=404)

    from ambulance.models import Ambulance
    try:
        amb = Ambulance.objects.get(id=session.ambulance_id)
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "Ambulance not found"}, status=404)

    route = (
        RouteVersion.objects.filter(
            booking_id=booking_id,
            phase=session.current_phase,
            is_active=True,
        )
        .order_by("-version")
        .first()
    )

    return JsonResponse({
        "booking_id":    booking_id,
        "phase":         session.current_phase,
        "ambulance": {
            "id":      amb.id,
            "number":  amb.ambulance_number,
            "driver":  amb.driver,
            "contact": amb.driver_contact or "",
            "lat":     amb.latitude,
            "lng":     amb.longitude,
        },
        "patient":  {"lat": session.patient_lat,  "lng": session.patient_lng},
        "hospital": {"lat": session.hospital_lat, "lng": session.hospital_lng},
        "route":    _route_to_dict(route),
    })


@csrf_exempt
def reroute(request, booking_id: int):
    """
    POST /api/tracking/{booking_id}/reroute/
    Admin-triggered manual reroute.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    token = _auth_token(request)
    email = _resolve_email_from_token(token, request=request)

    from django.conf import settings
    from django.contrib.auth.models import User
    if not settings.DEBUG and not User.objects.filter(email__iexact=email, is_staff=True).exists():
        return JsonResponse({"error": "Admin only"}, status=403)

    trigger_reroute(booking_id)
    return JsonResponse({"status": "ok", "booking_id": booking_id})
