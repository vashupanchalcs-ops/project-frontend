import { Van } from 'lucide-react';
import { useState, useEffect } from 'react';

const Activevehicles = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const f = () => fetch("http://127.0.0.1:8000/api/ambulances/")
      .then(r => r.json())
      .then(d => setCount(d.filter(a => a.status === "available" || a.status === "en_route").length));
    f(); const i = setInterval(f, 10000); return () => clearInterval(i);
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Active Vehicles</span>
        <span className="stats-card-icon"><Van size={14} /></span>
      </div>
      <div className="stats-card-value">{String(count).padStart(2,"0")}</div>
      <div className="stats-card-sub">Available + En Route</div>
    </>
  );
};
export default Activevehicles;import { Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const Fuelefficiency = () => {
  const [beds, setBeds] = useState(0);
  useEffect(() => {
    const f = () => fetch("http://127.0.0.1:8000/api/hospitals/")
      .then(r => r.json())
      .then(d => setBeds(d.reduce((s, h) => s + (h.available_beds || 0), 0)));
    f(); const i = setInterval(f, 10000); return () => clearInterval(i);
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Available Beds</span>
        <span className="stats-card-icon"><Building2 size={14} /></span>
      </div>
      <div className="stats-card-value">{String(beds).padStart(2,"0")}</div>
      <div className="stats-card-sub">Beds Available</div>
    </>
  );
};
export default Fuelefficiency;import { TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';

const Successrate = () => {
  const [rate, setRate] = useState(0);
  useEffect(() => {
    const f = () => fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(d => {
        if (!d.length) return;
        setRate(Math.round((d.filter(b => b.status === "completed").length / d.length) * 100));
      });
    f(); const i = setInterval(f, 10000); return () => clearInterval(i);
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Success Rate</span>
        <span className="stats-card-icon"><TrendingUp size={14} /></span>
      </div>
      <div className="stats-card-value">{rate}%</div>
      <div className="stats-card-sub">Completed bookings</div>
    </>
  );
};
export default Successrate;import { ClipboardList } from 'lucide-react';
import { useState, useEffect } from 'react';

const Totalcases = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const f = () => fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json()).then(d => setCount(d.length));
    f(); const i = setInterval(f, 10000);
    window.addEventListener("new-booking", f);
    return () => { clearInterval(i); window.removeEventListener("new-booking", f); };
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Total Cases</span>
        <span className="stats-card-icon"><ClipboardList size={14} /></span>
      </div>
      <div className="stats-card-value">{String(count).padStart(2,"0")}</div>
      <div className="stats-card-sub">Total bookings so far</div>
    </>
  );
};
export default Totalcases;// AdminRouteManager.jsx — Route Manager (Leaflet + TomTom Traffic)
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
import { useState, useEffect, useRef } from "react";

const getLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key:   d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
    });
  }
  return days;
};

const parseDate = (str) => {
  if (!str) return null;
  try {
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const parts  = str.match(/(\d+)\s(\w+)\s(\d+)/);
    if (parts) {
      const d = new Date(parseInt(parts[3]), months[parts[2]], parseInt(parts[1]));
      return d.toISOString().split("T")[0];
    }
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().split("T")[0];
    return null;
  } catch {
    return null;
  }
};

// Read CSS variable from :root at draw time so charts respect active theme
const cssVar = (name, fallback = "#888") => {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

const drawBarChart = (canvas, labels, datasets, title) => {
  if (!canvas) return;

  const textColor    = cssVar("--sr-text",       "#ffffff");
  const textSub      = cssVar("--sr-text-sub",   "rgba(255,255,255,0.4)");
  const textMuted    = cssVar("--sr-text-muted", "rgba(255,255,255,0.22)");
  const gridColor    = cssVar("--sr-chart-grid", "rgba(255,255,255,0.06)");
  const labelColor   = cssVar("--sr-chart-label","rgba(255,255,255,0.35)");
  const valueLabelC  = textSub;

  const dpr     = window.devicePixelRatio || 1;
  const W       = canvas.offsetWidth  || 600;
  const H       = canvas.offsetHeight || 200;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx     = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const padL = 36, padR = 16, padT = 30, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  // Title
  ctx.fillStyle = textColor;
  ctx.font      = "500 12px Helvetica Neue, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, W / 2, 16);

  const allVals = datasets.flatMap(d => d.data);
  const maxVal  = Math.max(...allVals, 1);
  const step    = Math.ceil(maxVal / 4);
  const yMax    = step * 4;

  // Grid + Y axis labels
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth   = 1;
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.font      = "10px Helvetica Neue";
    ctx.textAlign = "right";
    ctx.fillText(String(i * step), padL - 4, y + 3);
  }

  const n      = labels.length;
  const groupW = chartW / n;
  const barPad = 4;
  const barW   = (groupW - barPad * 2) / datasets.length;

  datasets.forEach((ds, di) => {
    ds.data.forEach((val, i) => {
      const barH = (val / yMax) * chartH;
      const x    = padL + i * groupW + barPad + di * barW;
      const y    = padT + chartH - barH;
      ctx.fillStyle = ds.color;
      ctx.beginPath();
      ctx.roundRect(x, y, barW - 2, barH, [3, 3, 0, 0]);
      ctx.fill();
      if (val > 0) {
        ctx.fillStyle = valueLabelC;
        ctx.font      = "bold 9px Helvetica Neue";
        ctx.textAlign = "center";
        ctx.fillText(val, x + (barW - 2) / 2, y - 3);
      }
    });
  });

  // X axis labels
  labels.forEach((lbl, i) => {
    const x = padL + i * groupW + groupW / 2;
    ctx.fillStyle = labelColor;
    ctx.font      = "10px Helvetica Neue";
    ctx.textAlign = "center";
    ctx.fillText(lbl, x, padT + chartH + 16);
  });
};

const drawLineChart = (canvas, labels, datasets, title) => {
  if (!canvas) return;

  const textColor  = cssVar("--sr-text",       "#ffffff");
  const gridColor  = cssVar("--sr-chart-grid", "rgba(255,255,255,0.06)");
  const labelColor = cssVar("--sr-chart-label","rgba(255,255,255,0.35)");
  const dotStroke  = cssVar("--sr-surface",    "#1a1a1a");

  const dpr     = window.devicePixelRatio || 1;
  const W       = canvas.offsetWidth  || 600;
  const H       = canvas.offsetHeight || 200;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx     = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const padL = 36, padR = 16, padT = 30, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.clearRect(0, 0, W, H);

  // Title
  ctx.fillStyle = textColor;
  ctx.font      = "500 12px Helvetica Neue, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, W / 2, 16);

  const allVals = datasets.flatMap(d => d.data);
  const maxVal  = Math.max(...allVals, 1);
  const step    = Math.ceil(maxVal / 4) || 1;
  const yMax    = step * 4;

  // Grid + Y axis labels
  for (let i = 0; i <= 4; i++) {
    const y = padT + chartH - (i / 4) * chartH;
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth   = 1;
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
    ctx.fillStyle = labelColor;
    ctx.font      = "10px Helvetica Neue";
    ctx.textAlign = "right";
    ctx.fillText(String(i * step), padL - 4, y + 3);
  }

  const n   = labels.length;
  const xAt = (i) => padL + (i / (n - 1)) * chartW;
  const yAt = (v) => padT + chartH - (v / yMax) * chartH;

  datasets.forEach(ds => {
    if (ds.data.length < 2) return;

    // Area fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, ds.color + "40");
    grad.addColorStop(1, ds.color + "00");
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(ds.data[0]));
    ds.data.forEach((v, i) => { if (i > 0) ctx.lineTo(xAt(i), yAt(v)); });
    ctx.lineTo(xAt(n - 1), padT + chartH);
    ctx.lineTo(xAt(0),     padT + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = ds.color;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = "round";
    ctx.moveTo(xAt(0), yAt(ds.data[0]));
    ds.data.forEach((v, i) => { if (i > 0) ctx.lineTo(xAt(i), yAt(v)); });
    ctx.stroke();

    // Dots
    ds.data.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xAt(i), yAt(v), 3, 0, Math.PI * 2);
      ctx.fillStyle   = ds.color;
      ctx.fill();
      ctx.strokeStyle = dotStroke;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    });
  });

  // X axis labels
  labels.forEach((lbl, i) => {
    ctx.fillStyle = labelColor;
    ctx.font      = "10px Helvetica Neue";
    ctx.textAlign = "center";
    ctx.fillText(lbl, xAt(i), padT + chartH + 16);
  });
};

const AnalyticsCharts = () => {
  const [bookings,   setBookings]   = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [activeTab,  setActiveTab]  = useState("bookings");
  const [loading,    setLoading]    = useState(true);

  const barRef  = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch("http://127.0.0.1:8000/api/bookings/").then(r => r.json()),
      fetch("http://127.0.0.1:8000/api/ambulances/").then(r => r.json()),
    ])
      .then(([b, a]) => { setBookings(b); setAmbulances(a); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const days = getLast7Days();

  const bookingTrends = (() => {
    const confirmed = days.map(d => bookings.filter(b => parseDate(b.created_at) === d.key && b.status === "confirmed").length);
    const pending   = days.map(d => bookings.filter(b => parseDate(b.created_at) === d.key && b.status === "pending").length);
    const cancelled = days.map(d => bookings.filter(b => parseDate(b.created_at) === d.key && b.status === "cancelled").length);
    return {
      labels:   days.map(d => d.label),
      datasets: [
        { label: "Confirmed", data: confirmed, color: "#00d4aa" },
        { label: "Pending",   data: pending,   color: "#f7c948" },
        { label: "Cancelled", data: cancelled, color: "#ff4d5a" },
      ],
    };
  })();

  const responseTime = (() => {
    const parseEta = (etaStr) => {
      if (!etaStr) return null;
      const match = String(etaStr).match(/\d+/);
      return match ? parseInt(match[0]) : null;
    };
    const demand = days.map(d => bookings.filter(b => parseDate(b.created_at) === d.key).length);
    const avgEta = days.map((d, i) => {
      const etas = ambulances.map(a => parseEta(a.eta_to_patient)).filter(v => v !== null);
      const base = etas.length ? etas.reduce((a, b) => a + b, 0) / etas.length : 10;
      return Math.round(base + demand[i] * 0.5);
    });
    return {
      labels:   days.map(d => d.label),
      datasets: [
        { label: "Avg ETA (min)", data: avgEta,  color: "#E50914" },
        { label: "Bookings",      data: demand,   color: "#3d8bff" },
      ],
    };
  })();

  const redraw = () => {
    if (activeTab === "bookings" && barRef.current)
      drawBarChart(barRef.current, bookingTrends.labels, bookingTrends.datasets, "Booking Trends — Last 7 Days");
    if (activeTab === "response" && lineRef.current)
      drawLineChart(lineRef.current, responseTime.labels, responseTime.datasets, "Response Time & Demand — Last 7 Days");
  };

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(redraw, 50);
    return () => clearTimeout(t);
  }, [loading, activeTab, bookings, ambulances]);

  useEffect(() => {
    const t = setTimeout(redraw, 50);
    window.addEventListener("resize", redraw);
    return () => { clearTimeout(t); window.removeEventListener("resize", redraw); };
  }, [activeTab, bookings, ambulances]);

  // Redraw whenever theme changes (data-theme attribute on <html>)
  useEffect(() => {
    const observer = new MutationObserver(() => setTimeout(redraw, 50));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => observer.disconnect();
  }, [activeTab, bookings, ambulances]);

  const last7Bookings  = bookings.filter(b => { const d = parseDate(b.created_at); return d && d >= days[0].key; });
  const confirmedCount = last7Bookings.filter(b => b.status === "confirmed").length;
  const pendingCount   = last7Bookings.filter(b => b.status === "pending").length;
  const cancelledCount = last7Bookings.filter(b => b.status === "cancelled").length;
  const totalLast7     = last7Bookings.length;

  return (
    <>
      <style>{`
        .ac-root {
          background: var(--sr-surface, #1a1a1a);
          border-radius: 16px;
          padding: 18px 20px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          transition: background 0.3s;
        }
        .ac-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        .ac-title { font-size: 15px; font-weight: 700; color: var(--sr-text); display: flex; align-items: center; gap: 7px; }
        .ac-title-dot { width: 8px; height: 8px; border-radius: 50%; background: #E50914; }
        .ac-badge { font-size: 9px; font-weight: 800; background: rgba(229,9,20,0.12); color: #E50914; border: 1px solid rgba(229,9,20,0.3); border-radius: 4px; padding: 2px 8px; letter-spacing: 0.5px; text-transform: uppercase; }
        .ac-tabs { display: flex; gap: 6px; }
        .ac-tab { font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 6px; border: 1px solid var(--sr-border); background: transparent; color: var(--sr-text-sub); cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .ac-tab:hover { color: var(--sr-text); border-color: var(--sr-border); }
        .ac-tab.active { background: #E50914; color: #fff; border-color: #E50914; }
        .ac-summary { display: flex; gap: 8px; flex-wrap: wrap; }
        .ac-pill { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 20px; border: 1px solid; }
        .ac-pill-dot { width: 6px; height: 6px; border-radius: 50%; }
        .ac-pill-neutral {
          background: var(--sr-badge-bg) !important;
          border-color: var(--sr-border) !important;
          color: var(--sr-text-sub) !important;
        }
        .ac-canvas-wrap { flex: 1; min-height: 160px; width: 100%; }
        .ac-canvas { display: block; width: 100%; height: 100%; min-height: 160px; }
        .ac-loading { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: var(--sr-text-sub); }
        .ac-legend { display: flex; gap: 14px; flex-wrap: wrap; }
        .ac-legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--sr-text-sub); }
        .ac-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .ac-legend-meta { margin-left: auto; font-size: 10px; color: var(--sr-text-muted); }
      `}</style>

      <div className="ac-root">
        <div className="ac-header">
          <div className="ac-title">
            <div className="ac-title-dot" />
            Analytics
            <span className="ac-badge">Live</span>
          </div>
          <div className="ac-tabs">
            <button className={`ac-tab ${activeTab === "bookings" ? "active" : ""}`} onClick={() => setActiveTab("bookings")}>
              📊 Booking Trends
            </button>
            <button className={`ac-tab ${activeTab === "response" ? "active" : ""}`} onClick={() => setActiveTab("response")}>
              ⏱ Response Time
            </button>
          </div>
        </div>

        {activeTab === "bookings" && !loading && (
          <div className="ac-summary">
            <div className="ac-pill" style={{ background: "rgba(0,212,170,0.1)", borderColor: "rgba(0,212,170,0.3)", color: "#00d4aa" }}>
              <div className="ac-pill-dot" style={{ background: "#00d4aa" }} />{confirmedCount} Confirmed
            </div>
            <div className="ac-pill" style={{ background: "rgba(247,201,72,0.1)", borderColor: "rgba(247,201,72,0.3)", color: "#c89800" }}>
              <div className="ac-pill-dot" style={{ background: "#f7c948" }} />{pendingCount} Pending
            </div>
            <div className="ac-pill" style={{ background: "rgba(229,9,20,0.1)", borderColor: "rgba(229,9,20,0.3)", color: "#ff4d5a" }}>
              <div className="ac-pill-dot" style={{ background: "#ff4d5a" }} />{cancelledCount} Cancelled
            </div>
            <div className="ac-pill ac-pill-neutral">
              Total: {totalLast7} bookings
            </div>
          </div>
        )}

        {activeTab === "response" && !loading && (
          <div className="ac-summary">
            <div className="ac-pill" style={{ background: "rgba(229,9,20,0.1)", borderColor: "rgba(229,9,20,0.3)", color: "#E50914" }}>
              <div className="ac-pill-dot" style={{ background: "#E50914" }} />Avg ETA (min)
            </div>
            <div className="ac-pill" style={{ background: "rgba(61,139,255,0.1)", borderColor: "rgba(61,139,255,0.3)", color: "#3d8bff" }}>
              <div className="ac-pill-dot" style={{ background: "#3d8bff" }} />Daily Demand
            </div>
          </div>
        )}

        <div className="ac-canvas-wrap">
          {loading ? (
            <div className="ac-loading">⏳ Loading analytics...</div>
          ) : (
            <>
              {activeTab === "bookings" && <canvas ref={barRef}  className="ac-canvas" />}
              {activeTab === "response" && <canvas ref={lineRef} className="ac-canvas" />}
            </>
          )}
        </div>

        {!loading && (
          <div className="ac-legend">
            {activeTab === "bookings" && (
              <>
                <div className="ac-legend-item"><div className="ac-legend-dot" style={{ background: "#00d4aa" }} />Confirmed</div>
                <div className="ac-legend-item"><div className="ac-legend-dot" style={{ background: "#f7c948" }} />Pending</div>
                <div className="ac-legend-item"><div className="ac-legend-dot" style={{ background: "#ff4d5a" }} />Cancelled</div>
              </>
            )}
            {activeTab === "response" && (
              <>
                <div className="ac-legend-item"><div className="ac-legend-dot" style={{ background: "#E50914" }} />Avg ETA (min)</div>
                <div className="ac-legend-item"><div className="ac-legend-dot" style={{ background: "#3d8bff" }} />Daily Bookings</div>
              </>
            )}
            <div className="ac-legend-meta">Last 7 days · Live data</div>
          </div>
        )}
      </div>
    </>
  );
};

export default AnalyticsCharts;
import { useEffect, useState } from 'react';
import { MapPin, AlertCircle, Loader } from 'lucide-react';

const DriverLocationTracker = ({ ambulanceId, driverEmail, bookingId }) => {
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const themeConfig = {
    colors: {
      bg: '#0a0a0f',
      surface: '#0d0d14',
      border: '#1a1a2e',
      text: '#e8e8f0',
      textSecondary: '#888899',
      accent: '#ff2d55',
      success: '#00d4aa',
      error: '#ff2d55',
      warning: '#f7c948',
    },
    fonts: {
      body: "'Outfit', 'Helvetica Neue', sans-serif",
      mono: "'Courier New', monospace"
    }
  };

  useEffect(() => {
    if (!ambulanceId || !driverEmail) {
      setError('Missing ambulance ID or driver email');
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      return;
    }

    setTracking(true);
    setError(null);

    // Function to send location to backend
    const sendLocation = (latitude, longitude, accuracy, speed) => {
      setIsLoading(true);
      const locationData = {
        ambulance_id: ambulanceId,
        driver_email: driverEmail,
        booking_id: bookingId,
        latitude,
        longitude,
        accuracy,
        speed,
      };

      setLocation(locationData);
      setLastUpdate(new Date().toLocaleTimeString());
      setUpdateCount(prev => prev + 1);

      // Send to backend
      fetch('http://127.0.0.1:8000/api/driver-location/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            // Location saved successfully
          } else {
            setError(data.error || 'Failed to save location');
          }
        })
        .catch(err => {
          console.error('Location update failed:', err);
          setError(`Network error: ${err.message}`);
        })
        .finally(() => setIsLoading(false));
    };

    // Get location immediately
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        sendLocation(latitude, longitude, accuracy, 0);
      },
      (error) => {
        setError(`Initial location failed: ${error.message}`);
      }
    );

    // Set interval to send location every 10 seconds
    const locationInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          sendLocation(latitude, longitude, accuracy, 0);
        },
        (error) => {
          console.error('Location error:', error);
          setError(`Location error: ${error.message}`);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }, 10000); // Every 10 seconds

    // Cleanup
    return () => {
      clearInterval(locationInterval);
      setTracking(false);
    };
  }, [ambulanceId, driverEmail, bookingId]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: themeConfig.colors.surface,
      border: `1px solid ${themeConfig.colors.border}`,
      padding: '16px',
      borderRadius: '12px',
      color: themeConfig.colors.text,
      fontSize: '13px',
      fontFamily: themeConfig.fonts.body,
      zIndex: 1000,
      minWidth: '300px',
      maxWidth: '320px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(10px)',
      animation: 'slideIn 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${themeConfig.colors.border}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '14px',
        }}>
          {isLoading ? (
            <Loader size={16} color={themeConfig.colors.warning} style={{ animation: 'spin 1s linear infinite' }} />
          ) : tracking ? (
            <MapPin size={16} color={themeConfig.colors.success} />
          ) : (
            <AlertCircle size={16} color={themeConfig.colors.error} />
          )}
          <span style={{
            color: isLoading ? themeConfig.colors.warning : 
                   tracking ? themeConfig.colors.success : 
                   themeConfig.colors.error
          }}>
            {isLoading ? 'UPDATING' : tracking ? 'TRACKING ACTIVE' : 'TRACKING PAUSED'}
          </span>
        </div>
        <div style={{
          fontSize: '11px',
          color: themeConfig.colors.textSecondary,
          fontFamily: themeConfig.fonts.mono,
          backgroundColor: 'rgba(255,255,255,0.05)',
          padding: '4px 8px',
          borderRadius: '4px',
        }}>
          #{updateCount}
        </div>
      </div>

      {/* Location Details */}
      {location && (
        <div style={{
          fontSize: '12px',
          color: themeConfig.colors.textSecondary,
          lineHeight: '1.8',
          marginBottom: '12px',
          padding: '10px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '8px',
          border: `1px solid ${themeConfig.colors.border}`,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>📍 LATITUDE</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              {location.latitude.toFixed(6)}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>📍 LONGITUDE</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              {location.longitude.toFixed(6)}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>📏 ACCURACY</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              ±{Math.round(location.accuracy)}m
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>⚡ BOOKING</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              #{bookingId}
            </span>
          </div>
        </div>
      )}

      {/* Last Update Time */}
      {lastUpdate && (
        <div style={{
          padding: '8px',
          background: 'rgba(0,212,170,0.1)',
          borderRadius: '6px',
          border: `1px solid ${themeConfig.colors.success}20`,
          marginBottom: '12px',
          fontSize: '11px',
          color: themeConfig.colors.success,
          fontWeight: 500,
        }}>
          ✓ Last update: {lastUpdate}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          color: themeConfig.colors.error,
          fontSize: '11px',
          padding: '8px',
          background: 'rgba(255,45,85,0.1)',
          borderRadius: '6px',
          border: `1px solid ${themeConfig.colors.error}20`,
          marginTop: '8px',
          wordBreak: 'break-word',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Status Bar */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: `1px solid ${themeConfig.colors.border}`,
        fontSize: '10px',
        color: themeConfig.colors.textSecondary,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Amb ID: {ambulanceId}</span>
        <span style={{ fontFamily: themeConfig.fonts.mono }}>{driverEmail}</span>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DriverLocationTracker;
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronsRight, Truck, Building2, BarChart2,
  ClipboardList, MapPin, Navigation, RefreshCw, LayoutDashboard, Map, BookOpen,
} from 'lucide-react';

const adminNavItems = [
  { to: "/Ambulances",           icon: Truck,         label: "Ambulances"       },
  { to: "/Hospitals",            icon: Building2,     label: "Hospitals"        },
  { to: "/Reports",              icon: BarChart2,     label: "Reports"          },
  { to: "/Requests",             icon: ClipboardList, label: "Requests"         },
  { to: "/DriverChangeRequests", icon: RefreshCw,     label: "Driver Requests", dot: true },
  { to: "/LiveMap",              icon: MapPin,        label: "Live Map",        dot: true },
  { to: "/DriverView",           icon: Navigation,    label: "Driver View"      },
];

const userNavItems = [
  { to: "/Ambulances",  icon: Truck,     label: "Ambulances"  },
  { to: "/Hospitals",   icon: Building2, label: "Hospitals"   },
  { to: "/MyBookings",  icon: BookOpen,  label: "My Bookings" },
  { to: "/directions",  icon: Map,       label: "Map"         },
];

const driverNavItems = [
  { to: "/DriverDashboard", icon: LayoutDashboard, label: "Dashboard", dot: true },
  { to: "/Ambulances",      icon: Truck,           label: "Ambulances" },
  { to: "/Hospitals",       icon: Building2,       label: "Hospitals"  },
  { to: "/directions",      icon: Map,             label: "Map"        },
];

const Leftsidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const role     = localStorage.getItem("role");

  const navItems =
    role === "admin"  ? adminNavItems  :
    role === "driver" ? driverNavItems :
    userNavItems;

  const pendingCount = (() => {
    try {
      const all = JSON.parse(localStorage.getItem("all_change_requests") || "[]");
      return all.filter(r => r.status === "pending").length;
    } catch { return 0; }
  })();

  const hideBottomNav = role === "driver";

  // Map tab ke liye: /directions pe navigate karo
  const handleNavClick = (e, to) => {
    if (to === "/directions") {
      e.preventDefault();
      navigate("/directions");
    }
    // baaki links normal Link se handle honge
  };

  return (
    <>
      <style>{`
        .lsb-root {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          height: 100vh !important;
          width: 64px !important;
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.07);
          display: flex !important;
          flex-direction: column;
          align-items: center;
          z-index: 9999 !important;
          padding: 0 0 16px;
        }
        .lsb-logo {
          height: 56px; width: 100%;
          display: flex; align-items: center; justify-content: center;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: #E50914; cursor: pointer; transition: color 0.2s;
          text-decoration: none; flex-shrink: 0;
        }
        .lsb-logo:hover { color: #f40612; }
        .lsb-nav {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 4px;
          padding: 12px 0; width: 100%;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .lsb-nav::-webkit-scrollbar { display: none; }
        .lsb-item {
          position: relative; width: 44px; height: 44px;
          border-radius: 10px; display: flex; align-items: center;
          justify-content: center; color: rgba(255,255,255,0.3);
          transition: all 0.2s; cursor: pointer; text-decoration: none; flex-shrink: 0;
        }
        .lsb-item:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.8); }
        .lsb-item.active { background: rgba(229,9,20,0.15); color: #E50914; border: 1px solid rgba(229,9,20,0.25); }
        .lsb-tooltip {
          position: absolute; left: 54px;
          background: #1a1a1a; color: #fff;
          font-size: 11px; font-weight: 600;
          padding: 5px 10px; border-radius: 6px;
          white-space: nowrap; opacity: 0; pointer-events: none;
          transition: opacity 0.15s; border: 1px solid rgba(255,255,255,0.1);
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; z-index: 99999;
        }
        .lsb-item:hover .lsb-tooltip { opacity: 1; }
        .lsb-dot {
          position: absolute; top: 6px; right: 6px;
          width: 6px; height: 6px; border-radius: 50%;
          background: #00c853; box-shadow: 0 0 6px #00c853;
          animation: lsb-pulse 1.5s infinite;
        }
        .lsb-dot-red {
          position: absolute;
          background: #E50914; box-shadow: 0 0 6px #E50914;
          animation: lsb-pulse 1.5s infinite;
          display: flex; align-items: center; justify-content: center;
          font-size: 8px; font-weight: 800; color: #fff;
          min-width: 14px; height: 14px;
          padding: 0 3px; border-radius: 7px;
          top: 2px; right: 2px;
        }
        @keyframes lsb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
        .lsb-divider {
          width: 28px; height: 1px;
          background: rgba(255,255,255,0.07);
          margin: 4px 0; flex-shrink: 0;
        }

        /* ── Mobile Bottom Nav ── */
        .lsb-bottom {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 60px; background: #0a0a0a;
          border-top: 1px solid rgba(255,255,255,0.07);
          z-index: 9999;
          align-items: center;
          justify-content: space-around; padding: 0 4px;
        }
        .lsb-bottom-item {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 3px; flex: 1; height: 100%;
          color: rgba(255,255,255,0.3); text-decoration: none;
          transition: color 0.2s; position: relative;
          border-top: 2px solid transparent;
          cursor: pointer;
          background: none;
          border-left: none;
          border-right: none;
          border-bottom: none;
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }
        .lsb-bottom-item.active { color: #E50914; border-top-color: #E50914; }
        .lsb-bottom-item:hover  { color: rgba(255,255,255,0.7); }
        .lsb-bottom-label {
          font-size: 9px; font-weight: 600;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          white-space: nowrap;
        }
        .lsb-bottom-dot {
          position: absolute; top: 6px; right: calc(50% - 14px);
          width: 5px; height: 5px; border-radius: 50%;
          background: #00c853; box-shadow: 0 0 5px #00c853;
          animation: lsb-pulse 1.5s infinite;
        }

        @media (max-width: 767px) {
          .lsb-root   { display: none !important; }
          .lsb-bottom { display: flex !important; }
          .lsb-bottom.hidden { display: none !important; }
        }
      `}</style>

      {/* Desktop Sidebar */}
      <div className="lsb-root">
        <Link to="/" className="lsb-logo"><ChevronsRight size={28} /></Link>
        <div className="lsb-nav">
          {navItems.map((item, index) => {
            const Icon         = item.icon;
            const isActive     = location.pathname === item.to;
            const isPendingReq = item.to === "/DriverChangeRequests" && pendingCount > 0;
            return (
              <div key={item.to} style={{ display: "contents" }}>
                {role === "admin" && index === 5 && <div className="lsb-divider" />}
                <Link
                  to={item.to}
                  className={`lsb-item ${isActive ? "active" : ""}`}
                  onClick={(e) => handleNavClick(e, item.to)}
                >
                  <Icon size={20} />
                  {item.dot && !isPendingReq && <div className="lsb-dot" />}
                  {isPendingReq && <div className="lsb-dot-red">{pendingCount}</div>}
                  <span className="lsb-tooltip">{item.label}{isPendingReq ? ` (${pendingCount})` : ""}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className={`lsb-bottom ${hideBottomNav ? "hidden" : ""}`}>
        {navItems.map((item) => {
          const Icon     = item.icon;
          const isActive = location.pathname === item.to;

          // Map tab ke liye button use karo (proper navigate)
          if (item.to === "/directions") {
            return (
              <button
                key={item.to}
                className={`lsb-bottom-item ${isActive ? "active" : ""}`}
                onClick={() => navigate("/directions")}
                type="button"
              >
                <Icon size={20} />
                <span className="lsb-bottom-label">{item.label}</span>
                {item.dot && <div className="lsb-bottom-dot" />}
              </button>
            );
          }

          return (
            <Link key={item.to} to={item.to} className={`lsb-bottom-item ${isActive ? "active" : ""}`}>
              <Icon size={20} />
              <span className="lsb-bottom-label">{item.label}</span>
              {item.dot && <div className="lsb-bottom-dot" />}
            </Link>
          );
        })}
      </div>
    </>
  );
};

export default Leftsidebar;
// Maps.jsx — Homepage map (Google Maps → Leaflet)
// Replaces: import { GoogleMap } from "@react-google-maps/api"
// Place at: src/Components/Map.jsx

import { useState, useEffect, useRef } from "react";
import useLeaflet, { DARK_TILE, DELHI, STATUS_COLOR, makeIcon, makePinIcon } from "../hooks/useLeaflet";

const delhiLocations = [
  { lat: 28.6139, lng: 77.2090 },
  { lat: 28.6328, lng: 77.2197 },
  { lat: 28.5921, lng: 77.2290 },
  { lat: 28.6469, lng: 77.1025 },
  { lat: 28.5355, lng: 77.3910 },
  { lat: 28.7041, lng: 77.1025 },
  { lat: 28.6280, lng: 77.3649 },
];

const Maps = () => {
  const leafletReady = useLeaflet();
  const mapDivRef    = useRef(null);
  const mapObj       = useRef(null);
  const markersRef   = useRef([]);

  const [ambulances, setAmbulances] = useState([]);
  const [bookings,   setBookings]   = useState([]);

  useEffect(() => {
    const fetchAll = () => {
      fetch("http://127.0.0.1:8000/api/ambulances/")
        .then(r => r.json()).then(setAmbulances).catch(console.log);
      fetch("http://127.0.0.1:8000/api/bookings/")
        .then(r => r.json()).then(setBookings).catch(console.log);
    };
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  // Init map once Leaflet is ready
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;

    mapObj.current = L.map(mapDivRef.current, {
      center: [DELHI.lat, DELHI.lng],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer(DARK_TILE, { maxZoom: 19 }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);

    return () => {
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
    };
  }, [leafletReady]);

  // Update markers when ambulances/bookings change
  useEffect(() => {
    if (!leafletReady || !mapObj.current || !window.L) return;
    const L = window.L;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const bookedIds = new Set(
      bookings
        .filter(b => b.status === "confirmed" || b.status === "pending")
        .map(b => b.ambulance_id)
    );

    ambulances.forEach((a, i) => {
      const lat = parseFloat(a.latitude)  || delhiLocations[i % delhiLocations.length].lat;
      const lng = parseFloat(a.longitude) || delhiLocations[i % delhiLocations.length].lng;
      const isBooked = bookedIds.has(a.id);
      const color    = isBooked ? "#e53935" : (STATUS_COLOR[a.status] || STATUS_COLOR.offline);

      const icon = makePinIcon(color, "🚑");
      if (!icon) return;

      const marker = L.marker([lat, lng], { icon }).addTo(mapObj.current);

      marker.bindPopup(`
        <div style="background:#1a1a1a;color:#fff;padding:10px 14px;border-radius:10px;min-width:180px;font-family:sans-serif">
          <div style="font-size:14px;font-weight:800;margin-bottom:6px">🚑 ${a.ambulance_number}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:2px">Driver: ${a.driver}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:2px">Contact: ${a.driver_contact}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px">Location: ${a.location}</div>
          <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;text-transform:uppercase;
            background:${isBooked ? "rgba(229,9,20,0.2)" : "rgba(0,212,170,0.15)"};
            color:${isBooked ? "#ff4d5a" : "#00d4aa"};
            border:1px solid ${isBooked ? "#ff4d5a" : "#00d4aa"}">
            ${isBooked ? "🔴 Booked" : a.status}
          </span>
        </div>
      `, { className: "sr-dark-popup" });

      markersRef.current.push(marker);
    });
  }, [leafletReady, ambulances, bookings]);

  return (
    <>
      <style>{`
        .sr-dark-popup .leaflet-popup-content-wrapper {
          background: rgba(20,20,20,0.97) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
        }
        .sr-dark-popup .leaflet-popup-tip { background: rgba(20,20,20,0.97) !important; }
        .sr-dark-popup .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; }
        .leaflet-control-zoom a {
          background: rgba(20,20,20,0.92) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .leaflet-control-zoom a:hover { background: rgba(40,40,40,0.95) !important; }
        .leaflet-routing-container { display: none !important; }
      `}</style>
      <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
};

export default Maps;
// RealTimeMap.jsx — Live driver tracking (Leaflet)
import { useState, useEffect, useRef } from "react";
import useLeaflet, { DARK_TILE, DELHI, STATUS_COLOR, makeIcon, makePinIcon } from "../hooks/useLeaflet";

const BASE    = "http://127.0.0.1:8000";
const REFRESH = 5000;

export default function RealTimeMap({ onSelectDriver }) {
  const leafletReady = useLeaflet();
  const [drivers,    setDrivers]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const mapDivRef  = useRef(null);
  const mapObj     = useRef(null);
  const markersRef = useRef({});
  const popupRef   = useRef(null);

  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    mapObj.current = L.map(mapDivRef.current, {
      center: [DELHI.lat, DELHI.lng], zoom: 12, zoomControl: false,
    });
    L.tileLayer(DARK_TILE, { maxZoom: 19 }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    popupRef.current = L.popup({ className: "sr-dark-popup" });
    return () => {
      Object.values(markersRef.current).forEach(m => { try { m.remove(); } catch {} });
      markersRef.current = {};
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
    };
  }, [leafletReady]);

  useEffect(() => {
    fetchLocations();
    const t = setInterval(fetchLocations, REFRESH);
    return () => clearInterval(t);
  }, [leafletReady]);

  const fetchLocations = async () => {
    try {
      const res  = await fetch(`${BASE}/api/admin/live-locations/`);
      const data = await res.json();
      setDrivers(data);
      setLastUpdate(new Date().toLocaleTimeString());
      if (leafletReady && mapObj.current) updateMarkers(data);
    } catch {}
  };

  const updateMarkers = (data) => {
    if (!mapObj.current || !window.L) return;
    const L   = window.L;
    const seen = new Set();
    data.forEach(d => {
      seen.add(d.ambulance_id);
      const color = STATUS_COLOR[d.status] || STATUS_COLOR.offline;
      const icon  = makePinIcon(color, "🚑");
      if (!icon) return;
      if (markersRef.current[d.ambulance_id]) {
        markersRef.current[d.ambulance_id].setLatLng([d.latitude, d.longitude]);
        markersRef.current[d.ambulance_id].setIcon(icon);
      } else {
        const m = L.marker([d.latitude, d.longitude], { icon }).addTo(mapObj.current);
        m.on("click", () => {
          setSelected(d);
          popupRef.current.setLatLng([d.latitude, d.longitude]).setContent(buildPopup(d)).openOn(mapObj.current);
        });
        markersRef.current[d.ambulance_id] = m;
      }
    });
    Object.keys(markersRef.current).forEach(id => {
      if (!seen.has(parseInt(id))) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });
  };

  const buildPopup = (d) => `
    <div style="background:#1a1a1a;color:#fff;padding:12px 14px;border-radius:10px;min-width:200px;font-family:'Segoe UI',sans-serif">
      <div style="font-size:15px;font-weight:800;margin-bottom:8px">🚑 ${d.ambulance_number}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:3px">👤 ${d.driver}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px">📧 ${d.driver_email}</div>
      <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;
        background:${(STATUS_COLOR[d.status]||"#555")}22;color:${STATUS_COLOR[d.status]||"#555"};
        border:1px solid ${STATUS_COLOR[d.status]||"#555"}">
        ${d.status.replace("_"," ").toUpperCase()}
      </span>
      <div style="font-size:11px;color:#555;margin-top:8px">⚡ ${d.speed} km/h</div>
    </div>`;

  const focusDriver = (d) => {
    if (!mapObj.current) return;
    mapObj.current.flyTo([d.latitude, d.longitude], 16, { duration: 1 });
    setSelected(d);
    if (popupRef.current) popupRef.current.setLatLng([d.latitude, d.longitude]).setContent(buildPopup(d)).openOn(mapObj.current);
    setTimeout(() => onSelectDriver?.(d), 100);
  };

  // Fix map render — invalidateSize after map init
  useEffect(() => {
    if (!mapObj.current) return;
    const t1 = setTimeout(() => mapObj.current?.invalidateSize(), 100);
    const t2 = setTimeout(() => mapObj.current?.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [leafletReady]);

  const activeCount  = drivers.filter(d => d.status !== "offline").length;
  const enRouteCount = drivers.filter(d => d.status === "en_route").length;

  return (
    <>
      <style>{`
        .sr-dark-popup .leaflet-popup-content-wrapper {
          background: rgba(20,20,20,0.97) !important; border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
        }
        .sr-dark-popup .leaflet-popup-tip { background: rgba(20,20,20,0.97) !important; }
        .sr-dark-popup .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; }
        .leaflet-control-zoom a { background: rgba(20,20,20,0.92) !important; color: #fff !important; border-color: rgba(255,255,255,0.1) !important; }
        .leaflet-control-zoom a:hover { background: rgba(40,40,40,0.95) !important; }
        .leaflet-routing-container { display: none !important; }

        /* ── RealTimeMap Layout ── */
        .rtm-root { display: flex; width: 100%; height: 100%; font-family: 'Segoe UI', sans-serif; }

        .rtm-sidebar {
          width: 280px; min-width: 280px;
          background: #111; border-right: 1px solid #1c1c1c;
          display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;
        }
        .rtm-sidebar-header {
          padding: 12px 14px; border-bottom: 1px solid #1c1c1c;
          display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
        }
        .rtm-stats {
          display: flex; padding: 10px 12px; gap: 8px;
          border-bottom: 1px solid #1c1c1c; flex-shrink: 0;
        }
        .rtm-stat {
          flex: 1; border-radius: 8px; padding: 8px 4px; text-align: center;
        }
        .rtm-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .rtm-map-wrap { flex: 1; min-width: 0; position: relative; min-height: 0; }

        /* ── Mobile: stack vertically ── */
        @media (max-width: 767px) {
          .rtm-root { flex-direction: column; overflow-y: auto; }
          .rtm-sidebar {
            width: 100% !important;
            min-width: unset !important;
            max-width: 100% !important;
            border-right: none;
            border-bottom: 1px solid #1c1c1c;
            max-height: 300px;
            flex-shrink: 0;
          }
          .rtm-map-wrap {
            flex: none;
            height: 350px;
            min-height: 300px;
            width: 100%;
          }
          .rtm-map-wrap > div {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            right: 0 !important; bottom: 0 !important;
          }
        }
      `}</style>

      <div className="rtm-root">
        {/* Sidebar */}
        <div className="rtm-sidebar">
          <div className="rtm-sidebar-header">
            <span style={{ fontWeight:700, fontSize:14, color:"#fff" }}>🗺 Live Tracking</span>
            <span style={{ fontSize:11, color:"#444" }}>↻ {lastUpdate||"—"}</span>
          </div>
          <div className="rtm-stats">
            {[["Active",activeCount,"#00c853"],["En Route",enRouteCount,"#ff6d00"],["Total",drivers.length,"#4fc3f7"]].map(([l,v,c]) => (
              <div key={l} className="rtm-stat" style={{ background:c+"11", border:`1px solid ${c}33` }}>
                <div style={{ fontSize:20, fontWeight:700, color:"#fff" }}>{v}</div>
                <div style={{ fontSize:10, color:"#666", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="rtm-list">
            {drivers.length === 0 && (
              <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"30px 10px", lineHeight:2 }}>
                Koi driver GPS nahi bhej raha<br/>
                <span style={{ fontSize:11, color:"#333" }}>Driver app se tracking start karo</span>
              </div>
            )}
            {drivers.map(d => (
              <div key={d.ambulance_id}
                style={{ background: selected?.ambulance_id===d.ambulance_id?"#1e1e1e":"#161616", border:`1px solid ${selected?.ambulance_id===d.ambulance_id?"#444":"#1c1c1c"}`, borderRadius:8, padding:"10px 12px", cursor:"pointer" }}
                onClick={() => focusDriver(d)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"#fff" }}>{d.ambulance_number}</span>
                  <span style={{ background:(STATUS_COLOR[d.status]||"#555")+"22", color:STATUS_COLOR[d.status]||"#555", border:`1px solid ${STATUS_COLOR[d.status]||"#555"}44`, borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:600, textTransform:"capitalize" }}>
                    {d.status.replace("_"," ")}
                  </span>
                </div>
                <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>👤 {d.driver}</div>
                <div style={{ fontSize:11, color:"#555" }}>⚡ {d.speed} km/h</div>
                {d.active_route && (
                  <div style={{ fontSize:11, color:"#ff6d00", marginTop:4, background:"#ff6d0011", padding:"3px 6px", borderRadius:4 }}>
                    🗺 {d.active_route.pickup_location?.slice(0,28)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="rtm-map-wrap">
          <div ref={mapDivRef} style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }} />
          {drivers.length === 0 && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:1 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📡</div>
              <div style={{ color:"#333", fontSize:14 }}>Driver Inactive</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
import Activevehicles from "../assets/Stats/Activevehicles";
import Fuelefficiency from "../assets/Stats/Fuelefficiency";
import Successrate from "../assets/Stats/Succcessrate";
import Totalcases from "../assets/Stats/Totalcases";

const cards = [
  { component: <Activevehicles />, accent: "#E50914" },
  { component: <Successrate />,   accent: "#E50914" },
  { component: <Totalcases />,    accent: "#E50914" },
  { component: <Fuelefficiency />, accent: "#E50914" },
];

const Stats = () => {
  return (
    <>
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 10px;
          height: 100%;
          width: 100%;
          padding: 10px;
          box-sizing: border-box;
        }
        .stats-card {
          background: var(--sr-stat-bg, #1a1a1a);
          border: 1px solid var(--sr-border, rgba(255,255,255,0.08));
          border-radius: 16px;
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s, transform 0.2s, background 0.3s;
          min-height: 0;
        }
        .stats-card:hover {
          border-color: rgba(229,9,20,0.4);
          transform: scale(1.02);
        }
        .stats-card-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: #E50914;
          border-radius: 16px 16px 0 0;
        }

        /* ── Stat card inner styles ── */
        .stats-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .stats-card-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--sr-text-sub);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .stats-card-icon {
          color: var(--sr-icon, rgba(255,255,255,0.4));
          display: flex;
          align-items: center;
        }
        .stats-card-value {
          font-size: 32px;
          font-weight: 800;
          color: var(--sr-text);
          line-height: 1;
          letter-spacing: -1px;
        }
        .stats-card-sub {
          font-size: 10px;
          color: var(--sr-text-muted);
          margin-top: 4px;
        }

        /* ── Responsive sizing ── */
        @media (max-width: 1279px) {
          .stats-card { padding: 16px 18px; }
          .stats-card-value { font-size: 26px; }
        }
        @media (max-width: 1023px) {
          .stats-card { padding: 14px 16px; border-radius: 12px; }
          .stats-card-value { font-size: 24px; }
        }
        @media (max-width: 767px) {
          .stats-grid { gap: 8px; padding: 8px; }
          .stats-card { padding: 12px 14px; border-radius: 12px; }
          .stats-card:hover { transform: none; }
          .stats-card-value { font-size: 22px; }
        }
      `}</style>

      <div className="stats-grid">
        {cards.map((c, i) => (
          <div key={i} className="stats-card">
            <div className="stats-card-bar" />
            {c.component}
          </div>
        ))}
      </div>
    </>
  );
};

export default Stats;
// ============================================================================
// FILE: theme.js - THEME CONFIGURATION (use globally)
// ============================================================================

export const Theme = {
  colors: {
    bg: '#0a0a0f',
    surface: '#0d0d14',
    border: '#1a1a2e',
    text: '#e8e8f0',
    textSecondary: '#888899',
    accent: '#ff2d55',
    success: '#00d4aa',
    warning: '#f7c948',
    error: '#ff2d55',
  },
  fonts: {
    display: "'Outfit', 'Helvetica Neue', sans-serif",
    body: "'Outfit', 'Helvetica Neue', sans-serif",
    mono: "'Courier New', monospace"
  }
};
export default Theme;import { Bell, Search, X, Camera } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const Topnavbar = () => {
  const { theme, setTheme, themes } = useTheme();
  const [search, setSearch]                     = useState('');
  const [searchResults, setSearchResults]       = useState({ ambulances: [], hospitals: [] });
  const [showSearchDrop, setShowSearchDrop]     = useState(false);
  const [searchLoading, setSearchLoading]       = useState(false);
  const [unread, setUnread]                     = useState(0);
  const [notifications, setNotifs]              = useState([]);
  const [showDrop, setShowDrop]                 = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu]   = useState(false);

  const user     = localStorage.getItem("name");
  const email    = localStorage.getItem("user") || "guest";
  const role     = localStorage.getItem("role");
  const ambId    = parseInt(localStorage.getItem("ambulance_id") || "0");
  const ambIdStr = localStorage.getItem("ambulance_id") || "0";

  const dpKey = `sr-profile-pic-${email}`;
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem(dpKey) || null);

  useEffect(() => { setProfilePic(localStorage.getItem(dpKey) || null); }, [dpKey]);

  // Mobile search overlay open hone pe body class toggle
  useEffect(() => {
    if (showMobileSearch) document.body.classList.add('sr-search-open');
    else document.body.classList.remove('sr-search-open');
    return () => document.body.classList.remove('sr-search-open');
  }, [showMobileSearch]);

  const dropRef      = useRef(null);
  const searchRef    = useRef(null);
  const profileRef   = useRef(null);
  const fileInputRef = useRef(null);
  const navigate     = useNavigate();

  // ── USER notifications: apni bookings fetch karo ──
  const fetchUserNotifications = () => {
    if (role !== "user" && role !== null && role !== "") return;
    // role "user" ya logged-in non-admin non-driver
    const userEmail = email;
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(data => {
        // Sirf is user ki bookings
        const mine = data
          .filter(b => b.booked_by_email === userEmail || b.user_email === userEmail || b.booked_by === user)
          .sort((a, b) => b.id - a.id)
          .slice(0, 8);

        const notifs = mine.map(b => ({
          id:        b.id,
          type:      "booking",
          bookingId: b.id,
          status:    b.status,
          title:     b.status === "confirmed"
                       ? `✅ Booking #${b.id} Confirmed!`
                       : b.status === "cancelled" || b.status === "rejected"
                       ? `❌ Booking #${b.id} Rejected`
                       : b.status === "completed"
                       ? `🏁 Booking #${b.id} Completed`
                       : `⏳ Booking #${b.id} Pending`,
          message:   `Ambulance: ${b.ambulance_number || "—"} · Pickup: ${b.pickup_location || "—"}`,
          timestamp: b.created_at || new Date().toISOString(),
          read:      false,
        }));

        setNotifs(notifs);
        // Unread = confirmed ya rejected jo user ne abhi nahi dekha
        const notifKey = `user_notif_read_${userEmail}`;
        const readIds  = JSON.parse(localStorage.getItem(notifKey) || "[]");
        setUnread(notifs.filter(n => !readIds.includes(n.id) && (n.status === "confirmed" || n.status === "cancelled" || n.status === "rejected")).length);
      })
      .catch(() => {});
  };

  // ── DRIVER notifications ──
  const fetchDriverNotifications = () => {
    if (role !== "driver") return;
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(data => {
        const mine = data.filter(b =>
          b.ambulance_id === ambId || String(b.ambulance_id) === ambIdStr
        ).slice(0, 8);
        const notifKey = `dr_notif_${email}`;
        const stored   = JSON.parse(localStorage.getItem(notifKey) || "[]");
        const allNotifs = [
          ...stored.slice(0, 3),
          ...mine.map(b => ({
            id: b.id, type: "booking", bookingId: b.id,
            title:   `🚑 Booking #${b.id} — ${b.status}`,
            message: `${b.booked_by} · ${b.pickup_location}`,
            timestamp: b.created_at || new Date().toISOString(),
            read: b.status === "completed", status: b.status,
          })),
        ].slice(0, 8);
        setNotifs(allNotifs);
        setUnread(allNotifs.filter(n => !n.read).length);
      })
      .catch(() => {
        const notifKey = `dr_notif_${email}`;
        const stored   = JSON.parse(localStorage.getItem(notifKey) || "[]");
        setNotifs(stored.slice(0, 8));
        setUnread(stored.filter(n => !n.read).length);
      });
  };

  // ── ADMIN notifications ──
  const fetchAdminNotifications = () => {
    if (role !== "admin") return;
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(data => {
        setNotifs(data.slice(0, 8));
        setUnread(data.filter(b => !b.is_read).length);
      })
      .catch(() => {});
  };

  const fetchUnread = () => {
    if (role === "driver")      fetchDriverNotifications();
    else if (role === "admin")  fetchAdminNotifications();
    else                        fetchUserNotifications();
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 8000);
    window.addEventListener("new-booking", fetchUnread);
    return () => { clearInterval(interval); window.removeEventListener("new-booking", fetchUnread); };
  }, [role, ambId]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current    && !dropRef.current.contains(e.target))    setShowDrop(false);
      if (searchRef.current  && !searchRef.current.contains(e.target))  setShowSearchDrop(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfilePic(ev.target.result);
      localStorage.setItem(dpKey, ev.target.result);
      setShowProfileMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePic = () => {
    setProfilePic(null);
    localStorage.removeItem(dpKey);
    setShowProfileMenu(false);
  };

  const doSearch = async () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    setSearchLoading(true);
    setShowSearchDrop(true);
    const ambKeywords  = ["ambulance","ambulances","amb","vehicle","fleet","driver"];
    const hospKeywords = ["hospital","hospitals","hosp","clinic","medical","health","beds"];
    const wantsAmb  = ambKeywords.some(k => q.includes(k) || k.includes(q));
    const wantsHosp = hospKeywords.some(k => q.includes(k) || k.includes(q));
    try {
      const [ambRes, hospRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/ambulances/"),
        fetch("http://127.0.0.1:8000/api/hospitals/"),
      ]);
      const [ambData, hospData] = await Promise.all([ambRes.json(), hospRes.json()]);
      const filteredAmb = wantsAmb
        ? ambData.slice(0, 5)
        : ambData.filter(a =>
            (a.ambulance_number||"").toLowerCase().includes(q) ||
            (a.driver||"").toLowerCase().includes(q) ||
            (a.location||"").toLowerCase().includes(q) ||
            (a.model||"").toLowerCase().includes(q) ||
            (a.status||"").toLowerCase().includes(q)
          ).slice(0, 5);
      const filteredHosp = wantsHosp
        ? hospData.slice(0, 5)
        : hospData.filter(h =>
            (h.name||"").toLowerCase().includes(q) ||
            (h.address||"").toLowerCase().includes(q) ||
            (h.specializations||"").toLowerCase().includes(q) ||
            (h.status||"").toLowerCase().includes(q) ||
            (h.hospital_type||"").toLowerCase().includes(q)
          ).slice(0, 5);
      setSearchResults({
        ambulances: (wantsAmb && !wantsHosp) ? filteredAmb : (!wantsAmb && !wantsHosp) ? filteredAmb : wantsAmb ? filteredAmb : [],
        hospitals:  (wantsHosp && !wantsAmb) ? filteredHosp : (!wantsAmb && !wantsHosp) ? filteredHosp : wantsHosp ? filteredHosp : [],
      });
    } catch {
      setSearchResults({ ambulances: [], hospitals: [] });
    }
    setSearchLoading(false);
  };

  const handleKeyDown      = (e) => { if (e.key==='Enter') doSearch(); if (e.key==='Escape') { setShowSearchDrop(false); setShowMobileSearch(false); } };
  const handleSearchChange = (e) => { setSearch(e.target.value); if (!e.target.value.trim()) { setShowSearchDrop(false); setSearchResults({ ambulances:[], hospitals:[] }); } };
  const goTo = (path) => { navigate(path); setShowSearchDrop(false); setShowMobileSearch(false); setSearch(''); };

  const openNotifs = () => {
    setShowDrop(d => !d);
    if (!showDrop) {
      if (role === "admin") {
        fetch("http://127.0.0.1:8000/api/bookings/mark-read/", { method:"POST" }).then(() => setUnread(0)).catch(()=>{});
      } else if (role === "driver") {
        const notifKey = `dr_notif_${email}`;
        const stored   = JSON.parse(localStorage.getItem(notifKey) || "[]");
        localStorage.setItem(notifKey, JSON.stringify(stored.map(n => ({ ...n, read: true }))));
        setUnread(0);
      } else {
        // User: mark all as read in localStorage
        const notifKey = `user_notif_read_${email}`;
        const allIds   = notifications.map(n => n.id);
        localStorage.setItem(notifKey, JSON.stringify(allIds));
        setUnread(0);
      }
    }
  };

  const logoutUser = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("name");
    localStorage.removeItem("role");
    window.location.reload();
  };

  const totalResults = searchResults.ambulances.length + searchResults.hospitals.length;

  const handleNotifClick = (n) => {
    setShowDrop(false);
    if (role === "driver") navigate("/");
    else if (role === "admin") navigate("/Requests");
    else navigate("/Ambulances"); // user ko ambulance page pe le jao
  };

  // Status ke hisaab se color
  const getStatusStyle = (status) => {
    if (status === "confirmed")  return { bg:"rgba(0,212,170,0.12)",  color:"#00d4aa", border:"rgba(0,212,170,0.3)"  };
    if (status === "cancelled" || status === "rejected")
                                 return { bg:"rgba(229,9,20,0.12)",   color:"#ff4d5a", border:"rgba(229,9,20,0.3)"   };
    if (status === "completed")  return { bg:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)", border:"rgba(255,255,255,0.15)" };
    return                              { bg:"rgba(247,201,72,0.12)", color:"#f7c948", border:"rgba(247,201,72,0.3)"  }; // pending
  };

  const SearchDropdown = () => (
    <div className="nf-search-drop">
      {searchLoading ? (
        <div className="nf-sd-loading">🔍 Searching...</div>
      ) : totalResults === 0 ? (
        <div className="nf-sd-empty">
          No results for <strong>"{search}"</strong><br/>
          <span style={{fontSize:11}}>Try: "ambulances", "hospitals", driver name or location</span>
        </div>
      ) : (
        <>
          {searchResults.ambulances.length > 0 && (
            <>
              <div className="nf-sd-section">🚑 Ambulances</div>
              {searchResults.ambulances.map((a) => (
                <div key={a.id} className="nf-sd-item">
                  <div className="nf-sd-icon nf-sd-icon-amb">🚑</div>
                  <div className="nf-sd-info">
                    <div className="nf-sd-name">{a.ambulance_number}</div>
                    <div className="nf-sd-sub">{a.driver} · {a.location||"—"}</div>
                  </div>
                  <div className="nf-sd-right">
                    <span className={`nf-sd-badge nf-sd-badge-${a.status}`}>{a.status?.replace("_"," ")}</span>
                    <button className="nf-sd-details-btn" onClick={() => goTo("/Ambulances")}>Check Details →</button>
                  </div>
                </div>
              ))}
              <div className="nf-sd-viewall">
                <span className="nf-sd-viewall-text">{searchResults.ambulances.length} result(s)</span>
                <button className="nf-sd-viewall-btn" onClick={() => goTo("/Ambulances")}>View All →</button>
              </div>
            </>
          )}
          {searchResults.hospitals.length > 0 && (
            <>
              <div className="nf-sd-section">🏥 Hospitals</div>
              {searchResults.hospitals.map((h) => (
                <div key={h.id} className="nf-sd-item">
                  <div className="nf-sd-icon nf-sd-icon-hosp">🏥</div>
                  <div className="nf-sd-info">
                    <div className="nf-sd-name">{h.name}</div>
                    <div className="nf-sd-sub">{h.address} · Beds: {h.available_beds??'—'}</div>
                  </div>
                  <div className="nf-sd-right">
                    <span className={`nf-sd-badge nf-sd-badge-${h.status}`}>{h.status}</span>
                    <button className="nf-sd-details-btn" onClick={() => goTo("/Hospitals")}>Check Details →</button>
                  </div>
                </div>
              ))}
              <div className="nf-sd-viewall">
                <span className="nf-sd-viewall-text">{searchResults.hospitals.length} result(s)</span>
                <button className="nf-sd-viewall-btn" onClick={() => goTo("/Hospitals")}>View All →</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .nf-nav-root {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000; height: 56px;
          background: var(--sr-nav-bg, #141414);
          border-bottom: 1px solid var(--sr-nav-border, rgba(255,255,255,0.08));
          display: flex; align-items: center; padding: 0 16px 0 80px; gap: 12px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          transition: background 0.3s, border-color 0.3s;
          box-sizing: border-box;
        }
        .nf-brand { font-size: 18px; font-weight: 900; color: var(--sr-accent); letter-spacing: 2px; text-transform: uppercase; white-space: nowrap; flex-shrink: 0; }
        .nf-search-wrap { position: relative; flex-shrink: 0; }
        .nf-search-inner { display: flex; align-items: center; background: var(--sr-nav-input-bg, rgba(255,255,255,0.06)); border: 1px solid var(--sr-nav-input-border, rgba(255,255,255,0.12)); border-radius: 4px; height: 36px; width: 300px; overflow: hidden; transition: border-color 0.2s, background 0.2s; }
        .nf-search-inner:focus-within { border-color: rgba(229,9,20,0.5); }
        .nf-search-icon { padding: 0 10px; display: flex; align-items: center; flex-shrink: 0; }
        .nf-search-input { flex: 1; background: transparent; border: none; outline: none; color: var(--sr-nav-text, #fff); font-size: 13px; font-family: inherit; min-width: 0; }
        .nf-search-input::placeholder { color: var(--sr-nav-text-muted, rgba(255,255,255,0.25)); }
        .nf-search-btn { height: 100%; padding: 0 14px; background: var(--sr-accent); border: none; border-left: 1px solid rgba(229,9,20,0.4); color: #fff; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
        .nf-search-btn:hover { background: #f40612; }
        .nf-mobile-search-btn { display: none; width: 34px; height: 34px; border-radius: 4px; background: var(--sr-nav-input-bg); border: 1px solid var(--sr-nav-input-border); color: var(--sr-nav-text-sub); align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }

        /* Mobile search overlay — z-index 1100 taaki content ke upar rahe */
        .nf-mobile-search-overlay {
          display: none; position: fixed; top: 56px; left: 0; right: 0;
          background: var(--sr-nav-bg); border-bottom: 1px solid var(--sr-nav-border);
          padding: 10px 16px; z-index: 1100; gap: 8px; align-items: center;
        }
        .nf-mobile-search-overlay.open { display: flex; }
        .nf-mobile-search-overlay .nf-search-inner { width: 100%; flex: 1; }

        /* Pages ko push karo jab search overlay open ho */
        body.sr-search-open .hosp-root,
        body.sr-search-open .amb-root,
        body.sr-search-open [class*="-root"] {
          padding-top: 113px !important; /* 56px nav + 57px overlay */
        }

        .nf-search-drop { position: absolute; top: 42px; left: 0; width: min(410px, 95vw); background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); z-index: 1101; overflow: hidden; }
        .nf-mobile-search-drop { position: fixed; top: 123px; left: 8px; right: 8px; background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); z-index: 1101; max-height: 60vh; overflow-y: auto; }
        .nf-sd-section { padding: 10px 16px 4px; font-size: 10px; font-weight: 800; color: var(--sr-accent); letter-spacing: 1px; text-transform: uppercase; }
        .nf-sd-item { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-bottom: 1px solid var(--sr-border); transition: background 0.15s; }
        .nf-sd-item:hover { background: var(--sr-hover); }
        .nf-sd-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .nf-sd-icon-amb  { background: rgba(229,9,20,0.12); }
        .nf-sd-icon-hosp { background: rgba(33,150,243,0.12); }
        .nf-sd-info { flex: 1; min-width: 0; }
        .nf-sd-name { font-size: 13px; font-weight: 600; color: var(--sr-text, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nf-sd-sub  { font-size: 11px; color: var(--sr-text-sub); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nf-sd-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
        .nf-sd-badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 800; white-space: nowrap; text-transform: uppercase; }
        .nf-sd-badge-available { background: rgba(0,212,170,0.15); color: #00d4aa; }
        .nf-sd-badge-en_route  { background: rgba(247,201,72,0.15); color: #f7c948; }
        .nf-sd-badge-busy      { background: rgba(229,9,20,0.15);   color: #ff4d5a; }
        .nf-sd-badge-offline   { background: rgba(255,255,255,0.08); color: rgba(200,200,200,0.6); }
        .nf-sd-badge-active    { background: rgba(0,212,170,0.15); color: #00d4aa; }
        .nf-sd-badge-full      { background: rgba(247,201,72,0.15); color: #f7c948; }
        .nf-sd-badge-critical  { background: rgba(229,9,20,0.15);   color: #ff4d5a; }
        .nf-sd-badge-closed    { background: rgba(255,255,255,0.08); color: rgba(200,200,200,0.6); }
        .nf-sd-details-btn { font-size: 10px; font-weight: 700; background: var(--sr-accent); color: #fff; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .nf-sd-details-btn:hover { background: #f40612; }
        .nf-sd-viewall { display: flex; align-items: center; justify-content: space-between; padding: 9px 16px; border-top: 1px solid var(--sr-border); background: var(--sr-hover); }
        .nf-sd-viewall-text { font-size: 11px; color: var(--sr-text-sub); }
        .nf-sd-viewall-btn  { font-size: 11px; font-weight: 700; color: var(--sr-accent); background: none; border: none; cursor: pointer; font-family: inherit; }
        .nf-sd-empty   { padding: 20px 16px; text-align: center; font-size: 12px; color: var(--sr-text-sub); line-height: 1.6; }
        .nf-sd-loading { padding: 18px; text-align: center; font-size: 12px; color: var(--sr-text-sub); }
        .nf-spacer { flex: 1; }
        .nf-theme-dots { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .nf-dot { width: 18px; height: 18px; border-radius: 50%; cursor: pointer; transition: transform 0.2s, border-color 0.2s; border: 2px solid transparent; flex-shrink: 0; outline: none; }
        .nf-dot:hover { transform: scale(1.15); }
        .nf-bell-wrap { position: relative; flex-shrink: 0; }
        .nf-bell { width: 36px; height: 36px; border-radius: 4px; background: var(--sr-nav-input-bg); border: 1px solid var(--sr-nav-input-border); color: var(--sr-nav-text-sub); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
        .nf-bell:hover { color: var(--sr-nav-text, #fff); }
        .nf-badge { position: absolute; top: -5px; right: -5px; background: var(--sr-accent); color: #fff; font-size: 9px; font-weight: 800; border-radius: 100px; min-width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid var(--sr-nav-bg, #141414); }
        .nf-drop { position: absolute; top: 44px; right: 0; width: 340px; background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); z-index: 1001; overflow: hidden; }
        .nf-drop-header { padding: 14px 16px; border-bottom: 1px solid var(--sr-border); display: flex; justify-content: space-between; align-items: center; }
        .nf-drop-title { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); }
        .nf-drop-count { font-size: 10px; color: var(--sr-text-sub); }
        .nf-drop-list  { max-height: 340px; overflow-y: auto; }

        /* ── User booking notification card ── */
        .nf-user-notif { padding: 12px 16px; border-bottom: 1px solid var(--sr-border); cursor: pointer; transition: background 0.15s; display: flex; flex-direction: column; gap: 6px; }
        .nf-user-notif:hover { background: var(--sr-hover); }
        .nf-user-notif-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .nf-user-notif-title { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); line-height: 1.3; }
        .nf-user-notif-time { font-size: 10px; color: var(--sr-text-muted); white-space: nowrap; flex-shrink: 0; }
        .nf-user-notif-msg { font-size: 11px; color: var(--sr-text-sub); line-height: 1.4; }
        .nf-user-notif-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 800; padding: 3px 10px; border-radius: 100px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px; align-self: flex-start; }

        .nf-drop-item  { padding: 12px 16px; border-bottom: 1px solid var(--sr-border); cursor: pointer; transition: background 0.15s; display: flex; flex-direction: column; gap: 3px; }
        .nf-drop-item:hover { background: var(--sr-hover); }
        .nf-drop-item-top { display: flex; justify-content: space-between; align-items: center; }
        .nf-drop-amb    { font-size: 12px; font-weight: 700; color: var(--sr-text, #fff); }
        .nf-drop-time   { font-size: 10px; color: var(--sr-text-muted); }
        .nf-drop-loc    { font-size: 11px; color: var(--sr-text-sub); }
        .nf-drop-user   { font-size: 10px; color: #00d4aa; }
        .nf-drop-status { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 100px; background: rgba(229,9,20,0.15); color: #ff4d5a; border: 1px solid rgba(229,9,20,0.3); align-self: flex-start; text-transform: uppercase; letter-spacing: 0.5px; }
        .nf-drop-status-confirmed { background: rgba(0,212,170,0.15); color: #00d4aa; border-color: rgba(0,212,170,0.3); }
        .nf-drop-empty  { padding: 32px 24px; text-align: center; font-size: 12px; color: var(--sr-text-sub); }
        .nf-drop-empty-icon { font-size: 32px; margin-bottom: 8px; }
        .nf-drop-footer { padding: 10px 16px; border-top: 1px solid var(--sr-border); text-align: center; }
        .nf-drop-footer-btn { font-size: 11px; font-weight: 600; color: var(--sr-accent); background: none; border: none; cursor: pointer; font-family: inherit; }
        .nf-drop-footer-btn:hover { text-decoration: underline; }
        .nf-user { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .nf-username { font-size: 13px; font-weight: 500; color: var(--sr-nav-text-sub, rgba(255,255,255,0.5)); white-space: nowrap; }
        .nf-admin-badge { font-size: 9px; font-weight: 800; background: rgba(229,9,20,0.15); color: var(--sr-accent); border: 1px solid rgba(229,9,20,0.3); border-radius: 4px; padding: 2px 7px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
        .nf-avatar-wrap { position: relative; flex-shrink: 0; cursor: pointer; }
        .nf-avatar { width: 34px; height: 34px; border-radius: 50%; background: #2a2a2a; border: 2px solid var(--sr-accent); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; }
        .nf-avatar-wrap:hover .nf-avatar { box-shadow: 0 0 0 3px rgba(229,9,20,0.25); }
        .nf-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .nf-avatar-overlay { position: absolute; inset: 0; border-radius: 50%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
        .nf-avatar-wrap:hover .nf-avatar-overlay { opacity: 1; }
        .nf-profile-drop { position: absolute; top: 42px; right: 0; min-width: 200px; background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,0.5); z-index: 1001; overflow: hidden; padding: 6px 0; }
        .nf-profile-head { padding: 12px 14px 10px; border-bottom: 1px solid var(--sr-border); margin-bottom: 4px; }
        .nf-profile-email { font-size: 10px; color: var(--sr-text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
        .nf-profile-name { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); }
        .nf-profile-role { font-size: 10px; font-weight: 600; color: var(--sr-accent); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .nf-profile-dp-preview { width: 48px; height: 48px; border-radius: 50%; background: #2a2a2a; border: 2px solid var(--sr-accent); overflow: hidden; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #fff; }
        .nf-profile-dp-preview img { width: 100%; height: 100%; object-fit: cover; }
        .nf-profile-item { display: flex; align-items: center; gap: 9px; padding: 8px 14px; font-size: 12px; font-weight: 500; color: var(--sr-text-sub); cursor: pointer; transition: background 0.15s, color 0.15s; }
        .nf-profile-item:hover { background: var(--sr-hover); color: var(--sr-text, #fff); }
        .nf-profile-item.danger { color: #ff4d5a; }
        .nf-profile-item.danger:hover { background: rgba(229,9,20,0.1); }
        .nf-login-link { font-size: 13px; font-weight: 600; color: var(--sr-nav-text-sub); text-decoration: none; white-space: nowrap; }
        .nf-login-link:hover { color: var(--sr-nav-text, #fff); }

        @media (max-width: 1023px) {
          .nf-nav-root { padding: 0 16px 0 80px; gap: 10px; }
          .nf-search-inner { width: 220px; }
          .nf-username { display: none; }
          .nf-admin-badge { display: none; }
          .nf-theme-dots { gap: 6px; }
          .nf-dot { width: 15px; height: 15px; }
        }

        @media (max-width: 767px) {
          .nf-nav-root { padding: 0 10px; gap: 6px; }
          .nf-brand { font-size: 14px; letter-spacing: 1px; }
          .nf-search-wrap { display: none; }
          .nf-mobile-search-btn { display: flex; }
          .nf-username { display: block; font-size: 11px; max-width: 55px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .nf-admin-badge { display: none; }
          .nf-theme-dots { display: flex; gap: 4px; }
          .nf-dot { width: 12px; height: 12px; }
          .nf-drop { width: calc(100vw - 24px); right: -40px; }
          .nf-bell { width: 32px; height: 32px; }
          .nf-mobile-search-btn { width: 32px; height: 32px; }
        }

        @media (max-width: 480px) {
          .nf-brand { font-size: 12px; letter-spacing: 0.5px; }
          .nf-username { display: block; font-size: 10px; max-width: 45px; }
          .nf-theme-dots { display: flex; gap: 3px; }
          .nf-dot { width: 10px; height: 10px; }
          .nf-nav-root { gap: 4px; padding: 0 8px; }
          .nf-bell { width: 30px; height: 30px; }
          .nf-mobile-search-btn { width: 30px; height: 30px; }
          .nf-avatar { width: 30px; height: 30px; font-size: 12px; }
        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleProfilePicChange} />

      <div className="nf-nav-root">
        <span className="nf-brand">SwiftRescue</span>

        {/* Desktop Search */}
        <div className="nf-search-wrap" ref={searchRef}>
          <div className="nf-search-inner">
            <div className="nf-search-icon">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--sr-nav-text-muted,rgba(255,255,255,0.25))" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <input className="nf-search-input" value={search} onChange={handleSearchChange} onKeyDown={handleKeyDown} placeholder="Search ambulances, hospitals..." />
            <button className="nf-search-btn" onClick={doSearch}>Search</button>
          </div>
          {showSearchDrop && <SearchDropdown />}
        </div>

        <button className="nf-mobile-search-btn" onClick={() => setShowMobileSearch(s => !s)}>
          {showMobileSearch ? <X size={15}/> : <Search size={15}/>}
        </button>

        <div className="nf-spacer" />

        <div className="nf-theme-dots">
          {Object.entries(themes).map(([key, t]) => (
            <button key={key} className="nf-dot" title={key} onClick={() => setTheme(key)}
              style={{ background: t.dot, borderColor: theme===key ? '#E50914' : t.dotBorder, transform: theme===key ? 'scale(1.3)' : 'scale(1)' }} />
          ))}
        </div>

        <div className="nf-bell-wrap" ref={dropRef}>
          <button className="nf-bell" onClick={openNotifs}><Bell size={15}/></button>
          {unread > 0 && <span className="nf-badge">{unread > 9 ? "9+" : unread}</span>}
          {showDrop && (
            <div className="nf-drop">
              <div className="nf-drop-header">
                <span className="nf-drop-title">
                  {role === "driver" ? "🔔 Meri Notifications"
                   : role === "admin" ? "🔔 Notifications"
                   : "🔔 Meri Bookings"}
                </span>
                <span className="nf-drop-count">{notifications.length} items</span>
              </div>
              <div className="nf-drop-list">
                {notifications.length === 0 ? (
                  <div className="nf-drop-empty">
                    <div className="nf-drop-empty-icon">🔔</div>
                    {role === "admin" || role === "driver" ? "Koi notification nahi" : "Abhi koi booking nahi"}
                  </div>
                ) : role !== "admin" && role !== "driver" ? (
                  // ── USER: Booking status cards ──
                  notifications.map((n, i) => {
                    const ss = getStatusStyle(n.status);
                    return (
                      <div key={i} className="nf-user-notif" onClick={() => handleNotifClick(n)}>
                        <div className="nf-user-notif-top">
                          <div className="nf-user-notif-title">{n.title}</div>
                          <div className="nf-user-notif-time">
                            {n.timestamp ? new Date(n.timestamp).toLocaleString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : ""}
                          </div>
                        </div>
                        <div className="nf-user-notif-msg">{n.message}</div>
                        <span className="nf-user-notif-badge" style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}>
                          {n.status === "confirmed"  ? "✅ Confirmed"
                           : n.status === "cancelled" || n.status === "rejected" ? "❌ Rejected"
                           : n.status === "completed" ? "🏁 Completed"
                           : "⏳ Pending"}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  // ── ADMIN / DRIVER: original cards ──
                  notifications.map((n, i) => (
                    <div key={i} className="nf-drop-item" onClick={() => handleNotifClick(n)}>
                      <div className="nf-drop-item-top">
                        <span className="nf-drop-amb">
                          {role === "driver"
                            ? (n.title || `🚑 ${n.ambulance_number || "Notification"}`)
                            : `🚑 ${n.ambulance_number}`}
                        </span>
                        <span className="nf-drop-time">{n.created_at || (n.timestamp ? new Date(n.timestamp).toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) : "")}</span>
                      </div>
                      {role === "driver"
                        ? <div className="nf-drop-loc">{n.message || n.pickup_location}</div>
                        : <>
                            <div className="nf-drop-loc">📍 {n.pickup_location}</div>
                            <div className="nf-drop-user">👤 {n.booked_by}</div>
                          </>
                      }
                      <span className={`nf-drop-status ${n.status==="confirmed"?"nf-drop-status-confirmed":""}`}>
                        {n.status || n.type}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="nf-drop-footer">
                <button className="nf-drop-footer-btn"
                  onClick={() => { setShowDrop(false); navigate(role==="driver" ? "/" : role==="admin" ? "/Requests" : "/Ambulances"); }}>
                  {role === "driver" ? "Dashboard pe dekho →"
                   : role === "admin" ? "View All Bookings →"
                   : "Ambulance Book Karo →"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="nf-user">
          {user ? (
            <>
              <span className="nf-username">{user}</span>
              {role === "admin" && <span className="nf-admin-badge">Admin</span>}
              <div className="nf-avatar-wrap" ref={profileRef} onClick={() => setShowProfileMenu(m => !m)}>
                <div className="nf-avatar">
                  {profilePic ? <img src={profilePic} alt="profile"/> : <span>{user[0]?.toUpperCase()}</span>}
                </div>
                <div className="nf-avatar-overlay"><Camera size={12} color="#fff"/></div>
                {showProfileMenu && (
                  <div className="nf-profile-drop" onClick={e => e.stopPropagation()}>
                    <div className="nf-profile-head" style={{ textAlign:"center" }}>
                      <div className="nf-profile-dp-preview">
                        {profilePic ? <img src={profilePic} alt="dp"/> : <span>{user[0]?.toUpperCase()}</span>}
                      </div>
                      <div className="nf-profile-name">{user}</div>
                      <div className="nf-profile-email">{email}</div>
                      {role && <div className="nf-profile-role">{role}</div>}
                    </div>
                    <div className="nf-profile-item" onClick={() => fileInputRef.current?.click()}>
                      <Camera size={13}/>{profilePic ? "Change Photo" : "Upload Photo"}
                    </div>
                    {profilePic && (
                      <div className="nf-profile-item danger" onClick={removeProfilePic}>
                        <X size={13}/>Remove Photo
                      </div>
                    )}
                    <div className="nf-profile-item danger" onClick={logoutUser}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Logout
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="nf-avatar"><span>U</span></div>
              <Link to="/login" className="nf-login-link">Login</Link>
            </>
          )}
        </div>
      </div>

      <div className={`nf-mobile-search-overlay ${showMobileSearch ? 'open' : ''}`}>
        <div className="nf-search-inner" style={{flex:1}}>
          <div className="nf-search-icon">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--sr-nav-text-muted,rgba(255,255,255,0.25))" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input className="nf-search-input" value={search} onChange={handleSearchChange} onKeyDown={handleKeyDown} placeholder="Search..." autoFocus/>
          <button className="nf-search-btn" onClick={doSearch}>Go</button>
        </div>
        {showSearchDrop && totalResults > 0 && (
          <div className="nf-mobile-search-drop"><SearchDropdown/></div>
        )}
      </div>
    </>
  );
};

export default Topnavbar;
import { useState, useEffect, useRef, useCallback } from "react";
import useLeaflet, { DARK_TILE, DELHI, makePinIcon } from "../hooks/useLeaflet";

const BASE          = "http://127.0.0.1:8000";
const POLL_INTERVAL = 5000; // 5 seconds

// Haversine distance (km)
const haversine = (lat1, lng1, lat2, lng2) => {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dN = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// ETA string from distance
const etaString = (km) => {
  if (km < 0.1) return "Almost here!";
  const mins = Math.round(km / 0.4); // ~24 km/h average city speed
  if (mins <= 1) return "~1 min";
  return `~${mins} mins`;
};

// Geocode address using Nominatim
const geocode = async (addr) => {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr + ", Delhi, India")}&format=json&limit=1`,
    { headers: { "Accept-Language": "en" } }
  );
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
};

export default function UserBookingMap({ booking, onClose }) {
  const leafletReady   = useLeaflet();
  const mapDivRef      = useRef(null);
  const mapObj         = useRef(null);
  const driverMarker   = useRef(null);
  const userMarker     = useRef(null);
  const routeControl   = useRef(null);
  const firstPan       = useRef(true);

  const [driverLoc,    setDriverLoc]    = useState(null);
  const [userLoc,      setUserLoc]      = useState(null);
  const [eta,          setEta]          = useState(null);
  const [distance,     setDistance]     = useState(null);
  const [driverName,   setDriverName]   = useState("Driver");
  const [ambulanceNum, setAmbulanceNum] = useState("");
  const [status,       setStatus]       = useState(booking?.status || "confirmed");
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const [arrived,      setArrived]      = useState(false);
  const [timerSecs,    setTimerSecs]    = useState(0);
  const timerRef       = useRef(null);
  const startTimeRef   = useRef(Date.now());

  // ── Timer ──
  useEffect(() => {
    if (arrived) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimerSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [arrived]);

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  // ── Geocode user's pickup location ──
  useEffect(() => {
    if (!booking?.pickup_location) return;
    geocode(booking.pickup_location).then(loc => {
      if (loc) setUserLoc(loc);
    }).catch(() => {});
  }, [booking?.pickup_location]);

  // ── Poll driver location ──
  const fetchDriverLocation = useCallback(async () => {
    if (!booking?.ambulance_id) return;

    // Helper: location mil gayi to state update karo
    const applyLocation = (lat, lng, name, ambNum) => {
      const loc = { lat: parseFloat(lat), lng: parseFloat(lng) };
      setDriverLoc(loc);
      setDriverName(name || "Driver");
      setAmbulanceNum(ambNum || booking.ambulance_number || "");
      setLastUpdate(new Date());
      if (userLoc) {
        const dist = haversine(loc.lat, loc.lng, userLoc.lat, userLoc.lng);
        setDistance(dist);
        setEta(etaString(dist));
        if (dist < 0.1) setArrived(true);
      }
    };

    // ── Step 1: Dedicated driver/location API try karo ──
    try {
      const res  = await fetch(`${BASE}/api/driver/location/?ambulance_id=${booking.ambulance_id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          applyLocation(data.latitude, data.longitude, data.driver_name || data.driver, data.ambulance_number);
          return; // mil gayi, aage mat jao
        }
      }
    } catch {}

    // ── Step 2: Fallback — ambulances list se latitude/longitude lo ──
    try {
      const res  = await fetch(`${BASE}/api/ambulances/`);
      const list = await res.json();
      const amb  = list.find(a => a.id === booking.ambulance_id || String(a.id) === String(booking.ambulance_id));
      if (amb && amb.latitude && amb.longitude) {
        applyLocation(amb.latitude, amb.longitude, amb.driver, amb.ambulance_number);
        return;
      }
    } catch {}

    // ── Step 3: Booking status check karo ──
    try {
      const res  = await fetch(`${BASE}/api/bookings/${booking.id}/`);
      const data = await res.json();
      setStatus(data.status);
      if (data.status === "completed") setArrived(true);
    } catch {}
  }, [booking?.ambulance_id, booking?.id, userLoc]);

  useEffect(() => {
    fetchDriverLocation();
    const t = setInterval(fetchDriverLocation, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchDriverLocation]);

  // ── Init Map ──
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    const center = userLoc || DELHI;
    mapObj.current = L.map(mapDivRef.current, {
      center: [center.lat, center.lng], zoom: 15,
      minZoom: 10, maxZoom: 19, zoomControl: false,
    });
    L.tileLayer(DARK_TILE, { maxZoom: 19, attribution: "© CartoDB" }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    firstPan.current = true;
    return () => { if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [leafletReady]);

  // ── Update user marker ──
  useEffect(() => {
    if (!leafletReady || !mapObj.current || !userLoc || !window.L) return;
    const L = window.L;
    if (userMarker.current) {
      userMarker.current.setLatLng([userLoc.lat, userLoc.lng]);
    } else {
      const icon = makePinIcon("#00d4aa", "📍");
      if (icon) {
        userMarker.current = L.marker([userLoc.lat, userLoc.lng], { icon })
          .addTo(mapObj.current)
          .bindPopup(
            `<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700;font-size:12px">
              📍 Aapka Pickup Point<br/>
              <span style="color:#00d4aa;font-size:10px">${booking?.pickup_location || ""}</span>
            </div>`,
            { className: "sr-dark-popup" }
          );
      }
      if (firstPan.current) {
        mapObj.current.setView([userLoc.lat, userLoc.lng], 15);
        firstPan.current = false;
      }
    }
  }, [leafletReady, userLoc]);

  // ── Update driver marker + route ──
  useEffect(() => {
    if (!leafletReady || !mapObj.current || !driverLoc || !window.L) return;
    const L = window.L;

    // Driver marker
    if (driverMarker.current) {
      driverMarker.current.setLatLng([driverLoc.lat, driverLoc.lng]);
    } else {
      const icon = makePinIcon("#E50914", "🚑");
      if (icon) {
        driverMarker.current = L.marker([driverLoc.lat, driverLoc.lng], { icon })
          .addTo(mapObj.current)
          .bindPopup(
            `<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700;font-size:12px">
              🚑 ${ambulanceNum}<br/>
              <span style="color:#E50914;font-size:10px">Driver: ${driverName}</span>
            </div>`,
            { className: "sr-dark-popup" }
          );
      }
    }

    // Pan to fit both markers
    if (userLoc) {
      try {
        const bounds = L.latLngBounds(
          [driverLoc.lat, driverLoc.lng],
          [userLoc.lat, userLoc.lng]
        );
        mapObj.current.fitBounds(bounds, { padding: [60, 60] });
      } catch {}

      // Draw/update route line
      if (window.L.Routing) {
        if (routeControl.current) {
          try { mapObj.current.removeControl(routeControl.current); } catch {}
          routeControl.current = null;
        }
        try {
          routeControl.current = L.Routing.control({
            waypoints: [
              L.latLng(driverLoc.lat, driverLoc.lng),
              L.latLng(userLoc.lat, userLoc.lng),
            ],
            router: L.Routing.osrmv1({
              serviceUrl: "https://router.project-osrm.org/route/v1",
              profile: "driving",
            }),
            lineOptions: {
              styles: [
                { color: "#E50914", weight: 4, opacity: 0.85 },
                { color: "#fff", weight: 1, opacity: 0.1 },
              ],
              extendToWaypoints: true, missingRouteTolerance: 0,
            },
            show: false, addWaypoints: false, draggableWaypoints: false,
            fitSelectedRoutes: false, showAlternatives: false,
            createMarker: () => false,
          }).addTo(mapObj.current);

          routeControl.current.on("routesfound", (e) => {
            const s    = e.routes[0].summary;
            const km   = (s.totalDistance / 1000).toFixed(1);
            const mins = Math.round(s.totalTime / 60);
            setDistance(parseFloat(km));
            setEta(`~${mins} min`);
          });
        } catch {}
      }
    }
  }, [leafletReady, driverLoc, userLoc, driverName, ambulanceNum]);

  if (!booking) return null;

  return (
    <>
      <style>{`
        .ubm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.85);
          z-index: 9999; display: flex; align-items: flex-end;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        @media (min-width: 768px) {
          .ubm-overlay { align-items: center; justify-content: center; }
          .ubm-sheet { width: 540px !important; border-radius: 16px !important; max-height: 90vh; }
        }
        .ubm-sheet {
          width: 100%; background: #111;
          border-radius: 20px 20px 0 0;
          overflow: hidden; display: flex; flex-direction: column;
          max-height: 92vh;
        }

        /* ── Top bar ── */
        .ubm-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px 12px; background: #111;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .ubm-topbar-left { display: flex; flex-direction: column; gap: 2px; }
        .ubm-topbar-title { font-size: 14px; font-weight: 800; color: #fff; }
        .ubm-topbar-sub { font-size: 11px; color: rgba(255,255,255,0.4); }
        .ubm-close {
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255,255,255,0.07); border: none;
          color: rgba(255,255,255,0.5); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; transition: background 0.15s;
        }
        .ubm-close:hover { background: rgba(255,255,255,0.12); }

        /* ── ETA banner ── */
        .ubm-eta-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px; background: #0f0f0f;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0; gap: 8px; flex-wrap: wrap;
        }
        .ubm-eta-item { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; min-width: 70px; }
        .ubm-eta-val { font-size: 18px; font-weight: 900; color: #fff; line-height: 1; }
        .ubm-eta-lbl { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.6px; }
        .ubm-eta-divider { width: 1px; height: 32px; background: rgba(255,255,255,0.08); flex-shrink: 0; }

        /* ETA color */
        .ubm-eta-arrived { color: #00d4aa !important; }
        .ubm-eta-close   { color: #f7c948 !important; }
        .ubm-eta-normal  { color: #E50914 !important; }

        /* ── Timer ── */
        .ubm-timer {
          font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums;
          color: #fff; font-family: 'Courier New', monospace;
        }
        .ubm-timer.arrived { color: #00d4aa; }

        /* ── Driver info strip ── */
        .ubm-driver-strip {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px; background: rgba(229,9,20,0.06);
          border-bottom: 1px solid rgba(229,9,20,0.15);
          flex-shrink: 0;
        }
        .ubm-driver-icon { font-size: 22px; }
        .ubm-driver-name { font-size: 13px; font-weight: 700; color: #fff; }
        .ubm-driver-amb  { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 1px; }
        .ubm-driver-status {
          margin-left: auto; font-size: 10px; font-weight: 700;
          padding: 3px 10px; border-radius: 20px;
          background: rgba(229,9,20,0.15); color: #E50914;
          border: 1px solid rgba(229,9,20,0.3);
        }
        .ubm-driver-status.arrived {
          background: rgba(0,212,170,0.15); color: #00d4aa;
          border-color: rgba(0,212,170,0.3);
        }
        .ubm-last-update { font-size: 9px; color: rgba(255,255,255,0.2); margin-left: auto; }

        /* ── Map ── */
        .ubm-map-wrap { flex: 1; position: relative; min-height: 280px; }
        .ubm-map-inner { position: absolute; inset: 0; }

        /* ── No driver overlay ── */
        .ubm-waiting {
          position: absolute; inset: 0;
          background: rgba(10,10,10,0.88);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 2; gap: 8px;
        }
        .ubm-waiting-icon { font-size: 48px; animation: ubm-pulse 2s infinite; }
        @keyframes ubm-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.95)} }
        .ubm-waiting-text { font-size: 14px; color: rgba(255,255,255,0.5); text-align: center; padding: 0 24px; }
        .ubm-waiting-sub  { font-size: 11px; color: rgba(255,255,255,0.25); text-align: center; }

        /* ── Arrived banner ── */
        .ubm-arrived-banner {
          position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
          background: rgba(0,212,170,0.95); color: #000;
          font-size: 13px; font-weight: 800;
          padding: 8px 20px; border-radius: 100px;
          z-index: 10; white-space: nowrap;
          animation: ubm-bounce 0.4s ease;
        }
        @keyframes ubm-bounce { 0%{transform:translateX(-50%) scale(0.8)}100%{transform:translateX(-50%) scale(1)} }

        /* Leaflet overrides */
        .sr-dark-popup .leaflet-popup-content-wrapper { background: rgba(20,20,20,0.97)!important; border: 1px solid rgba(255,255,255,0.1)!important; border-radius: 10px!important; padding:0!important; }
        .sr-dark-popup .leaflet-popup-content { margin: 0!important; }
        .sr-dark-popup .leaflet-popup-tip { background: rgba(20,20,20,0.97)!important; }
        .leaflet-routing-container { display: none!important; }
        .leaflet-control-zoom a { background: rgba(20,20,20,0.92)!important; color: #fff!important; border-color: rgba(255,255,255,0.1)!important; }

        /* ── Bottom info ── */
        .ubm-bottom {
          padding: 12px 16px 16px; background: #111;
          border-top: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
        }
        .ubm-pickup-row { display: flex; align-items: flex-start; gap: 8px; }
        .ubm-pickup-dot { width: 8px; height: 8px; border-radius: 50%; background: #00d4aa; flex-shrink: 0; margin-top: 4px; }
        .ubm-pickup-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.5px; }
        .ubm-pickup-addr  { font-size: 12px; color: #fff; margin-top: 2px; }
      `}</style>

      <div className="ubm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div className="ubm-sheet">

          {/* ── Top bar ── */}
          <div className="ubm-topbar">
            <div className="ubm-topbar-left">
              <div className="ubm-topbar-title">🚑 Live Ambulance Tracking</div>
              <div className="ubm-topbar-sub">Booking #{booking.id} · {booking.ambulance_number || ambulanceNum || "—"}</div>
            </div>
            <button className="ubm-close" onClick={onClose}>✕</button>
          </div>

          {/* ── ETA + Timer bar ── */}
          <div className="ubm-eta-bar">
            <div className="ubm-eta-item">
              <div className={`ubm-eta-val ${arrived ? "ubm-eta-arrived" : distance && distance < 0.5 ? "ubm-eta-close" : "ubm-eta-normal"}`}>
                {arrived ? "🎉" : eta || "—"}
              </div>
              <div className="ubm-eta-lbl">{arrived ? "Ambulance Pahunch Gayi!" : "ETA"}</div>
            </div>
            <div className="ubm-eta-divider" />
            <div className="ubm-eta-item">
              <div className="ubm-eta-val" style={{ color: "rgba(255,255,255,0.6)" }}>
                {distance != null ? `${distance.toFixed(1)} km` : "—"}
              </div>
              <div className="ubm-eta-lbl">Distance</div>
            </div>
            <div className="ubm-eta-divider" />
            <div className="ubm-eta-item">
              <div className={`ubm-timer ${arrived ? "arrived" : ""}`}>{formatTimer(timerSecs)}</div>
              <div className="ubm-eta-lbl">{arrived ? "Total Time" : "Elapsed"}</div>
            </div>
          </div>

          {/* ── Driver info ── */}
          <div className="ubm-driver-strip">
            <div className="ubm-driver-icon">🚑</div>
            <div>
              <div className="ubm-driver-name">{driverName}</div>
              <div className="ubm-driver-amb">{ambulanceNum || booking.ambulance_number || "—"}</div>
            </div>
            {lastUpdate && (
              <div className="ubm-last-update">
                Updated {lastUpdate.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", second:"2-digit" })}
              </div>
            )}
            <div className={`ubm-driver-status ${arrived ? "arrived" : ""}`}>
              {arrived ? "✅ Arrived" : driverLoc ? "🔴 En Route" : "⏳ Locating..."}
            </div>
          </div>

          {/* ── Map ── */}
          <div className="ubm-map-wrap">
            <div ref={mapDivRef} className="ubm-map-inner" />

            {/* Waiting overlay — jab driver location nahi mili abhi */}
            {!driverLoc && !arrived && (
              <div className="ubm-waiting">
                <div className="ubm-waiting-icon">🚑</div>
                <div className="ubm-waiting-text">Driver ka live location aa raha hai...</div>
                <div className="ubm-waiting-sub">Har 5 seconds mein update hoga</div>
              </div>
            )}

            {/* Arrived banner */}
            {arrived && (
              <div className="ubm-arrived-banner">✅ Ambulance Pahunch Gayi!</div>
            )}
          </div>

          {/* ── Bottom pickup info ── */}
          <div className="ubm-bottom">
            <div className="ubm-pickup-row">
              <div className="ubm-pickup-dot" />
              <div>
                <div className="ubm-pickup-label">Pickup Location</div>
                <div className="ubm-pickup-addr">{booking.pickup_location || "—"}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
/**
 * UserLiveTracking.jsx
 * Sirf background polling — koi floating card/UI nahi.
 * Confirmed booking MyBookings page ke card mein dikhti hai.
 */
import { useEffect } from "react";

const BASE = "http://127.0.0.1:8000";

export default function UserLiveTracking() {
  const email = localStorage.getItem("user") || "";
  const name  = localStorage.getItem("name") || "";
  const role  = localStorage.getItem("role");

  useEffect(() => {
    if (role === "admin" || role === "driver") return;

    const poll = async () => {
      try {
        const res  = await fetch(`${BASE}/api/bookings/`);
        const data = await res.json();
        const confirmed = data.find(b =>
          (b.booked_by_email === email || b.user_email === email || b.booked_by === name) &&
          b.status === "confirmed"
        );
        if (confirmed) {
          localStorage.setItem("active_confirmed_booking", JSON.stringify(confirmed));
        } else {
          localStorage.removeItem("active_confirmed_booking");
        }
      } catch {}
    };

    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [email, name, role]);

  return null;
}
import { useState, useEffect } from "react";

const statusConfig = {
  available: { label: "Available", bg: "rgba(0,212,170,0.12)",   color: "#00d4aa", border: "rgba(0,212,170,0.3)"  },
  en_route:  { label: "En Route",  bg: "rgba(247,201,72,0.12)",  color: "#f7c948", border: "rgba(247,201,72,0.3)" },
  busy:      { label: "Busy",      bg: "rgba(229,9,20,0.12)",    color: "#ff4d5a", border: "rgba(229,9,20,0.35)"  },
  offline:   { label: "Offline",   bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "rgba(255,255,255,0.12)" },
};

const statsConfig = [
  { label: "Total Fleet", key: "total",     accent: "rgba(255,255,255,0.4)" },
  { label: "Available",   key: "available", accent: "#00d4aa" },
  { label: "En Route",    key: "en_route",  accent: "#f7c948" },
  { label: "Busy",        key: "busy",      accent: "#E50914" },
];

const AMB_IMG = "https://nnccalcutta.in/wp-content/uploads/2022/04/166-1665783_2048x1536-ambulance-wallpapers-data-id-377442-high-quality-768x576.jpg";

const Ambulances = () => {
  const [ambulances,  setAmbulances]  = useState([]);
  const [showModal,   setShowModal]   = useState(false);
  const [selectedAmb, setSelectedAmb] = useState(null);
  const [form,        setForm]        = useState({ pickup_location: "", destination: "" });
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [toast,       setToast]       = useState(null);

  const isAdmin  = localStorage.getItem("role") === "admin";
  const isDriver = localStorage.getItem("role") === "driver";

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/ambulances/")
      .then(r => r.json()).then(setAmbulances).catch(console.log);
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getCount = (key) => {
    if (key === "total") return ambulances.length;
    return ambulances.filter(a => a.status === key).length;
  };

  const openBooking = (a) => {
    setSelectedAmb(a);
    setForm({ pickup_location: "", destination: "" });
    setSuccess(false);
    setShowModal(true);
  };

  const submitBooking = async () => {
    if (!form.pickup_location.trim()) return;
    setLoading(true);
    try {
      const user  = localStorage.getItem("name") || "Unknown";
      const email = localStorage.getItem("user") || "";
      const res   = await fetch("http://127.0.0.1:8000/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambulance_id: selectedAmb.id, ambulance_number: selectedAmb.ambulance_number,
          driver: selectedAmb.driver, driver_contact: selectedAmb.driver_contact,
          booked_by: user, booked_by_email: email,
          pickup_location: form.pickup_location, destination: form.destination, status: "pending",
        }),
      });
      if (res.ok) {
        setSuccess(true);
        window.dispatchEvent(new Event("new-booking"));
        showToast("✅ Booking submitted! We'll confirm shortly.", "success");
      }
    } catch { showToast("❌ Something went wrong. Try again.", "error"); }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .amb-toast {
          position: fixed; top: 68px; left: 50%;
          transform: translateX(-50%);
          z-index: 99999; padding: 12px 22px; border-radius: 10px;
          font-size: 13px; font-weight: 600;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          animation: toast-in 0.3s ease; max-width: 90vw; text-align: center;
          display: flex; align-items: center; gap: 8px;
        }
        .amb-toast.success { background: #00c853; color: #fff; }
        .amb-toast.error   { background: #e53935; color: #fff; }
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .amb-root {
          background: var(--sr-bg, #0f0f0f);
          color: var(--sr-page-text, #fff);
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          min-height: 100vh;
          padding: 56px 0 0 64px;
          transition: background 0.3s, color 0.2s;
        }

        /* Inner wrapper — matches Netflix reference: tight sides */
        .amb-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 20px 64px;
        }

        /* Header */
        .amb-header { margin-bottom: 22px; }
        .amb-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 700; color: #E50914;
          background: rgba(229,9,20,0.1); border: 1px solid rgba(229,9,20,0.25);
          border-radius: 100px; padding: 3px 12px;
          letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px;
        }
        .amb-header h1 { font-size: 24px; font-weight: 800; color: var(--sr-page-text, #fff); margin-bottom: 3px; letter-spacing: -0.4px; }
        .amb-header p  { font-size: 12px; color: var(--sr-page-text-sub); }

        /* Stats row */
        .amb-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 24px; }
        .amb-stat  {
          background: var(--sr-surface, #1a1a1a);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; padding: 14px 16px;
          position: relative; overflow: hidden;
          transition: border-color 0.2s;
        }
        .amb-stat:hover { border-color: rgba(255,255,255,0.12); }
        .amb-stat-bar   { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
        .amb-stat-label { font-size: 10px; font-weight: 600; color: var(--sr-text-sub); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 6px; }
        .amb-stat-value { font-size: 28px; font-weight: 800; color: var(--sr-text, #fff); line-height: 1; letter-spacing: -1px; }

        .amb-section-title { font-size: 15px; font-weight: 700; color: var(--sr-page-text, #fff); margin-bottom: 14px; }

        /* Card grid — exactly like Netflix: no excessive margins */
        .amb-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        /* Netflix card */
        .amb-card {
          border-radius: 10px; overflow: hidden; position: relative;
          background: #1e1e1e; cursor: pointer;
          aspect-ratio: 16/10;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .amb-card:hover { transform: scale(1.03); box-shadow: 0 20px 56px rgba(0,0,0,0.8); z-index: 2; }
        .amb-card-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: right center;
          filter: brightness(0.45) saturate(0.7);
          transition: filter 0.22s, transform 0.22s;
        }
        .amb-card:hover .amb-card-img { filter: brightness(0.6) saturate(1); transform: scale(1.04); }
        .amb-card-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to right, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.78) 40%, rgba(10,10,10,0.3) 68%, transparent 100%);
        }
        .amb-card-fade { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%); }
        .amb-card-body {
          position: absolute; inset: 0; padding: 12px 14px;
          display: flex; flex-direction: column; justify-content: space-between;
        }

        /* Top row */
        .amb-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .amb-unit-tag {
          font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
          padding: 3px 9px; border-radius: 100px;
          background: rgba(20,20,20,0.75); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.65); display: flex; align-items: center; gap: 4px;
        }
        .amb-unit-dot { width: 5px; height: 5px; border-radius: 50%; }
        .amb-status-pill {
          font-size: 8px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
          padding: 3px 9px; border-radius: 100px; border: 1px solid;
          display: flex; align-items: center; gap: 4px;
        }
        .amb-status-dot { width: 5px; height: 5px; border-radius: 50%; }

        /* Bottom */
        .amb-card-bottom { display: flex; flex-direction: column; gap: 5px; }
        .amb-genre-row   { display: flex; gap: 5px; flex-wrap: wrap; }
        .amb-genre-pill  {
          font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.6);
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.13);
          border-radius: 100px; padding: 2px 9px;
        }
        .amb-card-title { font-size: 15px; font-weight: 900; color: #fff; line-height: 1.1; letter-spacing: -0.2px; text-shadow: 0 2px 8px rgba(0,0,0,0.9); }
        .amb-card-desc  { font-size: 9px; color: rgba(255,255,255,0.4); }

        /* Actions */
        .amb-action-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .amb-btn-book {
          display: flex; align-items: center; gap: 5px;
          background: #E50914; color: #fff; border: none;
          border-radius: 100px; padding: 6px 12px; font-size: 10px; font-weight: 700;
          font-family: inherit; cursor: pointer; transition: background 0.15s;
        }
        .amb-btn-book:hover { background: #f40612; }
        .amb-btn-sec {
          display: flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.1); color: #fff;
          border: 1px solid rgba(255,255,255,0.18); border-radius: 100px;
          padding: 6px 12px; font-size: 10px; font-weight: 600;
          font-family: inherit; cursor: pointer; transition: background 0.15s;
        }
        .amb-btn-sec:hover { background: rgba(255,255,255,0.18); }
        .amb-btn-copy {
          background: rgba(0,212,170,0.1); color: #00d4aa;
          border: 1px solid rgba(0,212,170,0.28); border-radius: 100px;
          padding: 6px 12px; font-size: 10px; font-weight: 600;
          font-family: inherit; cursor: pointer; transition: background 0.15s;
        }
        .amb-btn-copy:hover { background: rgba(0,212,170,0.2); }

        /* Stat bar inside card */
        .amb-card-stats {
          display: flex; gap: 12px; padding-top: 5px;
          border-top: 0.5px solid rgba(255,255,255,0.08);
        }
        .amb-cs-val { font-size: 10px; font-weight: 800; color: #fff; }
        .amb-cs-lbl { font-size: 8px; font-weight: 600; color: rgba(255,255,255,0.25); letter-spacing: 0.5px; text-transform: uppercase; }

        /* Location badge */
        .amb-card-loc {
          position: absolute; bottom: 10px; right: 10px;
          display: flex; align-items: center; gap: 3px; max-width: 110px;
        }
        .amb-card-loc-text { font-size: 9px; color: rgba(255,255,255,0.28); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Modal */
        .amb-modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.88); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .amb-modal-box {
          background: var(--sr-modal-bg, #1a1a1a);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 24px; width: 100%; max-width: 440px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .amb-modal-title    { font-size: 18px; font-weight: 800; color: var(--sr-text, #fff); }
        .amb-modal-subtitle { font-size: 12px; color: var(--sr-text-sub); margin-top: 2px; }
        .amb-modal-amb {
          background: var(--sr-input-bg);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 12px 14px;
        }
        .amb-modal-amb-name   { font-size: 15px; font-weight: 800; color: var(--sr-text, #fff); }
        .amb-modal-amb-driver { font-size: 11px; color: var(--sr-text-sub); margin-top: 2px; }
        .amb-modal-label { font-size: 10px; font-weight: 700; color: var(--sr-text-sub); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 5px; }
        .amb-modal-input {
          width: 100%; background: var(--sr-input-bg);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 11px 12px;
          color: var(--sr-text, #fff); font-size: 13px; font-family: inherit;
          outline: none; transition: border-color 0.2s;
        }
        .amb-modal-input:focus { border-color: rgba(229,9,20,0.45); }
        .amb-modal-input::placeholder { color: var(--sr-placeholder); }
        .amb-modal-actions { display: flex; gap: 8px; }
        .amb-modal-btn-confirm {
          flex: 1; background: #E50914; color: #fff; border: none;
          border-radius: 100px; padding: 11px; font-size: 13px; font-weight: 700;
          font-family: inherit; cursor: pointer; transition: background 0.15s;
        }
        .amb-modal-btn-confirm:hover:not(:disabled) { background: #f40612; }
        .amb-modal-btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
        .amb-modal-btn-cancel {
          flex: 1; background: transparent; color: var(--sr-text-sub);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 100px; padding: 11px; font-size: 13px; font-weight: 600;
          font-family: inherit; cursor: pointer;
        }
        .amb-modal-success { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 0; text-align: center; }

        /* Responsive */
        @media (max-width: 1023px) {
          .amb-grid  { grid-template-columns: repeat(2,1fr); }
          .amb-stats { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 767px) {
          .amb-root { padding-left: 0; padding-bottom: 72px; }
          .amb-inner { padding: 16px 12px 80px; }
          .amb-grid  { grid-template-columns: 1fr; }
          .amb-stats { grid-template-columns: repeat(2,1fr); gap: 8px; }
          .amb-header h1 { font-size: 20px; }
        }
      `}</style>

      {toast && <div className={`amb-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="amb-root">
        <div className="amb-inner">

          {/* Header */}
          <div className="amb-header">
            <div className="amb-tag">🚨 Live Fleet</div>
            <h1>Ambulance Service</h1>
            <p>Life doesn't wait — neither do we</p>
          </div>

          {/* Stats */}
          <div className="amb-stats">
            {statsConfig.map(s => (
              <div key={s.key} className="amb-stat">
                <div className="amb-stat-bar" style={{ background: s.accent }} />
                <div className="amb-stat-label">{s.label}</div>
                <div className="amb-stat-value">{String(getCount(s.key)).padStart(2, "0")}</div>
              </div>
            ))}
          </div>

          <div className="amb-section-title">Fleet Overview</div>

          {/* Cards */}
          <div className="amb-grid">
            {ambulances.map((a, i) => {
              const norm = a.status?.toLowerCase().replace(/[\s-]+/g, "_");
              const sc   = statusConfig[norm] || statusConfig.offline;
              return (
                <div key={i} className="amb-card">
                  <img className="amb-card-img" src={AMB_IMG} alt="ambulance" />
                  <div className="amb-card-overlay" />
                  <div className="amb-card-fade" />
                  <div className="amb-card-body">
                    <div className="amb-card-top">
                      <div className="amb-unit-tag">
                        <span className="amb-unit-dot" style={{ background: "#f7c948" }} />
                        Unit #{String(i + 1).padStart(2, "0")}
                      </div>
                      <span className="amb-status-pill" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                        <span className="amb-status-dot" style={{ background: sc.color }} />
                        {sc.label}
                      </span>
                    </div>

                    <div className="amb-card-bottom">
                      <div className="amb-genre-row">
                        <span className="amb-genre-pill">{a.model || "Ambulance"}</span>
                        <span className="amb-genre-pill">{a.speed} km/h</span>
                      </div>
                      <div className="amb-card-title">{a.ambulance_number}</div>
                      <div className="amb-card-desc">Driver: {a.driver} · {a.driver_contact}</div>

                      <div className="amb-action-row">
                        {!isDriver && (
                          <button className="amb-btn-book" onClick={() => openBooking(a)}>
                            ▶ Book
                          </button>
                        )}
                        <button className="amb-btn-sec" onClick={() => window.open(`/driver/${a.id}`, "_blank")}>
                          GPS
                        </button>
                        {isAdmin && (
                          <button className="amb-btn-copy" onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/driver/${a.id}`);
                            showToast("✅ Link copied!", "success");
                          }}>
                            Copy
                          </button>
                        )}
                      </div>

                      <div className="amb-card-stats">
                        {[
                          { label: "Nearest",  val: a.nearest_hospital },
                          { label: "ETA Hosp", val: a.eta_to_hospital  },
                          { label: "ETA Pat",  val: a.eta_to_patient   },
                        ].map((s, j) => (
                          <div key={j}>
                            <div className="amb-cs-val">{s.val || "—"}</div>
                            <div className="amb-cs-lbl">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="amb-card-loc">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="#E50914" style={{ flexShrink: 0 }}>
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span className="amb-card-loc-text">{a.location}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showModal && (
        <div className="amb-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="amb-modal-box">
            {!success ? (
              <>
                <div>
                  <div className="amb-modal-title">🚑 Book Ambulance</div>
                  <div className="amb-modal-subtitle">Fill pickup details to confirm</div>
                </div>
                <div className="amb-modal-amb">
                  <div className="amb-modal-amb-name">{selectedAmb?.ambulance_number}</div>
                  <div className="amb-modal-amb-driver">Driver: {selectedAmb?.driver} · {selectedAmb?.driver_contact}</div>
                </div>
                <div>
                  <div className="amb-modal-label">Pickup Location *</div>
                  <input className="amb-modal-input" placeholder="e.g. Connaught Place, Delhi"
                    value={form.pickup_location}
                    onChange={e => setForm(f => ({ ...f, pickup_location: e.target.value }))} />
                </div>
                <div>
                  <div className="amb-modal-label">Destination (optional)</div>
                  <input className="amb-modal-input" placeholder="e.g. AIIMS Delhi"
                    value={form.destination}
                    onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} />
                </div>
                <div className="amb-modal-actions">
                  <button className="amb-modal-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="amb-modal-btn-confirm"
                    disabled={loading || !form.pickup_location.trim()} onClick={submitBooking}>
                    {loading ? "Booking..." : "Confirm →"}
                  </button>
                </div>
              </>
            ) : (
              <div className="amb-modal-success">
                <div style={{ fontSize: 48 }}>✅</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#00d4aa" }}>Request Submitted!</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  Booking for <b style={{ color: "#fff" }}>{selectedAmb?.ambulance_number}</b> submitted.<br />You'll be notified once confirmed.
                </div>
                <button className="amb-modal-btn-confirm" style={{ marginTop: 4 }} onClick={() => setShowModal(false)}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Ambulances;import { useState, useEffect } from "react";

const statusColors = {
  pending:   { color: "#f7c948", bg: "rgba(247,201,72,0.15)",  border: "rgba(247,201,72,0.35)" },
  confirmed: { color: "#00d4aa", bg: "rgba(0,212,170,0.15)",   border: "rgba(0,212,170,0.35)" },
  completed: { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.15)" },
  cancelled: { color: "#ff4d5a", bg: "rgba(229,9,20,0.15)",    border: "rgba(229,9,20,0.4)" },
};

const BookingDetails = () => {
  const [bookings, setBookings] = useState([]);

  const fetchBookings = () => {
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(setBookings)
      .catch(console.log);
  };

  useEffect(() => { fetchBookings(); }, []);

  const updateStatus = (id, status) => {
    fetch(`http://127.0.0.1:8000/api/bookings/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(fetchBookings);
  };

  return (
    <>
      <style>{`
        .bd-root { background: #0f0f0f; color: #fff; min-height: 100vh; padding-top: 56px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .bd-content { max-width: 1100px; margin: 0 auto; padding: 40px 32px 64px; }
        .bd-header { margin-bottom: 32px; }
        .bd-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #E50914; background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.3); border-radius: 100px; padding: 4px 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .bd-header h1 { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .bd-header p { font-size: 13px; color: rgba(255,255,255,0.35); }
        .bd-table { width: 100%; border-collapse: collapse; }
        .bd-table th { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; text-transform: uppercase; padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .bd-table td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .bd-table tr:hover td { background: rgba(255,255,255,0.03); }
        .bd-amb { font-weight: 800; color: #fff; font-size: 14px; }
        .bd-driver { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .bd-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 100px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px; }
        .bd-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .bd-btn { font-size: 10px; font-weight: 700; padding: 5px 12px; border-radius: 100px; border: 1px solid; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
        .bd-btn:hover { opacity: 0.8; }
        .bd-empty { text-align: center; padding: 60px; color: rgba(255,255,255,0.2); font-size: 14px; }
      `}</style>

      <div className="bd-root">
        <div className="bd-content">
          <div className="bd-header">
            <div className="bd-tag">📋 Management</div>
            <h1>Booking Details</h1>
            <p>All ambulance booking requests and their status</p>
          </div>

          {bookings.length === 0 ? (
            <div className="bd-empty">No bookings yet</div>
          ) : (
            <table className="bd-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ambulance</th>
                  <th>Booked By</th>
                  <th>Pickup</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => {
                  const sc = statusColors[b.status] || statusColors.pending;
                  return (
                    <tr key={b.id}>
                      <td style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{String(i+1).padStart(2,"0")}</td>
                      <td>
                        <div className="bd-amb">🚑 {b.ambulance_number}</div>
                        <div className="bd-driver">Driver: {b.driver} · {b.driver_contact}</div>
                      </td>
                      <td>
                        <div>{b.booked_by}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{b.booked_by_email}</div>
                      </td>
                      <td>📍 {b.pickup_location}</td>
                      <td>{b.destination || "—"}</td>
                      <td>
                        <span className="bd-pill" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{b.created_at}</td>
                      <td>
                        <div className="bd-actions">
                          {b.status === "pending" && <>
                            <button className="bd-btn" style={{ background: "rgba(0,212,170,0.1)", color: "#00d4aa", borderColor: "rgba(0,212,170,0.3)" }} onClick={() => updateStatus(b.id, "confirmed")}>Confirm</button>
                            <button className="bd-btn" style={{ background: "rgba(229,9,20,0.1)", color: "#ff4d5a", borderColor: "rgba(229,9,20,0.3)" }} onClick={() => updateStatus(b.id, "cancelled")}>Cancel</button>
                          </>}
                          {b.status === "confirmed" && (
                            <button className="bd-btn" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.15)" }} onClick={() => updateStatus(b.id, "completed")}>Complete</button>
                          )}
                          {(b.status === "completed" || b.status === "cancelled") && (
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default BookingDetails;import Maps from "../Components/Map";
import Stats from "../Components/Stats";
import AnalyticsCharts from "../Components/AnalyticsCharts";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const statusColors = {
  pending:   "#f7c948",
  confirmed: "#00d4aa",
  completed: "rgba(255,255,255,0.35)",
  cancelled: "#ff4d5a",
};

const Dashboard = () => {
  const [bookings, setBookings] = useState([]);
  const navigate = useNavigate();

  const fetchBookings = () => {
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(res => res.json()).then(setBookings).catch(console.log);
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 10000);
    window.addEventListener("new-booking", fetchBookings);
    return () => { clearInterval(interval); window.removeEventListener("new-booking", fetchBookings); };
  }, []);

  return (
    <>
      <style>{`
        .dash-root {
          position: fixed;
          top: 56px; left: 64px; right: 0; bottom: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px;
          background: var(--sr-bg, #0f0f0f);
          transition: background 0.3s;
          box-sizing: border-box;
          overflow: hidden;
        }

        /* ── Top row: Map + Stats ── */
        .dash-top {
          display: flex;
          gap: 10px;
          flex: 55 1 0;
          min-height: 0;
        }
        .dash-map-wrap {
          flex: 1; min-width: 0; min-height: 0;
          border-radius: 14px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .dash-stats-wrap {
          width: 340px;
          flex-shrink: 0;
          border-radius: 14px;
          background: var(--sr-surface, #1a1a1a);
          border: 1px solid rgba(255,255,255,0.05);
          overflow: hidden;
          min-height: 0;
        }

        /* ── Bottom row: Analytics + Activity ── */
        .dash-bottom {
          display: flex;
          gap: 10px;
          flex: 45 1 0;
          min-height: 0;
        }
        .dash-analytics-wrap {
          flex: 1; min-width: 0; min-height: 0;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .dash-activity-wrap {
          width: 320px;
          flex-shrink: 0;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.05);
          min-height: 0;
          overflow: hidden;
        }

        /* ── Activity Feed ── */
        .dash-activity-root {
          height: 100%;
          background: var(--sr-surface, #1a1a1a);
          border-radius: 14px;
          padding: 14px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: background 0.3s;
          box-sizing: border-box;
        }
        .dash-activity-root::-webkit-scrollbar { width: 3px; }
        .dash-activity-root::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }

        .dash-act-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px; flex-shrink: 0;
        }
        .dash-act-title {
          font-size: 13px; font-weight: 700;
          color: var(--sr-text, #fff);
          display: flex; align-items: center; gap: 7px;
        }
        .dash-act-dot { width: 7px; height: 7px; border-radius: 50%; background: #E50914; }
        .dash-act-live {
          font-size: 9px; font-weight: 800; color: #E50914;
          background: rgba(229,9,20,0.1); border: 1px solid rgba(229,9,20,0.25);
          border-radius: 4px; padding: 2px 7px; letter-spacing: 0.5px;
        }
        .dash-act-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 10px; border-radius: 8px; cursor: pointer;
          transition: background 0.15s; border: 1px solid transparent;
          flex-shrink: 0;
        }
        .dash-act-item:hover {
          background: var(--sr-hover, rgba(255,255,255,0.04));
          border-color: rgba(255,255,255,0.06);
        }
        .dash-act-left  { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
        .dash-act-dot-sm { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dash-act-info  { min-width: 0; }
        .dash-act-amb   { font-size: 12px; font-weight: 700; color: var(--sr-text, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-act-sub   { font-size: 10px; color: var(--sr-text-sub); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-act-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; margin-left: 6px; }
        .dash-act-pill  {
          font-size: 8px; font-weight: 700; padding: 2px 8px;
          border-radius: 100px; text-transform: uppercase;
          letter-spacing: 0.5px; border: 1px solid; white-space: nowrap;
        }
        .dash-act-btn {
          background: #E50914; color: #fff; border: none; border-radius: 6px;
          padding: 3px 9px; font-size: 9px; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: background 0.15s; white-space: nowrap;
        }
        .dash-act-btn:hover { background: #f40612; }
        .dash-act-empty {
          color: var(--sr-text-muted); font-size: 12px; text-align: center;
          padding: 24px 0;
        }

        /* ── Mobile ── */
        @media (max-width: 1279px) {
          .dash-stats-wrap { width: 300px; }
          .dash-activity-wrap { width: 280px; }
        }
        @media (max-width: 1023px) {
          .dash-stats-wrap { width: 260px; }
          .dash-activity-wrap { width: 240px; }
          .dash-act-btn { display: none; }
        }
        @media (max-width: 767px) {
          .dash-root {
            position: static; height: auto;
            overflow-y: auto;
            padding: 62px 10px 72px;
            left: 0;
          }
          .dash-top { flex-direction: column; flex: none; }
          .dash-map-wrap { height: 240px; }
          .dash-stats-wrap { width: 100%; height: 200px; flex: none; }
          .dash-bottom { flex-direction: column; flex: none; }
          .dash-analytics-wrap { min-height: 280px; flex: none; }
          .dash-activity-wrap { width: 100%; height: 280px; }
          .dash-act-btn { display: none; }
        }
      `}</style>

      <div className="dash-root">
        {/* Top Row */}
        <div className="dash-top">
          <div className="dash-map-wrap"><Maps /></div>
          <div className="dash-stats-wrap"><Stats /></div>
        </div>

        {/* Bottom Row */}
        <div className="dash-bottom">
          <div className="dash-analytics-wrap"><AnalyticsCharts /></div>

          <div className="dash-activity-wrap">
            <div className="dash-activity-root">
              <div className="dash-act-header">
                <div className="dash-act-title">
                  <div className="dash-act-dot" />
                  Recent Activity
                </div>
                <span className="dash-act-live">LIVE</span>
              </div>

              {bookings.length === 0 ? (
                <div className="dash-act-empty">No activity yet</div>
              ) : bookings.map((b, idx) => {
                const sc = statusColors[b.status] || "#ccc";
                const pillBg =
                  b.status === "confirmed" ? "rgba(0,212,170,0.12)"
                  : b.status === "pending"   ? "rgba(247,201,72,0.12)"
                  : b.status === "cancelled" ? "rgba(229,9,20,0.12)"
                  : "rgba(255,255,255,0.06)";
                return (
                  <div key={idx} className="dash-act-item" onClick={() => navigate("/Requests")}>
                    <div className="dash-act-left">
                      <div className="dash-act-dot-sm" style={{ background: sc }} />
                      <div className="dash-act-info">
                        <div className="dash-act-amb">🚑 {b.ambulance_number}</div>
                        <div className="dash-act-sub">{b.booked_by} · {b.pickup_location}</div>
                      </div>
                    </div>
                    <div className="dash-act-right">
                      <span className="dash-act-pill" style={{ color: sc, background: pillBg, borderColor: sc + "60" }}>{b.status}</span>
                      <button className="dash-act-btn" onClick={e => { e.stopPropagation(); navigate("/Requests"); }}>View</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;// Pages/DriverChangeRequests.jsx — Admin: Driver ambulance change requests
import { useState, useEffect } from "react";

const BASE = "http://127.0.0.1:8000";

const statusColor = {
  pending:  { c:"#f7c948", bg:"rgba(247,201,72,0.12)",  b:"rgba(247,201,72,0.3)"  },
  approved: { c:"#00d4aa", bg:"rgba(0,212,170,0.12)",   b:"rgba(0,212,170,0.3)"   },
  rejected: { c:"#ff4d5a", bg:"rgba(229,9,20,0.12)",    b:"rgba(229,9,20,0.3)"    },
};

export default function DriverChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/api/ambulances/change-request/`);
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      showToast("Server se connect nahi hua", "error");
      setRequests([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    const t = setInterval(fetchRequests, 10000);
    return () => clearInterval(t);
  }, []);

  const handleAction = async (req, action) => {
    try {
      const res = await fetch(`${BASE}/api/ambulances/change-request/`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp: req.timestamp, status: action }),
      });
      const data = await res.json();
      if (data.status === "updated") {
        showToast(action === "approved" ? "✅ Request Approve kar diya!" : "❌ Request Reject kar diya!");
        fetchRequests();
      } else {
        showToast(data.error || "Error", "error");
      }
    } catch {
      showToast("Server error", "error");
    }
  };

  // ✅ Delete — sirf local state se remove (cache mein se backend delete nahi karta)
  const handleDelete = async (timestamp) => {
    try {
      const res  = await fetch(`${BASE}/api/ambulances/change-request/delete/`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp }),
      });
      const data = await res.json();
      if (data.status === "deleted") {
        setRequests(prev => prev.filter(r => r.timestamp !== timestamp));
        showToast("🗑 Request delete kar di!");
      } else {
        showToast(data.error || "Delete nahi hua", "error");
      }
    } catch {
      showToast("Server error", "error");
    }
  };

  const pending  = requests.filter(r => r.status === "pending");
  const resolved = requests.filter(r => r.status !== "pending");

  return (
    <>
      <style>{`
        .dcr-root { min-height:100vh; background:#0a0a0a; color:#fff; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; padding:56px 0 0 64px; box-sizing:border-box; }
        .dcr-header { background:#111; border-bottom:1px solid #1c1c1c; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; }
        .dcr-title { font-size:18px; font-weight:800; }
        .dcr-sub { font-size:12px; color:#555; margin-top:3px; }
        .dcr-content { max-width:900px; margin:0 auto; padding:24px; }
        .dcr-section-title { font-size:13px; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:1px; margin:24px 0 12px; display:flex; align-items:center; gap:8px; }
        .dcr-badge { background:rgba(229,9,20,0.15); color:#ff4d5a; border:1px solid rgba(229,9,20,0.3); border-radius:10px; padding:1px 8px; font-size:10px; font-weight:700; }
        .dcr-card { background:#111; border:1px solid #1e1e1e; border-radius:14px; padding:16px 20px; margin-bottom:10px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .dcr-card-info { flex:1; min-width:0; }
        .dcr-driver-name { font-size:15px; font-weight:800; margin-bottom:4px; }
        .dcr-detail { font-size:12px; color:#555; margin-bottom:2px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .dcr-arrow { display:flex; align-items:center; gap:8px; background:#181818; border:1px solid #222; border-radius:10px; padding:10px 14px; flex-shrink:0; }
        .dcr-amb-box { text-align:center; }
        .dcr-amb-label { font-size:9px; color:#555; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
        .dcr-amb-num { font-size:13px; font-weight:700; color:#fff; }
        .dcr-arrow-icon { color:#555; font-size:16px; }
        .dcr-actions { display:flex; gap:8px; flex-shrink:0; }
        .dcr-btn { border:none; border-radius:8px; padding:8px 16px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.15s; }
        .dcr-btn-approve { background:#00c853; color:#000; }
        .dcr-btn-approve:hover { background:#00e060; }
        .dcr-btn-reject  { background:rgba(229,9,20,0.15); color:#ff4d5a; border:1px solid rgba(229,9,20,0.3); }
        .dcr-btn-reject:hover { background:rgba(229,9,20,0.25); }
        .dcr-btn-delete  { background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.15s; }
        .dcr-btn-delete:hover { background:rgba(229,9,20,0.15); color:#ff4d5a; border-color:rgba(229,9,20,0.3); }
        .dcr-status-pill { font-size:10px; font-weight:700; padding:4px 12px; border-radius:20px; border:1px solid; text-transform:uppercase; flex-shrink:0; }
        .dcr-empty { text-align:center; padding:60px 0; color:#333; font-size:14px; }
        .dcr-time { font-size:10px; color:#444; margin-top:4px; }
        .dcr-toast { position:fixed; top:20px; right:20px; padding:12px 20px; border-radius:8px; font-weight:700; font-size:13px; z-index:9999; box-shadow:0 4px 20px #0008; }
        .dcr-refresh-btn { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.5); border-radius:8px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
        .dcr-refresh-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .dcr-live-dot { width:7px; height:7px; border-radius:50%; background:#00c853; box-shadow:0 0 6px #00c853; animation:pulse 1.5s infinite; display:inline-block; margin-right:6px; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>

      {toast && (
        <div className="dcr-toast" style={{ background: toast.type==="error" ? "#e53935" : "#00c853", color: toast.type==="error" ? "#fff" : "#000" }}>
          {toast.msg}
        </div>
      )}

      <div className="dcr-root">
        <div className="dcr-header">
          <div>
            <div className="dcr-title">🔄 Driver Change Requests</div>
            <div className="dcr-sub">
              <span className="dcr-live-dot"/>
              Auto-refresh • Drivers ki ambulance change requests — approve ya reject karo
            </div>
          </div>
          <button className="dcr-refresh-btn" onClick={fetchRequests}>↻ Refresh</button>
        </div>

        <div className="dcr-content">
          {loading ? (
            <div className="dcr-empty">⏳ Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="dcr-empty">
              <div style={{ fontSize:48, marginBottom:12 }}>📭</div>
              Koi change request nahi abhi
            </div>
          ) : (
            <>
              {/* Pending */}
              {pending.length > 0 && (
                <>
                  <div className="dcr-section-title">
                    ⏳ Pending Requests
                    <span className="dcr-badge">{pending.length}</span>
                  </div>
                  {pending.map((req, i) => (
                    <div key={i} className="dcr-card" style={{ borderColor:"rgba(247,201,72,0.2)", background:"rgba(247,201,72,0.03)" }}>
                      <div className="dcr-card-info">
                        <div className="dcr-driver-name">👤 {req.driverName}</div>
                        <div className="dcr-detail">
                          <span>📧 {req.driverEmail}</span>
                          {req.driverPhone && <span>📱 +91 {req.driverPhone}</span>}
                        </div>
                        <div className="dcr-time">🕐 {new Date(req.timestamp).toLocaleString("en-IN")}</div>
                      </div>
                      <div className="dcr-arrow">
                        <div className="dcr-amb-box">
                          <div className="dcr-amb-label">Current</div>
                          <div className="dcr-amb-num">{req.currentAmbNumber}</div>
                        </div>
                        <div className="dcr-arrow-icon">→</div>
                        <div className="dcr-amb-box">
                          <div className="dcr-amb-label">Requested</div>
                          <div className="dcr-amb-num" style={{ color:"#f7c948" }}>{req.newAmbNumber}</div>
                        </div>
                      </div>
                      <div className="dcr-actions">
                        <button className="dcr-btn dcr-btn-approve" onClick={() => handleAction(req, "approved")}>✅ Approve</button>
                        <button className="dcr-btn dcr-btn-reject"  onClick={() => handleAction(req, "rejected")}>❌ Reject</button>
                        <button className="dcr-btn-delete" onClick={() => handleDelete(req.timestamp)} title="Delete">🗑</button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Resolved */}
              {resolved.length > 0 && (
                <>
                  <div className="dcr-section-title" style={{ marginTop:32 }}>
                    📋 Purani Requests
                    {/* ✅ Clear All button */}
                    <button
                      onClick={() => {
                        if (window.confirm("Saari purani requests delete karein?")) {
                          resolved.forEach(r => handleDelete(r.timestamp));
                        }
                      }}
                      style={{ marginLeft:"auto", background:"rgba(229,9,20,0.1)", border:"1px solid rgba(229,9,20,0.2)", color:"#ff4d5a", borderRadius:8, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                      🗑 Sab Delete Karo
                    </button>
                  </div>
                  {resolved.map((req, i) => {
                    const sc = statusColor[req.status] || statusColor.rejected;
                    return (
                      <div key={i} className="dcr-card">
                        <div className="dcr-card-info">
                          <div className="dcr-driver-name">👤 {req.driverName}</div>
                          <div className="dcr-detail">
                            <span>📧 {req.driverEmail}</span>
                            {req.driverPhone && <span>📱 +91 {req.driverPhone}</span>}
                          </div>
                          <div className="dcr-time">🕐 {new Date(req.timestamp).toLocaleString("en-IN")}</div>
                        </div>
                        <div className="dcr-arrow">
                          <div className="dcr-amb-box">
                            <div className="dcr-amb-label">From</div>
                            <div className="dcr-amb-num">{req.currentAmbNumber}</div>
                          </div>
                          <div className="dcr-arrow-icon">→</div>
                          <div className="dcr-amb-box">
                            <div className="dcr-amb-label">To</div>
                            <div className="dcr-amb-num">{req.newAmbNumber}</div>
                          </div>
                        </div>
                        <span className="dcr-status-pill" style={{ color:sc.c, background:sc.bg, borderColor:sc.b }}>
                          {req.status === "approved" ? "✅ Approved" : "❌ Rejected"}
                        </span>
                        {/* ✅ Delete button */}
                        <button className="dcr-btn-delete" onClick={() => handleDelete(req.timestamp)} title="Delete karo">
                          🗑
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useLeaflet, { DARK_TILE, DELHI, makePinIcon } from "../hooks/useLeaflet";

const BASE          = "http://127.0.0.1:8000";
const PING_INTERVAL = 5000;
const POLL_INTERVAL = 8000;

const requestNotifPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
};
const sendPush = (title, body, tag = "") => {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body, tag: tag || title,
    icon: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png",
    requireInteraction: true, vibrate: [200, 100, 200],
  });
  setTimeout(() => n.close(), 10000);
};

const SC = {
  available: { c:"#00d4aa", bg:"rgba(0,212,170,0.12)", b:"rgba(0,212,170,0.3)"  },
  en_route:  { c:"#f7c948", bg:"rgba(247,201,72,0.12)", b:"rgba(247,201,72,0.3)" },
  busy:      { c:"#ff4d5a", bg:"rgba(229,9,20,0.12)",   b:"rgba(229,9,20,0.3)"   },
  offline:   { c:"rgba(255,255,255,0.35)", bg:"rgba(255,255,255,0.05)", b:"rgba(255,255,255,0.1)" },
};
const logColor = { info:"#888", success:"#00c853", warn:"#ffaa00", error:"#f44336" };

export default function DriverDashboard() {
  const navigate     = useNavigate();
  const leafletReady = useLeaflet();

  const driverEmail = localStorage.getItem("user")             || "";
  const driverName  = localStorage.getItem("name")             || "Driver";
  const ambId       = parseInt(localStorage.getItem("ambulance_id") || "0");
  const ambNumber   = localStorage.getItem("ambulance_number") || "—";

  const [driverPhone,   setDriverPhone]  = useState(localStorage.getItem("phone") || "");
  const [ambulance,     setAmbulance]    = useState(null);
  const [myBookings,    setMyBookings]   = useState([]);
  const [isTracking,    setIsTracking]   = useState(false);
  const [location,      setLocation]     = useState(null);
  const [speed,         setSpeed]        = useState(0);
  const [route,         setRoute]        = useState(null);
  const [notifAllowed,  setNotifAllowed] = useState(Notification.permission === "granted");
  const [log,           setLog]          = useState([]);
  const [tab,           setTab]          = useState("map");
  const [allAmbs,       setAllAmbs]      = useState([]);
  const [allHospitals,  setAllHospitals] = useState([]);
  const [changeReqAmb,  setChangeReqAmb] = useState(null);
  const [pendingReq,    setPendingReq]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("dr_change_req") || "null"); } catch { return null; }
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const mapDivRef    = useRef(null);
  const mapObj       = useRef(null);
  const driverMarker = useRef(null);
  const routingRef   = useRef(null);
  const latestLoc    = useRef(null);
  const watchId      = useRef(null);
  const pingTimer    = useRef(null);
  const firstPan     = useRef(true);

  const addLog = (msg, type = "info") =>
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));

  const loadNotifications = useCallback(() => {
    const notifKey = `dr_notif_${driverEmail}`;
    try {
      const stored = JSON.parse(localStorage.getItem(notifKey) || "[]");
      setNotifications(stored);
      setUnreadCount(stored.filter(n => !n.read).length);
    } catch { setNotifications([]); setUnreadCount(0); }
  }, [driverEmail]);

  const markAllRead = () => {
    const notifKey = `dr_notif_${driverEmail}`;
    const updated  = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem(notifKey, JSON.stringify(updated));
    setNotifications(updated);
    setUnreadCount(0);
  };

  const pollServerNotifications = useCallback(async () => {
    if (!driverEmail) return;
    try {
      const res  = await fetch(`${BASE}/api/driver/notifications/?email=${encodeURIComponent(driverEmail)}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return;
      const notifKey = `dr_notif_${driverEmail}`;
      const existing = JSON.parse(localStorage.getItem(notifKey) || "[]");
      let changed = false;
      data.forEach(serverNotif => {
        const alreadyStored = existing.some(n => n.id === serverNotif.id);
        if (!alreadyStored) {
          existing.unshift({ ...serverNotif, read: false });
          changed = true;
          if (serverNotif.type === "approved" || serverNotif.type === "rejected") {
            localStorage.removeItem("dr_change_req");
            setPendingReq(null);
            addLog(serverNotif.type === "approved"
              ? `✅ Ambulance change approved: ${serverNotif.ambNumber}`
              : `❌ Change request reject hua: ${serverNotif.ambNumber}`,
              serverNotif.type === "approved" ? "success" : "warn"
            );
            sendPush(serverNotif.title, serverNotif.message, serverNotif.id);
          }
        }
      });
      if (changed) {
        localStorage.setItem(notifKey, JSON.stringify(existing));
        loadNotifications();
        fetch(`${BASE}/api/driver/notifications/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: driverEmail, ids: data.map(n => n.id) }),
        }).catch(() => {});
      }
    } catch {}
  }, [driverEmail, loadNotifications]);

  const fetchAmbulance = useCallback(() => {
    fetch(`${BASE}/api/ambulances/`)
      .then(r => r.json())
      .then(data => {
        setAllAmbs(data);
        fetch(`${BASE}/api/hospitals/`).then(r=>r.json()).then(h=>setAllHospitals(h)).catch(()=>{});
        const mine = data.find(a => a.id === ambId);
        if (mine) {
          setAmbulance(mine);
          if (mine.driver_contact) {
            const saved = localStorage.getItem("phone");
            if (!saved || saved === "") {
              localStorage.setItem("phone", mine.driver_contact);
              setDriverPhone(mine.driver_contact);
            }
          }
        }
      }).catch(() => {});
  }, [ambId]);

  const fetchBookings = useCallback(() => {
    fetch(`${BASE}/api/bookings/`)
      .then(r => r.json())
      .then(data => {
        const mine = data.filter(b => b.ambulance_id === ambId).sort((a, b) => b.id - a.id);
        setMyBookings(mine);
        const confirmed = mine.filter(b => b.status === "confirmed");
        if (confirmed.length) {
          const latest = confirmed[0];
          const lastId = parseInt(localStorage.getItem("dr_last_confirmed") || "0");
          if (latest.id !== lastId) {
            localStorage.setItem("dr_last_confirmed", latest.id);
            addLog(`✅ Booking #${latest.id} confirm — ${latest.booked_by}!`, "success");
            sendPush("✅ Booking Confirm!", `Patient: ${latest.booked_by}\nPickup: ${latest.pickup_location}`, `booking-${latest.id}`);
            const notifKey = `dr_notif_${driverEmail}`;
            const existing = JSON.parse(localStorage.getItem(notifKey) || "[]");
            if (!existing.some(n => n.bookingId === latest.id)) {
              existing.unshift({
                id: Date.now(), type: "booking", bookingId: latest.id,
                title: `✅ Booking #${latest.id} Confirmed!`,
                message: `${latest.booked_by} ko pickup karo — ${latest.pickup_location}`,
                timestamp: new Date().toISOString(), read: false,
              });
              localStorage.setItem(notifKey, JSON.stringify(existing));
              loadNotifications();
            }
            if (leafletReady && latest.pickup_location) drawRoute(latest.pickup_location, latest.destination);
          }
        }
      }).catch(() => {});
  }, [ambId, leafletReady, driverEmail, loadNotifications]);

  useEffect(() => {
    fetchAmbulance(); fetchBookings(); loadNotifications(); pollServerNotifications();
    requestNotifPermission().then(ok => setNotifAllowed(ok));
    const t1 = setInterval(fetchAmbulance, 10000);
    const t2 = setInterval(fetchBookings, POLL_INTERVAL);
    const t3 = setInterval(loadNotifications, 5000);
    const t4 = setInterval(pollServerNotifications, 6000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); };
  }, [fetchAmbulance, fetchBookings, loadNotifications, pollServerNotifications]);

  useEffect(() => {
    if (tab !== "map") return;
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    mapObj.current = L.map(mapDivRef.current, {
      center: [DELHI.lat, DELHI.lng], zoom: 15, minZoom: 10, maxZoom: 19, zoomControl: false,
    });
    L.tileLayer(DARK_TILE, { maxZoom: 19, attribution: '© CartoDB' }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    firstPan.current = true;
    return () => { if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [leafletReady, tab]);

  const startTracking = () => {
    if (!navigator.geolocation) { addLog("GPS supported nahi", "error"); return; }
    setIsTracking(true);
    firstPan.current = true;
    addLog("📍 GPS tracking shuru", "success");
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        latestLoc.current = loc;
        setLocation(loc);
        setSpeed(Math.round((pos.coords.speed || 0) * 3.6));
        if (mapObj.current && window.L) {
          if (firstPan.current) { mapObj.current.setView([loc.lat, loc.lng], 15); firstPan.current = false; }
          else mapObj.current.panTo([loc.lat, loc.lng]);
          if (driverMarker.current) {
            driverMarker.current.setLatLng([loc.lat, loc.lng]);
          } else {
            const icon = makePinIcon("#E50914", "🚑");
            if (icon) driverMarker.current = window.L.marker([loc.lat, loc.lng], { icon })
              .addTo(mapObj.current)
              .bindPopup(`<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700">📍 ${driverName} yahan hai</div>`, { className: "sr-dark-popup" });
          }
        }
      },
      err => addLog(`GPS error: ${err.message}`, "error"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    sendPingNow();
    pingTimer.current = setInterval(sendPingNow, PING_INTERVAL);
  };

  const stopTracking = () => {
    if (watchId.current)   navigator.geolocation.clearWatch(watchId.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    watchId.current = pingTimer.current = null;
    setIsTracking(false);
    addLog("⏹ Tracking band", "warn");
  };
  useEffect(() => () => stopTracking(), []);

  const sendPingNow = useCallback(() => {
    const loc = latestLoc.current;
    if (!loc || !driverEmail || !ambId) return;
    fetch(`${BASE}/api/driver/ping/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_email: driverEmail, ambulance_id: ambId, latitude: loc.lat, longitude: loc.lng, speed: 0 }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.pending_route) {
          const nr = data.pending_route;
          setRoute(prev => {
            if (!prev || prev.id !== nr.id) {
              addLog("🗺 Naya route assign hua!", "success");
              sendPush("🚨 Naya Route!", `Pickup: ${nr.pickup_location} → ${nr.destination}`, `route-${nr.id}`);
              if (leafletReady) drawRoute(nr.pickup_location, nr.destination);
            }
            return nr;
          });
        }
      }).catch(() => {});
  }, [driverEmail, ambId, leafletReady]);

  const geocode = async (addr) => {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr + ", Delhi, India")}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (!data.length) throw new Error(`"${addr}" nahi mila`);
    return window.L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
  };

  const drawRoute = async (pickup, destination) => {
    if (!leafletReady || !mapObj.current || !window.L) return;
    const L = window.L;
    if (routingRef.current) { try { mapObj.current.removeControl(routingRef.current); } catch {} routingRef.current = null; }
    try {
      const pickupLL = await geocode(pickup);
      const destLL   = destination ? await geocode(destination) : null;
      const origin   = latestLoc.current ? L.latLng(latestLoc.current.lat, latestLoc.current.lng) : L.latLng(DELHI.lat, DELHI.lng);
      const routing  = L.Routing.control({
        waypoints: [origin, pickupLL, ...(destLL ? [destLL] : [])],
        router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1", profile: "driving" }),
        lineOptions: {
          styles: [{ color: "#E50914", weight: 5, opacity: 0.9 }, { color: "#fff", weight: 2, opacity: 0.15 }],
          extendToWaypoints: true, missingRouteTolerance: 0,
        },
        show: false, addWaypoints: false, draggableWaypoints: false,
        fitSelectedRoutes: true, showAlternatives: false,
        createMarker: (i, wp) => {
          const icons = [null, makePinIcon("#f7c948", "📍"), makePinIcon("#00d4aa", "🏥")];
          if (!icons[i]) return false;
          return L.marker(wp.latLng, { icon: icons[i] }).addTo(mapObj.current);
        },
      }).addTo(mapObj.current);
      routingRef.current = routing;
      routing.on("routesfound", e => {
        const s = e.routes[0].summary;
        addLog(`🗺 Route: ${(s.totalDistance/1000).toFixed(1)} km, ~${Math.round(s.totalTime/60)} min`, "success");
      });
    } catch (err) { addLog(`Route error: ${err.message}`, "error"); }
  };

  const respondRoute = async (status) => {
    if (!route?.id) return;
    try {
      await fetch(`${BASE}/api/driver/route/${route.id}/respond/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (status === "completed") {
        setRoute(null);
        if (routingRef.current) { try { mapObj.current?.removeControl(routingRef.current); } catch {} routingRef.current = null; }
        addLog("🏁 Trip complete!", "success");
        sendPush("🏁 Trip Complete!", "Patient safe. Next mission tayaar.");
      } else {
        setRoute(r => ({ ...r, status }));
        addLog(status === "accepted" ? "✅ Route accept" : "❌ Route reject", status === "accepted" ? "success" : "warn");
      }
    } catch { addLog("Route update fail", "error"); }
  };

  const sendChangeRequest = async () => {
    if (!changeReqAmb) return;
    const req = {
      driverEmail, driverName, driverPhone,
      currentAmbId: ambId, currentAmbNumber: ambNumber,
      newAmbId: changeReqAmb.id, newAmbNumber: changeReqAmb.ambulance_number,
      status: "pending", timestamp: new Date().toISOString(),
    };
    try {
      const res  = await fetch(`${BASE}/api/ambulances/change-request/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (data.status === "already_pending") {
        addLog("⚠️ Request pehle se pending hai", "warn");
        localStorage.setItem("dr_change_req", JSON.stringify(req));
        setPendingReq(req);
        return;
      }
      localStorage.setItem("dr_change_req", JSON.stringify(req));
      setPendingReq(req);
      setChangeReqAmb(null);
      addLog(`📤 Change request bheja — ${changeReqAmb.ambulance_number}`, "success");
    } catch {
      addLog("❌ Request send nahi hui", "error");
    }
  };

  const sc = ambulance ? (SC[ambulance.status] || SC.offline) : SC.offline;
  const routeBorder = route?.status === "pending" ? "#ffaa00" : route?.status === "accepted" ? "#00c853" : "#4fc3f7";

  const tabs = [
    { k:"map",           l:"🗺 Live Map",      icon:"🗺",  shortLabel:"Live Map"                                              },
    { k:"bookings",      l:"📋 My Bookings",   icon:"📋",  shortLabel:"Bookings",   count: myBookings.filter(b=>b.status==="confirmed").length },
    { k:"notifications", l:"🔔 Notifications", icon:"🔔",  shortLabel:"Alerts",     count: unreadCount                        },
    { k:"ambulance",     l:"🚑 My Ambulance",  icon:"🚑",  shortLabel:"Ambulance"                                             },
    { k:"ambulances",    l:"🚒 Ambulances",    icon:"🚒",  shortLabel:"Ambulances"                                            },
    { k:"hospitals",     l:"🏥 Hospitals",     icon:"🏥",  shortLabel:"Hospitals"                                             },
  ];

  const switchTab = (k) => {
    setTab(k);
    if (k === "notifications") markAllRead();
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        /* ── Root ── */
        .dd-root {
          min-height: 100vh;
          background: #0a0a0a;
          color: #fff;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          /* Desktop: Topnavbar (56px) + Left sidebar (64px) ke liye space */
          padding-top: 56px;
          padding-left: 64px;
        }

        /* ── Header ── */
        .dd-header {
          background: #111; border-bottom: 1px solid #1c1c1c;
          padding: 10px 16px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; flex-wrap: wrap;
        }
        .dd-driver-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .dd-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: #E50914; display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; flex-shrink: 0;
          overflow: hidden; border: 2px solid rgba(229,9,20,0.4);
        }
        .dd-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .dd-name { font-weight: 700; font-size: 13px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dd-meta { font-size: 10px; color: #555; margin-top: 2px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .dd-meta-pill { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 1px 6px; font-size: 9px; color: rgba(255,255,255,0.35); }
        .dd-status-pill { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1px solid; white-space: nowrap; }

        @keyframes dotPulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        .dot-pulse { animation: dotPulse 1.5s infinite; }
        @keyframes routePulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,170,0,0.4)}50%{box-shadow:0 0 0 8px rgba(255,170,0,0)} }
        .route-pulse { animation: routePulse 1.5s infinite; }

        /* ── Desktop Tabs ── */
        .dd-tabs-desktop {
          display: flex; background: #111; border-bottom: 1px solid #1c1c1c;
          overflow-x: auto; scrollbar-width: none;
        }
        .dd-tabs-desktop::-webkit-scrollbar { display: none; }
        .dd-tab {
          flex: 1; min-width: fit-content; padding: 11px 10px;
          text-align: center; font-size: 12px; font-weight: 700;
          color: #555; cursor: pointer; border-bottom: 2px solid transparent;
          transition: all 0.15s; white-space: nowrap;
          display: flex; align-items: center; justify-content: center; gap: 5px;
        }
        .dd-tab.active { color: #fff; border-bottom-color: #E50914; }
        .dd-tab:hover:not(.active) { color: #999; }
        .dd-tab-badge {
          background: #E50914; color: #fff;
          font-size: 9px; font-weight: 800;
          border-radius: 10px; padding: 1px 5px; min-width: 15px; text-align: center;
        }

        /* ── Mobile Bottom Nav ── */
        .dd-bottom-nav {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0;
          background: #111; border-top: 1px solid #1c1c1c;
          z-index: 99999;
          height: 60px; padding: 0 4px;
          align-items: stretch;
        }
        .dd-bottom-nav-inner {
          display: flex; align-items: stretch; height: 100%; width: 100%;
        }
        .dd-bnav-item {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 3px;
          cursor: pointer; padding: 6px 4px;
          border-top: 2px solid transparent;
          transition: all 0.15s; position: relative;
        }
        .dd-bnav-item.active { border-top-color: #E50914; }
        .dd-bnav-icon { font-size: 18px; line-height: 1; }
        .dd-bnav-label { font-size: 8px; font-weight: 700; color: #555; }
        .dd-bnav-item.active .dd-bnav-label { color: #fff; }
        .dd-bnav-badge {
          position: absolute; top: 4px; right: calc(50% - 14px);
          background: #E50914; color: #fff;
          font-size: 8px; font-weight: 800;
          border-radius: 10px; padding: 1px 5px; min-width: 14px; text-align: center;
        }

        /* ── Map Layout ── */
        .dd-map-layout {
          display: flex;
          height: calc(100vh - 56px - 45px - 52px);
        }
        .dd-sidebar {
          width: 270px; min-width: 270px;
          background: #111; border-right: 1px solid #1c1c1c;
          padding: 10px; overflow-y: auto;
          display: flex; flex-direction: column; gap: 10px;
          flex-shrink: 0;
        }
        .dd-map-wrap { flex: 1; position: relative; min-width: 0; }

        /* ── Cards ── */
        .dd-card { background: #181818; border: 1px solid #222; border-radius: 10px; padding: 12px; }
        .dd-card-title { font-weight: 700; font-size: 12px; margin-bottom: 10px; color: #ccc; text-transform: uppercase; letter-spacing: 0.5px; }
        .dd-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #1c1c1c; }
        .dd-row:last-child { border-bottom: none; }
        .dd-row-key { font-size: 11px; color: #555; }
        .dd-row-val { font-size: 11px; font-weight: 600; color: #00c853; }
        .dd-log { max-height: 150px; overflow-y: auto; }
        .dd-log::-webkit-scrollbar { width: 3px; }
        .dd-log::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .dd-content { max-width: 900px; margin: 0 auto; padding: 16px 16px 80px; }
        .dd-btn { border: none; border-radius: 8px; padding: 10px 16px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; width: 100%; margin-top: 6px; }
        .dd-btn-red   { background: #E50914; color: #fff; }
        .dd-btn-red:hover { background: #f40612; }
        .dd-btn-green { background: #00c853; color: #000; }
        .dd-btn-green:hover { background: #00e060; }
        .dd-btn-grey  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.1); }

        /* ── Booking Cards ── */
        .dd-booking-card { background: #181818; border: 1px solid #222; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
        .dd-booking-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; }
        .dd-booking-amb { font-weight: 800; font-size: 14px; }
        .dd-booking-pill { font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid; text-transform: uppercase; }
        .dd-booking-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .dd-booking-item { display: flex; flex-direction: column; gap: 2px; min-width: 120px; }
        .dd-booking-lbl { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
        .dd-booking-val { font-size: 12px; color: #ccc; }

        /* ── Ambulance Tab ── */
        .dd-amb-card { background: #181818; border: 2px solid #E50914; border-radius: 14px; padding: 16px; margin-bottom: 14px; }
        .dd-amb-number { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
        .dd-amb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .dd-amb-field { background: #111; border-radius: 8px; padding: 10px 12px; }
        .dd-amb-flbl { font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .dd-amb-fval { font-size: 12px; font-weight: 600; color: #fff; }
        .dd-amb-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
        .dd-amb-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: 1.5px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.15s; }
        .dd-amb-item:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.14); }
        .dd-amb-item.selected { background: rgba(247,201,72,0.07); border-color: rgba(247,201,72,0.38); }
        .dd-amb-item-name { font-size: 13px; font-weight: 700; }
        .dd-amb-item-sub  { font-size: 10px; color: #555; margin-top: 1px; }
        .dd-pending-banner { background: rgba(247,201,72,0.08); border: 1px solid rgba(247,201,72,0.3); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #f7c948; margin-bottom: 14px; }

        /* ── Route Card ── */
        .dd-route-card { border-radius: 10px; padding: 12px; }
        .dd-route-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
        .dd-route-info { font-size: 12px; color: #ccc; line-height: 1.9; margin-bottom: 10px; }
        .dd-route-btns { display: flex; gap: 8px; }
        .dd-route-btns button { flex: 1; }

        /* ── Notifications ── */
        .dn-card { background: #181818; border: 1px solid #222; border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s; }
        .dn-card.unread { border-color: rgba(229,9,20,0.3); background: rgba(229,9,20,0.04); }
        .dn-card:hover { background: #1e1e1e; }
        .dn-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .dn-card-title { font-size: 13px; font-weight: 700; color: #fff; }
        .dn-card-time { font-size: 10px; color: #444; white-space: nowrap; }
        .dn-card-msg { font-size: 12px; color: #666; margin-top: 4px; }
        .dn-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #E50914; flex-shrink: 0; margin-top: 3px; }

        /* ── Leaflet ── */
        .sr-dark-popup .leaflet-popup-content-wrapper { background: rgba(20,20,20,0.97)!important; border: 1px solid rgba(255,255,255,0.1)!important; border-radius: 10px!important; padding: 0!important; }
        .sr-dark-popup .leaflet-popup-content { margin: 0!important; }
        .sr-dark-popup .leaflet-popup-tip { background: rgba(20,20,20,0.97)!important; }
        .leaflet-control-zoom a { background: rgba(20,20,20,0.92)!important; color: #fff!important; border-color: rgba(255,255,255,0.1)!important; }
        .leaflet-routing-container { display: none!important; }

        /* ══════════════════════════════════════
           MOBILE RESPONSIVE
           FIX 1: padding-top: 56px (Topnavbar ke liye)
           FIX 2: padding-left: 0 (left sidebar mobile pe nahi hota)
           FIX 3: padding-bottom: 60px (apna bottom nav ke liye)
        ══════════════════════════════════════ */
        @media (max-width: 767px) {
          .dd-root {
            padding-top: 56px !important;   /* Topnavbar hamesha dikhta hai */
            padding-left: 0 !important;     /* Left sidebar mobile pe hide hota hai */
            padding-bottom: 60px !important; /* Apna bottom nav ke liye space */
          }

          /* Hide desktop tabs, show bottom nav */
          .dd-tabs-desktop { display: none !important; }
          .dd-bottom-nav   { display: flex !important; }

          /* Map layout stacks vertically */
          .dd-map-layout {
            flex-direction: column;
            /* FIX: 56px topnav + 60px bottom nav = 116px, baki sab map */
            height: calc(100vh - 56px - 60px);
          }
          .dd-sidebar {
            width: 100%; min-width: unset;
            border-right: none; border-bottom: 1px solid #1c1c1c;
            max-height: 240px;
          }
          .dd-map-wrap { flex: 1; min-height: 200px; }

          /* Content pages */
          .dd-content { padding: 12px 12px 80px; }
          .dd-amb-grid { grid-template-columns: 1fr; }

          /* Header tweaks */
          .dd-header { padding: 8px 12px; }
          .dd-name { font-size: 12px; }
          .dd-status-pill { padding: 2px 8px; font-size: 9px; }
        }

        @media (max-width: 480px) {
          .dd-booking-item { min-width: 100px; }
          .dd-amb-number { font-size: 18px; }
        }
      `}</style>

      <div className="dd-root">

        {/* ── Header ── */}
        <div className="dd-header">
          <div className="dd-driver-info">
            <div className="dd-avatar">
              {(() => {
                const pic = localStorage.getItem(`sr-profile-pic-${driverEmail}`);
                return pic ? <img src={pic} alt="dp"/> : <span>{driverName[0]?.toUpperCase()}</span>;
              })()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="dd-name">🚑 {driverName}</div>
              <div className="dd-meta">
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{driverEmail}</span>
                {driverPhone
                  ? <span className="dd-meta-pill">📱 +91 {driverPhone}</span>
                  : <span className="dd-meta-pill" style={{ color:"#e53935" }}>📱 Phone nahi</span>
                }
                <span className="dd-meta-pill">{ambNumber}</span>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            {ambulance && (
              <div className="dd-status-pill" style={{ color:sc.c, background:sc.bg, borderColor:sc.b }}>
                <div className={isTracking?"dot-pulse":""} style={{ width:6, height:6, borderRadius:"50%", background:sc.c }} />
                {ambulance.status?.replace("_"," ")}
              </div>
            )}
            <div className="dd-status-pill" style={{ color:isTracking?"#00c853":"#555", background:isTracking?"rgba(0,200,83,0.1)":"rgba(50,50,50,0.2)", borderColor:isTracking?"#00c853":"#333" }}>
              {isTracking ? "LIVE" : "OFFLINE"}
            </div>
          </div>
        </div>

        {/* ── Desktop Tabs ── */}
        <div className="dd-tabs-desktop">
          {tabs.map(({ k, l, count }) => (
            <div key={k} className={`dd-tab ${tab===k?"active":""}`} onClick={() => switchTab(k)}>
              {l}
              {count > 0 && <span className="dd-tab-badge">{count}</span>}
            </div>
          ))}
        </div>

        {/* ── MAP TAB ── */}
        {tab === "map" && (
          <div className="dd-map-layout">
            <div className="dd-sidebar">
              <div className="dd-card">
                <div className="dd-card-title">📡 GPS Control</div>
                {!isTracking
                  ? <button className="dd-btn dd-btn-green" onClick={startTracking}>▶ Tracking Shuru Karo</button>
                  : <button className="dd-btn dd-btn-red"   onClick={stopTracking}>⏹ Tracking Band Karo</button>
                }
                {!notifAllowed && (
                  <button className="dd-btn dd-btn-grey" style={{ marginTop:6 }}
                    onClick={() => requestNotifPermission().then(ok => setNotifAllowed(ok))}>
                    🔔 Notifications Enable Karo
                  </button>
                )}
              </div>
              <div className="dd-card">
                <div className="dd-card-title">📍 Live Position</div>
                {[
                  ["Latitude",  location?.lat?.toFixed(6) ?? "—"],
                  ["Longitude", location?.lng?.toFixed(6) ?? "—"],
                  ["Speed",     `${speed} km/h`],
                ].map(([k,v]) => (
                  <div key={k} className="dd-row">
                    <span className="dd-row-key">{k}</span>
                    <span className="dd-row-val">{v}</span>
                  </div>
                ))}
              </div>
              {route && (
                <div className={`dd-route-card dd-card ${route.status==="pending"?"route-pulse":""}`}
                  style={{ border:`2px solid ${routeBorder}`, background:"#0f0f0f" }}>
                  <div className="dd-route-title" style={{ color:routeBorder }}>
                    {route.status==="pending" ? "🚨 Naya Route!" : route.status==="accepted" ? "🧭 Route Active" : "🏁 Trip"}
                  </div>
                  <div className="dd-route-info">
                    <div>📍 <b>Pickup:</b> {route.pickup_location}</div>
                    <div>🏥 <b>Hospital:</b> {route.destination}</div>
                    {route.distance_km && <div>📏 <b>Distance:</b> {route.distance_km}</div>}
                    {route.duration    && <div>⏱ <b>ETA:</b> {route.duration}</div>}
                  </div>
                  {route.status === "pending" && (
                    <div className="dd-route-btns">
                      <button className="dd-btn dd-btn-green" style={{ marginTop:0 }} onClick={() => respondRoute("accepted")}>✅ Accept</button>
                      <button className="dd-btn dd-btn-red"   style={{ marginTop:0 }} onClick={() => respondRoute("rejected")}>❌ Reject</button>
                    </div>
                  )}
                  {route.status === "accepted" && (
                    <button className="dd-btn dd-btn-green" onClick={() => respondRoute("completed")}>🏁 Trip Complete Karo</button>
                  )}
                </div>
              )}
              <div className="dd-card">
                <div className="dd-card-title">📋 Activity</div>
                <div className="dd-log">
                  {log.length === 0
                    ? <div style={{ fontSize:11, color:"#333" }}>Koi activity nahi</div>
                    : log.map((l,i) => (
                      <div key={i} style={{ fontSize:11, color:logColor[l.type]||"#888", marginBottom:4 }}>
                        <span style={{ color:"#444" }}>{l.time} </span>{l.msg}
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="dd-map-wrap">
              <div ref={mapDivRef} style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }} />
              {!isTracking && (
                <div style={{ position:"absolute", inset:0, background:"rgba(10,10,10,0.88)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:2 }}>
                  <div style={{ fontSize:48 }}>🚑</div>
                  <div style={{ color:"#444", marginTop:12, fontSize:13, textAlign:"center", padding:"0 16px" }}>Tracking shuru karo map dekhne ke liye</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {tab === "bookings" && (
          <div className="dd-content">
            <div style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>
              📋 Meri Bookings
              <span style={{ fontSize:12, fontWeight:500, color:"#555", marginLeft:8 }}>({myBookings.length})</span>
            </div>
            {myBookings.length === 0
              ? <div style={{ textAlign:"center", padding:"50px 0", color:"#333", fontSize:14 }}>
                  <div style={{ fontSize:44, marginBottom:10 }}>📋</div>
                  Abhi koi booking nahi
                </div>
              : myBookings.map(b => {
                const bsc = {
                  pending:   { c:"#f7c948", bg:"rgba(247,201,72,0.12)",  bd:"rgba(247,201,72,0.3)"  },
                  confirmed: { c:"#00d4aa", bg:"rgba(0,212,170,0.12)",   bd:"rgba(0,212,170,0.3)"   },
                  completed: { c:"rgba(255,255,255,0.4)", bg:"rgba(255,255,255,0.05)", bd:"rgba(255,255,255,0.1)" },
                  cancelled: { c:"#ff4d5a", bg:"rgba(229,9,20,0.12)",    bd:"rgba(229,9,20,0.3)"    },
                }[b.status] || { c:"#888", bg:"rgba(255,255,255,0.05)", bd:"rgba(255,255,255,0.1)" };
                return (
                  <div key={b.id} className="dd-booking-card">
                    <div className="dd-booking-top">
                      <div className="dd-booking-amb">🚑 {b.ambulance_number}</div>
                      <span className="dd-booking-pill" style={{ color:bsc.c, background:bsc.bg, borderColor:bsc.bd }}>{b.status}</span>
                    </div>
                    <div className="dd-booking-row">
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Patient</div><div className="dd-booking-val">{b.booked_by}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Pickup</div><div className="dd-booking-val">📍 {b.pickup_location}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Destination</div><div className="dd-booking-val">{b.destination||"—"}</div></div>
                    </div>
                    {b.status === "confirmed" && (
                      <button className="dd-btn dd-btn-green" style={{ marginTop:6 }}
                        onClick={() => { switchTab("map"); if (!isTracking) startTracking(); }}>
                        🗺 Map pe dekho → Tracking Shuru
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* ── NOTIFICATIONS TAB ── */}
        {tab === "notifications" && (
          <div className="dd-content">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:16, fontWeight:800 }}>
                🔔 Notifications
                <span style={{ fontSize:12, fontWeight:500, color:"#555", marginLeft:8 }}>({notifications.length})</span>
              </div>
              {notifications.length > 0 && (
                <button onClick={markAllRead}
                  style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Sab Read Karo
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ textAlign:"center", padding:"50px 0", color:"#333", fontSize:14 }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🔔</div>
                Koi notification nahi abhi
              </div>
            ) : (
              notifications.map((n, i) => (
                <div key={i} className={`dn-card ${!n.read ? "unread" : ""}`}
                  onClick={() => {
                    if (n.type === "booking") switchTab("bookings");
                    if (n.type === "approved" || n.type === "rejected") switchTab("ambulance");
                  }}>
                  <div className="dn-card-top">
                    <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                      {!n.read && <div className="dn-unread-dot" />}
                      <div className="dn-card-title">{n.title}</div>
                    </div>
                    <div className="dn-card-time">{new Date(n.timestamp).toLocaleString("en-IN", { hour:"2-digit", minute:"2-digit", day:"numeric", month:"short" })}</div>
                  </div>
                  <div className="dn-card-msg">{n.message}</div>
                  {n.type === "booking" && <div style={{ marginTop:6, fontSize:11, color:"#E50914", fontWeight:600 }}>Tap to view booking →</div>}
                  {(n.type === "approved" || n.type === "rejected") && (
                    <div style={{ marginTop:6, fontSize:11, color: n.type==="approved"?"#00c853":"#ff4d5a", fontWeight:600 }}>
                      {n.type === "approved" ? "✅ Approved!" : "❌ Rejected"}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── AMBULANCE TAB ── */}
        {tab === "ambulance" && (
          <div className="dd-content">
            <div className="dd-amb-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Meri Ambulance</div>
                  <div className="dd-amb-number">{ambNumber}</div>
                </div>
                {ambulance && (
                  <span style={{ fontSize:10, fontWeight:700, padding:"4px 12px", borderRadius:20, color:sc.c, background:sc.bg, border:`1px solid ${sc.b}`, textTransform:"uppercase" }}>
                    {ambulance.status?.replace("_"," ")}
                  </span>
                )}
              </div>
              <div className="dd-amb-grid">
                <div className="dd-amb-field"><div className="dd-amb-flbl">Driver (You)</div><div className="dd-amb-fval">{driverName}</div></div>
                <div className="dd-amb-field"><div className="dd-amb-flbl">Contact</div><div className="dd-amb-fval">{driverPhone ? `+91 ${driverPhone}` : ambulance?.driver_contact || "—"}</div></div>
                <div className="dd-amb-field"><div className="dd-amb-flbl">Location</div><div className="dd-amb-fval">{ambulance?.location || "—"}</div></div>
                <div className="dd-amb-field"><div className="dd-amb-flbl">Model</div><div className="dd-amb-fval">{ambulance?.model || "—"}</div></div>
              </div>
            </div>
            {pendingReq && (
              <div className="dd-pending-banner">
                ⏳ Ambulance change request pending — Admin approve kare ka intezaar karo
                <br/><span style={{ fontSize:11, color:"#aaa" }}>{pendingReq.newAmbNumber} ke liye request bheji hai</span>
              </div>
            )}
            {!pendingReq && (
              <div className="dd-card">
                <div className="dd-card-title">🔄 Ambulance Change Request</div>
                <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>Doosri ambulance choose karo — admin approve karne ke baad change hogi.</div>
                <div className="dd-amb-list">
                  {allAmbs.filter(a => a.id !== ambId).map(a => {
                    const as = SC[a.status] || SC.offline;
                    return (
                      <div key={a.id} className={`dd-amb-item ${changeReqAmb?.id===a.id?"selected":""}`} onClick={() => setChangeReqAmb(a)}>
                        <div style={{ width:30, height:30, borderRadius:7, background:"rgba(229,9,20,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🚑</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div className="dd-amb-item-name">{a.ambulance_number}</div>
                          <div className="dd-amb-item-sub">{a.location||"—"}</div>
                        </div>
                        <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20, color:as.c, background:as.bg, border:`1px solid ${as.b}`, textTransform:"uppercase", flexShrink:0 }}>
                          {a.status?.replace("_"," ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button className="dd-btn dd-btn-red" disabled={!changeReqAmb} onClick={sendChangeRequest}>
                  {changeReqAmb ? `📤 Request Bhejo — ${changeReqAmb.ambulance_number}` : "Pehle ambulance select karo"}
                </button>
              </div>
            )}
          </div>
        )}


        {/* ── AMBULANCES TAB ── */}
        {tab === "ambulances" && (
          <div className="dd-content">
            <div style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>
              🚒 Sabhi Ambulances
              <span style={{ fontSize:12, fontWeight:500, color:"#555", marginLeft:8 }}>({allAmbs.length})</span>
            </div>
            {allAmbs.length === 0
              ? <div style={{ textAlign:"center", padding:"50px 0", color:"#333", fontSize:14 }}>
                  <div style={{ fontSize:44, marginBottom:10 }}>🚒</div>
                  Koi ambulance nahi mili
                </div>
              : allAmbs.map(a => {
                const as = SC[a.status] || SC.offline;
                const isMe = a.id === ambId;
                return (
                  <div key={a.id} className="dd-booking-card" style={{ border: isMe ? "1px solid rgba(229,9,20,0.4)" : "1px solid #222" }}>
                    <div className="dd-booking-top">
                      <div className="dd-booking-amb">
                        🚑 {a.ambulance_number}
                        {isMe && <span style={{ marginLeft:8, fontSize:9, fontWeight:700, background:"rgba(229,9,20,0.15)", color:"#E50914", border:"1px solid rgba(229,9,20,0.3)", borderRadius:6, padding:"2px 7px" }}>MERI</span>}
                      </div>
                      <span className="dd-booking-pill" style={{ color:as.c, background:as.bg, borderColor:as.b }}>{a.status?.replace("_"," ")}</span>
                    </div>
                    <div className="dd-booking-row">
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Driver</div><div className="dd-booking-val">{a.driver || "—"}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Location</div><div className="dd-booking-val">📍 {a.location || "—"}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Model</div><div className="dd-booking-val">{a.model || "—"}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Contact</div><div className="dd-booking-val">{a.driver_contact ? `+91 ${a.driver_contact}` : "—"}</div></div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ── HOSPITALS TAB ── */}
        {tab === "hospitals" && (
          <div className="dd-content">
            <div style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>
              🏥 Hospitals
              <span style={{ fontSize:12, fontWeight:500, color:"#555", marginLeft:8 }}>({allHospitals.length})</span>
            </div>
            {allHospitals.length === 0
              ? <div style={{ textAlign:"center", padding:"50px 0", color:"#333", fontSize:14 }}>
                  <div style={{ fontSize:44, marginBottom:10 }}>🏥</div>
                  Koi hospital nahi mila
                </div>
              : allHospitals.map(h => {
                const hsc = {
                  active:   { c:"#00d4aa", bg:"rgba(0,212,170,0.12)", b:"rgba(0,212,170,0.3)"  },
                  full:     { c:"#f7c948", bg:"rgba(247,201,72,0.12)", b:"rgba(247,201,72,0.3)" },
                  critical: { c:"#ff4d5a", bg:"rgba(229,9,20,0.12)",   b:"rgba(229,9,20,0.3)"   },
                  closed:   { c:"rgba(255,255,255,0.35)", bg:"rgba(255,255,255,0.05)", b:"rgba(255,255,255,0.1)" },
                }[h.status] || { c:"#888", bg:"rgba(255,255,255,0.05)", b:"rgba(255,255,255,0.1)" };
                return (
                  <div key={h.id} className="dd-booking-card">
                    <div className="dd-booking-top">
                      <div className="dd-booking-amb">🏥 {h.name}</div>
                      <span className="dd-booking-pill" style={{ color:hsc.c, background:hsc.bg, borderColor:hsc.b }}>{h.status}</span>
                    </div>
                    <div className="dd-booking-row">
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Address</div><div className="dd-booking-val">📍 {h.address || "—"}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Available Beds</div><div className="dd-booking-val">🛏 {h.available_beds ?? "—"}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Type</div><div className="dd-booking-val">{h.hospital_type || "—"}</div></div>
                      <div className="dd-booking-item"><div className="dd-booking-lbl">Contact</div><div className="dd-booking-val">{h.contact || "—"}</div></div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

      </div>

   
      <nav className="dd-bottom-nav">
        <div className="dd-bottom-nav-inner">
          {tabs.map(({ k, icon, shortLabel, count }) => (
            <div key={k} className={`dd-bnav-item ${tab===k?"active":""}`} onClick={() => switchTab(k)}>
              {count > 0 && <span className="dd-bnav-badge">{count}</span>}
              <span className="dd-bnav-icon">{icon}</span>
              <span className="dd-bnav-label">{shortLabel}</span>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
// DriverView.jsx — Driver GPS (Leaflet + Push Notifications)
// Place at: src/Pages/DriverView.jsx

import { useState, useEffect, useRef, useCallback } from "react";
import useLeaflet, { DARK_TILE, DELHI, makePinIcon } from "../hooks/useLeaflet";

const BASE          = "http://127.0.0.1:8000";
const PING_INTERVAL = 5000;

const card      = { background:"#181818", border:"1px solid #222", borderRadius:10, padding:12 };
const cardTitle = { fontWeight:700, fontSize:13, marginBottom:10 };
const inp       = { width:"100%", background:"#0d0d0d", border:"1px solid #2a2a2a", borderRadius:6, padding:"8px 10px", color:"#fff", fontSize:13, marginBottom:8, boxSizing:"border-box", outline:"none" };
const btn       = { width:"100%", border:"none", borderRadius:6, padding:10, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", marginTop:4 };
const logColors = { info:"#555", success:"#00c853", warn:"#ffaa00", error:"#f44336" };

// ✅ Request browser push notification permission
const requestNotifPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "Granted") return true;
  const result = await Notification.requestPermission();
  return result === "Granted";
};

// ✅ Show browser push notification
const sendPushNotif = (title, body) => {
  if (Notification.permission !== "granted") return;
  const notif = new Notification(title, {
    body,
    icon: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png",
    badge: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png",
    vibrate: [200, 100, 200],
    requireInteraction: true, // stays until user dismisses
  });
  // Auto close after 8 seconds
  setTimeout(() => notif.close(), 8000);
};

export default function DriverView() {
  const leafletReady = useLeaflet();

  const [email,        setEmail]        = useState(() => localStorage.getItem("Driver_email") || "");
  const [ambId,        setAmbId]        = useState(() => localStorage.getItem("Ambulance_id") || "");
  const [isOnline,     setIsOnline]     = useState(false);
  const [location,     setLocation]     = useState(null);
  const [speed,        setSpeed]        = useState(0);
  const [route,        setRoute]        = useState(null);
  const [log,          setLog]          = useState([]);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [notifAllowed, setNotifAllowed] = useState(Notification.permission === "Granted");

  const mapDivRef    = useRef(null);
  const mapObj       = useRef(null);
  const driverMarker = useRef(null);
  const routingRef   = useRef(null);
  const latestLoc    = useRef(null);
  const watchId      = useRef(null);
  const pingTimer    = useRef(null);

  const addLog = (msg, type = "Info") =>
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));

  // ✅ Ask notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "Default") {
      requestNotifPermission().then(allowed => setNotifAllowed(allowed));
    }
  }, []);

  // Init map
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    mapObj.current = L.map(mapDivRef.current, { center: [DELHI.lat, DELHI.lng], zoom: 14, zoomControl: false });
    L.tileLayer(DARK_TILE, { maxZoom: 19 }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    return () => { if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [leafletReady]);

  const startTracking = () => {
    if (!email.trim() || !ambId) { addLog("Enter Email and Ambulance ID to Begin.", "Error"); return; }
    if (!navigator.geolocation)  { addLog("GPS Not Supported ", "Error"); return; }
    localStorage.setItem("Driver_email", email);
    localStorage.setItem("Ambulance_id", ambId);
    setIsOnline(true);
    addLog("📍GPS Tracking Engaged - Proceed to Route", "Success");

    // ✅ Ask notif permission when tracking starts
    requestNotifPermission().then(allowed => {
      setNotifAllowed(allowed);
      if (allowed) addLog("🔔 Notifications Enabled", "Success");
    });

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        latestLoc.current = loc;
        setLocation(loc);
        setSpeed(Math.round((pos.coords.speed || 0) * 3.6));
        if (mapObj.current) {
          mapObj.current.panTo([loc.lat, loc.lng]);
          if (driverMarker.current) {
            driverMarker.current.setLatLng([loc.lat, loc.lng]);
          } else if (window.L) {
            driverMarker.current = window.L
              .marker([loc.lat, loc.lng], { icon: makePinIcon("#E50914", "🚑") })
              .addTo(mapObj.current)
              .bindPopup(`<div style="background:#1a1a1a;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700">📍 Aap yahan hain</div>`, { className: "sr-dark-popup" });
          }
        }
      },
      err => addLog(`GPS Error: ${err.message}`, "Error"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    sendPing();
    pingTimer.current = setInterval(sendPing, PING_INTERVAL);
  };

  const stopTracking = () => {
    if (watchId.current)   navigator.geolocation.clearWatch(watchId.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    watchId.current = pingTimer.current = null;
    setIsOnline(false);
    addLog("⏹ GPS Tracking Terminated", "warn");
  };

  const sendPing = useCallback(() => {
    const loc = latestLoc.current;
    const em  = localStorage.getItem("river_email");
    const aid = parseInt(localStorage.getItem("ambulance_id"));
    if (!loc || !em || !aid) return;

    fetch(`${BASE}/api/driver/ping/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_email: em, ambulance_id: aid, latitude: loc.lat, longitude: loc.lng, speed: 0 }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.pending_route) {
          setRoute(prev => {
            const nr = data.pending_route;
            if (!prev || prev.id !== nr.id || prev.status !== nr.status) {
              if (nr.status === "pending") {
                addLog("🗺 Admin Update: New Route Assigned", "success");

                // ✅ Browser push notification
                sendPushNotif(
                  "🚨 Naya Route Found!",
                  `Pickup: ${nr.pickup_location}\nDestination: ${nr.destination}\nDistance: ${nr.distance_km} · ETA: ${nr.duration}`
                );

                if (leafletReady && nr.pickup_location) drawLeafletRoute(nr);
              }
            }
            return nr;
          });
        }
      })
      .catch(() => addLog("Server Connection Failed", "error"));
  }, [leafletReady]);

  const geocode = async (addr) => {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr + ", Delhi, India")}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (!data.length) throw new Error(`"${addr}" nahi mila`);
    return window.L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
  };

  const drawLeafletRoute = async (r) => {
    if (!leafletReady || !mapObj.current || !latestLoc.current || !window.L) return;
    const L = window.L;
    if (routingRef.current) { try { mapObj.current.removeControl(routingRef.current); } catch {} routingRef.current = null; }

    try {
      const pickupLatLng = await geocode(r.pickup_location);
      const destLatLng   = await geocode(r.destination || "AIIMS Delhi");

      const routing = L.Routing.control({
        waypoints: [L.latLng(latestLoc.current.lat, latestLoc.current.lng), pickupLatLng, destLatLng],
        router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1", profile: "driving" }),
        lineOptions: {
          styles: [{ color: "#ff6d00", weight: 5, opacity: 0.9 }, { color: "#fff", weight: 2, opacity: 0.2 }],
          extendToWaypoints: true, missingRouteTolerance: 0,
        },
        show: false, addWaypoints: false, draggableWaypoints: false,
        fitSelectedRoutes: true, showAlternatives: false,
        createMarker: (i, wp) => {
          const icons = [null, makePinIcon("#f7c948", "📍"), makePinIcon("#00d4aa", "🏥")];
          if (!icons[i]) return false;
          return L.marker(wp.latLng, { icon: icons[i] }).addTo(mapObj.current);
        },
      }).addTo(mapObj.current);

      routingRef.current = routing;
      routing.on("routesfound", () => addLog("🗺 Route map pe dikh raha hai!", "success"));
    } catch (err) { addLog(`Route error: ${err.message}`, "error"); }
  };

  const respondRoute = async (newStatus) => {
    if (!route) return;
    try {
      const res  = await fetch(`${BASE}/api/driver/route/${route.id}/respond/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (newStatus === "completed") {
        setRoute(null);
        if (routingRef.current) { try { mapObj.current?.removeControl(routingRef.current); } catch {} routingRef.current = null; }
        addLog("🏁 Trip complete!", "success");
        sendPushNotif("🏁 Trip Complete!", "Journey Complete. Patient Safe. Ready for the Next Life.");
      } else {
        setRoute(data);
        if (newStatus === "Accepted") { addLog("✅ Route Is Accepted", "success"); sendPushNotif("✅ Route Accepted", `Pickup: ${route.pickup_location}`); }
        if (newStatus === "Rejected") {
          addLog("❌ Route Is Rejected", "Warning");
          if (routingRef.current) { try { mapObj.current?.removeControl(routingRef.current); } catch {} routingRef.current = null; }
        }
      }
    } catch { addLog("Route update error", "error"); }
  };

  useEffect(() => () => stopTracking(), []);

  const routeBorder = route?.status === "pending" ? "#ffaa00" : route?.status === "Accepted" ? "#00c853" : "#4fc3f7";

  return (
    <>
      <style>{`
        .dv-root { display:flex; flex-direction:column; height:100vh; margin-left:64px; width:calc(100vw - 64px); padding-top:56px; background:#0a0a0a; color:#fff; font-family:'Segoe UI',sans-serif; overflow:hidden; box-sizing:border-box; }
        .dv-header { background:#111; border-bottom:1px solid #1c1c1c; padding:10px 16px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
        .dv-body { display:flex; flex:1; overflow:hidden; min-height:0; }
        .dv-panel { width:290px; min-width:290px; background:#111; border-right:1px solid #1a1a1a; padding:12px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; flex-shrink:0; transition:transform 0.3s ease; }
        .dv-map { flex:1; position:relative; min-width:0; }
        .dv-panel-toggle { display:none; position:fixed; bottom:80px; right:16px; width:48px; height:48px; border-radius:50%; background:#E50914; border:none; color:#fff; font-size:20px; cursor:pointer; z-index:100; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(0,0,0,0.5); }
        .sr-dark-popup .leaflet-popup-content-wrapper { background:rgba(20,20,20,0.97)!important; border:1px solid rgba(255,255,255,0.1)!important; border-radius:10px!important; box-shadow:0 8px 32px rgba(0,0,0,0.8)!important; padding:0!important; }
        .sr-dark-popup .leaflet-popup-content { margin:0!important; }
        .sr-dark-popup .leaflet-popup-tip { background:rgba(20,20,20,0.97)!important; }
        .sr-dark-popup .leaflet-popup-close-button { color:rgba(255,255,255,0.4)!important; }
        .leaflet-control-zoom a { background:rgba(20,20,20,0.92)!important; color:#fff!important; border-color:rgba(255,255,255,0.1)!important; }
        .leaflet-control-zoom a:hover { background:rgba(40,40,40,0.95)!important; }
        .leaflet-routing-container { display:none!important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width:767px) {
          .dv-root { margin-left:0; width:100vw; padding-bottom:60px; }
          .dv-panel { position:fixed; left:0; top:56px; bottom:60px; z-index:50; width:280px; transform:translateX(-100%); }
          .dv-panel.open { transform:translateX(0); box-shadow:4px 0 20px rgba(0,0,0,0.6); }
          .dv-panel-toggle { display:flex; }
        }
      `}</style>

      <div className="dv-root">
        <div className="dv-header">
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>🚑</span>
            <div>
              <div style={{ fontWeight:700, fontSize:15 }}>Driver Dashboard</div>
              <div style={{ fontSize:10, color:"#444" }}>SwiftRescue GPS • Leaflet Maps</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* ✅ Notification status badge */}
            <div style={{ fontSize:10, color: notifAllowed?"#00c853":"#555", background: notifAllowed?"rgba(0,200,83,0.1)":"rgba(85,85,85,0.1)", border:`1px solid ${notifAllowed?"#00c853":"#555"}`, borderRadius:20, padding:"3px 10px" }}>
              {notifAllowed ? "🔔 Notifications Enabled" : "🔕 Notifications Disabled"}
            </div>
            <div style={{ background:isOnline?"#00c85322":"#55555522", border:`1px solid ${isOnline?"#00c853":"#555"}`, borderRadius:20, padding:"4px 12px", display:"flex", alignItems:"center", gap:6, color:isOnline?"#00c853":"#555", fontWeight:700, fontSize:11 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:isOnline?"#00c853":"#555", animation:isOnline?"Pulse 1.5s Infinite":"None" }} />
              {isOnline ? "LIVE" : "OFFLINE"}
            </div>
          </div>
        </div>

        <div className="dv-body">
          <div className={`dv-panel ${panelOpen ? "open" : ""}`}>

            <div style={card}>
              <div style={cardTitle}>🔐 Driver Info</div>
              <input style={inp} placeholder="Driver Email" value={email} disabled={isOnline} onChange={e => setEmail(e.target.value)} />
              <input style={inp} placeholder="Ambulance ID" type="number" value={ambId} disabled={isOnline} onChange={e => setAmbId(e.target.value)} />
              {!isOnline
                ? <button style={{ ...btn, background:"#00c853", color:"#000" }} onClick={startTracking}>▶ Start Tracking</button>
                : <button style={{ ...btn, background:"#e53935" }} onClick={stopTracking}>⏹Disable</button>
              }
              {/* ✅ Manual notif permission request */}
              {!notifAllowed && (
                <button style={{ ...btn, background:"#1a1a2e", border:"1px solid #333", color:"#aaa", fontSize:11, marginTop:6 }}
                  onClick={() => requestNotifPermission().then(a => setNotifAllowed(a))}>
                  🔔Enable Notifications 
                </button>
              )}
            </div>

            <div style={card}>
              <div style={cardTitle}>📡 Live Position</div>
              {[
                ["Latitude",  location?.lat?.toFixed(6) ?? "—"],
                ["Longitude", location?.lng?.toFixed(6) ?? "—"],
                ["Speed",     `${speed} km/h`],
                ["Status",    isOnline ? "Tracking" : "Offline"],
              ].map(([k, v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #1c1c1c" }}>
                  <span style={{ color:"#555", fontSize:12 }}>{k}</span>
                  <span style={{ color:"#00c853", fontSize:12, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>

            {/* ✅ Route card — prominent alert style */}
            {route && (
              <div style={{ ...card, border:`2px solid ${routeBorder}`, background:"#0f0f0f", animation: route.status==="Pending"?"Pulse Is Infinite":"None" }}>
                <div style={{ ...cardTitle, color: routeBorder, fontSize:14 }}>
                  {route.status === "Pending"  ? "🚨 Updated Route found!"  :
                   route.status === "Accepted" ? "🧭 Route Active"      : "🏁 Complete"}
                </div>
                <div style={{ fontSize:13, color:"#ccc", lineHeight:2, marginBottom:10 }}>
                  <div>📍 <b>Pickup:</b>   {route.pickup_location}</div>
                  <div>🏥 <b>Hospital:</b> {route.destination}</div>
                  <div>📏 <b>Distance:</b> {route.distance_km}</div>
                  <div>⏱ <b>ETA:</b>      {route.duration}</div>
                </div>
                {route.status === "Pending" && (
                  <div style={{ display:"flex", gap:8 }}>
                    <button style={{ ...btn, flex:1, background:"#00c853", color:"#000" }} onClick={() => respondRoute("Accepted")}>✅ Accept</button>
                    <button style={{ ...btn, flex:1, background:"#e53935" }} onClick={() => respondRoute("Rejected")}>❌ Reject</button>
                  </div>
                )}
                {route.status === "Accepted" && (
                  <button style={{ ...btn, background:"#00c853", color:"#000" }} onClick={() => respondRoute("Completed")}>🏁Complete Trip</button>
                )}
              </div>
            )}

            <div style={card}>
              <div style={cardTitle}>📋 Activity Drivers</div>
              <div style={{ maxHeight:200, overflowY:"Auto" }}>
                {log.length === 0 && <div style={{ color:"#333", fontSize:12 }}>No Activity Found </div>}
                {log.map((l, i) => (
                  <div key={i} style={{ fontSize:11, color:logColors[l.type], marginBottom:3 }}>
                    <span style={{ color:"#444" }}>{l.time} </span>{l.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="dv-map">
            <div ref={mapDivRef} style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }} />
            {!isOnline && (
              <div style={{ position:"absolute", inset:0, background:"#0a0a0add", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:2 }}>
                <div style={{ fontSize:52 }}>🚑</div>
                <div style={{ color:"#555", marginTop:12, fontSize:13 }}>Start Tracking to view map</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <button className="dv-panel-toggle" onClick={() => setPanelOpen(o => !o)}>
        {panelOpen ? "✕" : "☰"}
      </button>
    </>
  );
}
import Dashboard from "./Dashboard";
import Ambulances from "./Ambulances";

const Homepage = () => {
  const role = localStorage.getItem("role");
  return role === "admin" ? <Dashboard /> : <Ambulances />;
};

export default Homepage;
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const statusConfig = {
  active:   { label: "Active",   bg: "rgba(0,212,170,0.15)",   color: "#00d4aa", border: "rgba(0,212,170,0.35)"  },
  full:     { label: "Full",     bg: "rgba(247,201,72,0.15)",  color: "#f7c948", border: "rgba(247,201,72,0.35)" },
  critical: { label: "Critical", bg: "rgba(229,9,20,0.15)",    color: "#ff4d5a", border: "rgba(229,9,20,0.4)"   },
  closed:   { label: "Closed",   bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.15)" },
};

const statsConfig = [
  { label: "Total Hospitals", key: "total",    accent: "rgba(255,255,255,0.45)" },
  { label: "Active",          key: "active",   accent: "#00d4aa" },
  { label: "Critical",        key: "critical", accent: "#E50914" },
  { label: "Full",            key: "full",     accent: "#f7c948" },
];

const HOSP_IMG = "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80";

const Hospitals = () => {
  const [hospitals, setHospitals] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/hospitals/")
      .then(r => r.json()).then(setHospitals).catch(console.log);
  }, []);

  const getCount = (key) => {
    if (key === "total") return hospitals.length;
    return hospitals.filter(h => h.status === key).length;
  };

  const handleDirections = (h) => {
    navigate("/directions", {
      state: { hospital: { name: h.name, address: h.address, latitude: h.latitude, longitude: h.longitude } },
    });
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .hosp-root {
          background: var(--sr-bg, #0f0f0f);
          color: var(--sr-page-text, #fff);
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          min-height: 100vh;
          /* Desktop: topnav 56px + left sidebar 64px */
          padding-top: 56px;
          padding-left: 64px;
          transition: background 0.3s, color 0.2s;
        }
        .hosp-content { max-width: 1200px; margin: 0 auto; padding: 40px 32px 64px; }
        .hosp-header { margin-bottom: 28px; }
        .hosp-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #E50914; background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.3); border-radius: 100px; padding: 4px 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .hosp-header h1 { font-size: 28px; font-weight: 800; color: var(--sr-page-text, #fff); margin-bottom: 4px; letter-spacing: -0.5px; }
        .hosp-header p  { font-size: 13px; color: var(--sr-page-text-sub, rgba(255,255,255,0.35)); }

        .hosp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 40px; }
        .hosp-stat { background: var(--sr-stat-bg, #1a1a1a); border: 1px solid var(--sr-border, rgba(255,255,255,0.07)); border-radius: 10px; padding: 18px 20px; position: relative; overflow: hidden; }
        .hosp-stat-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 10px 10px 0 0; }
        .hosp-stat-label { font-size: 10px; font-weight: 600; color: var(--sr-text-sub); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 8px; }
        .hosp-stat-value { font-size: 32px; font-weight: 800; color: var(--sr-text, #fff); line-height: 1; letter-spacing: -1px; }

        .hosp-section-title { font-size: 18px; font-weight: 700; color: var(--sr-page-text, #fff); margin-bottom: 16px; }

        .hosp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .hosp-card { border-radius: 16px; overflow: hidden; position: relative; background: #1a1a1a; cursor: pointer; aspect-ratio: 16 / 9; transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .hosp-card:hover { transform: scale(1.02); box-shadow: 0 24px 64px rgba(0,0,0,0.85); z-index: 2; }
        .hosp-card-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: right center; filter: brightness(0.45) saturate(0.7); transition: filter 0.25s ease, transform 0.25s ease; }
        .hosp-card:hover .hosp-card-img { filter: brightness(0.6) saturate(1.1); transform: scale(1.04); }
        .hosp-card-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.80) 38%, rgba(10,10,10,0.35) 65%, rgba(0,0,0,0.05) 100%); }
        .hosp-card-bottom-fade { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 45%); }
        .hosp-card-body { position: absolute; inset: 0; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; }
        .hosp-card-top-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .hosp-card-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; background: rgba(20,20,20,0.75); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); }
        .hosp-card-tag-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .hosp-status-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; border: 1px solid; }
        .hosp-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .hosp-card-bottom { display: flex; flex-direction: column; gap: 6px; }
        .hosp-genre-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .hosp-genre-pill { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 100px; padding: 4px 12px; }
        .hosp-card-title { font-size: 18px; font-weight: 900; color: #fff; line-height: 1.15; letter-spacing: -0.4px; text-shadow: 0 2px 12px rgba(0,0,0,0.9); }
        .hosp-card-desc { font-size: 11px; color: rgba(255,255,255,0.4); line-height: 1.5; max-width: 80%; }
        .hosp-action-row { display: flex; align-items: center; gap: 10px; }
        .hosp-btn-directions { display: flex; align-items: center; gap: 6px; background: #fff; color: #111; border: none; border-radius: 100px; padding: 7px 16px; font-size: 11px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s, transform 0.15s; white-space: nowrap; }
        .hosp-btn-directions:hover { background: #e5e5e5; transform: translateY(-1px); }
        .hosp-stat-bar-row { display: flex; gap: 16px; padding-top: 8px; border-top: 0.5px solid rgba(255,255,255,0.1); flex-wrap: wrap; }
        .hosp-stat-item { display: flex; flex-direction: column; gap: 2px; }
        .hosp-stat-val { font-size: 13px; font-weight: 800; color: #fff; }
        .hosp-stat-lbl { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.28); letter-spacing: 0.6px; text-transform: uppercase; }
        .hosp-card-loc { position: absolute; bottom: 12px; right: 12px; display: flex; align-items: center; gap: 4px; max-width: 140px; }
        .hosp-card-loc-text { font-size: 10px; color: rgba(255,255,255,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .hosp-footer { text-align: center; font-size: 12px; color: var(--sr-page-text-muted, rgba(255,255,255,0.15)); border-top: 1px solid var(--sr-border, rgba(255,255,255,0.06)); padding: 20px 24px; margin-top: 40px; }

        /* ── DESKTOP MEDIUM ── */
        @media (max-width: 900px) {
          .hosp-grid { grid-template-columns: 1fr; }
          .hosp-stats { grid-template-columns: repeat(2, 1fr); }
          .hosp-content { padding: 24px 16px 40px; }
        }

        /* ── MOBILE ── */
        @media (max-width: 767px) {
          .hosp-root {
            padding-left: 0 !important;        /* Left sidebar mobile pe nahi hota */
            padding-top: 56px !important;       /* Topnavbar height */
            padding-bottom: 70px !important;    /* Bottom nav ke liye space */
          }
          .hosp-content { padding: 20px 12px 24px; }

          /* Stats: 2x2 grid, chhote */
          .hosp-stats {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 24px;
          }
          .hosp-stat { padding: 12px 14px; }
          .hosp-stat-value { font-size: 24px; }
          .hosp-stat-label { font-size: 9px; }

          /* Header */
          .hosp-header { margin-bottom: 18px; }
          .hosp-header h1 { font-size: 20px; }
          .hosp-header p { font-size: 12px; }

          /* Cards: full width, taller aspect ratio for readability */
          .hosp-grid { grid-template-columns: 1fr; gap: 14px; }
          .hosp-card { aspect-ratio: 4 / 3; border-radius: 12px; }
          .hosp-card-body { padding: 12px 14px; }
          .hosp-card-title { font-size: 16px; }
          .hosp-card-desc { font-size: 10px; max-width: 100%; }

          /* Status pill & tag: chhote */
          .hosp-card-tag { font-size: 9px; padding: 3px 9px; }
          .hosp-status-pill { font-size: 9px; padding: 3px 9px; }
          .hosp-genre-pill { font-size: 9px; padding: 3px 9px; }

          /* Bed stats: wrap gracefully */
          .hosp-stat-bar-row { gap: 10px; padding-top: 6px; }
          .hosp-stat-val { font-size: 12px; }
          .hosp-stat-lbl { font-size: 8px; }

          /* Directions button */
          .hosp-btn-directions { padding: 6px 14px; font-size: 11px; }

          /* Location text */
          .hosp-card-loc { bottom: 8px; right: 8px; max-width: 120px; }
          .hosp-card-loc-text { font-size: 9px; }

          .hosp-section-title { font-size: 15px; margin-bottom: 12px; }
        }

        @media (max-width: 380px) {
          .hosp-stats { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .hosp-stat-value { font-size: 20px; }
          .hosp-card { aspect-ratio: 3 / 2; }
          .hosp-card-title { font-size: 14px; }
        }
      `}</style>

      <div className="hosp-root">
        <div className="hosp-content">
          <div className="hosp-header">
            <div className="hosp-tag"><span style={{ fontSize: 11 }}>🏥</span> Network</div>
            <h1>Hospital Network</h1>
            <p>Real-time bed availability and emergency capacity</p>
          </div>

          <div className="hosp-stats">
            {statsConfig.map((s) => (
              <div key={s.key} className="hosp-stat">
                <div className="hosp-stat-bar" style={{ background: s.accent }} />
                <div className="hosp-stat-label">{s.label}</div>
                <div className="hosp-stat-value">{String(getCount(s.key)).padStart(2, "0")}</div>
              </div>
            ))}
          </div>

          <div className="hosp-section-title">Hospital Directory</div>

          <div className="hosp-grid">
            {hospitals.map((h, i) => {
              const normalized = h.status?.toLowerCase().replace(/[\s-]+/g, '_');
              const sc = statusConfig[normalized] || statusConfig.closed;
              return (
                <div key={i} className="hosp-card">
                  <img className="hosp-card-img" src={HOSP_IMG} alt="hospital" />
                  <div className="hosp-card-overlay" />
                  <div className="hosp-card-bottom-fade" />
                  <div className="hosp-card-body">
                    <div className="hosp-card-top-row">
                      <div className="hosp-card-tag">
                        <span className="hosp-card-tag-dot" style={{ background: "#00d4aa" }} />
                        Unit #{String(i + 1).padStart(2, "0")}
                      </div>
                      <span className="hosp-status-pill" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                        <span className="hosp-status-dot" style={{ background: sc.color }} />
                        {sc.label}
                      </span>
                    </div>
                    <div className="hosp-card-bottom">
                      <div className="hosp-genre-row">
                        {h.specialization
                          ? h.specialization.split(",").slice(0, 2).map((s, j) => <span key={j} className="hosp-genre-pill">{s.trim()}</span>)
                          : <span className="hosp-genre-pill">General</span>
                        }
                        {h.eta_minutes && <span className="hosp-genre-pill">{h.eta_minutes} MIN ETA</span>}
                      </div>
                      <div className="hosp-card-title">{h.name}</div>
                      <div className="hosp-card-desc">{h.address}</div>
                      <div className="hosp-action-row">
                        <button className="hosp-btn-directions" onClick={() => handleDirections(h)}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          Directions
                        </button>
                      </div>
                      <div className="hosp-stat-bar-row">
                        {[
                          { label: "Total Beds", val: h.total_beds },
                          { label: "Available",  val: h.available_beds },
                          { label: "ICU Beds",   val: h.icu_beds },
                        ].map((s, j) => (
                          <div key={j} className="hosp-stat-item">
                            <div className="hosp-stat-val">{s.val ?? "—"}</div>
                            <div className="hosp-stat-lbl">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="hosp-card-loc">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="#E50914" style={{ flexShrink: 0 }}>
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <span className="hosp-card-loc-text">{h.address}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <footer className="hosp-footer">© {new Date().getFullYear()} SwiftRescue. All rights reserved.</footer>
      </div>
    </>
  );
};

export default Hospitals;
import { useState } from "react";
import RealTimeMap from "../Components/RealTimeMap";
import AdminRouteManager from "../Components/AdminRouteManager";

const TABS = [
  { id: "map",   label: "🗺 Live Tracking Map" },
  { id: "route", label: "🛣 Route Manager"      },
];

export default function LiveMap() {
  const [activeTab,      setActiveTab]      = useState("map");
  const [selectedDriver, setSelectedDriver] = useState(null);

  const handleDriverSelect = (driver) => {
    setSelectedDriver(driver);
    setActiveTab("route");
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        .lm-root {
          margin-left: 64px;
          width: calc(100vw - 64px);
          height: 100vh;
          padding-top: 56px;
          display: flex;
          flex-direction: column;
          background: #0a0a0a;
          color: #fff;
          font-family: 'Segoe UI', sans-serif;
          overflow: hidden;
        }
        .lm-header {
          background: #111;
          border-bottom: 1px solid #1c1c1c;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          gap: 8px;
          flex-wrap: wrap;
        }
        .lm-header-left {
          display: flex; align-items: center; gap: 10px; min-width: 0;
        }
        .lm-header-title { font-weight: 700; font-size: 15px; white-space: nowrap; }
        .lm-header-sub   { font-size: 11px; color: #555; margin-top: 1px; }
        .lm-live-badge {
          display: flex; align-items: center; gap: 6px;
          background: rgba(0,200,83,0.13); border: 1px solid rgba(0,200,83,0.27);
          border-radius: 20px; padding: 5px 12px;
          color: #00c853; font-weight: 700; font-size: 11px; flex-shrink: 0;
        }
        .lm-tabs {
          background: #111; border-bottom: 1px solid #1c1c1c;
          padding: 0 12px; display: flex; align-items: center;
          flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
        }
        .lm-tabs::-webkit-scrollbar { display: none; }
        .lm-tab-btn {
          background: none; border: none; border-bottom: 2px solid transparent;
          padding: 10px 12px; color: #555; font-weight: 400; font-size: 13px;
          cursor: pointer; display: flex; align-items: center; gap: 6px;
          white-space: nowrap; flex-shrink: 0; transition: color 0.15s;
        }
        .lm-tab-btn.active { border-bottom-color: #e50914; color: #fff; font-weight: 700; }
        .lm-selected-info {
          margin-left: auto; display: flex; align-items: center;
          gap: 6px; flex-shrink: 0; padding-left: 8px;
        }
        .lm-content {
          flex: 1; min-height: 0; overflow: hidden; position: relative;
        }
        .lm-pane {
          position: absolute; inset: 0; display: flex;
        }

        /* ── Tablet ── */
        @media (max-width: 1024px) {
          .lm-root { margin-left: 64px; width: calc(100vw - 64px); }
        }

        /* ── Mobile ── */
        @media (max-width: 767px) {
          .lm-root {
            margin-left: 0;
            width: 100vw;
            height: calc(100vh - 60px);
            padding-top: 56px;
          }
          .lm-header { padding: 8px 12px; }
          .lm-header-sub { display: none; }
          .lm-header-title { font-size: 13px; }
          .lm-live-badge { padding: 4px 10px; font-size: 10px; }
          .lm-tab-btn { font-size: 12px; padding: 8px 10px; }
          .lm-selected-info .lm-sel-label { display: none; }

          /* ✅ KEY FIX: pane flex-direction column — panel upar, map neeche */
          .lm-pane {
            flex-direction: column;
            overflow-y: auto;
          }

          /* RealTimeMap ke andar ka panel aur map — mobile layout */
          .lm-pane > * {
            width: 100% !important;
            min-width: unset !important;
          }
        }

        @media (max-width: 480px) {
          .lm-header-title { font-size: 12px; }
          .lm-tab-btn { font-size: 11px; padding: 8px 8px; }
        }
      `}</style>

      <div className="lm-root">

        {/* Header */}
        <div className="lm-header">
          <div className="lm-header-left">
            <span style={{ fontSize: 22, flexShrink: 0 }}>📡</span>
            <div style={{ minWidth: 0 }}>
              <div className="lm-header-title">Live Command Center</div>
              <div className="lm-header-sub">Real-time driver tracking & route management</div>
            </div>
          </div>
          <div className="lm-live-badge">
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c853", boxShadow: "0 0 8px #00c853" }} />
            LIVE
          </div>
        </div>

        {/* Tabs */}
        <div className="lm-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`lm-tab-btn ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              {t.id === "route" && selectedDriver && (
                <span style={{
                  background: "#e5091422", color: "#e50914",
                  border: "1px solid #e5091444",
                  borderRadius: 10, padding: "1px 7px",
                  fontSize: 10, fontWeight: 700,
                }}>
                  {selectedDriver.ambulance_number}
                </span>
              )}
            </button>
          ))}

          {selectedDriver && (
            <div className="lm-selected-info">
              <span className="lm-sel-label" style={{ color: "#555", fontSize: 11 }}>Selected:</span>
              <span style={{
                background: "#00c85322", color: "#00c853",
                border: "1px solid #00c85344",
                borderRadius: 10, padding: "2px 9px",
                fontSize: 11, fontWeight: 700,
              }}>
                {selectedDriver.ambulance_number}
              </span>
              <button
                onClick={() => setSelectedDriver(null)}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Content — tabs use display instead of visibility to force map reflow */}
        <div className="lm-content">
          <div className="lm-pane" style={{
            display: activeTab === "map" ? "flex" : "none",
            zIndex: activeTab === "map" ? 1 : 0,
          }}>
            <RealTimeMap onSelectDriver={handleDriverSelect} />
          </div>
          <div className="lm-pane" style={{
            display: activeTab === "route" ? "flex" : "none",
            zIndex: activeTab === "route" ? 1 : 0,
          }}>
            <AdminRouteManager preSelectedDriver={selectedDriver} />
          </div>
        </div>
      </div>
    </>
  );
}
/**
 * LiveTracking.jsx  — /LiveTracking
 * Dedicated page for user's live ambulance tracking.
 * Sidebar ka 4th item (user nav) yahan navigate karta hai.
 * Booking confirmed ho to map dikhao, warna "no active booking" screen.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import UserBookingMap from "../Components/UserBookingMap";

const BASE = "http://127.0.0.1:8000";

export default function LiveTracking() {
  const [booking,  setBooking]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [noActive, setNoActive] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const email    = localStorage.getItem("user") || "";
  const name     = localStorage.getItem("name") || "";

  const fetchConfirmed = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE}/api/bookings/`);
      const data = await res.json();
      const confirmed = data.find(b =>
        (b.booked_by_email === email || b.user_email === email || b.booked_by === name) &&
        b.status === "confirmed"
      );
      if (confirmed) {
        setBooking(confirmed);
        setNoActive(false);
      } else {
        setBooking(null);
        setNoActive(true);
      }
    } catch {
      setNoActive(true);
    }
    setLoading(false);
  }, [email, name]);

  useEffect(() => {
    // MyBookings se bookingId pass ho sakta hai state mein
    const passedBookingId = location.state?.bookingId;

    fetchConfirmed().then(() => {
      // Agar specific booking pass ki gayi, use prefer karo
      if (passedBookingId) {
        setBooking(prev => prev?.id === passedBookingId ? prev : prev);
      }
    });

    const t = setInterval(fetchConfirmed, 8000);
    return () => clearInterval(t);
  }, [fetchConfirmed]);

  return (
    <>
      <style>{`
        .lt-root {
          position: fixed;
          top: 56px;
          left: 64px;
          right: 0;
          bottom: 0;
          background: #0a0a0a;
          display: flex;
          flex-direction: column;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          overflow: hidden;
        }

        /* Top bar */
        .lt-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: #111;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0;
          gap: 12px;
          flex-wrap: wrap;
        }
        .lt-topbar-left { display:flex; align-items:center; gap:12px; }
        .lt-back-btn {
          width: 34px; height: 34px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50%;
          color: rgba(255,255,255,0.6);
          cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .lt-back-btn:hover { background:rgba(255,255,255,0.13); color:#fff; }
        .lt-title { font-size:16px; font-weight:800; color:#fff; }
        .lt-sub   { font-size:11px; color:rgba(255,255,255,0.35); margin-top:2px; }

        /* Live pulse badge */
        @keyframes lt-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }
        .lt-live-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #00d4aa; flex-shrink: 0;
          animation: lt-pulse 1.5s infinite;
          box-shadow: 0 0 8px rgba(0,212,170,0.7);
        }
        .lt-mybookings-btn {
          background: rgba(229,9,20,0.1);
          border: 1px solid rgba(229,9,20,0.25);
          color: #E50914;
          border-radius: 10px;
          padding: 7px 14px;
          font-size: 11px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .lt-mybookings-btn:hover { background:rgba(229,9,20,0.18); }

        /* Map fills remaining space */
        .lt-map-wrap {
          flex: 1;
          position: relative;
          overflow: hidden;
          min-height: 0;
        }

        /* Override UserBookingMap to be fully inline */
        .lt-map-wrap .ubm-overlay {
          position: absolute !important;
          background: transparent !important;
          backdrop-filter: none !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
        }
        .lt-map-wrap .ubm-sheet {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          border-radius: 0 !important;
        }
        @media (min-width:768px) {
          .lt-map-wrap .ubm-overlay { justify-content:stretch !important; }
          .lt-map-wrap .ubm-sheet   { width:100% !important; max-height:100% !important; }
        }

        /* Hide the close button inside ubm-sheet since we have our own back btn */
        .lt-map-wrap .ubm-close { display: none !important; }

        /* Loading / No Booking state */
        .lt-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px;
          text-align: center;
        }

        @keyframes lt-spin { to { transform: rotate(360deg); } }

        /* Mobile responsive */
        @media (max-width: 767px) {
          .lt-root {
            top: 56px;
            left: 0;    /* sidebar hidden on mobile */
            bottom: 60px; /* bottom nav height */
          }
          .lt-topbar { padding:10px 14px; }
          .lt-title  { font-size:14px; }
        }
        @media (max-width: 480px) {
          .lt-topbar { padding:8px 12px; }
        }
      `}</style>

      <div className="lt-root">

        {/* ── Top Bar ── */}
        <div className="lt-topbar">
          <div className="lt-topbar-left">
            <button className="lt-back-btn" onClick={() => navigate("/MyBookings")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {booking && <span className="lt-live-dot" />}
                <div className="lt-title">🚑 Live Tracking</div>
              </div>
              <div className="lt-sub">
                {booking
                  ? `Booking #${booking.id} · ${booking.ambulance_number || "—"}`
                  : "Koi active booking nahi"}
              </div>
            </div>
          </div>

          {/* My Bookings shortcut button */}
          <button className="lt-mybookings-btn" onClick={() => navigate("/MyBookings")}>
            📋 My Bookings
          </button>
        </div>

        {/* ── Content ── */}
        {loading && (
          <div className="lt-center">
            <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,0.08)", borderTop:"3px solid #E50914", borderRadius:"50%", animation:"lt-spin 0.8s linear infinite" }} />
            <p style={{ color:"rgba(255,255,255,0.35)", fontSize:13 }}>Booking dhundh raha hai...</p>
          </div>
        )}

        {!loading && noActive && !booking && (
          <div className="lt-center">
            <div style={{ fontSize:64, opacity:0.25 }}>🚑</div>
            <div style={{ fontSize:18, fontWeight:800, color:"rgba(255,255,255,0.5)" }}>
              Koi active booking nahi
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.25)", maxWidth:300 }}>
              Jab aapki booking confirm ho jayegi, yahan live ambulance tracking dikhegi.
            </div>
            <button
              onClick={() => navigate("/Ambulances")}
              style={{ marginTop:8, background:"#E50914", color:"#fff", border:"none", borderRadius:12, padding:"11px 24px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(229,9,20,0.35)" }}
            >
              🚑 Ambulance Book Karo
            </button>
          </div>
        )}

        {!loading && booking && (
          <div className="lt-map-wrap">
            <UserBookingMap
              booking={booking}
              onClose={() => navigate("/MyBookings")}
            />
          </div>
        )}

      </div>
    </>
  );
}
import { UserPlus, ChevronsRight, Mail, ArrowLeft, Truck, Shield, User, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_EMAILS = [
  "vashupanchal.cs@gmail.com",
];

const RoleCard = ({ icon: Icon, title, desc, color, selected, onClick }) => (
  <button type="button" onClick={onClick} style={{
    flex: 1, padding: "14px 8px", borderRadius: 10, cursor: "pointer",
    border: `1.5px solid ${selected ? color : "rgba(255,255,255,0.09)"}`,
    background: selected ? `${color}14` : "rgba(255,255,255,0.02)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
    transition: "all 0.15s", fontFamily: "inherit",
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: selected ? `${color}20` : "rgba(255,255,255,0.05)",
      border: `1px solid ${selected ? color + "50" : "rgba(255,255,255,0.09)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: selected ? color : "rgba(255,255,255,0.35)",
    }}>
      <Icon size={16} />
    </div>
    <div style={{ fontSize: 11, fontWeight: 800, color: selected ? color : "rgba(255,255,255,0.6)", letterSpacing: "0.3px" }}>
      {title}
    </div>
    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.4 }}>
      {desc}
    </div>
  </button>
);

const Login = () => {
  const navigate = useNavigate();

  const [role,        setRole]        = useState("user");
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [emailOtp,    setEmailOtp]    = useState("");
  const [step,        setStep]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [ambulances,  setAmbulances]  = useState([]);
  const [selectedAmb, setSelectedAmb] = useState(null);
  const [ambLoading,  setAmbLoading]  = useState(false);

  const totalSteps = role === "driver" ? 3 : 2;

  useEffect(() => {
    if (role !== "driver") return;
    setAmbLoading(true);
    fetch("http://127.0.0.1:8000/api/ambulances/")
      .then(r => r.json())
      .then(data => { setAmbulances(data); setAmbLoading(false); })
      .catch(() => setAmbLoading(false));
  }, [role]);

  // ── Step 1 → 2: Send email OTP ──────────────────────────────────────────
  const sendEmailOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (role === "driver" && phone.length !== 10) {
      alert("10-digit phone number daalo"); return;
    }
    setLoading(true);
    try {
      // ✅ credentials: "include" hataya — CORS issue fix
      const res  = await fetch("http://127.0.0.1:8000/api/send-otp/", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.status === "otp_sent") {
        setStep(2);
      } else {
        alert(data.message || "OTP send nahi hua");
      }
    } catch (err) {
      alert("Server se connect nahi ho paya. Django server chal raha hai?");
      console.error("[OTP] Error:", err);
    }
    setLoading(false);
  };

  // ── Step 2: Verify email OTP ─────────────────────────────────────────────
  const verifyEmailOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // ✅ credentials: "include" hataya
      const res  = await fetch("http://127.0.0.1:8000/api/verify-otp/", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ otp: emailOtp, email }),
      });
      const data = await res.json();
      if (data.status === "success") {
        const finalRole = ADMIN_EMAILS.includes(data.email) ? "admin" : role;
        localStorage.setItem("user", data.email);
        localStorage.setItem("name", name);
        localStorage.setItem("role", finalRole);

        if (finalRole === "driver") {
          localStorage.setItem("phone", phone);
          setStep(3);
        } else {
          navigate("/");
        }
      } else {
        alert(data.message || "Invalid OTP");
      }
    } catch (err) {
      alert("Server se connect nahi ho paya.");
      console.error("[Verify OTP] Error:", err);
    }
    setLoading(false);
  };

  // ── Step 3: Ambulance confirm ────────────────────────────────────────────
  const confirmAmbulance = async () => {
    if (!selectedAmb) return;
    localStorage.setItem("ambulance_id",     String(selectedAmb.id));
    localStorage.setItem("ambulance_number", selectedAmb.ambulance_number);

    try {
      await fetch(`http://127.0.0.1:8000/api/ambulances/${selectedAmb.id}/`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          driver:         name,
          driver_contact: phone,
          driver_email:   email,
        }),
      });
    } catch {}

    navigate("/");
  };

  const roleColor = { user: "#3d8bff", driver: "#f7c948", admin: "#E50914" };

  return (
    <>
      <style>{`
        .nf-root { min-height: 100vh; background: var(--sr-bg, #111); display: flex; flex-direction: column; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; transition: background 0.3s; }
        .nf-nav { padding: 16px 40px; display: flex; align-items: center; border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.07)); }
        .nf-logo { font-size: 20px; font-weight: 900; color: #E50914; letter-spacing: 2px; text-transform: uppercase; }
        .nf-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 36px 20px; }
        .nf-card { background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border, rgba(255,255,255,0.09)); border-radius: 14px; padding: 36px 44px; width: 100%; max-width: 480px; }
        .nf-step-badge { font-size: 11px; color: rgba(255,255,255,0.3); margin-bottom: 6px; }
        .nf-step-badge span { color: #fff; font-weight: 700; }
        .nf-step-bar { display: flex; gap: 4px; margin-bottom: 28px; }
        .nf-pip { height: 3px; flex: 1; border-radius: 2px; background: rgba(255,255,255,0.08); transition: background 0.3s; }
        .nf-pip.active { background: #E50914; }
        .nf-pip.done   { background: rgba(229,9,20,0.4); }
        .nf-icon-wrap { width: 48px; height: 48px; border-radius: 50%; background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.28); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
        .nf-title    { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 6px; }
        .nf-subtitle { font-size: 13px; color: rgba(255,255,255,0.38); margin: 0 0 22px; line-height: 1.6; }
        .nf-subtitle strong { color: rgba(255,255,255,0.75); font-weight: 600; }
        .nf-form { display: flex; flex-direction: column; gap: 12px; }
        .nf-role-row { display: flex; gap: 7px; margin-bottom: 4px; }
        .nf-input-group { display: flex; flex-direction: column; gap: 4px; }
        .nf-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.28); letter-spacing: 0.8px; text-transform: uppercase; }
        .nf-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px 14px; font-size: 14px; color: #fff; font-family: inherit; outline: none; transition: border-color 0.2s; width: 100%; box-sizing: border-box; }
        .nf-input::placeholder { color: rgba(255,255,255,0.16); }
        .nf-input:focus { border-color: rgba(229,9,20,0.5); background: rgba(229,9,20,0.03); }
        .nf-phone-wrap { display: flex; gap: 8px; }
        .nf-phone-prefix { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px 14px; font-size: 14px; color: rgba(255,255,255,0.5); font-family: inherit; width: 72px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .nf-otp-info { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 11px 13px; font-size: 12px; color: rgba(255,255,255,0.38); display: flex; align-items: center; gap: 8px; }
        .nf-otp-info strong { color: rgba(255,255,255,0.75); font-weight: 600; }
        .nf-btn { padding: 13px; border-radius: 8px; border: none; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; transition: all 0.15s; width: 100%; }
        .nf-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .nf-btn-red { background: #E50914; color: #fff; }
        .nf-btn-red:hover:not(:disabled) { background: #f40612; }
        .nf-btn-ghost { background: transparent; color: rgba(255,255,255,0.38); border: 1px solid rgba(255,255,255,0.1); font-weight: 600; }
        .nf-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.65); }
        .nf-back { background: none; border: none; color: rgba(255,255,255,0.28); font-size: 11px; font-family: inherit; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 0; }
        .nf-back:hover { color: rgba(255,255,255,0.55); }
        .nf-verified-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: #00c853; background: rgba(0,200,83,0.1); border: 1px solid rgba(0,200,83,0.25); border-radius: 20px; padding: 4px 12px; }
        .amb-list { display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto; }
        .amb-list::-webkit-scrollbar { width: 3px; }
        .amb-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .amb-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: 1.5px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.15s; }
        .amb-item:hover    { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.14); }
        .amb-item.selected { background: rgba(247,201,72,0.07); border-color: rgba(247,201,72,0.38); }
        .amb-icon   { width: 32px; height: 32px; border-radius: 7px; background: rgba(229,9,20,0.1); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .amb-name   { font-size: 13px; font-weight: 700; color: #fff; }
        .amb-sub    { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 1px; }
        .amb-status { margin-left: auto; font-size: 8px; font-weight: 800; padding: 2px 8px; border-radius: 100px; text-transform: uppercase; flex-shrink: 0; }
        .s-available { background: rgba(0,212,170,0.1);  color: #00d4aa; border: 1px solid rgba(0,212,170,0.22); }
        .s-busy      { background: rgba(229,9,20,0.1);   color: #ff4d5a; border: 1px solid rgba(229,9,20,0.22); }
        .s-en_route  { background: rgba(247,201,72,0.1); color: #f7c948; border: 1px solid rgba(247,201,72,0.22); }
        .s-offline   { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.28); border: 1px solid rgba(255,255,255,0.09); }
        .nf-footer { padding: 14px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.12); border-top: 1px solid rgba(255,255,255,0.05); }
      `}</style>

      <div className="nf-root">
        <nav className="nf-nav">
          <div className="nf-logo">🚑 SwiftRescue</div>
        </nav>

        <div className="nf-body">
          <div className="nf-card">

            <div className="nf-step-badge">Step <span>{step}</span> of <span>{totalSteps}</span></div>
            <div className="nf-step-bar">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`nf-pip ${step===i+1?"active":step>i+1?"done":""}`} />
              ))}
            </div>

            {/* ══ Step 1: Role + Details ══ */}
            {step === 1 && (
              <>
                <div className="nf-icon-wrap" style={{ background:`${roleColor[role]}18`, borderColor:`${roleColor[role]}40` }}>
                  <UserPlus size={20} color={roleColor[role]} />
                </div>
                <h1 className="nf-title">Welcome back</h1>
                <p className="nf-subtitle">Role choose karo aur login karo</p>

                <form onSubmit={sendEmailOtp} className="nf-form">
                  <div>
                    <div className="nf-label" style={{ marginBottom: 8 }}>Aap kaun hain?</div>
                    <div className="nf-role-row">
                      <RoleCard icon={User}   title="User"   desc="Book ambulances" color="#3d8bff" selected={role==="user"}   onClick={() => setRole("user")} />
                      <RoleCard icon={Truck}  title="Driver" desc="Navigate routes"  color="#f7c948" selected={role==="driver"} onClick={() => setRole("driver")} />
                      <RoleCard icon={Shield} title="Admin"  desc="Manage fleet"     color="#E50914" selected={role==="admin"}  onClick={() => setRole("admin")} />
                    </div>
                  </div>

                  <div className="nf-input-group">
                    <label className="nf-label">Aapka Naam</label>
                    <input className="nf-input" type="text" required value={name}
                      onChange={e => setName(e.target.value)} placeholder="Rahul Sharma" />
                  </div>

                  <div className="nf-input-group">
                    <label className="nf-label">Email</label>
                    <input className="nf-input" type="email" required value={email}
                      onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>

                  {role === "driver" && (
                    <div className="nf-input-group">
                      <label className="nf-label">📱 Phone Number</label>
                      <div className="nf-phone-wrap">
                        <div className="nf-phone-prefix">+91</div>
                        <input className="nf-input" type="tel" required value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
                          placeholder="9876543210" maxLength={10} style={{ flex:1 }} />
                      </div>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:3 }}>
                        Yeh number driver dashboard aur ambulance card mein show hoga
                      </div>
                    </div>
                  )}

                  <button className="nf-btn nf-btn-red" disabled={loading}>
                    {loading ? "OTP bhej raha hoon..." : "OTP Send Karo →"}
                  </button>
                </form>
              </>
            )}

            {/* ══ Step 2: Email OTP ══ */}
            {step === 2 && (
              <>
                <div className="nf-icon-wrap">
                  <Mail size={20} color="#E50914" />
                </div>
                <h1 className="nf-title">Email Verify Karo</h1>
                <p className="nf-subtitle">6-digit OTP bheja gaya <strong>{email}</strong> pe.</p>
                <form onSubmit={verifyEmailOtp} className="nf-form">
                  <div className="nf-otp-info">
                    <ChevronsRight size={13} style={{ flexShrink:0, color:"#E50914" }} />
                    OTP bheja → <strong>{email}</strong>
                  </div>
                  <div className="nf-input-group">
                    <label className="nf-label">Email OTP</label>
                    <input className="nf-input" type="text" required value={emailOtp}
                      onChange={e => setEmailOtp(e.target.value)} placeholder="6-digit OTP" maxLength={6} />
                  </div>
                  <button className="nf-btn nf-btn-red" disabled={loading}>
                    {loading ? "Verify ho raha hai..." : role==="driver" ? "Verify → Ambulance Select" : "Verify & Login →"}
                  </button>
                  <button type="button" className="nf-btn nf-btn-ghost" onClick={sendEmailOtp} disabled={loading}>
                    Resend OTP
                  </button>
                  <button type="button" className="nf-back" onClick={() => setStep(1)}>
                    <ArrowLeft size={12}/> Wapas jao
                  </button>
                </form>
              </>
            )}

            {/* ══ Step 3: Ambulance Select (Driver only) ══ */}
            {step === 3 && (
              <>
                <div className="nf-icon-wrap" style={{ background:"rgba(247,201,72,0.1)", borderColor:"rgba(247,201,72,0.3)" }}>
                  <Truck size={20} color="#f7c948" />
                </div>
                <h1 className="nf-title">Apni Ambulance Chunno</h1>
                <p className="nf-subtitle">
                  Aapka naam <strong>{name}</strong> aur contact <strong>+91 {phone}</strong> is ambulance mein save ho jaayega.
                </p>

                <div style={{ marginBottom:12 }}>
                  <span className="nf-verified-badge">✅ Email Verified • 📱 +91 {phone}</span>
                </div>

                {ambLoading ? (
                  <div style={{ textAlign:"center", padding:"24px 0", fontSize:12, color:"rgba(255,255,255,0.3)" }}>
                    ⏳ Loading ambulances...
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    <div className="amb-list">
                      {ambulances.length === 0
                        ? <div style={{ textAlign:"center", padding:24, fontSize:12, color:"rgba(255,255,255,0.2)" }}>Koi ambulance nahi mili</div>
                        : ambulances.map(a => (
                          <div key={a.id} className={`amb-item ${selectedAmb?.id===a.id?"selected":""}`} onClick={() => setSelectedAmb(a)}>
                            <div className="amb-icon">🚑</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div className="amb-name">{a.ambulance_number}</div>
                              <div className="amb-sub">{a.location || "—"}</div>
                            </div>
                            <span className={`amb-status s-${a.status}`}>{a.status?.replace("_"," ")}</span>
                          </div>
                        ))}
                    </div>

                    <button className="nf-btn nf-btn-red" disabled={!selectedAmb} onClick={confirmAmbulance}>
                      {selectedAmb ? `🚑 Start — ${selectedAmb.ambulance_number}` : "Pehle ambulance select karo"}
                    </button>

                    <button type="button" className="nf-back" style={{ justifyContent:"center" }}
                      onClick={() => setStep(2)}>
                      <ArrowLeft size={12}/> Wapas
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        <footer className="nf-footer">
          © {new Date().getFullYear()} SwiftRescue · Emergency Response System
        </footer>
      </div>
    </>
  );
};

export default Login;
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const MapView = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const { state } = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Aapki location dhundh raha hai...");
  const [error, setError] = useState(null);

  // hospital passed via router state: { name, address, latitude, longitude }
  const hospital = state?.hospital;

  useEffect(() => {
    if (!hospital) {
      navigate("/");
      return;
    }

    // Dynamically load Leaflet CSS + JS
    const loadLeaflet = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Also load Leaflet Routing Machine
      if (!document.getElementById("lrm-css")) {
        const link = document.createElement("link");
        link.id = "lrm-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css";
        document.head.appendChild(link);
      }

      if (!window.L?.Routing) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      initMap();
    };

    const initMap = () => {
      if (mapInstanceRef.current) return;

      const L = window.L;

      // Init map centered on hospital first
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([hospital.latitude, hospital.longitude], 14);

      mapInstanceRef.current = map;

      // Dark tile layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Custom zoom control (bottom right)
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Hospital marker (red)
      const hospitalIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:36px; height:36px;
            background:#E50914;
            border:3px solid #fff;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 4px 16px rgba(229,9,20,0.6);
          "></div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -40],
      });

      const hospitalMarker = L.marker([hospital.latitude, hospital.longitude], { icon: hospitalIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:'Helvetica Neue',sans-serif; padding:4px 2px;">
            <div style="font-weight:800; font-size:13px; color:#fff; margin-bottom:4px;">🏥 ${hospital.name}</div>
            <div style="font-size:11px; color:rgba(255,255,255,0.55);">${hospital.address || ""}</div>
          </div>
        `, {
          className: "dark-popup",
          maxWidth: 220,
        })
        .openPopup();

      // Get user's current location
      setStatus("Aapki location dhundh raha hai...");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
          const hospLatLng = L.latLng(hospital.latitude, hospital.longitude);

          setStatus("Route calculate ho raha hai...");

          // User marker (teal)
          const userIcon = L.divIcon({
            className: "",
            html: `
              <div style="position:relative; width:18px; height:18px;">
                <div style="
                  width:18px; height:18px;
                  background:#00d4aa;
                  border:3px solid #fff;
                  border-radius:50%;
                  box-shadow:0 0 0 6px rgba(0,212,170,0.25);
                "></div>
              </div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });

          L.marker(userLatLng, { icon: userIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:'Helvetica Neue',sans-serif; font-weight:700; font-size:12px; color:#fff;">📍 Aap yahan hain</div>`, {
              className: "dark-popup",
            });

          // Draw route using OSRM (free, no API key)
          const routing = L.Routing.control({
            waypoints: [userLatLng, hospLatLng],
            router: L.Routing.osrmv1({
              serviceUrl: "https://router.project-osrm.org/route/v1",
              profile: "driving",
            }),
            lineOptions: {
              styles: [
                { color: "#E50914", weight: 5, opacity: 0.9 },
                { color: "#fff",    weight: 2, opacity: 0.3 },
              ],
              extendToWaypoints: true,
              missingRouteTolerance: 0,
            },
            show: false,           // hide default turn-by-turn panel
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            showAlternatives: false,
            createMarker: () => null, // use our own markers
          }).addTo(map);

          routing.on("routesfound", (e) => {
            const summary = e.routes[0].summary;
            const km = (summary.totalDistance / 1000).toFixed(1);
            const mins = Math.round(summary.totalTime / 60);
            setStatus(`${km} km · ~${mins} min`);
          });

          routing.on("routingerror", () => {
            setStatus(null);
            setError("Route nahi mila. GPS check karein.");
            map.fitBounds([userLatLng, hospLatLng], { padding: [60, 60] });
          });
        },
        (err) => {
          setStatus(null);
          setError("Location access nahi mili. Browser settings check karein.");
          // Still show hospital on map
          map.setView([hospital.latitude, hospital.longitude], 15);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    loadLeaflet().catch(() => setError("Map load nahi hua. Internet check karein."));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .mv-root {
          background: #0f0f0f;
          height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          overflow: hidden;
        }

        /* TOP BAR */
        .mv-topbar {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: linear-gradient(to bottom, rgba(10,10,10,0.95) 0%, transparent 100%);
        }

        .mv-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px; height: 38px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50%;
          cursor: pointer;
          color: #fff;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .mv-back-btn:hover { background: rgba(255,255,255,0.2); }

        .mv-hosp-info { flex: 1; min-width: 0; }
        .mv-hosp-name {
          font-size: 15px;
          font-weight: 800;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.3px;
        }
        .mv-hosp-addr {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        /* STATUS PILL */
        .mv-status-pill {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15,15,15,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 100px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        }
        .mv-status-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #00d4aa;
          animation: pulse 1.5s infinite;
          flex-shrink: 0;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }

        .mv-error-pill {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: rgba(229,9,20,0.15);
          border: 1px solid rgba(229,9,20,0.4);
          border-radius: 100px;
          padding: 10px 20px;
          font-size: 12px;
          font-weight: 600;
          color: #ff4d5a;
          white-space: nowrap;
          backdrop-filter: blur(12px);
        }

        /* MAP CONTAINER */
        .mv-map {
          flex: 1;
          width: 100%;
          height: 100%;
        }

        /* Override Leaflet popup styles */
        .dark-popup .leaflet-popup-content-wrapper {
          background: rgba(20,20,20,0.95) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
          backdrop-filter: blur(12px);
        }
        .dark-popup .leaflet-popup-tip {
          background: rgba(20,20,20,0.95) !important;
        }
        .dark-popup .leaflet-popup-close-button {
          color: rgba(255,255,255,0.4) !important;
        }

        /* Hide LRM default container */
        .leaflet-routing-container { display: none !important; }

        .leaflet-control-zoom a {
          background: rgba(20,20,20,0.9) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.12) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(40,40,40,0.95) !important;
        }
      `}</style>

      <div className="mv-root">
        {/* Top bar */}
        <div className="mv-topbar">
          <button className="mv-back-btn" onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div className="mv-hosp-info">
            <div className="mv-hosp-name">🏥 {hospital?.name}</div>
            <div className="mv-hosp-addr">{hospital?.address}</div>
          </div>
        </div>

        {/* Map */}
        <div ref={mapRef} className="mv-map" />

        {/* Status */}
        {status && !error && (
          <div className="mv-status-pill">
            <span className="mv-status-dot" />
            {status}
          </div>
        )}
        {error && (
          <div className="mv-error-pill">⚠️ {error}</div>
        )}
      </div>
    </>
  );
};

export default MapView;
import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronsRight, Truck, Building2, BarChart2,
  ClipboardList, MapPin as MapPinIcon, Navigation, RefreshCw, LayoutDashboard, Map as MapIcon, BookOpen, X
} from 'lucide-react';

const BASE = "http://127.0.0.1:8000";

// Reusable Icons for Premium Look
const Icons = {
  Ambulance: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 10h4"/><path d="M12 8v4"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11h2"/><path d="M19 18h2v-4l-3-3h-4"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>,
  CheckCircle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  MapPin: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
  Clock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  User: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Play: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
};

/**
 * IN-FILE COMPONENT: UserBookingMap
 * Replaced external import to fix build error
 */
const UserBookingMap = ({ booking, onClose }) => {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#141414] border border-white/10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/10 text-white rounded-full transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 h-400 lg:h-600 bg-slate-900 relative overflow-hidden">
            {/* Mock Map Placeholder */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#e50914_1px,transparent_1px)] background-size:20px_20p"></div>
            <div className="absolute inset-0 flex items-center justify-center flex-col text-center p-6">
              <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Navigation className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Live Tracking Interface</h3>
              <p className="text-gray-400 max-w-sm">Map visualization for Booking #{booking.id} is active. Driver coordinates are updated in real-time.</p>
            </div>
            
            {/* Visual elements to make it look active */}
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none">
              <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-teal-400 uppercase tracking-widest">
                Signal: High Precision
              </div>
              <div className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-bold text-white uppercase tracking-widest">
                ETA: 8 mins
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8 bg-[#0F0F0F] border-l border-white/5">
            <div>
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Tracking Information</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="p-2 bg-red-600/10 rounded-lg text-red-500"><Icons.Ambulance /></div>
                  <div>
                    <p className="text-sm font-bold text-white">{booking.ambulance_number || `AMB-${booking.id}`}</p>
                    <p className="text-xs text-gray-500">Fast Response Unit</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="relative pl-6 border-l-2 border-dashed border-white/10 space-y-8">
                <div className="relative">
                  <div className="absolute -left-31 top-0 w-4 h-4 rounded-full bg-teal-500 shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                  <p className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Driver Location</p>
                  <p className="text-sm text-gray-300 mt-1">Sanjay Gandhi Memorial Area</p>
                </div>
                <div className="relative opacity-50">
                  <div className="absolute -left-31 top-0 w-4 h-4 rounded-full bg-red-500"></div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Your Location</p>
                  <p className="text-sm text-gray-300 mt-1">{booking.pickup_location}</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-gray-200 transition-colors uppercase tracking-widest text-xs">
                Call Driver
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Status Configuration optimized for Tailwind classes
const getStatusConfig = (status) => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return { color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20", dot: "bg-teal-400", pulse: true, label: "Confirmed" };
    case 'pending': return { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", dot: "bg-yellow-400", pulse: false, label: "Pending" };
    case 'completed': return { color: "text-gray-300", bg: "bg-white/5", border: "border-white/10", dot: "bg-gray-400", pulse: false, label: "Completed" };
    case 'cancelled': 
    case 'rejected': return { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-500", pulse: false, label: status.charAt(0).toUpperCase() + status.slice(1) };
    default: return { color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20", dot: "bg-gray-500", pulse: false, label: status || "Unknown" };
  }
};

export function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackBooking, setTrackBooking] = useState(null);
  const [filter, setFilter] = useState("all");

  const email = localStorage.getItem("user") || "";
  const name = localStorage.getItem("name") || "";

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/`);
      const data = await res.json();
      const mine = data
        .filter(b => b.booked_by_email === email || b.user_email === email || b.booked_by === name)
        .sort((a, b) => b.id - a.id);
      setBookings(mine);
    } catch {}
    setLoading(false);
  }, [email, name]);

  useEffect(() => {
    fetchBookings();
    const t = setInterval(fetchBookings, 8000);
    return () => clearInterval(t);
  }, [fetchBookings]);

  // Auto-open tracking
  useEffect(() => {
    if (bookings.length === 0) return;
    const confirmed = bookings.find(b => b.status === "confirmed");
    if (confirmed && !trackBooking) {
      const key = `ubm_shown_${confirmed.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        setTrackBooking(confirmed);
      }
    }
  }, [bookings]);

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  // Stats Data
  const stats = [
    { label: "Total", val: bookings.length },
    { label: "Active", val: bookings.filter(b => b.status === "confirmed").length, activeColor: "bg-teal-400", glow: "shadow-[0_4px_20px_-4px_rgba(45,212,191,0.3)]" },
    { label: "Pending", val: bookings.filter(b => b.status === "pending").length, activeColor: "bg-yellow-400" },
    { label: "Completed", val: bookings.filter(b => b.status === "completed").length, activeColor: "bg-gray-400" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100 font-sans selection:bg-red-500/30 md:pl-16 pb-20 md:pb-0">
      
      {/* Sleek Hero Background effect */}
      <div className="fixed top-100 right-100 w-400 h-400px bg-red-600/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

      <div className="relative z-10 p-6 md:p-10 max-w-7xl mx-auto space-y-10">
        
        {/* Page Header */}
        <div className="space-y-4 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold uppercase tracking-wider">
            <Icons.Ambulance />
            <span>My Bookings</span>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">Booking History</h1>
            <p className="text-gray-400 text-lg">Aapki sabhi ambulance bookings ek jagah</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {stats.map(s => (
            <div key={s.label} className={`flex flex-col items-center justify-center min-w-120 bg-[#141414] border border-white/5 rounded-2xl p-4 relative overflow-hidden ${s.glow || ''}`}>
              <span className="text-3xl font-black tracking-tighter text-white mb-1">{String(s.val).padStart(2, "0")}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{s.label}</span>
              {s.activeColor && <div className={`absolute bottom-0 left-4 right-4 h-1 rounded-t-md ${s.activeColor} opacity-80`}></div>}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
          {["all", "confirmed", "pending", "completed", "cancelled"].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border ${
                filter === f 
                ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20' 
                : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {/* Global Tracking Banner */}
          {trackBooking && (
            <div className="flex items-center justify-between bg-teal-500/10 border border-teal-500/20 rounded-2xl p-5 shadow-lg shadow-teal-500/5 backdrop-blur-sm animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500"></span>
                </div>
                <div>
                  <h3 className="text-teal-400 font-bold text-sm tracking-wide">LIVE TRACKING ACTIVE — Booking #{trackBooking.id}</h3>
                  <p className="text-gray-400 text-xs mt-1">Driver is heading towards your location</p>
                </div>
              </div>
              <button onClick={() => setTrackBooking(null)} className="px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg text-xs font-bold transition-colors border border-teal-500/30">
                Dismiss Tracker
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin"></div>
              <p className="text-gray-500 text-sm font-medium">Loading your bookings...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-[#111] rounded-3xl border border-white/5 border-dashed">
              <div className="text-6xl mb-4 opacity-30">📋</div>
              <h3 className="text-xl font-bold text-gray-300 mb-2">{filter === "all" ? "No Bookings Found" : `No ${filter} Bookings`}</h3>
              <p className="text-gray-500 text-sm">{filter === "all" ? "Head to Ambulances page to book one." : "Try changing the filter."}</p>
            </div>
          )}

          {/* Booking Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {!loading && filtered.map(b => {
              const statusInfo = getStatusConfig(b.status);
              const isActive = b.status === "confirmed";
              const isTracking = trackBooking?.id === b.id;

              return (
                <div key={b.id} className={`bg-[#141414] border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isActive ? 'border-teal-500/30 shadow-[0_4px_30px_-5px_rgba(45,212,191,0.05)]' : 'border-white/5 hover:border-white/10'}`}>
                  
                  {/* Card Header */}
                  <div className={`px-6 py-4 flex items-center justify-between border-b border-white/5 ${isActive ? ' from-teal-500/5 to-transparent' : 'bg-[#1A1A1A]'}`}>
                    <div className="flex items-center gap-3">
                      {isTracking && <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.8)]"></span>}
                      <h3 className="text-lg font-bold text-white tracking-tight flex gap-2">
                        Booking <span className="text-gray-500 font-medium">#{b.id}</span>
                      </h3>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1 ${statusInfo.bg} border ${statusInfo.border} rounded-full`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} ${statusInfo.pulse ? 'animate-pulse' : ''}`}></span>
                      <span className={`text-[10px] font-bold ${statusInfo.color} tracking-wider uppercase`}>{statusInfo.label}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    {/* Assigned Ambulance Strip */}
                    {(b.ambulance_number || b.ambulance_id) && (
                      <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 flex items-center gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-red-500">
                          <Icons.Ambulance />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white tracking-widest font-mono">{b.ambulance_number || `AMB-${b.ambulance_id}`}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Assigned Ambulance</p>
                        </div>
                      </div>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <DetailItem icon={<Icons.MapPin />} iconColor="text-red-400" label="Pickup Location" value={b.pickup_location} />
                      <DetailItem icon={<Icons.MapPin />} iconColor="text-purple-400" label="Destination" value={b.destination} />
                      <DetailItem icon={<Icons.User />} iconColor="text-blue-400" label="Booked By" value={b.booked_by} />
                      <DetailItem icon={<Icons.Clock />} iconColor="text-gray-400" label="Date & Time" value={b.created_at ? new Date(b.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null} />
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  {isActive && (
                    <div className="px-6 py-4 bg-[#111] border-t border-white/5 flex items-center">
                      {!isTracking ? (
                        <button onClick={() => setTrackBooking(b)} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-red-600/20 hover:-translate-y-0.5 group">
                          <Icons.Play />
                          <span>Live Track Karo</span>
                          <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-[10px] uppercase tracking-wider font-bold group-hover:bg-white/30 transition-colors">Live</span>
                        </button>
                      ) : (
                        <button onClick={() => setTrackBooking(null)} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-5 py-3 rounded-xl text-sm font-semibold transition-colors">
                          Dismiss Tracking View
                        </button>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {trackBooking && (
        <UserBookingMap
          booking={trackBooking}
          onClose={() => setTrackBooking(null)}
        />
      )}
    </div>
  );
}

// Detail Item Component for Grid
const DetailItem = ({ icon, iconColor, label, value }) => (
  <div className="flex items-start gap-3">
    <div className={`mt-0.5 ${iconColor}`}>
      {icon}
    </div>
    <div className="flex-1 overflow-hidden">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className="text-sm font-medium text-gray-200 capitalize truncate" title={value || "—"}>{value || "—"}</p>
    </div>
  </div>
);

// Sidebar Components below as requested
const adminNavItems = [
  { to: "/Ambulances",          icon: Truck,         label: "Ambulances"       },
  { to: "/Hospitals",           icon: Building2,     label: "Hospitals"        },
  { to: "/Reports",             icon: BarChart2,     label: "Reports"          },
  { to: "/Requests",            icon: ClipboardList, label: "Requests"         },
  { to: "/DriverChangeRequests", icon: RefreshCw,     label: "Driver Requests", dot: true },
  { to: "/LiveMap",             icon: MapPinIcon,    label: "Live Map",        dot: true },
  { to: "/DriverView",          icon: Navigation,    label: "Driver View"      },
];

const userNavItems = [
  { to: "/Ambulances",  icon: Truck,     label: "Ambulances"  },
  { to: "/Hospitals",   icon: Building2, label: "Hospitals"   },
  { to: "/MyBookings",  icon: BookOpen,  label: "My Bookings" },
  { to: "/directions",  icon: MapIcon,   label: "Map"         },
];

const driverNavItems = [
  { to: "/DriverDashboard", icon: LayoutDashboard, label: "Dashboard", dot: true },
  { to: "/Ambulances",      icon: Truck,           label: "Ambulances" },
  { to: "/Hospitals",       icon: Building2,       label: "Hospitals"  },
  { to: "/directions",      icon: MapIcon,         label: "Map"        },
];

export function Leftsidebar() {
  const location = useLocation();
  const role     = localStorage.getItem("role");

  const navItems =
    role === "admin"  ? adminNavItems  :
    role === "driver" ? driverNavItems :
    userNavItems;

  const pendingCount = (() => {
    try {
      const all = JSON.parse(localStorage.getItem("all_change_requests") || "[]");
      return all.filter(r => r.status === "pending").length;
    } catch { return 0; }
  })();

  const hideBottomNav = role === "driver";

  return (
    <>
      <style>{`
        .lsb-root {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          height: 100vh !important;
          width: 64px !important;
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex !important;
          flex-direction: column;
          align-items: center;
          z-index: 50 !important;
          padding: 0 0 16px;
        }
        .lsb-logo {
          height: 80px; width: 100%;
          display: flex; align-items: center; justify-content: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: #E50914; cursor: pointer; transition: color 0.2s;
          text-decoration: none; flex-shrink: 0;
        }
        .lsb-logo:hover { color: #f40612; }
        .lsb-nav {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 12px;
          padding: 24px 0; width: 100%;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .lsb-nav::-webkit-scrollbar { display: none; }
        .lsb-item {
          position: relative; width: 44px; height: 44px;
          border-radius: 12px; display: flex; align-items: center;
          justify-content: center; color: rgba(255,255,255,0.4);
          transition: all 0.2s; cursor: pointer; text-decoration: none; flex-shrink: 0;
        }
        .lsb-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.9); }
        .lsb-item.active { background: rgba(229,9,20,0.1); color: #E50914; border: 1px solid rgba(229,9,20,0.2); }
        .lsb-tooltip {
          position: absolute; left: 60px;
          background: #1a1a1a; color: #fff;
          font-size: 12px; font-weight: 600;
          padding: 6px 12px; border-radius: 8px;
          white-space: nowrap; opacity: 0; pointer-events: none;
          transition: opacity 0.15s, transform 0.15s; transform: translateX(-10px);
          border: 1px solid rgba(255,255,255,0.1);
          font-family: 'Inter', sans-serif; z-index: 99999;
        }
        .lsb-item:hover .lsb-tooltip { opacity: 1; transform: translateX(0); }
        .lsb-dot {
          position: absolute; top: 8px; right: 8px;
          width: 6px; height: 6px; border-radius: 50%;
          background: #00d4aa; box-shadow: 0 0 8px rgba(0,212,170,0.6);
          animation: lsb-pulse 2s infinite;
        }
        .lsb-dot-red {
          position: absolute;
          background: #E50914; box-shadow: 0 0 8px rgba(229,9,20,0.6);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 800; color: #fff;
          min-width: 16px; height: 16px;
          padding: 0 4px; border-radius: 8px;
          top: -2px; right: -2px;
        }
        @keyframes lsb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.2); }
        }
        .lsb-divider {
          width: 24px; height: 1px;
          background: rgba(255,255,255,0.05);
          margin: 8px 0; flex-shrink: 0;
        }
        .lsb-bottom {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 64px; background: rgba(10,10,10,0.95); backdrop-filter: blur(10px);
          border-top: 1px solid rgba(255,255,255,0.05);
          z-index: 9999;
          align-items: center;
          justify-content: space-around; padding: 0 8px;
        }
        .lsb-bottom-item {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 4px; flex: 1; height: 100%;
          color: rgba(255,255,255,0.4); text-decoration: none;
          transition: all 0.2s; position: relative;
        }
        .lsb-bottom-item.active { color: #E50914; }
        .lsb-bottom-item:hover  { color: rgba(255,255,255,0.8); }
        .lsb-bottom-label {
          font-size: 10px; font-weight: 600;
          font-family: 'Inter', sans-serif;
          white-space: nowrap;
        }
        .lsb-bottom-dot {
          position: absolute; top: 8px; right: calc(50% - 16px);
          width: 6px; height: 6px; border-radius: 50%;
          background: #00d4aa; box-shadow: 0 0 6px rgba(0,212,170,0.6);
          animation: lsb-pulse 2s infinite;
        }
        @media (max-width: 767px) {
          .lsb-root   { display: none !important; }
          .lsb-bottom { display: flex !important; }
          .lsb-bottom.hidden { display: none !important; }
        }
      `}</style>

      <div className="lsb-root">
        <Link to="/" className="lsb-logo"><ChevronsRight size={28} /></Link>
        <div className="lsb-nav">
          {navItems.map((item, index) => {
            const Icon         = item.icon;
            const isActive     = location.pathname === item.to;
            const isPendingReq = item.to === "/DriverChangeRequests" && pendingCount > 0;
            return (
              <div key={item.to} style={{ display: "contents" }}>
                {role === "admin" && index === 5 && <div className="lsb-divider" />}
                <Link to={item.to} className={`lsb-item ${isActive ? "active" : ""}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {item.dot && !isPendingReq && <div className="lsb-dot" />}
                  {isPendingReq && <div className="lsb-dot-red">{pendingCount}</div>}
                  <span className="lsb-tooltip">{item.label}{isPendingReq ? ` (${pendingCount})` : ""}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`lsb-bottom ${hideBottomNav ? "hidden" : ""}`}>
        {navItems.map((item) => {
          const Icon     = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <Link key={item.to} to={item.to} className={`lsb-bottom-item ${isActive ? "active" : ""}`}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="lsb-bottom-label">{item.label}</span>
              {item.dot && <div className="lsb-bottom-dot" />}
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default MyBookings;import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#00d4aa", "#E50914", "#f7c948", "rgba(255,255,255,0.3)"];
const statusColor = { available: "#00d4aa", en_route: "#f7c948", busy: "#ff4d5a", offline: "rgba(255,255,255,0.3)" };

const Reports = () => {
  const [bookings,   setBookings]   = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals,  setHospitals]  = useState([]);
  const [trackedAmb, setTrackedAmb] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/bookings/").then(r => r.json()).then(setBookings).catch(console.log);
    fetch("http://127.0.0.1:8000/api/ambulances/").then(r => r.json()).then(setAmbulances).catch(console.log);
    fetch("http://127.0.0.1:8000/api/hospitals/").then(r => r.json()).then(setHospitals).catch(console.log);
    const interval = setInterval(() => {
      fetch("http://127.0.0.1:8000/api/ambulances/").then(r => r.json()).then(data => {
        setAmbulances(data);
        setTrackedAmb(prev => {
          if (!prev) return null;
          const u = data.find(a => a.ambulance_number === prev.number);
          return u ? { ...prev, lat: u.latitude, lng: u.longitude, updated: u.last_updated, status: u.status } : prev;
        });
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const total      = bookings.length;
  const confirmed  = bookings.filter(b => b.status === "confirmed").length;
  const completed  = bookings.filter(b => b.status === "completed").length;
  const cancelled  = bookings.filter(b => b.status === "cancelled").length;
  const pending    = bookings.filter(b => b.status === "pending").length;
  const successRate = total ? Math.round((completed / total) * 100) : 0;

  const pieData = [
    { name: "Completed", value: completed },
    { name: "Cancelled", value: cancelled },
    { name: "Confirmed", value: confirmed },
    { name: "Pending",   value: pending   },
  ].filter(d => d.value > 0);

  const ambBreakdown = [
    { name: "Available", value: ambulances.filter(a => a.status === "available").length },
    { name: "En Route",  value: ambulances.filter(a => a.status === "en_route").length  },
    { name: "Busy",      value: ambulances.filter(a => a.status === "busy").length      },
    { name: "Offline",   value: ambulances.filter(a => a.status === "offline").length   },
  ];

  const hospitalBeds = hospitals.map(h => ({
    name: h.name.length > 10 ? h.name.slice(0, 10) + "…" : h.name,
    total: h.total_beds, available: h.available_beds, icu: h.icu_beds || 0,
  }));

  const bookingsPerAmb = ambulances.map(a => ({
    name: a.ambulance_number,
    bookings: bookings.filter(b => b.ambulance_id === a.id).length,
  })).filter(a => a.bookings > 0);

  const driverStats = ambulances.map(a => ({
    id: a.id, number: a.ambulance_number, driver: a.driver,
    contact: a.driver_contact, status: a.status,
    lat: a.latitude, lng: a.longitude, updated: a.last_updated,
    bookings: bookings.filter(b => b.ambulance_id === a.id).length,
  }));

  // Tooltip style always dark regardless of theme
  const ttStyle = { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" };

  return (
    <>
      <style>{`
        .rep-root {
          background: var(--sr-bg, #0f0f0f);
          color: var(--sr-page-text, #fff);
          min-height: 100vh;
          padding: 56px 0 0 64px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          transition: background 0.3s, color 0.2s;
          box-sizing: border-box;
        }
        .rep-content { max-width: 1200px; margin: 0 auto; padding: 32px 24px 64px; display: flex; flex-direction: column; gap: 28px; }

        /* Header — page level text */
        .rep-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #E50914; background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.3); border-radius: 100px; padding: 4px 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .rep-header h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; color: var(--sr-page-text, #fff); }
        .rep-header p  { font-size: 13px; color: var(--sr-page-text-sub, rgba(255,255,255,0.4)); }
        .rep-section-title { font-size: 16px; font-weight: 700; margin-bottom: 14px; color: var(--sr-page-text, #fff); }

        /* Summary cards — always dark */
        .rep-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .rep-sum-card { background: var(--sr-stat-bg, #1a1a1a); border: 1px solid var(--sr-border, rgba(255,255,255,0.07)); border-radius: 12px; padding: 16px 18px; position: relative; overflow: hidden; }
        .rep-sum-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 12px 12px 0 0; }
        .rep-sum-label { font-size: 10px; font-weight: 600; color: var(--sr-text-sub); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
        .rep-sum-value { font-size: 32px; font-weight: 900; line-height: 1; letter-spacing: -1px; color: var(--sr-text, #fff); }

        /* Chart cards — always dark */
        .rep-charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .rep-chart-card { background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border, rgba(255,255,255,0.07)); border-radius: 14px; padding: 20px; }
        .rep-chart-title { font-size: 13px; font-weight: 700; color: var(--sr-text-sub); margin-bottom: 16px; }
        .rep-chart-empty { color: var(--sr-text-muted); text-align: center; padding: 50px 0; font-size: 13px; }

        /* Driver table card — always dark */
        .rep-table-card { background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border, rgba(255,255,255,0.07)); border-radius: 14px; padding: 20px; overflow-x: auto; }
        .rep-table { width: 100%; border-collapse: collapse; min-width: 700px; }
        .rep-table th { font-size: 10px; font-weight: 700; color: var(--sr-text-sub); letter-spacing: 0.8px; text-transform: uppercase; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.07)); }
        .rep-table td { padding: 12px 14px; border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.04)); font-size: 12px; color: var(--sr-text, #fff); vertical-align: middle; }
        .rep-table tr:hover td { background: var(--sr-hover, rgba(255,255,255,0.03)); }
        .rep-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 100px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px; }
        .rep-track-btn { border-radius: 100px; padding: 4px 14px; font-size: 10px; font-weight: 700; cursor: pointer; font-family: inherit; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.15s; border: 1px solid rgba(229,9,20,0.4); white-space: nowrap; }
        .rep-track-btn:hover { background: #E50914 !important; color: #fff !important; }

        /* Modal — always dark */
        .rep-modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .rep-modal-box { background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 20px; width: 100%; max-width: 900px; height: 70vh; display: flex; flex-direction: column; overflow: hidden; }
        .rep-modal-header { padding: 14px 20px; border-bottom: 1px solid var(--sr-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .rep-modal-info-bar { padding: 10px 20px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--sr-border); display: flex; gap: 20px; flex-wrap: wrap; }
        .rep-modal-info-label { font-size: 9px; color: var(--sr-text-muted); text-transform: uppercase; letter-spacing: 0.8px; }
        .rep-modal-info-val   { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); margin-top: 2px; }
        .rep-close-btn { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 100px; padding: 5px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .rep-close-btn:hover { background: rgba(255,255,255,0.15); }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } }
        .gps-pulse { width: 6px; height: 6px; border-radius: 50%; background: #00d4aa; display: inline-block; animation: pulse 1.5s infinite; }

        @media (max-width: 1023px) {
          .rep-root { padding-left: 64px; }
          .rep-content { padding: 24px 16px 64px; }
          .rep-summary { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 767px) {
          .rep-root { padding-left: 0; padding-bottom: 72px; }
          .rep-content { padding: 20px 12px 80px; }
          .rep-header h1 { font-size: 22px; }
          .rep-summary { grid-template-columns: repeat(2, 1fr); }
          .rep-charts-row { grid-template-columns: 1fr; }
          .rep-sum-value { font-size: 26px; }
          .rep-modal-box { height: 85vh; }
        }
        @media (max-width: 480px) {
          .rep-summary { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="rep-root">
        <div className="rep-content">
          <div className="rep-header">
            <div className="rep-tag">📊 Analytics</div>
            <h1>Reports & Analytics</h1>
            <p>Real-time insights on bookings, fleet, and hospital capacity</p>
          </div>

          {/* Summary */}
          <div>
            <div className="rep-section-title">Overview</div>
            <div className="rep-summary">
              {[
                { label: "Total Bookings", value: String(total).padStart(2,"0"),     accent: "rgba(255,255,255,0.4)" },
                { label: "Completed",      value: String(completed).padStart(2,"0"), accent: "#00d4aa" },
                { label: "Confirmed",      value: String(confirmed).padStart(2,"0"), accent: "#f7c948" },
                { label: "Cancelled",      value: String(cancelled).padStart(2,"0"), accent: "#ff4d5a" },
                { label: "Success Rate",   value: `${successRate}%`,                 accent: "#E50914" },
              ].map((s, i) => (
                <div key={i} className="rep-sum-card">
                  <div className="rep-sum-bar" style={{ background: s.accent }} />
                  <div className="rep-sum-label">{s.label}</div>
                  <div className="rep-sum-value">{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div>
            <div className="rep-section-title">Breakdown</div>
            <div className="rep-charts-row">
              <div className="rep-chart-card">
                <div className="rep-chart-title">🥧 Booking Status Distribution</div>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={ttStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="rep-chart-empty">No bookings yet</div>}
              </div>

              <div className="rep-chart-card">
                <div className="rep-chart-title">🚑 Ambulance Status</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ambBreakdown} barSize={28}>
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="value" radius={[6,6,0,0]}>
                      {ambBreakdown.map((_, i) => <Cell key={i} fill={Object.values(statusColor)[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rep-chart-card">
                <div className="rep-chart-title">🏥 Hospital Bed Availability</div>
                {hospitalBeds.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={hospitalBeds} barSize={16}>
                      <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={ttStyle} />
                      <Legend wrapperStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                      <Bar dataKey="total"     name="Total"     fill="rgba(255,255,255,0.15)" radius={[4,4,0,0]} />
                      <Bar dataKey="available" name="Available" fill="#00d4aa"                radius={[4,4,0,0]} />
                      <Bar dataKey="icu"       name="ICU"       fill="#E50914"                radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="rep-chart-empty">No hospitals yet</div>}
              </div>

              <div className="rep-chart-card">
                <div className="rep-chart-title">📋 Bookings Per Ambulance</div>
                {bookingsPerAmb.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={bookingsPerAmb} barSize={28}>
                      <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={ttStyle} />
                      <Bar dataKey="bookings" fill="#E50914" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="rep-chart-empty">No data yet</div>}
              </div>
            </div>
          </div>

          {/* Driver Table */}
          <div>
            <div className="rep-section-title">🗺️ Driver Tracking & Fleet Status</div>
            <div className="rep-table-card">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>#</th><th>Ambulance</th><th>Driver</th><th>Status</th>
                    <th>Latitude</th><th>Longitude</th><th>Last Updated</th>
                    <th>Bookings</th><th>Track</th>
                  </tr>
                </thead>
                <tbody>
                  {driverStats.map((d, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--sr-text-muted)", fontSize: 12 }}>{String(i+1).padStart(2,"0")}</td>
                      <td style={{ fontWeight: 700 }}>🚑 {d.number}</td>
                      <td>{d.driver}</td>
                      <td>
                        <span className="rep-pill" style={{ color: statusColor[d.status]||"#fff", background: `${statusColor[d.status]}22`, borderColor: statusColor[d.status]||"rgba(255,255,255,0.2)" }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ color: "#00d4aa", fontFamily: "monospace" }}>{d.lat ? d.lat.toFixed(5) : "—"}</td>
                      <td style={{ color: "#00d4aa", fontFamily: "monospace" }}>{d.lng ? d.lng.toFixed(5) : "—"}</td>
                      <td style={{ color: "var(--sr-text-sub)", fontSize: 11 }}>{d.updated || "—"}</td>
                      <td style={{ fontWeight: 700, color: d.bookings > 0 ? "#f7c948" : "var(--sr-text-muted)" }}>{d.bookings}</td>
                      <td>
                        <button className="rep-track-btn" onClick={() => setTrackedAmb(d)}
                          style={{ background: trackedAmb?.number === d.number ? "#E50914" : "rgba(229,9,20,0.1)", color: trackedAmb?.number === d.number ? "#fff" : "#E50914" }}>
                          {trackedAmb?.number === d.number ? "● Live" : "Track"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Track Modal */}
      {trackedAmb && (
        <div className="rep-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setTrackedAmb(null); }}>
          <div className="rep-modal-box">
            <div className="rep-modal-header">
              <div>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--sr-text,#fff)" }}>🚑 {trackedAmb.number} — Live Tracking</span>
                <span style={{ fontSize: 11, color: "var(--sr-text-sub)", marginLeft: 10 }}>Driver: {trackedAmb.driver}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {trackedAmb.lat
                  ? <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: "rgba(0,212,170,0.15)", color: "#00d4aa", border: "1px solid rgba(0,212,170,0.35)", display: "flex", alignItems: "center", gap: 6 }}><span className="gps-pulse" /> GPS Active</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: "rgba(247,201,72,0.15)", color: "#f7c948", border: "1px solid rgba(247,201,72,0.35)" }}>⏳ No GPS</span>
                }
                <button className="rep-close-btn" onClick={() => setTrackedAmb(null)}>Close ✕</button>
              </div>
            </div>
            <div className="rep-modal-info-bar">
              {[["Latitude", trackedAmb.lat?.toFixed(6)||"—"], ["Longitude", trackedAmb.lng?.toFixed(6)||"—"], ["Status", trackedAmb.status], ["Last Updated", trackedAmb.updated||"—"], ["Bookings", trackedAmb.bookings]].map((s, i) => (
                <div key={i}><div className="rep-modal-info-label">{s[0]}</div><div className="rep-modal-info-val">{s[1]}</div></div>
              ))}
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              {trackedAmb.lat && trackedAmb.lng
                ? <iframe width="100%" height="100%" style={{ border: "none" }} src={`https://maps.google.com/maps?q=${trackedAmb.lat},${trackedAmb.lng}&z=15&output=embed`} />
                : <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--sr-text-muted)" }}>
                    <span style={{ fontSize: 48 }}>📍</span>
                    <span style={{ fontSize: 14 }}>No GPS data available</span>
                    <code style={{ color: "#E50914", fontSize: 12 }}>/driver/{trackedAmb.id}</code>
                  </div>
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Reports;
import { useState, useEffect } from "react";

const statusColors = {
  pending:   { color: "#f7c948", bg: "rgba(247,201,72,0.15)",  border: "rgba(247,201,72,0.35)" },
  confirmed: { color: "#00d4aa", bg: "rgba(0,212,170,0.15)",   border: "rgba(0,212,170,0.35)" },
  completed: { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.15)" },
  cancelled: { color: "#ff4d5a", bg: "rgba(229,9,20,0.15)",    border: "rgba(229,9,20,0.4)" },
};

const Requests = () => {
  const [bookings, setBookings] = useState([]);

  const fetchBookings = () => {
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json()).then(setBookings).catch(console.log);
  };

  useEffect(() => { fetchBookings(); }, []);

  const updateStatus = (id, status) => {
    fetch(`http://127.0.0.1:8000/api/bookings/${id}/`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(fetchBookings);
  };

  const deleteBooking = (id) => {
    if (window.confirm("Delete this booking?")) {
      fetch(`http://127.0.0.1:8000/api/bookings/${id}/`, { method: "DELETE" }).then(fetchBookings);
    }
  };

  const ActionButtons = ({ b, cardStyle = false }) => {
    const btnStyle = cardStyle
      ? { flex: 1, fontSize: 11, fontWeight: 700, padding: "8px 10px", borderRadius: 8, border: "1px solid", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }
      : { fontSize: 10, fontWeight: 700, padding: "5px 12px", borderRadius: 100, border: "1px solid", cursor: "pointer", fontFamily: "inherit" };
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {b.status === "pending" && <>
          <button style={{ ...btnStyle, background: "rgba(0,212,170,0.1)", color: "#00d4aa", borderColor: "rgba(0,212,170,0.3)" }} onClick={() => updateStatus(b.id, "confirmed")}>✓ Confirm</button>
          <button style={{ ...btnStyle, background: "rgba(229,9,20,0.1)", color: "#ff4d5a", borderColor: "rgba(229,9,20,0.3)" }} onClick={() => updateStatus(b.id, "cancelled")}>✕ Cancel</button>
        </>}
        {b.status === "confirmed" && (
          <button style={{ ...btnStyle, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.15)" }} onClick={() => updateStatus(b.id, "completed")}>Complete</button>
        )}
        {(b.status === "completed" || b.status === "cancelled") && (
          <button style={{ ...btnStyle, background: "rgba(229,9,20,0.1)", color: "#ff4d5a", borderColor: "rgba(229,9,20,0.3)" }} onClick={() => deleteBooking(b.id)}>🗑 Delete</button>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .req-root {
          background: var(--sr-bg, #0f0f0f);
          color: var(--sr-page-text, #fff);
          min-height: 100vh;
          padding: 56px 0 0 64px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          transition: background 0.3s, color 0.2s;
          box-sizing: border-box;
        }
        .req-content { max-width: 1200px; margin: 0 auto; padding: 32px 24px 64px; }

        /* Header — page level */
        .req-header { margin-bottom: 28px; }
        .req-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #E50914; background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.3); border-radius: 100px; padding: 4px 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .req-header h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; color: var(--sr-page-text, #fff); }
        .req-header p  { font-size: 13px; color: var(--sr-page-text-sub, rgba(255,255,255,0.35)); }

        /* Table wrap — always dark surface */
        .req-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border, rgba(255,255,255,0.07)); border-radius: 14px; }
        .req-table { width: 100%; border-collapse: collapse; min-width: 750px; }
        .req-table th { font-size: 10px; font-weight: 700; color: var(--sr-text-sub); letter-spacing: 0.8px; text-transform: uppercase; padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.07)); }
        .req-table td { padding: 14px; border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.05)); font-size: 13px; color: var(--sr-text, #fff); vertical-align: middle; }
        .req-table tr:last-child td { border-bottom: none; }
        .req-table tr:hover td { background: var(--sr-hover, rgba(255,255,255,0.03)); }
        .req-amb    { font-weight: 800; font-size: 14px; color: var(--sr-text, #fff); }
        .req-driver { font-size: 11px; color: var(--sr-text-sub); margin-top: 2px; }
        .req-pill   { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 100px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px; }
        .req-empty  { text-align: center; padding: 60px; color: var(--sr-page-text-muted, rgba(255,255,255,0.22)); font-size: 14px; }

        /* Mobile cards — always dark */
        .req-cards { display: none; flex-direction: column; gap: 12px; }
        .req-card {
          background: var(--sr-surface, #1a1a1a);
          border: 1px solid var(--sr-border, rgba(255,255,255,0.08));
          border-radius: 14px; padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .req-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .req-card-amb    { font-size: 15px; font-weight: 800; color: var(--sr-text, #fff); }
        .req-card-sub    { font-size: 11px; color: var(--sr-text-sub); margin-top: 3px; }
        .req-card-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .req-card-label  { font-size: 9px; font-weight: 700; color: var(--sr-text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px; }
        .req-card-val    { font-size: 12px; color: var(--sr-text, #fff); }
        .req-card-footer { padding-top: 10px; border-top: 1px solid var(--sr-border, rgba(255,255,255,0.07)); }

        @media (max-width: 1023px) {
          .req-root { padding-left: 64px; }
          .req-content { padding: 24px 16px 64px; }
        }
        @media (max-width: 767px) {
          .req-root { padding-left: 0; padding-bottom: 72px; }
          .req-content { padding: 20px 12px 80px; }
          .req-header h1 { font-size: 22px; }
          .req-table-wrap { display: none; }
          .req-cards { display: flex; }
        }
      `}</style>

      <div className="req-root">
        <div className="req-content">
          <div className="req-header">
            <div className="req-tag">📋 Management</div>
            <h1>Booking Requests</h1>
            <p>All ambulance booking requests and their status</p>
          </div>

          {bookings.length === 0 ? (
            <div className="req-empty">No bookings yet — book an ambulance to see requests here!</div>
          ) : <>
            {/* Desktop Table */}
            <div className="req-table-wrap">
              <table className="req-table">
                <thead>
                  <tr>
                    <th>#</th><th>Ambulance</th><th>Booked By</th>
                    <th>Pickup</th><th>Destination</th><th>Status</th>
                    <th>Time</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => {
                    const sc = statusColors[b.status] || statusColors.pending;
                    return (
                      <tr key={b.id}>
                        <td style={{ color: "var(--sr-text-muted)", fontSize: 12 }}>{String(i+1).padStart(2,"0")}</td>
                        <td>
                          <div className="req-amb">🚑 {b.ambulance_number}</div>
                          <div className="req-driver">Driver: {b.driver} · {b.driver_contact}</div>
                        </td>
                        <td>
                          <div style={{ color: "var(--sr-text,#fff)" }}>{b.booked_by}</div>
                          <div style={{ fontSize: 11, color: "var(--sr-text-muted)" }}>{b.booked_by_email}</div>
                        </td>
                        <td style={{ color: "var(--sr-text,#fff)" }}>📍 {b.pickup_location}</td>
                        <td style={{ color: "var(--sr-text,#fff)" }}>{b.destination || "—"}</td>
                        <td><span className="req-pill" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>{b.status}</span></td>
                        <td style={{ fontSize: 11, color: "var(--sr-text-sub)" }}>{b.created_at}</td>
                        <td><ActionButtons b={b} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="req-cards">
              {bookings.map((b) => {
                const sc = statusColors[b.status] || statusColors.pending;
                return (
                  <div key={b.id} className="req-card">
                    <div className="req-card-header">
                      <div>
                        <div className="req-card-amb">🚑 {b.ambulance_number}</div>
                        <div className="req-card-sub">Driver: {b.driver} · {b.driver_contact}</div>
                      </div>
                      <span className="req-pill" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>{b.status}</span>
                    </div>
                    <div className="req-card-grid">
                      <div><div className="req-card-label">Booked By</div><div className="req-card-val">{b.booked_by}</div></div>
                      <div><div className="req-card-label">Time</div><div className="req-card-val" style={{ fontSize: 11 }}>{b.created_at}</div></div>
                      <div><div className="req-card-label">Pickup</div><div className="req-card-val">📍 {b.pickup_location}</div></div>
                      <div><div className="req-card-label">Destination</div><div className="req-card-val">{b.destination || "—"}</div></div>
                    </div>
                    <div className="req-card-footer"><ActionButtons b={b} cardStyle /></div>
                  </div>
                );
              })}
            </div>
          </>}
        </div>
      </div>
    </>
  );
};

export default Requests;
import { ChevronsRight, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Signup = () => {
  const navigate  = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    const res  = await fetch("http://127.0.0.1:8000/api/signup/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.status === "success") { alert("Account created successfully"); navigate("/login"); }
    else alert(data.message);
  };

  return (
    <>
      <style>{`
        .signup-root {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          background: #111;
          padding: 20px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          box-sizing: border-box;
        }
        .signup-card {
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px;
          display: flex;
          width: 100%; max-width: 820px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        }
        /* Left decorative panel */
        .signup-left {
          background: linear-gradient(135deg, #E50914 0%, #1a1a2e 100%);
          padding: 40px 32px;
          display: flex; flex-direction: column; justify-content: space-between;
          width: 45%; flex-shrink: 0;
        }
        .signup-left-icon { color: #fff; opacity: 0.9; }
        .signup-left-text h2 { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .signup-left-text p  { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.6; }
        /* Right form panel */
        .signup-right {
          flex: 1; padding: 40px 36px;
          display: flex; flex-direction: column; justify-content: center;
          background: #1a1a1a;
        }
        .signup-icon-wrap {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.28);
          display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
        }
        .signup-title    { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .signup-subtitle { font-size: 13px; color: rgba(255,255,255,0.38); margin-bottom: 24px; }
        .signup-form { display: flex; flex-direction: column; gap: 14px; }
        .signup-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 5px; display: block; }
        .signup-input {
          width: 100%; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
          padding: 12px 14px; font-size: 14px; color: #fff;
          font-family: inherit; outline: none;
          transition: border-color 0.2s; box-sizing: border-box;
        }
        .signup-input::placeholder { color: rgba(255,255,255,0.18); }
        .signup-input:focus { border-color: rgba(229,9,20,0.5); background: rgba(229,9,20,0.03); }
        .signup-btn {
          width: 100%; padding: 13px; border-radius: 8px; border: none;
          background: #E50914; color: #fff;
          font-size: 13px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: background 0.15s; margin-top: 4px;
        }
        .signup-btn:hover { background: #f40612; }
        .signup-footer { text-align: center; font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 16px; }
        .signup-footer a { color: #E50914; font-weight: 600; text-decoration: none; }
        .signup-footer a:hover { text-decoration: underline; }

        @media (max-width: 600px) {
          .signup-left   { display: none; }
          .signup-card   { max-width: 420px; }
          .signup-right  { padding: 32px 24px; }
        }
      `}</style>

      <div className="signup-root">
        <div className="signup-card">
          {/* Left */}
          <div className="signup-left">
            <div className="signup-left-icon"><ChevronsRight size={36} /></div>
            <div className="signup-left-text">
              <h2>Join us today</h2>
              <p>Create your account and start using SwiftRescue emergency response system.</p>
            </div>
          </div>

          {/* Right */}
          <div className="signup-right">
            <div className="signup-icon-wrap"><UserPlus size={20} color="#E50914" /></div>
            <div className="signup-title">Create an account</div>
            <div className="signup-subtitle">Sign up to access your personal dashboard</div>

            <form className="signup-form" onSubmit={handleSignup}>
              <div>
                <label className="signup-label">Username</label>
                <input className="signup-input" type="text" required placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="signup-label">Password</label>
                <input className="signup-input" type="password" required placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <button type="submit" className="signup-btn">Sign Up →</button>
            </form>

            <div className="signup-footer">
              Already have an account? <Link to="/login">Login</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
import { useState, useEffect } from "react";
import { Bell, Search, LogOut, Activity, MapPin, Clock, AlertCircle } from 'lucide-react';

// ============================================================================
// NETFLIX-STYLE THEME PROVIDER
// ============================================================================

export const themeConfig = {
  colors: {
    bg: '#0a0a0f',        // Nearly pure black
    surface: '#0d0d14',    // Slightly lighter black
    border: '#1a1a2e',     // Dark borders
    text: '#e8e8f0',       // Off-white text
    textSecondary: '#888899', // Muted gray
    accent: '#ff2d55',     // Bold red (Netflix-style)
    success: '#00d4aa',    // Green for available
    warning: '#f7c948',    // Gold for en route
    error: '#ff2d55',      // Red for busy
  },
  fonts: {
    display: "'Outfit', 'Helvetica Neue', sans-serif",
    body: "'Outfit', 'Helvetica Neue', sans-serif",
    mono: "'Courier New', monospace"
  }
};

// ============================================================================
// TOP NAVBAR - Netflix Style
// ============================================================================

export const Topnavbar = () => {
  const [user] = useState(localStorage.getItem("name") || "User");
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("name");
    window.location.reload();
  };

  return (
    <nav
      style={{
        background: themeConfig.colors.bg,
        borderBottom: `1px solid ${themeConfig.colors.border}`,
        fontFamily: themeConfig.fonts.body,
      }}
      className="fixed top-0 left-0 right-0 h-16 flex items-center px-8 gap-6 z-50"
    >
      {/* Logo */}
      <div style={{
        background: 'linear-gradient(135deg, #ff2d55 0%, #ff6b35 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }} className="text-2xl font-black tracking-tighter">
        SwiftRescue
      </div>

      {/* Search */}
      <div
        style={{
          background: themeConfig.colors.surface,
          border: `1px solid ${themeConfig.colors.border}`,
        }}
        className="flex items-center gap-3 rounded-lg px-4 py-2 flex-1 max-w-sm"
      >
        <Search size={16} color={themeConfig.colors.textSecondary} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ambulances, drivers..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: themeConfig.colors.text,
            fontFamily: themeConfig.fonts.body,
            fontSize: '14px',
            width: '100%',
          }}
        />
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <button
        style={{
          background: themeConfig.colors.surface,
          border: `1px solid ${themeConfig.colors.border}`,
          color: themeConfig.colors.textSecondary,
        }}
        className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition"
      >
        <Bell size={18} />
      </button>

      {/* User Menu */}
      <div className="flex items-center gap-3 pl-6 border-l" style={{ borderColor: themeConfig.colors.border }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #ff2d55, #ff6b35)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: themeConfig.colors.bg,
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          {user[0].toUpperCase()}
        </div>

        <div>
          <p style={{ color: themeConfig.colors.text, fontSize: '14px', fontWeight: 600 }}>
            {user}
          </p>
          <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px' }}>
            Dispatcher
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            color: themeConfig.colors.accent,
            cursor: 'pointer',
          }}
          className="ml-3 hover:opacity-80 transition"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
};

// ============================================================================
// STATS CARDS - Netflix Grid
// ============================================================================

const StatsCard = ({ label, value, gradient, icon: Icon }) => (
  <div
    style={{
      background: themeConfig.colors.surface,
      border: `1px solid ${themeConfig.colors.border}`,
      borderRadius: '16px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}
    className="group"
  >
    {/* Top gradient bar */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: gradient,
      }}
    />

    <div className="flex items-start justify-between">
      <div>
        <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </p>
        <p style={{
          color: themeConfig.colors.text,
          fontSize: '36px',
          fontWeight: 900,
          fontFamily: themeConfig.fonts.mono,
          marginTop: '8px',
          letterSpacing: '-1px',
        }}>
          {String(value).padStart(2, '0')}
        </p>
      </div>
      {Icon && (
        <div style={{ opacity: 0.2 }}>
          <Icon size={32} color={themeConfig.colors.textSecondary} />
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// AMBULANCE CARD - Netflix Style
// ============================================================================

const AmbulanceCard = ({ ambulance }) => {
  const statusConfig = {
    available: { label: 'Available', bg: '#0d2818', color: '#00d4aa', border: '#0d4028' },
    en_route: { label: 'En Route', bg: '#2a1a08', color: '#f7c948', border: '#4a2a08' },
    busy: { label: 'Busy', bg: '#2a0a0a', color: '#ff2d55', border: '#4a1a1a' },
    offline: { label: 'Offline', bg: '#1a1a1a', color: '#888888', border: '#2a2a2a' },
  };

  const status = statusConfig[ambulance.status] || statusConfig.offline;

  return (
    <div
      style={{
        background: themeConfig.colors.surface,
        border: `1px solid ${themeConfig.colors.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
      className="group hover:border-opacity-100 transition-all duration-300"
    >
      {/* Image Section */}
      <div className="relative h-40 overflow-hidden bg-gray-900">
        <img
          src="https://nnccalcutta.in/wp-content/uploads/2022/04/166-1665783_2048x1536-ambulance-wallpapers-data-id-377442-high-quality-768x576.jpg"
          alt={ambulance.ambulance_number}
          className="w-full h-full object-cover opacity-60 group-hover:opacity-75 transition"
          style={{ filter: 'saturate(0.4)' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, transparent 40%, ' + themeConfig.colors.surface + ')',
          }}
        />

        {/* Status Badge Overlay */}
        <div className="absolute top-4 right-4">
          <span
            style={{
              background: status.bg,
              color: status.color,
              border: `1px solid ${status.border}`,
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4">
        {/* Header */}
        <div>
          <p style={{ color: themeConfig.colors.text, fontSize: '18px', fontWeight: 900, fontFamily: themeConfig.fonts.mono, letterSpacing: '1px' }}>
            {ambulance.ambulance_number}
          </p>
          <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
            {ambulance.model}
          </p>
        </div>

        {/* Driver Info */}
        <div className="space-y-2 py-2" style={{ borderTop: `1px solid ${themeConfig.colors.border}`, borderBottom: `1px solid ${themeConfig.colors.border}` }}>
          <div className="flex justify-between items-center">
            <span style={{ color: themeConfig.colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Driver
            </span>
            <span style={{ color: themeConfig.colors.text, fontSize: '13px', fontWeight: 500 }}>
              {ambulance.driver}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: themeConfig.colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Contact
            </span>
            <span style={{ color: themeConfig.colors.text, fontSize: '13px', fontFamily: themeConfig.fonts.mono }}>
              {ambulance.driver_contact}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: themeConfig.colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Speed
            </span>
            <span style={{ color: themeConfig.colors.text, fontSize: '13px' }}>
              {ambulance.speed} km/h
            </span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2">
          <MapPin size={14} color={themeConfig.colors.accent} />
          <span style={{ color: themeConfig.colors.textSecondary, fontSize: '12px' }} className="truncate">
            {ambulance.location}
          </span>
        </div>

        {/* ETA Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '16px', fontWeight: 900, fontFamily: themeConfig.fonts.mono }}>
              {ambulance.nearest_hospital || '—'}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Nearest
            </p>
          </div>
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '16px', fontWeight: 900, fontFamily: themeConfig.fonts.mono }}>
              {ambulance.eta_to_hospital || '—'}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              ETA Hosp
            </p>
          </div>
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '16px', fontWeight: 900, fontFamily: themeConfig.fonts.mono }}>
              {ambulance.eta_to_patient || '—'}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              ETA Patient
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div
        style={{
          borderTop: `1px solid ${themeConfig.colors.border}`,
          padding: '12px',
        }}
      >
        <button
          style={{
            background: 'linear-gradient(135deg, #ff2d55, #ff6b35)',
            color: 'white',
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
          className="hover:opacity-90 transition"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// ACTIVITY FEED - Netflix Style
// ============================================================================

const ActivityFeed = ({ ambulances }) => (
  <div
    style={{
      background: themeConfig.colors.surface,
      border: `1px solid ${themeConfig.colors.border}`,
      borderRadius: '16px',
      padding: '24px',
    }}
  >
    <h2 style={{
      color: themeConfig.colors.text,
      fontSize: '20px',
      fontWeight: 900,
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <Activity size={20} color={themeConfig.colors.accent} />
      Recent Activity
    </h2>

    <div className="space-y-3">
      {ambulances.slice(0, 5).map((ambulance, idx) => (
        <div
          key={idx}
          style={{
            padding: '12px',
            background: themeConfig.colors.bg,
            borderRadius: '8px',
            border: `1px solid ${themeConfig.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          className="group hover:border-opacity-100 transition"
        >
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '14px', fontWeight: 600 }}>
              {ambulance.driver}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
              {ambulance.ambulance_number} • {ambulance.status}
            </p>
          </div>
          <button
            style={{
              background: themeConfig.colors.accent,
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
            className="hover:opacity-90 transition"
          >
            Check
          </button>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// MAIN DASHBOARD - Netflix Style
// ============================================================================

export const Dashboard = () => {
  const [ambulances, setAmbulances] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/ambulances/")
      .then((res) => res.json())
      .then((data) => setAmbulances(data))
      .catch((err) => console.log(err));
  }, []);

  const getCount = (status) => {
    if (status === 'total') return ambulances.length;
    return ambulances.filter((a) => a.status === status).length;
  };

  return (
    <div
      style={{
        background: themeConfig.colors.bg,
        color: themeConfig.colors.text,
        fontFamily: themeConfig.fonts.body,
        minHeight: '100vh',
        paddingTop: '80px',
      }}
    >
      {/* HERO SECTION */}
      <div style={{ padding: '60px 40px 40px' }}>
        <div style={{ marginBottom: '40px' }}>
          <p style={{
            color: themeConfig.colors.textSecondary,
            fontSize: '12px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: '12px',
          }}>
            // Fleet Operations Center
          </p>
          <h1 style={{
            color: themeConfig.colors.text,
            fontSize: '48px',
            fontWeight: 900,
            lineHeight: '1.1',
            letterSpacing: '-2px',
            marginBottom: '12px',
          }}>
            Ambulance Network
          </h1>
          <p style={{
            color: themeConfig.colors.textSecondary,
            fontSize: '16px',
            marginTop: '8px',
          }}>
            Life Doesn't Wait — Neither Do We
          </p>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-4 gap-4 mb-12">
          <StatsCard
            label="Total Fleet"
            value={getCount('total')}
            gradient="linear-gradient(to right, #ff2d55, #ff6b35)"
            icon={AlertCircle}
          />
          <StatsCard
            label="Available"
            value={getCount('available')}
            gradient="linear-gradient(to right, #00d4aa, #00a8ff)"
            icon={Activity}
          />
          <StatsCard
            label="En Route"
            value={getCount('en_route')}
            gradient="linear-gradient(to right, #f7c948, #ff6b35)"
            icon={Clock}
          />
          <StatsCard
            label="Busy"
            value={getCount('busy')}
            gradient="linear-gradient(to right, #a78bfa, #ff2d55)"
            icon={AlertCircle}
          />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Ambulance Cards */}
          <div className="col-span-2">
            <div className="grid grid-cols-2 gap-4">
              {ambulances.map((ambulance, idx) => (
                <AmbulanceCard key={idx} ambulance={ambulance} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <ActivityFeed ambulances={ambulances} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPLETE APP
// ============================================================================

export default function App() {
  return (
    <div style={{ background: themeConfig.colors.bg }}>
      <Topnavbar />
      <Dashboard />
    </div>
  );
}
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Homepage              from "./Pages/Homepage";
import Reports               from "./Pages/Reports";
import Requests              from "./Pages/Request";
import Leftsidebar           from "./Components/Leftsidebar";
import Topnavbar             from "./Components/Topnavbar";
import Ambulances            from "./Pages/Ambulances";
import Hospitals             from "./Pages/Hospitals";
import Login                 from "./Pages/Login";
import Signup                from "./Pages/Signup";
import BookingDetails        from "./Pages/BookingDetails";
import DriverView            from "./Pages/DriverView";
import DriverDashboard       from "./Pages/DriverDashboard";
import DriverChangeRequests  from "./Pages/DriverChangeRequests";
import LiveMap               from "./Pages/LiveMap";
import MapView               from "./Pages/Mapview";
import UserLiveTracking      from "./Components/UserLiveTracking"; // ✅ NEW
import MyBookings            from "./Pages/MyBookings";            // ✅ NEW

// ── Route guards ──────────────────────────────────────────────────────────
const AdminRoute = ({ element }) => {
  const role = localStorage.getItem("role");
  return role === "admin" ? element : <Navigate to="/Ambulances" replace />;
};

const ProtectedRoute = ({ element }) => {
  const user = localStorage.getItem("user");
  return user ? element : <Navigate to="/Login" replace />;
};

const DriverAwareRoute = ({ driverElement, defaultElement }) => {
  const role = localStorage.getItem("role");
  if (role === "driver") return <ProtectedRoute element={driverElement} />;
  return <ProtectedRoute element={defaultElement} />;
};

const App = () => {
  const { pathname } = useLocation();
  const p    = pathname.toLowerCase();
  const role = localStorage.getItem("role");

  const isAuth    = p === "/login" || p === "/signup";
  const isMapView = p === "/directions";

  // UserLiveTracking sirf user role ke liye dikhao
  const isUser = role !== "admin" && role !== "driver" && !!localStorage.getItem("user");

  return (
    <>
      {!isAuth && !isMapView && <Leftsidebar />}
      {!isAuth && !isMapView && <Topnavbar />}

      {/* ✅ User ke confirmed booking par live ambulance tracking */}
      {!isAuth && !isMapView && isUser && <UserLiveTracking />}

      <Routes>
        {/* Public */}
        <Route path="/Login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Homepage */}
        <Route path="/" element={
          <DriverAwareRoute
            driverElement={<DriverDashboard />}
            defaultElement={<Homepage />}
          />
        } />

        {/* Driver dashboard */}
        <Route path="/driver-dashboard" element={<ProtectedRoute element={<DriverDashboard />} />} />

        {/* Legacy driver GPS view */}
        <Route path="/driver/:id" element={<ProtectedRoute element={<DriverView />} />} />
        <Route path="/DriverView"  element={<ProtectedRoute element={<DriverView />} />} />

        {/* Shared pages */}
        <Route path="/Ambulances" element={<ProtectedRoute element={<Ambulances />} />} />
        <Route path="/Hospitals"  element={<ProtectedRoute element={<Hospitals />} />} />
        <Route path="/MyBookings" element={<ProtectedRoute element={<MyBookings />} />} /> {/* ✅ NEW */}
        <Route path="/directions" element={<ProtectedRoute element={<MapView />} />} />

        {/* Admin only */}
        <Route path="/Reports"              element={<AdminRoute element={<Reports />} />} />
        <Route path="/Requests"             element={<AdminRoute element={<Requests />} />} />
        <Route path="/bookings"             element={<AdminRoute element={<BookingDetails />} />} />
        <Route path="/LiveMap"              element={<AdminRoute element={<LiveMap />} />} />
        <Route path="/DriverChangeRequests" element={<AdminRoute element={<DriverChangeRequests />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
@import "tailwindcss";

@font-face {
    font-family: font1;
    src: url(../public/ambulancefonts/Arthur\ Matilde\ DEMO\ VERSION.otf);
}
@font-face {
    font-family: font2;
    src: url(../public/ambulancefonts/Arthur\ Matilde\ Italic\ DEMO\ VERSION.otf);
}
@font-face {
    font-family: font3;
    src: url(../public/ambulancefonts/cornella-Regular.otf);
}
@font-face {
    font-family: font4;
    src: url(../public/ambulancefonts/Debaznue\ PERSONAL\ USE\ ONLY!.ttf);
}
@font-face {
    font-family: font5;
    src: url(../public/ambulancefonts/Hannah\ Claira\ DEMO\ VERSION.otf);
}
@font-face {
    font-family: font6;
    src: url(../public/ambulancefonts/Hannah\ Claira\ Italic\ DEMO\ VERSION.otf);
}
@font-face {
    font-family: font7;
    src: url(../public/ambulancefonts/Makien\ DEMO\ VERSION.ttf);
}
@font-face {
    font-family: font8;
    src: url(../public/ambulancefonts/Makien\ Italic\ DEMO\ VERSION.otf);
}
@font-face {
    font-family: font9;
    src: url(../public/ambulancefonts/Margelin\ DEMO\ VERSION.otf);
}
@font-face {
    font-family: font10;
    src: url(../public/ambulancefonts/Margelin\ Italic\ DEMO\ VERSION.otf);
}
@font-face {
    font-family: font11;
    src: url(../public/ambulancefonts/Qafinte.otf);
}
@font-face {
    font-family: font12;
    src: url(../public/ambulancefonts/RoclinePersonalUseOnly-Regular.ttf);
}

/* ── Global reset ── */
*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow-x: hidden;
}

body {
  background: #0a0a0f;
  color: #e8e8f0;
}

/* Root — full width, no restrictions */
#root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

/* Thin scrollbar */
::-webkit-scrollbar       { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
/* ============================================================
   DRIVER DASHBOARD — Netflix-style CSS additions
   Add this to DriverDashboard.jsx inside the <style> block
   (or keep as a separate CSS module / global import)
   ============================================================ */

/*
  Key changes vs original:
  - tighter padding on header and tabs
  - card gaps reduced to 10px
  - consistent border-radius: 10px
  - booking cards have Netflix card look
  - stat cards same as ambulance/hospital stats
*/

.dd-root {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  padding-top: 56px;
  padding-left: 64px;
}

/* Header */
.dd-header {
  background: #111;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 10px 16px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}

/* Tabs */
.dd-tabs-desktop {
  display: flex;
  background: #111;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  overflow-x: auto; scrollbar-width: none;
}
.dd-tabs-desktop::-webkit-scrollbar { display: none; }
.dd-tab {
  flex: 1; min-width: fit-content; padding: 10px 10px;
  text-align: center; font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,0.35); cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s; white-space: nowrap;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.dd-tab.active { color: #fff; border-bottom-color: #E50914; }
.dd-tab:hover:not(.active) { color: rgba(255,255,255,0.7); }
.dd-tab-badge {
  background: #E50914; color: #fff;
  font-size: 9px; font-weight: 800;
  border-radius: 8px; padding: 1px 5px; min-width: 14px; text-align: center;
}

/* Map layout */
.dd-map-layout {
  display: flex;
  height: calc(100vh - 56px - 44px - 50px);
}
.dd-sidebar {
  width: 260px; min-width: 260px;
  background: #111;
  border-right: 1px solid rgba(255,255,255,0.06);
  padding: 10px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
  flex-shrink: 0;
}
.dd-map-wrap { flex: 1; position: relative; min-width: 0; }

/* Cards inside sidebar */
.dd-card {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 12px;
}
.dd-card-title {
  font-weight: 700; font-size: 11px; margin-bottom: 8px;
  color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;
}

/* Booking cards in tabs */
.dd-booking-card {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 14px;
  display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;
}

/* Content area */
.dd-content {
  max-width: 900px; margin: 0 auto; padding: 16px 16px 80px;
}

/* Buttons */
.dd-btn {
  border: none; border-radius: 8px; padding: 10px 14px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  font-family: inherit; transition: all 0.15s; width: 100%; margin-top: 5px;
}
.dd-btn-red   { background: #E50914; color: #fff; }
.dd-btn-red:hover { background: #f40612; }
.dd-btn-green { background: #00c853; color: #000; }
.dd-btn-green:hover { background: #00e060; }
.dd-btn-grey  { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.08); }

/* Mobile bottom nav */
.dd-bottom-nav {
  display: none; position: fixed; bottom: 0; left: 0; right: 0;
  height: 58px; background: #111;
  border-top: 1px solid rgba(255,255,255,0.06);
  z-index: 99999; align-items: center; justify-content: space-around;
}

@media (max-width: 767px) {
  .dd-root { padding-top: 56px !important; padding-left: 0 !important; padding-bottom: 58px !important; }
  .dd-tabs-desktop { display: none !important; }
  .dd-bottom-nav { display: flex !important; }
  .dd-map-layout { flex-direction: column; height: calc(100vh - 56px - 58px); }
  .dd-sidebar { width: 100%; min-width: unset; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); max-height: 220px; }
  .dd-map-wrap { flex: 1; min-height: 180px; }
  .dd-content { padding: 12px 12px 80px; }
}
/* ============================================================
   DRIVER DASHBOARD — Netflix-style CSS additions
   Add this to DriverDashboard.jsx inside the <style> block
   (or keep as a separate CSS module / global import)
   ============================================================ */

/*
  Key changes vs original:
  - tighter padding on header and tabs
  - card gaps reduced to 10px
  - consistent border-radius: 10px
  - booking cards have Netflix card look
  - stat cards same as ambulance/hospital stats
*/

.dd-root {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  padding-top: 56px;
  padding-left: 64px;
}

/* Header */
.dd-header {
  background: #111;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 10px 16px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}

/* Tabs */
.dd-tabs-desktop {
  display: flex;
  background: #111;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  overflow-x: auto; scrollbar-width: none;
}
.dd-tabs-desktop::-webkit-scrollbar { display: none; }
.dd-tab {
  flex: 1; min-width: fit-content; padding: 10px 10px;
  text-align: center; font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,0.35); cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s; white-space: nowrap;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.dd-tab.active { color: #fff; border-bottom-color: #E50914; }
.dd-tab:hover:not(.active) { color: rgba(255,255,255,0.7); }
.dd-tab-badge {
  background: #E50914; color: #fff;
  font-size: 9px; font-weight: 800;
  border-radius: 8px; padding: 1px 5px; min-width: 14px; text-align: center;
}

/* Map layout */
.dd-map-layout {
  display: flex;
  height: calc(100vh - 56px - 44px - 50px);
}
.dd-sidebar {
  width: 260px; min-width: 260px;
  background: #111;
  border-right: 1px solid rgba(255,255,255,0.06);
  padding: 10px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
  flex-shrink: 0;
}
.dd-map-wrap { flex: 1; position: relative; min-width: 0; }

/* Cards inside sidebar */
.dd-card {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 12px;
}
.dd-card-title {
  font-weight: 700; font-size: 11px; margin-bottom: 8px;
  color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;
}

/* Booking cards in tabs */
.dd-booking-card {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 14px;
  display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;
}

/* Content area */
.dd-content {
  max-width: 900px; margin: 0 auto; padding: 16px 16px 80px;
}

/* Buttons */
.dd-btn {
  border: none; border-radius: 8px; padding: 10px 14px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  font-family: inherit; transition: all 0.15s; width: 100%; margin-top: 5px;
}
.dd-btn-red   { background: #E50914; color: #fff; }
.dd-btn-red:hover { background: #f40612; }
.dd-btn-green { background: #00c853; color: #000; }
.dd-btn-green:hover { background: #00e060; }
.dd-btn-grey  { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.08); }

/* Mobile bottom nav */
.dd-bottom-nav {
  display: none; position: fixed; bottom: 0; left: 0; right: 0;
  height: 58px; background: #111;
  border-top: 1px solid rgba(255,255,255,0.06);
  z-index: 99999; align-items: center; justify-content: space-around;
}

@media (max-width: 767px) {
  .dd-root { padding-top: 56px !important; padding-left: 0 !important; padding-bottom: 58px !important; }
  .dd-tabs-desktop { display: none !important; }
  .dd-bottom-nav { display: flex !important; }
  .dd-map-layout { flex-direction: column; height: calc(100vh - 56px - 58px); }
  .dd-sidebar { width: 100%; min-width: unset; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); max-height: 220px; }
  .dd-map-wrap { flex: 1; min-height: 180px; }
  .dd-content { padding: 12px 12px 80px; }
}
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext.jsx'


createRoot(document.getElementById('root')).render(
  <>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </>
)import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const themes = {
  dark: {
    dot: "#1a1a2e",
    dotBorder: "#555",
    vars: {
      "--sr-bg":               "#0f0f0f",
      "--sr-surface":          "#1a1a1a",
      "--sr-card":             "#222222",
      "--sr-border":           "rgba(255,255,255,0.08)",
      "--sr-text":             "#ffffff",
      "--sr-text-sub":         "rgba(255,255,255,0.4)",
      "--sr-text-muted":       "rgba(255,255,255,0.22)",
      // Page-level text (same as card text in dark)
      "--sr-page-text":        "#ffffff",
      "--sr-page-text-sub":    "rgba(255,255,255,0.4)",
      "--sr-page-text-muted":  "rgba(255,255,255,0.22)",
      "--sr-accent":           "#E50914",
      "--sr-nav-bg":           "#141414",
      "--sr-nav-text":         "#ffffff",
      "--sr-nav-text-sub":     "rgba(255,255,255,0.5)",
      "--sr-nav-text-muted":   "rgba(255,255,255,0.25)",
      "--sr-nav-border":       "rgba(255,255,255,0.08)",
      "--sr-nav-input-bg":     "rgba(255,255,255,0.06)",
      "--sr-nav-input-border": "rgba(255,255,255,0.12)",
      "--sr-input-bg":         "rgba(255,255,255,0.06)",
      "--sr-input-border":     "rgba(255,255,255,0.12)",
      "--sr-input-text":       "#ffffff",
      "--sr-placeholder":      "rgba(255,255,255,0.25)",
      "--sr-hover":            "rgba(255,255,255,0.05)",
      "--sr-stat-bg":          "#1a1a1a",
      "--sr-modal-bg":         "#1a1a1a",
      "--sr-sidebar-bg":       "#141414",
      "--sr-sidebar-text":     "rgba(255,255,255,0.55)",
      "--sr-sidebar-active":   "rgba(229,9,20,0.15)",
      "--sr-sidebar-border":   "rgba(255,255,255,0.06)",
      "--sr-scrollbar":        "rgba(255,255,255,0.1)",
      "--sr-shadow":           "rgba(0,0,0,0.6)",
      "--sr-badge-bg":         "rgba(255,255,255,0.08)",
      "--sr-badge-text":       "rgba(255,255,255,0.6)",
      "--sr-chart-grid":       "rgba(255,255,255,0.06)",
      "--sr-chart-label":      "rgba(255,255,255,0.4)",
      "--sr-icon":             "rgba(255,255,255,0.5)",
      "--sr-icon-hover":       "#ffffff",
      "--sr-success-bg":       "rgba(0,212,170,0.12)",
      "--sr-success-text":     "#00d4aa",
      "--sr-warning-bg":       "rgba(247,201,72,0.12)",
      "--sr-warning-text":     "#f7c948",
      "--sr-danger-bg":        "rgba(229,9,20,0.12)",
      "--sr-danger-text":      "#ff4d5a",
    },
  },
  grey: {
    dot: "#888888",
    dotBorder: "#aaa",
    vars: {
      "--sr-bg":               "#2a2a2a",
      "--sr-surface":          "#333333",
      "--sr-card":             "#3c3c3c",
      "--sr-border":           "rgba(255,255,255,0.12)",
      "--sr-text":             "#f0f0f0",
      "--sr-text-sub":         "rgba(240,240,240,0.55)",
      "--sr-text-muted":       "rgba(240,240,240,0.3)",
      "--sr-page-text":        "#f0f0f0",
      "--sr-page-text-sub":    "rgba(240,240,240,0.55)",
      "--sr-page-text-muted":  "rgba(240,240,240,0.3)",
      "--sr-accent":           "#E50914",
      "--sr-nav-bg":           "#2a2a2a",
      "--sr-nav-text":         "#f0f0f0",
      "--sr-nav-text-sub":     "rgba(240,240,240,0.55)",
      "--sr-nav-text-muted":   "rgba(240,240,240,0.3)",
      "--sr-nav-border":       "rgba(255,255,255,0.12)",
      "--sr-nav-input-bg":     "rgba(255,255,255,0.1)",
      "--sr-nav-input-border": "rgba(255,255,255,0.18)",
      "--sr-input-bg":         "rgba(255,255,255,0.1)",
      "--sr-input-border":     "rgba(255,255,255,0.18)",
      "--sr-input-text":       "#f0f0f0",
      "--sr-placeholder":      "rgba(240,240,240,0.3)",
      "--sr-hover":            "rgba(255,255,255,0.08)",
      "--sr-stat-bg":          "#333333",
      "--sr-modal-bg":         "#333333",
      "--sr-sidebar-bg":       "#252525",
      "--sr-sidebar-text":     "rgba(240,240,240,0.55)",
      "--sr-sidebar-active":   "rgba(229,9,20,0.15)",
      "--sr-sidebar-border":   "rgba(255,255,255,0.08)",
      "--sr-scrollbar":        "rgba(255,255,255,0.15)",
      "--sr-shadow":           "rgba(0,0,0,0.5)",
      "--sr-badge-bg":         "rgba(255,255,255,0.1)",
      "--sr-badge-text":       "rgba(240,240,240,0.6)",
      "--sr-chart-grid":       "rgba(255,255,255,0.08)",
      "--sr-chart-label":      "rgba(240,240,240,0.45)",
      "--sr-icon":             "rgba(240,240,240,0.5)",
      "--sr-icon-hover":       "#f0f0f0",
      "--sr-success-bg":       "rgba(0,212,170,0.12)",
      "--sr-success-text":     "#00d4aa",
      "--sr-warning-bg":       "rgba(247,201,72,0.12)",
      "--sr-warning-text":     "#f7c948",
      "--sr-danger-bg":        "rgba(229,9,20,0.12)",
      "--sr-danger-text":      "#ff4d5a",
    },
  },
  white: {
    dot: "#e0e0e0",
    dotBorder: "#bbb",
    vars: {
      // Page background is LIGHT
      "--sr-bg":               "#f4f5f7",
      // Page-level text must be DARK (on light bg)
      "--sr-page-text":        "#111111",
      "--sr-page-text-sub":    "rgba(0,0,0,0.55)",
      "--sr-page-text-muted":  "rgba(0,0,0,0.35)",
      // Navbar stays white with dark text
      "--sr-nav-bg":           "#ffffff",
      "--sr-nav-text":         "#111111",
      "--sr-nav-text-sub":     "rgba(0,0,0,0.55)",
      "--sr-nav-text-muted":   "rgba(0,0,0,0.35)",
      "--sr-nav-border":       "rgba(0,0,0,0.08)",
      "--sr-nav-input-bg":     "rgba(0,0,0,0.05)",
      "--sr-nav-input-border": "rgba(0,0,0,0.15)",
      // Cards/surfaces are DARK with red accent
      "--sr-surface":          "#1a1a1a",
      "--sr-card":             "#222222",
      "--sr-stat-bg":          "#1e1214",
      "--sr-modal-bg":         "#1a1a1a",
      // Text ON dark cards = white
      "--sr-text":             "#ffffff",
      "--sr-text-sub":         "rgba(255,255,255,0.45)",
      "--sr-text-muted":       "rgba(255,255,255,0.25)",
      // Borders with red tint
      "--sr-border":           "rgba(229,9,20,0.18)",
      "--sr-accent":           "#E50914",
      // Inputs inside modals/cards (dark bg)
      "--sr-input-bg":         "rgba(255,255,255,0.06)",
      "--sr-input-border":     "rgba(255,255,255,0.12)",
      "--sr-input-text":       "#ffffff",
      "--sr-placeholder":      "rgba(255,255,255,0.25)",
      // Hover on dark cards
      "--sr-hover":            "rgba(229,9,20,0.08)",
      // Sidebar stays dark
      "--sr-sidebar-bg":       "#141414",
      "--sr-sidebar-text":     "rgba(255,255,255,0.55)",
      "--sr-sidebar-active":   "rgba(229,9,20,0.15)",
      "--sr-sidebar-border":   "rgba(255,255,255,0.06)",
      "--sr-scrollbar":        "rgba(229,9,20,0.25)",
      "--sr-shadow":           "rgba(229,9,20,0.15)",
      "--sr-badge-bg":         "rgba(229,9,20,0.12)",
      "--sr-badge-text":       "#ff4d5a",
      "--sr-chart-grid":       "rgba(255,255,255,0.06)",
      "--sr-chart-label":      "rgba(255,255,255,0.4)",
      "--sr-icon":             "rgba(255,255,255,0.45)",
      "--sr-icon-hover":       "#ffffff",
      "--sr-success-bg":       "rgba(0,212,170,0.12)",
      "--sr-success-text":     "#00d4aa",
      "--sr-warning-bg":       "rgba(247,201,72,0.12)",
      "--sr-warning-text":     "#f7c948",
      "--sr-danger-bg":        "rgba(229,9,20,0.15)",
      "--sr-danger-text":      "#ff4d5a",
    },
  },
};

const applyTheme = (key) => {
  const t = themes[key];
  if (!t) return;
  Object.entries(t.vars).forEach(([k, v]) =>
    document.documentElement.style.setProperty(k, v)
  );
  document.documentElement.setAttribute("data-theme", key);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(
    localStorage.getItem("sr-theme") || "dark"
  );

  const setTheme = (key) => {
    setThemeState(key);
    localStorage.setItem("sr-theme", key);
    applyTheme(key);
  };

  useEffect(() => {
    applyTheme(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
 theme update karo , ise har screen size ki hisab se responsive banao , gap aur padding and theme diye kye photo ki jaise honi chahiye 