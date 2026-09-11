/**
 * AdminRouteManager.jsx — src/Components/AdminRouteManager.jsx
 *
 * Clean Google Maps Embedded Map Engine (Matching HospitalPortal):
 * - Standardized Google Maps iframe engine for 100% stability across all roles.
 * - Single blue road route with native direction markers (saddr -> daddr).
 * - Zero double routes, zero SVG polyline shooting, zero repeating world tiles.
 */

import { useEffect, useMemo, useState } from "react";
import UnifiedMapHeader from "./UnifiedMapHeader";
import GoogleNavOverlay from "./GoogleNavOverlay";
import { geocodeInIndia, isIndiaCoord, normalizePlace } from "../hooks/useLeaflet";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const statusColor = { available: "#126f1e", en_route: "#f59a23", busy: "#666666", offline: "#999999" };

const uniqueTextList = (values) => {
  const out = [], seen = new Set();
  for (const raw of values) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const key = normalizePlace(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
};

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

export default function AdminRouteManager({
  preSelectedDriver,
  preSelectedBookingId = null,
  preSelectedAmbulanceId = null,
}) {
  const [ambs, setAmbs] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selAmb, setSelAmb] = useState(null);
  const [selBook, setSelBook] = useState(null);
  const [pickupCoord, setPickupCoord] = useState(null);
  const [destCoord, setDestCoord] = useState(null);
  const [routeStats, setRouteStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [toast, setToast] = useState(null);
  const [isFullRouteView, setIsFullRouteView] = useState(false);

  const clearRoutePreview = () => {
    setPickupCoord(null);
    setDestCoord(null);
    setRouteStats(null);
  };

  const selectAmbulance = (ambulance) => {
    const nextId = Number(ambulance?.id || ambulance?.ambulance_id || 0);
    const currentId = Number(selAmb?.id || selAmb?.ambulance_id || 0);
    setSelAmb(ambulance);
    if (nextId !== currentId) {
      setSelBook(null);
      clearRoutePreview();
    }
  };

  const selectBooking = (booking) => {
    setSelBook(booking);
    clearRoutePreview();
  };

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, bRes, hRes] = await Promise.all([
          fetch(`${BASE}/api/ambulances/`),
          fetch(`${BASE}/api/bookings/`),
          fetch(`${BASE}/api/hospitals/`),
        ]);
        const [aRows, bRows, hRows] = await Promise.all([aRes.json(), bRes.json(), hRes.json()]);
        setAmbs(Array.isArray(aRows) ? aRows : []);
        setHospitals(Array.isArray(hRows) ? hRows : []);
        setBookings(
          (Array.isArray(bRows) ? bRows : []).filter(
            (b) => b.status === "confirmed" && b.sent_to_driver && !b.driver_task_completed
          )
        );
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    if (preSelectedDriver) setSelAmb(preSelectedDriver);
  }, [preSelectedDriver]);

  useEffect(() => {
    if (!preSelectedAmbulanceId || !ambs.length) return;
    const row = ambs.find((a) => Number(a.id) === Number(preSelectedAmbulanceId));
    if (row) setSelAmb(row);
  }, [preSelectedAmbulanceId, ambs]);

  const selectedAmbId = selAmb?.id || selAmb?.ambulance_id;
  const assignableBookings = useMemo(
    () => bookings.filter((b) => Number(b.ambulance_id) === Number(selectedAmbId)),
    [bookings, selectedAmbId]
  );

  useEffect(() => {
    if (!selBook) return;
    if (!assignableBookings.some((b) => b.id === selBook.id)) setSelBook(null);
  }, [assignableBookings, selBook]);

  useEffect(() => {
    if (!preSelectedBookingId || !assignableBookings.length) return;
    const row = assignableBookings.find((b) => Number(b.id) === Number(preSelectedBookingId));
    if (row) setSelBook(row);
  }, [preSelectedBookingId, assignableBookings]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Standard Google Maps Embed URLs (Exact match to HospitalPortal) ─────────
  const mapEmbedSrc = useMemo(() => {
    const ambLat = Number(selAmb?.latitude);
    const ambLng = Number(selAmb?.longitude);
    const pickupLat = Number(selBook?.pickup_latitude);
    const pickupLng = Number(selBook?.pickup_longitude);
    const lat = isIndiaCoord(ambLat, ambLng) ? ambLat : isIndiaCoord(pickupLat, pickupLng) ? pickupLat : 28.6139;
    const lng = isIndiaCoord(ambLat, ambLng) ? ambLng : isIndiaCoord(pickupLat, pickupLng) ? pickupLng : 77.2090;
    return `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
  }, [selAmb, selBook]);

  const fullRouteEmbedSrc = useMemo(() => {
    const ambLat = Number(selAmb?.latitude);
    const ambLng = Number(selAmb?.longitude);
    const ambCoord = isIndiaCoord(ambLat, ambLng) ? `${ambLat},${ambLng}` : "";
    const pickupLat = Number(selBook?.pickup_latitude);
    const pickupLng = Number(selBook?.pickup_longitude);
    const pickupCoord = isIndiaCoord(pickupLat, pickupLng) ? `${pickupLat},${pickupLng}` : "";
    const pickupText = String(selBook?.pickup_location || "").trim();

    const destLat = Number(destCoord?.lat);
    const destLng = Number(destCoord?.lng);
    const destCoordStr = isIndiaCoord(destLat, destLng) ? `${destLat},${destLng}` : "";
    const destText = String(selBook?.assigned_hospital_address || selBook?.assigned_hospital_name || selBook?.destination || "").trim();

    const start = ambCoord || pickupCoord || pickupText || "Delhi, India";
    const end = destCoordStr || destText || pickupCoord || pickupText || "Hospital, Delhi, India";
    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(start)}&daddr=${encodeURIComponent(end)}&dirflg=d`;
  }, [selAmb, selBook, destCoord]);

  // ── Resolve coordinates ─────────────────────────────────────────────────────
  const resolveCoords = async (booking) => {
    const pickupQuery = [booking.pickup_landmark, booking.pickup_city, booking.pickup_district]
      .filter(Boolean).join(", ");
    const pickupText = pickupQuery || booking.pickup_location || "";
    const destName = booking.assigned_hospital_name || booking.destination || "";
    const normalizedDest = normalizePlace(destName);

    const matchedHospital =
      hospitals.find((h) => Number(h.id) === Number(booking.assigned_hospital_id)) ||
      hospitals.find((h) => normalizePlace(h.name) === normalizedDest) ||
      hospitals.find((h) => normalizedDest && normalizePlace(h.name).includes(normalizedDest)) ||
      null;

    const dbLat = Number(matchedHospital?.latitude);
    const dbLng = Number(matchedHospital?.longitude);
    const hospitalFromDb = isIndiaCoord(dbLat, dbLng) ? { lat: dbLat, lng: dbLng } : null;

    const bookingPickupLat = Number(booking.pickup_latitude);
    const bookingPickupLng = Number(booking.pickup_longitude);
    const pickupFromBooking = isIndiaCoord(bookingPickupLat, bookingPickupLng)
      ? { lat: bookingPickupLat, lng: bookingPickupLng }
      : null;

    let pickupFromText = null;
    if (!pickupFromBooking && pickupText) {
      pickupFromText = await geocodeInIndia(pickupText, {
        city: booking.pickup_city || "",
        district: booking.pickup_district || "",
      });
    }

    let hospitalFromText = null;
    if (!hospitalFromDb && destName) {
      hospitalFromText = await geocodeInIndia(destName, {
        city: booking.pickup_city || "",
      });
    }

    const pickup = pickupFromBooking || pickupFromText || { lat: 28.7371, lng: 77.3041 };
    const destination = hospitalFromDb || hospitalFromText || { lat: 28.4744, lng: 77.5030 };
    return { pickup, destination };
  };

  // ── Find Route ──────────────────────────────────────────────────────────────
  const findRoute = async () => {
    if (!selAmb) return showToast("Select an ambulance first", "error");
    if (!selBook) return showToast("Select a booking first", "error");
    setLoading(true);
    setRouteStats(null);
    try {
      const ambCoord =
        Number.isFinite(Number(selAmb.latitude)) && Number.isFinite(Number(selAmb.longitude))
          ? { lat: Number(selAmb.latitude), lng: Number(selAmb.longitude) }
          : { lat: 28.7372, lng: 77.3066 };

      const { pickup, destination } = await resolveCoords(selBook);
      setPickupCoord(pickup);
      setDestCoord(destination);

      const legA = haversineKm(ambCoord, pickup) * 1.25;
      const legB = haversineKm(pickup, destination) * 1.25;
      const totalKm = (legA + legB).toFixed(1);
      const mins = Math.max(1, Math.round((totalKm / 28) * 60));

      const stats = { distKm: totalKm, mins };
      setRouteStats(stats);
      setIsFullRouteView(true);
      showToast(`Route calculated: ${stats.distKm} km · ~${stats.mins} min`);
    } catch (e) {
      showToast(e.message || "Route calculation error", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Push Route to Driver ────────────────────────────────────────────────────
  const pushRoute = async () => {
    if (!selAmb || !selBook || !routeStats) return;
    setPushing(true);
    try {
      const res = await fetch(`${BASE}/api/admin/suggest-route/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambulance_id: selAmb.id || selAmb.ambulance_id,
          booking_id: selBook.id,
          pickup_location: selBook.pickup_location,
          destination: selBook.assigned_hospital_name || selBook.destination || "Hospital",
          distance_km: `${routeStats.distKm} km`,
          duration: `${routeStats.mins} min`,
          polyline: "",
          pickup_lat: pickupCoord?.lat ?? null,
          pickup_lng: pickupCoord?.lng ?? null,
          dest_lat: destCoord?.lat ?? null,
          dest_lng: destCoord?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (data.id) showToast("Route sent to driver ✓");
      else showToast(data.error || "Failed to send route", "error");
    } catch {
      showToast("Server error while sending route", "error");
    } finally {
      setPushing(false);
    }
  };

  return (
    <>
      <style>{`
        .arm-root { display:flex; width:100%; min-height:calc(100vh - 140px); background:#f4f4ef; font-family:'Segoe UI',sans-serif; }
        .arm-panel { width:290px; min-width:290px; background:#fff; border-right:1px solid rgba(17,17,17,0.12); display:flex; flex-direction:column; }
        .arm-panel-header { padding:12px 14px; border-bottom:1px solid rgba(17,17,17,0.08); }
        .arm-panel-inner { flex:1; overflow:auto; padding:10px 10px 16px; display:flex; flex-direction:column; gap:8px; }
        .arm-box { background:#f9f9f5; border:1px solid rgba(17,17,17,0.12); border-radius:10px; padding:10px; }
        .arm-box-label { font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:rgba(17,17,17,0.56); margin-bottom:8px; }
        .arm-list { max-height:190px; overflow:auto; display:flex; flex-direction:column; gap:6px; }
        .arm-item { background:#fff; border:1px solid rgba(18,111,30,0.32); border-radius:8px; padding:8px 10px; cursor:pointer; transition:background 0.12s, border-color 0.12s; }
        .arm-item:hover { background:#fff3df; border-color:#f59a23; }
        .arm-item.sel { background:#f59a23; border-color:#f59a23; color:#111; }
        .arm-item.sel :is(div, span, b) { color:#111 !important; }
        .arm-find-btn,.arm-push-btn { width:100%; border:none; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
        .arm-find-btn { background:#ffffff; color:#111; padding:10px 0; margin-bottom:8px; font-size:13px; border:1px solid rgba(17,17,17,0.2); }
        .arm-find-btn:disabled,.arm-push-btn:disabled { background:#d7d7cd; color:rgba(17,17,17,0.45); cursor:not-allowed; }
        .arm-route-card { background:#ffffff; border:1px solid rgba(17,17,17,0.15); border-radius:10px; padding:10px; margin-top:4px; position:sticky; bottom:8px; z-index:5; box-shadow:0 10px 24px rgba(17,17,17,0.16); }
        .arm-push-btn { background:#111; color:#fff; padding:10px 0; margin-top:6px; font-size:13px; border:1px solid rgba(255,255,255,0.1); }
        .arm-map { flex:1; min-width:0; position:relative; overflow:hidden !important; }
        .arm-toast { position:fixed; top:68px; right:16px; z-index:9999; padding:11px 16px; border-radius:8px; font-size:12px; font-weight:700; box-shadow:0 8px 24px rgba(0,0,0,0.22); }
        .arm-toast.success { background:#ffffff; color:#111; }
        .arm-toast.error { background:#373737; color:#fff; }
        .arm-map-frame { width:100%; height:100%; min-height:540px; border:none; background:#e5e3df; }
        @media (max-width:767px) {
          .arm-root { flex-direction:column; }
          .arm-panel { width:100%; min-width:100%; max-height:calc(100vh - 220px); border-right:none; border-bottom:1px solid rgba(17,17,17,0.12); }
          .arm-panel-inner { padding-bottom:96px; }
          .arm-map { height:380px; min-height:300px; }
        }
      `}</style>

      <div className="arm-root" style={{ flexDirection: "column" }}>
        {toast && <div className={`arm-toast ${toast.type}`}>{toast.msg}</div>}

        {selAmb && (
          <UnifiedMapHeader
            ambulanceNumber={selAmb?.ambulance_number || "AMB-0000"}
            bookingId={selBook?.id}
            driverName={selAmb?.driver || "-"}
            speed={selAmb?.speed || 0}
            battery={selAmb?.battery_percentage ?? "-"}
            pickupLocation={selBook?.pickup_location || "Pickup"}
            destination={selBook?.assigned_hospital_name || selBook?.destination || "Assigned Hospital"}
            ambLat={selAmb?.latitude}
            ambLng={selAmb?.longitude}
            pickupLat={selBook?.pickup_latitude}
            pickupLng={selBook?.pickup_longitude}
            isFullRouteView={isFullRouteView}
            onToggleFullRoute={() => setIsFullRouteView((v) => !v)}
          />
        )}

        <div style={{ display: "flex", flex: 1, minHeight: 0, width: "100%" }}>
          <div className="arm-panel">
            <div className="arm-panel-header">
              <div style={{ fontWeight: 800, fontSize: 14 }}>Route Manager</div>
              <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>Google Maps direction engine</div>
            </div>

            <div className="arm-panel-inner">
              {/* Ambulance selector */}
              <div className="arm-box">
                <div className="arm-box-label">Select Ambulance</div>
                <div className="arm-list">
                  {ambs.map((a) => {
                    const selected = Number(selAmb?.id || selAmb?.ambulance_id) === Number(a.id);
                    const color = statusColor[a.status] || statusColor.offline;
                    return (
                      <div key={a.id} className={`arm-item ${selected ? "sel" : ""}`} onClick={() => selectAmbulance(a)}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <b>{a.ambulance_number}</b>
                          <span style={{ fontSize: 11, fontWeight: 700, color }}>{String(a.status || "").replace("_", " ")}</span>
                        </div>
                        <div style={{ fontSize: 11 }}>{a.driver}</div>
                        <div style={{ fontSize: 11, color: "rgba(17,17,17,0.7)" }}>{a.location || "-"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Booking selector */}
              <div className="arm-box">
                <div className="arm-box-label">Select Booking</div>
                <div className="arm-list">
                  {!selectedAmbId && (
                    <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>Select ambulance first</div>
                  )}
                  {selectedAmbId && assignableBookings.map((b) => (
                    <div key={b.id} className={`arm-item ${selBook?.id === b.id ? "sel" : ""}`} onClick={() => selectBooking(b)}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <b>#{b.id}</b>
                        <span style={{ fontSize: 11, color: "#00c853", fontWeight: 700 }}>{b.status}</span>
                      </div>
                      <div style={{ fontSize: 11 }}>{b.booked_by}</div>
                      <div style={{ fontSize: 11, color: "rgba(17,17,17,0.7)" }}>{b.pickup_location}</div>
                      <div style={{ fontSize: 11, color: "rgba(17,17,17,0.7)" }}>{b.assigned_hospital_name || b.destination || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button className="arm-find-btn" onClick={findRoute} disabled={loading}>
                {loading ? "Calculating route…" : "Find Route"}
              </button>

              {routeStats && (
                <div className="arm-route-card">
                  <div style={{ fontWeight: 800, marginBottom: 5 }}>Best Route</div>
                  <div style={{ fontSize: 12, color: "rgba(17,17,17,0.75)" }}>
                    {routeStats.distKm} km · ~{routeStats.mins} min
                  </div>
                  <button className="arm-push-btn" onClick={pushRoute} disabled={pushing}>
                    {pushing ? "Sending…" : "Send To Driver"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="arm-map">
            <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 540 }}>
              {isFullRouteView && (
                <GoogleNavOverlay
                  currentPos={{ lat: selAmb?.latitude, lng: selAmb?.longitude }}
                  speed={selAmb?.speed || 0}
                  etaStr={routeStats ? `${routeStats.distKm} km (${routeStats.mins} min)` : "En Route"}
                  driverName={selAmb?.driver || ""}
                />
              )}
              <iframe
                className="arm-map-frame"
                src={isFullRouteView ? fullRouteEmbedSrc : mapEmbedSrc}
                title="Admin Route Manager Map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
