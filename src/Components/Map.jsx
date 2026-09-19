import { GoogleMap } from "@react-google-maps/api";
import { useState, useEffect, useRef } from "react";
import { ensureGoogleMaps, hasConfiguredGoogleMapsKey } from "../utils/googleMaps";

const containerStyle = { width: "100%", height: "100%" };
const center = { lat: 28.6139, lng: 77.2090 };

const markerIcons = {
  available: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
  en_route:  "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
  busy:      "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
  offline:   "http://maps.google.com/mapfiles/ms/icons/grey-dot.png",
};

const delhiLocations = [
  { lat: 28.6139, lng: 77.2090 },
  { lat: 28.6328, lng: 77.2197 },
  { lat: 28.5921, lng: 77.2290 },
  { lat: 28.6469, lng: 77.1025 },
  { lat: 28.5355, lng: 77.3910 },
  { lat: 28.7041, lng: 77.1025 },
  { lat: 28.6280, lng: 77.3649 },
];

const Maps = () => {
  const [ambulances, setAmbulances] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [mapRef, setMapRef] = useState(null);
  const [mapsReady, setMapsReady] = useState(Boolean(window.google?.maps));
  const [mapsAvailable, setMapsAvailable] = useState(hasConfiguredGoogleMapsKey());
  
  const activeMarkersRef = useRef([]);
  const infoWindowRef = useRef(null);

  // Fetch Ambulances and Bookings
  useEffect(() => {
    const fetchAll = () => {
      const baseUrl = (
        import.meta.env.VITE_API_BASE_URL || 
        (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend.onrender.com")
      ).replace(/\/+$/, "");

      fetch(`${baseUrl}/api/ambulances/`)
        .then((r) => r.json())
        .then(setAmbulances)
        .catch((err) => console.error("Error fetching ambulances:", err));

      fetch(`${baseUrl}/api/bookings/`)
        .then((r) => r.json())
        .then(setBookings)
        .catch((err) => console.error("Error fetching bookings:", err));
    };

    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Maps API
  useEffect(() => {
    let active = true;
    const initMaps = async () => {
      if (!hasConfiguredGoogleMapsKey()) {
        if (!active) return;
        setMapsAvailable(false);
        setMapsReady(false);
        return;
      }
      const ok = await ensureGoogleMaps(10000);
      if (!active) return;
      setMapsAvailable(true);
      setMapsReady(ok);
    };
    initMaps();
    return () => {
      active = false;
    };
  }, []);

  const onMapLoad = (map) => {
    setMapRef(map);
    infoWindowRef.current = new window.google.maps.InfoWindow();
  };

  // Synchronize Markers whenever map, ambulances, or bookings change
  useEffect(() => {
    if (!mapRef || !window.google?.maps) return;

    // Remove existing markers from the map
    activeMarkersRef.current.forEach((marker) => {
      marker.map = null;
    });
    activeMarkersRef.current = [];

    const bookedIds = new Set(
      bookings
        .filter((b) => b.status === "confirmed" || b.status === "pending")
        .map((b) => b.ambulance_id)
    );

    // Place new markers
    const newMarkers = ambulances.map((a, i) => {
      const pos = {
        lat: parseFloat(a.latitude) || delhiLocations[i % delhiLocations.length].lat,
        lng: parseFloat(a.longitude) || delhiLocations[i % delhiLocations.length].lng,
      };
      
      const isBooked = bookedIds.has(a.id);
      const icon = isBooked
        ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
        : markerIcons[a.status] || markerIcons.offline;

      const pinElement = document.createElement("img");
      pinElement.src = icon;
      pinElement.style.width = "32px";
      pinElement.style.height = "32px";

      let marker;
      if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: pos,
          map: mapRef,
          content: pinElement,
          title: a.ambulance_number,
        });
      } else {
        marker = new window.google.maps.Marker({
          position: pos,
          map: mapRef,
          icon: icon,
          title: a.ambulance_number,
        });
      }

      marker.addListener("click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="background:#1a1a1a;color:#fff;padding:10px 14px;border-radius:10px;min-width:180px;font-family:sans-serif">
              <div style="font-size:14px;font-weight:800;margin-bottom:6px">🚑 ${a.ambulance_number || "N/A"}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:2px">Driver: ${a.driver || "N/A"}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:2px">Contact: ${a.driver_contact || "N/A"}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:8px">Location: ${a.location || "N/A"}</div>
              <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;text-transform:uppercase;background:${isBooked ? "rgba(255, 255, 255, 0.15)" : "rgba(0,212,170,0.15)"};color:${isBooked ? "#ffffff" : "#00d4aa"};border:1px solid ${isBooked ? "#ffffff" : "#00d4aa"}">
                ${isBooked ? "🔴 Booked" : a.status || "Offline"}
              </span>
            </div>
          `);
          infoWindowRef.current.open(mapRef, marker);
        }
      });

      return marker;
    });

    activeMarkersRef.current = newMarkers;

    return () => {
      newMarkers.forEach((m) => {
        m.map = null;
      });
    };
  }, [mapRef, ambulances, bookings]);

  if (!mapsAvailable) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#ffffff", color: "#111", padding: 20, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗺️</div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Google Maps key missing</div>
          <div style={{ fontSize: 13, color: "rgba(17,17,17,0.68)" }}>Set <b>VITE_GOOGLE_MAPS_API_KEY</b> to enable this map.</div>
        </div>
      </div>
    );
  }

  if (!mapsReady) {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "#ffffff", color: "#111", padding: 20, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⌛</div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Loading map</div>
          <div style={{ fontSize: 13, color: "rgba(17,17,17,0.68)" }}>Map services are still initializing.</div>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={12}
      onLoad={onMapLoad}
      options={{
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapId: "DEMO_MAP_ID",
      }}
    />
  );
};

export default Maps;
