import json
import re
import urllib.parse
import urllib.request

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

GOOGLE_API_KEY = getattr(settings, "GOOGLE_MAPS_API_KEY", "").strip()
OPENCAGE_API_KEY = getattr(settings, "OPENCAGE_API_KEY", "").strip()

INDIA_BOUNDS = {
    "min_lat": 6.0,
    "max_lat": 38.5,
    "min_lng": 68.0,
    "max_lng": 97.8,
}

LOCALITY_DB = [
    {"name": "Shiv Vihar, Delhi", "city": "Delhi", "district": "North East Delhi", "lat": 28.7309, "lng": 77.2858},
    {"name": "Shiv Vihar, Loni, Ghaziabad", "city": "Ghaziabad", "district": "Ghaziabad", "lat": 28.7289, "lng": 77.2932},
    {"name": "Loni, Ghaziabad", "city": "Ghaziabad", "district": "Ghaziabad", "lat": 28.7510, "lng": 77.2890},
    {"name": "Banthla, Loni, Ghaziabad", "city": "Ghaziabad", "district": "Ghaziabad", "lat": 28.7369, "lng": 77.3214},
    {"name": "Noida", "city": "Noida", "district": "Gautam Buddha Nagar", "lat": 28.5355, "lng": 77.3910},
    {"name": "Greater Noida", "city": "Greater Noida", "district": "Gautam Buddha Nagar", "lat": 28.4744, "lng": 77.5040},
    {"name": "Ghaziabad", "city": "Ghaziabad", "district": "Ghaziabad", "lat": 28.6692, "lng": 77.4538},
    {"name": "Delhi", "city": "Delhi", "district": "New Delhi", "lat": 28.6139, "lng": 77.2090},
]


def _json_get(url, timeout=8):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read())


def _norm(value):
    return (
        re.sub(r"\s+", " ", str(value or "").strip().lower())
        .replace("shivvihar", "shiv vihar")
        .replace("saharda", "sharda")
    )


def _tokenize(value):
    return [t for t in re.split(r"[^a-z0-9]+", _norm(value)) if t]


def _is_india_coord(lat, lng):
    return (
        isinstance(lat, (int, float))
        and isinstance(lng, (int, float))
        and INDIA_BOUNDS["min_lat"] <= lat <= INDIA_BOUNDS["max_lat"]
        and INDIA_BOUNDS["min_lng"] <= lng <= INDIA_BOUNDS["max_lng"]
    )


def _haversine_km(a, b):
    import math

    r = 6371.0
    dlat = math.radians(float(b["lat"]) - float(a["lat"]))
    dlng = math.radians(float(b["lng"]) - float(a["lng"]))
    lat1 = math.radians(float(a["lat"]))
    lat2 = math.radians(float(b["lat"]))
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(x), math.sqrt(1 - x))


def _parse_latlng_text(text):
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$", str(text or ""))
    if not m:
        return None
    lat = float(m.group(1))
    lng = float(m.group(2))
    if _is_india_coord(lat, lng):
        return {"lat": lat, "lng": lng, "source": "direct"}
    return None


def _compose_query(query="", landmark="", area="", city="", district="", state=""):
    q = str(query or "").strip()
    parts = [str(landmark or "").strip(), str(area or "").strip(), str(city or "").strip(), str(district or "").strip(), str(state or "").strip()]
    parts = [p for p in parts if p]
    if q:
        combined = [q]
        for p in parts:
            if _norm(p) and _norm(p) not in _norm(q):
                combined.append(p)
        return ", ".join(combined)
    return ", ".join(parts)


def _score_text_match(text, city_hint, district_hint, candidate_label):
    tokens = set(_tokenize(text))
    ctokens = set(_tokenize(candidate_label))
    overlap = len(tokens.intersection(ctokens))
    score = overlap * 5
    if city_hint and _norm(city_hint) in _norm(candidate_label):
        score += 4
    if district_hint and _norm(district_hint) in _norm(candidate_label):
        score += 3
    return score


def _locality_lookup(query, city_hint="", district_hint=""):
    nq = _norm(query)
    if not nq:
        return None
    best = None
    best_score = -1
    for row in LOCALITY_DB:
        label = f"{row['name']} {row.get('city','')} {row.get('district','')}"
        score = _score_text_match(nq, city_hint, district_hint, label)
        if score > best_score:
            best_score = score
            best = row
    if best and best_score >= 5:
        return {
            "lat": float(best["lat"]),
            "lng": float(best["lng"]),
            "source": "local_db",
            "display_name": best["name"],
            "confidence": min(0.95, 0.5 + (best_score / 30.0)),
        }
    return None


def _google_geocode(query):
    if not GOOGLE_API_KEY:
        return None
    params = {"address": query, "key": GOOGLE_API_KEY, "region": "in"}
    url = "https://maps.googleapis.com/maps/api/geocode/json?" + urllib.parse.urlencode(params)
    data = _json_get(url)
    if data.get("status") != "OK":
        return None
    result = (data.get("results") or [None])[0]
    if not result:
        return None
    loc = result["geometry"]["location"]
    lat = float(loc["lat"])
    lng = float(loc["lng"])
    if not _is_india_coord(lat, lng):
        return None
    return {"lat": lat, "lng": lng, "source": "google", "display_name": result.get("formatted_address", query), "confidence": 0.9}


def _opencage_geocode(query):
    if not OPENCAGE_API_KEY:
        return None
    params = {
        "q": query,
        "key": OPENCAGE_API_KEY,
        "limit": 5,
        "countrycode": "in",
        "no_annotations": 1,
    }
    url = "https://api.opencagedata.com/geocode/v1/json?" + urllib.parse.urlencode(params)
    data = _json_get(url)
    results = data.get("results") or []
    for result in results:
        loc = result.get("geometry") or {}
        lat = float(loc.get("lat", 0))
        lng = float(loc.get("lng", 0))
        if _is_india_coord(lat, lng):
            return {
                "lat": lat,
                "lng": lng,
                "source": "opencage",
                "display_name": result.get("formatted", query),
                "confidence": 0.85,
            }
    return None


def _nominatim_geocode(query, city_hint="", district_hint=""):
    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 5,
        "countrycodes": "in",
    }
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "SwiftRescue/1.0 (route-geocoder)"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        results = json.loads(resp.read())
    if not isinstance(results, list) or not results:
        return None

    best = None
    best_score = -1
    for row in results:
        lat = float(row.get("lat", 0))
        lng = float(row.get("lon", 0))
        if not _is_india_coord(lat, lng):
            continue
        label = row.get("display_name", "")
        score = _score_text_match(query, city_hint, district_hint, label)
        if score > best_score:
            best_score = score
            best = {"lat": lat, "lng": lng, "display_name": label}
    if not best:
        return None
    best["source"] = "nominatim"
    best["confidence"] = min(0.82, 0.45 + (best_score / 25.0))
    return best


def _resolve_geocode(query="", landmark="", area="", city="", district="", state="", force_api=True):
    final_query = _compose_query(query, landmark, area, city, district, state)
    if not final_query:
        return None

    direct = _parse_latlng_text(final_query)
    if direct:
        return direct

    local = _locality_lookup(final_query, city, district)
    if local and not force_api:
        return local

    try:
        google = _google_geocode(final_query)
        if google:
            return google
    except Exception:
        pass

    try:
        opencage = _opencage_geocode(final_query)
        if opencage:
            return opencage
    except Exception:
        pass

    try:
        nominatim = _nominatim_geocode(final_query, city, district)
        if nominatim:
            return nominatim
    except Exception:
        pass

    # last fallback: local db
    return local


@csrf_exempt
def geocode_location(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    result = _resolve_geocode(
        query=body.get("query", ""),
        landmark=body.get("landmark", ""),
        area=body.get("area", ""),
        city=body.get("city", ""),
        district=body.get("district", ""),
        state=body.get("state", ""),
        force_api=bool(body.get("force_api", True)),
    )
    if not result:
        return JsonResponse({"status": "error", "message": "Location not resolved"}, status=404)
    return JsonResponse({"status": "ok", **result})


@csrf_exempt
def suggest_locations(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    q = _norm(request.GET.get("q", ""))
    city_hint = _norm(request.GET.get("city", ""))
    if not q:
        return JsonResponse({"status": "ok", "suggestions": []})

    out = []
    for row in LOCALITY_DB:
        label = f"{row['name']}, {row.get('city','')}".strip(", ")
        if q in _norm(label):
            score = _score_text_match(q, city_hint, "", label)
            out.append(
                {
                    "label": label,
                    "lat": row["lat"],
                    "lng": row["lng"],
                    "source": "local_db",
                    "score": score,
                }
            )
    out.sort(key=lambda x: x["score"], reverse=True)
    return JsonResponse({"status": "ok", "suggestions": out[:8]})


def _directions(origin, destination, waypoints=None):
    if not GOOGLE_API_KEY:
        return {"status": "API_KEY_MISSING", "error_message": "Google Maps API key not configured"}
    params = {
        "origin": origin,
        "destination": destination,
        "mode": "driving",
        "departure_time": "now",
        "traffic_model": "best_guess",
        "alternatives": "true",
        "key": GOOGLE_API_KEY,
    }
    if waypoints:
        params["waypoints"] = "optimize:false|" + "|".join(waypoints)
    url = "https://maps.googleapis.com/maps/api/directions/json?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=10) as resp:
        return json.loads(resp.read())


def _fmt_secs(secs):
    m = secs // 60
    return f"{m} min" if m < 60 else f"{m//60}h {m%60}min"


def _parse_route(route):
    all_steps = []
    total_dist_m = total_dur_s = total_traf_s = 0
    for leg in route["legs"]:
        total_dist_m += leg["distance"]["value"]
        total_dur_s += leg["duration"]["value"]
        traf = leg.get("duration_in_traffic", leg["duration"])
        total_traf_s += traf["value"]
        for s in leg["steps"]:
            all_steps.append(
                {
                    "instruction": s.get("html_instructions", ""),
                    "distance": s["distance"]["text"],
                    "duration": s["duration"]["text"],
                    "maneuver": s.get("maneuver", "straight"),
                    "start_lat": s["start_location"]["lat"],
                    "start_lng": s["start_location"]["lng"],
                    "end_lat": s["end_location"]["lat"],
                    "end_lng": s["end_location"]["lng"],
                }
            )
    return {
        "summary": route.get("summary", ""),
        "distance": f"{total_dist_m/1000:.1f} km",
        "distance_m": total_dist_m,
        "duration_normal": _fmt_secs(total_dur_s),
        "duration_traffic": _fmt_secs(total_traf_s),
        "duration_traffic_sec": total_traf_s,
        "start_address": route["legs"][0]["start_address"],
        "end_address": route["legs"][-1]["end_address"],
        "polyline": route["overview_polyline"]["points"],
        "steps": all_steps,
        "bounds": {
            "ne_lat": route["bounds"]["northeast"]["lat"],
            "ne_lng": route["bounds"]["northeast"]["lng"],
            "sw_lat": route["bounds"]["southwest"]["lat"],
            "sw_lng": route["bounds"]["southwest"]["lng"],
        },
    }


@csrf_exempt
def get_route(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    try:
        data = json.loads(request.body)
        pickup = f"{data['pickup_lat']},{data['pickup_lng']}"
        hosp = f"{data['hospital_lat']},{data['hospital_lng']}"
        amb = f"{data['ambulance_lat']},{data['ambulance_lng']}" if data.get("ambulance_lat") else None
    except (KeyError, json.JSONDecodeError) as e:
        return JsonResponse({"error": f"Missing: {e}"}, status=400)

    origin, waypoints, destination = (amb, [pickup], hosp) if amb else (pickup, None, hosp)
    try:
        api_data = _directions(origin, destination, waypoints)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=502)
    if api_data.get("status") != "OK":
        return JsonResponse({"error": api_data.get("status"), "detail": api_data.get("error_message", "")}, status=400)

    routes = sorted([_parse_route(r) for r in api_data["routes"]], key=lambda r: r["duration_traffic_sec"])
    return JsonResponse({"best_route": routes[0], "alternatives": routes[1:], "total_routes": len(routes)})


@csrf_exempt
def get_route_by_booking(request, booking_id):
    from ambulance.models import Ambulance
    from bookings.models import Booking
    from hospitals.models import Hospital

    if not GOOGLE_API_KEY:
        return JsonResponse({"error": "GOOGLE_MAPS_API_KEY missing in backend env"}, status=400)

    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return JsonResponse({"error": "Booking not found"}, status=404)
    try:
        amb = Ambulance.objects.get(id=booking.ambulance_id)
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "Ambulance not found"}, status=404)

    hospital = None
    if booking.assigned_hospital_id:
        hospital = Hospital.objects.filter(id=booking.assigned_hospital_id, is_active=True).first()
    if not hospital and booking.assigned_hospital_name:
        hospital = Hospital.objects.filter(name__icontains=booking.assigned_hospital_name.strip(), is_active=True).first()
    if not hospital and booking.destination:
        hospital = Hospital.objects.filter(name__icontains=booking.destination.strip(), is_active=True).first()
    if not hospital:
        hospital = Hospital.objects.filter(is_active=True, status="active").first()
    if not hospital:
        return JsonResponse({"error": "Koi active hospital nahi mila"}, status=404)

    amb_latlon = None
    if amb.latitude and amb.longitude:
        try:
            amb_latlon = f"{float(amb.latitude)},{float(amb.longitude)}"
        except (ValueError, TypeError):
            pass

    pickup_latlon = None
    pickup_from_booking = None
    if booking.pickup_latitude is not None and booking.pickup_longitude is not None:
        try:
            plat = float(booking.pickup_latitude)
            plng = float(booking.pickup_longitude)
            if _is_india_coord(plat, plng):
                pickup_from_booking = {"lat": plat, "lng": plng}
        except (ValueError, TypeError):
            pickup_from_booking = None

    pickup_resolved = _resolve_geocode(
        query=booking.pickup_location or "",
        landmark=getattr(booking, "pickup_landmark", "") or "",
        city=getattr(booking, "pickup_city", "") or "",
        district=getattr(booking, "pickup_district", "") or "",
        state="Uttar Pradesh",
        force_api=True,
    )

    pickup_from_geocode = None
    if pickup_resolved and _is_india_coord(float(pickup_resolved["lat"]), float(pickup_resolved["lng"])):
        pickup_from_geocode = {"lat": float(pickup_resolved["lat"]), "lng": float(pickup_resolved["lng"])}

    if pickup_from_geocode and pickup_from_booking:
        drift_km = _haversine_km(pickup_from_geocode, pickup_from_booking)
        chosen_pickup = pickup_from_geocode if drift_km > 0.6 else pickup_from_booking
        pickup_latlon = f"{chosen_pickup['lat']},{chosen_pickup['lng']}"
    elif pickup_from_geocode:
        pickup_latlon = f"{pickup_from_geocode['lat']},{pickup_from_geocode['lng']}"
    elif pickup_from_booking:
        pickup_latlon = f"{pickup_from_booking['lat']},{pickup_from_booking['lng']}"

    if not pickup_latlon:
        return JsonResponse({"error": "Pickup geocode nahi hua"}, status=400)

    try:
        hosp_lat = float(hospital.latitude)
        hosp_lng = float(hospital.longitude)
        if not _is_india_coord(hosp_lat, hosp_lng):
            raise ValueError("Hospital coordinate out of India bounds")
        hosp_latlon = f"{hosp_lat},{hosp_lng}"
    except (ValueError, TypeError, AttributeError):
        hosp_geo = _resolve_geocode(
            query=f"{hospital.name}, {hospital.address}",
            city=getattr(hospital, "city", "") or getattr(booking, "pickup_city", "") or "",
            district=getattr(booking, "pickup_district", "") or "",
            force_api=True,
        )
        if not hosp_geo:
            return JsonResponse({"error": "Hospital location resolve nahi hua"}, status=400)
        hosp_latlon = f"{hosp_geo['lat']},{hosp_geo['lng']}"

    origin, waypoints, destination = (amb_latlon, [pickup_latlon], hosp_latlon) if amb_latlon else (pickup_latlon, None, hosp_latlon)

    try:
        api_data = _directions(origin, destination, waypoints)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=502)
    if api_data.get("status") != "OK":
        return JsonResponse({"error": api_data.get("status"), "detail": api_data.get("error_message", "")}, status=400)

    routes = sorted([_parse_route(r) for r in api_data["routes"]], key=lambda r: r["duration_traffic_sec"])
    return JsonResponse(
        {
            "booking_id": booking_id,
            "ambulance": amb.ambulance_number,
            "ambulance_gps": amb_latlon,
            "pickup": booking.pickup_location,
            "hospital": hospital.name,
            "hospital_address": hospital.address,
            "best_route": routes[0],
            "alternatives": routes[1:],
            "total_routes": len(routes),
        }
    )
