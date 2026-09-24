import React, { useMemo } from "react";

const isIndiaPoint = (point) => {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
};

const validPoint = (point) => (isIndiaPoint(point)
  ? {
      lat: Number(point.lat ?? point.latitude),
      lng: Number(point.lng ?? point.longitude),
      label: point.label,
      name: point.name,
    }
  : null);

// Use the embeddable OpenStreetMap view instead of a Google Maps iframe.
// Google injects an internal GetViewportInfo XHR into embedded maps; that
// request is blocked by the browser's CORS policy and creates noisy console
// errors even when the map itself is visible. OSM's export view is a stable,
// keyless embed and keeps the map available on every portal.
const createEmbedView = (ambulance, pickup, destination, user) => {
  const points = [ambulance, pickup, destination, user].filter(Boolean);
  if (!points.length) {
    return {
      url: "https://www.openstreetmap.org/export/embed.html?bbox=68%2C6%2C98%2C38&layer=mapnik",
      bounds: { minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 },
    };
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPadding = Math.max(0.015, (maxLat - minLat) * 0.2);
  const lngPadding = Math.max(0.015, (maxLng - minLng) * 0.2);
  const bounds = {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
  };
  const bbox = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat]
    .map((value) => value.toFixed(6)).join(",");
  const marker = destination || pickup || ambulance || user;
  return {
    url: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${marker.lat.toFixed(6)}%2C${marker.lng.toFixed(6)}`,
    bounds,
  };
};

export default function GoogleMapEmbed({
  ambulanceLoc = null,
  pickupLoc = null,
  destinationLoc = null,
  userLoc = null,
  height = "100%",
  className = "",
  loading = false,
  routeData = null,
}) {
  const ambulance = useMemo(() => validPoint(ambulanceLoc), [ambulanceLoc?.lat, ambulanceLoc?.lng, ambulanceLoc?.latitude, ambulanceLoc?.longitude]);
  const pickup = useMemo(() => validPoint(pickupLoc), [pickupLoc?.lat, pickupLoc?.lng, pickupLoc?.latitude, pickupLoc?.longitude]);
  const destination = useMemo(() => validPoint(destinationLoc), [destinationLoc?.lat, destinationLoc?.lng, destinationLoc?.latitude, destinationLoc?.longitude]);
  const user = useMemo(() => validPoint(userLoc), [userLoc?.lat, userLoc?.lng, userLoc?.latitude, userLoc?.longitude]);
  const mapView = useMemo(
    () => createEmbedView(ambulance, pickup, destination, user),
    [ambulance, pickup, destination, user],
  );
  const userMarkerPosition = user && mapView.bounds
    ? {
        left: `${Math.max(2, Math.min(98, ((user.lng - mapView.bounds.minLng) / (mapView.bounds.maxLng - mapView.bounds.minLng)) * 100))}%`,
        top: `${Math.max(2, Math.min(98, ((mapView.bounds.maxLat - user.lat) / (mapView.bounds.maxLat - mapView.bounds.minLat)) * 100))}%`,
      }
    : null;

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: height || "100%",
        minHeight: 200,
        overflow: "hidden",
        borderRadius: 10,
        background: "#e5e3df",
      }}
    >
      <iframe
        title="Hospital location map"
        src={mapView.url}
        width="100%"
        height="100%"
        style={{ border: 0, display: "block", borderRadius: 10 }}
        allowFullScreen
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {userMarkerPosition && (
        <div
          role="img"
          aria-label="Your current location"
          title="Your current location"
          style={{
            position: "absolute",
            ...userMarkerPosition,
            zIndex: 3,
            transform: "translate(-50%, -100%)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 7px 4px 5px",
            borderRadius: 999,
            background: "#126f1e",
            color: "#fff",
            boxShadow: "0 3px 12px rgba(18,111,30,.38)",
            fontSize: 11,
            fontWeight: 800,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", border: "3px solid #7ee38b" }} />
          You
        </div>
      )}
      {loading && (
        <div style={{ position: "absolute", top: 10, left: 12, zIndex: 2, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
          Loading map route...
        </div>
      )}
      {routeData?.traffic_delay_s > 0 && (
        <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 2, background: "rgba(255,255,255,0.96)", border: "1px solid #f59a23", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 800 }}>
          🚦 Traffic-aware ETA: +{Math.ceil(routeData.traffic_delay_s / 60)} min
        </div>
      )}
    </div>
  );
}
