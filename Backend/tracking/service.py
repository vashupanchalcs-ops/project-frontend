"""
tracking/service.py
--------------------
TrackingService — business logic layer for all tracking events.

Called by existing views when relevant events happen:
  - Ambulance assigned to booking → create_tracking_session()
  - Driver GPS ping               → broadcast_gps()
  - Patient pickup complete       → on_pickup_completed()
  - Hospital changed              → on_hospital_changed()
  - Ambulance transferred         → on_ambulance_transferred()
  - Booking status change         → on_booking_status_changed()

All WS broadcasts go through _broadcast() so consumers stay thin.
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .consumers import (
    EVT_LOCATION, EVT_ROUTE, EVT_ETA, EVT_PICKUP,
    EVT_HOSPITAL, EVT_TRANSFER, EVT_STATUS, _route_to_dict, _utcnow,
)

logger = logging.getLogger("tracking.service")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _group(booking_id: int) -> str:
    return f"booking_{booking_id}_tracking"


def _broadcast(booking_id: int, payload: dict) -> None:
    """Fire-and-forget group send. Safe to call from sync Django views."""
    try:
        layer = get_channel_layer()
        async_to_sync(layer.group_send)(
            _group(booking_id),
            {"type": "tracking.event", "payload": payload},
        )
    except Exception as exc:
        logger.error("WS broadcast failed booking=%s: %s", booking_id, exc)


# ── Public API ─────────────────────────────────────────────────────────────────

def create_tracking_session(booking) -> None:
    """
    Called when admin assigns an ambulance to a booking (status → confirmed).
    Creates/resets TrackingSession and calculates initial route.
    """
    from tracking.models import TrackingSession
    from ambulance.models import Ambulance
    from hospitals.models import Hospital

    try:
        amb = Ambulance.objects.get(id=booking.ambulance_id)
    except Ambulance.DoesNotExist:
        logger.warning("create_tracking_session: ambulance %s not found", booking.ambulance_id)
        return

    hosp = None
    h_lat = h_lng = None
    if booking.assigned_hospital_id:
        hosp = Hospital.objects.filter(id=booking.assigned_hospital_id).first()
    if not hosp and booking.destination:
        hosp = Hospital.objects.filter(
            name__icontains=booking.destination.strip(), is_active=True
        ).first()
    if hosp:
        try:
            h_lat = float(hosp.latitude) if hosp.latitude else None
            h_lng = float(hosp.longitude) if hosp.longitude else None
        except (TypeError, ValueError):
            h_lat = h_lng = None

    TrackingSession.objects.update_or_create(
        booking_id=booking.id,
        defaults={
            "ambulance_id":  booking.ambulance_id,
            "patient_lat":   booking.pickup_latitude,
            "patient_lng":   booking.pickup_longitude,
            "hospital_id":   hosp.id if hosp else None,
            "hospital_lat":  h_lat,
            "hospital_lng":  h_lng,
            "current_phase": "TO_PATIENT",
            "is_active":     True,
        },
    )

    # Initial route: ambulance current position → patient pickup
    amb_lat = amb.latitude or booking.pickup_latitude
    amb_lng = amb.longitude or booking.pickup_longitude
    _calculate_and_broadcast_route(
        booking_id=booking.id,
        phase="TO_PATIENT",
        origin_lat=amb_lat,
        origin_lng=amb_lng,
        dest_lat=booking.pickup_latitude,
        dest_lng=booking.pickup_longitude,
    )


def broadcast_gps(booking_id: int, lat: float, lng: float,
                  speed: float = 0, bearing: float = 0) -> None:
    """
    Called by driver_ping REST view after GPS update.
    Broadcasts live location to all tracking clients.
    """
    _broadcast(booking_id, {
        "type":       EVT_LOCATION,
        "booking_id": booking_id,
        "latitude":   lat,
        "longitude":  lng,
        "speed":      speed,
        "bearing":    bearing,
        "timestamp":  _utcnow(),
    })


def on_pickup_completed(booking_id: int) -> None:
    """
    Driver confirmed patient pickup → switch phase TO_HOSPITAL,
    calculate new route patient→hospital, broadcast.
    """
    from tracking.models import TrackingSession
    from ambulance.models import Ambulance

    try:
        session = TrackingSession.objects.get(booking_id=booking_id, is_active=True)
    except TrackingSession.DoesNotExist:
        return

    session.current_phase = "TO_HOSPITAL"
    session.save(update_fields=["current_phase", "updated_at"])

    _broadcast(booking_id, {
        "type":      EVT_PICKUP,
        "booking_id": booking_id,
        "new_phase": "TO_HOSPITAL",
        "timestamp": _utcnow(),
    })

    if not (session.hospital_lat and session.hospital_lng):
        return

    try:
        amb = Ambulance.objects.get(id=session.ambulance_id)
    except Ambulance.DoesNotExist:
        return

    _calculate_and_broadcast_route(
        booking_id=booking_id,
        phase="TO_HOSPITAL",
        origin_lat=amb.latitude or session.patient_lat,
        origin_lng=amb.longitude or session.patient_lng,
        dest_lat=session.hospital_lat,
        dest_lng=session.hospital_lng,
    )


def on_hospital_changed(booking_id: int, new_hospital) -> None:
    """Admin changes destination hospital — update session, recalculate route."""
    from tracking.models import TrackingSession
    from ambulance.models import Ambulance

    try:
        session = TrackingSession.objects.get(booking_id=booking_id, is_active=True)
    except TrackingSession.DoesNotExist:
        return

    try:
        h_lat = float(new_hospital.latitude) if new_hospital.latitude else None
        h_lng = float(new_hospital.longitude) if new_hospital.longitude else None
    except (TypeError, ValueError):
        h_lat = h_lng = None

    session.hospital_id  = new_hospital.id
    session.hospital_lat = h_lat
    session.hospital_lng = h_lng
    session.save(update_fields=["hospital_id", "hospital_lat", "hospital_lng", "updated_at"])

    _broadcast(booking_id, {
        "type":      EVT_HOSPITAL,
        "booking_id": booking_id,
        "hospital": {
            "id":        new_hospital.id,
            "name":      new_hospital.name,
            "latitude":  h_lat,
            "longitude": h_lng,
        },
        "timestamp": _utcnow(),
    })

    if not (h_lat and h_lng):
        return

    try:
        amb = Ambulance.objects.get(id=session.ambulance_id)
    except Ambulance.DoesNotExist:
        return

    _calculate_and_broadcast_route(
        booking_id=booking_id,
        phase=session.current_phase,
        origin_lat=amb.latitude or session.patient_lat,
        origin_lng=amb.longitude or session.patient_lng,
        dest_lat=h_lat,
        dest_lng=h_lng,
    )


def on_ambulance_transferred(booking_id: int, new_ambulance) -> None:
    """Admin approves ambulance transfer — update session, recalculate route."""
    from tracking.models import TrackingSession

    try:
        session = TrackingSession.objects.get(booking_id=booking_id, is_active=True)
    except TrackingSession.DoesNotExist:
        return

    session.ambulance_id = new_ambulance.id
    session.save(update_fields=["ambulance_id", "updated_at"])

    _broadcast(booking_id, {
        "type":      EVT_TRANSFER,
        "booking_id": booking_id,
        "new_ambulance": {
            "id":     new_ambulance.id,
            "number": new_ambulance.ambulance_number,
            "driver": new_ambulance.driver,
            "lat":    new_ambulance.latitude,
            "lng":    new_ambulance.longitude,
        },
        "timestamp": _utcnow(),
    })

    # Recalculate route from new ambulance's position
    dest_lat = (
        session.patient_lat if session.current_phase == "TO_PATIENT"
        else session.hospital_lat
    )
    dest_lng = (
        session.patient_lng if session.current_phase == "TO_PATIENT"
        else session.hospital_lng
    )
    if dest_lat and dest_lng and new_ambulance.latitude:
        _calculate_and_broadcast_route(
            booking_id=booking_id,
            phase=session.current_phase,
            origin_lat=new_ambulance.latitude,
            origin_lng=new_ambulance.longitude,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
        )


def on_booking_status_changed(booking_id: int, new_status: str) -> None:
    """Booking status changed — close session if terminal, broadcast."""
    from tracking.models import TrackingSession
    if new_status in ("completed", "cancelled"):
        TrackingSession.objects.filter(booking_id=booking_id).update(
            is_active=False, current_phase="COMPLETED"
        )
    _broadcast(booking_id, {
        "type":      EVT_STATUS,
        "booking_id": booking_id,
        "status":    new_status,
        "timestamp": _utcnow(),
    })


def trigger_reroute(booking_id: int) -> None:
    """Admin manual reroute or stale route refresh trigger."""
    from tracking.models import TrackingSession
    from ambulance.models import Ambulance

    try:
        session = TrackingSession.objects.get(booking_id=booking_id, is_active=True)
    except TrackingSession.DoesNotExist:
        return

    try:
        amb = Ambulance.objects.get(id=session.ambulance_id)
    except Ambulance.DoesNotExist:
        return

    if session.current_phase == "TO_PATIENT":
        dest_lat, dest_lng = session.patient_lat, session.patient_lng
    else:
        dest_lat, dest_lng = session.hospital_lat, session.hospital_lng

    _calculate_and_broadcast_route(
        booking_id=booking_id,
        phase=session.current_phase,
        origin_lat=amb.latitude,
        origin_lng=amb.longitude,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
    )


# ── Internal route calculation ─────────────────────────────────────────────────

def _calculate_and_broadcast_route(
    booking_id: int, phase: str,
    origin_lat, origin_lng,
    dest_lat, dest_lng,
) -> None:
    """Calculate route, persist RouteVersion (versioned), broadcast ROUTE_UPDATED + ETA_UPDATED."""
    from .route_service import calculate_route
    from .models import RouteVersion

    if None in (origin_lat, origin_lng, dest_lat, dest_lng):
        logger.warning(
            "Missing coords for route calc booking=%s phase=%s", booking_id, phase
        )
        return

    route_data = calculate_route(
        origin_lat=float(origin_lat), origin_lng=float(origin_lng),
        dest_lat=float(dest_lat), dest_lng=float(dest_lng),
    )

    # Atomic version bump
    last_v = (
        RouteVersion.objects.filter(booking_id=booking_id, phase=phase)
        .order_by("-version")
        .values_list("version", flat=True)
        .first()
        or 0
    )

    # Deactivate previous route for this (booking, phase)
    RouteVersion.objects.filter(
        booking_id=booking_id, phase=phase
    ).update(is_active=False)

    route = RouteVersion.objects.create(
        booking_id         = booking_id,
        phase              = phase,
        version            = last_v + 1,
        origin_lat         = float(origin_lat),
        origin_lng         = float(origin_lng),
        destination_lat    = float(dest_lat),
        destination_lng    = float(dest_lng),
        distance_m         = route_data.get("distance_m", 0),
        duration_s         = route_data.get("duration_s", 0),
        traffic_duration_s = route_data.get("traffic_duration_s", 0),
        polyline           = route_data.get("polyline", ""),
        provider           = route_data.get("provider", ""),
        is_active          = True,
    )

    route_dict = _route_to_dict(route)

    _broadcast(booking_id, {
        "type":      EVT_ROUTE,
        "booking_id": booking_id,
        "route":     route_dict,
        "timestamp": _utcnow(),
    })

    _broadcast(booking_id, {
        "type":               EVT_ETA,
        "booking_id":         booking_id,
        "phase":              phase,
        "distance_m":         route.distance_m,
        "duration_s":         route.duration_s,
        "traffic_duration_s": route.traffic_duration_s,
        "provider":           route.provider,
        "timestamp":          _utcnow(),
    })
