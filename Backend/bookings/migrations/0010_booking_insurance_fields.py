from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0009_booking_driver_voice_report_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="insurance_dob",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_emergency_nature",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_exclusions_waiting",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_full_name",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_gender",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_government_id",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_hospital_note",
            field=models.CharField(blank=True, default="", max_length=300),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_policy_holder_name",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_policy_member_id",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_provider",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_reviewed_by",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_status",
            field=models.CharField(blank=True, default="pending", max_length=20),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_submitted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_submitted_by",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AddField(
            model_name="booking",
            name="insurance_sum_insured",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]

