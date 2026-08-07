/**
 * AdminRouteManager.jsx — src/Components/AdminRouteManager.jsx
 *
 * FIX: resolveCoords mein geocodeInIndia call karta hai jo LOCAL_HINTS se
 * Shiv Vihar ka correct coord (28.7419, 77.3158) return karega.
 * Pehle wrong coord (Ghaziabad) aa raha tha kyunki LOCAL_HINTS galat tha.
 *
 * Baaki sab same — sirf route display polish kiya gaya hai.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import useLeaflet, {
  DELHI,
  isIndiaCoord,
  geocodeInIndia,
  makePinIcon,
  normalizePlace,
  fetchRoadRoute,
  fetchNearestRoadPoint,
  LIGHT_TILE,
  SATELLITE_TILE,
} from "../hooks/useLeaflet";

const BASE = "http://127.0.0.1:8000";

const statusColor = {
  available: "#00c853",
  en_route:  "#f7c948",
  busy:      "#ff4d5a",
  offline:   "#8b8b8b",
};

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
  const R    = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// Path distance from [[lat,lng],...] — used for accurate route stats
const pathKm = (path = []) => {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    total += haversineKm(
      { lat: Number(a[0]), lng: Number(a[1]) },
      { lat: Number(b[0]), lng: Number(b[1]) }
    );
  }
  return total;
};

const toRoadStats = (leg1Path, leg2Path, ambCoord, pickup, destination) => {
  // Use actual path distances if available, otherwise haversine estimate
  const legA = leg1Path?.length > 1 ? pathKm(leg1Path) : haversineKm(ambCoord, pickup) * 1.22;
  const legB = leg2Path?.length > 1 ? pathKm(leg2Path) : (destination ? haversineKm(pickup, destination) * 1.22 : 0);
  const total = legA + legB;
  return {
    distKm: total.toFixed(1),
    mins:   Math.max(1, Math.round((total / 28) * 60)),
  };
};

export default function AdminRouteManager({
  preSelectedDriver,
  preSelectedBookingId   = null,
  preSelectedAmbulanceId = null,
}) {
  const leafletReady = useLeaflet();
  const mapRef       = useRef(null);
  const mapElRef     = useRef(null);
  const tileLayerRef = useRef(null);
  const layerRef     = useRef({
    amb: null, pickup: null, hospital: null,
    route1: null, route1Glow: null,
    route2: null, route2Glow: null,
    connector: null,
  });

  const [ambs,       setAmbs]       = useState([]);
  const [hospitals,  setHospitals]  = useState([]);
  const [bookings,   setBookings]   = useState([]);
  const [selAmb,     setSelAmb]     = useState(null);
  const [selBook,    setSelBook]    = useState(null);
  const [pickupCoord, setPickupCoord] = useState(null);
  const [destCoord,  setDestCoord]  = useState(null);
  const [routeLeg1,  setRouteLeg1]  = useState([]);
  const [routeLeg2,  setRouteLeg2]  = useState([]);
  const [routeStats, setRouteStats] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [pushing,    setPushing]    = useState(false);
  const [toast,      setToast]      = useState(null);
  const [is3D,       setIs3D]       = useState(false);

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

  useEffect(() => { if (preSelectedDriver) setSelAmb(preSelectedDriver); }, [preSelectedDriver]);

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

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapElRef.current || mapRef.current || !window.L) return;
    const L = window.L;
    mapRef.current = L.map(mapElRef.current, {
      center: [DELHI.lat, DELHI.lng], zoom: 12,
      minZoom: 9, maxZoom: 19, zoomControl: false,
    });
    tileLayerRef.current = L.tileLayer(is3D ? SATELLITE_TILE : LIGHT_TILE, {
      maxZoom: 19, attribution: "© Google Maps",
    }).addTo(mapRef.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);

    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(mapElRef.current);
    const t1 = setTimeout(() => mapRef.current?.invalidateSize(), 80);
    const t2 = setTimeout(() => mapRef.current?.invalidateSize(), 320);

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      clearTimeout(t1); clearTimeout(t2);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [leafletReady]);

  useEffect(() => {
    if (tileLayerRef.current)
      tileLayerRef.current.setUrl(is3D ? SATELLITE_TILE : LIGHT_TILE);
  }, [is3D]);

  // ── Clear layers ────────────────────────────────────────────────────────────
  const clearDrawnLayers = () => {
    if (!mapRef.current) return;
    Object.values(layerRef.current).forEach((layer) => {
      if (!layer) return;
      try { mapRef.current.removeLayer(layer); } catch {}
    });
    layerRef.current = {
      amb: null, pickup: null, hospital: null,
      route1: null, route1Glow: null,
      route2: null, route2Glow: null,
      connector: null,
    };
  };

  // ── Draw layers whenever route data changes ─────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !window.L || !mapRef.current) return;
    mapRef.current.invalidateSize();
    clearDrawnLayers();
    const L        = window.L;
    const ambCoord =
      selAmb && Number.isFinite(Number(selAmb.latitude)) && Number.isFinite(Number(selAmb.longitude))
        ? { lat: Number(selAmb.latitude), lng: Number(selAmb.longitude) }
        : DELHI;

    // Markers
    layerRef.current.amb = L.marker([ambCoord.lat, ambCoord.lng], {
      icon: makePinIcon("#111111", "🚑"),
    }).addTo(mapRef.current)
      .bindPopup(`<div style="font-weight:700">🚑 ${selAmb?.ambulance_number || "Ambulance"}</div>`);

    if (pickupCoord) {
      layerRef.current.pickup = L.marker([pickupCoord.lat, pickupCoord.lng], {
        icon: makePinIcon("#f7c948", "📍"),
      }).addTo(mapRef.current)
        .bindPopup(`<div style="font-weight:700">📍 Pickup</div>
          <div style="font-size:11px;color:#666">${selBook?.pickup_location || ""}</div>`);
    }

    if (destCoord) {
      layerRef.current.hospital = L.marker([destCoord.lat, destCoord.lng], {
        icon: makePinIcon("#00d4aa", "🏥"),
      }).addTo(mapRef.current)
        .bindPopup(`<div style="font-weight:700">🏥 ${selBook?.assigned_hospital_name || "Hospital"}</div>`);
    }

    const bounds = L.latLngBounds();
    const allRoutePoints = [[ambCoord.lat, ambCoord.lng]];
    if (pickupCoord) allRoutePoints.push([pickupCoord.lat, pickupCoord.lng]);
    if (destCoord)   allRoutePoints.push([destCoord.lat,   destCoord.lng]);
    if (Array.isArray(routeLeg1) && routeLeg1.length) allRoutePoints.push(...routeLeg1);
    if (Array.isArray(routeLeg2) && routeLeg2.length) allRoutePoints.push(...routeLeg2);

    allRoutePoints.forEach((pt) => {
      if (Array.isArray(pt) && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1])))
        bounds.extend([Number(pt[0]), Number(pt[1])]);
    });

    // Route 1: Ambulance → Pickup (Indigo)
    if (routeLeg1.length > 1) {
      layerRef.current.route1Glow = L.polyline(routeLeg1, {
        color: "#4f46e5", weight: 12, opacity: 0.16,
      }).addTo(mapRef.current);
      layerRef.current.route1 = L.polyline(routeLeg1, {
        color: "#6366f1", weight: 6, opacity: 0.96,
      }).addTo(mapRef.current);
      bounds.extend(layerRef.current.route1.getBounds());
      layerRef.current.route1.bringToFront();
    }

    // Route 2: Pickup → Hospital (Cyan)
    if (routeLeg2.length > 1) {
      layerRef.current.route2Glow = L.polyline(routeLeg2, {
        color: "#06b6d4", weight: 12, opacity: 0.16,
      }).addTo(mapRef.current);
      layerRef.current.route2 = L.polyline(routeLeg2, {
        color: "#06b6d4", weight: 6, opacity: 0.96,
      }).addTo(mapRef.current);
      bounds.extend(layerRef.current.route2.getBounds());
      layerRef.current.route2.bringToFront();

      // Connector dashed line if route doesn't exactly reach hospital
      if (destCoord) {
        const last   = routeLeg2[routeLeg2.length - 1];
        if (Array.isArray(last) && Number.isFinite(Number(last[0])) && Number.isFinite(Number(last[1]))) {
          const roadEnd = { lat: Number(last[0]), lng: Number(last[1]) };
          const gapKm   = haversineKm(roadEnd, destCoord);
          if (gapKm > 0.03) {
            layerRef.current.connector = L.polyline(
              [[roadEnd.lat, roadEnd.lng], [destCoord.lat, destCoord.lng]],
              { color: "#06b6d4", weight: 4, opacity: 0.95, dashArray: "8 8" }
            ).addTo(mapRef.current);
            bounds.extend(layerRef.current.connector.getBounds());
            layerRef.current.connector.bringToFront();
          }
        }
      }
    }

    if (bounds.isValid()) {
      const mobile = window.innerWidth < 768;
      const fit    = () => {
        mapRef.current?.invalidateSize();
        mapRef.current?.fitBounds(bounds, { padding: mobile ? [20, 20] : [52, 52], animate: false });
      };
      fit();
      setTimeout(fit, 90);
    } else {
      mapRef.current.setView([ambCoord.lat, ambCoord.lng], 12);
    }
  }, [leafletReady, selAmb, pickupCoord, destCoord, routeLeg1, routeLeg2]);

  // ── Resolve coordinates ─────────────────────────────────────────────────────
  const resolveCoords = async (booking) => {
    const pickupQuery = [booking.pickup_landmark, booking.pickup_city, booking.pickup_district]
      .filter(Boolean).join(", ");
    const pickupText  = pickupQuery || booking.pickup_location || "";
    const destName    = booking.assigned_hospital_name || booking.destination || "";
    const normalizedDest = normalizePlace(destName);

    const matchedHospital =
      hospitals.find((h) => Number(h.id) === Number(booking.assigned_hospital_id)) ||
      hospitals.find((h) => normalizePlace(h.name) === normalizedDest) ||
      hospitals.find((h) => normalizedDest && normalizePlace(h.name).includes(normalizedDest)) ||
      null;

    const dbLat        = Number(matchedHospital?.latitude);
    const dbLng        = Number(matchedHospital?.longitude);
    const hospitalFromDb = isIndiaCoord(dbLat, dbLng) ? { lat: dbLat, lng: dbLng } : null;

    // Pickup: try multiple text combos through geocodeInIndia (uses LOCAL_HINTS first)
    const pickupCandidates = uniqueTextList([
      pickupText,
      booking.pickup_location,
      booking.pickup_landmark,
      booking.pickup_city,
      booking.pickup_district,
      [booking.pickup_city, booking.pickup_district].filter(Boolean).join(", "),
      [booking.pickup_landmark, booking.pickup_city].filter(Boolean).join(", "),
      selAmb?.location || "",
    ]);

    const bookingPickupLat = Number(booking.pickup_latitude);
    const bookingPickupLng = Number(booking.pickup_longitude);
    const pickupFromBooking = isIndiaCoord(bookingPickupLat, bookingPickupLng)
      ? { lat: bookingPickupLat, lng: bookingPickupLng }
      : null;

    let pickupFromText = null;
    for (const candidate of pickupCandidates) {
      // eslint-disable-next-line no-await-in-loop
      pickupFromText = await geocodeInIndia(candidate, {
        landmark: booking.pickup_landmark || "",
        area:     booking.pickup_location || "",
        city:     booking.pickup_city     || "",
        district: booking.pickup_district || "",
        state:    "",
      });
      if (pickupFromText) break;
    }

    const pickup = pickupFromBooking || pickupFromText || null;

    if (booking.assigned_hospital_id && !hospitalFromDb) {
      throw new Error("Hospital latitude/longitude missing in backend. Update hospital coordinates.");
    }

    const destination = hospitalFromDb;
    return { pickup, destination };
  };

  // ── Find Route ──────────────────────────────────────────────────────────────
  const findRoute = async () => {
    if (!selAmb)  return showToast("Select an ambulance first", "error");
    if (!selBook) return showToast("Select a booking first",    "error");
    setLoading(true);
    setRouteStats(null);
    setRouteLeg1([]);
    setRouteLeg2([]);
    try {
      const ambCoord =
        Number.isFinite(Number(selAmb.latitude)) && Number.isFinite(Number(selAmb.longitude))
          ? { lat: Number(selAmb.latitude), lng: Number(selAmb.longitude) }
          : DELHI;

      const { pickup, destination } = await resolveCoords(selBook);
      if (!pickup)      throw new Error("Pickup location not found");
      if (!destination) throw new Error("Hospital location not found");

      setPickupCoord(pickup);

      const pickupRoadPoint      = (await fetchNearestRoadPoint(pickup))      || pickup;
      const destinationRoadPoint = (await fetchNearestRoadPoint(destination)) || destination;
      const leg1 = await fetchRoadRoute([ambCoord,          pickupRoadPoint],      { allowStraightFallback: true });
      const leg2 = await fetchRoadRoute([pickupRoadPoint,   destinationRoadPoint], { allowStraightFallback: true });
      const safeLeg1 = leg1.length > 1 ? leg1 : [[ambCoord.lat, ambCoord.lng], [pickup.lat, pickup.lng]];
      const safeLeg2 = leg2.length > 1 ? leg2 : [[pickup.lat, pickup.lng], [destination.lat, destination.lng]];

      setDestCoord(destination);
      setRouteLeg1(safeLeg1);
      setRouteLeg2(safeLeg2);

      // Use actual path distances for stats
      const stats = toRoadStats(safeLeg1, safeLeg2, ambCoord, pickup, destination);
      setRouteStats(stats);
      showToast(`Route found: ${stats.distKm} km · ~${stats.mins} min`);
    } catch (e) {
      showToast(e.message || "Route error", "error");
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
          ambulance_id:   selAmb.id || selAmb.ambulance_id,
          booking_id:     selBook.id,
          pickup_location: selBook.pickup_location,
          destination:    selBook.assigned_hospital_name || selBook.destination || "Hospital",
          distance_km:    `${routeStats.distKm} km`,
          duration:       `${routeStats.mins} min`,
          polyline:       "",
          pickup_lat:     pickupCoord?.lat ?? null,
          pickup_lng:     pickupCoord?.lng ?? null,
          dest_lat:       destCoord?.lat   ?? null,
          dest_lng:       destCoord?.lng   ?? null,
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

  // ── Render ──────────────────────────────────────────────────────────────────
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
        .arm-item { background:#fff; border:1px solid rgba(17,17,17,0.14); border-radius:8px; padding:8px 10px; cursor:pointer; transition:background 0.12s; }
        .arm-item:hover { background:#f5f5ef; }
        .arm-item.sel { background:#eef2b2; border-color:#d6e800; }
        .arm-find-btn,.arm-push-btn { width:100%; border:none; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
        .arm-find-btn { background:#d6e800; color:#111; padding:10px 0; margin-bottom:8px; font-size:13px; }
        .arm-find-btn:disabled,.arm-push-btn:disabled { background:#d7d7cd; color:rgba(17,17,17,0.45); cursor:not-allowed; }
        .arm-route-card { background:#f7f8e8; border:1px solid rgba(214,232,0,0.72); border-radius:10px; padding:10px; margin-top:4px; position:sticky; bottom:8px; z-index:5; box-shadow:0 10px 24px rgba(17,17,17,0.16); }
        .arm-push-btn { background:#111; color:#fff; padding:10px 0; margin-top:6px; font-size:13px; border:1px solid rgba(255,255,255,0.1); }
        .arm-map { flex:1; min-width:0; position:relative; }
        .arm-map-el { width:100%; height:100%; min-height:540px; position:relative; z-index:1; }
        .arm-toast { position:fixed; top:68px; right:16px; z-index:9999; padding:11px 16px; border-radius:8px; font-size:12px; font-weight:700; box-shadow:0 8px 24px rgba(0,0,0,0.22); }
        .arm-toast.success { background:#d6e800; color:#111; }
        .arm-toast.error { background:#373737; color:#fff; }
        .arm-3d-btn { position:absolute; top:10px; right:10px; z-index:5000; background:#111; color:#fff; border:1px solid rgba(255,255,255,0.22); border-radius:9px; padding:7px 12px; font-weight:700; font-size:12px; cursor:pointer; }
        @media (max-width:767px) {
          .arm-root { flex-direction:column; }
          .arm-panel { width:100%; min-width:100%; max-height:calc(100vh - 220px); border-right:none; border-bottom:1px solid rgba(17,17,17,0.12); }
          .arm-panel-inner { padding-bottom:96px; }
          .arm-route-card { bottom:8px; padding:8px; margin-top:8px; }
          .arm-find-btn { padding:9px 0; }
          .arm-push-btn { padding:9px 0; font-size:12px; }
          .arm-map { height:380px; min-height:300px; }
        }
      `}</style>

      <div className="arm-root">
        {toast && <div className={`arm-toast ${toast.type}`}>{toast.msg}</div>}

        <div className="arm-panel">
          <div className="arm-panel-header">
            <div style={{ fontWeight: 800, fontSize: 14 }}>Route Manager</div>
            <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>Leaflet routing (stable mode)</div>
          </div>

          <div className="arm-panel-inner">
            {/* Ambulance selector */}
            <div className="arm-box">
              <div className="arm-box-label">Select Ambulance</div>
              <div className="arm-list">
                {ambs.map((a) => {
                  const selected = Number(selAmb?.id || selAmb?.ambulance_id) === Number(a.id);
                  const color    = statusColor[a.status] || statusColor.offline;
                  return (
                    <div key={a.id} className={`arm-item ${selected ? "sel" : ""}`} onClick={() => setSelAmb(a)}>
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
                  <div key={b.id} className={`arm-item ${selBook?.id === b.id ? "sel" : ""}`} onClick={() => setSelBook(b)}>
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
              {loading ? "Finding route…" : "Find Route"}
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
          <button className="arm-3d-btn" onClick={() => setIs3D((v) => !v)}>
            {is3D ? "Disable 3D View" : "Enable 3D View"}
          </button>
          <div ref={mapElRef} className="arm-map-el" />
        </div>
      </div>
    </>
  );
}