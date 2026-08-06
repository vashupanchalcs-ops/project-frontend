try:
    from .celery import app as celery_app
except Exception:  # Keep Django importable even when Celery isn't ready locally.
    celery_app = None

__all__ = ("celery_app",)
