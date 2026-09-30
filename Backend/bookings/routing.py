from django.urls import re_path
from bookings.consumers import BookingChatConsumer
from bookings.consultation_consumers import ConsultationConsumer
from tracking.routing import websocket_urlpatterns as tracking_patterns


websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<thread_id>\d+)/$", BookingChatConsumer.as_asgi()),
    re_path(r"ws/consultation/(?P<booking_id>\d+)/$", ConsultationConsumer.as_asgi()),
] + tracking_patterns
