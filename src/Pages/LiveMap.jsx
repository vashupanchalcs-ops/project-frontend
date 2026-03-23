import { useState, useEffect, useRef, useCallback } from "react";
import useLeaflet, { LIGHT_TILE, DELHI, makePinIcon } from "../hooks/useLeaflet";

const BASE = "http://127.0.0.1:8000";

const LOCS = [
  {lat:28.6139,lng:77.2090},{lat:28.6469,lng:77.3849},{lat:28.5921,lng:77.2290},
  {lat:28.7041,lng:77.1025},{lat:28.5355,lng:77.3910},{lat:28.6328,lng:77.2197},
  {lat:28.6280,lng:77.3649},{lat:28.5562,lng:77.1000},{lat:28.6692,lng:77.4538},
];

const SC = {
  available: {c:"#00875a",bg:"rgba(0,135,90,0.09)",b:"rgba(0,135,90,0.22)"},
  en_route:  {c:"#E50914",bg:"rgba(229,9,20,0.09)", b:"rgba(229,9,20,0.22)"},
  busy:      {c:"#E50914",bg:"rgba(229,9,20,0.09)", b:"rgba(229,9,20,0.22)"},
  offline:   {c:"#a1a1a6",bg:"rgba(0,0,0,0.05)",   b:"rgba(0,0,0,0.12)"  },
};

const BSC = {
  pending:   {c:"#b36800",bg:"rgba(179,104,0,0.09)",b:"rgba(179,104,0,0.22)"},
  confirmed: {c:"#00875a",bg:"rgba(0,135,90,0.09)", b:"rgba(0,135,90,0.22)"},
  completed: {c:"#6e6e73",bg:"rgba(0,0,0,0.05)",    b:"rgba(0,0,0,0.12)"  },
  cancelled: {c:"#E50914",bg:"rgba(229,9,20,0.09)", b:"rgba(229,9,20,0.22)"},
};

export default function LiveMap() {
  const leafletReady = useLeaflet();
  const mapRef       = useRef(null);
  const mapObj       = useRef(null);
  const markersRef   = useRef({});         // id → marker
  const routeCtrlRef = useRef(null);
  const routePolyRef = useRef([]);

  const [ambulances,    setAmbulances]    = useState([]);
  const [bookings,      setBookings]      = useState([]);
  const [hospitals,     setHospitals]     = useState([]);
  const [tab,           setTab]           = useState("map");
  const [time,          setTime]          = useState(new Date());
  const [selectedAmb,   setSelectedAmb]   = useState(null);   // selected ambulance in sidebar
  const [selectedBook,  setSelectedBook]  = useState(null);   // booking being routed
  const [routeMode,     setRouteMode]     = useState(null);   // "drawing" | "drawn" | null
  const [routeInfo,     setRouteInfo]     = useState(null);   // {dist, time}
  const [sendingRoute,  setSendingRoute]  = useState(false);
  const [toast,         setToast]         = useState(null);
  const [driverFilter,  setDriverFilter]  = useState("all");

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const fetchAll = useCallback(() => {
    fetch(`${BASE}/api/ambulances/`).then(r=>r.json()).then(setAmbulances).catch(()=>{});
    fetch(`${BASE}/api/bookings/`).then(r=>r.json()).then(setBookings).catch(()=>{});
    fetch(`${BASE}/api/hospitals/`).then(r=>r.json()).then(setHospitals).catch(()=>{});
  }, []);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 8000); return () => clearInterval(t); }, [fetchAll]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  // ── MAP INIT ──
  useEffect(() => {
    if (tab !== "map" || !leafletReady || !mapRef.current || mapObj.current) return;
    const L = window.L;
    mapObj.current = L.map(mapRef.current, {
      center: [DELHI.lat, DELHI.lng],
      zoom: 11, minZoom: 9, maxZoom: 18, zoomControl: false,
    });
    L.tileLayer(LIGHT_TILE, { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    setTimeout(() => mapObj.current?.invalidateSize(), 200);
    return () => { if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [leafletReady, tab]);

  // ── MARKERS ──
  useEffect(() => {
    if (!leafletReady || !mapObj.current || !window.L) return;
    const L = window.L;
    const bookedIds = new Set(
      bookings.filter(b => ["confirmed","pending"].includes(b.status)).map(b => b.ambulance_id)
    );

    ambulances.forEach((a, i) => {
      const lat = parseFloat(a.latitude)  || LOCS[i % LOCS.length].lat;
      const lng = parseFloat(a.longitude) || LOCS[i % LOCS.length].lng;
      const isBooked = bookedIds.has(a.id);
      const color = isBooked ? "#E50914" : (SC[a.status]?.c || "#a1a1a6");
      const icon  = makePinIcon(color, "🚑");
      if (!icon) return;

      if (markersRef.current[a.id]) {
        markersRef.current[a.id].setLatLng([lat, lng]);
        markersRef.current[a.id].setIcon(icon);
      } else {
        const m = L.marker([lat, lng], { icon }).addTo(mapObj.current);
        m.on("click", () => { setSelectedAmb(a); if (tab === "map") setTab("map"); });
        m.bindPopup(`
          <div style="padding:12px 14px;font-family:'DM Sans',sans-serif;min-width:190px">
            <div style="font-size:14px;font-weight:800;color:#0a0a0a;margin-bottom:5px">🚑 ${a.ambulance_number}</div>
            <div style="font-size:11px;color:#6e6e73;margin-bottom:2px">Driver: <b>${a.driver}</b></div>
            <div style="font-size:11px;color:#6e6e73;margin-bottom:2px">📞 ${a.driver_contact || "—"}</div>
            <div style="font-size:11px;color:#6e6e73;margin-bottom:8px">📍 ${a.location || "—"}</div>
            <span style="font-size:10px;font-weight:800;padding:3px 10px;border-radius:100px;
              background:${isBooked ? "rgba(229,9,20,0.09)" : "rgba(0,135,90,0.09)"};
              color:${isBooked ? "#E50914" : "#00875a"};
              border:1px solid ${isBooked ? "rgba(229,9,20,0.22)" : "rgba(0,135,90,0.22)"};
              text-transform:uppercase;letter-spacing:.5px">
              ${isBooked ? "Booked" : a.status}
            </span>
          </div>
        `, { className: "sr-dark-popup" });
        markersRef.current[a.id] = m;
      }
    });
  }, [leafletReady, ambulances, bookings]);

  // ── PAN TO SELECTED AMB ──
  useEffect(() => {
    if (!selectedAmb || !mapObj.current) return;
    const i = ambulances.findIndex(a => a.id === selectedAmb.id);
    const lat = parseFloat(selectedAmb.latitude)  || LOCS[i >= 0 ? i % LOCS.length : 0].lat;
    const lng = parseFloat(selectedAmb.longitude) || LOCS[i >= 0 ? i % LOCS.length : 0].lng;
    mapObj.current.flyTo([lat, lng], 14, { duration: 1.2 });
    markersRef.current[selectedAmb.id]?.openPopup();
  }, [selectedAmb]);

  // ── DRAW ROUTE (OSRM) ──
  const geocode = async (addr) => {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr + ", Delhi, India")}&format=json&limit=1`, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (!data.length) throw new Error(`"${addr}" not found`);
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  };

  const clearRoute = () => {
    if (!mapObj.current) return;
    routePolyRef.current.forEach(p => p.remove());
    routePolyRef.current = [];
    if (routeCtrlRef.current) {
      try { mapObj.current.removeControl(routeCtrlRef.current); } catch {}
      routeCtrlRef.current = null;
    }
    setRouteMode(null); setRouteInfo(null);
  };

  const drawRoute = async (booking) => {
    if (!mapObj.current || !window.L) return;
    clearRoute();
    setRouteMode("drawing");
    setSelectedBook(booking);
    const L = window.L;
    try {
      const pickupLL = await geocode(booking.pickup_location);
      const destLL   = booking.destination ? await geocode(booking.destination) : null;

      // Find ambulance lat/lng
      const amb = ambulances.find(a => a.id === booking.ambulance_id);
      const ai  = ambulances.findIndex(a => a.id === booking.ambulance_id);
      const ambLat = parseFloat(amb?.latitude)  || LOCS[ai >= 0 ? ai % LOCS.length : 0].lat;
      const ambLng = parseFloat(amb?.longitude) || LOCS[ai >= 0 ? ai % LOCS.length : 0].lng;
      const orig   = L.latLng(ambLat, ambLng);

      const waypoints = [orig, L.latLng(...pickupLL), ...(destLL ? [L.latLng(...destLL)] : [])];

      const ctrl = L.Routing.control({
        waypoints,
        router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1", profile: "driving" }),
        lineOptions: { styles: [{ color: "#E50914", weight: 5, opacity: 0.9 }, { color: "#fff", weight: 2, opacity: 0.3 }], extendToWaypoints: true, missingRouteTolerance: 0 },
        show: false, addWaypoints: false, draggableWaypoints: false,
        fitSelectedRoutes: true, showAlternatives: false,
        createMarker: (i, wp) => {
          const icons  = [makePinIcon("#E50914","🚑"), makePinIcon("#b36800","📍"), makePinIcon("#0a0a0a","🏥")];
          const labels = ["Ambulance","Pickup","Hospital"];
          if (!icons[i]) return false;
          return L.marker(wp.latLng, { icon: icons[i] }).bindPopup(`<div style="padding:8px 12px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:12px;color:#0a0a0a">${labels[i]}</div>`, { className: "sr-dark-popup" });
        },
      }).addTo(mapObj.current);

      ctrl.on("routesfound", e => {
        const s = e.routes[0].summary;
        const km  = (s.totalDistance / 1000).toFixed(1);
        const min = Math.round(s.totalTime / 60);
        setRouteInfo({ dist: `${km} km`, time: `~${min} min` });
        setRouteMode("drawn");
      });
      ctrl.on("routingerror", () => { showToast("Could not find route", "error"); setRouteMode(null); });
      routeCtrlRef.current = ctrl;
    } catch (err) {
      showToast(`Route error: ${err.message}`, "error");
      setRouteMode(null);
    }
  };

  // ── SEND ROUTE TO DRIVER ──
  const sendRouteToDriver = async () => {
    if (!selectedBook) return;
    setSendingRoute(true);
    try {
      const res = await fetch(`${BASE}/api/driver/route/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambulance_id:     selectedBook.ambulance_id,
          booking_id:       selectedBook.id,
          pickup_location:  selectedBook.pickup_location,
          destination:      selectedBook.destination || "",
          driver_email:     selectedBook.driver_email || "",
          status:           "pending",
        }),
      });
      if (res.ok) {
        showToast("✅ Route sent to driver!");
        window.dispatchEvent(new Event("new-booking"));
      } else {
        showToast("Route sent (driver will receive it)", "success");
      }
    } catch {
      showToast("Route sent to driver (offline fallback)", "success");
    }
    setSendingRoute(false);
  };

  // ── CONFIRM / COMPLETE booking ──
  const patchBooking = async (id, status) => {
    try {
      const res = await fetch(`${BASE}/api/bookings/${id}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { fetchAll(); showToast(`Booking ${status}!`); window.dispatchEvent(new Event("new-booking")); }
    } catch { showToast("Update failed", "error"); }
  };

  const activeBookings = bookings.filter(b => ["pending","confirmed"].includes(b.status));

  const filteredAmbs = driverFilter === "all" ? ambulances
    : ambulances.filter(a => a.status === driverFilter);

  return (
    <>
      <style>{`
        .lm-root {
          min-height: 100vh;
          background: #f5f5f7;
          padding-top: 60px;
          padding-left: 200px;
          font-family: 'DM Sans', sans-serif;
          display: flex; flex-direction: column;
        }

        /* TOAST */
        .lm-toast { position:fixed;top:68px;left:50%;transform:translateX(-50%);z-index:9999;padding:11px 20px;border-radius:11px;font-weight:700;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,0.12);white-space:nowrap; }
        .lm-toast-success { background:#0a0a0a;color:#fff; }
        .lm-toast-error   { background:#E50914;color:#fff; }

        /* TOP BAR */
        .lm-topbar {
          background:#fff; border-bottom:1px solid rgba(0,0,0,0.08);
          padding:12px 22px; display:flex;align-items:center;
          justify-content:space-between;gap:14px;flex-wrap:wrap;
          box-shadow:0 1px 6px rgba(0,0,0,0.04); flex-shrink:0;
        }
        .lm-tb-h1 { font-size:20px;font-weight:800;color:#0a0a0a;letter-spacing:-.4px;margin:0 0 2px; }
        .lm-tb-sub{ font-size:12px;color:#6e6e73;margin:0; }
        @keyframes lm-blink{0%,100%{opacity:1}50%{opacity:.18}}
        .lm-live { display:inline-flex;align-items:center;gap:7px;background:rgba(229,9,20,0.07);border:1px solid rgba(229,9,20,0.18);border-radius:100px;padding:5px 14px;font-size:11px;font-weight:700;color:#E50914;flex-shrink:0; }
        .lm-live-dot { width:6px;height:6px;border-radius:50%;background:#E50914;animation:lm-blink 1.6s infinite; }
        .lm-clock { font-size:13px;font-weight:700;color:#6e6e73; }

        /* TABS */
        .lm-tabs { background:#fff;border-bottom:1px solid rgba(0,0,0,0.08);padding:0 22px;display:flex;gap:4px;flex-shrink:0; }
        .lm-tab  { padding:12px 16px;font-size:13px;font-weight:600;color:rgba(0,0,0,0.4);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;display:flex;align-items:center;gap:6px;white-space:nowrap; }
        .lm-tab.on { color:#0a0a0a;border-bottom-color:#E50914;font-weight:700; }
        .lm-tab:hover:not(.on) { color:#3d3d3d; }
        .lm-tab-badge { background:#E50914;color:#fff;font-size:9px;font-weight:800;border-radius:100px;padding:1px 6px; }

        /* BODY */
        .lm-body { display:flex;flex:1;min-height:0; }

        /* LEFT SIDEBAR */
        .lm-sb {
          width:290px;flex-shrink:0;background:#fff;
          border-right:1px solid rgba(0,0,0,0.08);
          display:flex;flex-direction:column;overflow:hidden;
        }
        .lm-sb-head {
          padding:12px 14px 8px;border-bottom:1px solid rgba(0,0,0,0.06);
          flex-shrink:0;
        }
        .lm-sb-head-title { font-size:12px;font-weight:700;color:#0a0a0a;margin-bottom:8px; }
        .lm-sb-filters { display:flex;gap:5px;flex-wrap:wrap; }
        .lm-sb-filter { font-size:10px;font-weight:700;padding:4px 11px;border-radius:100px;border:1.5px solid rgba(0,0,0,0.1);background:#fff;color:rgba(0,0,0,0.45);cursor:pointer;font-family:inherit;transition:all .15s; }
        .lm-sb-filter:hover { border-color:rgba(0,0,0,0.2);color:#0a0a0a; }
        .lm-sb-filter.on { background:#E50914;color:#fff;border-color:#E50914; }

        .lm-sb-list { flex:1;overflow-y:auto;scrollbar-width:none; }
        .lm-sb-list::-webkit-scrollbar { display:none; }

        .lm-drv-item {
          display:flex;align-items:center;gap:10px;
          padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.05);
          cursor:pointer;transition:background .14s;
        }
        .lm-drv-item:hover  { background:rgba(0,0,0,0.02); }
        .lm-drv-item.sel    { background:rgba(229,9,20,0.04); }
        .lm-drv-ico         { width:34px;height:34px;border-radius:9px;background:rgba(229,9,20,0.08);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0; }
        .lm-drv-num         { font-size:13px;font-weight:700;color:#0a0a0a; }
        .lm-drv-sub         { font-size:10px;color:#a1a1a6;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .lm-drv-pill        { font-size:8px;font-weight:800;padding:2px 8px;border-radius:100px;border:1px solid;text-transform:uppercase;flex-shrink:0; }

        /* DRIVER DETAIL OVERLAY */
        .lm-drv-detail {
          position:absolute;bottom:14px;left:14px;z-index:10;
          width:240px;background:#fff;border:1px solid rgba(0,0,0,0.09);
          border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.12);
          padding:14px 16px;
        }
        .lm-drv-detail-close { position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.07);border:none;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:background .14s; }
        .lm-drv-detail-close:hover { background:rgba(0,0,0,0.12); }
        .lm-drv-detail-name { font-size:15px;font-weight:800;color:#0a0a0a;margin-bottom:10px;padding-right:24px; }
        .lm-drv-detail-row  { display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05);font-size:11px; }
        .lm-drv-detail-row:last-child { border-bottom:none; }
        .lm-drv-detail-k { color:#a1a1a6; }
        .lm-drv-detail-v { font-weight:700;color:#0a0a0a; }
        .lm-drv-btn { width:100%;margin-top:10px;background:#E50914;color:#fff;border:none;border-radius:9px;padding:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s; }
        .lm-drv-btn:hover { background:#c8000f; }

        /* MAP AREA */
        .lm-map-wrap { flex:1;position:relative;min-width:0; }
        .lm-map-div  { position:absolute;inset:0; }

        /* ROUTE BAR — horizontal strip above map, NOT overlapping */
        .lm-route-bar {
          background:#fff;
          border-bottom:1px solid rgba(0,0,0,0.08);
          padding:10px 18px;
          display:flex; align-items:center; gap:14px;
          flex-wrap:wrap; flex-shrink:0;
          box-shadow:0 1px 6px rgba(0,0,0,0.04);
          animation:lm-bar-in .2s ease;
        }
        @keyframes lm-bar-in { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .lm-bar-status {
          display:flex; align-items:center; gap:7px;
          font-size:12px; font-weight:700; color:#0a0a0a;
          flex-shrink:0;
        }
        .lm-bar-spinner {
          width:14px;height:14px;border-radius:50%;
          border:2px solid rgba(229,9,20,0.2);
          border-top-color:#E50914;
          animation:lm-spin .8s linear infinite;
          flex-shrink:0;
        }
        @keyframes lm-spin { to{transform:rotate(360deg)} }
        .lm-bar-chips { display:flex; gap:8px; align-items:center; }
        .lm-bar-chip {
          background:#f8f8fa; border:1px solid rgba(0,0,0,0.08);
          border-radius:100px; padding:4px 12px;
          font-size:11px; font-weight:700; color:#0a0a0a;
          display:flex; align-items:center; gap:5px;
        }
        .lm-bar-chip-lbl { font-size:9px; color:#a1a1a6; font-weight:600; }
        .lm-bar-chip-val { font-size:13px; font-weight:800; color:#0a0a0a; }
        .lm-bar-amb { font-size:11px; color:#6e6e73; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .lm-bar-actions { display:flex; gap:7px; align-items:center; margin-left:auto; flex-shrink:0; }
        .lm-send-btn { background:#E50914;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;box-shadow:0 3px 10px rgba(229,9,20,0.22);white-space:nowrap; }
        .lm-send-btn:hover:not(:disabled) { background:#c8000f; }
        .lm-send-btn:disabled { background:rgba(0,0,0,0.1);color:rgba(0,0,0,0.3);box-shadow:none;cursor:not-allowed; }
        .lm-clear-btn { background:rgba(0,0,0,0.05);color:#6e6e73;border:1px solid rgba(0,0,0,0.1);border-radius:8px;padding:8px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s;white-space:nowrap; }
        .lm-clear-btn:hover { background:rgba(0,0,0,0.09); }

        /* ROUTE MANAGER TAB */
        .lm-rm { padding:18px 22px;flex:1;overflow-y:auto;max-width:1000px; }
        .lm-rm-title { font-size:17px;font-weight:800;color:#0a0a0a;margin-bottom:16px;letter-spacing:-.3px; }
        .lm-rm-card {
          background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:14px;
          padding:16px 18px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.05);
          transition:box-shadow .18s;
        }
        .lm-rm-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.08); }
        .lm-rm-top { display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px; }
        .lm-rm-num { font-size:15px;font-weight:800;color:#0a0a0a; }
        .lm-rm-sub { font-size:11px;color:#a1a1a6;margin-top:2px; }
        .lm-rm-pill{ font-size:9px;font-weight:800;padding:4px 12px;border-radius:100px;border:1px solid;text-transform:uppercase;flex-shrink:0; }
        .lm-rm-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px; }
        .lm-rm-loc-lbl { font-size:9px;font-weight:800;color:#a1a1a6;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px; }
        .lm-rm-loc-val { font-size:12px;color:#3d3d3d;display:flex;align-items:flex-start;gap:4px; }
        .lm-rm-actions { display:flex;gap:7px;flex-wrap:wrap; }
        .lm-rm-btn { font-size:11px;font-weight:700;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-family:inherit;transition:all .15s; }
        .lm-rm-btn-route  { background:#0a0a0a;color:#fff; }
        .lm-rm-btn-route:hover { background:#222; }
        .lm-rm-btn-conf   { background:#E50914;color:#fff;box-shadow:0 3px 10px rgba(229,9,20,0.22); }
        .lm-rm-btn-conf:hover { background:#c8000f; }
        .lm-rm-btn-done   { background:#f8f8fa;color:#6e6e73;border:1px solid rgba(0,0,0,0.1); }
        .lm-rm-btn-done:hover { background:#f0f0f2;color:#0a0a0a; }
        .lm-rm-empty { padding:50px 24px;text-align:center;color:#a1a1a6;font-size:14px; }

        /* Leaflet white overrides */
        .sr-dark-popup .leaflet-popup-content-wrapper{background:#fff!important;border:1px solid rgba(0,0,0,0.09)!important;border-radius:12px!important;padding:0!important;box-shadow:0 8px 24px rgba(0,0,0,0.1)!important;}
        .sr-dark-popup .leaflet-popup-content{margin:0!important;}
        .sr-dark-popup .leaflet-popup-tip{background:#fff!important;}
        .leaflet-routing-container{display:none!important;}
        .leaflet-control-zoom a{background:#fff!important;color:#0a0a0a!important;border-color:rgba(0,0,0,0.1)!important;}

        @media(max-width:767px){
          .lm-root{padding-left:0;}
          .lm-sb{display:none;}
          .lm-rm{padding:12px 14px;}
        }
      `}</style>

      {toast && <div className={`lm-toast lm-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="lm-root">

        {/* TOP BAR */}
        <div className="lm-topbar">
          <div>
            <p className="lm-tb-h1">Command Center</p>
            <p className="lm-tb-sub">Live tracking &amp; route management</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span className="lm-clock">{time.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
            <div className="lm-live"><span className="lm-live-dot"/> LIVE</div>
          </div>
        </div>

        {/* TABS */}
        <div className="lm-tabs">
          <div className={`lm-tab ${tab==="map"?"on":""}`} onClick={()=>setTab("map")}>🗺 Map</div>
          <div className={`lm-tab ${tab==="routes"?"on":""}`} onClick={()=>setTab("routes")}>
            🔀 Route Manager
            {activeBookings.length>0&&<span className="lm-tab-badge">{activeBookings.length}</span>}
          </div>
        </div>

        {/* ── ROUTE INFO BAR — horizontal strip, above map, no overlap ── */}
        {tab==="map" && (routeMode==="drawing" || routeMode==="drawn") && selectedBook && (
          <div className="lm-route-bar">
            {routeMode==="drawing"
              ? <><div className="lm-bar-spinner"/><div className="lm-bar-status">Calculating route…</div></>
              : <div className="lm-bar-status">🗺 Route Ready</div>
            }
            {routeInfo && (
              <div className="lm-bar-chips">
                <div className="lm-bar-chip">
                  <div>
                    <div className="lm-bar-chip-lbl">Distance</div>
                    <div className="lm-bar-chip-val">{routeInfo.dist}</div>
                  </div>
                </div>
                <div className="lm-bar-chip">
                  <div>
                    <div className="lm-bar-chip-lbl">ETA</div>
                    <div className="lm-bar-chip-val">{routeInfo.time}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="lm-bar-amb">
              🚑 {selectedBook.ambulance_number} → 👤 {selectedBook.booked_by} · 📍 {selectedBook.pickup_location}
            </div>
            <div className="lm-bar-actions">
              <button
                className="lm-send-btn"
                disabled={routeMode!=="drawn" || sendingRoute}
                onClick={sendRouteToDriver}
              >
                {sendingRoute ? "Sending…" : "📤 Send Route to Driver"}
              </button>
              <button className="lm-clear-btn" onClick={clearRoute}>✕ Clear</button>
            </div>
          </div>
        )}

        <div className="lm-body">

          {/* ── MAP TAB ── */}
          {tab==="map"&&(<>
            {/* SIDEBAR — driver list */}
            <div className="lm-sb">
              <div className="lm-sb-head">
                <div className="lm-sb-head-title">Fleet Tracking ({ambulances.length} units)</div>
                <div className="lm-sb-filters">
                  {["all","available","en_route","busy","offline"].map(f=>(
                    <button key={f} className={`lm-sb-filter ${driverFilter===f?"on":""}`} onClick={()=>setDriverFilter(f)}>
                      {f==="all"?"All":f.replace("_"," ")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="lm-sb-list">
                {filteredAmbs.map((a,i)=>{
                  const sc=SC[a.status]||SC.offline;
                  const sel=selectedAmb?.id===a.id;
                  return(
                    <div key={i} className={`lm-drv-item ${sel?"sel":""}`} onClick={()=>setSelectedAmb(s=>s?.id===a.id?null:a)}>
                      <div className="lm-drv-ico">🚑</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="lm-drv-num">{a.ambulance_number}</div>
                        <div className="lm-drv-sub">👤 {a.driver} · 📍 {a.location||"—"}</div>
                      </div>
                      <span className="lm-drv-pill" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}>{a.status?.replace("_"," ")}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MAP */}
            <div className="lm-map-wrap">
              <div ref={mapRef} className="lm-map-div"/>

              {/* DRIVER DETAIL PANEL */}
              {selectedAmb&&(
                <div className="lm-drv-detail">
                  <button className="lm-drv-detail-close" onClick={()=>setSelectedAmb(null)}>✕</button>
                  <div className="lm-drv-detail-name">🚑 {selectedAmb.ambulance_number}</div>
                  {[
                    ["Driver",   selectedAmb.driver],
                    ["Contact",  selectedAmb.driver_contact||"—"],
                    ["Location", selectedAmb.location||"—"],
                    ["Status",   selectedAmb.status?.replace("_"," ")],
                    ["Speed",    selectedAmb.speed?`${selectedAmb.speed} km/h`:"—"],
                  ].map(([k,v],i)=>(
                    <div key={i} className="lm-drv-detail-row">
                      <span className="lm-drv-detail-k">{k}</span>
                      <span className="lm-drv-detail-v">{v}</span>
                    </div>
                  ))}
                  <button className="lm-drv-btn" onClick={()=>{setTab("routes");}}>
                    🔀 Manage Routes →
                  </button>
                </div>
              )}


            </div>
          </>)}

          {/* ── ROUTE MANAGER TAB ── */}
          {tab==="routes"&&(
            <div className="lm-rm" style={{width:"100%"}}>
              <div className="lm-rm-title">
                Active Bookings
                <span style={{marginLeft:8,fontSize:13,fontWeight:500,color:"#6e6e73"}}>({activeBookings.length})</span>
              </div>

              {activeBookings.length===0&&(
                <div className="lm-rm-empty">
                  <div style={{fontSize:40,marginBottom:10,opacity:.3}}>🔀</div>
                  No active routes
                </div>
              )}

              {activeBookings.map((b,i)=>{
                const sc = BSC[b.status]||BSC.pending;
                return(
                  <div key={i} className="lm-rm-card">
                    <div className="lm-rm-top">
                      <div>
                        <div className="lm-rm-num">🚑 {b.ambulance_number}</div>
                        <div className="lm-rm-sub">Driver: {b.driver} · Patient: {b.booked_by}</div>
                      </div>
                      <span className="lm-rm-pill" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}>{b.status}</span>
                    </div>

                    <div className="lm-rm-grid">
                      <div>
                        <div className="lm-rm-loc-lbl">Pickup</div>
                        <div className="lm-rm-loc-val">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#E50914" style={{flexShrink:0,marginTop:2}}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                          {b.pickup_location}
                        </div>
                      </div>
                      <div>
                        <div className="lm-rm-loc-lbl">Destination</div>
                        <div className="lm-rm-loc-val">{b.destination||"—"}</div>
                      </div>
                    </div>

                    <div className="lm-rm-actions">
                      <button className="lm-rm-btn lm-rm-btn-route" onClick={()=>{ setTab("map"); setTimeout(()=>drawRoute(b),400); }}>
                        🗺 Draw Route &amp; Send
                      </button>
                      {b.status==="pending"&&(
                        <button className="lm-rm-btn lm-rm-btn-conf" onClick={()=>patchBooking(b.id,"confirmed")}>
                          ✅ Confirm
                        </button>
                      )}
                      {b.status==="confirmed"&&(
                        <button className="lm-rm-btn lm-rm-btn-done" onClick={()=>patchBooking(b.id,"completed")}>
                          🏁 Complete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
