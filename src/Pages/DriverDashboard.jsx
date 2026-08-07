import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useLeaflet, { DELHI, makePinIcon, geocodeInIndia, fetchRoadRoute, fetchRouteWithManeuvers, fetchNearestRoadPoint, LIGHT_TILE, SATELLITE_TILE } from "../hooks/useLeaflet";
import { motion } from "framer-motion";
import gsap from "gsap";

const BASE          = "http://127.0.0.1:8000";
const PING_INTERVAL = 5000;
const POLL_INTERVAL = 8000;
const LOW_BATTERY_THRESHOLD = 15;
const normalizeName = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/saharda/g, "sharda")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const inIndia = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
const approxMins = (km) => Math.max(1, Math.round((km / 28) * 60));
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
const nearestPointOnPath = (point, path, startIdx = 0) => {
  if (!point || !Array.isArray(path) || path.length === 0) return { idx: 0, distKm: Infinity };
  let bestIdx = Math.max(0, Math.min(startIdx, path.length - 1));
  let bestDist = Infinity;
  for (let i = bestIdx; i < path.length; i += 1) {
    const p = path[i];
    if (!Array.isArray(p) || p.length < 2) continue;
    const dist = haversineKm(point, { lat: Number(p[0]), lng: Number(p[1]) });
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, distKm: bestDist };
};

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
  const locationRouter = useLocation();
  const leafletReady = useLeaflet();

  const driverEmail = localStorage.getItem("user")             || "";
  const driverName  = localStorage.getItem("name")             || "Driver";
  const ambId       = parseInt(localStorage.getItem("ambulance_id") || "0");
  const ambNumber   = localStorage.getItem("ambulance_number") || "—";

  const [driverPhone,   setDriverPhone]  = useState(localStorage.getItem("phone") || "");
  const [ambulance,     setAmbulance]    = useState(null);
  const [liveBatteryPct, setLiveBatteryPct] = useState(null);
  const [myBookings,    setMyBookings]   = useState([]);
  const [isTracking,    setIsTracking]   = useState(false);
  const [location,      setLocation]     = useState(null);
  const [speed,         setSpeed]        = useState(0);
  const [route,         setRoute]        = useState(null);
  const [routeAlert, setRouteAlert] = useState("");
  const [notifAllowed,  setNotifAllowed] = useState(Notification.permission === "granted");
  const [log,           setLog]          = useState([]);
  const [tab,           setTab]          = useState("map");
  const [allAmbs,       setAllAmbs]      = useState([]);
  const [allHospitals,  setAllHospitals] = useState([]);
  const [changeReqAmb,  setChangeReqAmb] = useState(null);
  const [effectiveAmbId, setEffectiveAmbId] = useState(ambId || 0);
  const [pendingReq,    setPendingReq]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("dr_change_req") || "null"); } catch { return null; }
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [reportDrafts,  setReportDrafts]  = useState({});
  const [bookingMenuOpenId, setBookingMenuOpenId] = useState(null);
  const [deletingBookingId, setDeletingBookingId] = useState(null);
  const [is3D, setIs3D] = useState(false);

  const mapDivRef    = useRef(null);
  const mapWrapRef   = useRef(null);
  const rootRef      = useRef(null);
  const mapObj       = useRef(null);
  const driverMarker = useRef(null);
  const pickupMarkerRef = useRef(null);
  const hospitalMarkerRef = useRef(null);
  const routingRef   = useRef(null);
  const routeLineRef = useRef(null);
  const routeLine2Ref = useRef(null);
  const connectorLineRef = useRef(null);
  const routeLeg1PathRef = useRef([]);
  const routeLeg2PathRef = useRef([]);
  const routeLeg1ProgressRef = useRef(0);
  const routeLeg2ProgressRef = useRef(0);
  const routeLeg1ManeuversRef = useRef([]);
  const routeLeg2ManeuversRef = useRef([]);
  const activeManeuverLeg1Ref = useRef(0);
  const activeManeuverLeg2Ref = useRef(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceEnabledRef = useRef(false);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  const routeBookingIdRef = useRef(0);
  const wrongRouteStateRef = useRef(false);
  const wrongRouteChatGateRef = useRef(0);
  const routeRecalcGateRef = useRef(0);
  const tileLayerRef = useRef(null);
  const latestLoc    = useRef(null);
  const watchId      = useRef(null);
  const pingTimer    = useRef(null);
  const firstPan     = useRef(true);
  const lastRouteKeyRef = useRef("");
  const hasAutoFittedRef = useRef(false);
  const lastRenderedRouteKeyRef = useRef("");
  const userMovedMapRef = useRef(false);
  const pickupLLRef = useRef(null);
  const destLLRef = useRef(null);
  const batteryLevelRef = useRef(null);
  const liveUpdateGateRef = useRef(0);
  const [liveLegStats, setLiveLegStats] = useState({
    toPickupKm: null,
    toPickupMins: null,
    toHospitalKm: null,
    toHospitalMins: null,
  });

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
              : `❌ Change request rejected: ${serverNotif.ambNumber}`,
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
        const mine =
          data.find(a => Number(a.id) === Number(ambId)) ||
          data.find(a => String(a.driver_email || "").toLowerCase() === String(driverEmail || "").toLowerCase()) ||
          data.find(a => String(a.driver || "").toLowerCase() === String(driverName || "").toLowerCase());
        if (mine) {
          setAmbulance(mine);
          setEffectiveAmbId(Number(mine.id) || 0);
          localStorage.setItem("ambulance_id", String(mine.id));
          if (mine.ambulance_number) localStorage.setItem("ambulance_number", mine.ambulance_number);
          if (mine.driver_contact) {
            const saved = localStorage.getItem("phone");
            if (!saved || saved === "") {
              localStorage.setItem("phone", mine.driver_contact);
              setDriverPhone(mine.driver_contact);
            }
          }
        }
      }).catch(() => {});
  }, [ambId, driverEmail, driverName]);

  const fetchBookings = useCallback(() => {
    fetch(`${BASE}/api/bookings/`)
      .then(r => r.json())
      .then(data => {
        const rows = Array.isArray(data) ? data : (data ? [data] : []);
        const eId = Number(effectiveAmbId || ambId || 0);
        const dName = String(driverName || "").toLowerCase().trim();
        const dEmail = String(driverEmail || "").toLowerCase().trim();
        const dPhone = String((driverPhone || localStorage.getItem("phone") || "")).replace(/\D+/g, "");
        const ambNo = String(ambulance?.ambulance_number || localStorage.getItem("ambulance_number") || ambNumber || "").toLowerCase().trim();
        const mine = rows
          .filter((b) => {
            const byAmb = eId > 0 && Number(b.ambulance_id) === eId;
            const byDriver = dName && String(b.driver || "").toLowerCase().trim() === dName;
            const byAmbNo = ambNo && String(b.ambulance_number || "").toLowerCase().trim() === ambNo;
            const mappedAmb = allAmbs.find((a) => Number(a.id) === Number(b.ambulance_id));
            const bookingDriverEmail = String(b.driver_email || mappedAmb?.driver_email || "").toLowerCase().trim();
            const byDriverEmail = dEmail && bookingDriverEmail === dEmail;
            const bPhone = String(b.driver_contact || "").replace(/\D+/g, "");
            const byDriverPhone = dPhone && bPhone && bPhone === dPhone;
            return byAmb || byAmbNo || byDriver || byDriverEmail || byDriverPhone;
          })
          .filter(
            (b) =>
              b.sent_to_driver ||
              b.driver_task_completed ||
              b.status === "completed" ||
              b.status === "confirmed" ||
              b.status === "pending"
          )
          .sort((a, b) => b.id - a.id);
        setMyBookings(mine);
        const confirmed = mine.filter(b => b.status === "confirmed" && b.sent_to_driver);
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
                title: `✅ Dispatch #${latest.id} Assigned!`,
                message: `${latest.booked_by} pickup — ${latest.pickup_location}`,
                timestamp: new Date().toISOString(), read: false,
              });
              localStorage.setItem(notifKey, JSON.stringify(existing));
              loadNotifications();
            }
            if (leafletReady && latest.pickup_location) drawRoute(latest.pickup_location, latest.destination, latest.id);
          }
        }
      }).catch(() => {});
  }, [ambId, effectiveAmbId, driverName, driverEmail, driverPhone, ambulance, ambNumber, allAmbs, leafletReady, loadNotifications]);

  const completeBookingTask = async (bookingId) => {
    try {
      await fetch(`${BASE}/api/bookings/${bookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_task_complete: true }),
      });
      addLog(`🏁 Booking #${bookingId} task complete`, "success");
      fetchBookings();
    } catch {
      addLog("❌ Task complete update fail", "error");
    }
  };

  const cancelDriverRequest = async (bookingId) => {
    try {
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_driver_request: true }),
      });
      if (!res.ok) throw new Error("Cancel failed");
      addLog(`❌ Booking #${bookingId} request cancelled by driver`, "warn");
      fetchBookings();
      if (route?.booking_id === bookingId && route?.id) {
        try {
          await fetch(`${BASE}/api/driver/route/${route.id}/respond/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "rejected" }),
          });
        } catch {}
        setRoute(null);
      }
    } catch {
      addLog("Cancel request failed", "error");
    }
  };

  const updateReportDraft = (bookingId, key, value) => {
    setReportDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        patient_name: "",
        patient_age: "",
        patient_gender: "",
        attendant_name: "",
        attendant_contact: "",
        patient_condition: "",
        vitals_summary: "",
        ...(prev[bookingId] || {}),
        [key]: value,
      },
    }));
  };

  const submitPatientReport = async (bookingId) => {
    const draft = reportDrafts[bookingId] || {};
    if (!String(draft.patient_name || "").trim()) {
      addLog("Patient name required", "warn");
      return;
    }
    try {
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_report: {
            ...draft,
            submitted_by: driverName || "Driver Team",
          },
        }),
      });
      if (!res.ok) throw new Error("Report submit failed");
      addLog(`📝 Patient report sent for booking #${bookingId}`, "success");
      fetchBookings();
    } catch {
      addLog("❌ Patient report send failed", "error");
    }
  };

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
    tileLayerRef.current = L.tileLayer(is3D ? SATELLITE_TILE : LIGHT_TILE, { maxZoom: 19, attribution: "© Google Maps" }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    const markMoved = () => { userMovedMapRef.current = true; };
    const onResize = () => mapObj.current?.invalidateSize();
    const ro = new ResizeObserver(() => mapObj.current?.invalidateSize());
    if (mapWrapRef.current) ro.observe(mapWrapRef.current);
    ro.observe(mapDivRef.current);
    window.addEventListener("resize", onResize);
    mapObj.current.on("dragstart", markMoved);
    mapObj.current.on("zoomstart", markMoved);
    const t1 = setTimeout(() => mapObj.current?.invalidateSize(), 100);
    const t2 = setTimeout(() => mapObj.current?.invalidateSize(), 350);
    firstPan.current = true;
    lastRenderedRouteKeyRef.current = "";
    hasAutoFittedRef.current = false;
    userMovedMapRef.current = false;
    return () => {
      if (mapObj.current) {
        try {
          window.removeEventListener("resize", onResize);
          ro.disconnect();
          clearTimeout(t1);
          clearTimeout(t2);
          mapObj.current.off("dragstart", markMoved);
          mapObj.current.off("zoomstart", markMoved);
        } catch {}
        mapObj.current.remove();
        mapObj.current = null;
      }
    };
  }, [leafletReady, tab]); // Removed is3D from map init dependency intentionally

  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(is3D ? SATELLITE_TILE : LIGHT_TILE);
    }
    if (mapObj.current) {
      setTimeout(() => mapObj.current?.invalidateSize(), 60);
      setTimeout(() => mapObj.current?.invalidateSize(), 260);
    }
  }, [is3D]);

  const startTracking = () => {
    if (!navigator.geolocation) { addLog("Unsupported GPS", "error"); return; }
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
          if (firstPan.current) {
            mapObj.current.setView([loc.lat, loc.lng], 15);
            firstPan.current = false;
          }
          if (driverMarker.current) {
            driverMarker.current.setLatLng([loc.lat, loc.lng]);
          } else {
            const icon = makePinIcon("#E50914", "🚑");
            if (icon) driverMarker.current = window.L.marker([loc.lat, loc.lng], { icon })
              .addTo(mapObj.current)
              .bindPopup(`<div style="background:var(--sr-surface,#171420);color:var(--sr-text,#fff6f2);padding:8px 12px;border-radius:8px;border:1px solid var(--sr-border,rgba(255,255,255,0.12));font-weight:700">📍 ${driverName} yahan hai</div>`, { className: "sr-dark-popup" });
          }
          refreshRouteFromDriver(loc);
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
    addLog("⏹ Stop Tracking ", "warn");
  };
  useEffect(() => () => stopTracking(), []);

  useEffect(() => {
    if (!("getBattery" in navigator)) return;
    let mounted = true;
    let managerRef = null;

    const sync = () => {
      if (!mounted || !managerRef) return;
      const lvl = Number(managerRef.level);
      if (!Number.isFinite(lvl)) return;
      const pct = Math.max(0, Math.min(100, Math.round(lvl * 100)));
      batteryLevelRef.current = pct;
      setLiveBatteryPct(pct);
    };

    (async () => {
      try {
        managerRef = await navigator.getBattery();
        if (!mounted) return;
        sync();
        managerRef.addEventListener("levelchange", sync);
      } catch {
        // silent
      }
    })();

    return () => {
      mounted = false;
      if (managerRef) managerRef.removeEventListener("levelchange", sync);
    };
  }, []);

  const sendPingNow = useCallback(() => {
    const loc = latestLoc.current;
    if (!loc || !driverEmail || !ambId) return;
    const payload = { driver_email: driverEmail, ambulance_id: ambId, latitude: loc.lat, longitude: loc.lng, speed: 0 };
    if (Number.isFinite(Number(batteryLevelRef.current))) {
      payload.battery_level = Number(batteryLevelRef.current);
    }
    fetch(`${BASE}/api/driver/ping/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => {
        if (data.pending_route) {
          const nr = data.pending_route;
          setRoute(prev => {
            if (!prev || prev.id !== nr.id) {
              addLog("🗺 New route assigned!", "success");
              sendPush("🚨 New Route!", `Pickup: ${nr.pickup_location} → ${nr.destination}`, `route-${nr.id}`);
              if (leafletReady) drawRoute(nr.pickup_location, nr.destination, nr.booking_id);
            }
            return nr;
          });
        }
      }).catch(() => {});
  }, [driverEmail, ambId, leafletReady]);

  const geocode = async (addr) => {
    const raw = String(addr || "").trim();
    if (!raw) throw new Error("Address empty");
    const googleFirst = await geocodeInIndia(raw, { state: "" });
    if (googleFirst && window.L) return window.L.latLng(googleFirst.lat, googleFirst.lng);
    throw new Error(`"${raw}" geocode failed`);
  };

  const getBestOriginLatLng = () => {
    if (!window.L) return null;
    if (latestLoc.current) return window.L.latLng(latestLoc.current.lat, latestLoc.current.lng);
    const aLat = Number(ambulance?.latitude);
    const aLng = Number(ambulance?.longitude);
    if (inIndia(aLat, aLng)) return window.L.latLng(aLat, aLng);
    return window.L.latLng(DELHI.lat, DELHI.lng);
  };

  const fetchLegSummary = async (fromLL, toLL) => {
    const km = haversineKm(
      { lat: fromLL.lat, lng: fromLL.lng },
      { lat: toLL.lat, lng: toLL.lng }
    );
    if (!Number.isFinite(km) || km <= 0 || km > 300) {
      return { km: null, mins: null };
    }
    const roadKm = km * 1.22; // route approximation in city road network
    return {
      km: Number(roadKm.toFixed(1)),
      mins: approxMins(roadKm),
    };
  };

  const refreshLiveLegStats = useCallback(async (originLL) => {
    const pickupLL = pickupLLRef.current;
    if (!originLL || !pickupLL) return;
    const now = Date.now();
    if (now - liveUpdateGateRef.current < 7000) return;
    liveUpdateGateRef.current = now;

    const fallbackToPickup = haversineKm(
      { lat: originLL.lat, lng: originLL.lng },
      { lat: pickupLL.lat, lng: pickupLL.lng }
    );
    const fallbackToHospital = destLLRef.current
      ? haversineKm(
          { lat: pickupLL.lat, lng: pickupLL.lng },
          { lat: destLLRef.current.lat, lng: destLLRef.current.lng }
        )
      : null;

    const pathDistanceFromIndex = (path, startIdx = 0) => {
      if (!Array.isArray(path) || path.length < 2) return null;
      let km = 0;
      const start = Math.max(0, Math.min(startIdx, path.length - 2));
      for (let i = start; i < path.length - 1; i += 1) {
        const a = path[i];
        const b = path[i + 1];
        if (!Array.isArray(a) || !Array.isArray(b)) continue;
        km += haversineKm(
          { lat: Number(a[0]), lng: Number(a[1]) },
          { lat: Number(b[0]), lng: Number(b[1]) }
        );
      }
      return Number.isFinite(km) ? km : null;
    };

    const leg1KmFromPath = pathDistanceFromIndex(routeLeg1PathRef.current, routeLeg1ProgressRef.current);
    const leg2KmFromPath = pathDistanceFromIndex(routeLeg2PathRef.current, routeLeg2ProgressRef.current);

    const leg1 = await fetchLegSummary(originLL, pickupLL);
    const leg2 = destLLRef.current ? await fetchLegSummary(pickupLL, destLLRef.current) : null;

    const safePickupKm =
      leg1KmFromPath && leg1KmFromPath > 0 && leg1KmFromPath < 200
        ? leg1KmFromPath
        : (leg1?.km ?? Number(fallbackToPickup.toFixed(1)));
    const safeHospitalKm =
      leg2KmFromPath && leg2KmFromPath > 0 && leg2KmFromPath < 300
        ? leg2KmFromPath
        : (leg2?.km ?? (fallbackToHospital != null ? Number(fallbackToHospital.toFixed(1)) : null));

    setLiveLegStats({
      toPickupKm: safePickupKm,
      toPickupMins: safePickupKm != null ? approxMins(safePickupKm) : (leg1?.mins ?? approxMins(fallbackToPickup)),
      toHospitalKm: safeHospitalKm,
      toHospitalMins: safeHospitalKm != null ? approxMins(safeHospitalKm) : (leg2?.mins ?? (fallbackToHospital != null ? approxMins(fallbackToHospital) : null)),
    });
  }, []);

  const pushRouteAlertToChat = useCallback(async (message) => {
    const bookingId = Number(routeBookingIdRef.current || 0);
    if (!bookingId || !message) return;
    const booking = myBookings.find((b) => Number(b.id) === bookingId);
    const threadId = Number(booking?.chat_thread_id || 0);
    if (!threadId) return;
    try {
      await fetch(`${BASE}/api/bookings/chat/threads/${threadId}/messages/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_role: "driver",
          sender_name: driverName || "Driver",
          message,
          message_type: "alert",
          target_role: "all",
        }),
      });
    } catch {
      // silent
    }
  }, [myBookings, driverName]);

  const setWrongRoute = useCallback((isWrong, reason = "") => {
    if (isWrong) {
      const note = reason || "Wrong way detected. Follow highlighted route.";
      setRouteAlert(note);
      addLog("⚠ Wrong route detected", "warn");
      sendPush("⚠ Wrong Route", "You are moving away from assigned route. Please rejoin.");
      const now = Date.now();
      if (!wrongRouteStateRef.current || now - wrongRouteChatGateRef.current > 45000) {
        wrongRouteChatGateRef.current = now;
        pushRouteAlertToChat("You are on wrong way. Please rejoin the assigned route.");
      }
    } else {
      if (wrongRouteStateRef.current) {
        pushRouteAlertToChat("Route corrected. Driver is back on assigned route.");
      }
      setRouteAlert("");
    }
    wrongRouteStateRef.current = isWrong;
  }, [pushRouteAlertToChat]);

  const ensureAmbulanceMarker = (originLL) => {
    if (!mapObj.current || !window.L || !originLL) return;
    const L = window.L;
    if (driverMarker.current) {
      driverMarker.current.setLatLng([originLL.lat, originLL.lng]);
      return;
    }
    const icon = makePinIcon("#E50914", "🚑");
    if (!icon) return;
    driverMarker.current = L.marker([originLL.lat, originLL.lng], { icon })
      .addTo(mapObj.current)
      .bindPopup(
        `<div style="background:var(--sr-surface,#171420);color:var(--sr-text,#fff6f2);padding:8px 12px;border-radius:8px;border:1px solid var(--sr-border,rgba(255,255,255,0.12));font-weight:700">🚑 ${driverName} / Ambulance</div>`,
        { className: "sr-dark-popup" }
      );
  };

  const syncRouteMarkers = (pickupLL, destLL) => {
    if (!mapObj.current || !window.L) return;
    const L = window.L;
    if (pickupMarkerRef.current) {
      try { mapObj.current.removeLayer(pickupMarkerRef.current); } catch {}
      pickupMarkerRef.current = null;
    }
    if (hospitalMarkerRef.current) {
      try { mapObj.current.removeLayer(hospitalMarkerRef.current); } catch {}
      hospitalMarkerRef.current = null;
    }

    pickupMarkerRef.current = L.marker(pickupLL, { icon: makePinIcon("#f7c948", "📍") })
      .addTo(mapObj.current)
      .bindPopup("User Pickup");

    if (destLL) {
      hospitalMarkerRef.current = L.marker(destLL, { icon: makePinIcon("#00d4aa", "🏥") })
        .addTo(mapObj.current)
        .bindPopup("Assigned Hospital");
    }
  };

  const drawFallbackRoute = async (origin, pickupLL, destLL, pickupRoadLL = null, destRoadLL = null) => {
    if (!mapObj.current || !window.L) return;
    const L = window.L;
    if (routeLineRef.current) {
      try { mapObj.current.removeLayer(routeLineRef.current); } catch {}
      routeLineRef.current = null;
    }
    if (routeLine2Ref.current) {
      try { mapObj.current.removeLayer(routeLine2Ref.current); } catch {}
      routeLine2Ref.current = null;
    }
    if (connectorLineRef.current) {
      try { mapObj.current.removeLayer(connectorLineRef.current); } catch {}
      connectorLineRef.current = null;
    }
    let bounds = L.latLngBounds();

    const routePickup = pickupRoadLL || pickupLL;
    const routeDest = destRoadLL || destLL;
    routeLeg1PathRef.current = [];
    routeLeg2PathRef.current = [];
    routeLeg1ProgressRef.current = 0;
    routeLeg2ProgressRef.current = 0;
    routeLeg1ManeuversRef.current = [];
    routeLeg2ManeuversRef.current = [];
    activeManeuverLeg1Ref.current = 0;
    activeManeuverLeg2Ref.current = 0;
    setWrongRoute(false);

    if (origin && routePickup) {
      const road1 = await fetchRouteWithManeuvers(
        [{ lat: origin.lat, lng: origin.lng }, { lat: routePickup.lat, lng: routePickup.lng }],
        { allowStraightFallback: false }
      );
      const straightGapKm = haversineKm(
        { lat: origin.lat, lng: origin.lng },
        { lat: routePickup.lat, lng: routePickup.lng }
      );
      const safeRoad1 = road1.path?.length > 1
        ? road1.path
        : [[origin.lat, origin.lng], [routePickup.lat, routePickup.lng]];
      routeLeg1PathRef.current = safeRoad1;
      routeLeg1ManeuversRef.current = road1.maneuvers || [];
      if (routeLineRef.current) { try { mapObj.current.removeLayer(routeLineRef.current); } catch {} }
      if (safeRoad1.length > 1) {
        routeLineRef.current = L.polyline(safeRoad1, {
          color: "#e50914", // Red for Ambulance -> Pickup
          weight: 6,
          opacity: road1.path?.length > 1 ? 0.92 : 0.7,
          dashArray: road1.path?.length > 1 ? null : "12,10",
        }).addTo(mapObj.current);
        bounds.extend(routeLineRef.current.getBounds());
      } else {
        routeLineRef.current = null;
      }
    }

    if (routePickup && routeDest) {
        const road2 = await fetchRouteWithManeuvers(
          [{ lat: routePickup.lat, lng: routePickup.lng }, { lat: routeDest.lat, lng: routeDest.lng }],
          { allowStraightFallback: false }
        );
        const straightGapKm2 = haversineKm(
          { lat: routePickup.lat, lng: routePickup.lng },
          { lat: routeDest.lat, lng: routeDest.lng }
        );
        const safeRoad2 = road2.path?.length > 1
          ? road2.path
          : [[routePickup.lat, routePickup.lng], [routeDest.lat, routeDest.lng]];
        routeLeg2PathRef.current = safeRoad2;
        routeLeg2ManeuversRef.current = road2.maneuvers || [];
        if (routeLine2Ref.current) { try { mapObj.current.removeLayer(routeLine2Ref.current); } catch {} }
        if (safeRoad2.length > 1) {
          routeLine2Ref.current = L.polyline(safeRoad2, {
            color: "#7b61ff", // Blueish for Pickup -> Hospital
            weight: 6,
            opacity: road2.path?.length > 1 ? 0.92 : 0.7,
            dashArray: road2.path?.length > 1 ? null : "12,10",
          }).addTo(mapObj.current);
          bounds.extend(routeLine2Ref.current.getBounds());
        } else {
          routeLine2Ref.current = null;
        }
    }

    // Dashed connector from snapped road end to exact destination marker (if different)
    if (destLL && routeDest) {
      const gapKm = haversineKm(
        { lat: destLL.lat, lng: destLL.lng },
        { lat: routeDest.lat, lng: routeDest.lng }
      );
      if (gapKm > 0.02) {
        if (connectorLineRef.current) { try { mapObj.current.removeLayer(connectorLineRef.current); } catch {} }
        connectorLineRef.current = L.polyline(
          [[routeDest.lat, routeDest.lng], [destLL.lat, destLL.lng]],
          {
            color: "#7b61ff",
            weight: 3,
            opacity: 0.7,
            dashArray: "6,8",
          }
        ).addTo(mapObj.current);
        bounds.extend(connectorLineRef.current.getBounds());
      }
    }

    if (!routeLineRef.current && !routeLine2Ref.current) return;
    if (!hasAutoFittedRef.current && !userMovedMapRef.current && bounds.isValid()) {
      mapObj.current.fitBounds(bounds, { padding: [100, 100] }); // Increased padding to zoom out more
      hasAutoFittedRef.current = true;
    }
  };

  const speakManeuver = useCallback((instruction) => {
    if (!voiceEnabledRef.current || !instruction) return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(instruction);
      utterance.rate = 1.0; 
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const updateRouteProgressFromOrigin = useCallback((origin) => {
    if (!origin) return;
    const pickupLL = pickupLLRef.current;
    const destLL = destLLRef.current;
    const leg1 = routeLeg1PathRef.current || [];
    const leg2 = routeLeg2PathRef.current || [];
    const reachedPickup =
      !!pickupLL &&
      (haversineKm({ lat: origin.lat, lng: origin.lng }, { lat: pickupLL.lat, lng: pickupLL.lng }) <= 0.4 ||
        routeLeg1ProgressRef.current >= Math.max(0, leg1.length - 2));

    let wrongDetected = false;
    let rerouteNeeded = false;
    let maxOffRouteKm = 0;

    if (!reachedPickup && leg1.length > 1 && routeLineRef.current) {
      const metrics = nearestPointOnPath(
        { lat: origin.lat, lng: origin.lng },
        leg1,
        routeLeg1ProgressRef.current
      );
      maxOffRouteKm = Math.max(maxOffRouteKm, Number(metrics.distKm || 0));
      if (metrics.distKm > 1.25) {
        rerouteNeeded = true;
      } else if (metrics.distKm > 0.45) {
        wrongDetected = true;
      } else {
        routeLeg1ProgressRef.current = Math.max(routeLeg1ProgressRef.current, metrics.idx);
        
        // Voice trigger leg 1
        const m1 = routeLeg1ManeuversRef.current;
        const c1 = activeManeuverLeg1Ref.current;
        if (m1 && c1 < m1.length && routeLeg1ProgressRef.current >= (m1[c1].begin_shape_index - 8)) {
            speakManeuver(m1[c1].instruction);
            activeManeuverLeg1Ref.current += 1;
        }

        let rem = leg1.slice(routeLeg1ProgressRef.current);
        // Force minimum 2 points so polyline continues to display from current loc
        if (rem.length === 1) {
          rem = [[origin.lat, origin.lng], rem[0]];
        }
        routeLineRef.current.setLatLngs(rem);
      }
    }

    if (reachedPickup && routeLineRef.current) {
      routeLineRef.current.setLatLngs([]);
    }

    if (reachedPickup && destLL && leg2.length > 1 && routeLine2Ref.current) {
      const metrics2 = nearestPointOnPath(
        { lat: origin.lat, lng: origin.lng },
        leg2,
        routeLeg2ProgressRef.current
      );
      maxOffRouteKm = Math.max(maxOffRouteKm, Number(metrics2.distKm || 0));
      if (metrics2.distKm > 1.5) {
        rerouteNeeded = true;
      } else if (metrics2.distKm > 0.55) {
        wrongDetected = true;
      } else {
        routeLeg2ProgressRef.current = Math.max(routeLeg2ProgressRef.current, metrics2.idx);

        // Voice trigger leg 2
        const m2 = routeLeg2ManeuversRef.current;
        const c2 = activeManeuverLeg2Ref.current;
        if (m2 && c2 < m2.length && routeLeg2ProgressRef.current >= (m2[c2].begin_shape_index - 8)) {
            speakManeuver(m2[c2].instruction);
            activeManeuverLeg2Ref.current += 1;
        }

        let rem2 = leg2.slice(routeLeg2ProgressRef.current);
        if (rem2.length === 1) {
          rem2 = [[origin.lat, origin.lng], rem2[0]];
        }
        routeLine2Ref.current.setLatLngs(rem2);
      }
    }

    if (rerouteNeeded) {
      setWrongRoute(false);
      return { wrongDetected: false, rerouteNeeded: true, maxOffRouteKm };
    }

    if (wrongDetected) {
      setWrongRoute(true, "Wrong direction detected. Route se bahar ja rahe ho.");
    } else {
      setWrongRoute(false);
    }
    return { wrongDetected, rerouteNeeded: false, maxOffRouteKm };
  }, [setWrongRoute]);

  const refreshRouteFromDriver = useCallback((loc) => {
    if (!leafletReady || !window.L || !mapObj.current || !loc || !pickupLLRef.current) return;
    const L = window.L;
    const origin = L.latLng(loc.lat, loc.lng);
    if (!routeLineRef.current && !routeLine2Ref.current) {
      void drawFallbackRoute(origin, pickupLLRef.current, destLLRef.current);
    } else {
      const progress = updateRouteProgressFromOrigin(origin);
      if (progress?.rerouteNeeded) {
        const now = Date.now();
        if (now - routeRecalcGateRef.current > 20000) {
          routeRecalcGateRef.current = now;
          setRouteAlert("Route recalibrating from current GPS position...");
          void drawFallbackRoute(origin, pickupLLRef.current, destLLRef.current);
        }
      }
    }
    refreshLiveLegStats(origin);
  }, [leafletReady, refreshLiveLegStats, updateRouteProgressFromOrigin]);

  const drawRoute = async (pickup, destination, bookingId = null) => {
    if (!leafletReady || !mapObj.current || !window.L) return;
    const L = window.L;
    const bookingRef = bookingId ? myBookings.find((b) => Number(b.id) === Number(bookingId)) : null;
    const routeKey = [
      bookingId || 0,
      pickup || "",
      destination || "",
      bookingRef?.pickup_latitude || "",
      bookingRef?.pickup_longitude || "",
      bookingRef?.assigned_hospital_id || "",
      bookingRef?.assigned_hospital_name || "",
      allHospitals.length || 0,
    ].join("|");
    if (routeKey === lastRenderedRouteKeyRef.current && (routingRef.current || routeLineRef.current || routeLine2Ref.current)) {
      return; // same route already rendered
    }
    if (routingRef.current) { try { mapObj.current.removeControl(routingRef.current); } catch {} routingRef.current = null; }
    if (routeLineRef.current) { try { mapObj.current.removeLayer(routeLineRef.current); } catch {} routeLineRef.current = null; }
    if (routeLine2Ref.current) { try { mapObj.current.removeLayer(routeLine2Ref.current); } catch {} routeLine2Ref.current = null; }
    if (connectorLineRef.current) { try { mapObj.current.removeLayer(connectorLineRef.current); } catch {} connectorLineRef.current = null; }
    const forceRefit = routeKey !== lastRouteKeyRef.current;
    if (forceRefit) {
      hasAutoFittedRef.current = false;
      userMovedMapRef.current = false;
      lastRouteKeyRef.current = routeKey;
    }
    try {
      routeBookingIdRef.current = Number(bookingRef?.id || bookingId || 0);
      const pickupTextFromBooking = [
        bookingRef?.pickup_landmark,
        bookingRef?.pickup_city,
        bookingRef?.pickup_district,
      ].filter(Boolean).join(", ");
      const pickupCandidates = [
        pickupTextFromBooking,
        bookingRef?.pickup_location,
        pickup,
      ].filter(Boolean);

      let pickupLL = null;
      let pickupFromText = null;
      const pickupContext = {
        landmark: bookingRef?.pickup_landmark || "",
        area: bookingRef?.pickup_location || "",
        city: bookingRef?.pickup_city || "",
        district: bookingRef?.pickup_district || "",
        state: "",
      };
      for (const candidate of pickupCandidates) {
        if (pickupFromText) break;
        try {
          pickupFromText = await geocodeInIndia(candidate, pickupContext);
          if (pickupFromText) break;
        } catch {
          // try next candidate
        }
      }
      const bookingPickupLat = Number(bookingRef?.pickup_latitude);
      const bookingPickupLng = Number(bookingRef?.pickup_longitude);
      const pickupFromBooking = inIndia(bookingPickupLat, bookingPickupLng)
        ? { lat: bookingPickupLat, lng: bookingPickupLng }
        : null;
      if (pickupFromBooking) {
        pickupLL = L.latLng(pickupFromBooking.lat, pickupFromBooking.lng);
      } else if (pickupFromText && inIndia(pickupFromText.lat, pickupFromText.lng)) {
        pickupLL = L.latLng(pickupFromText.lat, pickupFromText.lng);
      }
      if (!pickupLL) {
        for (const candidate of pickupCandidates) {
          if (pickupFromText) break;
          try {
            pickupFromText = await geocode(`${candidate}, India`);
            if (pickupFromText) break;
          } catch {
            // try next candidate
          }
        }
        if (pickupFromText) {
          pickupLL = pickupFromText;
        }
      }
      if (!pickupLL) throw new Error("Pickup geocode failed for booking location");

      let destLL = null;
      if (destination) {
        const byId = bookingRef?.assigned_hospital_id
          ? allHospitals.find((h) => Number(h.id) === Number(bookingRef.assigned_hospital_id))
          : null;
        const wanted = normalizeName(bookingRef?.assigned_hospital_name || destination);
        const byName = allHospitals.find((h) => normalizeName(h.name) === wanted);
        const resolvedHospital = byId || byName;

        if (resolvedHospital?.latitude && resolvedHospital?.longitude) {
          const lat = parseFloat(resolvedHospital.latitude);
          const lng = parseFloat(resolvedHospital.longitude);
          if (inIndia(lat, lng)) {
            destLL = L.latLng(lat, lng);
          }
        } else {
          try {
            const addressHint = String(
              bookingRef?.assigned_hospital_address ||
              resolvedHospital?.address ||
              ""
            ).trim();
            const richDestination = [destination, addressHint].filter(Boolean).join(", ");
            const resolved = await geocodeInIndia(richDestination || destination, {
              city: bookingRef?.pickup_city || "",
              district: bookingRef?.pickup_district || "",
              state: "",
            });
            if (resolved && inIndia(resolved.lat, resolved.lng)) {
              destLL = L.latLng(resolved.lat, resolved.lng);
            } else {
              destLL = await geocode(`${richDestination || destination}, India`);
            }
          } catch {
            destLL = await geocode(destination);
          }
        }
      }
      const origin = getBestOriginLatLng();

      const snapPoint = async (p) => {
        if (!p) return null;
        try {
          const snapped = await fetchNearestRoadPoint({ lat: p.lat, lng: p.lng });
          if (!snapped) return p;
          const gapKm = haversineKm(
            { lat: p.lat, lng: p.lng },
            { lat: snapped.lat, lng: snapped.lng }
          );
          if (!Number.isFinite(gapKm) || gapKm > 0.25) return p;
          return L.latLng(snapped.lat, snapped.lng);
        } catch {
          return p;
        }
      };

      const originRoad = await snapPoint(origin);
      const pickupRoad = await snapPoint(pickupLL);
      const destRoad = await snapPoint(destLL);

      ensureAmbulanceMarker(originRoad || origin);
      pickupLLRef.current = pickupLL;
      destLLRef.current = destLL;
      syncRouteMarkers(pickupLLRef.current, destLLRef.current);
      await drawFallbackRoute(
        originRoad || origin,
        pickupLLRef.current,
        destLLRef.current,
        pickupRoad || pickupLLRef.current,
        destRoad || destLLRef.current
      );
      updateRouteProgressFromOrigin(originRoad || origin);
      if (!routeLineRef.current && !routeLine2Ref.current) {
        throw new Error("Road route service unavailable for this path");
      }
      lastRenderedRouteKeyRef.current = routeKey;
      if (!hasAutoFittedRef.current && !userMovedMapRef.current) {
        mapObj.current.fitBounds(L.latLngBounds([origin, pickupLL, ...(destLL ? [destLL] : [])]), { padding: [100, 100] });
        hasAutoFittedRef.current = true;
      }
      const legA = haversineKm(
        { lat: origin.lat, lng: origin.lng },
        { lat: pickupLL.lat, lng: pickupLL.lng }
      ) * 1.22;
      const legB = destLL
        ? haversineKm(
            { lat: pickupLL.lat, lng: pickupLL.lng },
            { lat: destLL.lat, lng: destLL.lng }
          ) * 1.22
        : 0;
      addLog(`🗺 Route: ${(legA + legB).toFixed(1)} km, ~${approxMins(legA + legB)} min`, "success");
      refreshLiveLegStats(origin);
    } catch (err) {
      addLog(`Route error: ${err.message}`, "error");
    }
  };

  useEffect(() => {
    if (tab !== "map") return;
    if (!leafletReady || !route?.pickup_location) return;
    const bookingRef = route?.booking_id
      ? myBookings.find((b) => Number(b.id) === Number(route.booking_id))
      : null;
    const finalDestination =
      bookingRef?.assigned_hospital_name ||
      route?.destination ||
      bookingRef?.destination ||
      "";
    drawRoute(route.pickup_location, finalDestination, route?.booking_id);
  }, [tab, leafletReady, route?.id, route?.pickup_location, route?.destination, route?.booking_id, myBookings, allHospitals]);

  useEffect(() => {
    if (tab !== "map") return;
    if (!mapObj.current) return;
    const t = setTimeout(() => {
      mapObj.current?.invalidateSize();
    }, 120);
    return () => clearTimeout(t);
  }, [tab, route?.id, isTracking]);

  useEffect(() => {
    if (route) return;
    pickupLLRef.current = null;
    destLLRef.current = null;
    routeLeg1PathRef.current = [];
    routeLeg2PathRef.current = [];
    routeLeg1ProgressRef.current = 0;
    routeLeg2ProgressRef.current = 0;
    routeLeg1ManeuversRef.current = [];
    routeLeg2ManeuversRef.current = [];
    activeManeuverLeg1Ref.current = 0;
    activeManeuverLeg2Ref.current = 0;
    routeBookingIdRef.current = 0;
    wrongRouteStateRef.current = false;
    setRouteAlert("");
    setLiveLegStats({
      toPickupKm: null,
      toPickupMins: null,
      toHospitalKm: null,
      toHospitalMins: null,
    });
  }, [route]);

  useEffect(() => {
    if (tab !== "map") return;
    const trackBookingId = Number(new URLSearchParams(locationRouter.search).get("track") || 0);
    if (!trackBookingId) return;
    const target = myBookings.find((b) => b.id === trackBookingId);
    if (!target?.pickup_location) return;
    drawRoute(target.pickup_location, target.assigned_hospital_name || target.destination || "", target.id);
  }, [tab, locationRouter.search, myBookings]);

  const respondRoute = async (status) => {
    if (!route?.id) return;
    try {
      await fetch(`${BASE}/api/driver/route/${route.id}/respond/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (status === "completed") {
        const active = myBookings.find((b) => b.status === "confirmed" && b.sent_to_driver && !b.driver_task_completed);
        if (active?.id) {
          await fetch(`${BASE}/api/bookings/${active.id}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ driver_task_complete: true }),
          });
        }
        setRoute(null);
        if (routingRef.current) { try { mapObj.current?.removeControl(routingRef.current); } catch {} routingRef.current = null; }
        addLog("🏁 Trip complete!", "success");
        sendPush("🏁 Trip Complete!", "Patient safe. Ready for the next mission.");
        fetchBookings();
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
        addLog("⚠️A request is currently in progress", "warn");
        localStorage.setItem("dr_change_req", JSON.stringify(req));
        setPendingReq(req);
        return;
      }
      localStorage.setItem("dr_change_req", JSON.stringify(req));
      setPendingReq(req);
      setChangeReqAmb(null);
      addLog(`📤 Change request submitted successfully — ${changeReqAmb.ambulance_number}`, "success");
    } catch {
      addLog("❌Unable to send request. Please try again.", "error");
    }
  };

  const sc = ambulance ? (SC[ambulance.status] || SC.offline) : SC.offline;
  const routeBorder = route?.status === "pending" ? "#ffaa00" : route?.status === "accepted" ? "#00c853" : "#4fc3f7";
  const batterySource = Number.isFinite(Number(liveBatteryPct))
    ? Number(liveBatteryPct)
    : Number(ambulance?.battery_percentage ?? ambulance?.battery);
  const ambulanceBattery = Number(batterySource);
  const hasBatteryReading = Number.isFinite(ambulanceBattery);
  const normalizedBattery = hasBatteryReading ? Math.max(0, Math.min(100, ambulanceBattery)) : null;
  const isBatteryCritical = hasBatteryReading && normalizedBattery <= LOW_BATTERY_THRESHOLD;
  const batteryLabel = !hasBatteryReading
    ? "Battery not available"
    : isBatteryCritical
      ? `Critical battery (${normalizedBattery}%)`
      : `Battery healthy (${normalizedBattery}%)`;

  const tabs = [
    { k:"map",           l:"🗺 Live Map",      icon:"🗺",  shortLabel:"Live Map"                                              },
    { k:"bookings",      l:"📋 My Bookings",   icon:"📋",  shortLabel:"Bookings",   count: myBookings.filter(b=>b.status==="confirmed" && b.sent_to_driver).length },
    { k:"notifications", l:"🔔 Notifications", icon:"🔔",  shortLabel:"Alerts",     count: unreadCount                        },
    { k:"ambulance",     l:"🚑 My Ambulance",  icon:"🚑",  shortLabel:"Ambulance"                                             },
    { k:"change-request",l:"🔄 Change Request",icon:"🔄",  shortLabel:"Request"                                               },
    { k:"ambulances",    l:"🚒 Ambulances",    icon:"🚒",  shortLabel:"Ambulances"                                            },
    { k:"hospitals",     l:"🏥 Hospitals",     icon:"🏥",  shortLabel:"Hospitals"                                             },
  ];

  const openLiveTrackForBooking = (b) => {
    navigate(`/driver-dashboard?tab=map&track=${b.id}`);
    setTab("map");
    if (!isTracking) startTracking();
    if (b?.pickup_location) {
      drawRoute(b.pickup_location, b.assigned_hospital_name || b.destination || "", b.id);
    }
  };

  const switchTab = (k) => {
    setTab(k);
    if (k === "map" || k === "bookings" || k === "ambulance" || k === "change-request") {
      navigate(`/driver-dashboard?tab=${k}`, { replace: true });
    }
    if (k === "notifications") markAllRead();
  };

  useEffect(() => {
    const qTab = new URLSearchParams(locationRouter.search).get("tab");
    if (qTab && qTab !== tab && tabs.some((t) => t.k === qTab)) {
      setTab(qTab);
      if (qTab === "notifications") markAllRead();
    }
    if (!qTab && locationRouter.pathname.toLowerCase() === "/driver-dashboard" && tab !== "map") {
      setTab("map");
    }
  }, [locationRouter.search, locationRouter.pathname, tab]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".dd-anim", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.05, ease: "power2.out" });
    }, rootRef);
    return () => ctx.revert();
  }, [tab, myBookings.length, notifications.length, allAmbs.length, allHospitals.length]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest(".dd-menu-wrap")) setBookingMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const deleteBookingPermanently = async (bookingId) => {
    if (!bookingId) return;
    setDeletingBookingId(bookingId);
    try {
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMyBookings((prev) => prev.filter((b) => Number(b.id) !== Number(bookingId)));
      setBookingMenuOpenId(null);
      addLog(`🗑 Booking #${bookingId} deleted permanently`, "success");
    } catch {
      addLog(`❌ Booking #${bookingId} delete failed`, "error");
    } finally {
      setDeletingBookingId(null);
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        /* ── Root ── */
        .dd-root {
          --dd-primary: #d6e800;
          --dd-primary-2: #ebf85e;
          --dd-ink: #111111;
          --dd-sub: rgba(17,17,17,0.66);
          --dd-line: rgba(17,17,17,0.16);
          --dd-surface: #fffef6;
          --dd-surface-2: #f7f7ed;
          --sr-surface: #fffef6;
          --sr-surface-2: #f7f7ed;
          --sr-border: rgba(17,17,17,0.16);
          --sr-text: #111111;
          --sr-text-sub: rgba(17,17,17,0.72);
          --sr-text-muted: rgba(17,17,17,0.56);
          --sr-input-bg: #f1f2e8;
          --sr-hover: rgba(214,232,0,0.16);
          --sr-accent-muted: rgba(17,17,17,0.26);
          min-height: 100vh;
          background:
            radial-gradient(920px 430px at 88% 8%, rgba(214,232,0,0.2), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(235,248,94,0.14), transparent 70%),
            #f4f5ee;
          color: var(--dd-ink);
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          /* Desktop: Topnavbar (64px) + Left sidebar (64px) ke liye space */
          padding-top: 64px;
          padding-left: 64px;
        }

        /* ── Header ── */
        .dd-header {
          background: rgba(255,254,246,0.96); border-bottom: 1px solid var(--dd-line);
          padding: 10px 16px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; flex-wrap: wrap;
        }
        .dd-driver-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .dd-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--dd-primary); display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; flex-shrink: 0;
          overflow: hidden; border: 2px solid rgba(17,17,17,0.2);
        }
        .dd-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .dd-name { font-weight: 700; font-size: 13px; color: var(--dd-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dd-meta { font-size: 10px; color: var(--dd-sub); margin-top: 2px; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .dd-meta-pill { background: rgba(214,232,0,0.2); border: 1px solid rgba(17,17,17,0.14); border-radius: 10px; padding: 1px 6px; font-size: 9px; color: #222; }
        .dd-status-pill { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1px solid; white-space: nowrap; }
        .dd-low-battery-banner {
          margin: 10px 16px 0;
          border: 1px solid rgba(229, 9, 20, 0.35);
          background: rgba(229, 9, 20, 0.1);
          color: #a80f1a;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 700;
        }
        .dd-battery-bar-wrap {
          margin-top: 8px;
          width: 100%;
          height: 9px;
          border-radius: 999px;
          border: 1px solid var(--dd-line);
          background: rgba(17,17,17,0.08);
          overflow: hidden;
        }
        .dd-battery-bar-fill {
          height: 100%;
          border-radius: inherit;
          transition: width .2s ease;
        }

        @keyframes dotPulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        .dot-pulse { animation: dotPulse 1.5s infinite; }
        @keyframes routePulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,170,0,0.4)}50%{box-shadow:0 0 0 8px rgba(255,170,0,0)} }
        .route-pulse { animation: routePulse 1.5s infinite; }

        /* ── Desktop Tabs ── */
        .dd-tabs-desktop {
          display: flex; background: rgba(255,254,246,0.98); border-bottom: 1px solid var(--dd-line);
          overflow-x: auto; scrollbar-width: none;
        }
        .dd-tabs-desktop::-webkit-scrollbar { display: none; }
        .dd-tab {
          flex: 1; min-width: fit-content; padding: 11px 10px;
          text-align: center; font-size: 12px; font-weight: 700;
          color: rgba(17,17,17,0.52); cursor: pointer; border-bottom: 2px solid transparent;
          transition: all 0.15s; white-space: nowrap;
          display: flex; align-items: center; justify-content: center; gap: 5px;
        }
        .dd-tab.active { color: var(--dd-ink); border-bottom-color: var(--dd-primary); background: rgba(214,232,0,0.26); }
        .dd-tab:hover:not(.active) { color: #222; background: rgba(214,232,0,0.12); }
        .dd-tab-badge {
          background: var(--dd-primary); color: #111;
          font-size: 9px; font-weight: 800;
          border-radius: 10px; padding: 1px 5px; min-width: 15px; text-align: center;
        }

        /* ── Mobile Bottom Nav ── */
        .dd-bottom-nav {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0;
          background: rgba(255,254,246,0.98); border-top: 1px solid var(--dd-line);
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
        .dd-bnav-item.active { border-top-color: var(--dd-primary); background: rgba(214,232,0,0.24); }
        .dd-bnav-icon { font-size: 18px; line-height: 1; }
        .dd-bnav-label { font-size: 8px; font-weight: 700; color: var(--dd-sub); }
        .dd-bnav-item.active .dd-bnav-label { color: #111; }
        .dd-bnav-badge {
          position: absolute; top: 4px; right: calc(50% - 14px);
          background: var(--dd-primary); color: #111;
          font-size: 8px; font-weight: 800;
          border-radius: 10px; padding: 1px 5px; min-width: 14px; text-align: center;
        }

        /* ── Map Layout ── */
        .dd-map-layout {
          display: flex;
          height: calc(100vh - 64px - 45px - 52px);
        }
        .dd-sidebar {
          width: 270px; min-width: 270px;
          background: rgba(255,254,246,0.98); border-right: 1px solid var(--dd-line);
          padding: 10px; overflow-y: auto;
          display: flex; flex-direction: column; gap: 10px;
          flex-shrink: 0;
        }
        .dd-map-wrap { flex: 1; position: relative; min-width: 0; }

        /* ── Cards ── */
        .dd-card { background: var(--dd-surface); border: 1px solid var(--dd-line); border-radius: 10px; padding: 12px; transition: border-color .2s ease, transform .2s ease; }
        .dd-card:hover { border-color: #111; transform: translateY(-2px); box-shadow: 0 12px 26px rgba(214,232,0,0.28); }
        .dd-card-title { font-weight: 700; font-size: 12px; margin-bottom: 10px; color: #111; text-transform: uppercase; letter-spacing: 0.5px; }
        .dd-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(17,17,17,0.08); }
        .dd-row:last-child { border-bottom: none; }
        .dd-row-key { font-size: 11px; color: var(--dd-sub); }
        .dd-row-val { font-size: 11px; font-weight: 600; color: #111; }
        .dd-log { max-height: 150px; overflow-y: auto; }
        .dd-log::-webkit-scrollbar { width: 3px; }
        .dd-log::-webkit-scrollbar-thumb { background: rgba(17,17,17,0.18); border-radius: 3px; }
        .dd-content { max-width: 900px; margin: 0 auto; padding: 16px 16px 80px; width: 100%; }
        .dd-content-wide {
          max-width: calc(100vw - 64px - 24px);
          width: 100%;
          margin: 0;
          padding-right: 8px;
        }
        .dd-btn { border: none; border-radius: 8px; padding: 9px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; width: 100%; margin-top: 6px; }
        .dd-btn-red   { background: var(--dd-primary); color: #111; border: 1px solid #111; }
        .dd-btn-red:hover { background: var(--dd-primary-2); }
        .dd-btn-green { background: #111; color: #fff; }
        .dd-btn-green:hover { background: #222; }
        .dd-btn-grey  { background: #f2f2e6; color: #666; border: 1px solid var(--dd-line); }

        /* ── Booking Cards ── */
        .dd-booking-card { background: var(--dd-surface); border: 1px solid var(--dd-line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px; transition: border-color .2s ease, transform .2s ease; }
        .dd-booking-card:hover { border-color: #111; transform: translateY(-2px); box-shadow: 0 12px 26px rgba(214,232,0,0.24); }
        .dd-booking-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; }
        .dd-booking-right { display: flex; align-items: center; gap: 6px; margin-left: auto; }
        .dd-booking-amb { font-weight: 800; font-size: 13px; }
        .dd-booking-pill { font-size: 8px; font-weight: 700; padding: 2px 8px; border-radius: 20px; border: 1px solid; text-transform: uppercase; }
        .dd-menu-wrap { position: relative; display: inline-flex; }
        .dd-menu-btn {
          width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(17,17,17,0.2);
          background: #f7f9de; color: #111; display: inline-flex; align-items: center; justify-content: center;
          font-size: 16px; line-height: 1; cursor: pointer; transition: all .15s ease;
        }
        .dd-menu-btn:hover { background: #e8ef9f; border-color: #111; }
        .dd-menu-pop {
          position: absolute; right: 0; top: 34px; min-width: 206px; z-index: 20;
          background: #fffef6; border: 1px solid rgba(17,17,17,0.2); border-radius: 12px;
          box-shadow: 0 18px 34px rgba(17,17,17,0.16); padding: 10px;
        }
        .dd-menu-title { font-size: 11px; font-weight: 800; color: #111; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .dd-menu-sub { font-size: 11px; color: rgba(17,17,17,0.74); margin-bottom: 8px; line-height: 1.45; }
        .dd-menu-danger {
          width: 100%; border: 1px solid #111; background: #d6e800; color: #111;
          border-radius: 8px; padding: 8px 10px; font-size: 11px; font-weight: 800; cursor: pointer;
          transition: all .15s ease;
        }
        .dd-menu-danger:hover { background: #ebf85e; }
        .dd-menu-danger:disabled { opacity: 0.6; cursor: not-allowed; }
        .dd-booking-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .dd-booking-item { display: flex; flex-direction: column; gap: 2px; min-width: 102px; }
        .dd-booking-lbl { font-size: 9px; color: var(--dd-sub); text-transform: uppercase; letter-spacing: 0.5px; }
        .dd-booking-val { font-size: 11px; color: #111; }
        .dd-bookings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(380px, 1fr));
          gap: 12px;
          align-items: start;
        }
        .dd-booking-row.grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .dd-booking-item.cell {
          min-width: 0;
          border: 1px solid rgba(20,20,20,0.14);
          border-radius: 10px;
          padding: 8px 10px;
          background: #fbfce8;
        }
        .dd-report-input,
        .dd-report-textarea {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid rgba(20,20,20,0.28);
          background: rgba(255,255,255,0.96);
          color: #111;
          font-size: 12px;
          font-family: inherit;
          outline: none;
        }
        .dd-report-input::placeholder,
        .dd-report-textarea::placeholder {
          color: rgba(17,17,17,0.56);
        }
        .dd-report-textarea {
          min-height: 52px;
          resize: vertical;
        }
        .dd-report-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin-top: 4px;
        }
        .dd-report-grid .full {
          grid-column: 1 / -1;
        }
        .dd-booking-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 6px;
        }
        .dd-booking-actions-grid .dd-btn { margin-top: 0; }
        .dd-report-note {
          margin-top: 6px;
          font-size: 11px;
          color: rgba(17,17,17,0.72);
          border: 1px solid rgba(17,17,17,0.14);
          background: rgba(214,232,0,0.12);
          border-radius: 10px;
          padding: 8px 10px;
        }

        /* ── Ambulance Tab ── */
        .dd-amb-card { background: var(--dd-surface); border: 1px solid var(--dd-line); border-radius: 14px; padding: 16px; margin-bottom: 14px; transition: border-color .2s ease, transform .2s ease; }
        .dd-amb-card:hover { border-color: #111; transform: translateY(-2px); box-shadow: 0 12px 26px rgba(214,232,0,0.24); }
        .dd-amb-number { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
        .dd-amb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
        .dd-amb-field { background: var(--dd-surface-2); border-radius: 8px; padding: 10px 12px; border: 1px solid var(--dd-line); }
        .dd-amb-flbl { font-size: 9px; color: var(--dd-sub); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .dd-amb-fval { font-size: 12px; font-weight: 600; color: #111; }
        .dd-amb-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
        .dd-amb-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: 1.5px solid var(--dd-line); background: var(--dd-surface-2); cursor: pointer; transition: all 0.15s; }
        .dd-amb-item:hover { background: rgba(214,232,0,0.18); border-color: #111; }
        .dd-amb-item.selected { background: rgba(214,232,0,0.3); border-color: #111; }
        .dd-amb-item-name { font-size: 13px; font-weight: 700; }
        .dd-amb-item-sub  { font-size: 10px; color: var(--dd-sub); margin-top: 1px; }
        .dd-pending-banner { background: rgba(214,232,0,0.18); border: 1px solid rgba(17,17,17,0.16); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #111; margin-bottom: 14px; }

        /* ── Route Card ── */
        .dd-route-card { border-radius: 10px; padding: 12px; }
        .dd-route-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
        .dd-route-info { font-size: 12px; color: #111; line-height: 1.9; margin-bottom: 10px; }
        .dd-route-btns { display: flex; gap: 8px; }
        .dd-route-btns button { flex: 1; }

        /* ── Notifications ── */
        .dn-card { background: var(--dd-surface); border: 1px solid var(--dd-line); border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; transition: background 0.15s; }
        .dn-card.unread { border-color: #111; background: rgba(214,232,0,0.22); }
        .dn-card:hover { background: rgba(214,232,0,0.16); border-color: #111; }
        .dn-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .dn-card-title { font-size: 13px; font-weight: 700; color: #111; }
        .dn-card-time { font-size: 10px; color: var(--dd-sub); white-space: nowrap; }
        .dn-card-msg { font-size: 12px; color: #222; margin-top: 4px; }
        .dn-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: #111; flex-shrink: 0; margin-top: 3px; }

        /* ── Leaflet ── */
        .sr-dark-popup .leaflet-popup-content-wrapper { background: #fffef6!important; border: 1px solid rgba(17,17,17,0.2)!important; border-radius: 10px!important; padding: 0!important; color:#111!important; }
        .sr-dark-popup .leaflet-popup-content { margin: 0!important; }
        .sr-dark-popup .leaflet-popup-tip { background: #fffef6!important; }
        .leaflet-control-zoom a { background: #fffef6!important; color: #111!important; border-color: rgba(17,17,17,0.2)!important; }
        .leaflet-routing-container { display: none!important; }

        /* ══════════════════════════════════════
           MOBILE RESPONSIVE
           FIX 1: padding-top: 64px (Topnavbar ke liye)
           FIX 2: padding-left: 0 (left sidebar mobile pe nahi hota)
           FIX 3: padding-bottom: 60px (apna bottom nav ke liye)
        ══════════════════════════════════════ */
        @media (max-width: 767px) {
          .dd-root {
            padding-top: 64px !important;   /* Topnavbar hamesha dikhta hai */
            padding-left: 0 !important;     /* Left sidebar mobile pe hide hota hai */
            padding-bottom: 60px !important; /* Apna bottom nav ke liye space */
          }

          /* Hide desktop tabs, show bottom nav */
          .dd-tabs-desktop { display: none !important; }
          .dd-bottom-nav   { display: flex !important; }

          /* Map layout stacks vertically */
          .dd-map-layout {
            flex-direction: column;
            /* FIX: 64px topnav + 60px bottom nav = 124px, baki sab map */
            height: calc(100vh - 64px - 60px);
          }
          .dd-sidebar {
            width: 100%; min-width: unset;
            border-right: none; border-bottom: 1px solid var(--dd-line);
            max-height: 240px;
          }
          .dd-map-wrap { flex: 1; min-height: 200px; }

          /* Content pages */
          .dd-content { padding: 12px 12px 80px; }
          .dd-content-wide { max-width: 100%; padding-right: 0; }
          .dd-amb-grid { grid-template-columns: 1fr; }
          .dd-bookings-grid { grid-template-columns: 1fr; }
          .dd-booking-row.grid { grid-template-columns: 1fr 1fr; }
          .dd-report-grid { grid-template-columns: 1fr; }
          .dd-booking-actions-grid { grid-template-columns: 1fr; }

          /* Header tweaks */
          .dd-header { padding: 8px 12px; }
          .dd-name { font-size: 12px; }
          .dd-status-pill { padding: 2px 8px; font-size: 9px; }
          .dd-low-battery-banner { margin: 8px 12px 0; font-size: 11px; padding: 8px 10px; }
        }

        @media (max-width: 480px) {
          .dd-booking-item { min-width: 100px; }
          .dd-amb-number { font-size: 18px; }
        }
      `}</style>

      <div className="dd-root" ref={rootRef}>

        {/* ── Header ── */}
        <div className="dd-header dd-anim">
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
            {hasBatteryReading && (
              <div
                className="dd-status-pill"
                style={{
                  color: isBatteryCritical ? "#b31321" : "#0b7a35",
                  background: isBatteryCritical ? "rgba(229,9,20,0.12)" : "rgba(0,200,83,0.11)",
                  borderColor: isBatteryCritical ? "rgba(179,19,33,0.35)" : "rgba(11,122,53,0.35)",
                }}
              >
                🔋 {normalizedBattery}%
              </div>
            )}
            <div className="dd-status-pill" style={{ color:isTracking?"#00c853":"var(--sr-text-sub, rgba(255,246,242,0.78))", background:isTracking?"rgba(0,200,83,0.1)":"var(--sr-input-bg, rgba(255,255,255,0.07))", borderColor:isTracking?"#00c853":"var(--sr-border, rgba(255,255,255,0.12))" }}>
              {isTracking ? "LIVE" : "OFFLINE"}
            </div>
          </div>
        </div>
        {isBatteryCritical && (
          <div className="dd-low-battery-banner dd-anim">
            ⚠ Battery below {LOW_BATTERY_THRESHOLD}% on your linked ambulance. Connect charger to avoid route disruption.
          </div>
        )}

        {/* ── MAP TAB ── */}
        {tab === "map" && (
          <div className="dd-map-layout">
            <div className="dd-sidebar">
              <motion.div className="dd-card dd-anim" whileHover={{ y: -2 }}>
                <div className="dd-card-title">📡 GPS Control</div>
                {!isTracking
                  ? <button className="dd-btn dd-btn-green" onClick={startTracking}>▶ Enable Live Tracking</button>
                  : <button className="dd-btn dd-btn-red"   onClick={stopTracking}>⏹ Stop Tracking</button>
                }
                {!notifAllowed && (
                  <button className="dd-btn dd-btn-grey" style={{ marginTop:6 }}
                    onClick={() => requestNotifPermission().then(ok => setNotifAllowed(ok))}>
                    🔔Turn on notifications
                  </button>
                )}
              </motion.div>
              <motion.div className="dd-card dd-anim" whileHover={{ y: -2 }}>
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
              </motion.div>
              <motion.div className="dd-card dd-anim" whileHover={{ y: -2 }}>
                <div className="dd-card-title">🔋 Battery Telemetry</div>
                <div className="dd-row">
                  <span className="dd-row-key">Current</span>
                  <span className="dd-row-val">{hasBatteryReading ? `${normalizedBattery}%` : "—"}</span>
                </div>
                <div className="dd-row">
                  <span className="dd-row-key">Health</span>
                  <span className="dd-row-val" style={{ color: isBatteryCritical ? "#b31321" : "#0b7a35" }}>
                    {batteryLabel}
                  </span>
                </div>
                {hasBatteryReading && (
                  <div className="dd-battery-bar-wrap">
                    <div
                      className="dd-battery-bar-fill"
                      style={{
                        width: `${normalizedBattery}%`,
                        background: isBatteryCritical ? "#e50914" : "#00c853",
                      }}
                    />
                  </div>
                )}
              </motion.div>
              {route && (
                <motion.div className={`dd-route-card dd-card dd-anim ${route.status==="pending"?"route-pulse":""}`}
                  style={{ border:`2px solid ${routeBorder}`, background:"var(--sr-surface, #111018)" }}>
                  <div className="dd-route-title" style={{ color:routeBorder }}>
                    {route.status==="pending" ? "🚨 New Route!" : route.status==="accepted" ? "🧭 Route Active" : "🏁 Trip"}
                  </div>
                  <div className="dd-route-info">
                    <div>📍 <b>Pickup:</b> {route.pickup_location}</div>
                    <div>🏥 <b>Hospital:</b> {route.destination}</div>
                    {liveLegStats.toPickupKm != null && (
                      <div>🚑→📍 <b>Driver to Pickup:</b> {liveLegStats.toPickupKm} km · ~{liveLegStats.toPickupMins} min</div>
                    )}
                    {liveLegStats.toHospitalKm != null && (
                      <div>📍→🏥 <b>Pickup to Hospital:</b> {liveLegStats.toHospitalKm} km · ~{liveLegStats.toHospitalMins} min</div>
                    )}
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
                    <button className="dd-btn dd-btn-green" onClick={() => respondRoute("completed")}>🏁 Mark Trip as Completed</button>
                  )}
                </motion.div>
              )}
              <motion.div className="dd-card dd-anim" whileHover={{ y: -2 }}>
                <div className="dd-card-title">📋 Activity</div>
                <div className="dd-log">
                  {log.length === 0
                    ? <div style={{ fontSize:11, color:"var(--sr-text-muted, rgba(255,246,242,0.55))" }}>No activity yet</div>
                    : log.map((l,i) => (
                      <div key={i} style={{ fontSize:11, color:logColor[l.type]||"#888", marginBottom:4 }}>
                        <span style={{ color:"var(--sr-text-muted, rgba(255,246,242,0.55))" }}>{l.time} </span>{l.msg}
                      </div>
                    ))}
                </div>
              </motion.div>
            </div>
            <div ref={mapWrapRef} className="dd-map-wrap" style={{ overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: 10, right: 10, zIndex: 5000, display: "flex", gap: "8px" }}>
                <button 
                  onClick={() => setIs3D(!is3D)} 
                  style={{
                    background: "#111", color: "#fff", 
                    border: "1px solid rgba(255,255,255,0.2)", padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    fontWeight: 700, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                  }}
                >
                  {is3D ? "🌍 Disable 3D View" : "🧊 Enable 3D View"}
                </button>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  style={{
                    background: voiceEnabled ? "#d6e800" : "#fff",
                    color: "#111",
                    border: "1px solid rgba(17,17,17,0.2)", padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    fontWeight: 700, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                  }}
                >
                  {voiceEnabled ? "🔊 Voice Navi: ON" : "🔇 Voice Navi: OFF"}
                </button>
              </div>
              {routeAlert && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 5000,
                    background: "rgba(229,9,20,0.92)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.4)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontWeight: 700,
                    fontSize: 12,
                    maxWidth: 360,
                    boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
                  }}
                >
                  ⚠ {routeAlert}
                </div>
              )}
              <div 
                ref={mapDivRef} 
                style={{ 
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0, 
                  zIndex: 1,
                  transform: "none"
                }} 
              />
              {!isTracking && (
                <div style={{ position:"absolute", inset:0, background:"rgba(12,8,20,0.78)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:2 }}>
                  <div style={{ fontSize:48 }}>🚑</div>
                  <div style={{ color:"var(--sr-text-muted, rgba(255,246,242,0.55))", marginTop:12, fontSize:13, textAlign:"center", padding:"0 16px" }}>Start tracking for map access</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BOOKINGS TAB (Clean cards only) ── */}
        {tab === "bookings" && (
          <div className="dd-content dd-content-wide">
            {myBookings.length === 0
              ? <div className="dd-booking-card dd-anim" style={{ textAlign:"center", fontSize:13 }}>
                  No assigned bookings yet.
                </div>
              : <div className="dd-bookings-grid">
                {myBookings.map(b => {
                const statusLabel = b.driver_task_completed
                  ? "task completed"
                  : b.sent_to_driver
                    ? b.status
                    : "waiting dispatch";
                const bsc = {
                  pending:   { c:"#f7c948", bg:"rgba(247,201,72,0.12)",  bd:"rgba(247,201,72,0.3)"  },
                  confirmed: { c:"#00d4aa", bg:"rgba(0,212,170,0.12)",   bd:"rgba(0,212,170,0.3)"   },
                  completed: { c:"rgba(255,255,255,0.4)", bg:"rgba(255,255,255,0.05)", bd:"rgba(255,255,255,0.1)" },
                  cancelled: { c:"#ff4d5a", bg:"rgba(229,9,20,0.12)",    bd:"rgba(229,9,20,0.3)"    },
                }[b.status] || { c:"#888", bg:"rgba(255,255,255,0.05)", bd:"rgba(255,255,255,0.1)" };
                return (
                  <div key={b.id} className="dd-booking-card dd-anim">
                    <div className="dd-booking-top">
                      <div className="dd-booking-amb">🚑 {b.ambulance_number} · #{b.id}</div>
                      <div className="dd-booking-right">
                        <div className="dd-menu-wrap">
                          <button
                            className="dd-menu-btn"
                            title="More"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBookingMenuOpenId((prev) => (prev === b.id ? null : b.id));
                            }}
                          >
                            ⋮
                          </button>
                          {bookingMenuOpenId === b.id && (
                            <div className="dd-menu-pop" onClick={(e) => e.stopPropagation()}>
                              <div className="dd-menu-title">Booking Actions</div>
                              {b.status === "confirmed" && b.sent_to_driver && !b.driver_task_completed ? (
                                <>
                                  <div className="dd-menu-sub">Remove this booking from driver workflow.</div>
                                  <button
                                    className="dd-menu-danger"
                                    onClick={async () => {
                                      await cancelDriverRequest(b.id);
                                      setBookingMenuOpenId(null);
                                    }}
                                  >
                                    Remove Booking
                                  </button>
                                </>
                              ) : (
                                <>
                                  <div className="dd-menu-sub">Permanent deletion is irreversible. This booking will be lost forever.</div>
                                  <button
                                    className="dd-menu-danger"
                                    onClick={() => deleteBookingPermanently(b.id)}
                                    disabled={deletingBookingId === b.id}
                                  >
                                    {deletingBookingId === b.id ? "Deleting..." : "Permanently Delete"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="dd-booking-pill" style={{ color:bsc.c, background:bsc.bg, borderColor:bsc.bd }}>{statusLabel}</span>
                      </div>
                    </div>
                    <div className="dd-booking-row grid">
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">Patient</div><div className="dd-booking-val">{b.booked_by}</div></div>
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">Email</div><div className="dd-booking-val">{b.booked_by_email || "-"}</div></div>
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">Contact</div><div className="dd-booking-val">{b.patient_contact_number || "-"}</div></div>
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">Created</div><div className="dd-booking-val">{b.created_at || "-"}</div></div>
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">Landmark</div><div className="dd-booking-val">{b.pickup_landmark || "-"}</div></div>
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">City</div><div className="dd-booking-val">{b.pickup_city || "-"}</div></div>
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">District</div><div className="dd-booking-val">{b.pickup_district || "-"}</div></div>
                      <div className="dd-booking-item cell"><div className="dd-booking-lbl">Hospital</div><div className="dd-booking-val">{b.assigned_hospital_name || b.destination || "Admin assigning..."}</div></div>
                      <div className="dd-booking-item cell" style={{ gridColumn: "1 / -1" }}><div className="dd-booking-lbl">Pickup</div><div className="dd-booking-val">📍 {b.pickup_location}</div></div>
                    </div>
                    {b.status === "confirmed" && b.sent_to_driver && !b.driver_task_completed && !b.report_submitted_at && (
                      <div className="dd-booking-item cell" style={{ marginTop: 4 }}>
                        <div className="dd-booking-lbl" style={{ fontWeight: 800, color: "#111" }}>Patient Condition Form</div>
                        <div className="dd-report-grid">
                          <input
                            className="dd-report-input"
                            placeholder="Patient name"
                            value={reportDrafts[b.id]?.patient_name ?? ""}
                            onChange={(e) => updateReportDraft(b.id, "patient_name", e.target.value)}
                          />
                          <input
                            className="dd-report-input"
                            placeholder="Age"
                            value={reportDrafts[b.id]?.patient_age ?? ""}
                            onChange={(e) => updateReportDraft(b.id, "patient_age", e.target.value)}
                          />
                          <input
                            className="dd-report-input"
                            placeholder="Gender"
                            value={reportDrafts[b.id]?.patient_gender ?? ""}
                            onChange={(e) => updateReportDraft(b.id, "patient_gender", e.target.value)}
                          />
                          <input
                            className="dd-report-input"
                            placeholder="Attendant name"
                            value={reportDrafts[b.id]?.attendant_name ?? ""}
                            onChange={(e) => updateReportDraft(b.id, "attendant_name", e.target.value)}
                          />
                          <input
                            className="dd-report-input full"
                            placeholder="Attendant contact"
                            value={reportDrafts[b.id]?.attendant_contact ?? ""}
                            onChange={(e) => updateReportDraft(b.id, "attendant_contact", e.target.value)}
                          />
                          <textarea
                            className="dd-report-textarea full"
                            placeholder="Patient condition"
                            value={reportDrafts[b.id]?.patient_condition ?? ""}
                            onChange={(e) => updateReportDraft(b.id, "patient_condition", e.target.value)}
                          />
                          <textarea
                            className="dd-report-textarea full"
                            placeholder="Vitals summary (BP, pulse, etc.)"
                            value={reportDrafts[b.id]?.vitals_summary ?? ""}
                            onChange={(e) => updateReportDraft(b.id, "vitals_summary", e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                    {b.report_submitted_at && (
                      <div className="dd-report-note">
                        Report sent to admin: {new Date(b.report_submitted_at).toLocaleString("en-IN")}
                      </div>
                    )}
                    {b.status === "confirmed" && b.sent_to_driver && !b.driver_task_completed && (
                      <div className="dd-booking-actions-grid">
                        <button
                          className="dd-btn dd-btn-green"
                          onClick={() => navigate(`/driver/insurance-form?booking=${b.id}`)}
                        >
                          🛡 Medical Insurance Form
                        </button>
                        {b.report_submitted_at ? (
                          <button
                            className="dd-btn"
                            style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", cursor: "default" }}
                            disabled
                          >
                            📝 Report Sended
                          </button>
                        ) : (
                          <button
                            className="dd-btn dd-btn-green"
                            onClick={() => submitPatientReport(b.id)}
                          >
                            📝 Send Report To Admin
                          </button>
                        )}
                        <button className="dd-btn dd-btn-green" onClick={() => openLiveTrackForBooking(b)}>
                          🗺 Live Track
                        </button>
                        <button className="dd-btn dd-btn-red" onClick={() => completeBookingTask(b.id)}>
                          ✅ Task Complete
                        </button>
                        <button className="dd-btn dd-btn-grey" onClick={() => cancelDriverRequest(b.id)}>
                          ✖ Cancel Request
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>}
          </div>
        )}

        {/* ── NOTIFICATIONS TAB ── */}
        {tab === "notifications" && (
          <div className="dd-content">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:16, fontWeight:800 }}>
                🔔 Notifications
                <span style={{ fontSize:12, fontWeight:500, color:"rgba(255,241,247,0.56)", marginLeft:8 }}>({notifications.length})</span>
              </div>
              {notifications.length > 0 && (
                <button onClick={markAllRead}
                  style={{ background:"rgba(255,124,166,0.12)", border:"1px solid rgba(255,124,166,0.28)", color:"rgba(255,241,247,0.9)", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ textAlign:"center", padding:"50px 0", color:"rgba(255,241,247,0.52)", fontSize:14 }}>
                <div style={{ fontSize:44, marginBottom:10 }}>🔔</div>
                No notifications yet
              </div>
            ) : (
              notifications.map((n, i) => (
                <div key={i} className={`dn-card dd-anim ${!n.read ? "unread" : ""}`}
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
            <div className="dd-amb-card dd-anim">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                  <div>
                  <div style={{ fontSize:11, color:"rgba(255,241,247,0.56)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>Meri Ambulance</div>
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
                <div className="dd-amb-field" style={{ gridColumn: "1 / -1" }}>
                  <div className="dd-amb-flbl">Battery</div>
                  <div className="dd-amb-fval" style={{ color: isBatteryCritical ? "#b31321" : "#0b7a35" }}>
                    {hasBatteryReading ? `${normalizedBattery}%` : "Not available"}
                  </div>
                  {hasBatteryReading && (
                    <div className="dd-battery-bar-wrap">
                      <div
                        className="dd-battery-bar-fill"
                        style={{
                          width: `${normalizedBattery}%`,
                          background: isBatteryCritical ? "#e50914" : "#00c853",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CHANGE REQUEST TAB ── */}
        {tab === "change-request" && (
          <div className="dd-content">
            <div className="dd-card dd-anim">
              <div className="dd-card-title">🔄 Ambulance Change Request</div>
              {pendingReq ? (
                <div className="dd-pending-banner" style={{ marginBottom: 0 }}>
                  Request pending. Waiting for admin approval.
                  <br/><span style={{ fontSize:11, color:"#666" }}>Request sent for{pendingReq.newAmbNumber}</span>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:12, color:"rgba(17,17,17,0.65)", marginBottom:10 }}>Select another ambulance and send the request.</div>
                  <div className="dd-amb-list">
                    {allAmbs.filter(a => a.id !== ambId).map(a => {
                      const as = SC[a.status] || SC.offline;
                      return (
                        <div key={a.id} className={`dd-amb-item ${changeReqAmb?.id===a.id?"selected":""}`} onClick={() => setChangeReqAmb(a)}>
                          <div style={{ width:30, height:30, borderRadius:7, background:"rgba(214,232,0,0.28)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🚑</div>
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
                    {changeReqAmb ? `📤 Send Request — ${changeReqAmb.ambulance_number}` : "Please select an ambulance to proceed"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}


        {/* ── AMBULANCES TAB ── */}
        {tab === "ambulances" && (
          <div className="dd-content">
            <div style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>
              🚒 Sabhi Ambulances
              <span style={{ fontSize:12, fontWeight:500, color:"rgba(255,241,247,0.56)", marginLeft:8 }}>({allAmbs.length})</span>
            </div>
            {allAmbs.length === 0
              ? <div style={{ textAlign:"center", padding:"50px 0", color:"rgba(255,241,247,0.52)", fontSize:14 }}>
                  <div style={{ fontSize:44, marginBottom:10 }}>🚒</div>
                  No ambulances available at the moment
                </div>
              : allAmbs.map(a => {
                const as = SC[a.status] || SC.offline;
                const isMe = a.id === ambId;
                return (
                  <div key={a.id} className="dd-booking-card dd-anim" style={{ border: isMe ? "1px solid rgba(229,9,20,0.4)" : "1px solid rgba(255,124,166,0.28)" }}>
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
              <span style={{ fontSize:12, fontWeight:500, color:"rgba(255,241,247,0.56)", marginLeft:8 }}>({allHospitals.length})</span>
            </div>
            {allHospitals.length === 0
              ? <div style={{ textAlign:"center", padding:"50px 0", color:"rgba(255,241,247,0.52)", fontSize:14 }}>
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
                  <div key={h.id} className="dd-booking-card dd-anim">
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

    </>
  );
}


