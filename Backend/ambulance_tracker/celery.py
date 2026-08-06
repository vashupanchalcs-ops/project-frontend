import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ambulance_tracker.settings")

app = Celery("ambulance_tracker")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

