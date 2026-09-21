/**
 * UserBookingMap.jsx — src/Components/UserBookingMap.jsx
 *
 * Real-Time Ambulance Tracking & Dispatch View for Users:
 * - Powered by Google Maps JavaScript, TrafficLayer, and route fallbacks.
 * - Real-time ambulance tracking with polyline progress interpolation (useAmbulanceTracking).
 * - Live dynamic ETA & remaining distance calculation (zero unnecessary API quota calls).
 * - Multi-segment traffic-aware polyline and emergency status indicators.
 * - Left 380px dispatch sidebar + Full-height interactive map canvas.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import GoogleMapEmbed from "./GoogleMapEmbed";
import useAmbulanceTracking, { haversineM } from "../hooks/useAmbulanceTracking";
import { isIndiaCoord } from "../hooks/useLeaflet";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const fmtSecs = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const coordText = (lat, lng) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || (nLat === 0 && nLng === 0)) return "Unavailable";
  return `${nLat.toFixed(5)}, ${nLng.toFixed(5)}`;
};

export default function UserBookingMap({ booking, onClose, embedded = false }) {
  const [elapsed, setElapsed] = useState(0);
  const [routeMode, setRouteMode] = useState("full"); // "start" | "full"
  const [hospCoords, setHospCoords] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState(null);

  useEffect(() => {
    const hasBookingCoords = isIndiaCoord(Number(booking?.pickup_latitude), Number(booking?.pickup_longitude));
    if (hasBookingCoords || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (isIndiaCoord(coords.latitude, coords.longitude)) {
          setDeviceLocation({ lat: coords.latitude, lng: coords.longitude, label: "Your current location" });
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [booking?.pickup_latitude, booking?.pickup_longitude]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch Hospital Coordinates ──────────────────────────────────────────────
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

  // ── Fetch Active Route Record from Backend ──────────────────────────────────
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
    return () => {
      cancel = true;
    };
  }, [booking?.id]);

  // ── Pickup & Destination coordinates ────────────────────────────────────────
  const pickupLoc = useMemo(() => {
    const pLat = Number(activeRoute?.pickup_lat || booking?.pickup_latitude || deviceLocation?.lat);
    const pLng = Number(activeRoute?.pickup_lng || booking?.pickup_longitude || deviceLocation?.lng);
    if (isIndiaCoord(pLat, pLng)) {
      return { lat: pLat, lng: pLng, label: booking?.pickup_location || "Patient Location" };
    }
    return { lat: 28.7371, lng: 77.3041, label: booking?.pickup_location || "Patient Location" };
  }, [activeRoute, booking, deviceLocation]);

  const destLoc = useMemo(() => {
    const dLat = Number(activeRoute?.dest_lat || hospCoords?.lat || booking?.destination_latitude);
    const dLng = Number(activeRoute?.dest_lng || hospCoords?.lng || booking?.destination_longitude);
    const name = booking?.assigned_hospital_name || booking?.destination || "Assigned Hospital";
    if (isIndiaCoord(dLat, dLng)) {
      return { lat: dLat, lng: dLng, name };
    }
    return { lat: 28.5355, lng: 77.391, name };
  }, [activeRoute, hospCoords, booking]);

  // ── Hook: Live Ambulance Tracking ──────────────────────────────────────────
  const {
    ambulanceLoc,
    heading,
    speed,
    battery,
    driverName,
    remainingDistanceM,
    remainingEtaS,
    deviationM,
    isOffRoute,
  } = useAmbulanceTracking({
    ambulanceId: booking?.ambulance_id,
    ambulanceNumber: booking?.ambulance_number,
    routeData,
    destinationLoc: destLoc,
    pollIntervalMs: 4000,
    deviationThresholdM: 150,
  });

  // Effective Ambulance Coordinates
  const effectiveAmbLoc = useMemo(() => {
    if (ambulanceLoc && Number.isFinite(ambulanceLoc.lat) && Number.isFinite(ambulanceLoc.lng)) {
      return ambulanceLoc;
    }
    return { lat: pickupLoc.lat - 0.005, lng: pickupLoc.lng - 0.005, heading: 0, speed: 0 };
  }, [ambulanceLoc, pickupLoc]);

  // ── Fetch or calculate the cached Google-backed route ───────────────────────
  useEffect(() => {
    if (!pickupLoc || !destLoc) return;

    let cancel = false;
    setRouteLoading(true);

    const fetchRoute = async () => {
      try {
        const startLat = effectiveAmbLoc.lat;
        const startLng = effectiveAmbLoc.lng;

        const res = await fetch(`${BASE}/api/route/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_lat: startLat,
            origin_lng: startLng,
            ambulance_lat: startLat,
            ambulance_lng: startLng,
            pickup_lat: pickupLoc.lat,
            pickup_lng: pickupLoc.lng,
            dest_lat: destLoc.lat,
            dest_lng: destLoc.lng,
            hospital_lat: destLoc.lat,
            hospital_lng: destLoc.lng,
            travel_mode: "car",
            max_alternatives: 1,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const normalizedRoute =
            data?.geometry?.coordinates?.length >= 2
              ? data
              : data?.best_route?.geometry?.coordinates?.length >= 2
              ? { ...data.best_route, alternatives: data.alternatives || [] }
              : null;
          if (!cancel && normalizedRoute) {
            setRouteData(normalizedRoute);
            setRouteLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("User route fetch error, using fallback geometry:", err);
      }

      // Fallback: straight-line GeoJSON line
      if (!cancel) {
        const d1 = haversineM(effectiveAmbLoc, pickupLoc);
        const d2 = haversineM(pickupLoc, destLoc);
        const totalM = d1 + d2;
        const mins = Math.max(1, Math.round((totalM / 1000 / 28) * 60));

        setRouteData({
          distance_m: totalM,
          duration_s: mins * 60,
          traffic_delay_s: 0,
          no_traffic_s: mins * 60,
          historic_s: mins * 60,
          live_s: mins * 60,
          traffic_sections: [],
          steps: [],
          geometry: {
            type: "LineString",
            coordinates: [
              [effectiveAmbLoc.lng, effectiveAmbLoc.lat],
              [pickupLoc.lng, pickupLoc.lat],
              [destLoc.lng, destLoc.lat],
            ],
          },
        });
      }
      setRouteLoading(false);
    };

    fetchRoute();

    return () => {
      cancel = true;
    };
  }, [booking?.id, destLoc.lat, destLoc.lng, pickupLoc.lat, pickupLoc.lng]);

  const hospName = booking?.assigned_hospital_name || booking?.destination || "Hospital pending";

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
          display: flex;
          flex-direction: column;
        }
        
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
        {/* Left Sidebar Panel */}
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

          {/* Trip Card */}
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
                {driverName || booking?.driver || (booking?.is_user_selected_hospital ? "Hospital Direct Route" : "Driver Assigned")}
              </span>
            </div>

            {/* Timeline */}
            <div className="ubm-timeline">
              <div className="ubm-timeline-line" />

              <div className="ubm-timeline-item">
                <div className="ubm-timeline-dot amb">🚑</div>
                <div style={{ fontWeight: 800, color: "#111" }}>
                  {booking?.ambulance_number ? `Ambulance (${booking.ambulance_number})` : "Ambulance Status"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)" }}>
                  {ambulanceLoc
                    ? `${coordText(ambulanceLoc.lat, ambulanceLoc.lng)} • Speed: ${speed} km/h`
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
                <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)" }}>{pickupLoc.label}</div>
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
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="ubm-stats-row">
              <div className="ubm-stat-cell">
                <div className="ubm-stat-val" style={{ color: "#00c853" }}>
                  {remainingDistanceM != null
                    ? `${(remainingDistanceM / 1000).toFixed(1)} km`
                    : "En Route"}
                </div>
                <div className="ubm-stat-lbl">Remaining</div>
              </div>
              <div className="ubm-stat-cell">
                <div className="ubm-stat-val" style={{ color: "#f59a23" }}>
                  {remainingEtaS != null
                    ? `~${Math.max(1, Math.round(remainingEtaS / 60))} m`
                    : "Calculating"}
                </div>
                <div className="ubm-stat-lbl">Live ETA</div>
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
              ▶ Follow Ambulance
            </button>
            <button
              className={`ubm-action-btn ${routeMode === "full" ? "ubm-btn-start" : "ubm-btn-full"}`}
              onClick={() => setRouteMode("full")}
            >
              🗺 View Full Route
            </button>
          </div>
        </div>

        {/* Right Side Map View (Google Maps live route engine) */}
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
              <span>🚑 Camera Following Live Ambulance</span>
            </div>
          )}

          <GoogleMapEmbed
            ambulanceLoc={effectiveAmbLoc}
            pickupLoc={pickupLoc}
            destinationLoc={destLoc}
            routeData={routeData}
            followAmbulance={routeMode === "start"}
            loading={routeLoading}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
}
