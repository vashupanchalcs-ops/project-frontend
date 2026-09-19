import React, { useEffect, useMemo, useRef, useState } from "react";
import { ensureGoogleMaps, hasGoogleMapsAuthFailure } from "../utils/googleMaps";

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const ROUTE_REFRESH_MS = 30_000;

const isIndiaPoint = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
};

const validPoint = (point) => (isIndiaPoint(point)
  ? { lat: Number(point.lat), lng: Number(point.lng) }
  : null);

const routeCoordinates = (routeData) => {
  const coordinates = routeData?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((pair) => Array.isArray(pair) && pair.length >= 2
      ? { lat: Number(pair[1]), lng: Number(pair[0]) }
      : null)
    .filter(isIndiaPoint);
};

const routeKey = (points) => points
  .map((point) => point ? `${point.lat.toFixed(3)},${point.lng.toFixed(3)}` : "-")
  .join("|");

const createFallbackEmbedUrl = (ambulance, pickup, destination) => {
  const fmt = (point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
  const origin = ambulance || pickup;
  if (origin && destination) {
    const waypoint = ambulance && pickup ? `&waypoints=${encodeURIComponent(fmt(pickup))}` : "";
    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(fmt(origin))}&daddr=${encodeURIComponent(fmt(destination))}${waypoint}&dirflg=d&hl=en`;
  }
  const point = destination || pickup || ambulance || DEFAULT_CENTER;
  return `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(fmt(point))}&z=13&hl=en`;
};

const markerIcon = (google, color) => ({
  path: google.maps.SymbolPath.CIRCLE,
  scale: 11,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 3,
});

export default function GoogleMapEmbed({
  ambulanceLoc = null,
  pickupLoc = null,
  destinationLoc = null,
  height = "100%",
  className = "",
  routeData = null,
  followAmbulance = false,
  loading = false,
  showGuidance = false,
  onMapReady = null,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const trafficLayerRef = useRef(null);
  const routeLineRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsRequestRef = useRef({ key: "", at: 0 });
  const markersRef = useRef({ ambulance: null, pickup: null, destination: null });
  const [mapReady, setMapReady] = useState(false);
  const [fallbackEmbed, setFallbackEmbed] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");
  const [directionSteps, setDirectionSteps] = useState([]);

  const ambulance = useMemo(() => validPoint(ambulanceLoc), [ambulanceLoc?.lat, ambulanceLoc?.lng]);
  const pickup = useMemo(() => validPoint(pickupLoc), [pickupLoc?.lat, pickupLoc?.lng]);
  const destination = useMemo(() => validPoint(destinationLoc), [destinationLoc?.lat, destinationLoc?.lng]);
  const points = useMemo(() => [ambulance, pickup, destination].filter(Boolean), [ambulance, pickup, destination]);
  const embedSrc = useMemo(() => createFallbackEmbedUrl(ambulance, pickup, destination), [ambulance, pickup, destination]);

  useEffect(() => {
    let cancelled = false;

    const showFallback = () => {
      setFallbackEmbed(true);
      setFallbackReason("Google Maps authorization failed, so the fallback route is shown.");
      Object.values(markersRef.current).forEach((marker) => marker?.setMap?.(null));
      routeLineRef.current?.setMap?.(null);
      directionsRendererRef.current?.setMap?.(null);
      trafficLayerRef.current?.setMap?.(null);
      mapRef.current = null;
      setMapReady(false);
    };

    const handleAuthFailure = () => {
      if (!cancelled) showFallback();
    };
    window.addEventListener("swiftrescue-google-maps-auth-failure", handleAuthFailure);

    const init = async () => {
      const available = await ensureGoogleMaps();
      if (cancelled || !available || hasGoogleMapsAuthFailure() || !containerRef.current || !window.google?.maps) {
        if (!cancelled) {
          setFallbackEmbed(true);
          setFallbackReason(hasGoogleMapsAuthFailure()
            ? "Google Maps authorization failed, so the fallback route is shown."
            : "Google Maps is unavailable, so the fallback map is shown.");
        }
        return;
      }

      const firstPoint = points[0] || DEFAULT_CENTER;
      const map = new window.google.maps.Map(containerRef.current, {
        center: firstPoint,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: true,
        gestureHandling: "greedy",
      });
      mapRef.current = map;
      trafficLayerRef.current = new window.google.maps.TrafficLayer();
      trafficLayerRef.current.setMap(map);
      setMapReady(true);
      setFallbackEmbed(false);
      setFallbackReason("");
      onMapReady?.(map);
    };

    init();
    return () => {
      cancelled = true;
      window.removeEventListener("swiftrescue-google-maps-auth-failure", handleAuthFailure);
      Object.values(markersRef.current).forEach((marker) => marker?.setMap?.(null));
      routeLineRef.current?.setMap?.(null);
      directionsRendererRef.current?.setMap?.(null);
      trafficLayerRef.current?.setMap?.(null);
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const google = window.google;
    if (!mapReady || !map || !google?.maps) return;

    const markerSpecs = [
      ["ambulance", ambulance, "#f59a23", "A"],
      ["pickup", pickup, "#16803c", "P"],
      ["destination", destination, "#d64545", "H"],
    ];
    markerSpecs.forEach(([key, point, color, label]) => {
      const current = markersRef.current[key];
      if (!point) {
        current?.setMap?.(null);
        markersRef.current[key] = null;
        return;
      }
      if (!current) {
        markersRef.current[key] = new google.maps.Marker({
          map,
          position: point,
          title: key === "ambulance" ? "Ambulance" : key === "pickup" ? "Patient pickup" : "Hospital",
          icon: markerIcon(google, color),
          label: { text: label, color: "#ffffff", fontWeight: "800", fontSize: "11px" },
          zIndex: key === "ambulance" ? 3 : 2,
        });
      } else {
        current.setPosition(point);
        current.setMap(map);
      }
    });

    if (followAmbulance && ambulance) map.panTo(ambulance);
  }, [mapReady, ambulance, pickup, destination, followAmbulance]);

  useEffect(() => {
    const map = mapRef.current;
    const google = window.google;
    if (!mapReady || !map || !google?.maps) return;

    routeLineRef.current?.setMap(null);
    directionsRendererRef.current?.setMap(null);
    routeLineRef.current = null;
    directionsRendererRef.current = null;

    const savedCoordinates = routeCoordinates(routeData);
    if (savedCoordinates.length >= 2) {
      routeLineRef.current = new google.maps.Polyline({
        map,
        path: savedCoordinates,
        geodesic: true,
        strokeColor: "#126f1e",
        strokeOpacity: 0.95,
        strokeWeight: 6,
        zIndex: 2,
      });
      const bounds = new google.maps.LatLngBounds();
      savedCoordinates.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 70);
      setDirectionSteps(showGuidance && Array.isArray(routeData?.steps) ? routeData.steps : []);
      setFallbackEmbed(false);
      setFallbackReason("");
      if (!showGuidance || routeData?.steps?.length) return;
    }

    if (!destination || !google.maps.DirectionsService || !google.maps.DirectionsRenderer) return;
    const origin = ambulance || pickup;
    if (!origin) return;
    const waypoints = ambulance && pickup ? [{ location: pickup, stopover: true }] : [];
    const key = routeKey([origin, pickup, destination]);
    const now = Date.now();
    if (directionsRequestRef.current.key === key && now - directionsRequestRef.current.at < ROUTE_REFRESH_MS) return;
    if (directionsRequestRef.current.at && now - directionsRequestRef.current.at < ROUTE_REFRESH_MS) return;
    directionsRequestRef.current = { key, at: now };

    const service = new google.maps.DirectionsService();
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: { strokeColor: "#126f1e", strokeOpacity: 0.95, strokeWeight: 6 },
    });
    directionsRendererRef.current = renderer;
    service.route({
      origin,
      destination,
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS },
      provideRouteAlternatives: false,
    }, (result, status) => {
      if (status === "OK" && result) {
        renderer.setDirections(result);
        if (showGuidance) {
          const steps = (result.routes?.[0]?.legs || []).flatMap((leg) => leg.steps || []).map((step) => ({
            instruction: String(step.instructions || "Continue on route").replace(/<[^>]*>/g, ""),
            distance: step.distance?.text || "",
            duration: step.duration?.text || "",
          }));
          setDirectionSteps(steps);
        }
        setFallbackEmbed(false);
        setFallbackReason("");
      } else if (["OVER_QUERY_LIMIT", "REQUEST_DENIED", "UNKNOWN_ERROR"].includes(status)) {
        renderer.setMap(null);
        directionsRendererRef.current = null;
        if (showGuidance) setDirectionSteps([]);
        setFallbackEmbed(true);
        setFallbackReason("Google route quota is unavailable; the fallback route is shown.");
      }
    });
  }, [mapReady, ambulance, pickup, destination, routeData, showGuidance]);

  const shouldShowFallback = fallbackEmbed || !mapReady;

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: height || "100%", minHeight: 200, overflow: "hidden", borderRadius: 10, background: "#e5e3df" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%", display: shouldShowFallback ? "none" : "block" }} />
      {shouldShowFallback && (
        <iframe
          title="Google Maps fallback"
          src={embedSrc}
          width="100%"
          height="100%"
          style={{ border: 0, display: "block", borderRadius: 10 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
      {loading && (
        <div style={{ position: "absolute", top: 10, left: 12, zIndex: 10, background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
          Calculating route…
        </div>
      )}
      {fallbackReason && !loading && (
        <div style={{ position: "absolute", bottom: 10, left: 12, right: 12, zIndex: 10, background: "rgba(255,255,255,0.94)", border: "1px solid #f59a23", borderRadius: 10, padding: "7px 10px", fontSize: 11, fontWeight: 700, color: "#7c4a03" }}>
          {fallbackReason}
        </div>
      )}
      {showGuidance && directionSteps.length > 0 && !loading && (
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 11, width: "min(310px, calc(100% - 24px))", maxHeight: 230, overflowY: "auto", background: "rgba(255,255,255,0.96)", border: "1px solid #d9e8dc", borderRadius: 12, boxShadow: "0 8px 20px rgba(0,0,0,0.16)", padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 7, color: "#126f1e" }}>Driver directions</div>
          {directionSteps.slice(0, 8).map((step, index) => (
            <div key={`${index}-${step.instruction}`} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: index ? "1px solid #edf2ee" : "none", fontSize: 11, lineHeight: 1.35 }}>
              <span style={{ minWidth: 18, height: 18, borderRadius: "50%", background: "#126f1e", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>{index + 1}</span>
              <span>{step.instruction}{step.distance ? ` · ${step.distance}` : ""}{step.duration ? ` · ${step.duration}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
