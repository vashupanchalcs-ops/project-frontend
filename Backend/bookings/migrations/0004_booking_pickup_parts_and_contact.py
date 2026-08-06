from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0003_booking_hospital_and_patient_report_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="patient_contact_number",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="booking",
            name="pickup_city",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="pickup_district",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="pickup_landmark",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
    ]
