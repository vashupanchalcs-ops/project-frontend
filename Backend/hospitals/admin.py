from django.contrib import admin
from .models import Hospital, HospitalStaff


class HospitalStaffInline(admin.TabularInline):
    model = HospitalStaff
    extra = 0
    fields = ["full_name", "role", "specialization", "contact_number", "years_experience", "is_on_call", "is_active"]
    show_change_link = True


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = [
        "id", "hospital_contract_id", "name", "registration_number", "email", "contact_number",
        "available_beds", "icu_beds", "available_ventilators", "status", "is_active",
    ]
    search_fields = ["hospital_contract_id", "name", "registration_number", "email", "contact_number"]
    list_filter = ["status", "is_active", "hospital_type", "emergency_services"]
    list_editable = ["available_beds", "icu_beds", "available_ventilators", "status", "is_active"]
    inlines = [HospitalStaffInline]
    fieldsets = (
        ("Identity & Contract", {"fields": ("hospital_contract_id", "name", "registration_number", "hospital_type", "status", "is_active")} ),
        ("Contact & Location", {"fields": ("address", "latitude", "longitude", "contact_number", "email")} ),
        ("Capacity & Equipment", {"fields": ("total_beds", "available_beds", "icu_beds", "total_ventilators", "available_ventilators")} ),
        ("Services", {"fields": ("specializations", "facilities", "emergency_services")} ),
    )


@admin.register(HospitalStaff)
class HospitalStaffAdmin(admin.ModelAdmin):
    list_display = ["id", "hospital", "full_name", "role", "specialization", "years_experience", "is_on_call", "is_active"]
    search_fields = ["full_name", "email", "contact_number", "specialization", "hospital__name"]
    list_filter = ["hospital", "role", "is_on_call", "is_active"]
    list_editable = ["is_on_call", "is_active"]
    autocomplete_fields = ["hospital"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        ("Staff Profile", {"fields": ("hospital", "full_name", "role", "specialization", "years_experience")} ),
        ("Contact & Availability", {"fields": ("contact_number", "email", "is_on_call", "is_active")} ),
        ("Profile Media", {"fields": ("photo_data", "banner_data")} ),
        ("Audit", {"fields": ("created_at", "updated_at")} ),
    )
