/**
 * UserBookingMap.jsx — src/Components/UserBookingMap.jsx
 *
 * Clean Google Maps Embedded Map Engine (Matching HospitalPortal):
 * - Standardized Google Maps iframe engine for 100% stability across all roles.
 * - Single blue road route with native direction markers (saddr -> daddr).
 * - Zero double routes, zero SVG polyline shooting, zero repeating world tiles.
 */

import { useEffect, useMemo, useState } from "react";
import UnifiedMapHeader from "./UnifiedMapHeader";
import GoogleNavOverlay from "./GoogleNavOverlay";
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

export default function UserBookingMap({ booking, onClose, embedded = false }) {
  const [ambLoc, setAmbLoc] = useState(null);
  const [ambSpeed, setAmbSpeed] = useState(0);
  const [ambBattery, setAmbBattery] = useState(null);
  const [ambDriver, setAmbDriver] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [isFullRouteView, setIsFullRouteView] = useState(true);

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

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
    return { d1, m1, d2: "12.4", m2: 25 };
  }, [ambLoc, booking]);

  // ── Standard Google Maps Embed URLs (Matching HospitalPortal) ───────────────
  const mapEmbedSrc = useMemo(() => {
    const ambLat = ambLoc?.lat ?? Number(booking?.pickup_latitude);
    const ambLng = ambLoc?.lng ?? Number(booking?.pickup_longitude);
    const pickupLat = Number(booking?.pickup_latitude);
    const pickupLng = Number(booking?.pickup_longitude);
    const lat = isIndiaCoord(ambLat, ambLng) ? ambLat : isIndiaCoord(pickupLat, pickupLng) ? pickupLat : 28.6139;
    const lng = isIndiaCoord(ambLat, ambLng) ? ambLng : isIndiaCoord(pickupLat, pickupLng) ? pickupLng : 77.2090;
    return `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
  }, [ambLoc, booking]);

  const fullRouteEmbedSrc = useMemo(() => {
    const ambLat = ambLoc?.lat;
    const ambLng = ambLoc?.lng;
    const ambCoord = isIndiaCoord(ambLat, ambLng) ? `${ambLat},${ambLng}` : "";
    const pickupLat = Number(booking?.pickup_latitude);
    const pickupLng = Number(booking?.pickup_longitude);
    const pickupCoord = isIndiaCoord(pickupLat, pickupLng) ? `${pickupLat},${pickupLng}` : "";
    const pickupText = String(booking?.pickup_location || "").trim();
    const destText = String(booking?.assigned_hospital_name || booking?.destination || "Hospital").trim();

    const start = ambCoord || pickupCoord || pickupText || "Delhi, India";
    const end = destText || pickupCoord || pickupText || "Hospital, Delhi, India";
    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(start)}&daddr=${encodeURIComponent(end)}&dirflg=d`;
  }, [ambLoc, booking]);

  const rootStyle = embedded
    ? { position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "#ffffff" }
    : {
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        fontFamily: "'Segoe UI', Roboto, sans-serif",
      };

  const hospName = booking?.assigned_hospital_name || booking?.destination || "Hospital pending";

  return (
    <div style={rootStyle}>
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <UnifiedMapHeader
        ambulanceNumber={booking?.ambulance_number || "AMB-0000"}
        bookingId={booking?.id}
        driverName={ambDriver || booking?.driver || "-"}
        speed={ambSpeed}
        battery={ambBattery}
        pickupLocation={booking?.pickup_location || "Pickup"}
        destination={hospName}
        ambLat={ambLoc?.lat}
        ambLng={ambLoc?.lng}
        pickupLat={booking?.pickup_latitude}
        pickupLng={booking?.pickup_longitude}
        isFullRouteView={isFullRouteView}
        onToggleFullRoute={() => setIsFullRouteView((v) => !v)}
      />

      {/* ── Top Stats Strip ────────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fffef6",
          borderBottom: "1px solid rgba(20,20,20,0.12)",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {/* Leg 1 */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#126f1e", fontWeight: 900, fontSize: 18, lineHeight: 1 }}>
              {legStats.d1 != null ? `${legStats.d1} km · ~${legStats.m1} min` : "En Route"}
            </div>
            <div style={{ fontSize: 9, color: "rgba(17,17,17,0.5)", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 }}>
              Ambulance → Pickup
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: "rgba(17,17,17,0.1)" }} />

          {/* Leg 2 */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#f59a23", fontWeight: 900, fontSize: 18, lineHeight: 1 }}>
              ~{legStats.m2} min to Hospital
            </div>
            <div style={{ fontSize: 9, color: "rgba(17,17,17,0.5)", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 }}>
              Pickup → Hospital
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: "rgba(17,17,17,0.1)" }} />

          {/* Elapsed */}
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#111", fontWeight: 900, fontSize: 18, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {fmtSecs(elapsed)}
            </div>
            <div style={{ fontSize: 9, color: "rgba(17,17,17,0.5)", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 2 }}>
              Elapsed Time
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              background: "#fff3df",
              border: "1px solid #f59a23",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            🏥 {hospName}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#111111",
                color: "#ffffff",
                border: "none",
                fontSize: 16,
                cursor: "pointer",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── Map Frame ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 480 }}>
          {isFullRouteView && (
            <GoogleNavOverlay
              currentPos={{ lat: ambLoc?.lat, lng: ambLoc?.lng }}
              speed={ambSpeed}
              etaStr={legStats.d1 ? `${legStats.d1} km (${legStats.m1} min)` : "En Route"}
              driverName={ambDriver || booking?.driver || ""}
            />
          )}
          <iframe
            style={{ width: "100%", height: "100%", border: "none", background: "#e5e3df" }}
            src={isFullRouteView ? fullRouteEmbedSrc : mapEmbedSrc}
            title="User Live Booking Map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
