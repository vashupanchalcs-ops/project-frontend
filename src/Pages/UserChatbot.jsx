import { useEffect, useState } from "react";
import BookingChatPanel from "../Components/BookingChatPanel";

const BASE = "http://127.0.0.1:8000";

export default function UserChatbot() {
  const email = localStorage.getItem("user") || "";
  const name = localStorage.getItem("name") || "User";
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
        `${BASE}/api/bookings/chat/threads/?role=user&email=${encodeURIComponent(email)}`
      );
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setThreads(rows);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const selected = threads.find((t) => t.id === selectedId) || threads[0] || null;

  return (
    <div style={{ paddingLeft: isMobile ? 0 : 64, paddingTop: 64, height: "100vh", background: "#f7f7f2", overflow: "hidden" }}>
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: isMobile ? "0px 0px 84px 0px" : 20,
          height: "calc(100vh - 64px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 0 : 12,
        }}
      >
        {!isMobile && (
          <>
            <h1 style={{ margin: "0 0 8px", fontSize: 34 }}>AI Support Chat</h1>
            <p style={{ margin: "0 0 12px", color: "#555", fontSize: 16 }}>
              View live dispatch updates, ambulance status, and hospital notifications here.
            </p>
          </>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "320px 1fr 280px",
            gridTemplateRows: isMobile ? "auto 1fr" : "1fr",
            gap: isMobile ? 0 : 12,
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            background: isMobile ? "#f6f7f2" : "transparent"
          }}
        >
          <div
            style={{
              display: isMobile ? "flex" : "block",
              overflowX: isMobile ? "auto" : "hidden",
              border: isMobile ? "none" : "1px solid rgba(20,20,20,.14)",
              background: isMobile ? "#fff" : "#fff",
              padding: isMobile ? "10px 10px" : 10,
              maxHeight: isMobile ? "auto" : "100%",
              gap: 8,
              borderBottom: isMobile ? "1px solid rgba(0,0,0,0.06)" : "none",
            }}
          >
            {!isMobile && <div style={{ fontWeight: 800, fontSize: 18, margin: "2px 4px 10px", color: "#111" }}>Direct</div>}
            {threads.length === 0 && <div style={{ color: "#666", fontSize: 13, padding: isMobile?"0 10px":0 }}>No bookings</div>}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  width: isMobile ? "auto" : "100%",
                  minWidth: isMobile ? 130 : "auto",
                  maxWidth: isMobile ? 180 : "auto",
                  flexShrink: 0,
                  textAlign: "left",
                  border: isMobile && selectedId !== t.id ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(20,20,20,.12)",
                  borderRadius: 16,
                  padding: "8px 12px",
                  marginBottom: isMobile ? 0 : 8,
                  background: selectedId === t.id ? "#d6e800" : (isMobile ? "#fafafa" : "#fff"),
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 16 }}>#{t.booking_id}</div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.booking?.pickup_location || "Status pending"}
                </div>
              </button>
            ))}
          </div>
          <div style={{ minHeight: 0, height: "100%" }}>
            <BookingChatPanel
              role="user"
              thread={selected}
              compact
              instagramMode={isMobile}
              messageTarget="admin"
              visibleTargets={["all", "user", "admin"]}
              allowedSenderRoles={["system", "admin", "user"]}
              title={selected ? `Booking #${selected.booking_id} Chat` : "Select Booking"}
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
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Notifications</div>
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
