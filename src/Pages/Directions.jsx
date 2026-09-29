import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FlutterTrackingFrame from "../Components/FlutterTrackingFrame";

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const normalizePlace = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/saharda/g, "sharda")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const inIndia = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

const HOSPITAL_LOCATION_FALLBACKS = [
  { terms: ["sharda", "saharda"], lat: 28.4744, lng: 77.5030 },
  { terms: ["noida"], lat: 28.5355, lng: 77.3910 },
  { terms: ["ghaziabad", "loni"], lat: 28.6692, lng: 77.4538 },
  { terms: ["delhi", "new delhi"], lat: 28.6139, lng: 77.2090 },
];

const fallbackHospitalCoord = (hospital) => {
  const locationText = [
    hospital?.name,
    hospital?.address,
    hospital?.city,
    hospital?.district,
    hospital?.location,
  ].filter(Boolean).join(" ");
  const normalized = normalizePlace(locationText);
  return HOSPITAL_LOCATION_FALLBACKS.find(({ terms }) => terms.some((term) => normalized.includes(term)))
    || null;
};

// Multi-query Nominatim fallback
async function nominatimGeocode(queries) {
  for (const q of queries) {
    if (!q) continue;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (inIndia(lat, lng)) return { lat, lng };
      }
    } catch {}
  }
  return null;
}

async function resolveHospitalCoord(hospital) {
  const name = hospital?.name || "";
  const key  = normalizePlace(name);

  // 1. Coords already on hospital object
  const hLat = parseFloat(hospital?.latitude ?? hospital?.lat ?? hospital?.location?.lat);
  const hLng = parseFloat(hospital?.longitude ?? hospital?.lng ?? hospital?.location?.lng);
  if (inIndia(hLat, hLng)) return { lat: hLat, lng: hLng };

  // Correct the known spelling variant before geocoding. If the service is
  // unavailable, render an approximate city marker instead of an endless loader.
  const searchName = key.includes("sharda") ? "Sharda Hospital" : name;
  const address = hospital?.address || hospital?.city || hospital?.district || "";
  return (await nominatimGeocode([
    address ? `${searchName}, ${address}, India` : null,
    `${searchName} Delhi NCR, India`,
    `${searchName}, India`,
  ])) || fallbackHospitalCoord(hospital) || null;
}

const buildBookingFromState = (state) => {
  if (!state) return null;
  const bookingId = Number(state.bookingId || state.id || 0);
  if (!bookingId) return null;
  return {
    id: bookingId,
    ambulance_id: Number(state.ambulanceId || state.ambulance_id || 0) || null,
    ambulance_number: state.ambulanceNumber || state.ambulance_number || "",
    assigned_hospital_name: state.hospital || state.assigned_hospital_name || "",
    destination: state.destination || "",
    pickup_location: state.pickupLocation || state.pickup_location || "",
    pickup_latitude: state.pickup_latitude ?? state.pickupLat ?? null,
    pickup_longitude: state.pickup_longitude ?? state.pickupLng ?? null,
    pickup_landmark: state.pickup_landmark || "",
    pickup_city: state.pickup_city || "",
    pickup_district: state.pickup_district || "",
    status: state.status || "confirmed",
    sent_to_driver: true,
  };
};

// Hospital details opened from the user/driver hospital list use the shared
// Flutter map surface as the rest of the tracking experience.
const HospitalLiveMap = ({ hospital, onClose }) => {
  return (
    <div style={{ position: "relative", height: "100vh", width: "100%", background: "#f5f5f5" }}>
      <FlutterTrackingFrame role="user" title="User Flutter hospital map" />
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, left: 20, zIndex: 999,
          background: "#111", color: "#fff", padding: "10px 18px",
          borderRadius: 12, fontWeight: "800", cursor: "pointer",
          border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        ← Back
      </button>
      <div style={{
        position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 999,
        background: "#fff", padding: "14px 24px", borderRadius: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)", display: "flex",
        flexDirection: "column", alignItems: "center", minWidth: 280, textAlign: "center",
      }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#111" }}>🏥 {hospital.name}</div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4, fontWeight: 500 }}>{hospital.address}</div>
        <div style={{
          marginTop: 10, background: "rgba(255, 255, 255, 0.15)", color: "#111",
          padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 700,
          border: "1px solid rgba(255, 255, 255, 0.15)",
        }}>
          Tracking Hospital Location
        </div>
      </div>
    </div>
  );
};

export default function Directions() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const seedBooking = useMemo(() => buildBookingFromState(state), [state]);
  const [booking, setBooking] = useState(seedBooking);
  const [loading, setLoading] = useState(!seedBooking);

  const bookingId = Number(seedBooking?.id || state?.bookingId || 0);

  const refreshBooking = useCallback(async () => {
    if (!bookingId) { setLoading(false); return; }
    try {
      const res  = await fetch(`${BASE}/api/bookings/`);
      const rows = await res.json();
      const row  = (Array.isArray(rows) ? rows : []).find((b) => Number(b.id) === bookingId);
      if (row) setBooking(row);
    } catch {}
    setLoading(false);
  }, [bookingId]);

  useEffect(() => {
    refreshBooking();
    if (!bookingId) return undefined;
    const timer = setInterval(refreshBooking, 6000);
    return () => clearInterval(timer);
  }, [refreshBooking, bookingId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Segoe UI',sans-serif" }}>
        Loading live tracking...
      </div>
    );
  }

  if (!booking) {
    if (state?.hospital) {
      return <HospitalLiveMap hospital={state.hospital} onClose={() => navigate(-1)} />;
    }
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Tracking booking not found</div>
          <button
            onClick={() => navigate("/MyBookings")}
            style={{
              border: "1px solid rgba(17,17,17,0.15)", background: "#ffffff",
              borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer",
            }}
          >
            Go To My Bookings
          </button>
        </div>
      </div>
    );
  }

  return <FlutterTrackingFrame role="user" bookingId={booking.id} title="User Flutter directions map" />;
}
