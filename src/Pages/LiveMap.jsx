import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import gsap from "gsap";
import RealTimeMap from "../Components/RealTimeMap";
import AdminRouteManager from "../Components/AdminRouteManager";

const TABS = [
  { id: "map",   label: "🗺 Live Tracking Map" },
  { id: "route", label: "🛣 Route Manager"      },
];

export default function LiveMap() {
  const location = useLocation();
  const [activeTab,      setActiveTab]      = useState("map");
  const [selectedDriver, setSelectedDriver] = useState(null);
  const rootRef = useRef(null);
  const preBookingId = location.state?.bookingId ?? null;
  const preAmbId = location.state?.ambulanceId ?? null;

  useEffect(() => {
    if (location.state?.openRouteManager) {
      setActiveTab("route");
    }
  }, [location.state]);

  const handleDriverSelect = (driver) => {
    setSelectedDriver(driver);
    setActiveTab("route");
  };

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".lm-anim", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: "power2.out" });
    }, rootRef);
    return () => ctx.revert();
  }, [activeTab, !!selectedDriver]);

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
            radial-gradient(920px 430px at 88% 8%, rgba(214,232,0,0.14), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(235,248,94,0.12), transparent 70%),
            var(--sr-bg, #f5f5ef);
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
          background: rgba(0,200,83,0.13); border: 1px solid rgba(0,200,83,0.27);
          border-radius: 20px; padding: 5px 12px;
          color: #00c853; font-weight: 700; font-size: 11px; flex-shrink: 0;
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
        .lm-tab-btn.active { border-bottom-color: #d6e800; color: #111; font-weight: 800; background: #eef2b2; }
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

          /* RealTimeMap ke andar ka panel aur map — mobile layout */
          .lm-pane > * {
            width: 100% !important;
            min-width: unset !important;
          }
        }

        @media (max-width: 480px) {
          .lm-header-title { font-size: 12px; }
          .lm-tab-btn { font-size: 11px; padding: 8px 8px; }
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
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c853", boxShadow: "0 0 8px #00c853" }} />
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
              {t.id === "route" && selectedDriver && (
                <span style={{
                  background: "#e5091422", color: "#e50914",
                  border: "1px solid #e5091444",
                  borderRadius: 10, padding: "1px 7px",
                  fontSize: 10, fontWeight: 700,
                }}>
                  {selectedDriver.ambulance_number}
                </span>
              )}
            </motion.button>
          ))}

          {selectedDriver && (
            <div className="lm-selected-info">
              <span className="lm-sel-label" style={{ color: "rgba(17,17,17,0.58)", fontSize: 11 }}>Selected:</span>
              <span style={{
                background: "#00c85322", color: "#00c853",
                border: "1px solid #00c85344",
                borderRadius: 10, padding: "2px 9px",
                fontSize: 11, fontWeight: 700,
              }}>
                {selectedDriver.ambulance_number}
              </span>
              <button
                onClick={() => setSelectedDriver(null)}
                style={{ background: "none", border: "none", color: "rgba(17,17,17,0.58)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Content — tabs use display instead of visibility to force map reflow */}
        <div className="lm-content">
          <div className="lm-pane" style={{
            display: activeTab === "map" ? "flex" : "none",
            zIndex: activeTab === "map" ? 1 : 0,
          }}>
            <RealTimeMap onSelectDriver={handleDriverSelect} />
          </div>
          <div className="lm-pane" style={{
            display: activeTab === "route" ? "flex" : "none",
            zIndex: activeTab === "route" ? 1 : 0,
          }}>
            <AdminRouteManager
              preSelectedDriver={selectedDriver}
              preSelectedBookingId={preBookingId}
              preSelectedAmbulanceId={preAmbId}
              isActive={activeTab === "route"}
            />
          </div>
        </div>
      </div>
    </>
  );
}
