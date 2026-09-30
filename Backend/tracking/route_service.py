"""
tracking/route_service.py
--------------------------
RouteService abstraction.

Provider chain (best → fallback):
  Tier 1: Google Routes API v2   (GOOGLE_ROUTES_API_KEY env var — BACKEND ONLY)
  Tier 2: TomTom                 (existing routing_provider.py TOMTOM_API_KEY)
  Tier 3: OSRM                   (free public road routing)
  Tier 4: Haversine              (offline fallback)

Google Routes API key is NEVER sent to Flutter — stays server-side.
"""
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple

from django.conf import settings

logger = logging.getLogger("tracking.route_service")

GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


def _google_routes(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    waypoints: Optional[List[Tuple[float, float]]] = None,
) -> Optional[Dict[str, Any]]:
    """Call Google Routes API v2. Returns normalized dict or None on failure."""
    api_key = getattr(settings, "GOOGLE_ROUTES_API_KEY", "").strip()
    if not api_key:
        return None

    body: Dict[str, Any] = {
        "origin": {"location": {"latLng": {
            "latitude": origin_lat, "longitude": origin_lng
        }}},
        "destination": {"location": {"latLng": {
            "latitude": dest_lat, "longitude": dest_lng
        }}},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "computeAlternativeRoutes": False,
        "languageCode": "en-IN",
        "units": "METRIC",
    }

    if waypoints:
        body["intermediates"] = [
            {"location": {"latLng": {"latitude": lat, "longitude": lng}}}
            for lat, lng in waypoints
        ]

    payload = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        GOOGLE_ROUTES_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": (
                "routes.duration,routes.distanceMeters,"
                "routes.staticDuration,routes.polyline.encodedPolyline,"
                "routes.travelAdvisory"
            ),
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        logger.warning("Google Routes API HTTP %s: %s", e.code, e.read()[:300])
        return None
    except Exception as e:
        logger.warning("Google Routes API error: %s", e)
        return None

    routes = data.get("routes", [])
    if not routes:
        return None

    r = routes[0]
    distance_m      = r.get("distanceMeters", 0)
    traffic_str     = r.get("duration", "0s")
    static_str      = r.get("staticDuration", traffic_str)
    traffic_s       = int(traffic_str.rstrip("s") or 0)
    static_s        = int(static_str.rstrip("s") or 0)
    polyline        = r.get("polyline", {}).get("encodedPolyline", "")

    return {
        "distance_m":         distance_m,
        "duration_s":         static_s,
        "traffic_duration_s": traffic_s,
        "polyline":           polyline,
        "provider":           "google_routes",
        "cached":             False,
    }


def calculate_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
    waypoints: Optional[List[Tuple[float, float]]] = None,
) -> Dict[str, Any]:
    """
    Calculate route via best available provider. Never raises — falls back gracefully.
    Returns normalized dict:
      distance_m, duration_s, traffic_duration_s, polyline, provider, cached
    """
    # Tier 1: Google Routes API
    result = _google_routes(origin_lat, origin_lng, dest_lat, dest_lng, waypoints)
    if result:
        return result

    # Tier 2–4: existing routing_provider chain (TomTom → OSRM → Haversine)
    try:
        import sys, os
        # routing_provider.py lives at BASE_DIR (parent of this app)
        base_dir = str(getattr(settings, "BASE_DIR", ""))
        if base_dir and base_dir not in sys.path:
            sys.path.insert(0, base_dir)
        from routing_provider import default_provider  # type: ignore
        legacy = default_provider.calculate_route(
            origin_lat=origin_lat, origin_lng=origin_lng,
            dest_lat=dest_lat, dest_lng=dest_lng,
            waypoints=waypoints or [],
        )
        coords = legacy.get("geometry", {}).get("coordinates", [])
        return {
            "distance_m":         legacy.get("distance_m", 0),
            "duration_s":         legacy.get("duration_s", 0),
            "traffic_duration_s": legacy.get("duration_s", 0),
            "polyline":           json.dumps({"type": "LineString", "coordinates": coords}),
            "provider":           legacy.get("provider", "fallback"),
            "cached":             legacy.get("cached", False),
        }
    except Exception as e:
        logger.error("All routing providers failed: %s", e)
        return {
            "distance_m": 0, "duration_s": 0, "traffic_duration_s": 0,
            "polyline": "", "provider": "error", "cached": False,
        }
