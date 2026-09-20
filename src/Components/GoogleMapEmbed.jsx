import React, { useMemo } from "react";

const DEFAULT_QUERY = "India";

const isIndiaPoint = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
};

const validPoint = (point) => (isIndiaPoint(point)
  ? { lat: Number(point.lat), lng: Number(point.lng), label: point.label, name: point.name }
  : null);

const pointText = (point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

// One predictable Google embed is shared by every role and every map screen.
const createEmbedUrl = (ambulance, pickup, destination) => {
  const origin = ambulance || pickup;
  if (origin && destination) {
    const waypoint = ambulance && pickup ? `&waypoints=${encodeURIComponent(pointText(pickup))}` : "";
    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(pointText(origin))}&daddr=${encodeURIComponent(pointText(destination))}${waypoint}&dirflg=d&hl=en`;
  }

  const point = destination || pickup || ambulance;
  const query = point ? pointText(point) : DEFAULT_QUERY;
  const zoom = point ? 13 : 5;
  return `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(query)}&z=${zoom}&hl=en`;
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
  const ambulance = useMemo(() => validPoint(ambulanceLoc), [ambulanceLoc?.lat, ambulanceLoc?.lng]);
  const pickup = useMemo(() => validPoint(pickupLoc), [pickupLoc?.lat, pickupLoc?.lng]);
  const destination = useMemo(() => validPoint(destinationLoc), [destinationLoc?.lat, destinationLoc?.lng]);
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
        title="Google Maps route"
        src={embedSrc}
        width="100%"
        height="100%"
        style={{ border: 0, display: "block", borderRadius: 10 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      {pickup && <div title="User location" style={{ position: "absolute", top: 16, left: 16, zIndex: 3, display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 999, background: "rgba(255,255,255,.95)", border: "1px solid #16a34a", color: "#166534", fontSize: 11, fontWeight: 800 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a", boxShadow: "0 0 0 3px #dcfce7" }} /> User location</div>}
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
