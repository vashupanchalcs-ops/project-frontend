/**
 * routeUtils.js — src/utils/routeUtils.js
 *
 * Helpers for progressive route erasing (slicing traveled path behind ambulance),
 * haversine distance, and navigation maneuvers.
 */

export const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const lat1 = Number(a.lat ?? a[0]);
  const lng1 = Number(a.lng ?? a[1]);
  const lat2 = Number(b.lat ?? b[0]);
  const lng2 = Number(b.lng ?? b[1]);

  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return 0;
  }

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

/**
 * Finds index of closest point in polyline array `[[lat, lng], ...]` to `currentPos`.
 */
export const findClosestPointIndex = (path = [], currentPos) => {
  if (!Array.isArray(path) || path.length === 0 || !currentPos) return 0;
  const cLat = Number(currentPos.lat ?? currentPos[0]);
  const cLng = Number(currentPos.lng ?? currentPos[1]);
  if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) return 0;

  let minDist = Infinity;
  let minIdx = 0;

  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const pLat = Number(pt[0]);
    const pLng = Number(pt[1]);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;

    const dist = haversineKm({ lat: cLat, lng: cLng }, { lat: pLat, lng: pLng });
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }

  return minIdx;
};

/**
 * Progressive Route Erasing:
 * Given a polyline array `[[lat, lng], ...]` and current live position of ambulance,
 * returns only the remaining route ahead `[[cLat, cLng], ...remainingPoints]`.
 * The portion of the route behind the ambulance is erased!
 */
export const sliceRemainingPath = (path = [], currentPos) => {
  if (!Array.isArray(path) || path.length < 2) return path || [];
  if (!currentPos) return path;

  const cLat = Number(currentPos.lat ?? currentPos[0]);
  const cLng = Number(currentPos.lng ?? currentPos[1]);
  if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) return path;

  const closestIdx = findClosestPointIndex(path, { lat: cLat, lng: cLng });

  // Prepend current live location to closest remaining points
  const remaining = path.slice(closestIdx);
  const validPts = remaining.filter(pt => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1])) && Number(pt[0]) >= 6 && Number(pt[0]) <= 38 && Number(pt[1]) >= 68 && Number(pt[1]) <= 98);
  return [[cLat, cLng], ...validPts];
};

/**
 * Computes maneuver direction icon and instruction based on route path
 */
export const getManeuverInfo = (path = [], currentPos) => {
  if (!Array.isArray(path) || path.length < 2 || !currentPos) {
    return { icon: "↱", street: "Continue on Route", distStr: "En Route", thenIcon: "↶" };
  }

  const closestIdx = findClosestPointIndex(path, currentPos);
  const nextPt = path[closestIdx + 1] || path[path.length - 1];

  if (!nextPt) {
    return { icon: "🏁", street: "Arriving at Destination", distStr: "Arriving", thenIcon: "" };
  }

  const cLat = Number(currentPos.lat ?? currentPos[0]);
  const cLng = Number(currentPos.lng ?? currentPos[1]);
  const nLat = Number(nextPt[0]);
  const nLng = Number(nextPt[1]);

  const distKm = haversineKm({ lat: cLat, lng: cLng }, { lat: nLat, lng: nLng });
  const distStr = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;

  // Bearing calculation
  const y = Math.sin((nLng - cLng) * (Math.PI / 180)) * Math.cos(nLat * (Math.PI / 180));
  const x =
    Math.cos(cLat * (Math.PI / 180)) * Math.sin(nLat * (Math.PI / 180)) -
    Math.sin(cLat * (Math.PI / 180)) * Math.cos(nLat * (Math.PI / 180)) * Math.cos((nLng - cLng) * (Math.PI / 180));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  let icon = "⬆";
  let street = "Continue straight";
  if (bearing > 22.5 && bearing <= 112.5) {
    icon = "↱";
    street = "Turn Right onto main road";
  } else if (bearing > 112.5 && bearing <= 157.5) {
    icon = "↳";
    street = "Slight Right turn";
  } else if (bearing > 247.5 && bearing <= 292.5) {
    icon = "↰";
    street = "Turn Left onto main road";
  } else if (bearing > 202.5 && bearing <= 247.5) {
    icon = "↲";
    street = "Slight Left turn";
  } else if (bearing > 157.5 && bearing <= 202.5) {
    icon = "↶";
    street = "Make U-Turn";
  }

  return { icon, street, distStr, thenIcon: "↶" };
};
