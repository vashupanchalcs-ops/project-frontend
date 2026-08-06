from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0008_voicebookingcall"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="driver_voice_transcript",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="booking",
            name="driver_modified_report",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="booking",
            name="driver_report_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

