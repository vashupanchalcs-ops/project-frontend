from django.contrib import admin
from .models import TrackingSession, RouteVersion


@admin.register(TrackingSession)
class TrackingSessionAdmin(admin.ModelAdmin):
    list_display = ("booking_id", "ambulance_id", "current_phase", "is_active", "created_at", "updated_at")
    list_filter = ("current_phase", "is_active")
    search_fields = ("booking_id", "ambulance_id")


@admin.register(RouteVersion)
class RouteVersionAdmin(admin.ModelAdmin):
    list_display = ("route_id", "booking_id", "phase", "version", "provider", "distance_m", "duration_s", "is_active", "created_at")
    list_filter = ("phase", "provider", "is_active")
    search_fields = ("booking_id", "route_id")
