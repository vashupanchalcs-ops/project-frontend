from django.urls import re_path
from bookings.consumers import BookingChatConsumer


websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<thread_id>\d+)/$", BookingChatConsumer.as_asgi()),
]

