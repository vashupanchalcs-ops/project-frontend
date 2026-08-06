from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0004_booking_pickup_parts_and_contact"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="driver_rejected_once",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="driver_rejected_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="driver_rejection_reason",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="booking",
            name="reassigned_due_to_unavailability",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="reassigned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

