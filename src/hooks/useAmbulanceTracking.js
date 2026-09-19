import { useState, useEffect, useRef, useCallback } from "react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

/**
 * Haversine distance in meters between two lat/lng points
 */
export function haversineM(p1, p2) {
  if (!p1 || !p2) return 0;
  const lat1 = Number(p1.lat ?? p1[1]);
  const lng1 = Number(p1.lng ?? p1[0]);
  const lat2 = Number(p2.lat ?? p2[1]);
  const lng2 = Number(p2.lng ?? p2[0]);
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return 0;
  }
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Project point P onto segment AB, returning the closest point and distance in meters
 */
function projectPointOnSegment(p, a, b) {
  const pLat = Number(p.lat ?? p[1]);
  const pLng = Number(p.lng ?? p[0]);
  const aLat = Number(a[1]);
  const aLng = Number(a[0]);
  const bLat = Number(b[1]);
  const bLng = Number(b[0]);

  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = haversineM({ lat: pLat, lng: pLng }, { lat: aLat, lng: aLng });
    return { point: [aLng, aLat], distM: d, fraction: 0 };
  }

  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLng = aLng + t * dx;
  const projLat = aLat + t * dy;
  const distM = haversineM({ lat: pLat, lng: pLng }, { lat: projLat, lng: projLng });

  return { point: [projLng, projLat], distM, fraction: t };
}

/**
 * Calculate progress along polyline coordinates [[lng, lat], ...]
 * Returns: { progressM, minDistanceToPolylineM, nearestSegmentIndex, fractionAlongRoute }
 */
export function calculatePolylineProgress(coords, point) {
  if (!coords || coords.length < 2 || !point) {
    return { progressM: 0, totalDistM: 0, minDistanceToPolylineM: 0, nearestSegmentIndex: 0, fractionAlongRoute: 0 };
  }

  let cumulativeDistances = [0];
  let totalDistM = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const segDist = haversineM(
      { lat: coords[i][1], lng: coords[i][0] },
      { lat: coords[i + 1][1], lng: coords[i + 1][0] }
    );
    totalDistM += segDist;
    cumulativeDistances.push(totalDistM);
  }

  let minDistanceM = Infinity;
  let bestSegIndex = 0;
  let bestProgressM = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const segProj = projectPointOnSegment(point, coords[i], coords[i + 1]);
    if (segProj.distM < minDistanceM) {
      minDistanceM = segProj.distM;
      bestSegIndex = i;
      const segLengthM = cumulativeDistances[i + 1] - cumulativeDistances[i];
      bestProgressM = cumulativeDistances[i] + segProj.fraction * segLengthM;
    }
  }

  const fraction = totalDistM > 0 ? Math.min(1, Math.max(0, bestProgressM / totalDistM)) : 0;

  return {
    progressM: bestProgressM,
    totalDistM,
    minDistanceToPolylineM: minDistanceM,
    nearestSegmentIndex: bestSegIndex,
    fractionAlongRoute: fraction,
  };
}

/**
 * useAmbulanceTracking Hook
 * 
 * - Polls ambulance GPS every `pollIntervalMs` (default 4000ms)
 * - Interpolates remaining distance and remaining ETA using polyline progress
 * - NEVER consumes a routing API request per GPS ping
 * - Flags `shouldReroute` when ambulance deviates > 150m or interval elapsed
 */
export default function useAmbulanceTracking({
  ambulanceId = null,
  ambulanceNumber = null,
  routeData = null,
  destinationLoc = null,
  pollIntervalMs = 4000,
  deviationThresholdM = 150,
  onRerouteNeeded = null,
}) {
  const [ambulanceLoc, setAmbulanceLoc] = useState(null);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [battery, setBattery] = useState(null);
  const [driverName, setDriverName] = useState("");
  const [status, setStatus] = useState("offline");

  const [remainingDistanceM, setRemainingDistanceM] = useState(null);
  const [remainingEtaS, setRemainingEtaS] = useState(null);
  const [deviationM, setDeviationM] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);

  const prevLocRef = useRef(null);
  const lastRerouteTimeRef = useRef(Date.now());

  // ── Poll ambulance live location ──────────────────────────────────────────
  useEffect(() => {
    if (!ambulanceId && !ambulanceNumber) return;

    let cancelled = false;

    const fetchAmbulanceLocation = async () => {
      try {
        const res = await fetch(`${BASE}/api/ambulances/`);
        if (!res.ok) return;
        const list = await res.json();
        if (cancelled || !Array.isArray(list)) return;

        const amb =
          list.find((a) => Number(a.id) === Number(ambulanceId)) ||
          list.find(
            (a) =>
              String(a.ambulance_number || "").toLowerCase() ===
              String(ambulanceNumber || "").toLowerCase()
          );

        if (!amb) return;

        const lat = parseFloat(amb.latitude);
        const lng = parseFloat(amb.longitude);

        if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
          // Calculate heading if not provided
          let newHeading = Number(amb.heading) || 0;
          if (prevLocRef.current && (!newHeading || newHeading === 0)) {
            const dLat = lat - prevLocRef.current.lat;
            const dLng = lng - prevLocRef.current.lng;
            if (Math.abs(dLat) > 0.00005 || Math.abs(dLng) > 0.00005) {
              newHeading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
              if (newHeading < 0) newHeading += 360;
            }
          }
          prevLocRef.current = { lat, lng };

          setAmbulanceLoc({ lat, lng, heading: newHeading, speed: amb.speed || 0 });
          setHeading(newHeading);
          setSpeed(amb.speed || 0);
          setBattery(amb.battery_percentage ?? null);
          setDriverName(amb.driver || "");
          setStatus(amb.status || "en_route");
        }
      } catch (err) {
        console.warn("Ambulance tracking poll error:", err);
      }
    };

    fetchAmbulanceLocation();
    const interval = setInterval(fetchAmbulanceLocation, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ambulanceId, ambulanceNumber, pollIntervalMs]);

  useEffect(() => {
    if (!routeData || !routeData.geometry || !ambulanceLoc) {
      if (routeData) {
        setRemainingDistanceM(routeData.distance_m || 0);
        setRemainingEtaS(routeData.duration_s || 0);
      }
      return;
    }

    const coords = routeData.geometry.coordinates; 
    if (!coords || coords.length < 2) return;

    const {
      progressM,
      totalDistM,
      minDistanceToPolylineM,
      fractionAlongRoute,
    } = calculatePolylineProgress(coords, ambulanceLoc);

    setDeviationM(Math.round(minDistanceToPolylineM));

    const offRoute = minDistanceToPolylineM > deviationThresholdM;
    setIsOffRoute(offRoute);

    const totalDurationS = routeData.duration_s || (totalDistM / 8.33); 
    const remainingM = Math.max(0, Math.round(totalDistM - progressM));
    const remainingS = Math.max(0, Math.round((1 - fractionAlongRoute) * totalDurationS));

    setRemainingDistanceM(remainingM);
    setRemainingEtaS(remainingS);

    if (routeData.steps && routeData.steps.length > 0) {
      let cumulativeStepDist = 0;
      let activeIdx = 0;
      for (let i = 0; i < routeData.steps.length; i++) {
        cumulativeStepDist += routeData.steps[i].distance_m || 0;
        if (progressM >= cumulativeStepDist) {
          activeIdx = Math.min(routeData.steps.length - 1, i + 1);
        } else {
          break;
        }
      }
      setCurrentStepIndex(activeIdx);
    }

    const now = Date.now();
    if (offRoute && now - lastRerouteTimeRef.current > 30000) {
      lastRerouteTimeRef.current = now;
      if (onRerouteNeeded) {
        onRerouteNeeded({
          reason: "deviation",
          deviationM: minDistanceToPolylineM,
          currentLoc: ambulanceLoc,
        });
      }
    }
  }, [routeData, ambulanceLoc, deviationThresholdM, onRerouteNeeded]);

  return {
    ambulanceLoc,
    heading,
    speed,
    battery,
    driverName,
    status,
    remainingDistanceM,
    remainingEtaS,
    deviationM,
    isOffRoute,
    currentStepIndex,
  };
}
