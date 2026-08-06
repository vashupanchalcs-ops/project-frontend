import { useEffect, useState } from "react";
import BookingChatPanel from "../components/BookingChatPanel";

const BASE = "http://127.0.0.1:8000";

export default function DriverChatbot() {
  const email = localStorage.getItem("user") || "";
  const name = localStorage.getItem("name") || "";
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
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
      setThreads(rows);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, name]);

  const selected = threads.find((t) => t.id === selectedId) || threads[0] || null;

  return (
    <div style={{ paddingLeft: isMobile ? 0 : 64, paddingTop: 64, height: "100vh", background: "#f7f7f2", overflow: "hidden" }}>
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: isMobile ? "12px 10px 84px" : 20,
          height: "calc(100vh - 64px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? 24 : 34 }}>Driver AI Chat</h1>
        <p style={{ margin: "0 0 12px", color: "#555", fontSize: isMobile ? 14 : 16 }}>
          View dispatch commands, escalation replies, and hospital desk updates in one channel.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "320px 1fr 280px",
            gap: 12,
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "block",
              border: "1px solid rgba(20,20,20,.14)",
              borderRadius: 14,
              background: "#fff",
              padding: isMobile ? 8 : 10,
              maxHeight: isMobile ? 220 : "100%",
              overflow: "auto",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, margin: "2px 4px 10px", color: "#111" }}>Direct</div>
            {threads.length === 0 && <div style={{ color: "#666", fontSize: 13 }}>No assigned booking chats.</div>}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid rgba(20,20,20,.12)",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 8,
                  background: selectedId === t.id ? "#d6e800" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16 }}>Booking #{t.booking_id}</div>
                <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>
                  {t.booking?.booked_by || "User"} · {t.booking?.pickup_location || "-"}
                </div>
              </button>
            ))}
          </div>
          <div style={{ minHeight: 0, height: "100%" }}>
            <BookingChatPanel
              role="driver"
              thread={selected}
              compact
              messageTarget="admin"
              visibleTargets={["all", "driver", "admin"]}
              allowedSenderRoles={["system", "admin", "driver"]}
              title={selected ? `Booking #${selected.booking_id} · Driver Chat` : "Select Booking"}
              onMessagesChange={setChatMessages}
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
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Driver Alerts</div>
              {chatMessages.slice(-8).reverse().map((m) => (
                <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m.sender_name || m.sender_role}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{String(m.message || "").slice(0, 70)}</div>
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
