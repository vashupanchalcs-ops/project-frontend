// Pages/Directions.jsx
// User Live Tracking — FULL SCREEN, no sidebar/navbar overlap
// Geocoding with smart fallback when exact location not found
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useLeaflet, { LIGHT_TILE, DELHI, makePinIcon } from "../hooks/useLeaflet";

const BASE = "http://127.0.0.1:8000";

const DELHI_ZONES = [
  {lat:28.6139,lng:77.2090},{lat:28.6469,lng:77.3849},{lat:28.5921,lng:77.2290},
  {lat:28.7041,lng:77.1025},{lat:28.5355,lng:77.3910},{lat:28.6328,lng:77.2197},
  {lat:28.6280,lng:77.3649},{lat:28.5562,lng:77.1000},
];

// Smart geocode — tries multiple queries with fallbacks
async function smartGeocode(raw) {
  if (!raw || !raw.trim()) return null;

  // Try variations
  var queries = [
    raw.trim() + ", Delhi, India",
    raw.trim() + ", India",
    raw.trim(),
  ];

  for (var i = 0; i < queries.length; i++) {
    try {
      var res  = await fetch(
        "https://nominatim.openstreetmap.org/search?q=" +
        encodeURIComponent(queries[i]) +
        "&format=json&limit=1&countrycodes=in",
        { headers: { "Accept-Language": "en" } }
      );
      var data = await res.json();
      if (data.length) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch(e) {}
  }
  return null; // not found — will use fallback
}

export default function Directions() {
  const { state }    = useLocation();
  const navigate     = useNavigate();
  const leafletReady = useLeaflet();

  const mapRef    = useRef(null);
  const mapObj    = useRef(null);
  const ambMark   = useRef(null);
  const routeCtrl = useRef(null);
  const drawnRef  = useRef(false);

  // Navigation state from MyBookings
  const tracking      = state && state.tracking;
  const ambulanceId   = state && state.ambulanceId;
  const ambulanceNum  = state && state.ambulanceNumber;
  const driverName    = state && state.driver;
  const driverContact = state && state.driverContact;
  const pickup        = state && state.pickupLocation;
  const dest          = state && state.destination;
  const bStatus       = state && state.status;
  const bId           = state && state.bookingId;
  const hospital      = state && state.hospital;

  const [ambulance,   setAmbulance]   = useState(null);
  const [routeInfo,   setRouteInfo]   = useState(null);
  const [phase,       setPhase]       = useState("calculating");
  const [phaseMsg,    setPhaseMsg]    = useState("Locating ambulance...");
  const [mapReady,    setMapReady]    = useState(false);
  const [liveTime,    setLiveTime]    = useState(new Date());
  const [panel,       setPanel]       = useState(true); // show/hide info panel on mobile

  useEffect(() => {
    var t = setInterval(function() { setLiveTime(new Date()); }, 1000);
    return function() { clearInterval(t); };
  }, []);

  // Fetch ambulance
  function fetchAmb() {
    if (!ambulanceId) return;
    fetch(BASE + "/api/ambulances/")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var a = data.find(function(x) { return x.id === ambulanceId; });
        if (a) setAmbulance(a);
      })
      .catch(function() {});
  }

  useEffect(function() {
    fetchAmb();
    var t = setInterval(fetchAmb, 5000);
    return function() { clearInterval(t); };
  }, [ambulanceId]);

  // Update ambulance marker live
  useEffect(function() {
    if (!ambulance || !ambMark.current) return;
    var lat = parseFloat(ambulance.latitude)  || DELHI_ZONES[0].lat;
    var lng = parseFloat(ambulance.longitude) || DELHI_ZONES[0].lng;
    ambMark.current.setLatLng([lat, lng]);
  }, [ambulance]);

  // Init map — FULL SCREEN
  useEffect(function() {
    if (!leafletReady || !mapRef.current || mapObj.current) return;
    var L = window.L;
    mapObj.current = L.map(mapRef.current, {
      center: [DELHI.lat, DELHI.lng],
      zoom: 12, minZoom: 8, maxZoom: 18, zoomControl: false,
    });
    L.tileLayer(LIGHT_TILE, { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    setTimeout(function() {
      if (mapObj.current) mapObj.current.invalidateSize();
      setMapReady(true);
    }, 300);
    return function() { if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [leafletReady]);

  // Keep map canvas healthy after layout shifts/resizes
  useEffect(function () {
    if (!mapObj.current) return;
    var t1 = setTimeout(function () { mapObj.current && mapObj.current.invalidateSize(); }, 0);
    var t2 = setTimeout(function () { mapObj.current && mapObj.current.invalidateSize(); }, 320);
    var t3 = setTimeout(function () { mapObj.current && mapObj.current.invalidateSize(); }, 900);
    var onResize = function () { mapObj.current && mapObj.current.invalidateSize(); };
    window.addEventListener("resize", onResize);
    return function () {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      window.removeEventListener("resize", onResize);
    };
  }, [mapReady, tracking, pickup, dest]);

  // Draw route once map ready
  useEffect(function() {
    if (!mapReady || drawnRef.current) return;
    if (tracking && pickup) { drawnRef.current = true; drawRoute(); }
    else if (hospital)      { drawnRef.current = true; drawHospital(); }
  }, [mapReady, ambulance]);

  async function drawRoute() {
    if (!mapObj.current || !window.L) return;
    var L = window.L;
    setPhase("calculating"); setPhaseMsg("Calculating route...");

    // Ambulance start
    var ambLat = ambulance ? (parseFloat(ambulance.latitude)  || DELHI_ZONES[0].lat) : DELHI_ZONES[0].lat;
    var ambLng = ambulance ? (parseFloat(ambulance.longitude) || DELHI_ZONES[0].lng) : DELHI_ZONES[0].lng;

    // Place ambulance marker
    var ambIcon = makePinIcon("#E50914", "🚑");
    if (ambIcon) {
      if (ambMark.current) {
        ambMark.current.setLatLng([ambLat, ambLng]);
      } else {
        ambMark.current = L.marker([ambLat, ambLng], { icon: ambIcon })
          .addTo(mapObj.current)
          .bindPopup(
            '<div style="padding:10px 14px;font-family:DM Sans,sans-serif">' +
            '<b style="font-size:13px;color:#0a0a0a">🚑 ' + (ambulanceNum || "Ambulance") + '</b>' +
            (driverName ? '<div style="font-size:11px;color:#6e6e73;margin-top:2px">Driver: ' + driverName + '</div>' : '') +
            '</div>',
            { className: "sr-dark-popup" }
          );
      }
    }

    // Geocode pickup
    setPhaseMsg("Finding pickup location...");
    var pickupLL = await smartGeocode(pickup);

    // Fallback: if pickup not found, use a Delhi landmark offset
    if (!pickupLL) {
      pickupLL = [ambLat + 0.02, ambLng + 0.02];
      setPhaseMsg("Approximate pickup location used");
    }

    // Geocode destination
    var destLL = null;
    if (dest) {
      setPhaseMsg("Finding destination...");
      destLL = await smartGeocode(dest);
      if (!destLL) destLL = [pickupLL[0] + 0.03, pickupLL[1] + 0.01];
    }

    // Build waypoints
    var pickupIcon = makePinIcon("#b36800", "📍");
    var destIcon   = makePinIcon("#0a0a0a", "🏥");
    var waypoints  = [
      L.latLng(ambLat, ambLng),
      L.latLng(pickupLL[0], pickupLL[1]),
    ];
    if (destLL) waypoints.push(L.latLng(destLL[0], destLL[1]));

    try {
      if (routeCtrl.current) {
        try { mapObj.current.removeControl(routeCtrl.current); } catch(e) {}
        routeCtrl.current = null;
      }

      var ctrl = L.Routing.control({
        waypoints: waypoints,
        router: L.Routing.osrmv1({
          serviceUrl: "https://router.project-osrm.org/route/v1",
          profile: "driving",
        }),
        lineOptions: {
          styles: [
            { color: "#E50914", weight: 5, opacity: 0.88 },
            { color: "#fff",    weight: 2, opacity: 0.25 },
          ],
          extendToWaypoints: true, missingRouteTolerance: 0,
        },
        show: false, addWaypoints: false, draggableWaypoints: false,
        fitSelectedRoutes: true, showAlternatives: false,
        createMarker: function(i, wp) {
          var icons  = [ambIcon, pickupIcon, destIcon];
          var labels = ["🚑 Ambulance", "📍 Your Pickup", "🏥 Hospital"];
          var icon   = icons[i];
          if (!icon) return false;
          return L.marker(wp.latLng, { icon: icon })
            .bindPopup(
              '<div style="padding:8px 12px;font-family:DM Sans,sans-serif;font-weight:700;font-size:12px;color:#0a0a0a">' + labels[i] + '</div>',
              { className: "sr-dark-popup" }
            );
        },
      }).addTo(mapObj.current);

      ctrl.on("routesfound", function(e) {
        var s = e.routes[0].summary;
        setRouteInfo({
          dist: (s.totalDistance / 1000).toFixed(1) + " km",
          eta:  "~" + Math.round(s.totalTime / 60) + " min",
        });
        setPhase("ready"); setPhaseMsg("Route ready");
      });
      ctrl.on("routingerror", function() {
        // Draw straight lines as fallback
        drawFallbackLines(L, waypoints);
      });
      routeCtrl.current = ctrl;
    } catch(err) {
      drawFallbackLines(L, waypoints);
    }
  }

  function drawFallbackLines(L, waypoints) {
    // Draw dashed polyline as fallback when OSRM fails
    var latlngs = waypoints.map(function(w) { return [w.lat, w.lng]; });
    L.polyline(latlngs, { color:"#E50914", weight:4, opacity:.7, dashArray:"8 6" }).addTo(mapObj.current);
    mapObj.current.fitBounds(L.latLngBounds(latlngs), { padding:[40,40] });
    setPhase("ready"); setPhaseMsg("Approximate route shown");
    setRouteInfo({ dist: "—", eta: "—" });
  }

  async function drawHospital() {
    if (!mapObj.current || !window.L || !hospital) return;
    var L = window.L;
    setPhase("calculating"); setPhaseMsg("Locating hospital...");
    var lat, lng;
    if (hospital.latitude && hospital.longitude) {
      lat = parseFloat(hospital.latitude); lng = parseFloat(hospital.longitude);
    } else {
      var ll = await smartGeocode(hospital.address || hospital.name);
      if (ll) { lat = ll[0]; lng = ll[1]; }
      else { lat = DELHI.lat; lng = DELHI.lng; }
    }
    var icon = makePinIcon("#0a0a0a", "🏥");
    if (icon) {
      L.marker([lat, lng], { icon: icon }).addTo(mapObj.current)
        .bindPopup('<div style="padding:10px 14px;font-family:DM Sans,sans-serif"><b style="font-size:13px;color:#0a0a0a">🏥 ' + hospital.name + '</b></div>', { className:"sr-dark-popup" })
        .openPopup();
    }
    mapObj.current.flyTo([lat, lng], 15, { duration: 1.2 });
    setPhase("ready"); setPhaseMsg("Hospital located");
  }

  var sc = bStatus === "confirmed"
    ? { c:"#00875a", bg:"rgba(0,135,90,0.1)", b:"rgba(0,135,90,0.25)" }
    : { c:"#b36800", bg:"rgba(179,104,0,0.1)", b:"rgba(179,104,0,0.25)" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        /* FULL SCREEN — no padding-left (sidebar hidden by App.jsx) */
        .dir-page {
          position: relative;
          width: 100%;
          min-height: 100vh;
          height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', sans-serif;
          background:
            radial-gradient(circle at 12% 10%, var(--sr-bg-grad-a), transparent 34%),
            radial-gradient(circle at 88% 8%, var(--sr-bg-grad-b), transparent 38%),
            var(--sr-bg);
          z-index: 0;
          overflow: hidden;
          isolation: isolate;
        }

        /* TOP BAR */
        .dir-topbar {
          display: flex; align-items: center;
          justify-content: space-between;
          gap: 10px; flex-wrap: wrap;
          padding: 10px 20px;
          background: color-mix(in srgb, var(--sr-surface) 90%, transparent);
          border-bottom: 1px solid var(--sr-border);
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          flex-shrink: 0;
          z-index: 10;
          position: relative;
        }
        .dir-title-row { display:flex;align-items:center;gap:10px; }
        .dir-title { font-size:17px;font-weight:800;color:var(--sr-text);letter-spacing:-.4px; }
        .dir-subtitle { font-size:11px;color:var(--sr-text-sub); }
        .dir-right { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
        .dir-pill { font-size:9px;font-weight:800;padding:4px 12px;border-radius:100px;border:1.5px solid;text-transform:uppercase;letter-spacing:.5px; }
        @keyframes dir-blink{0%,100%{opacity:1}50%{opacity:.15}}
        .dir-live { display:inline-flex;align-items:center;gap:6px;background:var(--sr-danger-bg);border:1px solid var(--red-border);border-radius:100px;padding:5px 13px;font-size:11px;font-weight:700;color:var(--sr-danger-text); }
        .dir-live-dot { width:6px;height:6px;border-radius:50%;background:#E50914;animation:dir-blink 1.6s infinite; }
        .dir-clock { font-size:12px;font-weight:700;color:var(--sr-text-sub); }
        .dir-back { display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--sr-text);background:var(--sr-input-bg);border:1.5px solid var(--sr-input-border);border-radius:9px;padding:7px 14px;cursor:pointer;font-family:inherit;transition:all .15s; }
        .dir-back:hover { background:var(--sr-hover); }

        /* INFO PANEL — compact horizontal strip */
        .dir-panel {
          background: color-mix(in srgb, var(--sr-surface) 92%, transparent);
          border-bottom: 1px solid var(--sr-border);
          backdrop-filter: blur(8px);
          padding: 0;
          flex-shrink: 0;
          z-index: 9;
          position: relative;
        }

        /* Driver row */
        .dir-driver-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 20px;
          border-bottom: 1px solid var(--sr-border);
        }
        .dir-drv-av { width:34px;height:34px;border-radius:9px;background:var(--sr-brand-grad);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:#fff;flex-shrink:0; }
        .dir-drv-name { font-size:13px;font-weight:800;color:var(--sr-text); }
        .dir-drv-meta { font-size:10px;color:var(--sr-text-sub);margin-top:1px; }
        .dir-call-btn { display:inline-flex;align-items:center;gap:6px;background:var(--sr-brand-grad);color:#fff;border:none;border-radius:8px;padding:7px 15px;font-size:11px;font-weight:700;font-family:inherit;text-decoration:none;cursor:pointer;transition:filter .15s;margin-left:auto;flex-shrink:0;box-shadow:0 8px 18px var(--sr-accent-muted); }
        .dir-call-btn:hover { filter:brightness(1.04); }

        /* Chips row */
        .dir-chips-row {
          display: flex; align-items: stretch;
          overflow-x: auto; scrollbar-width: none;
          border-bottom: 1px solid var(--sr-border);
        }
        .dir-chips-row::-webkit-scrollbar { display:none; }
        .dir-chip { display:flex;flex-direction:column;gap:1px;padding:8px 18px;border-right:1px solid var(--sr-border);flex-shrink:0; }
        .dir-chip:last-child { border-right:none; }
        .dir-chip-lbl { font-size:8px;font-weight:800;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1px; }
        .dir-chip-val { font-size:12px;font-weight:700;color:var(--sr-text); }
        .dir-chip-val.eta { color:#E50914; }

        /* Route status bar */
        .dir-status-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 20px; background: var(--sr-hover);
          border-bottom: 1px solid var(--sr-border);
          font-size: 11px; font-weight: 600; color: var(--sr-text-sub);
          flex-shrink: 0;
        }
        @keyframes dir-spin{to{transform:rotate(360deg)}}
        .dir-spinner { width:13px;height:13px;border-radius:50%;border:2px solid rgba(229,9,20,0.2);border-top-color:#E50914;animation:dir-spin .8s linear infinite;flex-shrink:0; }

        /* MAP TAKES ALL REMAINING HEIGHT */
        .dir-map-wrap {
          flex: 1 1 auto;
          position: relative;
          min-height: 0;
          background: #dde4ef;
          z-index: 1;
        }
        .dir-map-div {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
        }
        .dir-map-div .leaflet-container {
          width: 100% !important;
          height: 100% !important;
          background: #dfe6ef;
        }

        /* Legend on map */
        .dir-legend {
          position: absolute; bottom: 18px; left: 16px; z-index: 20;
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(0,0,0,0.09);
          border-radius: 12px; padding: 10px 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          display: flex; flex-direction: column; gap: 6px;
          min-width: 150px;
          max-width: min(82vw, 220px);
          pointer-events: none;
        }
        .dir-legend-title { font-size:9px;font-weight:800;color:#a1a1a6;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px; }
        .dir-legend-row { display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:#0a0a0a; }
        .dir-legend-dot { width:9px;height:9px;border-radius:50%;flex-shrink:0; }
        .dir-legend-line { height:3px;width:22px;border-radius:3px;flex-shrink:0; }

        /* Leaflet overrides */
        .sr-dark-popup .leaflet-popup-content-wrapper{background:#fff!important;border:1px solid rgba(0,0,0,0.09)!important;border-radius:12px!important;padding:0!important;box-shadow:0 8px 24px rgba(0,0,0,0.1)!important;}
        .sr-dark-popup .leaflet-popup-content{margin:0!important;}
        .sr-dark-popup .leaflet-popup-tip{background:#fff!important;}
        .leaflet-routing-container{display:none!important;}
        .leaflet-control-zoom a{background:#fff!important;color:#0a0a0a!important;border-color:rgba(0,0,0,0.1)!important;}

        /* RESPONSIVE */
        @media(max-width:600px) {
          .dir-topbar { padding:8px 12px; }
          .dir-title { font-size:14px; }
          .dir-driver-row { padding:8px 12px; }
          .dir-chip { padding:7px 12px; }
          .dir-legend { bottom:12px;left:10px;min-width:126px;padding:8px 10px; }
          .dir-clock { display:none; }
        }
      `}</style>

      <div className="dir-page">

        {/* TOP BAR */}
        <div className="dir-topbar" data-k72="reveal">
          <div className="dir-title-row">
            <div>
              <div className="dir-title">
                {tracking ? "🚑 Live Tracking" : hospital ? "🏥 " + hospital.name : "Directions"}
              </div>
              <div className="dir-subtitle">
                {tracking ? ("Booking #" + bId + " · " + (ambulanceNum || "")) : (hospital ? hospital.address : "")}
              </div>
            </div>
          </div>
          <div className="dir-right">
            {tracking && bStatus && (
              <span className="dir-pill" style={{ color:sc.c, background:sc.bg, borderColor:sc.b }}>{bStatus}</span>
            )}
            <span className="dir-clock">{liveTime.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
            {tracking && <div className="dir-live"><span className="dir-live-dot"/>LIVE</div>}
            <button className="dir-back" onClick={function(){navigate(-1);}}>&#8592; Back</button>
          </div>
        </div>

        {/* INFO PANEL */}
        <div className="dir-panel" data-k72="reveal">

          {/* Driver info */}
          {tracking && (driverName || driverContact) && (
            <div className="dir-driver-row">
              <div className="dir-drv-av">{driverName ? driverName[0].toUpperCase() : "D"}</div>
              <div>
                <div className="dir-drv-name">{driverName || "Driver"}</div>
                <div className="dir-drv-meta">
                  {ambulanceNum && ("🚑 " + ambulanceNum)}
                  {driverContact && (" · 📞 " + driverContact)}
                </div>
              </div>
              {driverContact && (
                <a className="dir-call-btn" href={"tel:" + driverContact}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.6a16 16 0 0 0 5.49 5.49l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 18.56z"/></svg>
                  Call Driver
                </a>
              )}
            </div>
          )}

          {/* Location chips + route info */}
          <div className="dir-chips-row">
            {pickup && <div className="dir-chip"><div className="dir-chip-lbl">📍 Pickup</div><div className="dir-chip-val">{pickup}</div></div>}
            {dest    && <div className="dir-chip"><div className="dir-chip-lbl">🏥 Destination</div><div className="dir-chip-val">{dest}</div></div>}
            {routeInfo && <div className="dir-chip"><div className="dir-chip-lbl">Distance</div><div className="dir-chip-val">{routeInfo.dist}</div></div>}
            {routeInfo && <div className="dir-chip"><div className="dir-chip-lbl">ETA</div><div className="dir-chip-val eta">{routeInfo.eta}</div></div>}
          </div>

          {/* Status */}
          <div className="dir-status-bar">
            {phase === "calculating" && <><div className="dir-spinner"/>{phaseMsg}</>}
            {phase === "ready"       && <><span style={{color:"#00875a",fontWeight:800}}>&#10003;</span>{phaseMsg}{routeInfo && <span style={{marginLeft:8,color:"#6e6e73"}}>{routeInfo.dist} · {routeInfo.eta}</span>}</>}
          </div>
        </div>

        {/* FULL SCREEN MAP */}
        <div className="dir-map-wrap">
          <div ref={mapRef} className="dir-map-div"/>

          {tracking && (
            <div className="dir-legend" data-k72="reveal">
              <div className="dir-legend-title">Legend</div>
              <div className="dir-legend-row"><span className="dir-legend-dot" style={{background:"#E50914"}}/>Ambulance</div>
              <div className="dir-legend-row"><span className="dir-legend-dot" style={{background:"#b36800"}}/>Pickup Point</div>
              {dest && <div className="dir-legend-row"><span className="dir-legend-dot" style={{background:"#0a0a0a"}}/>Hospital</div>}
              <div className="dir-legend-row" style={{marginTop:4,paddingTop:6,borderTop:"1px solid rgba(0,0,0,0.07)"}}>
                <span className="dir-legend-line" style={{background:"#E50914"}}/>Route
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
