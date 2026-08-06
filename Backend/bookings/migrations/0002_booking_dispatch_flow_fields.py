from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="sent_to_driver",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="sent_to_driver_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="driver_task_completed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="driver_task_completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
