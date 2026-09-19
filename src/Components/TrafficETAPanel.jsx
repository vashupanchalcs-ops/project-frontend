import React, { useState, useMemo } from "react";

/**
 * TrafficETAPanel.jsx — src/Components/TrafficETAPanel.jsx
 *
 * Professional Google-style Dispatch ETA & Traffic Analysis Panel:
 * 1. Main Card: Approx ETA (min), Distance (km), Expected Arrival Time (local timezone).
 * 2. Traffic Analysis: Free-flow vs Historic vs Live ETA comparison + Delay callout.
 * 3. Traffic Status: Light (<10%), Moderate (10-30%), Heavy (>30%) based on Aarogya classification.
 * 4. Alternate Routes: Interactive 1-2 alternate routes switcher with time/distance diff.
 * 5. Turn-by-Turn Steps: Guidance instructions with turn icons and distance tags.
 */

// Helper to format seconds into minutes
const fmtMins = (secs) => {
  const s = Number(secs) || 0;
  const m = Math.max(1, Math.round(s / 60));
  return ${m} min;
};

// Helper to format meters into km or m
const fmtDist = (meters) => {
  const m = Number(meters) || 0;
  if (m >= 1000) {
    return ${(m / 1000).toFixed(1)} km;
  }
  return ${Math.round(m)} m;
};

// Helper to format arrival time to local clock (e.g. 03:45 PM)
const fmtArrival = (isoString, addSeconds = 0) => {
  try {
    let d;
    if (isoString) {
      d = new Date(isoString);
    } else {
      d = new Date(Date.now() + (addSeconds || 0) * 1000);
    }
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
};

// Helper to pick turn icon
const getTurnIcon = (maneuver) => {
  const m = String(maneuver || "").toUpperCase();
  if (m.includes("RIGHT")) return "↪️";
  if (m.includes("LEFT")) return "↩️";
  if (m.includes("UTURN")) return "🔄";
  if (m.includes("KEEP") || m.includes("SLIGHT")) return "↗️";
  if (m.includes("START")) return "🟢";
  if (m.includes("FINISH") || m.includes("ARRIVE")) return "🏁";
  return "⬆️";
};

export default function TrafficETAPanel({
  routeData = null,
  activeRouteIndex = 0,
  onSelectRouteIndex = null,
  currentStepIndex = 0,
  className = "",
  style = {},
}) {
  const [showSteps, setShowSteps] = useState(true);

  // Active route selection (primary vs alternative)
  const activeRoute = useMemo(() => {
    if (!routeData) return null;
    if (activeRouteIndex === 0) return routeData;
    const alts = routeData.alternatives || [];
    return alts[activeRouteIndex - 1] || routeData;
  }, [routeData, activeRouteIndex]);

  // Traffic classification logic (Aarogya custom thresholds)
  const trafficClassification = useMemo(() => {
    if (!activeRoute) return { label: "Normal", color: "#16a34a", bg: "#dcfce7", ratioPct: 0 };
    const delay = Number(activeRoute.traffic_delay_s) || 0;
    const noTraf = Number(activeRoute.no_traffic_s) || Number(activeRoute.duration_s) || 1;
    const ratio = delay / Math.max(1, noTraf);
    const ratioPct = Math.round(ratio * 100);

    if (ratio < 0.10) {
      return { label: "Light Traffic", color: "#16a34a", bg: "#dcfce7", ratioPct };
    } else if (ratio <= 0.30) {
      return { label: "Moderate Traffic", color: "#d97706", bg: "#fef3c7", ratioPct };
    } else {
      return { label: "Heavy Traffic", color: "#dc2626", bg: "#fee2e2", ratioPct };
    }
  }, [activeRoute]);

  if (!routeData || !activeRoute) {
    return (
      <div className={	ep-container empty } style={style}>
        <div style={{ padding: 16, textAlign: "center", color: "#666", fontSize: 13 }}>
          Calculating traffic-aware route...
        </div>
      </div>
    );
  }

  const durationMin = Math.max(1, Math.round((activeRoute.duration_s || 0) / 60));
  const distanceKm = ((activeRoute.distance_m || 0) / 1000).toFixed(1);
  const delayMin = Math.round((activeRoute.traffic_delay_s || 0) / 60);

  const freeFlowMin = Math.max(1, Math.round((activeRoute.no_traffic_s || activeRoute.duration_s || 0) / 60));
  const historicMin = Math.max(1, Math.round((activeRoute.historic_s || activeRoute.duration_s || 0) / 60));
  const liveMin = durationMin;

  const arrivalFormatted = fmtArrival(activeRoute.arrival_time, activeRoute.duration_s);

  // Available routes list (Primary + Alternatives)
  const allRoutes = [
    { label: "Fastest Route", route: routeData, idx: 0 },
    ...(routeData.alternatives || []).map((alt, i) => ({
      label: Alternative ,
      route: alt,
      idx: i + 1,
    })),
  ];

  return (
    <div className={	ep-container } style={style}>
      <style>{
        .tep-container {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.08);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          color: #111111;
        }

        /* ── Main ETA Card ── */
        .tep-main-card {
          padding: 16px 18px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          background: #ffffff;
        }
        .tep-eta-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .tep-eta-big {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.5px;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .tep-approx-tag {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
        }
        .tep-status-pill {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .tep-meta-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 6px;
          font-size: 13px;
          color: #4b5563;
          font-weight: 600;
        }

        /* ── Traffic Analysis Card ── */
        .tep-analysis-card {
          padding: 12px 18px;
          background: #f9fafb;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .tep-analysis-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #6b7280;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
        }
        .tep-scenario-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .tep-scenario-box {
          background: #ffffff;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          text-align: center;
        }
        .tep-scenario-label {
          font-size: 10px;
          color: #6b7280;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .tep-scenario-val {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }
        .tep-delay-callout {
          margin-top: 8px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* ── Alternatives Switcher ── */
        .tep-alts-section {
          padding: 10px 18px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          background: #ffffff;
        }
        .tep-alt-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .tep-alt-row::-webkit-scrollbar { display: none; }
        .tep-alt-btn {
          flex: 1;
          min-width: 120px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1.5px solid #e5e7eb;
          background: #ffffff;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .tep-alt-btn.active {
          border-color: #2563eb;
          background: #eff6ff;
        }

        /* ── Turn-by-Turn Steps ── */
        .tep-steps-header {
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          color: #374151;
        }
        .tep-steps-list {
          max-height: 220px;
          overflow-y: auto;
          background: #ffffff;
          border-top: 1px solid #f3f4f6;
        }
        .tep-step-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 18px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 12px;
        }
        .tep-step-item.active {
          background: #eff6ff;
          font-weight: 700;
        }
        .tep-step-icon {
          font-size: 15px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .tep-step-body {
          flex: 1;
          min-width: 0;
        }
        .tep-step-instruction {
          color: #111827;
          font-weight: 600;
          line-height: 1.35;
        }
        .tep-step-meta {
          font-size: 11px;
          color: #6b7280;
          margin-top: 2px;
        }

        .tep-disclaimer {
          font-size: 9.5px;
          color: #9ca3af;
          text-align: center;
          padding: 6px 12px;
          background: #fafafa;
          border-top: 1px solid #f3f4f6;
        }
      }</style>

      {/* 1. Main ETA Card */}
      <div className="tep-main-card">
        <div className="tep-eta-row">
          <div className="tep-eta-big">
            <span>{durationMin} min</span>
            <span className="tep-approx-tag">approx.</span>
          </div>
          <div
            className="tep-status-pill"
            style={{ color: trafficClassification.color, background: trafficClassification.bg }}
          >
            ● {trafficClassification.label}
          </div>
        </div>

        <div className="tep-meta-row">
          <div>📏 <strong>{distanceKm} km</strong></div>
          <div>🕒 Arrival: <strong>{arrivalFormatted}</strong></div>
          {activeRoute.cached && (
            <div style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4", padding: "1px 6px", borderRadius: 4 }}>
              ⚡ Cached (0ms)
            </div>
          )}
        </div>
      </div>

      {/* 2. Traffic Analysis Breakdown */}
      <div className="tep-analysis-card">
        <div className="tep-analysis-title">
          <span>Traffic Analysis</span>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>TomTom Orbis Live</span>
        </div>

        <div className="tep-scenario-grid">
          <div className="tep-scenario-box">
            <div className="tep-scenario-label">Free-flow</div>
            <div className="tep-scenario-val">{freeFlowMin} min</div>
          </div>
          <div className="tep-scenario-box">
            <div className="tep-scenario-label">Historic</div>
            <div className="tep-scenario-val">{historicMin} min</div>
          </div>
          <div className="tep-scenario-box" style={{ borderColor: trafficClassification.color }}>
            <div className="tep-scenario-label" style={{ color: trafficClassification.color }}>Live ETA</div>
            <div className="tep-scenario-val" style={{ color: trafficClassification.color }}>{liveMin} min</div>
          </div>
        </div>

        {delayMin > 0 ? (
          <div className="tep-delay-callout" style={{ background: trafficClassification.bg, color: trafficClassification.color }}>
            <span>⚠️ Traffic Delay: +{delayMin} min</span>
            <span style={{ fontSize: 10 }}>+{trafficClassification.ratioPct}% over free-flow</span>
          </div>
        ) : (
          <div className="tep-delay-callout" style={{ background: "#f0fdf4", color: "#16a34a" }}>
            <span>✓ No Traffic Delay: Smooth Corridors</span>
            <span style={{ fontSize: 10 }}>0 min delay</span>
          </div>
        )}
      </div>

      {/* 3. Alternate Routes Switcher (if alternatives exist) */}
      {allRoutes.length > 1 && (
        <div className="tep-alts-section">
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
            Select Route:
          </div>
          <div className="tep-alt-row">
            {allRoutes.map((item) => {
              const isSel = item.idx === activeRouteIndex;
              const rMin = Math.max(1, Math.round((item.route.duration_s || 0) / 60));
              const rKm = ((item.route.distance_m || 0) / 1000).toFixed(1);
              const diffMin = rMin - durationMin;

              return (
                <button
                  key={item.idx}
                  className={	ep-alt-btn }
                  onClick={() => onSelectRouteIndex && onSelectRouteIndex(item.idx)}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: isSel ? "#2563eb" : "#111" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>
                    {rMin} min
                    {diffMin > 0 && <span style={{ fontSize: 10, color: "#dc2626", marginLeft: 4 }}>+{diffMin}m</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{rKm} km</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Turn-by-Turn Steps */}
      {activeRoute.steps && activeRoute.steps.length > 0 && (
        <div>
          <div className="tep-steps-header" onClick={() => setShowSteps(!showSteps)}>
            <span>Turn-by-turn Directions ({activeRoute.steps.length} steps)</span>
            <span>{showSteps ? "▲" : "▼"}</span>
          </div>

          {showSteps && (
            <div className="tep-steps-list">
              {activeRoute.steps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;
                return (
                  <div key={idx} className={	ep-step-item }>
                    <div className="tep-step-icon">{getTurnIcon(step.turn_type)}</div>
                    <div className="tep-step-body">
                      <div className="tep-step-instruction">{step.instruction || "Continue on road"}</div>
                      <div className="tep-step-meta">
                        {fmtDist(step.distance_m)} · {step.duration_s ? fmtMins(step.duration_s) : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Classification Disclaimer */}
      <div className="tep-disclaimer">
        Traffic status (Light/Moderate/Heavy) calculated via Aarogya Dispatch Engine.
      </div>
    </div>
  );
}
