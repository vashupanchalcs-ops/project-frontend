import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import useLeaflet, {
  DARK_TILE, DELHI, makePinIcon,
  geocodeInIndia, fetchRoadRoute,
  fetchNearestRoadPoint,
  SATELLITE_TILE, isIndiaCoord,
} from "../hooks/useLeaflet";

const BASE          = "http://127.0.0.1:8000";
const PING_INTERVAL = 5000;
const POLL_INTERVAL = 8000;

const normalize = (v = "") =>
  String(v).toLowerCase().replace(/saharda/g, "sharda").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const inIndia = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

const haversineKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const requestNotifPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
};

const sendPushNotif = (title, body, tag = "") => {
  if (Notification.permission !== "granted") return;
  const n = new Notification(title, {
    body, icon: "https://cdn-icons-png.flaticon.com/512/2966/2966327.png",
    tag: tag || title, requireInteraction: true, vibrate: [200, 100, 200],
  });
  setTimeout(() => n.close(), 10000);
};

const card      = { background: "var(--sr-surface, #111018)", border: "1px solid var(--sr-border, rgba(255,255,255,0.12))", borderRadius: 12, padding: 12, boxShadow: "0 10px 22px rgba(0,0,0,0.28)" };
const cardTitle = { fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#fff" };
const inp       = { width: "100%", background: "var(--sr-input-bg, rgba(255,255,255,0.07))", border: "1px solid var(--sr-input-border, rgba(255,255,255,0.18))", borderRadius: 8, padding: "8px 10px", color: "var(--sr-input-text, #fff6f2)", fontSize: 13, marginBottom: 8, boxSizing: "border-box", outline: "none" };
const btn       = { width: "100%", border: "none", borderRadius: 6, padding: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 4 };
const logColors = { info: "#888", success: "#00c853", warn: "#ffaa00", error: "#f44336" };

export default function DriverView() {
  const leafletReady = useLeaflet();

  const [email,          setEmail]         = useState(() => localStorage.getItem("dr_email")  || "");
  const [ambId,          setAmbId]         = useState(() => localStorage.getItem("dr_amb_id") || "");
  const [isOnline,       setIsOnline]      = useState(false);
  const [location,       setLocation]      = useState(null);
  const [speed,          setSpeed]         = useState(0);
  const [route,          setRoute]         = useState(null);
  const [log,            setLog]           = useState([]);
  const [panelOpen,      setPanelOpen]     = useState(false);
  const [notifAllowed,   setNotifAllowed]  = useState(Notification.permission === "granted");
  const [mobileTab,      setMobileTab]     = useState("map");
  const [lastConfirmedId,setLastConfirmedId] = useState(() => {
    const s = localStorage.getItem("dr_last_confirmed");
    return s ? parseInt(s) : null;
  });
  const [is3D, setIs3D] = useState(false);

  const mapDivRef        = useRef(null);
  const rootRef          = useRef(null);
  const mapObj           = useRef(null);
  const driverMarker     = useRef(null);
  // FIX: polyline refs (removed routingRef control — was causing route not showing)
  const routeLine1Ref    = useRef(null); // Driver → Pickup  (red polyline)
  const routeLine2Ref    = useRef(null); // Pickup → Hospital (purple polyline)
  const pickupMarkerRef  = useRef(null);
  const destMarkerRef    = useRef(null);
  const tileLayerRef     = useRef(null);
  const latestLoc        = useRef(null);
  const watchId          = useRef(null);
  const pingTimer        = useRef(null);
  const pollTimer        = useRef(null);
  // FIX: track last route id to avoid re-drawing same route
  const lastRouteIdRef   = useRef(null);
  // FIX: track last amb position for route1 throttling
  const lastRoute1OriginRef = useRef(null);

  const addLog = (msg, type = "info") =>
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 40));

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".dv-anim", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.08, ease: "power2.out" });
    }, rootRef);
    return () => ctx.revert();
  }, [mobileTab, route, isOnline]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      requestNotifPermission().then(ok => setNotifAllowed(ok));
    }
  }, []);

  // ── Init Leaflet map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    const indiaBounds = L.latLngBounds(L.latLng(6.0, 68.0), L.latLng(38.0, 97.5));
    mapObj.current = L.map(mapDivRef.current, {
      center: [DELHI.lat, DELHI.lng], zoom: 13,
      minZoom: 9, maxZoom: 19,
      maxBounds: indiaBounds, maxBoundsViscosity: 1.0,
      zoomControl: false,
    });
    tileLayerRef.current = L.tileLayer(DARK_TILE, { maxZoom: 19, minZoom: 9, noWrap: true }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    return () => { if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; } };
  }, [leafletReady]);

  useEffect(() => {
    if (tileLayerRef.current) tileLayerRef.current.setUrl(is3D ? SATELLITE_TILE : DARK_TILE);
  }, [is3D]);

  // ── Geocode helper ────────────────────────────────────────────────────────
  const geocode = async (addr) => {
    const safe = await geocodeInIndia(addr);
    if (safe) return window.L.latLng(safe.lat, safe.lng);
    throw new Error(`"${addr}" not found`);
  };

  // ── FIX: drawLeafletRoute — polyline based, not routing control ───────────
  // Root cause: L.Routing.control was failing silently; replaced with direct
  // fetchRoadRoute polyline which is proven to work in AdminRouteManager
  const drawLeafletRoute = async (r, forceRedraw = false) => {
    if (!leafletReady || !mapObj.current || !window.L) return;

    // Avoid redrawing same route unless forced
    if (!forceRedraw && lastRouteIdRef.current === r.id) return;
    lastRouteIdRef.current = r.id;

    const L   = window.L;
    const map = mapObj.current;

    // Clear existing route lines
    if (routeLine1Ref.current) { try { map.removeLayer(routeLine1Ref.current); } catch {} routeLine1Ref.current = null; }
    if (routeLine2Ref.current) { try { map.removeLayer(routeLine2Ref.current); } catch {} routeLine2Ref.current = null; }
    if (pickupMarkerRef.current) { try { map.removeLayer(pickupMarkerRef.current); } catch {} pickupMarkerRef.current = null; }
    if (destMarkerRef.current)   { try { map.removeLayer(destMarkerRef.current);   } catch {} destMarkerRef.current   = null; }

    addLog("🗺 Route calculate ho raha hai…", "info");

    try {
      // Resolve pickup coords
      const pickupLat = Number(r.pickup_latitude ?? r.pickup_lat);
      const pickupLng = Number(r.pickup_longitude ?? r.pickup_lng);
      const pickupLL  = isIndiaCoord(pickupLat, pickupLng)
        ? { lat: pickupLat, lng: pickupLng }
        : await geocodeInIndia(r.pickup_location).then(c => c || null);

      if (!pickupLL) throw new Error(`Pickup "${r.pickup_location}" geocode failed`);

      // Resolve destination coords
      const destLat = Number(r.dest_latitude ?? r.dest_lat);
      const destLng = Number(r.dest_longitude ?? r.dest_lng);
      const destLL  = isIndiaCoord(destLat, destLng)
        ? { lat: destLat, lng: destLng }
        : (r.destination ? await geocodeInIndia(r.destination).then(c => c || null) : null);

      // Driver origin
      const origin = latestLoc.current || DELHI;

      // ── Draw preview straight lines immediately ──────────────────────────
      routeLine1Ref.current = L.polyline(
        [[origin.lat, origin.lng], [pickupLL.lat, pickupLL.lng]],
        { color: "#e50914", weight: 5, opacity: 0.45, dashArray: "10,10" }
      ).addTo(map);

      if (destLL) {
        routeLine2Ref.current = L.polyline(
          [[pickupLL.lat, pickupLL.lng], [destLL.lat, destLL.lng]],
          { color: "#7b61ff", weight: 5, opacity: 0.45, dashArray: "10,10" }
        ).addTo(map);
      }

      // Markers
      pickupMarkerRef.current = L.marker([pickupLL.lat, pickupLL.lng], {
        icon: makePinIcon("#f7c948", "📍"), zIndexOffset: 3000,
      }).addTo(map).bindPopup(`<b>📍 Pickup</b><br>${r.pickup_location || ""}`);

      if (destLL) {
        destMarkerRef.current = L.marker([destLL.lat, destLL.lng], {
          icon: makePinIcon("#00d4aa", "🏥"), zIndexOffset: 2500,
        }).addTo(map).bindPopup(`<b>🏥 Hospital</b><br>${r.destination || ""}`);
      }

      // Fit bounds to show everything
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [pickupLL.lat, pickupLL.lng],
        ...(destLL ? [[destLL.lat, destLL.lng]] : []),
      ]);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });

      // ── Fetch real OSRM road routes async ───────────────────────────────
      const [snapOrigin, snapPickup, snapDest] = await Promise.all([
        fetchNearestRoadPoint(origin),
        fetchNearestRoadPoint(pickupLL),
        destLL ? fetchNearestRoadPoint(destLL) : Promise.resolve(null),
      ]);

      // Route 1: Driver → Pickup (RED solid)
      const pts1 = await fetchRoadRoute(
        [snapOrigin || origin, snapPickup || pickupLL],
        { allowStraightFallback: true }
      );
      if (routeLine1Ref.current && pts1?.length > 1) {
        routeLine1Ref.current.setLatLngs(pts1);
        routeLine1Ref.current.setStyle({ color: "#e50914", weight: 6, opacity: 0.95, dashArray: null });
        routeLine1Ref.current.bringToFront();
      }

      // Route 2: Pickup → Hospital (PURPLE solid)
      // fetchRoadRoute skips OSRM for hospital campuses (returns straight line)
      if (destLL) {
        const pts2 = await fetchRoadRoute(
          [snapPickup || pickupLL, snapDest || destLL],
          { allowStraightFallback: true }
        );
        if (routeLine2Ref.current && pts2?.length >= 2) {
          routeLine2Ref.current.setLatLngs(pts2);
          const isSolid = pts2.length > 2;
          routeLine2Ref.current.setStyle({
            color: "#7b61ff", weight: 6, opacity: isSolid ? 0.95 : 0.7,
            dashArray: isSolid ? null : "10,8",
          });
          routeLine2Ref.current.bringToFront();
        }
      }

      // Re-fit after real routes loaded
      const finalBounds = L.latLngBounds([]);
      if (routeLine1Ref.current?.getLatLngs?.()?.flat?.()?.length) finalBounds.extend(routeLine1Ref.current.getBounds());
      if (routeLine2Ref.current?.getLatLngs?.()?.flat?.()?.length) finalBounds.extend(routeLine2Ref.current.getBounds());
      if (finalBounds.isValid()) map.fitBounds(finalBounds, { padding: [80, 80], maxZoom: 14 });

      // Path distance from pts1
      const pathKmFn = (path) => {
        if (!Array.isArray(path) || path.length < 2) return 0;
        let total = 0;
        for (let i = 1; i < path.length; i++) {
          const a = path[i-1], b = path[i];
          total += haversineKm(
            { lat: Number(Array.isArray(a) ? a[0] : a.lat), lng: Number(Array.isArray(a) ? a[1] : a.lng) },
            { lat: Number(Array.isArray(b) ? b[0] : b.lat), lng: Number(Array.isArray(b) ? b[1] : b.lng) }
          );
        }
        return total;
      };
      const km1 = pts1?.length > 2 ? pathKmFn(pts1) : haversineKm(origin, pickupLL) * 1.22;
      addLog(`✅ Route ready — Driver→Pickup: ${km1.toFixed(1)} km`, "success");

      lastRoute1OriginRef.current = { ...origin };
    } catch (err) {
      addLog(`Route error: ${err.message}`, "error");
    }
  };

  // ── Update Route 1 when driver moves (throttled: >200m or >60s) ────────────
  // These must be refs (useRef), not plain objects — plain objects reset on re-render
  const route1FetchingRef = useRef(false);
  const lastRoute1TimeRef = useRef(0);
  const updateRoute1 = async (newLoc) => {
    if (!routeLine1Ref.current || !pickupMarkerRef.current || !mapObj.current) return;
    if (route1FetchingRef.current) return; // already fetching

    const now = Date.now();
    const movedEnough = !lastRoute1OriginRef.current ||
      haversineKm(lastRoute1OriginRef.current, newLoc) > 0.2; // >200m
    const timeEnough = (now - lastRoute1TimeRef.current) > 60000; // >60s

    if (!movedEnough && !timeEnough) return;

    route1FetchingRef.current     = true;
    lastRoute1OriginRef.current   = { ...newLoc };
    lastRoute1TimeRef.current     = now;

    const pickupLatLng = pickupMarkerRef.current.getLatLng();
    const pickupPt = { lat: pickupLatLng.lat, lng: pickupLatLng.lng };

    try {
      const [snapOrigin, snapPickup] = await Promise.all([
        fetchNearestRoadPoint(newLoc),
        fetchNearestRoadPoint(pickupPt),
      ]);
      const pts = await fetchRoadRoute(
        [snapOrigin || newLoc, snapPickup || pickupPt],
        { allowStraightFallback: true }
      );
      // Only update if we got a real road route (>2 points = not straight line)
      if (routeLine1Ref.current && pts?.length > 2) {
        routeLine1Ref.current.setLatLngs(pts);
        routeLine1Ref.current.setStyle({ color: "#e50914", weight: 6, opacity: 0.95, dashArray: null });
        routeLine1Ref.current.bringToFront();
      }
    } catch {} finally {
      route1FetchingRef.current = false;
    }
  };


  // ── Start Tracking ────────────────────────────────────────────────────────
  const startTracking = () => {
    if (!email.trim() || !ambId) { addLog("Email aur Ambulance ID dono chahiye.", "error"); return; }
    if (!navigator.geolocation)  { addLog("GPS unsupported.", "error"); return; }

    localStorage.setItem("dr_email",  email);
    localStorage.setItem("dr_amb_id", ambId);
    setIsOnline(true);
    setPanelOpen(false);
    setMobileTab("map");
    addLog("📍 GPS started. Route update ka intezaar hai…", "success");

    requestNotifPermission().then(ok => {
      setNotifAllowed(ok);
      if (ok) addLog("🔔 Notifications enabled", "success");
    });

    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        latestLoc.current = loc;
        setLocation(loc);
        setSpeed(Math.round((pos.coords.speed || 0) * 3.6));

        if (mapObj.current && window.L) {
          // panTo hata diya — route draw ke waqt map jump nahi karega
          if (driverMarker.current) {
            driverMarker.current.setLatLng([loc.lat, loc.lng]);
            driverMarker.current.setZIndexOffset(9000);
          } else {
            // SVG ambulance badge — pinIcon rotation se icon nahi dikhta tha
            const ambIcon = window.L.divIcon({
              className: "",
              html: `<div style="width:42px;height:42px;border-radius:50%;background:#e50914;border:3px solid #fff;box-shadow:0 0 0 6px rgba(229,9,20,0.22),0 8px 18px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M3 13.5V8.8C3 7.81 3.81 7 4.8 7H12.3C12.78 7 13.23 7.19 13.57 7.53L15.1 9.06H17.54C18.29 9.06 18.96 9.53 19.22 10.23L20.44 13.5H21V16H19.88C19.61 17.15 18.58 18 17.35 18C16.12 18 15.09 17.15 14.82 16H9.18C8.91 17.15 7.88 18 6.65 18C5.42 18 4.39 17.15 4.12 16H3V13.5Z" fill="white"/>
                  <rect x="5.2" y="9" width="5.2" height="3.5" rx="0.6" fill="#e50914"/>
                  <circle cx="6.65" cy="16" r="1.4" fill="#111"/>
                  <circle cx="17.35" cy="16" r="1.4" fill="#111"/>
                </svg>
              </div>`,
              iconSize: [42, 42],
              iconAnchor: [21, 21],
            });
            driverMarker.current = window.L
              .marker([loc.lat, loc.lng], { icon: ambIcon, zIndexOffset: 9000 })
              .addTo(mapObj.current)
              .bindPopup(`<div style="font-weight:700;padding:6px 10px">🚑 Aap yahan hain</div>`);
          }
          // Update route 1 as driver moves
          updateRoute1(loc);
        }
      },
      err => addLog(`GPS Error: ${err.message}`, "error"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    sendPing();
    pingTimer.current = setInterval(sendPing, PING_INTERVAL);
    pollBookingStatus();
    pollTimer.current = setInterval(pollBookingStatus, POLL_INTERVAL);
  };

  const stopTracking = () => {
    if (watchId.current)   navigator.geolocation.clearWatch(watchId.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    if (pollTimer.current) clearInterval(pollTimer.current);
    watchId.current = pingTimer.current = pollTimer.current = null;
    setIsOnline(false);
    addLog("⏹ GPS Tracking band", "warn");
  };

  useEffect(() => () => stopTracking(), []);

  const sendPing = () => {
    const loc = latestLoc.current;
    const em  = localStorage.getItem("dr_email");
    const aid = parseInt(localStorage.getItem("dr_amb_id"));
    if (!loc || !em || !aid) return;

    fetch(`${BASE}/api/driver/ping/`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driver_email: em, ambulance_id: aid,
        latitude: loc.lat, longitude: loc.lng,
        speed: Math.round((latestLoc.current?.speed || 0) * 3.6),
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.pending_route) {
          const nr = data.pending_route;
          setRoute(prev => {
            const isNew = !prev || prev.id !== nr.id || prev.status !== nr.status;
            if (isNew && nr.status === "pending") {
              addLog("🗺 Admin ne naya route assign kiya!", "success");
              sendPushNotif("🚨 Naya Route Mila!", `Pickup: ${nr.pickup_location}`, `route-${nr.id}`);
              if (leafletReady && nr.pickup_location) drawLeafletRoute(nr);
            }
            return nr;
          });
        }
      })
      .catch(() => {});
  };

  const pollBookingStatus = () => {
    const aid = parseInt(localStorage.getItem("dr_amb_id"));
    if (!aid) return;

    fetch(`${BASE}/api/bookings/`)
      .then(r => r.json())
      .then(data => {
        const confirmed = data
          .filter(b => b.ambulance_id === aid && b.status === "confirmed")
          .sort((a, b) => b.id - a.id);

        if (confirmed.length === 0) return;
        const latest = confirmed[0];
        const lastId = parseInt(localStorage.getItem("dr_last_confirmed") || "0");

        if (latest.id !== lastId) {
          localStorage.setItem("dr_last_confirmed", latest.id);
          setLastConfirmedId(latest.id);
          addLog(`✅ Booking #${latest.id} confirmed!`, "success");
          sendPushNotif("✅ Booking Confirmed!", `Pickup: ${latest.pickup_location}`, `booking-${latest.id}`);
          if (leafletReady && latest.pickup_location) {
            drawLeafletRoute({
              id: `booking-${latest.id}`,
              pickup_location: latest.pickup_location,
              destination: latest.destination || latest.assigned_hospital_name || "",
              pickup_lat: latest.pickup_latitude,
              pickup_lng: latest.pickup_longitude,
              dest_lat: latest.dest_latitude,
              dest_lng: latest.dest_longitude,
            });
          }
        }
      })
      .catch(() => {});
  };

  const respondRoute = async (newStatus) => {
    if (!route?.id) return;
    try {
      const res  = await fetch(`${BASE}/api/driver/route/${route.id}/respond/`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (newStatus === "completed") {
        setRoute(null);
        if (routeLine1Ref.current) { try { mapObj.current?.removeLayer(routeLine1Ref.current); } catch {} routeLine1Ref.current = null; }
        if (routeLine2Ref.current) { try { mapObj.current?.removeLayer(routeLine2Ref.current); } catch {} routeLine2Ref.current = null; }
        addLog("🏁 Trip complete!", "success");
        sendPushNotif("🏁 Trip Complete!", "Patient safely delivered.", "Trip Complete");
      } else {
        setRoute(data);
        if (newStatus === "accepted") {
          addLog("✅ Route accepted", "success");
          if (data.pickup_location) drawLeafletRoute(data, true); // force redraw on accept
        }
        if (newStatus === "rejected") {
          addLog("❌ Route rejected", "warn");
          if (routeLine1Ref.current) { try { mapObj.current?.removeLayer(routeLine1Ref.current); } catch {} routeLine1Ref.current = null; }
          if (routeLine2Ref.current) { try { mapObj.current?.removeLayer(routeLine2Ref.current); } catch {} routeLine2Ref.current = null; }
        }
      }
    } catch { addLog("Route update failed", "error"); }
  };

  const routeBorder =
    route?.status === "pending"  ? "#ffaa00" :
    route?.status === "accepted" ? "#00c853" : "#4fc3f7";

  useEffect(() => {
    if (mobileTab === "map" && mapObj.current) {
      setTimeout(() => mapObj.current?.invalidateSize(), 50);
    }
  }, [mobileTab]);

  const panelContent = (
    <>
      <motion.div className="dv-anim" style={card} whileHover={{ borderColor: "var(--sr-accent-muted, rgba(255,31,90,0.35))" }}>
        <div style={cardTitle}>🔐 Driver Info</div>
        <div style={{ fontSize: 11, color: "var(--sr-text-sub, rgba(255,246,242,0.78))", marginBottom: 8 }}>
          {localStorage.getItem("name") || "Driver"} · Role: {localStorage.getItem("role") || "driver"}
        </div>
        <input style={inp} placeholder="Driver Email" value={email} disabled={isOnline} onChange={e => setEmail(e.target.value)} />
        <input style={inp} placeholder="Ambulance ID" type="number" value={ambId} disabled={isOnline} onChange={e => setAmbId(e.target.value)} />
        {!isOnline
          ? <button style={{ ...btn, background: "#00c853", color: "#000" }} onClick={startTracking}>▶ Activate Live Tracking</button>
          : <button style={{ ...btn, background: "#e53935" }} onClick={stopTracking}>⏹ Terminate Tracking</button>
        }
        {!notifAllowed && (
          <button style={{ ...btn, background: "#1a1a2e", border: "1px solid #333", color: "#aaa", fontSize: 11, marginTop: 6 }}
            onClick={() => requestNotifPermission().then(ok => setNotifAllowed(ok))}>
            🔔 Turn on Notifications
          </button>
        )}
      </motion.div>

      <motion.div className="dv-anim" style={card} whileHover={{ borderColor: "var(--sr-accent-muted, rgba(255,31,90,0.35))" }}>
        <div style={cardTitle}>📡 Live Position</div>
        {[
          ["Latitude",     location?.lat?.toFixed(6) ?? "—"],
          ["Longitude",    location?.lng?.toFixed(6) ?? "—"],
          ["Speed",        `${speed} km/h`],
          ["Status",       isOnline ? "🟢 Tracking" : "⚫ Offline"],
          ["Last Booking", lastConfirmedId ? `#${lastConfirmedId}` : "No confirmed booking"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--sr-border, rgba(255,255,255,0.12))" }}>
            <span style={{ color: "var(--sr-text-muted, rgba(255,246,242,0.55))", fontSize: 12 }}>{k}</span>
            <span style={{ color: "#00c853", fontSize: 12, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </motion.div>

      {route && (
        <motion.div className={`dv-anim ${route.status === "pending" ? "route-pulse" : ""}`}
          style={{ ...card, border: `2px solid ${routeBorder}`, background: "#0f0f0f" }}>
          <div style={{ ...cardTitle, color: routeBorder, fontSize: 13 }}>
            {route.status === "pending"  ? "🚨 Route Assign Hua!" :
             route.status === "accepted" ? "🧭 Route Active"       :
                                           "🏁 Trip Complete"}
          </div>
          <div style={{ fontSize: 12, color: "var(--sr-text-sub, rgba(255,246,242,0.78))", lineHeight: 1.9, marginBottom: 10 }}>
            <div>📍 <b>Pickup:</b> {route.pickup_location}</div>
            <div>🏥 <b>Hospital:</b> {route.destination}</div>
            {route.distance_km && (
              <div>📏 <b>Driver→Pickup:</b>{" "}
                {(() => {
                  const n = parseFloat(route.distance_km);
                  return Number.isFinite(n) ? n.toFixed(1) + " km" : route.distance_km;
                })()}
              </div>
            )}
            {route.duration && (
              <div>⏱ <b>ETA:</b>{" "}
                {(() => {
                  const n = parseFloat(route.duration);
                  return Number.isFinite(n) ? "~" + Math.round(n) + " min" : route.duration;
                })()}
              </div>
            )}
          </div>
          {route.status === "pending" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...btn, flex: 1, background: "#00c853", color: "#000" }} onClick={() => respondRoute("accepted")}>✅ Accept</button>
              <button style={{ ...btn, flex: 1, background: "#e53935" }} onClick={() => respondRoute("rejected")}>❌ Reject</button>
            </div>
          )}
          {route.status === "accepted" && (
            <button style={{ ...btn, background: "#00c853", color: "#000" }} onClick={() => respondRoute("completed")}>🏁 Mark Trip as Completed</button>
          )}
        </motion.div>
      )}

      <motion.div className="dv-anim" style={card} whileHover={{ borderColor: "var(--sr-accent-muted, rgba(255,31,90,0.35))" }}>
        <div style={cardTitle}>📋 Activity Log</div>
        <div style={{ maxHeight: 180, overflowY: "auto" }}>
          {log.length === 0
            ? <div style={{ color: "var(--sr-text-muted, rgba(255,246,242,0.55))", fontSize: 12 }}>No activity.</div>
            : log.map((l, i) => (
              <div key={i} style={{ fontSize: 11, color: logColors[l.type] || "#888", marginBottom: 4 }}>
                <span style={{ color: "var(--sr-text-muted, rgba(255,246,242,0.55))" }}>{l.time} </span>{l.msg}
              </div>
            ))}
        </div>
      </motion.div>
    </>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .dv-root {
          display: flex; flex-direction: column; height: 100vh;
          margin-left: 64px; width: calc(100vw - 64px); padding-top: 64px;
          background:
            radial-gradient(920px 430px at 88% 8%, rgba(255,48,92,0.16), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(255,122,24,0.11), transparent 70%),
            var(--sr-bg, #06040a);
          color: var(--sr-text, #fff6f2);
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          overflow: hidden;
        }
        .dv-header { background:var(--sr-nav-bg,rgba(10,8,16,0.92)); border-bottom:1px solid var(--sr-nav-border,rgba(255,255,255,0.12)); padding:10px 14px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; gap:8px; }
        .dv-header-left { display:flex; align-items:center; gap:10px; min-width:0; }
        .dv-body { display:flex; flex:1; overflow:hidden; min-height:0; }
        .dv-panel { width:270px; min-width:270px; background:var(--sr-surface-2,#171420); border-right:1px solid var(--sr-border,rgba(255,255,255,0.12)); padding:10px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; flex-shrink:0; }
        .dv-map { flex:1; position:relative; min-width:0; }
        .dv-mobile-panel { display:none; flex:1; overflow-y:auto; padding:12px; flex-direction:column; gap:10px; background:var(--sr-bg,#06040a); }
        .dv-bottom-nav { display:none; position:fixed; bottom:0; left:0; right:0; background:var(--sr-nav-bg,rgba(10,8,16,0.92)); border-top:1px solid var(--sr-nav-border,rgba(255,255,255,0.12)); height:60px; z-index:200; padding:0 4px; }
        .dv-bottom-nav-inner { display:flex; align-items:stretch; height:100%; }
        .dv-bnav-item { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; cursor:pointer; padding:6px 4px; border-top:2px solid transparent; transition:all 0.15s; position:relative; }
        .dv-bnav-item.active { border-top-color:var(--sr-accent,#ff1f5a); }
        .dv-bnav-icon { font-size:18px; line-height:1; }
        .dv-bnav-label { font-size:9px; font-weight:700; color:var(--sr-text-muted,rgba(255,246,242,0.55)); }
        .dv-bnav-item.active .dv-bnav-label { color:var(--sr-text,#fff6f2); }
        .dv-bnav-badge { position:absolute; top:4px; right:calc(50% - 14px); background:var(--sr-accent,#ff1f5a); color:#fff; font-size:8px; font-weight:800; border-radius:10px; padding:1px 5px; min-width:14px; text-align:center; }
        @keyframes routePulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,170,0,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,170,0,0)} }
        .route-pulse { animation:routePulse 1.5s infinite; }
        @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .dot-pulse { animation:dotPulse 1.5s infinite; }
        .sr-dark-popup .leaflet-popup-content-wrapper { background:var(--sr-surface,#171420)!important; border:1px solid var(--sr-border,rgba(255,255,255,0.12))!important; border-radius:10px!important; box-shadow:0 8px 32px rgba(0,0,0,0.8)!important; padding:0!important; }
        .sr-dark-popup .leaflet-popup-content { margin:0!important; }
        .sr-dark-popup .leaflet-popup-tip { background:var(--sr-surface-2,#171420)!important; }
        .leaflet-control-zoom a { background:var(--sr-surface,#171420)!important; color:var(--sr-text,#fff6f2)!important; border-color:var(--sr-border,rgba(255,255,255,0.12))!important; }
        .leaflet-control-zoom a:hover { background:var(--sr-hover,rgba(255,255,255,0.08))!important; }
        .leaflet-routing-container { display:none!important; }
        @media (max-width:1024px) { .dv-root { margin-left:64px; width:calc(100vw - 64px); } .dv-panel { width:240px; min-width:240px; } }
        @media (max-width:767px) {
          .dv-root { margin-left:0; width:100vw; padding-top:0; height:calc(100vh - 60px); }
          .dv-panel { display:none; }
          .dv-mobile-panel { display:flex; }
          .dv-mobile-panel.hidden { display:none; }
          .dv-map.hidden { display:none; }
          .dv-bottom-nav { display:flex; }
          .dv-header { padding:8px 12px; }
        }
        @media (max-width:480px) { .dv-panel { width:260px; } }
      `}</style>

      <div className="dv-root" ref={rootRef}>
        <div className="dv-header">
          <div className="dv-header-left">
            <span style={{ fontSize: 20, flexShrink: 0 }}>🚑</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>Driver Dashboard</div>
              <div style={{ fontSize: 10, color: "var(--sr-text-muted, rgba(255,246,242,0.55))" }}>YiCare GPS · Live Tracking</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, border: `1px solid ${notifAllowed ? "#00c853" : "var(--sr-border,rgba(255,255,255,0.12))"}`, color: notifAllowed ? "#00c853" : "var(--sr-text-muted,rgba(255,246,242,0.55))", background: notifAllowed ? "rgba(0,200,83,0.08)" : "var(--sr-input-bg,rgba(255,255,255,0.07))", whiteSpace: "nowrap" }}>
              {notifAllowed ? "🔔 ON" : "🔕 OFF"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: `1px solid ${isOnline ? "#00c853" : "var(--sr-border,rgba(255,255,255,0.12))"}`, background: isOnline ? "rgba(0,200,83,0.1)" : "var(--sr-input-bg,rgba(255,255,255,0.07))", color: isOnline ? "#00c853" : "var(--sr-text-muted,rgba(255,246,242,0.55))", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>
              <div className={isOnline ? "dot-pulse" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? "#00c853" : "#444" }} />
              {isOnline ? "LIVE" : "OFFLINE"}
            </div>
          </div>
        </div>

        <div className="dv-body">
          <div className="dv-panel">{panelContent}</div>

          <div className={`dv-map ${mobileTab !== "map" ? "hidden" : ""}`} style={{ overflow: "hidden", position: "relative", background: "#111" }}>
            <button onClick={() => setIs3D(!is3D)} style={{
              position: "absolute", top: 12, right: 12, zIndex: 1000,
              background: "#000", color: "#fff", border: "none", padding: "8px 16px",
              borderRadius: 20, cursor: "pointer", fontWeight: 600, fontSize: 11,
              display: "flex", gap: "6px", alignItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}>
              {is3D ? "🌍 Disable 3D View" : "🧊 Enable 3D View"}
            </button>
            <div ref={mapDivRef} style={{
              position: "absolute", top: -100, left: -100, right: -100, bottom: -100,
              zIndex: 1, transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
              transform: is3D ? "perspective(1200px) rotateX(55deg) scale(1.6) translateY(-5%)" : "scale(1)",
              transformOrigin: "center center",
            }} />
            {!isOnline && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(8,6,12,0.72)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
                <div style={{ fontSize: 48 }}>🚑</div>
                <div style={{ color: "var(--sr-text-muted,rgba(255,246,242,0.55))", marginTop: 12, fontSize: 13, textAlign: "center", padding: "0 20px" }}>Start tracking to view live map</div>
              </div>
            )}
          </div>

          <div className={`dv-mobile-panel ${mobileTab !== "panel" ? "hidden" : ""}`}>{panelContent}</div>
        </div>
      </div>

      <nav className="dv-bottom-nav">
        <div className="dv-bottom-nav-inner">
          <div className={`dv-bnav-item ${mobileTab === "map" ? "active" : ""}`} onClick={() => setMobileTab("map")}>
            <span className="dv-bnav-icon">🗺</span>
            <span className="dv-bnav-label">Live Map</span>
          </div>
          <div className={`dv-bnav-item ${mobileTab === "panel" ? "active" : ""}`} onClick={() => setMobileTab("panel")}>
            {route?.status === "pending" && <span className="dv-bnav-badge">!</span>}
            <span className="dv-bnav-icon">⚙️</span>
            <span className="dv-bnav-label">Controls</span>
          </div>
        </div>
      </nav>
    </>
  );
}
