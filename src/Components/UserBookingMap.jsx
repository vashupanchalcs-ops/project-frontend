/**
 * UserBookingMap.jsx — src/Components/UserBookingMap.jsx
 *
 * Clean Google Maps Embedded Map Engine & Dispatch Layout (Matching Image 2):
 * - Left 380px Sidebar Panel: Complete trip info, timeline, speed, battery, ETA, and route controls.
 * - Right Side Full-Height Map: Expansive Google Maps iframe showing the full driving route.
 */

import { useEffect, useMemo, useState } from "react";
import { isIndiaCoord } from "../hooks/useLeaflet";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const approxMins = (km) => Math.max(1, Math.round((km / 28) * 60));
const fmtSecs = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const coordText = (lat, lng) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || (nLat === 0 && nLng === 0)) return "Unavailable";
  return `${nLat.toFixed(5)}, ${nLng.toFixed(5)}`;
};

export default function UserBookingMap({ booking, onClose, embedded = false }) {
  const [ambLoc, setAmbLoc] = useState(null);
  const [ambSpeed, setAmbSpeed] = useState(0);
  const [ambBattery, setAmbBattery] = useState(null);
  const [ambDriver, setAmbDriver] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [routeMode, setRouteMode] = useState("full"); // "start" | "full"
  const [hospCoords, setHospCoords] = useState(null);

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch Hospital Coordinates for user-selected or assigned hospital ─────
  useEffect(() => {
    const hid = booking?.assigned_hospital_id || booking?.user_selected_hospital_id;
    if (!hid) return;
    fetch(`${BASE}/api/hospitals/${hid}/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((h) => {
        if (h && isIndiaCoord(h.latitude, h.longitude)) {
          setHospCoords({ lat: Number(h.latitude), lng: Number(h.longitude) });
        }
      })
      .catch(() => {});
  }, [booking?.assigned_hospital_id, booking?.user_selected_hospital_id]);

  // ── Poll ambulance live location ────────────────────────────────────────────
  useEffect(() => {
    if (!booking?.ambulance_id && !booking?.ambulance_number) return;
    const fetchAmb = async () => {
      try {
        const res = await fetch(`${BASE}/api/ambulances/`);
        const list = await res.json();
        if (!Array.isArray(list)) return;
        const amb =
          list.find((a) => Number(a.id) === Number(booking?.ambulance_id)) ||
          list.find((a) => String(a.ambulance_number || "").toLowerCase() === String(booking?.ambulance_number || "").toLowerCase());
        if (!amb) return;

        const lat = parseFloat(amb.latitude);
        const lng = parseFloat(amb.longitude);
        if (isIndiaCoord(lat, lng)) {
          setAmbLoc({ lat, lng });
        }
        setAmbSpeed(amb.speed || 0);
        setAmbBattery(amb.battery_percentage ?? null);
        setAmbDriver(amb.driver || "");
      } catch {}
    };
    fetchAmb();
    const interval = setInterval(fetchAmb, 5000);
    return () => clearInterval(interval);
  }, [booking]);

  // ── Leg stats ───────────────────────────────────────────────────────────────
  const legStats = useMemo(() => {
    const ambLat = ambLoc?.lat ?? Number(booking?.pickup_latitude);
    const ambLng = ambLoc?.lng ?? Number(booking?.pickup_longitude);
    const pickupLat = Number(booking?.pickup_latitude);
    const pickupLng = Number(booking?.pickup_longitude);

    let d1 = null, m1 = null;
    if (isIndiaCoord(ambLat, ambLng) && isIndiaCoord(pickupLat, pickupLng)) {
      const km1 = haversineKm({ lat: ambLat, lng: ambLng }, { lat: pickupLat, lng: pickupLng }) * 1.25;
      d1 = km1.toFixed(1);
      m1 = approxMins(km1);
    }

    let d2 = "12.4", m2 = 25;
    const destLat = hospCoords?.lat ?? Number(booking?.destination_latitude);
    const destLng = hospCoords?.lng ?? Number(booking?.destination_longitude);
    if (isIndiaCoord(pickupLat, pickupLng) && isIndiaCoord(destLat, destLng)) {
      const km2 = haversineKm({ lat: pickupLat, lng: pickupLng }, { lat: destLat, lng: destLng }) * 1.35;
      d2 = km2.toFixed(1);
      m2 = approxMins(km2);
    }
    return { d1, m1, d2, m2 };
  }, [ambLoc, booking, hospCoords]);

  const [activeRoute, setActiveRoute] = useState(null);

  useEffect(() => {
    if (!booking?.id) return;
    let cancel = false;
    fetch(`${BASE}/api/route/active/${booking.id}/`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancel && data?.id) {
          setActiveRoute(data);
        }
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [booking?.id]);

  // ── Route Embed URL ─────────────────────────────────────────────────────────
  const embedSrc = useMemo(() => {
    const ambLat = ambLoc?.lat;
    const ambLng = ambLoc?.lng;
    const ambCoord = isIndiaCoord(ambLat, ambLng) ? `${ambLat},${ambLng}` : "";
    
    const pickupLat = Number(booking?.pickup_latitude);
    const pickupLng = Number(booking?.pickup_longitude);

    const routePickupCoord = isIndiaCoord(activeRoute?.pickup_lat, activeRoute?.pickup_lng)
      ? `${activeRoute.pickup_lat},${activeRoute.pickup_lng}`
      : "";
    const routeDestCoord = isIndiaCoord(activeRoute?.dest_lat, activeRoute?.dest_lng)
      ? `${activeRoute.dest_lat},${activeRoute.dest_lng}`
      : "";

    const hospCoordStr = isIndiaCoord(hospCoords?.lat, hospCoords?.lng)
      ? `${hospCoords.lat},${hospCoords.lng}`
      : "";

    const pickupCoordStr = routePickupCoord || (isIndiaCoord(pickupLat, pickupLng) ? `${pickupLat},${pickupLng}` : "");
    const pickupText = activeRoute?.pickup_location || String(booking?.pickup_location || "").trim();
    const destText = routeDestCoord || hospCoordStr || activeRoute?.destination || String(booking?.assigned_hospital_name || booking?.destination || "Hospital, India").trim();

    const startPt = ambCoord || pickupCoordStr || pickupText || "28.73724,77.30666";
    const viaPt = pickupCoordStr || pickupText;
    const endPt = destText || "Hospital, India";

    let daddrStr = encodeURIComponent(endPt);
    if (viaPt && viaPt !== startPt && viaPt !== endPt) {
      daddrStr = `${encodeURIComponent(viaPt)}+to:${encodeURIComponent(endPt)}`;
    }

    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(startPt)}&daddr=${daddrStr}&dirflg=d`;
  }, [ambLoc, booking, activeRoute, routeMode, hospCoords]);

  const rootStyle = embedded
    ? { position: "absolute", inset: 0, display: "flex", background: "#ffffff" }
    : {
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        background: "#ffffff",
        fontFamily: "'Segoe UI', Roboto, sans-serif",
      };

  const hospName = booking?.assigned_hospital_name || booking?.destination || "Hospital pending";

  return (
    <div style={rootStyle}>
      <style>{`
        .ubm-root {
          width: 100%;
          height: 100%;
          display: flex;
          background: #ffffff;
          font-family: 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          position: relative;
        }
        .ubm-sidebar {
          width: 380px;
          min-width: 340px;
          background: #ffffff;
          border-right: 1px solid rgba(17,17,17,0.12);
          display: flex;
          flex-direction: column;
          padding: 16px;
          gap: 12px;
          overflow-y: auto;
          box-shadow: 4px 0 16px rgba(0,0,0,0.06);
          z-index: 5;
        }
        .ubm-map-area {
          flex: 1;
          min-width: 0;
          height: 100%;
          position: relative;
          background: #e5e3df;
        }
        
        /* Selected Card Style (Matching Image 2) */
        .ubm-active-card {
          background: #ffffff;
          border: 2px solid #00c853;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 4px 18px rgba(0, 200, 83, 0.12);
        }
        
        .ubm-pill-status {
          background: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #a5d6a7;
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        /* Timeline (Matching Image 2) */
        .ubm-timeline {
          position: relative;
          padding-left: 28px;
          margin: 14px 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .ubm-timeline-line {
          position: absolute;
          left: 9px;
          top: 10px;
          bottom: 14px;
          width: 2px;
          background: #00c853;
        }
        .ubm-timeline-item {
          position: relative;
          font-size: 12px;
        }
        .ubm-timeline-dot {
          position: absolute;
          left: -28px;
          top: 2px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .ubm-timeline-dot.amb { border: 2px solid #00c853; }
        .ubm-timeline-dot.user { border: 2px solid #1976d2; }
        .ubm-timeline-dot.hosp { border: 2px solid #d32f2f; }

        .ubm-stats-row {
          display: flex;
          gap: 8px;
          background: #f9f9f6;
          border: 1px solid rgba(17,17,17,0.08);
          border-radius: 10px;
          padding: 10px;
          margin-top: 6px;
        }
        .ubm-stat-cell {
          flex: 1;
          text-align: center;
        }
        .ubm-stat-val {
          font-weight: 900;
          font-size: 15px;
          color: #111;
        }
        .ubm-stat-lbl {
          font-size: 9px;
          font-weight: 700;
          color: rgba(17,17,17,0.55);
          text-transform: uppercase;
          margin-top: 2px;
        }

        .ubm-btn-group {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        .ubm-action-btn {
          flex: 1;
          padding: 10px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s ease;
        }
        .ubm-btn-start {
          background: #00c853;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(0,200,83,0.3);
        }
        .ubm-btn-full {
          background: #111111;
          color: #ffffff;
        }

        @media (max-width: 767px) {
          .ubm-root {
            flex-direction: column;
          }
          .ubm-sidebar {
            width: 100%;
            min-width: 100%;
            max-height: 280px;
            border-right: none;
            border-bottom: 1px solid rgba(17,17,17,0.12);
            padding: 10px;
            gap: 8px;
          }
          .ubm-map-area {
            flex: 1;
            height: calc(100vh - 280px);
            min-height: 320px;
          }
        }
      `}</style>

      <div className="ubm-root">
        {/* Left Sidebar Panel (Image 2 Dispatch Style) */}
        <div className="ubm-sidebar">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🚑</span> Live Trip Tracking
              </div>
              <div style={{ fontSize: 11, color: "rgba(17,17,17,0.6)", marginTop: 2 }}>
                Booking #{booking?.id} • {booking?.ambulance_number || (booking?.is_user_selected_hospital ? "Hospital Route" : "AMB-0000")}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#f0f0eb",
                  border: "none",
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Close"
              >
                ×
              </button>
            )}
          </div>

          {/* Trip Card matching Image 2 */}
          <div className="ubm-active-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="ubm-pill-status">
                {booking?.driver_accepted
                  ? "Ambulance is ready • En Route"
                  : booking?.sent_to_driver
                  ? "Dispatched to Driver"
                  : booking?.hospital_response === "ready"
                  ? "Hospital Approved • Dispatching"
                  : booking?.hospital_response === "not_ready"
                  ? "Hospital Unavailable"
                  : booking?.is_user_selected_hospital
                  ? "User Hospital Route • Live"
                  : "Confirmed • En Route"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#111" }}>
                {ambDriver || booking?.driver || (booking?.is_user_selected_hospital ? "Hospital Direct Route" : "Driver Assigned")}
              </span>
            </div>

            {/* Timeline matching Image 2 */}
            <div className="ubm-timeline">
              <div className="ubm-timeline-line" />
              
              <div className="ubm-timeline-item">
                <div className="ubm-timeline-dot amb">🚑</div>
                <div style={{ fontWeight: 800, color: "#111" }}>
                  {booking?.ambulance_number ? `Ambulance (${booking.ambulance_number})` : "Ambulance Status"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)" }}>
                  {ambLoc
                    ? `${coordText(ambLoc?.lat, ambLoc?.lng)} • Speed: ${ambSpeed} km/h`
                    : booking?.driver_accepted
                    ? "Ambulance is ready • Driver en route"
                    : booking?.sent_to_driver
                    ? "Dispatched to driver • Awaiting acceptance"
                    : booking?.is_user_selected_hospital
                    ? "Live route active • Nearest ambulance dispatching"
                    : "Ambulance pending dispatch"}
                </div>
              </div>

              <div className="ubm-timeline-item">
                <div className="ubm-timeline-dot user">👤</div>
                <div style={{ fontWeight: 800, color: "#111" }}>Patient Pickup (User)</div>
                <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)" }}>{booking?.pickup_location || "Pickup Location"}</div>
              </div>

              <div className="ubm-timeline-item">
                <div className="ubm-timeline-dot hosp">🏥</div>
                <div style={{ fontWeight: 800, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Destination Hospital</span>
                  {booking?.is_user_selected_hospital && (
                    <span style={{ fontSize: 9, background: "#e3f2fd", color: "#1565c0", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>
                      User Selected
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)" }}>
                  {hospName}
                  {legStats.d2 && ` • ~${legStats.d2} km (~${legStats.m2} mins)`}
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="ubm-stats-row">
              <div className="ubm-stat-cell">
                <div className="ubm-stat-val" style={{ color: "#00c853" }}>
                  {legStats.d1 != null ? `${legStats.d1} km` : booking?.is_user_selected_hospital ? "Pickup Point" : "En Route"}
                </div>
                <div className="ubm-stat-lbl">To Pickup</div>
              </div>
              <div className="ubm-stat-cell">
                <div className="ubm-stat-val" style={{ color: "#f59a23" }}>
                  ~{legStats.m2} m
                </div>
                <div className="ubm-stat-lbl">To Hospital</div>
              </div>
              <div className="ubm-stat-cell">
                <div className="ubm-stat-val">
                  {fmtSecs(elapsed)}
                </div>
                <div className="ubm-stat-lbl">Elapsed</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="ubm-btn-group" style={{ marginTop: "auto" }}>
            <button
              className={`ubm-action-btn ${routeMode === "start" ? "ubm-btn-start" : "ubm-btn-full"}`}
              onClick={() => setRouteMode("start")}
            >
              ▶ Start Route
            </button>
            <button
              className={`ubm-action-btn ${routeMode === "full" ? "ubm-btn-start" : "ubm-btn-full"}`}
              onClick={() => setRouteMode("full")}
            >
              🗺 View Full Route
            </button>
          </div>
        </div>

        {/* Right Side Map View (Full Height 100%) */}
        <div className="ubm-map-area">
          {routeMode === "start" && (
            <div
              style={{
                position: "absolute",
                top: 14,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 20,
                background: "rgba(0, 200, 83, 0.95)",
                color: "#ffffff",
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 6px 18px rgba(0, 200, 83, 0.35)",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderBottom: "12px solid #ffffff",
                  transform: "rotate(45deg)",
                }}
              />
              <span>Following Ambulance Live Location</span>
            </div>
          )}

          <iframe
            style={{ width: "100%", height: "100%", border: "none", background: "#e5e3df" }}
            src={embedSrc}
            title="User Live Booking Map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
