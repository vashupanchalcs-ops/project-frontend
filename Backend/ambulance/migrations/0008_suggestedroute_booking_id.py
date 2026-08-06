from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ambulance", "0007_suggestedroute_dest_lat_suggestedroute_dest_lng_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="suggestedroute",
            name="booking_id",
            field=models.IntegerField(blank=True, db_index=True, null=True),
        ),
    ]
