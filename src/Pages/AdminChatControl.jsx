import { useEffect, useMemo, useState } from "react";
import BookingChatPanel from "../Components/BookingChatPanel";

const BASE = "http://127.0.0.1:8000";

export default function AdminChatControl() {
  const removedKey = "sr_removed_admin_chat_threads";
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadThreads = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`${BASE}/api/bookings/chat/threads/?role=admin`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      let removed = [];
      try {
        removed = JSON.parse(localStorage.getItem(removedKey) || "[]");
      } catch {
        removed = [];
      }
      const removedSet = new Set(removed.map((id) => Number(id)));
      const filtered = rows.filter((t) => !removedSet.has(Number(t.id)));
      setThreads((prev) => {
        const a = JSON.stringify((prev || []).map((t) => [t.id, t.unread?.admin || 0, t.booking?.status]));
        const b = JSON.stringify((filtered || []).map((t) => [t.id, t.unread?.admin || 0, t.booking?.status]));
        return a === b ? prev : filtered;
      });
      if (!selectedId && filtered[0]?.id) setSelectedId(filtered[0].id);
      if (selectedId && !filtered.some((t) => t.id === selectedId)) {
        setSelectedId(filtered[0]?.id || null);
      }
    } catch {}
    finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads({ silent: false });
    const t = setInterval(() => {
      if (document.visibilityState === "visible") loadThreads({ silent: true });
    }, 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest(".acc-menu-wrap")) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = useMemo(
    () => threads.find((t) => t.id === selectedId) || threads[0] || null,
    [threads, selectedId]
  );
  const isCompleted = (t) => String(t?.booking?.status || "").toLowerCase() === "completed";

  const removeThread = async (threadId) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    const ok = window.confirm(`Remove chat for Booking #${thread.booking_id}?`);
    if (!ok) return;
    if (isCompleted(thread)) {
      try {
        await fetch(`${BASE}/api/bookings/chat/threads/${threadId}/messages/`, { method: "DELETE" });
      } catch {}
    }
    try {
      const prev = JSON.parse(localStorage.getItem(removedKey) || "[]");
      const next = Array.from(new Set([...(Array.isArray(prev) ? prev : []), Number(threadId)]));
      localStorage.setItem(removedKey, JSON.stringify(next));
    } catch {}
    const remain = threads.filter((t) => t.id !== threadId);
    setThreads(remain);
    if (selectedId === threadId) setSelectedId(remain[0]?.id || null);
    setMenuOpenId(null);
  };

  const quickSend = async (text) => {
    if (!selected?.id) return;
    await fetch(`${BASE}/api/bookings/chat/threads/${selected.id}/messages/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_role: "admin",
        sender_name: localStorage.getItem("name") || "Admin",
        message_type: "update",
        message: text,
        target_role: "user",
      }),
    });
    loadThreads();
  };

  return (
    <div style={{ paddingLeft: isMobile ? 0 : 64, paddingTop: 64, height: "100vh", background: "#f7f7f2", overflow: "hidden" }}>
      <div
        style={{
          maxWidth: 1520,
          margin: "0 auto",
          padding: isMobile ? "12px 10px 84px" : 20,
          height: "calc(100vh - 64px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? 24 : 34 }}>AI Chat Control Center</h1>
        <p style={{ margin: "0 0 12px", color: "#555", fontSize: isMobile ? 14 : 16 }}>
          Booking-wise user cards. Select any card to control chatbot updates professionally.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "380px 1fr 280px",
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              border: "1px solid rgba(20,20,20,.14)",
              borderRadius: 14,
              background: "#fff",
              padding: 10,
              maxHeight: isMobile ? 220 : "100%",
              overflow: "auto",
            }}
          >
            {loading && <div style={{ fontSize: 13, color: "#666" }}>Loading...</div>}
            {!loading && threads.length === 0 && <div style={{ fontSize: 13, color: "#666" }}>No booking chat threads.</div>}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid rgba(20,20,20,.14)",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 8,
                  background: selectedId === t.id ? "#e50914" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <b>Booking #{t.booking_id}</b>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11 }}>Unread: {t.unread?.admin || 0}</span>
                    <div className="acc-menu-wrap" style={{ position: "relative" }}>
                      <button
                        title="More"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId((prev) => (prev === t.id ? null : t.id));
                        }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          border: "1px solid rgba(20,20,20,0.2)",
                          background: "#fff",
                          fontSize: 18,
                          lineHeight: 1,
                          cursor: "pointer",
                        }}
                      >
                        ⋮
                      </button>
                      {menuOpenId === t.id && (
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 30,
                            minWidth: 130,
                            background: "#fff",
                            border: "1px solid rgba(20,20,20,0.18)",
                            borderRadius: 10,
                            boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
                            padding: 6,
                            zIndex: 4,
                          }}
                        >
                          <button
                            onClick={() => removeThread(t.id)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: "none",
                              background: "transparent",
                              padding: "8px 10px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#b42318",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  User: {t.user_name || "-"} · Driver: {t.driver_name || "-"}
                </div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                  {t.booking?.pickup_location || "-"} → {t.booking?.assigned_hospital_name || t.booking?.destination || "hospital pending"}
                </div>
              </button>
            ))}
          </div>

          <div style={{ minHeight: 0, height: "100%" }}>
            <BookingChatPanel
              role="admin"
              thread={selected}
              compact
              messageTarget="all"
              visibleTargets={["all", "user", "admin", "driver"]}
              allowedSenderRoles={["system", "admin", "user", "driver"]}
              title={selected ? `Booking #${selected.booking_id} · Admin Control Chat` : "Select booking card"}
              onMessagesChange={setChatMessages}
              extraActions={
                <div style={{ display: "flex", gap: 8, width: "100%", flexWrap: "wrap" }}>
                  <button className="chat-btn" onClick={() => quickSend("Update: Ambulance dispatched and route monitoring active.")}>
                    Dispatch Update
                  </button>
                  <button className="chat-btn" onClick={() => quickSend("Update: Hospital readiness confirmed. Please stay prepared.")}>
                    Hospital Ready Update
                  </button>
                  <button className="chat-btn" onClick={() => quickSend("Update: Driver escalation received. Alternate route/ambulance management in progress.")}>
                    Escalation Update
                  </button>
                </div>
              }
            />
          </div>
          {!isMobile ? (
            <div
              style={{
                border: "1px solid rgba(20,20,20,.14)",
                borderRadius: 14,
                background: "#fff",
                padding: 10,
                overflow: "auto",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Notifications</div>
              {chatMessages.slice(-10).reverse().map((m) => (
                <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m.sender_name || m.sender_role}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{String(m.message || "").slice(0, 80)}</div>
                </div>
              ))}
              {chatMessages.length === 0 ? <div style={{ fontSize: 12, color: "#777" }}>No updates yet.</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
