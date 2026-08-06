import { useEffect, useState } from "react";
import BookingChatPanel from "../components/BookingChatPanel";

const BASE = "http://127.0.0.1:8000";

export default function DriverRequestChat() {
  const email = localStorage.getItem("user") || "";
  const name = localStorage.getItem("name") || "";
  const removedKey = `sr_removed_driver_request_threads_${email || "driver"}`;
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [issueType, setIssueType] = useState("pickup_unreachable");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const load = async () => {
    try {
      const res = await fetch(
        `${BASE}/api/bookings/chat/threads/?role=driver&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`
      );
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
      setThreads(filtered);
      if (!selectedId && filtered[0]?.id) setSelectedId(filtered[0].id);
      if (selectedId && !filtered.some((t) => t.id === selectedId)) {
        setSelectedId(filtered[0]?.id || null);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, name]);

  const selected = threads.find((t) => t.id === selectedId) || threads[0] || null;
  const isCompleted = (t) => String(t?.booking?.status || "").toLowerCase() === "completed";

  const removeThread = async (threadId) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread || !isCompleted(thread)) return;
    const ok = window.confirm(`Remove completed chat for Booking #${thread.booking_id}?`);
    if (!ok) return;
    try {
      await fetch(`${BASE}/api/bookings/chat/threads/${threadId}/messages/`, { method: "DELETE" });
    } catch {}
    try {
      const prev = JSON.parse(localStorage.getItem(removedKey) || "[]");
      const next = Array.from(new Set([...(Array.isArray(prev) ? prev : []), Number(threadId)]));
      localStorage.setItem(removedKey, JSON.stringify(next));
    } catch {}
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    setSelectedId((prev) => {
      if (prev !== threadId) return prev;
      const remain = threads.filter((t) => t.id !== threadId);
      return remain[0]?.id || null;
    });
  };

  const sendRequest = async () => {
    if (!selected?.id || !message.trim()) return;
    try {
      setBusy(true);
      await fetch(`${BASE}/api/bookings/chat/threads/${selected.id}/driver-request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_type: issueType,
          message: message.trim(),
          sender_name: name || "Driver",
        }),
      });
      setMessage("");
      load();
    } catch {}
    finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        paddingLeft: isMobile ? 0 : 64,
        paddingTop: 64,
        height: isMobile ? "auto" : "100vh",
        minHeight: "100vh",
        background: "#f7f7f2",
        overflow: isMobile ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 1520,
          margin: "0 auto",
          padding: isMobile ? "12px 10px 84px" : 20,
          height: isMobile ? "auto" : "calc(100vh - 64px)",
          minHeight: isMobile ? "auto" : 0,
          overflow: isMobile ? "visible" : "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? 24 : 34 }}>Driver Request Chat</h1>
        <p style={{ margin: "0 0 12px", color: "#555", fontSize: isMobile ? 14 : 16 }}>
          Pickup/drop emergency situation me yahin se admin ko realtime escalation bhejein.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "320px 1fr",
            gap: 12,
            flex: isMobile ? "none" : 1,
            minHeight: 0,
            overflow: isMobile ? "visible" : "hidden",
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
            {threads.length === 0 && <div style={{ color: "#666", fontSize: 13 }}>No active booking threads.</div>}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid rgba(20,20,20,.12)",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  background: selectedId === t.id ? "#d6e800" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 800 }}>Booking #{t.booking_id}</div>
                {isCompleted(t) ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeThread(t.id);
                    }}
                    style={{
                      marginTop: 6,
                      border: "1px solid rgba(20,20,20,.18)",
                      background: "#fff",
                      borderRadius: 8,
                      padding: "4px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Remove Chat
                  </button>
                ) : null}
                <div style={{ fontSize: 12, color: "#555" }}>{t.booking?.pickup_location || "-"}</div>
              </button>
            ))}
          </div>

          <div style={{ minHeight: isMobile ? 520 : 0, height: isMobile ? "auto" : "100%" }}>
            <BookingChatPanel
              role="driver"
              thread={selected}
              compact
              messageTarget="admin"
              visibleTargets={["all", "driver", "admin"]}
              allowedSenderRoles={["system", "admin", "driver"]}
              title={selected ? `Booking #${selected.booking_id} · Escalation Channel` : "Select Booking"}
              extraActions={
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr auto",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    style={{ border: "1px solid rgba(20,20,20,.2)", borderRadius: 10, padding: "8px 10px", minHeight: 42 }}
                  >
                    <option value="pickup_unreachable">Pickup not reachable</option>
                    <option value="patient_critical">Patient critical condition</option>
                    <option value="hospital_unavailable">Assigned hospital unavailable</option>
                    <option value="route_blocked">Route blocked / heavy traffic</option>
                  </select>
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe situation for admin..."
                    style={{ border: "1px solid rgba(20,20,20,.2)", borderRadius: 10, padding: "8px 10px", minHeight: 42 }}
                  />
                  <button className="chat-btn" disabled={busy || !message.trim()} onClick={sendRequest}>
                    {busy ? "Sending..." : "Send Request"}
                  </button>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
