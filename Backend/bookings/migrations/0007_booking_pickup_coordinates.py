from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0006_bookingchatthread_bookingchatmessage"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="pickup_latitude",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="pickup_longitude",
            field=models.FloatField(blank=True, null=True),
        ),
    ]

