import React, { useMemo } from "react";

const DEFAULT_QUERY = "India";

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

const pointText = (point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

// Use the embeddable OpenStreetMap view instead of a Google Maps iframe.
// Google injects an internal GetViewportInfo XHR into embedded maps; that
// request is blocked by the browser's CORS policy and creates noisy console
// errors even when the map itself is visible. OSM's export view is a stable,
// keyless embed and keeps the map available on every portal.
const createEmbedUrl = (ambulance, pickup, destination) => {
  const points = [ambulance, pickup, destination].filter(Boolean);
  if (!points.length) {
    return "https://www.openstreetmap.org/export/embed.html?bbox=68%2C6%2C98%2C38&layer=mapnik";
  }

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPadding = Math.max(0.015, (maxLat - minLat) * 0.2);
  const lngPadding = Math.max(0.015, (maxLng - minLng) * 0.2);
  const bbox = [
    minLng - lngPadding,
    minLat - latPadding,
    maxLng + lngPadding,
    maxLat + latPadding,
  ].map((value) => value.toFixed(6)).join(",");
  const marker = destination || pickup || ambulance;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${marker.lat.toFixed(6)}%2C${marker.lng.toFixed(6)}`;
};

export default function GoogleMapEmbed({
  ambulanceLoc = null,
  pickupLoc = null,
  destinationLoc = null,
  height = "100%",
  className = "",
  loading = false,
  routeData = null,
}) {
  const ambulance = useMemo(() => validPoint(ambulanceLoc), [ambulanceLoc?.lat, ambulanceLoc?.lng, ambulanceLoc?.latitude, ambulanceLoc?.longitude]);
  const pickup = useMemo(() => validPoint(pickupLoc), [pickupLoc?.lat, pickupLoc?.lng, pickupLoc?.latitude, pickupLoc?.longitude]);
  const destination = useMemo(() => validPoint(destinationLoc), [destinationLoc?.lat, destinationLoc?.lng, destinationLoc?.latitude, destinationLoc?.longitude]);
  const embedSrc = useMemo(
    () => createEmbedUrl(ambulance, pickup, destination),
    [ambulance, pickup, destination],
  );

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
        src={embedSrc}
        width="100%"
        height="100%"
        style={{ border: 0, display: "block", borderRadius: 10 }}
        allowFullScreen
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {loading && (
        <div style={{ position: "absolute", top: 10, left: 12, zIndex: 2, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
          Loading Google Maps route...
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
