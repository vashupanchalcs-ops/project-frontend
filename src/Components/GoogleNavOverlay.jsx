/**
 * GoogleNavOverlay.jsx — src/Components/GoogleNavOverlay.jsx
 *
 * Real-time Google Maps Navigation UI matching Image 3:
 * - Top green turn-by-turn banner (e.g. "↰ NH163 2km Then ↶")
 * - Speed indicator pill ("-- km/h")
 * - Bottom ETA footer ("1 hr 18 min")
 */

import { getManeuverInfo } from "../utils/routeUtils";

export default function GoogleNavOverlay({
  currentPos = null,
  routePath = [],
  speed = 0,
  etaStr = "calculating...",
  driverName = "",
}) {
  const maneuver = getManeuverInfo(routePath, currentPos);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4000, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 12, fontFamily: "Segoe UI, Roboto, sans-serif" }}>
      {/* Top Green Turn Banner (Matching Image 3) */}
      <div style={{ pointerEvents: "auto", background: "#006a4e", color: "#ffffff", borderRadius: 16, padding: "12px 16px", boxShadow: "0 6px 20px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 420, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }}>{maneuver.icon}</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{maneuver.distStr}</div>
            <div style={{ fontSize: 15, fontWeight: 700, opacity: 0.95, marginTop: 1 }}>{maneuver.street}</div>
          </div>
        </div>
        {maneuver.thenIcon && (
          <div style={{ background: "rgba(0,0,0,0.22)", padding: "6px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
            <span>Then</span>
            <span style={{ fontSize: 16 }}>{maneuver.thenIcon}</span>
          </div>
        )}
      </div>

      {/* Bottom Floating Bar */}
      <div style={{ pointerEvents: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%" }}>
        {/* Speed Pill (Bottom Left) */}
        <div style={{ background: "#ffffff", color: "#111111", borderRadius: "50%", width: 58, height: 58, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", border: "3px solid #f5f5f5" }}>
          <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{speed || "--"}</div>
          <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.7 }}>km/h</div>
        </div>

        {/* ETA Banner (Bottom Card) */}
        <div style={{ background: "#ffffff", color: "#111111", borderRadius: 20, padding: "10px 20px", boxShadow: "0 6px 24px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 16, border: "1px solid rgba(0,0,0,0.08)" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#d93025" }}>{etaStr || "1 hr 18 min"}</div>
            {driverName && <div style={{ fontSize: 11, fontWeight: 700, color: "#5f6368", marginTop: 1 }}>Driver: {driverName}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
