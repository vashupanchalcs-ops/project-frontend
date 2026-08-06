"""
ambulance/tracking_views.py
Real-time GPS tracking, battery monitoring, route suggestion, and driver ping APIs
"""
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from django.core.mail import send_mail
from ambulance.models import Ambulance, DriverLocation, SuggestedRoute
import json
import urllib.request
import urllib.parse


def _resolve_ambulance(raw_id):
    """Resolve ambulance by numeric id, ambulance number, or contract id."""
    value = str(raw_id or "").strip()
    if not value:
        return None

    if value.isdigit():
        amb = Ambulance.objects.filter(id=int(value)).first()
        if amb:
            return amb

    amb = Ambulance.objects.filter(ambulance_number__iexact=value).first()
    if amb:
        return amb

    return Ambulance.objects.filter(ambulance_contract_id__iexact=value).first()


@csrf_exempt
def update_battery(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    ambulance_id = data.get("ambulance_id")
    battery_percentage = data.get("battery_percentage")

    if ambulance_id is None or battery_percentage is None:
        return JsonResponse(
            {"error": "ambulance_id and battery_percentage are required"},
            status=400,
        )

    ambulance = _resolve_ambulance(ambulance_id)
    if not ambulance:
        return JsonResponse({"error": "Ambulance not found"}, status=404)

    try:
        battery_value = int(battery_percentage)
    except (TypeError, ValueError):
        return JsonResponse({"error": "battery_percentage must be an integer"}, status=400)

    battery_value = max(0, min(100, battery_value))
    ambulance.battery_percentage = battery_value
    ambulance.save(update_fields=["battery_percentage", "last_updated"])

    return JsonResponse(
        {
            "status": "ok",
            "ambulance_id": ambulance.id,
            "battery_percentage": ambulance.battery_percentage,
            "last_updated": ambulance.last_updated.isoformat(),
        }
    )


def _get_active_booking_for_ambulance(ambulance_id):
    from bookings.models import Booking
    return Booking.objects.filter(
        ambulance_id=ambulance_id,
        status="confirmed",
        sent_to_driver=True,
        driver_task_completed=False,
    ).order_by("-id").first()


def _route_dict(r):
    if not r:
        return None
    return {
        "id": r.id,
        "ambulance_id": r.ambulance_id,
        "booking_id": r.booking_id,
        "pickup_location": r.pickup_location,
        "destination": r.destination,
        "polyline": r.polyline,
        "distance_km": r.distance_km,
        "duration": r.duration,
        "status": r.status,
        "pickup_lat": getattr(r, "pickup_lat", None),
        "pickup_lng": getattr(r, "pickup_lng", None),
        "dest_lat": getattr(r, "dest_lat", None),
        "dest_lng": getattr(r, "dest_lng", None),
        "created_at": r.created_at.isoformat(),
        "accepted_at": r.accepted_at.isoformat() if r.accepted_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    }


@csrf_exempt
def driver_ping(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    email  = data.get("driver_email", "")
    amb_id = data.get("ambulance_id")
    lat    = data.get("latitude")
    lng    = data.get("longitude")
    speed  = data.get("speed", 0)
    # ✅ BATTERY LEVEL RECEIVED FROM FRONTEND
    battery = data.get("battery_level", None)

    if not email or amb_id in (None, "") or lat is None or lng is None:
        return JsonResponse({"error": "Missing required GPS or Email data"}, status=400)

    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return JsonResponse({"error": "latitude and longitude must be numeric"}, status=400)

    amb = _resolve_ambulance(amb_id)
    if not amb:
        return JsonResponse({"error": "Ambulance not found"}, status=404)
    
    amb.latitude  = lat
    amb.longitude = lng
    amb.speed     = str(speed)

    battery_value = None
    if battery is not None:
        try:
            battery_value = max(0, min(100, int(float(battery))))
            amb.battery_percentage = battery_value
        except (TypeError, ValueError):
            battery_value = None

    # ✅ LOW BATTERY EMAIL ALERT LOGIC
    if battery_value is not None and battery_value < 15:
        try:
            send_mail(
                subject=f"🚨 CRITICAL: Low Battery Alert - {amb.ambulance_number}",
                message=f"Ambulance {amb.ambulance_number} (Driver: {amb.driver}) is reporting {battery_value}% battery. Please ensure they have a charger.",
                from_email="vashupanchal.cs@gmail.com",
                recipient_list=["vashupanchal.cs@gmail.com"], # Admin Email
                fail_silently=True,
            )
        except Exception as e:
            print("Email Alert Error:", e)

    active_booking = _get_active_booking_for_ambulance(amb.id)
    
    # Sync Status
    update_fields = ["latitude", "longitude", "speed", "last_updated"]
    if battery_value is not None:
        update_fields.append("battery_percentage")

    if not active_booking and amb.status == "en_route":
        amb.status = "available"
        update_fields.append("status")
    amb.save(update_fields=update_fields)
    
    DriverLocation.objects.create(ambulance=amb, driver_email=email, latitude=lat, longitude=lng, speed=speed)
    
    pending = None
    if active_booking:
        pending = SuggestedRoute.objects.filter(
            ambulance=amb,
            booking_id=active_booking.id,
            status__in=["pending", "accepted"],
        ).order_by("-created_at").first()
    else:
        SuggestedRoute.objects.filter(ambulance=amb, status__in=["pending", "accepted"]).update(status="rejected")
    
    return JsonResponse({"status": "ok", "battery": amb.battery_percentage, "pending_route": _route_dict(pending)})


@csrf_exempt
def all_live_locations(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    
    ambulances = Ambulance.objects.exclude(latitude=None).exclude(longitude=None)
    result = []
    for a in ambulances:
        active_booking = _get_active_booking_for_ambulance(a.id)
        active = None
        effective_status = a.status
        
        if active_booking:
            active = SuggestedRoute.objects.filter(
                ambulance=a,
                booking_id=active_booking.id,
                status__in=["pending", "accepted"],
            ).order_by("-created_at").first()
        elif effective_status == "en_route":
            effective_status = "available"
            
        result.append({
            "ambulance_id":     a.id,
            "ambulance_number": a.ambulance_number,
            "driver":           a.driver,
            "driver_email":     a.driver_email or "",
            "status":           effective_status,
            "latitude":         a.latitude,
            "longitude":        a.longitude,
            "speed":            a.speed,
            "battery":          a.battery_percentage, # ✅ ADDED TO ADMIN LIST
            "last_updated":     a.last_updated.isoformat(),
            "active_route":     _route_dict(active),
        })
    return JsonResponse(result, safe=False)


@csrf_exempt
def suggest_route(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = json.loads(request.body)
    try:
        amb = Ambulance.objects.get(id=data.get("ambulance_id"))
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "Ambulance not found"}, status=404)
    
    active_booking = _get_active_booking_for_ambulance(amb.id)
    requested_booking_id = data.get("booking_id")
    
    if requested_booking_id:
        try: requested_booking_id = int(requested_booking_id)
        except: return JsonResponse({"error": "Invalid booking_id"}, status=400)
        if not active_booking or active_booking.id != requested_booking_id:
            return JsonResponse({"error": "No active dispatched booking"}, status=400)
    elif not active_booking:
        return JsonResponse({"error": "Route cannot be sent without active booking"}, status=400)

    booking_id = requested_booking_id or active_booking.id
    SuggestedRoute.objects.filter(ambulance=amb, status="pending").update(status="rejected")
    
    route = SuggestedRoute.objects.create(
        ambulance=amb,
        booking_id=booking_id,
        pickup_location=data.get("pickup_location", ""),
        destination=data.get("destination", ""),
        polyline=data.get("polyline", ""),
        distance_km=data.get("distance_km", ""),
        duration=data.get("duration", ""),
        status="pending",
        pickup_lat=data.get("pickup_lat"),
        pickup_lng=data.get("pickup_lng"),
        dest_lat=data.get("dest_lat"),
        dest_lng=data.get("dest_lng"),
    )
    return JsonResponse(_route_dict(route), status=201)


@csrf_exempt
def respond_route(request, route_id):
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH only"}, status=405)
    try:
        route = SuggestedRoute.objects.get(id=route_id)
    except SuggestedRoute.DoesNotExist:
        return JsonResponse({"error": "Route not found"}, status=404)
    
    data = json.loads(request.body)
    newstatus = data.get("status")
    if newstatus not in {"accepted", "rejected", "completed"}:
        return JsonResponse({"error": "Invalid status"}, status=400)
    
    route.status = newstatus
    if newstatus == "accepted":
        route.accepted_at = timezone.now()
    elif newstatus == "rejected":
        route.ambulance.status = "available"
        route.ambulance.save(update_fields=["status"])
        if route.booking_id:
            try:
                from bookings.models import Booking
                booking = Booking.objects.get(id=route.booking_id)
                booking.sent_to_driver = False
                booking.driver_rejected_once = True
                booking.save()
            except: pass
    elif newstatus == "completed":
        route.completed_at = timezone.now()
        route.ambulance.status = "available"
        route.ambulance.save(update_fields=["status"])
        if route.booking_id:
            try:
                from bookings.models import Booking
                booking = Booking.objects.get(id=route.booking_id)
                booking.status = "completed"
                booking.driver_task_completed = True
                booking.save()
            except: pass
            
    route.save()
    return JsonResponse(_route_dict(route))


@csrf_exempt
def driver_active_route(request):
    if request.method != "GET":
        return JsonResponse({"error": "GET only"}, status=405)
    email = request.GET.get("driver_email", "")
    if not email:
        return JsonResponse({"error": "driver_email required"}, status=400)
    try:
        amb = Ambulance.objects.get(driver_email=email)
    except Ambulance.DoesNotExist:
        return JsonResponse({"error": "No ambulance found"}, status=404)
    
    active_booking = _get_active_booking_for_ambulance(amb.id)
    if not active_booking:
        return JsonResponse({})
    
    route = SuggestedRoute.objects.filter(
        ambulance=amb,
        booking_id=active_booking.id,
        status__in=["pending", "accepted"],
    ).order_by("-created_at").first()
    return JsonResponse(_route_dict(route) if route else {})


@csrf_exempt
def get_traffic_route(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    data = json.loads(request.body)
    api_key = data.get("api_key", "")
    origin = f"{data['origin_lat']},{data['origin_lng']}"
    pickup = f"{data['pickup_lat']},{data['pickup_lng']}"
    destination = f"{data['dest_lat']},{data['dest_lng']}"
    
    params = {
        "origin": origin,
        "destination": destination,
        "waypoints": f"optimize:false|{pickup}",
        "mode": "driving",
        "key": api_key,
    }
    url = "https://maps.googleapis.com/maps/api/directions/json?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            result = json.loads(resp.read())
            routes = []
            for r in result["routes"]:
                total_dist = sum(leg["distance"]["value"] for leg in r["legs"])
                total_dur = sum(leg["duration"]["value"] for leg in r["legs"])
                routes.append({
                    "polyline": r["overview_polyline"]["points"],
                    "distance_km": f"{total_dist / 1000:.1f} km",
                    "duration": f"{total_dur // 60} min",
                    "duration_sec": total_dur,
                })
            routes.sort(key=lambda x: x["duration_sec"])
            return JsonResponse({"routes": routes, "best": routes[0]})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=502)
