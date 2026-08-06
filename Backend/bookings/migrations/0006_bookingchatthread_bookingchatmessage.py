from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0005_booking_driver_reject_and_reassign_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="BookingChatThread",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("user_email", models.CharField(blank=True, default="", max_length=120)),
                ("user_name", models.CharField(blank=True, default="", max_length=120)),
                ("driver_email", models.CharField(blank=True, default="", max_length=120)),
                ("driver_name", models.CharField(blank=True, default="", max_length=120)),
                ("admin_email", models.CharField(blank=True, default="vashupanchal.cs@gmail.com", max_length=120)),
                ("is_active", models.BooleanField(default=True)),
                ("user_online", models.BooleanField(default=False)),
                ("driver_online", models.BooleanField(default=False)),
                ("admin_online", models.BooleanField(default=False)),
                ("user_typing", models.BooleanField(default=False)),
                ("driver_typing", models.BooleanField(default=False)),
                ("admin_typing", models.BooleanField(default=False)),
                ("user_last_seen_at", models.DateTimeField(blank=True, null=True)),
                ("driver_last_seen_at", models.DateTimeField(blank=True, null=True)),
                ("admin_last_seen_at", models.DateTimeField(blank=True, null=True)),
                ("last_message_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("booking", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="chat_thread", to="bookings.booking")),
            ],
        ),
        migrations.CreateModel(
            name="BookingChatMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sender_role", models.CharField(choices=[("system", "System"), ("admin", "Admin"), ("driver", "Driver"), ("user", "User")], default="system", max_length=20)),
                ("sender_name", models.CharField(blank=True, default="", max_length=120)),
                ("message_type", models.CharField(choices=[("text", "Text"), ("update", "Update"), ("request", "Request"), ("alert", "Alert")], default="text", max_length=20)),
                ("message", models.TextField(blank=True, default="")),
                ("metadata", models.TextField(blank=True, default="")),
                ("seen_by_user", models.BooleanField(default=False)),
                ("seen_by_driver", models.BooleanField(default=False)),
                ("seen_by_admin", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("thread", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="bookings.bookingchatthread")),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
    ]
