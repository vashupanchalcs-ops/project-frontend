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
