from django.contrib import admin
from .models import Hospital, HospitalStaff


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ["id", "hospital_contract_id", "name", "registration_number", "email", "status", "available_beds", "is_active"]
    search_fields = ["hospital_contract_id", "name", "registration_number", "email", "contact_number"]
    list_filter = ["status", "is_active", "hospital_type"]
    fields = [
        "hospital_contract_id",
        "name",
        "registration_number",
        "address",
        "latitude",
        "longitude",
        "contact_number",
        "email",
        "hospital_type",
        "total_beds",
        "available_beds",
        "icu_beds",
        "total_ventilators",
        "available_ventilators",
        "specializations",
        "facilities",
        "emergency_services",
        "status",
        "is_active",
    ]


@admin.register(HospitalStaff)
class HospitalStaffAdmin(admin.ModelAdmin):
    list_display = ["id", "hospital", "full_name", "role", "is_on_call", "is_active"]
    search_fields = ["full_name", "email", "contact_number", "specialization", "hospital__name"]
    list_filter = ["role", "is_on_call", "is_active"]
