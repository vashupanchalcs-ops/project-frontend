from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ambulance", "0009_ambulance_battery_percentage"),
    ]

    operations = [
        migrations.AddField(
            model_name="ambulance",
            name="registration_number",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]
