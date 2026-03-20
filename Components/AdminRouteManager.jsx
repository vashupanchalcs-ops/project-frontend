// AdminRouteManager.jsx — Route Manager (Leaflet + TomTom Traffic)
import { useState, useEffect, useRef } from "react";
import useLeaflet, { DARK_TILE, DELHI, STATUS_COLOR, makePinIcon } from "../hooks/useLeaflet";

const BASE       = "http://127.0.0.1:8000";
const TOMTOM_KEY = "d23829a0-735d-4693-b2f0-adefdba8b43f";

export default function AdminRouteManager({ preSelectedDriver }) {
  const leafletReady = useLeaflet();

  const [ambs,     setAmbs]     = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selAmb,   setSelAmb]   = useState(null);
  const [selBook,  setSelBook]  = useState(null);
  const [routes,   setRoutes]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [pushing,  setPushing]  = useState(false);
  const [toast,    setToast]    = useState(null);
  const [traffic,  setTraffic]  = useState(null);

  const mapDivRef       = useRef(null);
  const mapObj          = useRef(null);
  const routingRef      = useRef(null);
  const ambMarkerRef    = useRef(null);
  const destMarkerRef   = useRef(null);
  const pickupMarkerRef = useRef(null);
  const trafficLayer    = useRef(null);

  useEffect(() => {
    fetch(`${BASE}/api/ambulances/`).then(r => r.json()).then(d => setAmbs(d.filter(a => a.status !== "offline"))).catch(() => {});
    fetch(`${BASE}/api/bookings/`).then(r => r.json()).then(d => setBookings(d.filter(b => ["pending","confirmed"].includes(b.status)))).catch(() => {});
  }, []);

  useEffect(() => { if (preSelectedDriver) setSelAmb(preSelectedDriver); }, [preSelectedDriver]);

  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    mapObj.current = L.map(mapDivRef.current, { center: [DELHI.lat, DELHI.lng], zoom: 12, zoomControl: false });
    L.tileLayer(DARK_TILE, { maxZoom: 19, opacity: 1 }).addTo(mapObj.current);
    if (TOMTOM_KEY !== "YOUR_TOMTOM_API_KEY") {
      trafficLayer.current = L.tileLayer(
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`,
        { maxZoom: 19, opacity: 0.7, zIndex: 2 }
      ).addTo(mapObj.current);
    }
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    return () => { clearRouting(); if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [leafletReady]);

  useEffect(() => {
    if (!mapObj.current) return;
    const t1 = setTimeout(() => mapObj.current?.invalidateSize(), 100);
    const t2 = setTimeout(() => mapObj.current?.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [leafletReady]);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const clearRouting = () => {
    if (routingRef.current) { try { routingRef.current.getPlan().setWaypoints([]); mapObj.current?.removeControl(routingRef.current); } catch {} routingRef.current = null; }
    if (ambMarkerRef.current)    { try { ambMarkerRef.current.remove(); }    catch {} ambMarkerRef.current = null; }
    if (destMarkerRef.current)   { try { destMarkerRef.current.remove(); }   catch {} destMarkerRef.current = null; }
    if (pickupMarkerRef.current) { try { pickupMarkerRef.current.remove(); } catch {} pickupMarkerRef.current = null; }
  };

  const geocode = async (address) => {
    if (TOMTOM_KEY !== "YOUR_TOMTOM_API_KEY") {
      const res  = await fetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address + ", Delhi, India")}.json?key=${TOMTOM_KEY}&limit=1`);
      const data = await res.json();
      if (data.results?.length) { const p = data.results[0].position; return { lat: p.lat, lng: p.lon }; }
    }
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Delhi, India")}&format=json&limit=1`, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (!data.length) throw new Error(`"${address}" ka location nahi mila`);
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  };

  const getTrafficRoute = async (ambLat, ambLng, pickupCoord, destCoord) => {
    if (TOMTOM_KEY === "YOUR_TOMTOM_API_KEY") return null;
    try {
      const res  = await fetch(`https://api.tomtom.com/routing/1/calculateRoute/${ambLat},${ambLng}:${pickupCoord.lat},${pickupCoord.lng}:${destCoord.lat},${destCoord.lng}/json?key=${TOMTOM_KEY}&traffic=true&travelMode=car&routeType=fastest`);
      const data = await res.json();
      if (data.routes?.length) {
        const r = data.routes[0].summary;
        return { km: (r.lengthInMeters / 1000).toFixed(1), mins: Math.round(r.travelTimeInSeconds / 60), delay: Math.round((r.trafficDelayInSeconds || 0) / 60), hasTraffic: (r.trafficDelayInSeconds || 0) > 0 };
      }
    } catch {}
    return null;
  };

  const findRoute = async () => {
    if (!selAmb)  return showToast("Ambulance select karo", "error");
    if (!selBook) return showToast("Booking select karo", "error");
    if (!selBook.pickup_location?.trim()) return showToast("Pickup location nahi hai", "error");
    if (!leafletReady || !mapObj.current) return showToast("Map load nahi hua", "error");
    setLoading(true); setRoutes([]); setTraffic(null); clearRouting();
    try {
      const L = window.L;
      const hasGPS = selAmb.latitude && parseFloat(selAmb.latitude) !== 0;
      const ambLat = hasGPS ? parseFloat(selAmb.latitude) : DELHI.lat;
      const ambLng = hasGPS ? parseFloat(selAmb.longitude) : DELHI.lng;
      if (!hasGPS) showToast("⚠ GPS nahi mila, Delhi center fallback", "warn");
      const pickupCoord  = await geocode(selBook.pickup_location);
      const destAddr     = selBook.destination?.trim() || "AIIMS Delhi";
      const destCoord    = await geocode(destAddr);
      const trafficInfo  = await getTrafficRoute(ambLat, ambLng, pickupCoord, destCoord);
      if (trafficInfo) setTraffic(trafficInfo);
      ambMarkerRef.current    = L.marker([ambLat, ambLng], { icon: makePinIcon("#E50914", "🚑") }).addTo(mapObj.current).bindPopup(`<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700">🚑 ${selAmb.ambulance_number}</div>`, { className: "sr-dark-popup" });
      pickupMarkerRef.current = L.marker([pickupCoord.lat, pickupCoord.lng], { icon: makePinIcon("#f7c948", "📍") }).addTo(mapObj.current).bindPopup(`<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px">📍 <b>Pickup:</b> ${selBook.pickup_location}</div>`, { className: "sr-dark-popup" });
      destMarkerRef.current   = L.marker([destCoord.lat, destCoord.lng], { icon: makePinIcon("#00d4aa", "🏥") }).addTo(mapObj.current).bindPopup(`<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px">🏥 <b>Destination:</b> ${destAddr}</div>`, { className: "sr-dark-popup" });
      const routing = L.Routing.control({
        waypoints: [L.latLng(ambLat, ambLng), L.latLng(pickupCoord.lat, pickupCoord.lng), L.latLng(destCoord.lat, destCoord.lng)],
        router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1", profile: "driving" }),
        lineOptions: { styles: [{ color: trafficInfo?.hasTraffic ? "#ff6d00" : "#00c853", weight: 5, opacity: 0.9 }, { color: "#fff", weight: 2, opacity: 0.2 }], extendToWaypoints: true, missingRouteTolerance: 0 },
        show: false, addWaypoints: false, draggableWaypoints: false, fitSelectedRoutes: true, showAlternatives: false, createMarker: () => null,
      }).addTo(mapObj.current);
      routingRef.current = routing;
      routing.on("routesfound", (e) => {
        const s    = e.routes[0].summary;
        const km   = trafficInfo?.km || (s.totalDistance / 1000).toFixed(1);
        const mins = trafficInfo?.mins || Math.round(s.totalTime / 60);
        setRoutes([{ i: 0, dist: `${km} km`, time: `${mins} min`, delay: trafficInfo?.delay || 0, hasTraffic: trafficInfo?.hasTraffic || false, pickupAddr: selBook.pickup_location, destAddr }]);
        setLoading(false);
        showToast(`Route mila! ${km} km · ~${mins} min${trafficInfo?.delay ? ` (+${trafficInfo.delay} min traffic)` : ""}`);
      });
      routing.on("routingerror", () => { setLoading(false); showToast("Route nahi mila. Address check karein.", "error"); });
    } catch (err) { setLoading(false); showToast(err.message || "Route error", "error"); }
  };

  const pushRoute = async (r) => {
    if (!selAmb || !selBook) return;
    setPushing(true);
    try {
      const res  = await fetch(`${BASE}/api/admin/suggest-route/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ambulance_id: selAmb.id || selAmb.ambulance_id, pickup_location: selBook.pickup_location, destination: selBook.destination || "Nearest Hospital", distance_km: r.dist, duration: r.time, polyline: "" }),
      });
      const data = await res.json();
      if (data.id) showToast(`✅ Route driver ko bhej diya! (${r.dist}, ${r.time})`);
      else showToast("Route push error", "error");
    } catch { showToast("Server error", "error"); }
    setPushing(false);
  };

  return (
    <>
      <style>{`
        /* Leaflet overrides */
        .sr-dark-popup .leaflet-popup-content-wrapper { background:rgba(20,20,20,0.97)!important; border:1px solid rgba(255,255,255,0.08)!important; border-radius:10px!important; padding:0!important; box-shadow:0 8px 32px rgba(0,0,0,0.8)!important; }
        .sr-dark-popup .leaflet-popup-content { margin:0!important; }
        .sr-dark-popup .leaflet-popup-tip { background:rgba(20,20,20,0.97)!important; }
        .sr-dark-popup .leaflet-popup-close-button { color:rgba(255,255,255,0.35)!important; }
        .leaflet-control-zoom a { background:rgba(20,20,20,0.92)!important; color:#fff!important; border-color:rgba(255,255,255,0.08)!important; }
        .leaflet-control-zoom a:hover { background:rgba(35,35,35,0.95)!important; }
        .leaflet-routing-container { display:none!important; }

        /* ── Root layout ── */
        .arm-root {
          display: flex; width: 100%; height: 100%;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #fff; overflow: hidden;
          background: #0a0a0a;
        }

        /* ── Left panel — Netflix tight sidebar style ── */
        .arm-panel {
          width: 290px; min-width: 290px; max-width: 290px;
          background: #111;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column;
          overflow: hidden; flex-shrink: 0;
        }
        .arm-panel-header {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .arm-panel-title { font-weight: 700; font-size: 14px; color: #fff; }
        .arm-panel-sub   { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; }

        .arm-panel-inner {
          flex: 1; overflow-y: auto; padding: 10px;
          display: flex; flex-direction: column; gap: 8px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        .arm-panel-inner::-webkit-scrollbar { width: 3px; }
        .arm-panel-inner::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

        /* ── Section box ── */
        .arm-box {
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 10px;
        }
        .arm-box-label {
          font-weight: 700; font-size: 9px; color: rgba(255,255,255,0.3);
          letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;
        }
        .arm-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent; }
        .arm-list::-webkit-scrollbar { width: 2px; }
        .arm-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); }

        /* ── Item card ── */
        .arm-item {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 8px 10px; cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
        }
        .arm-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); }
        .arm-item.sel   { background: rgba(229,9,20,0.07); border-color: rgba(229,9,20,0.28); }
        .arm-item-top   { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
        .arm-item-name  { font-size: 12px; font-weight: 700; color: #fff; }
        .arm-badge {
          font-size: 8px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
          text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap;
        }
        .arm-item-sub { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .arm-gps-ok  { font-size: 9px; color: #00c853; margin-top: 2px; }
        .arm-gps-no  { font-size: 9px; color: #ff4d5a; margin-top: 2px; }
        .arm-empty   { color: rgba(255,255,255,0.2); font-size: 11px; text-align: center; padding: 12px 0; }

        /* ── Find Route button ── */
        .arm-find-btn {
          width: 100%; padding: 11px 0;
          background: #E50914; border: none; border-radius: 8px;
          color: #fff; font-weight: 700; font-size: 12px;
          cursor: pointer; transition: background 0.15s;
          font-family: inherit;
        }
        .arm-find-btn:hover:not(:disabled) { background: #f40612; }
        .arm-find-btn:disabled { background: #2a2a2a; color: rgba(255,255,255,0.3); cursor: not-allowed; }

        /* ── Traffic info card ── */
        .arm-traffic {
          border-radius: 8px; padding: 10px 12px;
        }
        .arm-traffic.ok   { background: rgba(0,200,83,0.08);  border: 1px solid rgba(0,200,83,0.2); }
        .arm-traffic.bad  { background: rgba(255,109,0,0.08); border: 1px solid rgba(255,109,0,0.2); }
        .arm-traffic-title { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
        .arm-traffic-info  { font-size: 10px; color: rgba(255,255,255,0.45); }

        /* ── Route result card ── */
        .arm-route-card {
          background: rgba(0,200,83,0.05);
          border: 1px solid rgba(0,200,83,0.2);
          border-radius: 10px; padding: 12px;
        }
        .arm-route-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .arm-route-title  { font-size: 12px; font-weight: 700; color: #00c853; }
        .arm-route-engine { font-size: 9px; color: rgba(255,255,255,0.25); }
        .arm-route-stats  { display: flex; gap: 12px; margin-bottom: 10px; }
        .arm-route-stat   { font-size: 11px; color: rgba(255,255,255,0.5); }
        .arm-push-btn {
          width: 100%; padding: 9px 0;
          background: #ff6d00; border: none; border-radius: 7px;
          color: #fff; font-weight: 700; font-size: 11px;
          cursor: pointer; transition: background 0.15s; font-family: inherit;
        }
        .arm-push-btn:hover:not(:disabled) { background: #ff8c00; }
        .arm-push-btn:disabled { background: #2a2a2a; color: rgba(255,255,255,0.3); cursor: not-allowed; }

        /* ── Map area ── */
        .arm-map { flex: 1; min-width: 0; position: relative; }
        .arm-map-empty {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          pointer-events: none; z-index: 1;
        }

        /* ── Toast ── */
        .arm-toast {
          position: fixed; top: 68px; right: 16px; z-index: 9999;
          padding: 11px 18px; border-radius: 8px;
          font-weight: 600; font-size: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5); max-width: 300px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        .arm-toast.success { background: #00c853; color: #000; }
        .arm-toast.error   { background: #e53935; color: #fff; }
        .arm-toast.warn    { background: #ff9800; color: #000; }

        /* ── Mobile ── */
        @media (max-width: 767px) {
          .arm-root   { flex-direction: column; overflow-y: auto; }
          .arm-panel  { width: 100% !important; min-width: unset !important; max-width: 100% !important; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); max-height: 400px; flex-shrink: 0; }
          .arm-map    { flex: none; height: 320px; min-height: 280px; width: 100%; }
          .arm-map > div { position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; }
        }
      `}</style>

      <div className="arm-root">
        {/* Toast */}
        {toast && (
          <div className={`arm-toast ${toast.type}`}>{toast.msg}</div>
        )}

        {/* ── Left Panel ── */}
        <div className="arm-panel">
          <div className="arm-panel-header">
            <div className="arm-panel-title">🛣 Route Manager</div>
            <div className="arm-panel-sub">
              {TOMTOM_KEY !== "YOUR_TOMTOM_API_KEY" ? "TomTom Traffic · OSRM Routing" : "OSRM Routing"}
            </div>
          </div>

          <div className="arm-panel-inner">

            {/* Ambulance selector */}
            <div className="arm-box">
              <div className="arm-box-label">🚑 Select Ambulance</div>
              <div className="arm-list">
                {ambs.length === 0 && <p className="arm-empty">No active ambulance</p>}
                {ambs.map(a => {
                  const color = STATUS_COLOR[a.status] || "#555";
                  const isSel = selAmb?.id === a.id || selAmb?.ambulance_id === a.id;
                  return (
                    <div key={a.id} className={`arm-item ${isSel ? "sel" : ""}`} onClick={() => setSelAmb(a)}>
                      <div className="arm-item-top">
                        <span className="arm-item-name">{a.ambulance_number}</span>
                        <span className="arm-badge" style={{ background: color + "20", color, border: `1px solid ${color}40` }}>
                          {a.status?.replace("_"," ")}
                        </span>
                      </div>
                      <div className="arm-item-sub">👤 {a.driver} · {a.location || "—"}</div>
                      <div className={a.latitude ? "arm-gps-ok" : "arm-gps-no"}>
                        {a.latitude ? "🛰 GPS mila ✓" : "⚠ GPS nahi (Delhi fallback)"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Booking selector */}
            <div className="arm-box">
              <div className="arm-box-label">📋 Select Booking</div>
              <div className="arm-list">
                {bookings.length === 0 && <p className="arm-empty">No active booking</p>}
                {bookings.map(b => {
                  const isSel = selBook?.id === b.id;
                  const bc    = b.status === "pending" ? "#f7c948" : "#00d4aa";
                  return (
                    <div key={b.id} className={`arm-item ${isSel ? "sel" : ""}`} onClick={() => setSelBook(b)}>
                      <div className="arm-item-top">
                        <span className="arm-item-name">#{b.id}</span>
                        <span className="arm-badge" style={{ background: bc + "18", color: bc, border: `1px solid ${bc}35` }}>
                          {b.status}
                        </span>
                      </div>
                      <div className="arm-item-sub">👤 {b.booked_by}</div>
                      <div className="arm-item-sub">📍 {b.pickup_location}</div>
                      <div className="arm-item-sub">🏥 {b.destination || "Nearest Hospital"}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Find route button */}
            <button className="arm-find-btn" onClick={findRoute} disabled={loading}>
              {loading ? "⏳ Dhundh raha hoon..." : "🗺 Route Dhundho"}
            </button>

            {/* Traffic info */}
            {traffic && (
              <div className={`arm-traffic ${traffic.hasTraffic ? "bad" : "ok"}`}>
                <div className="arm-traffic-title" style={{ color: traffic.hasTraffic ? "#ff6d00" : "#00c853" }}>
                  {traffic.hasTraffic ? "🚦 Traffic Alert!" : "✅ Road Clear"}
                </div>
                <div className="arm-traffic-info">
                  📏 {traffic.km} km &nbsp;·&nbsp; ⏱ {traffic.mins} min
                  {traffic.delay > 0 && <span style={{ color: "#ff6d00" }}> (+{traffic.delay} min delay)</span>}
                </div>
              </div>
            )}

            {/* Route result */}
            {routes.map((r, i) => (
              <div key={i} className="arm-route-card">
                <div className="arm-route-header">
                  <span className="arm-route-title">🏆 Best Route</span>
                  <span className="arm-route-engine">
                    {TOMTOM_KEY !== "YOUR_TOMTOM_API_KEY" ? "TomTom" : "OSRM"}
                  </span>
                </div>
                <div className="arm-route-stats">
                  <span className="arm-route-stat">📏 {r.dist}</span>
                  <span className="arm-route-stat">⏱ {r.time}</span>
                  {r.hasTraffic && <span style={{ fontSize: 11, color: "#ff6d00" }}>🚦 Traffic</span>}
                </div>
                <button className="arm-push-btn" onClick={() => pushRoute(r)} disabled={pushing}>
                  {pushing ? "Bhej raha hoon..." : "📤 Driver Ko Bhejo"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Map ── */}
        <div className="arm-map">
          <div ref={mapDivRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          {routes.length === 0 && !loading && !selAmb && !selBook && (
            <div className="arm-map-empty">
              <div style={{ fontSize: 44, marginBottom: 10, opacity: 0.15 }}>🗺</div>
              <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 12, textAlign: "center" }}>
                Ambulance + Booking select karo<br />Phir Route Dhundho
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
