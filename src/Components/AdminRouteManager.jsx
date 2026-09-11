/**
 * AdminRouteManager.jsx — src/Components/AdminRouteManager.jsx
 *
 * Clean Google Maps Embedded Map Engine (Matching Image 3 style):
 * - Fixed yellow Best Route card bottom truncation issue.
 * - Blocked "More options" external Google redirect link overlay completely.
 * - Full 3-point route chain: Ambulance Live Location -> User Pickup -> Hospital.
 */

import { useEffect, useMemo, useState } from "react";
import UnifiedMapHeader from "./UnifiedMapHeader";
import { geocodeInIndia, isIndiaCoord, normalizePlace } from "../hooks/useLeaflet";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const statusColor = { available: "#126f1e", en_route: "#f59a23", busy: "#666666", offline: "#999999" };

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
  const [routeMode, setRouteMode] = useState("full"); // "start" | "full"

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

  // ── Route Embed URL (3-Point Chain: Ambulance -> User Pickup -> Hospital) ───
  const embedSrc = useMemo(() => {
    const ambLat = Number(selAmb?.latitude);
    const ambLng = Number(selAmb?.longitude);
    const ambCoord = isIndiaCoord(ambLat, ambLng) ? `${ambLat},${ambLng}` : "";
    
    const pickupLat = Number(selBook?.pickup_latitude);
    const pickupLng = Number(selBook?.pickup_longitude);
    const pickupCoordStr = isIndiaCoord(pickupLat, pickupLng) ? `${pickupLat},${pickupLng}` : "";
    const pickupText = String(selBook?.pickup_location || "").trim();

    const destLat = Number(destCoord?.lat);
    const destLng = Number(destCoord?.lng);
    const destCoordStr = isIndiaCoord(destLat, destLng) ? `${destLat},${destLng}` : "";
    const destText = String(selBook?.assigned_hospital_address || selBook?.assigned_hospital_name || selBook?.destination || "").trim();

    const startPt = ambCoord || pickupCoordStr || pickupText || "28.73724,77.30666";
    const viaPt = pickupCoordStr || pickupText;
    const endPt = destCoordStr || destText || "Saharda Hospital, Ghaziabad, Uttar Pradesh, India";

    let daddrStr = encodeURIComponent(endPt);
    if (viaPt && viaPt !== startPt && viaPt !== endPt) {
      daddrStr = `${encodeURIComponent(viaPt)}+to:${encodeURIComponent(endPt)}`;
    }

    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(startPt)}&daddr=${daddrStr}&dirflg=d`;
  }, [selAmb, selBook, destCoord, routeMode]);

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
      setRouteMode("full");
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
        .arm-root { display:flex; width:100%; height:calc(100vh - 140px); min-height:550px; background:#f4f4ef; font-family:'Segoe UI',sans-serif; }
        .arm-panel { width:380px; min-width:340px; background:#fff; border-right:1px solid rgba(17,17,17,0.12); display:flex; flex-direction:column; }
        .arm-panel-header { padding:12px 14px; border-bottom:1px solid rgba(17,17,17,0.08); }
        .arm-panel-inner { flex:1; overflow-y:auto; padding:10px 10px 80px; display:flex; flex-direction:column; gap:8px; }
        .arm-box { background:#f9f9f5; border:1px solid rgba(17,17,17,0.12); border-radius:10px; padding:10px; }
        .arm-box-label { font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:rgba(17,17,17,0.56); margin-bottom:8px; }
        .arm-list { max-height:170px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; }
        .arm-item { background:#fff; border:1px solid rgba(18,111,30,0.32); border-radius:8px; padding:8px 10px; cursor:pointer; transition:background 0.12s, border-color 0.12s; }
        .arm-item:hover { background:#fff3df; border-color:#f59a23; }
        .arm-item.sel { background:#f59a23; border-color:#f59a23; color:#111; }
        .arm-item.sel :is(div, span, b) { color:#111 !important; }
        .arm-find-btn,.arm-push-btn { width:100%; border:none; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
        .arm-find-btn { background:#ffffff; color:#111; padding:10px 0; margin-bottom:8px; font-size:13px; border:1px solid rgba(17,17,17,0.2); }
        .arm-find-btn:disabled,.arm-push-btn:disabled { background:#d7d7cd; color:rgba(17,17,17,0.45); cursor:not-allowed; }
        .arm-route-card { background:#fff8e1; border:1.5px solid #ffa000; border-radius:12px; padding:12px; margin-top:10px; margin-bottom:24px; box-shadow:0 6px 20px rgba(255,160,0,0.22); flex-shrink:0; }
        .arm-push-btn { background:#111; color:#fff; padding:10px 0; margin-top:8px; font-size:13px; border:1px solid rgba(255,255,255,0.1); }
        .arm-map { flex:1; min-width:0; position:relative; overflow:hidden !important; }
        .arm-toast { position:fixed; top:68px; right:16px; z-index:9999; padding:11px 16px; border-radius:8px; font-size:12px; font-weight:700; box-shadow:0 8px 24px rgba(0,0,0,0.22); }
        .arm-toast.success { background:#ffffff; color:#111; }
        .arm-toast.error { background:#373737; color:#fff; }
        .arm-map-frame { width:100%; height:100%; min-height:540px; border:none; background:#e5e3df; }
        
        /* Opaque cover card hiding Google's top-left white card & "More options" link 100% */
        .arm-map-header-cover {
          position: absolute;
          top: 0;
          left: 0;
          width: 360px;
          height: 110px;
          z-index: 10;
          background: #ffffff;
          border-right: 1px solid rgba(17,17,17,0.12);
          border-bottom: 1px solid rgba(17,17,17,0.12);
          border-bottom-right-radius: 12px;
          padding: 10px 14px;
          pointer-events: auto;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        @media (max-width:767px) {
          .arm-root { flex-direction:column; }
          .arm-panel { width:100%; min-width:100%; max-height:calc(100vh - 220px); border-right:none; border-bottom:1px solid rgba(17,17,17,0.12); }
          .arm-panel-inner { padding-bottom:96px; }
          .arm-map { height:380px; min-height:300px; }
        }
      `}</style>

      <div className="arm-root">
        {toast && <div className={`arm-toast ${toast.type}`}>{toast.msg}</div>}

        <div style={{ display: "flex", flex: 1, height: "100%", width: "100%" }}>
          <div className="arm-panel">
            <div className="arm-panel-header">
              <div style={{ fontWeight: 800, fontSize: 14 }}>Route Manager</div>
              <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>Google Maps direction engine</div>
            </div>

            <div className="arm-panel-inner">
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
                  routeMode={routeMode}
                  onSetRouteMode={(mode) => setRouteMode(mode)}
                />
              )}
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
                  <div style={{ fontWeight: 800, marginBottom: 5, color: "#b78103", fontSize: 13 }}>★ Best Route Calculated</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                    {routeStats.distKm} km · ~{routeStats.mins} min
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)", marginTop: 2 }}>
                    Ambulance ➔ User Pickup ➔ Hospital
                  </div>
                  <button className="arm-push-btn" onClick={pushRoute} disabled={pushing}>
                    {pushing ? "Sending…" : "Send To Driver"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="arm-map">
            <iframe
              className="arm-map-frame"
              src={embedSrc}
              title="Admin Route Manager Map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </>
  );
}
