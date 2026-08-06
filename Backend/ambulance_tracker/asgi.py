import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ambulance_tracker.settings')

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

django_asgi_app = get_asgi_application()

# Import websocket routes only after Django app registry is ready.
# If optional realtime dependencies fail locally, keep HTTP/Django admin working.
try:
    from bookings.routing import websocket_urlpatterns
except Exception:
    websocket_urlpatterns = []

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
