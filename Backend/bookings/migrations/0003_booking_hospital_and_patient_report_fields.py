from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0002_booking_dispatch_flow_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="assigned_hospital_address",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.AddField(
            model_name="booking",
            name="assigned_hospital_contact",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="booking",
            name="assigned_hospital_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="booking",
            name="assigned_hospital_id",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="assigned_hospital_name",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="booking",
            name="attendant_contact",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="booking",
            name="attendant_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="hospital_alert_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="hospital_alert_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="hospital_assigned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="hospital_responded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="hospital_response",
            field=models.CharField(blank=True, default="pending", max_length=20),
        ),
        migrations.AddField(
            model_name="booking",
            name="hospital_response_note",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.AddField(
            model_name="booking",
            name="patient_age",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="booking",
            name="patient_condition",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="booking",
            name="patient_gender",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="booking",
            name="patient_name",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="report_sent_to_hospital",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="report_sent_to_hospital_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="report_submitted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="report_submitted_by",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="vitals_summary",
            field=models.TextField(blank=True, default=""),
        ),
    ]
