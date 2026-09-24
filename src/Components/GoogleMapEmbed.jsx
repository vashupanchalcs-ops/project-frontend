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

// Restore the original Google embed used by the admin and hospital map views.
// This is Google's embeddable directions/search view and does not require a
// Maps JavaScript API key.
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
        title="Google Maps route"
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
