import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from bookings.models import BookingChatThread, BookingChatMessage
from bookings.ai_engine import generate_ai_response
from bookings.tasks import generate_ai_reply_task


def _safe_json_load(raw):
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def _target_role_from_metadata(raw):
    meta = _safe_json_load(raw)
    target = str(meta.get("target_role", "all") or "all").strip().lower()
    return target if target in {"all", "admin", "driver", "user"} else "all"


class BookingChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.thread_id = int(self.scope["url_route"]["kwargs"]["thread_id"])
        self.group_name = f"booking_chat_{self.thread_id}"
        qs = self.scope.get("query_string", b"").decode("utf-8")
        q = dict([part.split("=", 1) for part in qs.split("&") if "=" in part])
        self.role = (q.get("role", "user") or "user").lower()
        self.sender_name = (q.get("name", "") or self.role.title()).replace("+", " ")

        ok = await self._ensure_thread_exists()
        if not ok:
            await self.close(code=4404)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self._set_presence(online=True, typing=False)
        await self._push_presence()

        history = await self._get_messages()
        await self.send(text_data=json.dumps({"type": "history", "messages": history}))

    async def disconnect(self, code):
        try:
            await self._set_presence(online=False, typing=False)
            await self._push_presence()
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        except Exception:
            pass

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        event = data.get("type")
        if event == "typing":
            await self._set_presence(typing=bool(data.get("typing")))
            await self._push_presence()
            return

        if event == "read":
            await self._mark_read()
            await self._push_presence()
            return

        if event != "message":
            return

        message = str(data.get("message", "")).strip()
        msg_type = str(data.get("message_type", "text")).strip().lower()
        if not message:
            return
        if msg_type not in {"text", "update", "request", "alert"}:
            msg_type = "text"

        msg = await self._create_message(
            sender_role=self.role,
            sender_name=self.sender_name,
            message_type=msg_type,
            message=message,
            metadata=data.get("metadata"),
            target_role=str(data.get("target_role", "all") or "all").strip().lower(),
        )
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat.message", "message": msg},
        )

        # Agentic AI response for user/driver messages
        if self.role in {"user", "driver"}:
            if os.getenv("USE_CELERY_AI", "0") == "1":
                await database_sync_to_async(generate_ai_reply_task.delay)(
                    self.thread_id, message, self.role
                )
            else:
                ai_text = await database_sync_to_async(generate_ai_response)(message, self.role)
                ai_msg = await self._create_message(
                    sender_role="system",
                    sender_name="SwiftRescue AI",
                    message_type="update",
                    message=ai_text,
                    metadata={"auto": True},
                    target_role=self.role,
                )
                await self.channel_layer.group_send(
                    self.group_name,
                    {"type": "chat.message", "message": ai_msg},
                )

    async def chat_message(self, event):
        message = event["message"]
        target = message.get("target_role", "all")
        if target in {"all", self.role} or message.get("sender_role") == self.role:
            await self.send(text_data=json.dumps({"type": "message", "message": message}))

    async def chat_presence(self, event):
        await self.send(text_data=json.dumps({"type": "presence", "presence": event["presence"]}))

    async def _push_presence(self):
        presence = await self._get_presence()
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat.presence", "presence": presence},
        )

    @database_sync_to_async
    def _ensure_thread_exists(self):
        return BookingChatThread.objects.filter(id=self.thread_id).exists()

    @database_sync_to_async
    def _set_presence(self, online=None, typing=None):
        t = BookingChatThread.objects.filter(id=self.thread_id).first()
        if not t:
            return
        now = timezone.now()
        updates = ["updated_at"]
        if self.role == "admin":
            if online is not None:
                t.admin_online = bool(online)
                t.admin_last_seen_at = now
                updates += ["admin_online", "admin_last_seen_at"]
            if typing is not None:
                t.admin_typing = bool(typing)
                updates.append("admin_typing")
        elif self.role == "driver":
            if online is not None:
                t.driver_online = bool(online)
                t.driver_last_seen_at = now
                updates += ["driver_online", "driver_last_seen_at"]
            if typing is not None:
                t.driver_typing = bool(typing)
                updates.append("driver_typing")
        else:
            if online is not None:
                t.user_online = bool(online)
                t.user_last_seen_at = now
                updates += ["user_online", "user_last_seen_at"]
            if typing is not None:
                t.user_typing = bool(typing)
                updates.append("user_typing")
        t.save(update_fields=list(dict.fromkeys(updates)))

    @database_sync_to_async
    def _get_presence(self):
        t = BookingChatThread.objects.filter(id=self.thread_id).first()
        if not t:
            return {}
        return {
            "user_online": t.user_online,
            "driver_online": t.driver_online,
            "admin_online": t.admin_online,
            "user_typing": t.user_typing,
            "driver_typing": t.driver_typing,
            "admin_typing": t.admin_typing,
        }

    @database_sync_to_async
    def _mark_read(self):
        t = BookingChatThread.objects.filter(id=self.thread_id).first()
        if not t:
            return
        visible = []
        for m in t.messages.all():
            target = _target_role_from_metadata(m.metadata)
            if target in {"all", self.role} or m.sender_role == self.role:
                if m.sender_role != self.role:
                    visible.append(m.id)
        if self.role == "admin" and visible:
            t.messages.filter(id__in=visible).update(seen_by_admin=True)
        elif self.role == "driver" and visible:
            t.messages.filter(id__in=visible).update(seen_by_driver=True)
        elif self.role == "user" and visible:
            t.messages.filter(id__in=visible).update(seen_by_user=True)

    @database_sync_to_async
    def _get_messages(self):
        t = BookingChatThread.objects.filter(id=self.thread_id).first()
        if not t:
            return []
        out = []
        for m in t.messages.order_by("created_at", "id"):
            target = _target_role_from_metadata(m.metadata)
            if target not in {"all", self.role} and m.sender_role != self.role:
                continue
            out.append({
                "id": m.id,
                "thread_id": m.thread_id,
                "sender_role": m.sender_role,
                "sender_name": m.sender_name,
                "message_type": m.message_type,
                "message": m.message,
                "metadata": m.metadata,
                "seen_by_user": m.seen_by_user,
                "seen_by_driver": m.seen_by_driver,
                "seen_by_admin": m.seen_by_admin,
                "target_role": target,
                "created_at": m.created_at.isoformat(),
            })
        return out

    @database_sync_to_async
    def _create_message(self, sender_role, sender_name, message_type, message, metadata=None, target_role="all"):
        t = BookingChatThread.objects.filter(id=self.thread_id).first()
        if not t:
            return {}
        if target_role not in {"all", "admin", "driver", "user"}:
            target_role = "all"
        meta_obj = _safe_json_load(metadata) if isinstance(metadata, (str, dict)) else {}
        meta_obj["target_role"] = target_role
        m = BookingChatMessage.objects.create(
            thread=t,
            sender_role=sender_role,
            sender_name=sender_name,
            message_type=message_type,
            message=message,
            metadata=json.dumps(meta_obj),
        )
        t.last_message_at = timezone.now()
        t.save(update_fields=["last_message_at", "updated_at"])
        return {
            "id": m.id,
            "thread_id": m.thread_id,
            "sender_role": m.sender_role,
            "sender_name": m.sender_name,
            "message_type": m.message_type,
            "message": m.message,
            "metadata": m.metadata,
            "seen_by_user": m.seen_by_user,
            "seen_by_driver": m.seen_by_driver,
            "seen_by_admin": m.seen_by_admin,
            "target_role": target_role,
            "created_at": m.created_at.isoformat(),
        }
