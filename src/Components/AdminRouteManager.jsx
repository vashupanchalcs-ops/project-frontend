/**
 * AdminRouteManager.jsx — src/Components/AdminRouteManager.jsx
 *
 * Professional Aarogya Live Command Center & Dispatch Engine:
 * - Powered by TomTom Orbis + MapLibre Map Engine (TomTomLiveMap).
 * - Real-time traffic-aware routing from backend POST /api/route/.
 * - Live ambulance tracking with polyline progress interpolation (useAmbulanceTracking).
 * - Traffic analysis panel (TrafficETAPanel): free-flow vs historic vs live ETA, turn-by-turn steps.
 * - Graceful fallback to MapLibre Positron and straight line if API key or offline.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import UnifiedMapHeader from "./UnifiedMapHeader";
import TomTomLiveMap from "./TomTomLiveMap";
import TrafficETAPanel from "./TrafficETAPanel";
import useAmbulanceTracking, { haversineM } from "../hooks/useAmbulanceTracking";
import { geocodeInIndia, isIndiaCoord, normalizePlace } from "../hooks/useLeaflet";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const statusColor = { available: "#126f1e", en_route: "#f59a23", busy: "#666666", offline: "#999999" };

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

  const [routeData, setRouteData] = useState(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [routeStats, setRouteStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [toast, setToast] = useState(null);
  const [routeMode, setRouteMode] = useState("full"); // "start" | "full"

  const clearRoutePreview = () => {
    setPickupCoord(null);
    setDestCoord(null);
    setRouteData(null);
    setRouteStats(null);
    setActiveRouteIndex(0);
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
      } catch (err) {
        console.warn("Error loading fleet data:", err);
      }
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
    setTimeout(() => setToast(null), 2800);
  };

  // ── Hook: Live Ambulance Tracking ──────────────────────────────────────────
  const handleRerouteNeeded = useCallback((info) => {
    showToast(`Ambulance deviated ${info.deviationM}m from route. Refreshing...`, "error");
  }, []);

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
    currentStepIndex,
  } = useAmbulanceTracking({
    ambulanceId: selAmb?.id || selAmb?.ambulance_id,
    ambulanceNumber: selAmb?.ambulance_number,
    routeData,
    destinationLoc: destCoord,
    pollIntervalMs: 4000,
    deviationThresholdM: 150,
    onRerouteNeeded: handleRerouteNeeded,
  });

  // Effective ambulance coordinates
  const liveAmbulanceCoord = useMemo(() => {
    if (ambulanceLoc && Number.isFinite(ambulanceLoc.lat) && Number.isFinite(ambulanceLoc.lng)) {
      return ambulanceLoc;
    }
    const lat = Number(selAmb?.latitude);
    const lng = Number(selAmb?.longitude);
    if (isIndiaCoord(lat, lng)) {
      return { lat, lng, heading: Number(selAmb?.heading) || 0, speed: selAmb?.speed || 0 };
    }
    return { lat: 28.7372, lng: 77.3066, heading: 0, speed: 0 };
  }, [ambulanceLoc, selAmb]);

  // ── Resolve coordinates ─────────────────────────────────────────────────────
  const resolveCoords = async (booking) => {
    const pickupQuery = [booking.pickup_landmark, booking.pickup_city, booking.pickup_district]
      .filter(Boolean)
      .join(", ");
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
    const destination = hospitalFromDb || hospitalFromText || { lat: 28.5355, lng: 77.391 };
    return { pickup, destination };
  };

  // ── Find Route via Backend TomTom API ───────────────────────────────────────
  const findRoute = async () => {
    if (!selAmb) return showToast("Select an ambulance first", "error");
    if (!selBook) return showToast("Select a booking first", "error");
    setLoading(true);
    setRouteData(null);
    setRouteStats(null);
    setActiveRouteIndex(0);

    try {
      const ambCoord = liveAmbulanceCoord;
      const { pickup, destination } = await resolveCoords(selBook);
      setPickupCoord(pickup);
      setDestCoord(destination);

      // Call backend TomTom routing endpoint
      const response = await fetch(`${BASE}/api/route/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_lat: ambCoord.lat,
          origin_lng: ambCoord.lng,
          dest_lat: destination.lat,
          dest_lng: destination.lng,
          travel_mode: "car",
          max_alternatives: 2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.geometry && data.geometry.coordinates) {
          setRouteData(data);
          const distKm = ((data.distance_m || 0) / 1000).toFixed(1);
          const mins = Math.max(1, Math.round((data.duration_s || 0) / 60));
          const isTransfer = Boolean(selBook.transfer_requested || selBook.transferred_to_ambulance_number);
          setRouteStats({ distKm, mins, isTransfer });
          showToast(`Traffic Route: ${distKm} km · ~${mins} min (TomTom Live)`);
          return;
        }
      }

      // Fallback if API fails or backend offline: build interpolated straight-line GeoJSON
      console.warn("Backend routing API returned non-OK, using fallback estimation");
      const d1 = haversineM(ambCoord, pickup);
      const d2 = haversineM(pickup, destination);
      const totalM = d1 + d2;
      const totalKm = (totalM / 1000).toFixed(1);
      const mins = Math.max(1, Math.round((totalM / 1000 / 28) * 60));
      const isTransfer = Boolean(selBook.transfer_requested || selBook.transferred_to_ambulance_number);

      const fallbackRoute = {
        distance_m: totalM,
        duration_s: mins * 60,
        traffic_delay_s: 0,
        no_traffic_s: mins * 60,
        historic_s: mins * 60,
        live_s: mins * 60,
        traffic_sections: [],
        steps: [
          { instruction: "Proceed from Ambulance towards Patient Pickup", distance_m: d1, turn_type: "START" },
          { instruction: "Arrive at Patient Pickup Location", distance_m: 0, turn_type: "ARRIVE" },
          { instruction: "Proceed towards Hospital", distance_m: d2, turn_type: "STRAIGHT" },
          { instruction: "Arrive at Destination Hospital", distance_m: 0, turn_type: "FINISH" },
        ],
        geometry: {
          type: "LineString",
          coordinates: [
            [ambCoord.lng, ambCoord.lat],
            [pickup.lng, pickup.lat],
            [destination.lng, destination.lat],
          ],
        },
      };

      setRouteData(fallbackRoute);
      setRouteStats({ distKm: totalKm, mins, isTransfer });
      showToast(`Direct Estimate: ${totalKm} km · ~${mins} min`);
    } catch (e) {
      console.error("Route calculation error:", e);
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
          polyline: routeData?.geometry?.coordinates ? JSON.stringify(routeData.geometry.coordinates) : "",
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
        .arm-find-btn { background:#111827; color:#fff; padding:10px 0; margin-bottom:8px; font-size:13px; border:1px solid rgba(17,17,17,0.2); }
        .arm-find-btn:disabled,.arm-push-btn:disabled { background:#d7d7cd; color:rgba(17,17,17,0.45); cursor:not-allowed; }
        .arm-route-card { background:#fff8e1; border:1.5px solid #ffa000; border-radius:12px; padding:12px; margin-top:8px; margin-bottom:12px; box-shadow:0 6px 20px rgba(255,160,0,0.22); flex-shrink:0; }
        .arm-push-btn { background:#111; color:#fff; padding:10px 0; margin-top:8px; font-size:13px; border:1px solid rgba(255,255,255,0.1); }
        .arm-map { flex:1; min-width:0; position:relative; overflow:hidden !important; display:flex; flex-direction:column; }
        .arm-toast { position:fixed; top:68px; right:16px; z-index:9999; padding:11px 16px; border-radius:8px; font-size:12px; font-weight:700; box-shadow:0 8px 24px rgba(0,0,0,0.22); }
        .arm-toast.success { background:#ffffff; color:#111; border:1px solid #10b981; }
        .arm-toast.error { background:#373737; color:#fff; border:1px solid #ef4444; }

        /* Off-route deviation alert pill */
        .arm-offroute-pill {
          position: absolute;
          top: 14px;
          right: 60px;
          z-index: 25;
          background: #ef4444;
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
          animation: pulse 1.5s infinite;
        }

        /* Top control header overlay */
        .arm-map-header-cover {
          position: absolute;
          top: 0;
          left: 0;
          width: 360px;
          height: auto;
          min-height: 80px;
          z-index: 20;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
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
          {/* Left Control Panel */}
          <div className="arm-panel">
            <div className="arm-panel-header">
              <div style={{ fontWeight: 800, fontSize: 14 }}>Route Manager</div>
              <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>
                TomTom Orbis Live Traffic Engine
              </div>
            </div>

            <div className="arm-panel-inner">
              {selAmb && (
                <UnifiedMapHeader
                  ambulanceNumber={selAmb?.ambulance_number || "AMB-0000"}
                  bookingId={selBook?.id}
                  driverName={driverName || selAmb?.driver || "-"}
                  speed={speed}
                  battery={battery ?? selAmb?.battery_percentage ?? "-"}
                  pickupLocation={selBook?.pickup_location || "Pickup"}
                  destination={selBook?.assigned_hospital_name || selBook?.destination || "Assigned Hospital"}
                  ambLat={liveAmbulanceCoord.lat}
                  ambLng={liveAmbulanceCoord.lng}
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

              {/* Find Route Button */}
              <button className="arm-find-btn" onClick={findRoute} disabled={loading}>
                {loading ? "Calculating Live Traffic Route…" : "Find Traffic-Aware Route"}
              </button>

              {/* Action Card to Send Route to Driver */}
              {routeStats && (
                <div
                  className="arm-route-card"
                  style={{
                    background: routeStats.isTransfer ? "#fef2f2" : "#eff6ff",
                    borderColor: routeStats.isTransfer ? "#dc2626" : "#2563eb",
                    boxShadow: routeStats.isTransfer ? "0 6px 20px rgba(220,38,38,0.22)" : "0 6px 20px rgba(37,99,235,0.22)",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 5, color: routeStats.isTransfer ? "#b91c1c" : "#1d4ed8", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{routeStats.isTransfer ? "🚨 Emergency Transfer Route" : "⚡ Active Dispatch Route"}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
                    {remainingDistanceM != null
                      ? `${(remainingDistanceM / 1000).toFixed(1)} km remaining · ~${Math.max(1, Math.round(remainingEtaS / 60))} min`
                      : `${routeStats.distKm} km · ~${routeStats.mins} min`}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)", marginTop: 2 }}>
                    Ambulance ➔ User Pickup ➔ Hospital
                  </div>
                  <button className="arm-push-btn" onClick={pushRoute} disabled={pushing} style={{ background: routeStats.isTransfer ? "#dc2626" : "#2563eb" }}>
                    {pushing ? "Sending…" : "Send To Driver"}
                  </button>
                </div>
              )}

              {/* Traffic ETA Panel & Step-by-Step Guidance */}
              {routeData && (
                <div style={{ marginTop: 8 }}>
                  <TrafficETAPanel
                    routeData={routeData}
                    activeRouteIndex={activeRouteIndex}
                    onSelectRouteIndex={(idx) => setActiveRouteIndex(idx)}
                    currentStepIndex={currentStepIndex}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right Map Canvas (TomTom Orbis Live Map Engine) */}
          <div className="arm-map">
            {/* Top-Left Target & Status Overlay */}
            <div className="arm-map-header-cover">
              <div style={{ fontSize: 13, fontWeight: 900, color: "#111", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🚑</span> {selAmb?.ambulance_number || "Aarogya Fleet"}
                {speed > 0 && (
                  <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4 }}>
                    {speed} km/h
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Target: {selBook?.assigned_hospital_name || selBook?.destination || "Hospital"}
              </div>
              <div style={{ fontSize: 10, color: "#666", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Pickup: {selBook?.pickup_location || "Patient Location"}
              </div>
            </div>

            {/* Off-route deviation alert */}
            {isOffRoute && (
              <div className="arm-offroute-pill">
                <span>⚠️</span>
                <span>Off-route by {deviationM}m</span>
              </div>
            )}

            {/* High-Performance TomTom / MapLibre Engine */}
            <TomTomLiveMap
              ambulanceLoc={liveAmbulanceCoord}
              pickupLoc={pickupCoord ? { ...pickupCoord, label: selBook?.pickup_location } : null}
              destinationLoc={destCoord ? { ...destCoord, name: selBook?.assigned_hospital_name || selBook?.destination } : null}
              routeData={routeData}
              followAmbulance={routeMode === "start"}
              loading={loading}
              height="100%"
            />
          </div>
        </div>
      </div>
    </>
  );
}
