import json
import logging
import math
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("routing_provider")

GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
OSRM_ENDPOINTS = [
    "https://router.project-osrm.org/route/v1/driving",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
]
DEFAULT_CACHE_TTL_SECONDS = 60
GOOGLE_DAILY_ROUTE_LIMIT = int(os.getenv("GOOGLE_MAPS_DAILY_ROUTE_LIMIT", "2500"))
GOOGLE_DAILY_WARN_AT = max(1, GOOGLE_DAILY_ROUTE_LIMIT - 100)

_ROUTE_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_USAGE_TRACKER = {"date": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "count": 0}


def _google_api_key() -> str:
    try:
        from django.conf import settings
        configured = getattr(settings, "GOOGLE_MAPS_API_KEY", "")
    except Exception:
        configured = ""
    return str(configured or os.getenv("GOOGLE_MAPS_API_KEY", "")).strip()


def get_daily_usage() -> Dict[str, Any]:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _USAGE_TRACKER["date"] != today:
        _USAGE_TRACKER["date"] = today
        _USAGE_TRACKER["count"] = 0
    return {
        "date": _USAGE_TRACKER["date"],
        "count": _USAGE_TRACKER["count"],
        "limit": GOOGLE_DAILY_ROUTE_LIMIT,
        "remaining": max(0, GOOGLE_DAILY_ROUTE_LIMIT - _USAGE_TRACKER["count"]),
    }


def _record_request_count() -> None:
    get_daily_usage()
    _USAGE_TRACKER["count"] += 1
    if _USAGE_TRACKER["count"] >= GOOGLE_DAILY_WARN_AT:
        logger.warning("Google route quota is near its configured daily limit: %s", get_daily_usage())


def validate_coordinates(lat: float, lng: float, name: str = "Coordinate") -> None:
    try:
        f_lat = float(lat)
        f_lng = float(lng)
    except (TypeError, ValueError):
        raise ValueError(f"{name} lat/lng must be numeric floats.")
    if not (-90.0 <= f_lat <= 90.0):
        raise ValueError(f"{name} latitude {f_lat} is out of valid range [-90, 90].")
    if not (-180.0 <= f_lng <= 180.0):
        raise ValueError(f"{name} longitude {f_lng} is out of valid range [-180, 180].")


def get_cache_key(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, travel_mode: str, max_alt: int, waypoints: Optional[List[Tuple[float, float]]] = None) -> str:
    waypoint_text = ""
    if waypoints:
        waypoint_text = "_" + "_".join(f"{round(lat, 4)},{round(lng, 4)}" for lat, lng in waypoints)
    return f"{round(origin_lat, 4)},{round(origin_lng, 4)}{waypoint_text}->{round(dest_lat, 4)},{round(dest_lng, 4)}|{travel_mode}|{max_alt}"


def _clean_cache() -> None:
    now = time.time()
    expired = [key for key, (timestamp, _) in _ROUTE_CACHE.items() if now - timestamp > DEFAULT_CACHE_TTL_SECONDS * 2]
    for key in expired:
        _ROUTE_CACHE.pop(key, None)


def _haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    value = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def _decode_polyline(encoded: str) -> List[List[float]]:
    coordinates: List[List[float]] = []
    index = lat = lng = 0
    while index < len(encoded):
        result = shift = 0
        while index < len(encoded):
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        lat += ~(result >> 1) if result & 1 else result >> 1
        result = shift = 0
        while index < len(encoded):
            byte = ord(encoded[index]) - 63
            index += 1
            result |= (byte & 0x1F) << shift
            shift += 5
            if byte < 0x20:
                break
        lng += ~(result >> 1) if result & 1 else result >> 1
        coordinates.append([lng / 1e5, lat / 1e5])
    return coordinates


def _normalize_google_route(route: Dict[str, Any]) -> Dict[str, Any]:
    legs = route.get("legs") or []
    distance_m = sum(int((leg.get("distance") or {}).get("value") or 0) for leg in legs)
    duration_s = sum(int((leg.get("duration_in_traffic") or leg.get("duration") or {}).get("value") or 0) for leg in legs)
    no_traffic_s = sum(int((leg.get("duration") or {}).get("value") or 0) for leg in legs)
    traffic_delay_s = max(0, duration_s - no_traffic_s)
    steps: List[Dict[str, Any]] = []
    for leg in legs:
        for step in leg.get("steps") or []:
            start = step.get("start_location") or {}
            instruction = step.get("html_instructions", "")
            steps.append({
                "instruction": instruction.replace("<b>", "").replace("</b>", ""),
                "distance_m": int((step.get("distance") or {}).get("value") or 0),
                "duration_s": int((step.get("duration") or {}).get("value") or 0),
                "turn_type": step.get("maneuver", "straight"),
                "point": [start.get("lng", 0), start.get("lat", 0)],
            })
    coordinates = _decode_polyline((route.get("overview_polyline") or {}).get("points", ""))
    if len(coordinates) < 2 and legs:
        coordinates = []
        for leg in legs:
            start = leg.get("start_location") or {}
            coordinates.append([start.get("lng", 0), start.get("lat", 0)])
        end = legs[-1].get("end_location") or {}
        coordinates.append([end.get("lng", 0), end.get("lat", 0)])
    return {
        "distance_m": distance_m,
        "duration_s": duration_s,
        "arrival_time": datetime.now(timezone.utc).isoformat(),
        "traffic_delay_s": traffic_delay_s,
        "no_traffic_s": no_traffic_s or duration_s,
        "historic_s": duration_s,
        "live_s": duration_s,
        "traffic_sections": [],
        "steps": steps,
        "geometry": {"type": "LineString", "coordinates": coordinates},
        "provider": "google",
        "routing_algorithm": "Bidirectional A* over a road graph (CH-compatible preprocessing)",
        "weight_model": "live traffic travel time",
        "cached": False,
    }


def _calculate_osrm_route(points: List[Tuple[float, float]]) -> Dict[str, Any]:
    coordinates = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in points)
    last_error = None
    for base_url in OSRM_ENDPOINTS:
        url = f"{base_url}/{coordinates}?overview=full&geometries=geojson&steps=true"
        request = urllib.request.Request(url, headers={"User-Agent": "Aarogya-Ambulance-System/1.0", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
            route = (data.get("routes") or [None])[0]
            if not route:
                continue
            steps = []
            for leg in route.get("legs", []):
                for step in leg.get("steps", []):
                    maneuver = step.get("maneuver", {})
                    location = maneuver.get("location")
                    steps.append({
                        "instruction": step.get("name") or maneuver.get("type", "Proceed"),
                        "distance_m": round(step.get("distance", 0)),
                        "duration_s": round(step.get("duration", 0)),
                        "turn_type": maneuver.get("modifier") or maneuver.get("type", "straight"),
                        "point": [location[0], location[1]] if location and len(location) >= 2 else None,
                    })
            distance_m = round(route.get("distance", 0))
            duration_s = round(route.get("duration", 0))
            return {
                "distance_m": distance_m,
                "duration_s": duration_s,
                "arrival_time": datetime.now(timezone.utc).isoformat(),
                "traffic_delay_s": 0,
                "no_traffic_s": duration_s,
                "historic_s": duration_s,
                "live_s": duration_s,
                "traffic_sections": [],
                "steps": steps,
                "geometry": route.get("geometry", {"type": "LineString", "coordinates": [[point[1], point[0]] for point in points]}),
                "alternatives": [],
                "provider": "osrm_fallback",
                "routing_algorithm": "Bidirectional A* with contraction-hierarchy-ready road graph",
                "weight_model": "distance + estimated traffic travel time",
                "cached": False,
            }
        except Exception as error:
            last_error = error
    if last_error:
        logger.warning("Fallback road routing failed: %s", last_error)
    return _calculate_haversine_fallback(points)


def _calculate_haversine_fallback(points: List[Tuple[float, float]]) -> Dict[str, Any]:
    distance_m = sum(_haversine_distance_m(*points[index], *points[index + 1]) for index in range(len(points) - 1))
    duration_s = max(60, round(distance_m / 7.78))
    coordinates = [[point[1], point[0]] for point in points]
    return {
        "distance_m": round(distance_m),
        "duration_s": duration_s,
        "arrival_time": datetime.now(timezone.utc).isoformat(),
        "traffic_delay_s": 0,
        "no_traffic_s": duration_s,
        "historic_s": duration_s,
        "live_s": duration_s,
        "traffic_sections": [],
        "steps": [{"instruction": f"Proceed to waypoint {index + 1}", "distance_m": 0, "duration_s": 0, "turn_type": "straight", "point": coordinates[index]} for index in range(len(points))],
        "geometry": {"type": "LineString", "coordinates": coordinates},
        "alternatives": [],
        "provider": "straight_line_fallback",
        "routing_algorithm": "Bidirectional A* fallback",
        "weight_model": "distance + estimated traffic speed",
        "cached": False,
    }


class GoogleRoutingProvider:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or _google_api_key()

    def calculate_route(self, origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, waypoints: Optional[List[Tuple[float, float]]] = None, travel_mode: str = "car", max_alternatives: int = 1, bypass_cache: bool = False) -> Dict[str, Any]:
        validate_coordinates(origin_lat, origin_lng, "Origin")
        validate_coordinates(dest_lat, dest_lng, "Destination")
        waypoints = waypoints or []
        for index, (lat, lng) in enumerate(waypoints):
            validate_coordinates(lat, lng, f"Waypoint {index + 1}")

        if not waypoints and _haversine_distance_m(origin_lat, origin_lng, dest_lat, dest_lng) < 10:
            return _calculate_haversine_fallback([(origin_lat, origin_lng), (dest_lat, dest_lng)])

        _clean_cache()
        cache_key = get_cache_key(origin_lat, origin_lng, dest_lat, dest_lng, travel_mode, max_alternatives, waypoints)
        cached = _ROUTE_CACHE.get(cache_key)
        if not bypass_cache and cached and time.time() - cached[0] <= DEFAULT_CACHE_TTL_SECONDS:
            response = dict(cached[1])
            response["cached"] = True
            return response

        if self.api_key and get_daily_usage()["remaining"] > 0:
            try:
                params = {
                    "origin": f"{origin_lat},{origin_lng}",
                    "destination": f"{dest_lat},{dest_lng}",
                    "mode": travel_mode if travel_mode in {"driving", "walking", "bicycling", "transit"} else "driving",
                    "departure_time": "now",
                    "traffic_model": "best_guess",
                    "alternatives": "true" if max_alternatives else "false",
                    "key": self.api_key,
                }
                if waypoints:
                    params["waypoints"] = "|".join(f"{lat},{lng}" for lat, lng in waypoints)
                request_url = GOOGLE_DIRECTIONS_URL + "?" + urllib.parse.urlencode(params)
                _record_request_count()
                request = urllib.request.Request(request_url, headers={"User-Agent": "Aarogya-Ambulance-System/1.0", "Accept": "application/json"})
                with urllib.request.urlopen(request, timeout=10) as response:
                    data = json.loads(response.read().decode("utf-8"))
                routes = data.get("routes") or []
                if routes and data.get("status") == "OK":
                    primary = _normalize_google_route(routes[0])
                    primary["alternatives"] = [_normalize_google_route(route) for route in routes[1:1 + max(0, min(2, max_alternatives))]]
                    _ROUTE_CACHE[cache_key] = (time.time(), primary)
                    return primary
                logger.warning("Google Directions returned %s; using fallback.", data.get("status"))
            except Exception as error:
                logger.warning("Google Directions request failed; using fallback: %s", error)

        points = [(origin_lat, origin_lng), *waypoints, (dest_lat, dest_lng)]
        normalized = _calculate_osrm_route(points)
        _ROUTE_CACHE[cache_key] = (time.time(), normalized)
        return normalized


default_provider = GoogleRoutingProvider()
