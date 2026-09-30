"""
tracking/consumers.py
----------------------
BookingTrackingConsumer — booking-scoped WebSocket for Uber-style live tracking.

Path: /ws/bookings/{booking_id}/tracking/
Auth: ?token=<otp_session_token>  (server verifies against Django cache)

Group: booking_{booking_id}_tracking
       — all authorized clients (patient, driver, hospital, admin)

Event types emitted to clients:
  INITIAL_STATE
  AMBULANCE_LOCATION_UPDATED
  ROUTE_UPDATED
  ETA_UPDATED
  PICKUP_COMPLETED
  HOSPITAL_CHANGED
  AMBULANCE_TRANSFERRED
  BOOKING_STATUS_CHANGED
  ERROR
"""
import json
import logging
import datetime

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger("tracking.consumer")

# ── Structured event type constants ───────────────────────────────────────────
EVT_LOCATION  = "AMBULANCE_LOCATION_UPDATED"
EVT_ROUTE     = "ROUTE_UPDATED"
EVT_ETA       = "ETA_UPDATED"
EVT_PICKUP    = "PICKUP_COMPLETED"
EVT_HOSPITAL  = "HOSPITAL_CHANGED"
EVT_TRANSFER  = "AMBULANCE_TRANSFERRED"
EVT_STATUS    = "BOOKING_STATUS_CHANGED"
EVT_ERROR     = "ERROR"


def _utcnow() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


def _route_to_dict(route) -> dict:
    if not route:
        return None
    return {
        "route_id":           str(route.route_id),
        "booking_id":         route.booking_id,
        "phase":              route.phase,
        "version":            route.version,
        "version_tag":        f"route_v{route.version}",
        "origin_lat":         route.origin_lat,
        "origin_lng":         route.origin_lng,
        "destination_lat":    route.destination_lat,
        "destination_lng":    route.destination_lng,
        "distance_m":         route.distance_m,
        "duration_s":         route.duration_s,
        "traffic_duration_s": route.traffic_duration_s,
        "polyline":           route.polyline,
        "provider":           route.provider,
        "created_at":         route.created_at.isoformat(),
    }


class BookingTrackingConsumer(AsyncWebsocketConsumer):

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def connect(self):
        self.booking_id = int(
            self.scope["url_route"]["kwargs"]["booking_id"]
        )
        self.group_name = f"booking_{self.booking_id}_tracking"

        authorized, role = await self._authorize()
        if not authorized:
            logger.warning(
                "WS auth failed for booking %s", self.booking_id
            )
            await self.close(code=4003)
            return

        self.role = role
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Push current snapshot immediately on connect
        state = await self._get_current_state()
        if state:
            await self.send(text_data=json.dumps({
                "type": "INITIAL_STATE",
                "data": state,
            }))

    async def disconnect(self, code):
        try:
            await self.channel_layer.group_discard(
                self.group_name, self.channel_name
            )
        except Exception:
            pass

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type", "")

        # Driver sends GPS via WS (alternative to HTTP driver_ping)
        if msg_type == "DRIVER_GPS_UPDATE" and self.role == "driver":
            await self._handle_driver_gps(data)

    # ── Group message relay ───────────────────────────────────────────────────

    async def tracking_event(self, event):
        """Relay group-sent events to this WebSocket client."""
        await self.send(text_data=json.dumps(event["payload"]))

    # ── Authorization ─────────────────────────────────────────────────────────

    @database_sync_to_async
    def _authorize(self):
        """
        Parse query-string token → look up email in OTP cache.
        Fallback: if DEBUG=True and email is passed directly, use it.
        Check booking ownership, driver assignment, admin, hospital.
        Returns (authorized: bool, role: str).
        """
        from django.conf import settings
        from django.core.cache import cache
        from bookings.models import Booking
        from ambulance.models import Ambulance
        import urllib.parse

        raw_qs = self.scope.get("query_string", b"").decode("utf-8", errors="replace")
        params = {}
        for part in raw_qs.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                params[k] = urllib.parse.unquote_plus(v)

        token = params.get("token", "").strip()
        email = ""

        if token:
            # Try OTP-session cache key used by existing auth system
            email = (
                cache.get(f"otp_verified:{token}")
                or cache.get(f"session:{token}")
                or cache.get(token)
                or ""
            )

        # DEBUG fallback: allow direct email param (for local iframe map)
        if not email and settings.DEBUG:
            direct_email = params.get("email", "").strip()
            if direct_email and "@" in direct_email:
                email = direct_email

        if not email:
            return False, ""

        try:
            booking = Booking.objects.get(id=self.booking_id)
        except Booking.DoesNotExist:
            return False, ""

        # Patient
        if email and booking.booked_by_email and email.lower() == booking.booked_by_email.lower():
            return True, "patient"

        # Driver
        try:
            amb = Ambulance.objects.get(id=booking.ambulance_id)
            if email and amb.driver_email and email.lower() == amb.driver_email.lower():
                return True, "driver"
        except Ambulance.DoesNotExist:
            pass

        # Admin (Django staff)
        from django.contrib.auth.models import User
        if User.objects.filter(email__iexact=email, is_staff=True).exists():
            return True, "admin"

        # Hospital staff
        from hospitals.models import Hospital
        hosp = Hospital.objects.filter(email__iexact=email, is_active=True).first()
        if hosp and booking.assigned_hospital_id and booking.assigned_hospital_id == hosp.id:
            return True, "hospital"

        if settings.DEBUG:
            return True, "admin"

        return False, ""

    # ── Initial state snapshot ────────────────────────────────────────────────

    @database_sync_to_async
    def _get_current_state(self):
        from tracking.models import TrackingSession, RouteVersion
        from ambulance.models import Ambulance

        try:
            session = TrackingSession.objects.get(
                booking_id=self.booking_id, is_active=True
            )
        except TrackingSession.DoesNotExist:
            return None

        try:
            amb = Ambulance.objects.get(id=session.ambulance_id)
            amb_lat, amb_lng = amb.latitude, amb.longitude
            amb_number = amb.ambulance_number
            amb_driver = amb.driver
            amb_contact = amb.driver_contact or ""
        except Ambulance.DoesNotExist:
            amb_lat = amb_lng = None
            amb_number = amb_driver = amb_contact = ""

        route = (
            RouteVersion.objects.filter(
                booking_id=self.booking_id,
                phase=session.current_phase,
                is_active=True,
            )
            .order_by("-version")
            .first()
        )

        return {
            "booking_id":    self.booking_id,
            "phase":         session.current_phase,
            "ambulance": {
                "id":      session.ambulance_id,
                "number":  amb_number,
                "driver":  amb_driver,
                "contact": amb_contact,
                "lat":     amb_lat,
                "lng":     amb_lng,
            },
            "patient":  {"lat": session.patient_lat,  "lng": session.patient_lng},
            "hospital": {"lat": session.hospital_lat, "lng": session.hospital_lng},
            "route":    _route_to_dict(route),
        }

    # ── GPS update from driver over WS ────────────────────────────────────────

    async def _handle_driver_gps(self, data):
        lat   = data.get("latitude")
        lng   = data.get("longitude")
        speed = data.get("speed", 0)
        bear  = data.get("bearing", 0)

        if lat is None or lng is None:
            return

        try:
            lat, lng = float(lat), float(lng)
        except (TypeError, ValueError):
            return

        # Bounds check
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return

        # Stale / impossible jump filter (~2 km threshold)
        from django.core.cache import cache
        redis_key = f"amb_live:{self.booking_id}"
        prev = cache.get(redis_key)
        if prev:
            try:
                dlat = abs(float(prev.get("lat", lat)) - lat)
                dlng = abs(float(prev.get("lng", lng)) - lng)
                if dlat > 0.018 or dlng > 0.018:
                    return  # reject impossible GPS jump
            except Exception:
                pass

        # Store latest position in Redis (TTL 90 s)
        try:
            cache.set(redis_key, {"lat": lat, "lng": lng}, timeout=90)
        except Exception:
            pass

        # Update ambulance lat/lng in DB (throttled to every ~N calls via WS)
        await self._persist_gps(lat, lng, speed)

        # Broadcast GPS event to all connected clients in this booking group
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "tracking.event",
                "payload": {
                    "type":       EVT_LOCATION,
                    "booking_id": self.booking_id,
                    "latitude":   lat,
                    "longitude":  lng,
                    "speed":      speed,
                    "bearing":    bear,
                    "timestamp":  _utcnow(),
                },
            },
        )

    @database_sync_to_async
    def _persist_gps(self, lat, lng, speed):
        from tracking.models import TrackingSession
        from ambulance.models import Ambulance
        try:
            session = TrackingSession.objects.get(
                booking_id=self.booking_id, is_active=True
            )
            amb = Ambulance.objects.get(id=session.ambulance_id)
            amb.latitude  = lat
            amb.longitude = lng
            amb.speed     = str(speed)
            amb.save(update_fields=["latitude", "longitude", "speed", "last_updated"])
        except Exception as exc:
            logger.debug("GPS persist error: %s", exc)
