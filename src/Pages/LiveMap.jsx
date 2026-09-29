import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import gsap from "gsap";
import FlutterTrackingFrame from "../Components/FlutterTrackingFrame";

const TABS = [
  { id: "map", label: "🗺 Flutter Live Tracking" },
];

export default function LiveMap() {
  const location = useLocation();
  const [activeTab,      setActiveTab]      = useState("map");
  const rootRef = useRef(null);
  const preBookingId = location.state?.bookingId ?? null;

  useEffect(() => {
    if (location.state?.openRouteManager) {
      setActiveTab("route");
    }
  }, [location.state]);

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
        .lm-selected-info {
          margin-left: auto; display: flex; align-items: center;
          gap: 6px; flex-shrink: 0; padding-left: 8px;
        }
        .lm-content {
          flex: 1; min-height: 0; overflow: hidden; position: relative;
        }
        .lm-pane {
          position: absolute; inset: 0; display: flex;
        }

        /* ── Tablet ── */
        @media (max-width: 1024px) {
          .lm-root { margin-left: 64px; width: calc(100vw - 64px); }
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
          .lm-selected-info .lm-sel-label { display: none; }

          /* ✅ KEY FIX: pane flex-direction column — panel upar, map neeche */
          .lm-pane {
            flex-direction: column;
            overflow-y: auto;
          }

          /* Mobile layout for the RealTimeMap panel and map. */
          .lm-pane > * {
            width: 100% !important;
            min-width: unset !important;
          }
        }

        @media (max-width: 480px) {
          .lm-header-title { font-size: 12px; }
          .lm-tab-btn { font-size: 11px; padding: 8px 8px; }
        }

        /* Active live-map controls use the shared yellow state, not red. */
        html body #root#root .lm-tab-btn.active,
        html body #root#root .lm-tab-btn.active:hover {
          background: #f59a23 !important;
          border-bottom-color: #f59a23 !important;
          color: #111111 !important;
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

        {/* Flutter owns the actual GoogleMap surface for the admin role. */}
        <div className="lm-content">
          <div className="lm-pane" style={{ display: "flex", zIndex: 1 }}>
            <FlutterTrackingFrame role="admin" bookingId={preBookingId} title="Admin Flutter live tracking map" />
          </div>
        </div>
      </div>
    </>
  );
}
