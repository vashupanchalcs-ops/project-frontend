import json
import os
import urllib.request
import urllib.error


def _local_fallback(prompt: str, role: str = "user") -> str:
    p = (prompt or "").lower()
    if "eta" in p or "time" in p:
        return "Live route monitoring is active. The updated ETA will be shared shortly from the dispatch control panel."
    if "hospital" in p:
        return "Assigned hospital readiness is being verified. A confirmed update will be sent by the admin control desk."
    if "cancel" in p or "reject" in p or "unable" in p:
        return "Request received. The escalation has been sent to admin control and an alternate plan is now in progress."
    if role == "driver":
        return "Driver support is active. Route and hospital coordination is being handled by the admin control team."
    return "SwiftRescue AI update: request received. The dispatch team is verifying live status and will respond shortly."


def _post_json(url: str, payload: dict, headers=None, timeout: int = 8):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def generate_ai_response(prompt: str, role: str = "user") -> str:
    """
    AI_PROVIDER:
      - openai
      - dialogflow
      - rasa
      - local (default)
    """
    provider = os.getenv("AI_PROVIDER", "local").strip().lower()

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
        if api_key:
            try:
                system = (
                    "You are SwiftRescue voice/chat dispatch assistant. "
                    "Reply in concise, professional English. "
                    "Give operational updates, ETA guidance, safety reminders. "
                    "Never provide medical diagnosis."
                )
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": f"role={role}\nquery={prompt}"},
                    ],
                    "temperature": 0.3,
                }
                data = _post_json(
                    "https://api.openai.com/v1/chat/completions",
                    payload,
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=10,
                )
                text = (
                    data.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                    .strip()
                )
                if text:
                    return text
            except Exception:
                pass

    if provider == "dialogflow":
        # Lightweight webhook style adapter (service endpoint should proxy Dialogflow result)
        url = os.getenv("DIALOGFLOW_WEBHOOK_URL", "").strip()
        token = os.getenv("DIALOGFLOW_TOKEN", "").strip()
        if url:
            try:
                data = _post_json(url, {"query": prompt, "role": role}, headers={"Authorization": f"Bearer {token}"} if token else {})
                text = (
                    data.get("reply")
                    or data.get("fulfillmentText")
                    or data.get("text")
                    or ""
                )
                if text:
                    return text
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
                pass

    if provider == "rasa":
        # Expected Rasa REST webhook endpoint (e.g. http://localhost:5005/webhooks/rest/webhook)
        url = os.getenv("RASA_REST_URL", "").strip()
        if url:
            try:
                data = _post_json(url, {"sender": f"swiftrescue-{role}", "message": prompt})
                if isinstance(data, list) and data:
                    text = data[0].get("text") or ""
                    if text:
                        return text
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
                pass

    return _local_fallback(prompt, role)
