/**
 * UnifiedMapHeader.jsx — src/Components/UnifiedMapHeader.jsx
 *
 * Unified header card bar matching Hospital Portal for
 * Admin, User, Driver, and Hospital map views.
 *
 * Distinct icons:
 * 🚑 Ambulance Live Location
 * 👤 User Patient Pickup Location
 * 🏥 Hospital Destination Location
 */

const coordText = (lat, lng) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || (nLat === 0 && nLng === 0)) return "Unavailable";
  return `${nLat.toFixed(5)}, ${nLng.toFixed(5)}`;
};

export default function UnifiedMapHeader({
  ambulanceNumber = "AMB-0000",
  bookingId = null,
  driverName = "-",
  speed = 0,
  battery = "-",
  pickupLocation = "Pickup",
  destination = "Hospital",
  ambLat = null,
  ambLng = null,
  pickupLat = null,
  pickupLng = null,
  routeMode = "full", // "start" | "full"
  onSetRouteMode = null,
}) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid rgba(17,17,17,0.12)", borderRadius: 10, marginBottom: 8, overflow: "hidden", fontFamily: "Segoe UI, sans-serif" }}>
      {/* Top Title Bar */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(17,17,17,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "rgba(255,255,255,0.92)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
          <span>🚑</span>
          <span>{ambulanceNumber} {bookingId ? `• Booking #${bookingId}` : ""}</span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(17,17,17,0.66)", fontWeight: 600 }}>{driverName}</div>
          {onSetRouteMode && (
            <div style={{ display: "inline-flex", gap: 6 }}>
              <button
                onClick={() => onSetRouteMode("start")}
                style={{
                  background: routeMode === "start" ? "#00c853" : "#ffffff",
                  color: routeMode === "start" ? "#ffffff" : "#111111",
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                ▶ Start Route
              </button>
              <button
                onClick={() => onSetRouteMode("full")}
                style={{
                  background: routeMode === "full" ? "#111111" : "#ffffff",
                  color: routeMode === "full" ? "#ffffff" : "#111111",
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                🗺 View Full Route
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Route Text Line */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(17,17,17,0.12)", background: "rgba(255,255,255,0.72)", fontSize: 11, color: "rgba(17,17,17,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        Route: 🚑 Ambulance live location → 👤 User: {pickupLocation} → 🏥 Hospital: {destination}
      </div>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, padding: "10px 14px", background: "rgba(255,255,255,0.72)", fontSize: 11 }}>
        <div>
          <span style={{ color: "rgba(17,17,17,0.55)", display: "block", fontSize: 10, fontWeight: 600 }}>Speed</span>
          <span style={{ fontWeight: 700, color: "#111" }}>{speed || 0} km/h</span>
        </div>
        <div>
          <span style={{ color: "rgba(17,17,17,0.55)", display: "block", fontSize: 10, fontWeight: 600 }}>Battery</span>
          <span style={{ fontWeight: 700, color: "#111" }}>{battery !== null && battery !== undefined ? `${battery}%` : "-%"}</span>
        </div>
        <div>
          <span style={{ color: "rgba(17,17,17,0.55)", display: "block", fontSize: 10, fontWeight: 600 }}>🚑 Ambulance</span>
          <span style={{ fontWeight: 700, color: "#111" }}>{coordText(ambLat, ambLng)}</span>
        </div>
        <div>
          <span style={{ color: "rgba(17,17,17,0.55)", display: "block", fontSize: 10, fontWeight: 600 }}>👤 User Pickup</span>
          <span style={{ fontWeight: 700, color: "#111" }}>{coordText(pickupLat, pickupLng)}</span>
        </div>
      </div>
    </div>
  );
}
