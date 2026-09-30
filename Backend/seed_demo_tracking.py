import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ambulance_tracker.settings")
django.setup()

from hospitals.models import Hospital
from ambulance.models import Ambulance
from bookings.models import Booking
from tracking.service import create_tracking_session

print("Seeding initial hospitals, ambulances, and tracking session...")

# 1. Hospitals
aiims, _ = Hospital.objects.get_or_create(
    name="AIIMS New Delhi",
    defaults={
        "address": "Ansari Nagar, New Delhi",
        "latitude": "28.5672",
        "longitude": "77.2100",
        "contact_number": "+91 11 2658 8500",
        "email": "aiims@aarogya.in",
        "hospital_type": "government",
        "status": "active",
        "is_active": True,
        "total_beds": 200,
        "available_beds": 35,
        "icu_beds": 12,
        "emergency_services": True,
    }
)

safdarjung, _ = Hospital.objects.get_or_create(
    name="Safdarjung Hospital",
    defaults={
        "address": "Ring Road, Opposite AIIMS, New Delhi",
        "latitude": "28.5700",
        "longitude": "77.2070",
        "contact_number": "+91 11 2616 5060",
        "email": "safdarjung@aarogya.in",
        "hospital_type": "government",
        "status": "active",
        "is_active": True,
        "total_beds": 150,
        "available_beds": 20,
        "icu_beds": 8,
        "emergency_services": True,
    }
)

# 2. Ambulances
amb1, _ = Ambulance.objects.get_or_create(
    ambulance_number="DL-01-AMB-101",
    defaults={
        "driver": "Ramesh Sharma",
        "driver_contact": "+91 98765 43210",
        "driver_email": "driver@aarogya.in",
        "model": "Force Traveller ALS",
        "status": "busy",
        "latitude": 28.5950,
        "longitude": 77.2250,
        "battery_percentage": 95,
        "nearest_hospital": aiims.name,
    }
)

amb2, _ = Ambulance.objects.get_or_create(
    ambulance_number="DL-02-AMB-202",
    defaults={
        "driver": "Sunil Verma",
        "driver_contact": "+91 98765 43211",
        "driver_email": "sunil@aarogya.in",
        "model": "Tata Winger BLS",
        "status": "available",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "battery_percentage": 88,
        "nearest_hospital": safdarjung.name,
    }
)

# 3. Active Booking
booking, _ = Booking.objects.get_or_create(
    id=1,
    defaults={
        "ambulance_id": amb1.id,
        "ambulance_number": amb1.ambulance_number,
        "driver": amb1.driver,
        "driver_contact": amb1.driver_contact,
        "booked_by": "Rahul Sharma",
        "booked_by_email": "patient@aarogya.in",
        "pickup_location": "Connaught Place, New Delhi",
        "pickup_latitude": 28.6315,
        "pickup_longitude": 77.2167,
        "pickup_city": "New Delhi",
        "destination": aiims.name,
        "assigned_hospital_id": aiims.id,
        "assigned_hospital_name": aiims.name,
        "assigned_hospital_address": aiims.address,
        "status": "confirmed",
        "sent_to_driver": True,
        "driver_task_completed": False,
        "patient_name": "Rahul Sharma",
        "patient_condition": "High fever and difficulty breathing",
    }
)

# 4. Create / Initialize TrackingSession
create_tracking_session(booking)

print(f"✅ Demo Data seeded successfully!")
print(f"Hospital: {aiims.name} (ID: {aiims.id})")
print(f"Ambulance: {amb1.ambulance_number} (ID: {amb1.id})")
print(f"Booking: #{booking.id} - Status: {booking.status}")
