from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0007_booking_pickup_coordinates"),
    ]

    operations = [
        migrations.CreateModel(
            name="VoiceBookingCall",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("call_sid", models.CharField(db_index=True, max_length=120, unique=True)),
                ("from_number", models.CharField(blank=True, default="", max_length=30)),
                (
                    "call_status",
                    models.CharField(
                        choices=[
                            ("ringing", "Ringing"),
                            ("in_progress", "In Progress"),
                            ("confirmed", "Confirmed"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                            ("ended", "Ended"),
                        ],
                        default="ringing",
                        max_length=20,
                    ),
                ),
                ("current_step", models.CharField(blank=True, default="name", max_length=30)),
                ("caller_name", models.CharField(blank=True, default="", max_length=120)),
                ("city", models.CharField(blank=True, default="", max_length=120)),
                ("district", models.CharField(blank=True, default="", max_length=120)),
                ("landmark", models.CharField(blank=True, default="", max_length=180)),
                ("attempts", models.IntegerField(default=0)),
                ("is_confirmed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                (
                    "booking",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="voice_calls",
                        to="bookings.booking",
                    ),
                ),
            ],
        ),
    ]
