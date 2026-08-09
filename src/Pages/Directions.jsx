import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UserBookingMap from "../Components/UserBookingMap";
import useLeaflet, { DELHI, makePinIcon, fetchRoadRoute, LIGHT_TILE } from "../hooks/useLeaflet";

const BASE = "http://127.0.0.1:8000";

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
  const hLat = parseFloat(hospital?.latitude);
  const hLng = parseFloat(hospital?.longitude);
  if (inIndia(hLat, hLng)) return { lat: hLat, lng: hLng };

  // 2. Geocode with fallbacks
  const address = hospital?.address || "";
  return nominatimGeocode([
    address ? `${name}, ${address}, India` : null,
    `${name} hospital Delhi NCR, India`,
    `${name}, India`,
  ]);
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
    pickup_landmark: state.pickup_landmark || "",
    pickup_city: state.pickup_city || "",
    pickup_district: state.pickup_district || "",
    status: state.status || "confirmed",
    sent_to_driver: true,
  };
};

// ── HospitalLiveMap — uses local override map instead of hook's stale map ────
const HospitalLiveMap = ({ hospital, onClose }) => {
  const mapRef     = useRef(null);
  const leafletReady = useLeaflet();
  const [driverLoc, setDriverLoc] = useState(null);
  const [hospCoord, setHospCoord] = useState(null);

  // Get user's GPS location
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setDriverLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error("GPS error:", err)
    );
  }, []);

  // Resolve hospital coordinates using our fixed logic
  useEffect(() => {
    resolveHospitalCoord(hospital).then((coord) => {
      if (coord) setHospCoord(coord);
    });
  }, [hospital]);

  useEffect(() => {
    if (!leafletReady || !window.L || !mapRef.current || !hospCoord) return;
    const L = window.L;
    const m = L.map(mapRef.current, { zoomControl: false });
    L.tileLayer(LIGHT_TILE, { maxZoom: 19, attribution: "© Google Maps" }).addTo(m);

    L.marker([hospCoord.lat, hospCoord.lng], { icon: makePinIcon("#00d4aa", "🏥") })
      .addTo(m)
      .bindPopup(`<div style="font-weight:700;">${hospital.name || "Hospital"}</div>`)
      .openPopup();

    if (driverLoc) {
      L.marker([driverLoc.lat, driverLoc.lng], { icon: makePinIcon("#f7c948", "📍") })
        .addTo(m)
        .bindPopup("Your Location");
      fetchRoadRoute([driverLoc, hospCoord])
        .then((pts) => {
          if (pts?.length > 1) {
            L.polyline(pts, { color: "#e50914", weight: 6, opacity: 0.9 }).addTo(m);
            m.fitBounds(L.latLngBounds(pts), { padding: [60, 60] });
          } else {
            m.fitBounds(L.latLngBounds([driverLoc, hospCoord]), { padding: [60, 60] });
          }
        })
        .catch(() => m.fitBounds(L.latLngBounds([driverLoc, hospCoord]), { padding: [60, 60] }));
    } else {
      m.setView([hospCoord.lat, hospCoord.lng], 15);
    }

    return () => m.remove();
  }, [leafletReady, hospCoord, driverLoc, hospital]);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%", background: "#f5f5f5" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
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
          marginTop: 10, background: "rgba(229, 9, 20, 0.15)", color: "#111",
          padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 700,
          border: "1px solid rgba(229, 9, 20, 0.15)",
        }}>
          Tracking Hospital Location
        </div>
      </div>

      {!hospCoord && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", background: "rgba(245,245,245,0.9)", zIndex: 99,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid rgba(17,17,17,0.1)",
              borderTop: "3px solid #e50914", borderRadius: "50%",
              margin: "0 auto 10px", animation: "dir-spin 0.8s linear infinite",
            }} />
            <p style={{ color: "rgba(17,17,17,0.5)", fontSize: 13 }}>Locating hospital…</p>
          </div>
        </div>
      )}
      <style>{`@keyframes dir-spin { to { transform: rotate(360deg); } }`}</style>
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
              border: "1px solid rgba(17,17,17,0.15)", background: "#e50914",
              borderRadius: 10, padding: "10px 16px", fontWeight: 700, cursor: "pointer",
            }}
          >
            Go To My Bookings
          </button>
        </div>
      </div>
    );
  }

  return <UserBookingMap booking={booking} onClose={() => navigate("/MyBookings")} embedded={false} />;
}
