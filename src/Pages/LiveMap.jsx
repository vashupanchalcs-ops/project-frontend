import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import gsap from "gsap";
import FlutterTrackingFrame from "../Components/FlutterTrackingFrame";
import { API_BASE_URL } from "../api/client";

const TABS = [
  { id: "map", label: "🗺 Flutter Live Tracking" },
];

export default function LiveMap() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("map");
  const rootRef = useRef(null);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState(() => {
    const q = new URLSearchParams(location.search);
    return Number(q.get("booking_id") || location.state?.bookingId || 0);
  });

  useEffect(() => {
    let mounted = true;
    const fetchBookings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/bookings/`);
        if (res.ok) {
          const data = await res.json();
          const rows = Array.isArray(data) ? data : (data.results || []);
          if (mounted) {
            setBookings(rows);
            setSelectedBookingId((prev) => {
              if (prev > 0 && rows.some(b => Number(b.id) === Number(prev))) return prev;
              const active = rows.find(b => b.ambulance_id && b.status !== "completed" && b.status !== "cancelled");
              return active ? Number(active.id) : (rows[0] ? Number(rows[0].id) : 0);
            });
          }
        }
      } catch (err) {
        console.warn("Failed to load active bookings in LiveMap:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchBookings();
    const interval = setInterval(fetchBookings, 8000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const activeBooking = useMemo(() => {
    return bookings.find(b => Number(b.id) === Number(selectedBookingId)) || bookings[0] || null;
  }, [bookings, selectedBookingId]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(".lm-anim", { y: 0, opacity: 1, clearProps: "all" });
    }, rootRef);
    return () => ctx.revert();
  }, [activeTab]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        .lm-root {
          margin-left: 64px;
          width: auto;
          height: 100vh;
          padding-top: 64px;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(920px 430px at 88% 8%, rgba(255, 255, 255, 0.15), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(255, 255, 255, 0.15), transparent 70%),
            var(--sr-bg, #ffffff);
          color: #111;
          font-family: 'Segoe UI', sans-serif;
          overflow: hidden;
        }
        .lm-header {
          background: #ffffff;
          border-bottom: 1px solid rgba(17,17,17,0.12);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          gap: 8px;
          flex-wrap: wrap;
        }
        .lm-header-left {
          display: flex; align-items: center; gap: 10px; min-width: 0;
        }
        .lm-header-title { font-weight: 700; font-size: 15px; white-space: nowrap; }
        .lm-header-sub   { font-size: 11px; color: rgba(17,17,17,0.58); margin-top: 1px; }
        .lm-live-badge {
          display: flex; align-items: center; gap: 6px;
          background: #fff3df; border: 1px solid #f59a23;
          border-radius: 20px; padding: 5px 12px;
          color: #111; font-weight: 700; font-size: 11px; flex-shrink: 0;
        }
        .lm-tabs {
          background: #ffffff; border-bottom: 1px solid rgba(17,17,17,0.12);
          padding: 0 12px; display: flex; align-items: center;
          flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
        }
        .lm-tabs::-webkit-scrollbar { display: none; }
        .lm-tab-btn {
          background: none; border: none; border-bottom: 2px solid transparent;
          padding: 10px 12px; color: rgba(17,17,17,0.58); font-weight: 600; font-size: 13px;
          cursor: pointer; display: flex; align-items: center; gap: 6px;
          white-space: nowrap; flex-shrink: 0; transition: color 0.15s;
        }
        .lm-tab-btn.active { border-bottom-color: #f59a23; color: #111; font-weight: 800; background: #f59a23; border-radius: 6px; }
        .lm-tab-btn:hover { background: #f4fbf4; color: #126f1e; }
        
        .lm-content {
          flex: 1; min-height: 0; overflow: hidden; position: relative;
        }
        .lm-pane {
          position: absolute; inset: 0; display: flex; flex-direction: row; gap: 12px; padding: 12px;
        }

        .lm-dispatch-sidebar {
          width: 320px;
          flex-shrink: 0;
          background: #ffffff;
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .lm-dispatch-head {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(17,17,17,0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fafafa;
        }
        .lm-dispatch-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .lm-dispatch-card {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(17,17,17,0.1);
          background: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .lm-dispatch-card:hover {
          border-color: #f59a23;
          background: #fffdf9;
        }
        .lm-dispatch-card.active {
          border-color: #f59a23;
          background: #fff8ee;
          box-shadow: 0 0 0 1px #f59a23;
        }

        /* ── Tablet ── */
        @media (max-width: 1024px) {
          .lm-root { margin-left: 64px; width: calc(100vw - 64px); }
          .lm-dispatch-sidebar { width: 280px; }
        }

        /* ── Mobile ── */
        @media (max-width: 767px) {
          .lm-root {
            margin-left: 0;
            width: 100vw;
            height: calc(100vh - 60px);
            padding-top: 64px;
          }
          .lm-header { padding: 8px 12px; }
          .lm-header-sub { display: none; }
          .lm-header-title { font-size: 13px; }
          .lm-live-badge { padding: 4px 10px; font-size: 10px; }
          .lm-tab-btn { font-size: 12px; padding: 8px 10px; }
          .lm-pane {
            flex-direction: column;
            overflow-y: auto;
            padding: 8px;
          }
          .lm-dispatch-sidebar {
            width: 100%;
            max-height: 200px;
          }
        }
      `}</style>

      <div className="lm-root" ref={rootRef}>

        {/* Header */}
        <div className="lm-header lm-anim">
          <div className="lm-header-left">
            <span style={{ fontSize: 22, flexShrink: 0 }}>📡</span>
            <div style={{ minWidth: 0 }}>
              <div className="lm-header-title">Live Command Center</div>
              <div className="lm-header-sub">Real-time driver tracking & route management</div>
            </div>
          </div>
          <div className="lm-live-badge">
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59a23", boxShadow: "0 0 8px #f59a23" }} />
            LIVE
          </div>
        </div>

        {/* Tabs */}
        <div className="lm-tabs lm-anim">
          {TABS.map(t => (
            <motion.button
              key={t.id}
              className={`lm-tab-btn ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
              whileHover={{ y: -1 }}
            >
              {t.label}
            </motion.button>
          ))}
        </div>

        {/* Content with Left Active Dispatches Panel + Full Map */}
        <div className="lm-content">
          <div className="lm-pane">
            <aside className="lm-dispatch-sidebar">
              <div className="lm-dispatch-head">
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a" }}>
                  Active Dispatches ({bookings.length})
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#f1f5f9", padding: "2px 6px", borderRadius: "10px", color: "#64748b" }}>
                  GPS Real-Time
                </span>
              </div>
              <div className="lm-dispatch-list">
                {bookings.length === 0 && (
                  <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                    No active dispatches found.
                  </div>
                )}
                {bookings.map((b) => (
                  <div
                    key={`b-${b.id}`}
                    className={`lm-dispatch-card ${Number(activeBooking?.id) === Number(b.id) ? "active" : ""}`}
                    onClick={() => setSelectedBookingId(Number(b.id))}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                        {b.ambulance_number || "Ambulance Unit"}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "8px", background: b.status === "confirmed" ? "#dcfce7" : "#fef3c7", color: b.status === "confirmed" ? "#166534" : "#92400e" }}>
                        #{b.id} · {b.status || "active"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                      Driver: <strong>{b.driver || "Assigned Driver"}</strong>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      Patient: {b.patient_name || "Patient"}
                    </div>
                    <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📍 {b.pickup_location || "Pickup location"}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <div style={{ flex: "1 1 auto", width: "100%", height: "100%", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(17,17,17,0.12)" }}>
              <FlutterTrackingFrame
                role="admin"
                bookingId={activeBooking?.id || selectedBookingId || 0}
                ambulanceId={activeBooking?.ambulance_id || null}
                hideSidebar={true}
                title="Admin Flutter live tracking map"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}