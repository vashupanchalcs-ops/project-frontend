from rest_framework import serializers

from .models import Ambulance


class AmbulanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ambulance
        fields = [
            "id",
            "ambulance_contract_id",
            "ambulance_number",
            "registration_number",
            "driver",
            "driver_contact",
            "driver_email",
            "model",
            "speed",
            "status",
            "location",
            "nearest_hospital",
            "hospital_distance",
            "eta_to_patient",
            "eta_to_hospital",
            "latitude",
            "longitude",
            "battery_percentage",
            "last_updated",
        ]
