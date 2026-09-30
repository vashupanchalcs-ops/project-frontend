"""
tracking/models.py
------------------
TrackingSession  — one per active booking (ambulance assigned → booking done)
RouteVersion     — versioned route per (booking, phase); prevents stale overwrites
"""
import uuid
from django.db import models


class TrackingSession(models.Model):
    PHASE_CHOICES = [
        ("TO_PATIENT",  "En Route to Patient"),
        ("TO_HOSPITAL", "En Route to Hospital"),
        ("COMPLETED",   "Completed"),
    ]

    booking_id    = models.IntegerField(unique=True, db_index=True)
    ambulance_id  = models.IntegerField(db_index=True)

    patient_lat   = models.FloatField(null=True, blank=True)
    patient_lng   = models.FloatField(null=True, blank=True)
    hospital_id   = models.IntegerField(null=True, blank=True)
    hospital_lat  = models.FloatField(null=True, blank=True)
    hospital_lng  = models.FloatField(null=True, blank=True)

    current_phase = models.CharField(
        max_length=20, choices=PHASE_CHOICES, default="TO_PATIENT"
    )
    is_active     = models.BooleanField(default=True, db_index=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Session booking={self.booking_id} phase={self.current_phase}"


class RouteVersion(models.Model):
    PHASE_CHOICES = TrackingSession.PHASE_CHOICES

    route_id           = models.UUIDField(
        default=uuid.uuid4, unique=True, db_index=True
    )
    booking_id         = models.IntegerField(db_index=True)
    phase              = models.CharField(max_length=20, choices=PHASE_CHOICES)
    version            = models.PositiveIntegerField(default=1)

    origin_lat         = models.FloatField()
    origin_lng         = models.FloatField()
    destination_lat    = models.FloatField()
    destination_lng    = models.FloatField()

    # Normalized route payload
    distance_m         = models.IntegerField(default=0)
    duration_s         = models.IntegerField(default=0)
    traffic_duration_s = models.IntegerField(default=0)
    # Google encoded polyline OR JSON-stringified GeoJSON for fallback providers
    polyline           = models.TextField(blank=True)
    provider           = models.CharField(max_length=30, blank=True)

    is_active          = models.BooleanField(default=True, db_index=True)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]
        unique_together = [("booking_id", "phase", "version")]

    def __str__(self):
        return f"Route booking={self.booking_id} {self.phase} v{self.version}"
