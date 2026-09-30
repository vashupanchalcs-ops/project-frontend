from django.urls import re_path
from .consumers import BookingTrackingConsumer

websocket_urlpatterns = [
    re_path(
        r"^/?ws/bookings/(?P<booking_id>\d+)/tracking/?$",
        BookingTrackingConsumer.as_asgi(),
    ),
]
