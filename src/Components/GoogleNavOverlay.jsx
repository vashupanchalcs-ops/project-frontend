/**
 * GoogleNavOverlay.jsx — src/Components/GoogleNavOverlay.jsx
 *
 * Real-time Google Maps Navigation UI:
 * - Compact green turn-by-turn banner
 * - Compact speed indicator pill
 * - Compact ETA footer card
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
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4000,
        display: "flex",
        flexDirection: "column",
        justify: "space-between",
        padding: 10,
        fontFamily: "Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* Top Green Turn Banner (Compact) */}
      <div
        style={{
          pointerEvents: "auto",
          background: "#006a4e",
          color: "#ffffff",
          borderRadius: 12,
          padding: "6px 12px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 260,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{maneuver.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>{maneuver.distStr}</div>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.92, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
              {maneuver.street}
            </div>
          </div>
        </div>
        {maneuver.thenIcon && (
          <div
            style={{
              background: "rgba(0,0,0,0.25)",
              padding: "3px 7px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>Then</span>
            <span style={{ fontSize: 13 }}>{maneuver.thenIcon}</span>
          </div>
        )}
      </div>

      {/* Bottom Floating Bar */}
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        {/* Speed Pill (Bottom Left) */}
        <div
          style={{
            background: "#ffffff",
            color: "#111111",
            borderRadius: "50%",
            width: 46,
            height: 46,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 3px 12px rgba(0,0,0,0.22)",
            border: "2px solid #f5f5f5",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1 }}>{speed || "--"}</div>
          <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.7 }}>km/h</div>
        </div>

        {/* ETA Banner (Bottom Card) */}
        <div
          style={{
            background: "#ffffff",
            color: "#111111",
            borderRadius: 14,
            padding: "6px 14px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#d93025" }}>{etaStr || "En Route"}</div>
            {driverName && (
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5f6368", marginTop: 1 }}>
                Driver: {driverName}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
