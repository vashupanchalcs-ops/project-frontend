import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DELHI,
  makePinIcon,
  fetchRoadRoute,
  LIGHT_TILE,
} from "../hooks/useLeaflet";
import GoogleMapEmbed from "../Components/GoogleMapEmbed";

gsap.registerPlugin(ScrollTrigger);

const statusConfig = {
  available: { label: "AVAILABLE", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
  en_route: { label: "EN ROUTE", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
  busy: { label: "BUSY", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
  offline: { label: "OFFLINE", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
};

const statsConfig = [
  { label: "Total Fleet", key: "total", accent: "#ffffff" },
  { label: "Available", key: "available", accent: "#ffffff" },
  { label: "En Route", key: "en_route", accent: "#ffffff" },
  { label: "Busy", key: "busy", accent: "#ffffff" },
  { label: "Low Battery", key: "low_battery", accent: "#ffffff" },
];

const images = [
  "https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=1800&q=95",
  "https://images.unsplash.com/photo-1615461066159-fea0960485d5?auto=format&fit=crop&w=1800&q=95",
  "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1800&q=95",
  "https://images.unsplash.com/photo-1579684453377-0f7f5dcbe61f?auto=format&fit=crop&w=1800&q=95",
];

const getImage = (idx) => images[idx % images.length];
const imageFallbacks = [
  images[0],
  images[1],
  "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1800&q=95",
];
const fallbackSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f1f7aa"/>
        <stop offset="100%" stop-color="#ffffff"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="500" fill="url(#g)"/>
    <rect x="0" y="390" width="1200" height="110" fill="#111111" opacity="0.08"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" fill="#111111" font-weight="700">
      Aarogya Ambulance
    </text>
  </svg>`
)}`;
const OPENCAGE_API_KEY = (import.meta?.env?.VITE_OPENCAGE_API_KEY || "").trim();
const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const PICKUP_LOCATION_FALLBACKS = [
  { terms: ["shiv vihar"], lat: 28.72587, lng: 77.27944 },
  { terms: ["loni"], lat: 28.7510, lng: 77.2890 },
  { terms: ["bhopura"], lat: 28.7059, lng: 77.3274 },
  { terms: ["greater noida"], lat: 28.4744, lng: 77.5030 },
  { terms: ["noida"], lat: 28.5355, lng: 77.3910 },
  { terms: ["delhi", "new delhi"], lat: 28.6139, lng: 77.2090 },
];

const normalizeAddress = (value = "") =>
  String(value).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const fallbackPickupLocation = (address) => {
  const normalized = normalizeAddress(address);
  return PICKUP_LOCATION_FALLBACKS.find(({ terms }) => terms.some((term) => normalized.includes(term))) || null;
};

const isIndiaLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

const reverseGeocodePickup = async (lat, lng) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=18`;
    const response = await fetch(url, { headers: { "Accept-Language": "en" } });
    const result = response.ok ? await response.json() : null;
    const address = result?.address || {};
    return {
      label: result?.display_name || "Current device location",
      city: address.city || address.town || address.village || address.county || "",
      district: address.state_district || address.county || "",
    };
  } catch {
    return { label: "Current device location", city: "", district: "" };
  }
};

export default function Ambulances() {
  const initialUserBooking = (() => {
    try {
      const role = localStorage.getItem("role");
      return role !== "admin" && role !== "driver";
    } catch {
      return false;
    }
  })();
  const cachedAmbs = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("ambulances_list_cache") || "[]");
    } catch {
      return [];
    }
  })();
  const [ambulances, setAmbulances] = useState(cachedAmbs);
  const [bookings, setBookings] = useState(() => {
    try {
      const b = sessionStorage.getItem("ambulances_bookings_cache") || sessionStorage.getItem("admin_bookings");
      return b ? JSON.parse(b) : [];
    } catch {
      return [];
    }
  });
  const [showModal, setShowModal] = useState(initialUserBooking);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAmb, setSelectedAmb] = useState(null);
  const [form, setForm] = useState({
    pickup_address: "",
    pickup_landmark: "",
    pickup_city: "",
    pickup_district: "",
    patient_contact_number: "",
    booking_for_other: initialUserBooking,
  });
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationPermission, setLocationPermission] = useState(initialUserBooking ? "manual" : "prompt");
  const [locationMode, setLocationMode] = useState(initialUserBooking ? "manual" : "gps");
  const [confirmedPickup, setConfirmedPickup] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [manualSuggestions, setManualSuggestions] = useState([]);
  const [toast, setToast] = useState(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [mapLocation, setMapLocation] = useState(null);
  const [mapLocationStatus, setMapLocationStatus] = useState("idle");
  const [targetHospital, setTargetHospital] = useState(null);
  const [assignmentBusy, setAssignmentBusy] = useState(false);

  const leafletReady = false;
  const mapRef = useRef(null);
  const mapElRef = useRef(null);
  const routeLineRef = useRef(null);
  const userRouteRef = useRef(null);
  const mapRouteRequestRef = useRef(0);
  const layerRef = useRef({ amb: null, pickup: null, hospital: null, user: null });

  const isAdmin = localStorage.getItem("role") === "admin";
  const isDriver = localStorage.getItem("role") === "driver";
  const isUser = !isAdmin && !isDriver;
  const location = useLocation();
  const navigate = useNavigate();
  const assignBookingId = isAdmin ? Number(location.state?.assignBookingId || 0) : 0;
  const reassignBookingId = isAdmin ? Number(location.state?.reassignBookingId || 0) : 0;
  const rootRef = useRef(null);
  const pickupWatchRef = useRef(null);

  const clearPickupWatch = () => {
    if (pickupWatchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(pickupWatchRef.current);
      pickupWatchRef.current = null;
    }
  };

  useEffect(() => () => clearPickupWatch(), []);

  useEffect(() => {
    const query = form.pickup_address.trim();
    const manualEntryRequired = form.booking_for_other || locationMode === "manual" || locationPermission === "denied";
    if (!manualEntryRequired || query.length < 3) {
      setManualSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${query}, India`)}&format=jsonv2&limit=5&countrycodes=in`;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { "Accept-Language": "en" },
        });
        const results = response.ok ? await response.json() : [];
        if (controller.signal.aborted) return;
        setManualSuggestions(
          Array.isArray(results)
            ? results
                .map((result) => ({
                  label: result.display_name,
                  lat: Number(result.lat),
                  lng: Number(result.lon),
                }))
                .filter((result) => Number.isFinite(result.lat) && Number.isFinite(result.lng))
            : []
        );
      } catch (error) {
        if (error?.name !== "AbortError") setManualSuggestions([]);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.booking_for_other, form.pickup_address, locationMode, locationPermission]);

  useEffect(() => {
    fetch(`${BASE}/api/ambulances/`)
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setAmbulances(rows);
        try { sessionStorage.setItem("ambulances_list_cache", JSON.stringify(rows)); } catch {}
      })
      .catch(() => {});

    fetch(`${BASE}/api/bookings/`)
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setBookings(rows);
        try { sessionStorage.setItem("ambulances_bookings_cache", JSON.stringify(rows)); } catch {}
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    if (!selectedAmb && ambulances.length) {
      setSelectedAmb(ambulances[0]);
    }
  }, [isAdmin, selectedAmb, ambulances]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      if (rootRef.current?.querySelector?.(".amb2-scroll")) {
        gsap.set(".amb2-scroll", { y: 0, opacity: 1, clearProps: "all" });
      }
    }, rootRef);
    return () => ctx.revert();
  }, [ambulances.length]);

  const getCount = (key) => {
    if (key === "total") return ambulances.length;
    if (key === "low_battery") return ambulances.filter((a) => typeof a.battery === "number" && a.battery < 20).length;
    return ambulances.filter((a) => a.status === key).length;
  };

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const openBooking = (a, hospital = null, options = {}) => {
    if (isAdmin || isDriver) return;
    setSelectedAmb(a);
    setTargetHospital(hospital || null);
    const startManual = options.startManual === true;
    setForm({
      pickup_address: "",
      pickup_landmark: "",
      pickup_city: "",
      pickup_district: "",
      patient_contact_number: "",
      booking_for_other: startManual,
    });
    setLocationPermission(startManual ? "manual" : "prompt");
    setLocationMode(startManual ? "manual" : "gps");
    setConfirmedPickup(null);
    setLocationMessage(startManual ? "" : "");
    setManualSuggestions([]);
    setShowModal(true);
    // This runs from the user's Book action so the browser can display its
    // native location-permission prompt immediately.
    if (!startManual) requestPickupLocation();
  };

  const requestPickupLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationPermission("denied");
      setLocationMode("manual");
      setLocationMessage("Enter your pickup address.");
      return;
    }

    clearPickupWatch();
    setLocationPermission("requesting");
    setLocationMessage("Requesting location...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        const accuracy = Number(position.coords.accuracy);
        clearPickupWatch();
        if (!isIndiaLatLng(lat, lng)) {
          setLocationPermission("unavailable");
          setLocationMode("manual");
          setLocationMessage("Enter your pickup address.");
          return;
        }
        if (Number.isFinite(accuracy) && accuracy > 2000) {
          setLocationPermission("unavailable");
          setLocationMode("manual");
          setLocationMessage("Your device returned a low-accuracy location. Enter and confirm the pickup address.");
          return;
        }
        // The map and booking always use the browser's exact permissioned pin.
        // Reverse geocoding only provides a readable address for the user.
        const place = await reverseGeocodePickup(lat, lng);
        setConfirmedPickup({
          lat,
          lng,
          accuracy: Number.isFinite(accuracy) ? accuracy : null,
          source: "gps",
          label: place.label,
        });
        setForm((previous) => ({
          ...previous,
          pickup_address: place.label === "Current device location" ? previous.pickup_address : place.label,
          pickup_city: place.city || previous.pickup_city,
          pickup_district: place.district || previous.pickup_district,
        }));
        setLocationPermission("granted");
        setLocationMode("gps");
        setLocationMessage("Location confirmed.");
      },
      (error) => {
        clearPickupWatch();
        setLocationPermission(error?.code === 1 ? "denied" : "unavailable");
        setLocationMode("manual");
        setLocationMessage("Enter your pickup address.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  const confirmManualPickup = async () => {
    const address = form.pickup_address.trim();
    if (!address) {
      showToast("Enter the pickup address before confirming it.", "err");
      return;
    }

    setGeocoding(true);
    setLocationMessage("Confirming address...");
    try {
      const chosenSuggestion = manualSuggestions.find((item) => item.label === address);
      let resolved = chosenSuggestion ? { lat: chosenSuggestion.lat, lng: chosenSuggestion.lng } : fallbackPickupLocation(address);
      if (!resolved && OPENCAGE_API_KEY) {
        const params = new URLSearchParams({
          q: `${address}, India`, key: OPENCAGE_API_KEY, language: "en",
          countrycode: "in", limit: "1", no_annotations: "1",
        });
        const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?${params}`);
        const first = response.ok ? (await response.json())?.results?.[0] : null;
        const lat = Number(first?.geometry?.lat);
        const lng = Number(first?.geometry?.lng);
        if (isIndiaLatLng(lat, lng)) resolved = { lat, lng };
      }
      if (!resolved) {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${address}, India`)}&format=json&limit=1&countrycodes=in`;
        const response = await fetch(url, { headers: { "Accept-Language": "en" } });
        const first = response.ok ? (await response.json())?.[0] : null;
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);
        if (isIndiaLatLng(lat, lng)) resolved = { lat, lng };
      }
      // Keep common service areas usable when a public geocoder is rate-limited
      // or unavailable. The browser GPS action still provides the exact pin.
      if (!resolved) resolved = fallbackPickupLocation(address);
      if (!resolved) throw new Error("Address not found");

      setConfirmedPickup({ ...resolved, source: "manual", label: address });
      setLocationPermission("manual");
      setLocationMode("manual");
      setLocationMessage("Location confirmed.");
    } catch {
      setLocationMessage("Enter a more detailed address.");
      showToast("Unable to confirm this address.", "err");
    } finally {
      setGeocoding(false);
    }
  };

  const openDetails = (a) => {
    setSelectedAmb(a);
    setIsSplitView(true);
  };
  
  const closeDetails = () => {
    setIsSplitView(false);
    // Cleanup map
    if (mapRef.current) {
       mapRef.current.remove();
       mapRef.current = null;
    }
  };

  const requestMapLocation = () => {
    if (!("geolocation" in navigator)) {
      setMapLocationStatus("unavailable");
      return;
    }
    setMapLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude);
        const lng = Number(position.coords.longitude);
        const accuracy = Number(position.coords.accuracy);
        if (!isIndiaLatLng(lat, lng)) {
          setMapLocationStatus("unavailable");
          return;
        }
        if (Number.isFinite(accuracy) && accuracy > 3000) {
          setMapLocationStatus("unavailable");
          return;
        }
        setMapLocation({ lat, lng });
        setMapLocationStatus("granted");
      },
      () => setMapLocationStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
  };

  const embedSrc = useMemo(() => {
    if (!selectedAmb) return "https://maps.google.com/maps?output=embed&q=28.7059,77.3274&z=13";
    
    const alat = Number(selectedAmb.latitude);
    const alng = Number(selectedAmb.longitude);
    const hasAmbCoord = isIndiaLatLng(alat, alng);
    const ambCoord = hasAmbCoord ? `${alat},${alng}` : "";
    const ambLocText = String(selectedAmb.location || "").trim();

    const activeBooking = bookings.find(
      (b) => Number(b.ambulance_id) === Number(selectedAmb.id) && String(b.status).toLowerCase() === "confirmed"
    );

    if (activeBooking) {
      const plat = Number(activeBooking.pickup_latitude);
      const plng = Number(activeBooking.pickup_longitude);
      const hasPickupCoord = isIndiaLatLng(plat, plng);
      const pickupPt = hasPickupCoord ? `${plat},${plng}` : String(activeBooking.pickup_location || "").trim();
      const ambPt = ambCoord || ambLocText || "28.7059,77.3274";

      return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(ambPt)}&daddr=${encodeURIComponent(pickupPt)}&dirflg=d`;
    }

    const qStr = ambCoord || ambLocText || "Delhi, India";
    return `https://maps.google.com/maps?output=embed&q=${encodeURIComponent(qStr)}&z=14&t=m`;
  }, [selectedAmb, bookings]);

  const openMapDirections = () => {
    const lat = Number(selectedAmb?.latitude);
    const lng = Number(selectedAmb?.longitude);
    const ambLocText = String(selectedAmb?.location || "").trim();
    const dest = isIndiaLatLng(lat, lng) ? `${lat},${lng}` : encodeURIComponent(ambLocText || "Delhi");
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!isSplitView || mapLocation || mapLocationStatus !== "idle") return;
    requestMapLocation();
  }, [isSplitView, mapLocation, mapLocationStatus]);

  useEffect(() => {
    if (!isSplitView || !selectedAmb || !leafletReady || !mapElRef.current || mapRef.current || !window.L) return;
    const L = window.L;
    mapRef.current = L.map(mapElRef.current, {
      center: [DELHI.lat, DELHI.lng],
      zoom: 12,
      zoomControl: false,
    });
    L.tileLayer(LIGHT_TILE, { maxZoom: 19 }).addTo(mapRef.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
    
    setTimeout(() => mapRef.current?.invalidateSize(), 150);
  }, [isSplitView, selectedAmb, leafletReady]);

  useEffect(() => {
    if (!isSplitView || !mapRef.current || !selectedAmb || !window.L) return;
    const L = window.L;
    const map = mapRef.current;
    
    // Clear old layers
    Object.values(layerRef.current).forEach(layer => {
       if (layer) map.removeLayer(layer);
    });
    if (routeLineRef.current) map.removeLayer(routeLineRef.current);
    if (userRouteRef.current) map.removeLayer(userRouteRef.current);
    layerRef.current = { amb: null, pickup: null, hospital: null, user: null };
    routeLineRef.current = null;
    userRouteRef.current = null;
    const requestId = ++mapRouteRequestRef.current;

    const alat = Number(selectedAmb.latitude);
    const alng = Number(selectedAmb.longitude);
    const ambPos = Number.isFinite(alat) && Number.isFinite(alng) ? { lat: alat, lng: alng } : null;

    const bounds = L.latLngBounds();
    if (ambPos) {
      layerRef.current.amb = L.marker([ambPos.lat, ambPos.lng], { icon: makePinIcon("#126f1e", "🚑") }).addTo(map);
      bounds.extend([ambPos.lat, ambPos.lng]);
    }

    // Use the device location for route calculations only. Do not render a
    // second user pin/label on top of the map; the route and ambulance marker
    // are sufficient for every role.
    if (mapLocation) bounds.extend([mapLocation.lat, mapLocation.lng]);

    // Attempt to load route if there's an active booking for this ambulance
    const activeBooking = bookings.find(b => b.ambulance_id === selectedAmb.id && String(b.status).toLowerCase() === "confirmed");
    
    if (activeBooking && ambPos) {
      (async () => {
        try {
           const plat = Number(activeBooking.pickup_latitude);
           const plng = Number(activeBooking.pickup_longitude);
           let pickupPos = (Number.isFinite(plat) && Number.isFinite(plng)) ? { lat: plat, lng: plng } : null;
           
           if (pickupPos) {
             layerRef.current.pickup = L.marker([pickupPos.lat, pickupPos.lng], { icon: makePinIcon("#f59a23", "📍") }).addTo(map);
             bounds.extend([pickupPos.lat, pickupPos.lng]);
             
             const pts = await fetchRoadRoute([ambPos, pickupPos], { retries: 2 });
             if (pts?.length > 1) {
               if (requestId !== mapRouteRequestRef.current) return;
               routeLineRef.current = L.polyline(pts, { color: "#f59a23", weight: 5, opacity: 0.96 }).addTo(map);
               bounds.extend(routeLineRef.current.getBounds());
             }
             
             map.fitBounds(bounds, { padding: [30, 30] });
           }
        } catch(e) {}
      })();
    }

    if (mapLocation && ambPos) {
      (async () => {
        try {
          const points = await fetchRoadRoute([mapLocation, ambPos], { retries: 2 });
          if (!points?.length || requestId !== mapRouteRequestRef.current) return;
          userRouteRef.current = L.polyline(points, { color: "#126f1e", weight: 5, opacity: 0.92 }).addTo(map);
          bounds.extend(userRouteRef.current.getBounds());
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        } catch {}
      })();
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } else {
      map.setView([DELHI.lat, DELHI.lng], 12);
    }
    
  }, [isSplitView, selectedAmb, bookings, mapLocation]);

  const handleAmbImageError = (e) => {
    const img = e.currentTarget;
    const tries = Number(img.dataset.fallbackTry || "0");
    if (tries < imageFallbacks.length) {
      img.dataset.fallbackTry = String(tries + 1);
      img.src = imageFallbacks[tries];
      return;
    }
    img.src = fallbackSvg;
    img.style.objectFit = "cover";
  };

  const getAmbBookingStats = (ambId) => {
    const list = bookings.filter((b) => b.ambulance_id === ambId);
    return {
      total: list.length,
      confirmed: list.filter((b) => b.status === "confirmed").length,
      completed: list.filter((b) => b.status === "completed").length,
      pending: list.filter((b) => b.status === "pending").length,
      cancelled: list.filter((b) => b.status === "cancelled").length,
      recent: list.slice(0, 6),
    };
  };

  const adminSelected = isAdmin ? (selectedAmb || ambulances[0] || null) : null;

  const selectedAssignBooking = bookings.find((b) => Number(b.id) === Number(assignBookingId || reassignBookingId));
  const selectedAssignPickup = {
    lat: Number(selectedAssignBooking?.pickup_latitude),
    lng: Number(selectedAssignBooking?.pickup_longitude),
  };

  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getDistanceToPickup = (ambulanceRow) => {
    const plat = Number(selectedAssignPickup.lat);
    const plng = Number(selectedAssignPickup.lng);
    const alat = Number(ambulanceRow?.latitude);
    const alng = Number(ambulanceRow?.longitude);
    if (!Number.isFinite(plat) || !Number.isFinite(plng) || !Number.isFinite(alat) || !Number.isFinite(alng)) {
      return null;
    }
    // Multiply straight-line Haversine by 1.56 to estimate real-world road routing distance
    return haversineKm(plat, plng, alat, alng) * 1.56;
  };

  const sortedAmbulances = [...ambulances];
  if (isAdmin && (assignBookingId > 0 || reassignBookingId > 0)) {
    sortedAmbulances.sort((a, b) => (getDistanceToPickup(a) ?? Infinity) - (getDistanceToPickup(b) ?? Infinity));
  }

  const submitBooking = async () => {
    let landmark = form.pickup_landmark.trim();
    let city = form.pickup_city.trim();
    let district = form.pickup_district.trim();
    const requiresManualAddress =
      form.booking_for_other ||
      locationMode === "manual" ||
      locationPermission === "denied" ||
      locationPermission === "unavailable";

    if (!form.patient_contact_number.trim()) {
      showToast("Contact number is required.", "err");
      return;
    }

    if (requiresManualAddress && !form.pickup_address.trim()) {
      showToast("A pickup address is required for another person or a manual booking.", "err");
      return;
    }

    if (!confirmedPickup) {
      showToast("Confirm the pickup location before submitting.", "err");
      return;
    }
    setLoading(true);
    try {
      const user = localStorage.getItem("name") || "Unknown";
      const email = localStorage.getItem("user") || "";
      // The confirmed value is immutable for this booking flow. Never replace it
      // with a later GPS reading or a second geocoding result.
      const pickupCoords = { lat: confirmedPickup.lat, lng: confirmedPickup.lng };
      const pickupLocation = confirmedPickup.source === "manual"
        ? form.pickup_address.trim()
        : confirmedPickup.label || "Current device location";

      const res = await fetch(`${BASE}/api/bookings/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambulance_id: selectedAmb?.id || 0,
          ambulance_number: selectedAmb?.ambulance_number || "",
          driver: selectedAmb?.driver || "",
          driver_contact: selectedAmb?.driver_contact || "",
          booked_by: user,
          booked_by_email: email,
          pickup_location: pickupLocation,
          pickup_latitude: pickupCoords.lat,
          pickup_longitude: pickupCoords.lng,
          pickup_landmark: landmark,
          pickup_city: city,
          pickup_district: district,
          patient_contact_number: form.patient_contact_number.trim(),
          status: "pending",
          destination: targetHospital?.name || "",
          user_selected_hospital_id: targetHospital?.id || null,
          assigned_hospital_id: targetHospital?.id || null,
          assigned_hospital_name: targetHospital?.name || "",
          is_user_selected_hospital: !!targetHospital,
        }),
      });
      if (res.ok) {
        const created = await res.json().catch(() => null);
        showToast(
          targetHospital
            ? `Request submitted for ${targetHospital.name}. Live tracking enabled.`
            : "Request submitted successfully",
          "ok"
        );
        setShowModal(false);
        const bookedHospitalName = targetHospital?.name;
        setTargetHospital(null);

        // Instantly prepend new booking to my_bookings_cache so MyBookings shows it without delay
        if (created?.id) {
          try {
            const existing = JSON.parse(sessionStorage.getItem("my_bookings_cache") || "[]");
            const newBooking = {
              ...created,
              id: created.id,
              status: created.status || "pending",
              booked_by: localStorage.getItem("name") || "",
              booked_by_email: localStorage.getItem("user") || "",
            };
            const updated = [newBooking, ...existing.filter(b => b.id !== created.id)];
            sessionStorage.setItem("my_bookings_cache", JSON.stringify(updated));
          } catch {}
        }

        window.dispatchEvent(new Event("new-booking"));
        navigate("/MyBookings", {
          state: {
            flashMsg: bookedHospitalName
              ? `Emergency booking for ${bookedHospitalName} is active. Live tracking is available.`
              : `Emergency booking #${created?.id || ""} is submitted. Live tracking is available.`,
            bookingId: created?.id,
          },
        });

      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Booking failed. Try again.", "err");
      }
    } catch {
      showToast("Server error. Try again.", "err");
    }
    setGeocoding(false);
    setLoading(false);
  };

  const assignAmbulanceToBooking = async (amb) => {
    const bookingId = Number(assignBookingId || reassignBookingId || 0);
    if (!bookingId || !isAdmin) return;
    if (assignmentBusy) return;
    if (amb.status !== "available") {
      showToast("Please select an available ambulance", "err");
      return;
    }
    setAssignmentBusy(true);
    try {
      const payload = reassignBookingId
        ? { reassign_ambulance_id: amb.id, notify_user_reassigned: true }
        : { assign_ambulance_id: amb.id };
      const response = await fetch(`${BASE}/api/bookings/${bookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Ambulance assignment failed.");

      setAmbulances((prev) => prev.map((a) => (a.id === amb.id ? { ...a, status: "en_route" } : a)));
      try {
        const cached = JSON.parse(sessionStorage.getItem("admin_requests_cache") || "[]");
        sessionStorage.setItem("admin_requests_cache", JSON.stringify(
          cached.map((row) => Number(row.id) === bookingId ? { ...row, ...data } : row)
        ));
      } catch {}

      navigate("/Requests", {
        state: { flashMsg: `Booking #${bookingId} assigned to ${amb.ambulance_number}` },
      });
    } catch (err) {
      console.warn("Ambulance assignment error:", err);
      showToast(err.message || "Ambulance assignment failed. Please try again.", "err");
    } finally {
      setAssignmentBusy(false);
    }
  };

  useEffect(() => {
    if (!isUser || new URLSearchParams(location.search).get("book") !== "1") return;
    openBooking(null, location.state?.preselectedHospital || null, { startManual: true });
    navigate("/Ambulances", { replace: true, state: {} });
    // The booking query is consumed once so the card remains open on refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUser, location.search, location.state, navigate]);

  return (
    <>
      <style>{`
        .amb2-root {
          min-height: 100vh;
          padding-top: 64px;
          padding-left: 64px;
          background:
            radial-gradient(860px 420px at 85% 8%, rgba(255, 255, 255, 0.15), transparent 72%),
            radial-gradient(840px 380px at 12% -4%, rgba(255, 255, 255, 0.15), transparent 70%),
            var(--sr-bg, #f7f7f2);
          color: var(--sr-page-text, #111111);
          position: relative;
          overflow: hidden;
        }
        .amb2-root.amb2-booking-open {
          min-height: 64px;
          height: 64px;
          overflow: visible;
          background: #ffffff;
        }
        .amb2-root.amb2-booking-open .amb2-wrap {
          height: 0;
          padding: 0;
          overflow: visible;
        }
        .amb2-root::before,
        .amb2-root::after {
          content: "";
          position: absolute;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          filter: blur(30px);
          pointer-events: none;
          z-index: 0;
          animation: amb2-float 11s ease-in-out infinite;
        }
        .amb2-root::before {
          top: -180px;
          right: -120px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.15) 70%);
        }
        .amb2-root::after {
          left: -160px;
          bottom: -220px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.15) 70%);
          animation-delay: -5.5s;
        }
        @keyframes amb2-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -16px, 0) scale(1.06); }
        }
        .amb2-wrap {
          width: 100%;
          padding: clamp(16px, 2.2vw, 30px);
          position: relative;
          z-index: 1;
        }
        .amb2-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 100px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #111111;
          background: rgba(255, 255, 255, 0.15);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .amb2-head h1 {
          margin: 0;
          font-size: clamp(32px, 4vw, 54px);
          letter-spacing: -1px;
          color: #111111;
          line-height: 0.98;
        }
        .amb2-head p {
          margin: 10px 0 0;
          color: rgba(17,17,17,0.76);
          font-size: 16px;
        }

        .amb2-stats {
          margin-top: 22px;
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }
        .amb2-stat {
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          border-top: 3.5px solid #ffffff;
          background: #ffffff;
          padding: 14px 16px;
          position: relative;
          transition: none;
        }
        .amb2-stat::before {
          content: none;
        }
        .amb2-stat:hover {
          background-color: #ffffff !important;
          border-color: #e0e0e0 !important;
          border-top-color: #ffffff !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .amb2-stat.low-battery-stat:hover {
          background-color: #ffffff !important;
          border-color: #e0e0e0 !important;
          border-top-color: #ffffff !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .amb2-stat .lbl {
          font-size: 11px;
          font-weight: 700;
          color: rgba(17,17,17,0.62);
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }
        .amb2-stat .val {
          margin-top: 8px;
          font-size: clamp(30px, 3vw, 44px);
          line-height: 1;
          font-weight: 900;
          color: #111111;
        }
        .amb2-stat.low-battery-stat .val {
          color: #ffffff;
        }

        .amb2-sec {
          margin-top: 30px;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.4px;
          color: #111111;
        }

        .amb2-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px;
        }
        .amb2-root.admin-cut .amb2-grid {
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px;
        }
        .amb-admin-right .mini-list {
          display: grid;
          gap: 8px;
          max-height: 240px;
          overflow-y: auto;
        }
        .amb-admin-right .mini-row {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 8px;
          background: rgba(255,255,255,0.05);
        }
        .amb-admin-right .mini-row .top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-weight: 800;
          font-size: 12px;
        }
        .amb-admin-right .mini-row .sub {
          margin-top: 4px;
          font-size: 11px;
          color: rgba(240,244,255,0.7);
        }
        @media (max-width: 1100px) {
          .amb-admin-shell {
            grid-template-columns: 1fr;
          }
          .amb-admin-right {
            position: static;
          }
        }

        .amb2-card {
          border: 1px solid rgba(20,20,20,0.16);
          border-radius: 16px;
          overflow: hidden;
          background: linear-gradient(170deg, rgba(255,255,255,0.98), rgba(246,246,236,0.98));
          box-shadow: 0 16px 34px rgba(0,0,0,0.18);
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .amb2-card:hover {
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.15), rgba(255,255,255,0.96));
          border-color: #111111;
          box-shadow: 0 18px 34px rgba(255, 255, 255, 0.15), 0 0 0 1px #111111 inset;
          transform: translateY(-4px);
        }
        .amb2-card:hover .amb2-ins,
        .amb2-card:hover .amb2-btn {
          border-color: rgba(255, 255, 255, 0.15);
        }
        .amb2-top {
          position: relative;
          height: 124px;
          overflow: hidden;
          background: #09070f;
        }
        .amb2-top::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.08) 100%);
        }
        .amb2-top img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: none;
          image-rendering: auto;
        }
        .amb2-speed {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
          background: rgba(255, 255, 255, 0.15);
          color: #111111;
          border: 1px solid #111111;
          border-radius: 100px;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
        }
        .amb2-status {
          position: absolute;
          right: 10px;
          bottom: 10px;
          z-index: 2;
          border-radius: 100px;
          border: 1px solid;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.4px;
        }

        .amb2-body {
          padding: 12px;
        }
        .amb2-meta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          align-items: center;
        }
        .amb2-pill {
          padding: 3px 8px;
          border-radius: 100px;
          border: 1px solid rgba(20,20,20,0.14);
          background: rgba(255, 255, 255, 0.15);
          color: rgba(17,17,17,0.9);
          font-size: 11px;
          font-weight: 700;
        }
        .amb2-title {
          margin-top: 8px;
          font-size: clamp(18px, 1.8vw, 24px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.3px;
          color: #111111;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .amb2-sub {
          margin-top: 6px;
          color: rgba(17,17,17,0.84);
          font-size: 13px;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .amb2-desc {
          margin-top: 7px;
          color: rgba(17,17,17,0.72);
          font-size: 12px;
          line-height: 1.45;
          min-height: 34px;
        }

        .amb2-insights {
          margin-top: 9px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }
        .amb2-ins {
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #ffffff;
          padding: 7px 6px;
        }
        .amb2-ins.speed { border-color: rgba(255, 255, 255, 0.15); background: #ffffff; }
        .amb2-ins.status { border-color: rgba(255, 255, 255, 0.15); background: #ffffff; }
        .amb2-ins.contact { border-color: rgba(255, 255, 255, 0.15); background: #ffffff; }
        .amb2-ins b {
          display: block;
          color: #111111;
          font-size: 12px;
          line-height: 1.15;
        }
        .amb2-ins span {
          display: block;
          margin-top: 2px;
          color: rgba(17,17,17,0.7);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.35px;
        }

        .amb2-actions {
          margin-top: 9px;
          display: grid;
          grid-template-columns: 1fr 36px;
          gap: 6px;
        }
        .amb2-btn {
          border-radius: 10px;
          border: 1px solid rgba(20,20,20,0.22);
          background: #f0f0ea;
          color: #111111;
          font-size: 12px;
          font-weight: 900;
          font-family: inherit;
          cursor: pointer;
          height: 34px;
          opacity: 1;
          filter: none;
          text-shadow: none;
        }
        .amb2-btn.main {
          background: #ffffff;
          border-color: #ffffff;
          box-shadow: none;
          color: #111111;
        }
        .amb2-btn.main.alt {
          background: #ffffff;
          color: #111111;
          border-color: #ffffff;
          box-shadow: none;
        }
        .amb2-btn.icon {
          font-size: 13px;
        }
        .amb2-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .amb2-ins:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
        }
        .amb2-btn:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
        }

        .amb-toast {
          position: fixed;
          top: 72px;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 10px;
          padding: 11px 16px;
          font-size: 13px;
          font-weight: 700;
          z-index: 9999;
          color: #fff;
        }
        .amb-toast.ok {
          background: #0f8f6f;
        }
        .amb-toast.err {
          background: #c32943;
        }

        .amb-modal-ov {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(6, 4, 10, 0.82);
          display: grid;
          place-items: center;
          padding: 16px;
        }
        .amb-modal {
          width: min(460px, 100%);
          background: #171420;
          color: #fff6f2;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.16);
          padding: 18px;
          display: grid;
          gap: 12px;
          box-shadow: 0 22px 40px rgba(0,0,0,0.52);
        }
        .amb-modal h3 {
          margin: 0;
          font-size: 20px;
        }
        .amb-modal p {
          margin: 0;
          color: rgba(255,246,242,0.68);
          font-size: 13px;
        }
        .amb-field label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: rgba(255,246,242,0.66);
        }
        .amb-field input {
          width: 100%;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          background: rgba(255,255,255,0.06);
          color: #fff;
        }
        .amb-field input::placeholder {
          color: rgba(255,246,242,0.52);
        }
        .amb-modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 4px;
        }

        .amb-admin-card {
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.15);
          padding: 10px;
        }
        .amb-admin-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }
        .amb-admin-stat {
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          background: #f8f9e5;
          color: #111;
          padding: 8px;
        }
        .amb-admin-stat .k {
          font-size: 10px;
          font-weight: 700;
          color: rgba(17,17,17,0.62);
          text-transform: uppercase;
          letter-spacing: .6px;
        }
        .amb-admin-stat .v {
          margin-top: 4px;
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
        }
        .amb-admin-list {
          margin-top: 10px;
          max-height: 210px;
          overflow-y: auto;
          display: grid;
          gap: 7px;
        }
        .amb-admin-row {
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 9px;
          background: #fefef4;
          padding: 8px 9px;
          color: #111;
        }
        .amb-admin-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .amb-admin-pill {
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #ffffff;
          color: #111;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .amb-admin-sub {
          font-size: 12px;
          color: rgba(17,17,17,0.78);
          margin-top: 4px;
        }

        /* Battery indicator styles */
        .amb2-battery-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 100px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .amb2-battery-badge.critical {
          background: rgba(255,77,77,0.15);
          border: 1px solid rgba(255,77,77,0.72);
          color: #cc0000;
          animation: batt-blink 1.1s ease-in-out infinite;
        }
        .amb2-battery-badge.healthy {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.6);
          color: #15803d;
        }
        @keyframes batt-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.38; }
        }
        .amb2-battery-bar-wrap {
          width: 100%;
          height: 6px;
          border-radius: 99px;
          background: rgba(17,17,17,0.1);
          overflow: hidden;
          margin-top: 4px;
        }
        .amb2-battery-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.4s ease;
        }

        /* Battery diagnostic card in details modal */
        .amb-battery-diag {
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.15);
          padding: 12px 14px;
          margin-top: 6px;
        }
        .amb-battery-diag.critical {
          border-color: rgba(255,77,77,0.6);
          background: rgba(255,77,77,0.06);
        }
        .amb-battery-diag-title {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          color: rgba(17,17,17,0.58);
          margin-bottom: 8px;
        }
        .amb-battery-diag-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .amb-battery-diag-level {
          font-size: 32px;
          font-weight: 900;
          line-height: 1;
        }
        .amb-battery-diag-level.critical { color: #ffffff; }
        .amb-battery-diag-level.healthy { color: #16a34a; }
        .amb-battery-diag-bar-wrap {
          flex: 1;
          height: 10px;
          border-radius: 99px;
          background: rgba(17,17,17,0.1);
          overflow: hidden;
        }
        .amb-battery-diag-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.4s ease;
        }
        .amb-battery-diag-status {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          padding: 3px 9px;
          border-radius: 100px;
          border: 1px solid;
        }
        .amb-battery-diag-status.critical {
          background: rgba(255,77,77,0.14);
          border-color: rgba(255,77,77,0.7);
          color: #cc0000;
          animation: batt-blink 1.1s ease-in-out infinite;
        }
        .amb-battery-diag-status.healthy {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.6);
          color: #15803d;
        }
        .amb-battery-diag-note {
          font-size: 11px;
          color: rgba(17,17,17,0.62);
          margin-top: 7px;
        }

        @media (max-width: 1100px) {
          .amb2-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .amb2-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .amb-admin-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .amb2-root.admin-cut .amb2-card {
            grid-template-columns: 1fr;
          }
          .amb2-root.admin-cut .amb2-top {
            min-height: 156px;
            border-right: 0;
            border-bottom: 1px solid rgba(17,17,17,0.08);
          }
        }
        @media (max-width: 767px) {
          .amb2-root {
            padding-left: 0;
            padding-bottom: 74px;
          }
          .amb2-wrap {
            padding: 14px 12px 84px;
          }
        }

        /* Split View Styles */
        .amb-split-layout {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 16px;
          height: fit-content;
          align-items: start;
        }
        .amb-split-left {
          display: flex;
          flex-direction: column;
          gap: 10px;
          height: calc(100vh - 120px);
          overflow-y: auto;
          padding-right: 4px;
        }
        .amb-split-left::-webkit-scrollbar { width: 4px; }
        .amb-split-left::-webkit-scrollbar-thumb { background: rgba(17,17,17,0.2); border-radius: 4px; }
        .amb-split-right {
          background: #fffef6;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 16px 34px rgba(0,0,0,0.1);
          height: calc(100vh - 120px);
          overflow-y: auto;
        }
        .amb-side-card {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(17,17,17,0.1);
          background: rgba(255,255,255,0.95);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .amb-side-card.active {
          border-color: #ffffff;
          background: #fdfdf5;
          box-shadow: inset 4px 0 0 #ffffff;
        }
        .amb-side-card:hover {
          background: #fafaf5;
        }
        .amb-map-box {
          height: 380px;
          border-radius: 12px;
          margin-top: 18px;
          border: 1px solid rgba(17,17,17,0.1);
          overflow: hidden;
          background: #f4f4ef;
          position: relative;
          z-index: 1;
        }
        .amb-close-split {
           display: inline-flex;
           align-items: center;
           gap: 6px;
           background: #111;
           color: #fff;
           border: none;
           padding: 8px 14px;
           border-radius: 8px;
           font-size: 11px;
           font-weight: 700;
           cursor: pointer;
           margin-bottom: 24px;
        }
        @media (max-width: 900px) {
           .amb-split-layout { grid-template-columns: 1fr; }
           .amb-split-left { height: 260px; }
           .amb-split-right { height: auto; }
        }

        /* Compact fleet cards: image-led, data-rich, and red-accented. */
        html body #root .amb2-grid.amb2-grid {
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 18px;
        }
        html body #root .amb2-card.amb2-card {
          background: #ffffff !important;
          border: 1px solid #ead6d7 !important;
          border-radius: 18px !important;
          box-shadow: 0 10px 24px rgba(29, 16, 17, .10) !important;
        }
        html body #root .amb2-card.amb2-card:hover {
          background: #ffffff !important;
          border-color: #e50914 !important;
          box-shadow: 0 14px 30px rgba(229, 9, 20, .18) !important;
          transform: translateY(-4px);
        }
        html body #root .amb2-top { height: 154px; background: #b20710 !important; }
        html body #root .amb2-top::after { background: linear-gradient(135deg, rgba(229, 9, 20, .68), rgba(0, 0, 0, .08)) !important; }
        html body #root .amb2-top img { filter: saturate(.9) contrast(1.04) !important; }
        html body #root .amb2-speed,
        html body #root .amb2-status {
          background: #ffffff !important;
          border-color: #ffffff !important;
          color: #b20710 !important;
          border-radius: 999px !important;
        }
        html body #root .amb2-body { padding: 15px !important; }
        html body #root .amb2-pill { background: #fff6f6 !important; border-color: #f2c7ca !important; color: #a70a12 !important; }
        html body #root .amb2-title { color: #151515 !important; font-size: 21px !important; font-weight: 700 !important; }
        html body #root :is(.amb2-sub, .amb2-desc) { color: #5d5d5d !important; }
        html body #root .amb2-insights { gap: 5px; }
        html body #root .amb2-ins {
          background: #fff8f8 !important;
          border-color: #f2dbdc !important;
          border-radius: 8px !important;
        }
        html body #root .amb2-ins b { color: #202124 !important; }
        html body #root .amb2-ins span { color: #8b5a5d !important; }
        html body #root .amb2-btn,
        html body #root .amb2-btn.main,
        html body #root .amb2-btn.main.alt {
          background: #e50914 !important;
          border-color: #e50914 !important;
          border-radius: 8px !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root .amb2-btn.icon { background: #fff6f6 !important; border-color: #e50914 !important; color: #b20710 !important; }
        html body #root .amb2-btn:hover:not(:disabled) { background: #b20710 !important; border-color: #b20710 !important; }
        html body #root .amb2-btn.icon:hover:not(:disabled) { color: #ffffff !important; }

        /* Keep the fleet view inside the white and #f0f0f0 application system. */
        html body #root .amb2-card.amb2-card {
          background: #ffffff !important;
          border-color: #dedede !important;
          box-shadow: none !important;
        }
        html body #root .amb2-card.amb2-card:hover {
          background: #ffffff !important;
          border-color: #bdbdbd !important;
          box-shadow: none !important;
        }
        html body #root .amb2-top { background: #f0f0f0 !important; }
        html body #root .amb2-top::after { background: linear-gradient(135deg, rgba(0, 0, 0, .10), transparent 68%) !important; }
        html body #root :is(.amb2-speed, .amb2-status) { background: #ffffff !important; border-color: #dedede !important; color: #111111 !important; }
        html body #root :is(.amb2-pill, .amb2-ins) { background: #f0f0f0 !important; border-color: #dedede !important; color: #111111 !important; }
        html body #root .amb2-ins :is(b, span) { color: #111111 !important; }
        html body #root :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt) {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt):hover:not(:disabled) { background: #2d2d2d !important; border-color: #2d2d2d !important; }

        /* User booking opens as a wide, compact card while keeping the existing location workflow. */
        html body #root .amb-modal-ov {
          background: #ffffff !important;
          align-items: start !important;
          overflow-y: auto !important;
          padding: 82px 32px 24px !important;
        }
        html body #root .amb-user-booking-overlay {
          position: relative !important;
          inset: auto !important;
          z-index: 1 !important;
          display: flex !important;
          align-items: flex-start !important;
          justify-content: center !important;
          min-height: calc(100vh - 64px) !important;
          margin-left: 64px !important;
          box-sizing: border-box !important;
          padding: 18px 32px 56px !important;
        }
        html body #root .amb-user-booking-overlay .amb-modal {
          width: min(820px, 100%) !important;
          max-height: none !important;
          overflow: visible !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          padding: 20px 22px 16px !important;
          border: 1px solid rgba(18, 111, 30, .20) !important;
          border-radius: 16px !important;
          background: #ffffff !important;
          color: #111111 !important;
          box-shadow: 0 8px 24px rgba(18, 111, 30, .06) !important;
        }
        html body #root .amb-user-booking-overlay .amb-modal h3 {
          font-size: 22px !important;
          color: #111111 !important;
        }
        html body #root .amb-user-booking-overlay .amb-modal p {
          color: rgba(17, 17, 17, .62) !important;
        }
        html body #root .amb-user-booking-overlay .amb-location-action {
          display: none !important;
        }
        html body #root .amb-user-booking-overlay .amb-location-choice {
          margin-top: -2px !important;
          margin-bottom: 4px !important;
          color: #111111 !important;
        }
        html body #root .amb-user-booking-overlay .amb-manual-location {
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8px !important;
          align-items: end !important;
        }
        html body #root .amb-user-booking-overlay .amb-modal-actions {
          margin-top: 8px !important;
          padding-top: 10px !important;
          border-top: 1px solid #edf0ed !important;
        }
        html body #root .amb-user-booking-overlay .amb-modal-actions .amb2-btn {
          min-width: 150px !important;
        }
        html body #root .amb-modal {
          width: min(760px, 100%) !important;
          max-height: calc(100vh - 106px) !important;
          overflow-y: auto !important;
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px 16px !important;
          padding: 20px !important;
          border: 1px solid rgba(18, 111, 30, .28) !important;
          border-radius: 16px !important;
          background: #ffffff !important;
          color: #111111 !important;
          box-shadow: none !important;
        }
        html body #root .amb-modal > :is(h3, p, .amb-location-explainer, .amb-location-choice, .amb-location-action, .amb-manual-location, .amb-location-confirmed, .amb-location-note, .amb-modal-actions, div[style]) { grid-column: 1 / -1; }
        html body #root .amb-modal h3 { color: #111111 !important; }
        html body #root .amb-modal p,
        html body #root .amb-modal :is(.amb-location-explainer span, .amb-location-action small, .amb-location-note, div[style]) { color: #111111 !important; }
        html body #root .amb-modal :is(.amb-field label, .amb-manual-location label, .amb-location-explainer strong, .amb-location-action b, .amb-location-choice) { color: #111111 !important; }
        html body #root .amb-modal :is(input, textarea, select) { background: #ffffff !important; border-color: rgba(18, 111, 30, .35) !important; color: #111111 !important; }
        html body #root .amb-location-action { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; align-items: center !important; gap: 16px !important; }
        html body #root .amb-manual-location { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; gap: 8px !important; align-items: end !important; }
        html body #root .amb-manual-location > label { grid-column: 1 / -1; }
        html body #root .amb-modal-actions { display: flex !important; justify-content: flex-end !important; gap: 10px !important; }
        html body #root .amb-modal-actions .amb2-btn { min-width: 150px !important; }
        html body #root .amb-modal :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt),
        html body #root .amb-modal :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt):hover:not(:disabled) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        @media (max-width: 720px) {
          html body #root .amb-modal-ov { padding: 72px 12px 16px !important; }
          html body #root .amb-user-booking-overlay {
            min-height: calc(100vh - 64px) !important;
            margin-left: 0 !important;
            padding: 16px 12px 88px !important;
          }
          html body #root .amb-user-booking-overlay .amb-modal { padding: 18px 16px 14px !important; }
          html body #root .amb-modal { grid-template-columns: 1fr !important; max-height: calc(100vh - 88px) !important; }
          html body #root .amb-field { grid-column: 1 / -1; }
          html body #root .amb-location-action,
          html body #root .amb-manual-location { grid-template-columns: 1fr !important; }
        }

        /* Fleet cards retain a stable white surface with yellow information blocks. */
        html body #root .amb2-card.amb2-card,
        html body #root .amb2-card.amb2-card:hover { background: #ffffff !important; border-color: rgba(18, 111, 30, .22) !important; box-shadow: none !important; transform: none !important; }
        html body #root .amb2-card.amb2-card:hover :is(.amb2-ins, .amb2-btn) { border-color: #f59a23 !important; }
        html body #root .amb2-top { background: #ffffff !important; }
        html body #root .amb2-top::after { background: linear-gradient(180deg, transparent 55%, rgba(18, 111, 30, .10)) !important; }
        html body #root :is(.amb2-speed, .amb2-status, .amb2-pill, .amb2-ins) { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
        html body #root .amb2-ins :is(b, span) { color: #111111 !important; }
        html body #root :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt),
        html body #root :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt):hover:not(:disabled) { background: #126f1e !important; border-color: #126f1e !important; color: #ffffff !important; box-shadow: none !important; transform: none !important; }
        html body #root .amb2-btn.icon,
        html body #root .amb2-btn.icon:hover:not(:disabled) { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
        /* Fleet cards keep green borders, yellow actions, and readable spacing. */
        html body #root#root .amb2-card.amb2-card,
        html body #root#root .amb2-card.amb2-card:hover {
          background: #ffffff !important;
          border-color: #126f1e !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root .amb2-card.amb2-card:hover { background: #f4fbf4 !important; }
        html body #root#root .amb2-top::after {
          background: linear-gradient(180deg, rgba(245, 154, 35, .52), rgba(245, 154, 35, .08)) !important;
        }
        html body #root#root .amb2-top img { filter: sepia(.24) saturate(.92) !important; }
        html body #root#root .amb2-body { padding: 18px !important; display: grid !important; gap: 10px !important; }
        html body #root#root .amb2-desc { margin: 0 !important; line-height: 1.5 !important; }
        html body #root#root .amb2-insights { gap: 8px !important; }
        html body #root#root .amb2-ins { min-height: 64px !important; padding: 9px 8px !important; }
        html body #root#root :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt),
        html body #root#root :is(.amb2-btn, .amb2-btn.main, .amb2-btn.main.alt):hover:not(:disabled) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
          transform: none !important;
        }
        html body #root#root .amb2-btn.icon,
        html body #root#root .amb2-btn.icon:hover:not(:disabled) { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
        html body #root#root .amb-side-card.active {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          box-shadow: none !important;
        }
        html body #root#root .amb-side-card.active :is(b, span, .amb-admin-sub) { color: #111111 !important; }
        html body #root#root .amb-side-card:hover { background: #fff3df !important; }
        html body #root#root .amb-map-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding: 9px 11px;
          border: 1px solid #f59a23;
          border-radius: 10px;
          background: #fff3df;
          color: #111111;
          font-size: 12px;
          font-weight: 700;
        }
        html body #root#root .amb-map-status button { border: 1px solid #f59a23; border-radius: 7px; padding: 6px 9px; background: #f59a23; color: #111111; font: inherit; cursor: pointer; white-space: nowrap; }
      `}</style>

      {toast && <div className={`amb-toast ${toast.type}`}>{toast.msg}</div>}

      <div className={`amb2-root ${isAdmin ? "admin-cut" : ""} ${isUser && showModal ? "amb2-booking-open" : ""}`} ref={rootRef}>
        <div className="amb2-wrap">
          {!isUser ? (
            <div className="amb2-head">
              <div className="amb2-kicker">Live Fleet</div>
              <h1>Ambulance Service</h1>
              <p>Life doesn&apos;t wait, neither do we.</p>
              {isAdmin && (reassignBookingId > 0 || assignBookingId > 0) && (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    background: "rgba(255, 255, 255, 0.15)",
                    color: "#111",
                    borderRadius: 10,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Booking #{assignBookingId || reassignBookingId}: select nearest available ambulance and assign.
                </div>
              )}
            </div>
          ) : !showModal ? (
            <div className="amb2-head">
              <h1>Book your ambulance here</h1>
            </div>
          ) : null}

          {!isUser && (
            <div className="amb2-stats">
              {statsConfig.map((s) => (
                <motion.div
                  className={`amb2-stat amb2-anim${s.key === "low_battery" ? " low-battery-stat" : ""}`}
                  key={s.key}
                  style={{ "--bar": s.accent }}
                  whileHover={{ y: -3 }}
                >
                  <div className="lbl">{s.label}</div>
                  <div className="val">{String(getCount(s.key)).padStart(2, "0")}</div>
                </motion.div>
              ))}
            </div>
          )}

          {!isUser && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 }}>
              <div className="amb2-sec" style={{ margin: 0 }}>Fleet Overview</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`amb2-btn ${!isSplitView ? "main" : ""}`}
                  onClick={() => setIsSplitView(false)}
                  style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8, cursor: "pointer" }}
                >
                  📱 Grid View
                </button>
                <button
                  type="button"
                  className={`amb2-btn ${isSplitView ? "main" : ""}`}
                  onClick={() => {
                    if (!selectedAmb && ambulances.length) setSelectedAmb(ambulances[0]);
                    setIsSplitView(true);
                  }}
                  style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8, cursor: "pointer" }}
                >
                  🗺 Split Map View
                </button>
              </div>
            </div>
          )}

          {!isUser && !isSplitView && (
            <div className="amb2-grid">
              {sortedAmbulances.map((a, i) => {
                const sc = statusConfig[a.status] || statusConfig.offline;
                const canBook = a.status === "available" && !isAdmin && !isDriver;
                const speed = a.speed ? `${Math.round(a.speed)} km/h` : "0 km/h";
                const battery = typeof a.battery === "number" ? a.battery : null;
                const isCriticalBattery = battery !== null && battery < 20;
                const batteryColor = isCriticalBattery ? "#ffffff" : "#22c55e";
                const pickupDistance = getDistanceToPickup(a);
                return (
                  <motion.article className="amb2-card amb2-anim" key={a.id}>
                    <div className="amb2-top">
                      <img
                        src={getImage(i)}
                        alt={a.ambulance_number || "Ambulance"}
                        loading="lazy"
                        onError={handleAmbImageError}
                      />
                      <div className="amb2-speed">{speed}</div>
                      <div className="amb2-status" style={{ color: sc.color, borderColor: sc.border, background: sc.bg }}>{sc.label}</div>
                    </div>

                    <div className="amb2-body">
                      <div className="amb2-meta">
                        <span className="amb2-pill">{a.model || "Ambulance"}</span>
                        <span className="amb2-pill">Unit #{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="amb2-title">
                        {a.ambulance_number || "AMB-0000"}
                        {battery !== null && (
                          <span className={`amb2-battery-badge ${isCriticalBattery ? "critical" : "healthy"}`}>
                            🔋 {battery}% {isCriticalBattery ? "Critical" : "Healthy"}
                          </span>
                        )}
                      </div>
                      <div className="amb2-sub">{a.driver || "Driver not assigned"} · {a.location || "Location updating..."}</div>
                      {isAdmin && (assignBookingId > 0 || reassignBookingId > 0) && (
                        <div className="amb2-sub" style={{ fontWeight: 700, color: "#111" }}>
                          Distance to pickup: {pickupDistance !== null ? `${pickupDistance.toFixed(1)} km` : "Location unavailable"}
                        </div>
                      )}
                      {battery !== null && (
                        <div className="amb2-battery-bar-wrap">
                          <div
                            className="amb2-battery-bar-fill"
                            style={{ width: `${battery}%`, background: batteryColor }}
                          />
                        </div>
                      )}
                      <div className="amb2-desc">
                        Fast emergency dispatch with real-time fleet status and quick response coordination.
                      </div>

                      <div className="amb2-insights">
                        <div className="amb2-ins speed"><b>{speed}</b><span>Current Speed</span></div>
                        <div className="amb2-ins status"><b>{sc.label}</b><span>Status</span></div>
                        <div className="amb2-ins contact"><b>{a.driver_contact ? `+91-${a.driver_contact}` : "N/A"}</b><span>Contact</span></div>
                      </div>

                      <div className="amb2-actions">
                        <button
                          className={`amb2-btn main ${canBook ? "" : "alt"}`}
                          disabled={assignmentBusy && isAdmin && (reassignBookingId > 0 || assignBookingId > 0)}
                          onClick={() => {
                            if (isAdmin && (reassignBookingId > 0 || assignBookingId > 0)) {
                              assignAmbulanceToBooking(a);
                              return;
                            }
                            if (isAdmin || isDriver) {
                              openDetails(a);
                              return;
                            }
                            if (isUser) {
                              navigate("/");
                              return;
                            }
                            showToast("Unit is not available right now", "err");
                          }}
                        >
                          {isAdmin && (reassignBookingId > 0 || assignBookingId > 0)
                            ? (a.status === "available" ? "Assign This Ambulance" : "Unavailable")
                            : isUser
                            ? "Book from Home"
                            : "See More"}
                        </button>
                        <button className="amb2-btn icon" onClick={() => navigator.clipboard?.writeText(a.driver_contact || "")}>📋</button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}

          {!isUser && isSplitView && (
            <div className="amb-split-layout">
              <div className="amb-split-left">
                {sortedAmbulances.map((a, i) => {
                  const isActive = selectedAmb?.id === a.id;
                  const sc = statusConfig[a.status] || statusConfig.offline;
                  return (
                    <div 
                      key={a.id} 
                      className={`amb-side-card ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedAmb(a)}
                    >
                      <div className="amb-admin-row-top">
                        <b style={{fontSize: 14}}>{a.ambulance_number || "AMB-0000"}</b>
                        <span className="amb-admin-pill" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>{sc.label}</span>
                      </div>
                      <div className="amb-admin-sub" style={{ fontSize: 11, marginTop: 2 }}>{a.driver || "No driver"} · {a.speed ? `${Math.round(a.speed)} km/h` : "0 km/h"}</div>
                    </div>
                  );
                })}
              </div>
              <div className="amb-split-right">
                 <button className="amb-close-split" onClick={closeDetails}>← Back to Grid</button>
                 
                 <h3 style={{ margin: 0, fontSize: 24, color: "#111" }}>{selectedAmb?.ambulance_number || "AMB-0000"}</h3>
                 <p style={{ color: "rgba(17,17,17,0.72)", margin: "6px 0 16px 0", fontSize: 13 }}>
                   Driver: {selectedAmb?.driver || "N/A"} · Contact: {selectedAmb?.driver_contact || "-"} · Location: {selectedAmb?.location || "Unknown"}
                 </p>

                 {(() => {
                    const battery = typeof selectedAmb?.battery === "number" ? selectedAmb.battery : null;
                    const isCriticalBattery = battery !== null && battery < 20;
                    const batteryColor = isCriticalBattery ? "#ffffff" : "#22c55e";
                    if (battery === null) return null;
                    return (
                      <div className={`amb-battery-diag${isCriticalBattery ? " critical" : ""}`} style={{ marginBottom: 16 }}>
                        <div className="amb-battery-diag-title">🔋 Battery Health</div>
                        <div className="amb-battery-diag-row">
                          <div className={`amb-battery-diag-level ${isCriticalBattery ? "critical" : "healthy"}`}>
                            {battery}%
                          </div>
                          <div className="amb-battery-diag-bar-wrap">
                            <div
                              className="amb-battery-diag-bar-fill"
                              style={{ width: `${battery}%`, background: batteryColor }}
                            />
                          </div>
                          <div className={`amb-battery-diag-status ${isCriticalBattery ? "critical" : "healthy"}`}>
                            {isCriticalBattery ? "Critical" : "Healthy"}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                 
                  <div className="amb-map-box" style={{ position: "relative" }}>
                    <GoogleMapEmbed
                      ambulanceLoc={
                        selectedAmb && isIndiaLatLng(Number(selectedAmb.latitude), Number(selectedAmb.longitude))
                          ? { lat: Number(selectedAmb.latitude), lng: Number(selectedAmb.longitude), heading: Number(selectedAmb.heading) || 0, speed: selectedAmb.speed || 0 }
                          : null
                      }
                      pickupLoc={
                        bookings.find((b) => Number(b.ambulance_id) === Number(selectedAmb?.id) && String(b.status).toLowerCase() === "confirmed")
                          ? {
                              lat: Number(bookings.find((b) => Number(b.ambulance_id) === Number(selectedAmb?.id) && String(b.status).toLowerCase() === "confirmed").pickup_latitude),
                              lng: Number(bookings.find((b) => Number(b.ambulance_id) === Number(selectedAmb?.id) && String(b.status).toLowerCase() === "confirmed").pickup_longitude),
                              label: bookings.find((b) => Number(b.ambulance_id) === Number(selectedAmb?.id) && String(b.status).toLowerCase() === "confirmed").pickup_location || "Pickup",
                            }
                          : null
                      }
                      height="100%"
                    />
                  </div>
                 <div className="amb-map-status">
                   <span>
                     {mapLocationStatus === "granted"
                       ? "Your location and route to this ambulance are shown on the map."
                       : mapLocationStatus === "requesting"
                         ? "Allow location access to show your route."
                         : "Location access is needed to show your route."}
                   </span>
                   {mapLocationStatus === "granted" ? (
                     <button type="button" onClick={openMapDirections}>Open directions</button>
                   ) : (
                     <button type="button" onClick={requestMapLocation}>Use my location</button>
                   )}
                 </div>

                 {(() => {
                    if (!selectedAmb) return null;
                    const s = getAmbBookingStats(selectedAmb.id);
                    return (
                      <div className="amb-admin-card" style={{ marginTop: 18 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: '#111' }}>BOOKING HISTORY</div>
                        <div className="amb-admin-grid">
                          <div className="amb-admin-stat"><div className="k">Total</div><div className="v">{String(s.total).padStart(2, "0")}</div></div>
                          <div className="amb-admin-stat"><div className="k">Confirmed</div><div className="v">{String(s.confirmed).padStart(2, "0")}</div></div>
                          <div className="amb-admin-stat"><div className="k">Completed</div><div className="v">{String(s.completed).padStart(2, "0")}</div></div>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

        </div>
      </div>

      {showModal && (
        <div className={`amb-modal-ov ${isUser ? "amb-user-booking-overlay" : ""}`} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="amb-modal">
            <h3>Book an ambulance</h3>
            <p>Share your pickup location and contact number.</p>

            {targetHospital && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1.5px solid #86efac",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  margin: "10px 0 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Selected Target Hospital
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#111827" }}>
                    🏥 {targetHospital.name}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    background: "#dcfce7",
                    color: "#166534",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "100px",
                    border: "1px solid #bbf7d0",
                    whiteSpace: "nowrap",
                  }}
                >
                  User Choice
                </span>
              </div>
            )}

            <div className="amb-location-explainer">
              <strong>Pickup location</strong>
            </div>

            <label className="amb-location-choice">
              <input
                type="checkbox"
                checked={form.booking_for_other}
                onChange={(event) => {
                  const bookingForOther = event.target.checked;
                  setForm((previous) => ({ ...previous, booking_for_other: bookingForOther }));
                  if (bookingForOther) {
                    clearPickupWatch();
                    setLocationMode("manual");
                    setConfirmedPickup(null);
                    setLocationMessage("Enter their pickup address.");
                  }
                }}
              />
              Use another pickup address
            </label>

            <div className="amb-location-action">
              <div><b>Use current location</b></div>
              <button
                className="amb2-btn"
                type="button"
                disabled={locationPermission === "requesting"}
                onClick={() => {
                  setForm((previous) => ({ ...previous, booking_for_other: false }));
                  setLocationMode("gps");
                  requestPickupLocation();
                }}
              >
                {locationPermission === "requesting" ? "Requesting location..." : locationPermission === "granted" ? "Location confirmed" : "Give location access"}
              </button>
            </div>

            {(form.booking_for_other || locationMode === "manual" || locationPermission === "denied" || locationPermission === "unavailable") && (
              <div className="amb-manual-location">
                <label>Pickup address</label>
                <input
                  list="pickup-address-suggestions"
                  value={form.pickup_address}
                  onChange={(event) => {
                    const pickupAddress = event.target.value;
                    setForm((previous) => ({ ...previous, pickup_address: pickupAddress }));
                    const selected = manualSuggestions.find((item) => item.label === pickupAddress);
                    if (selected) {
                      setConfirmedPickup({ lat: selected.lat, lng: selected.lng, source: "manual", label: selected.label });
                      setLocationPermission("manual");
                      setLocationMessage("Location confirmed.");
                    } else {
                      setConfirmedPickup(null);
                    }
                  }}
                  placeholder="House, street, landmark, city"
                />
                <datalist id="pickup-address-suggestions">
                  {manualSuggestions.map((suggestion) => (
                    <option key={`${suggestion.lat}-${suggestion.lng}`} value={suggestion.label} />
                  ))}
                  <option value="Shiv Vihar, Delhi" />
                  <option value="Loni, Ghaziabad" />
                  <option value="Noida, Uttar Pradesh" />
                  <option value="New Delhi, Delhi" />
                </datalist>
                <button className="amb2-btn" type="button" disabled={geocoding} onClick={confirmManualPickup}>
                  {geocoding ? "Confirming address..." : "Confirm address"}
                </button>
              </div>
            )}

            {locationPermission === "denied" && (
              <button className="amb2-btn" type="button" onClick={() => setLocationMode("manual")}>Use manual address instead</button>
            )}

            {!form.booking_for_other && locationMode === "manual" && (
              <button
                className="amb2-btn"
                type="button"
                onClick={() => {
                  setLocationMode("gps");
                  setLocationPermission("prompt");
                  setConfirmedPickup(null);
                  setLocationMessage("");
                }}
              >
                Use current location instead
              </button>
            )}

            {confirmedPickup && (
              <div className="amb-location-confirmed">
                Location confirmed
              </div>
            )}
            {locationMessage && !confirmedPickup && <div className="amb-location-note">{locationMessage}</div>}

            <div className="amb-field" style={{ gridColumn: "1 / -1" }}>
              <label>Contact Number</label>
              <input
                value={form.patient_contact_number}
                onChange={(e) => setForm((p) => ({ ...p, patient_contact_number: e.target.value }))}
                placeholder="Contact number"
              />
            </div>

            <div className="amb-modal-actions">
              <button className="amb2-btn" onClick={() => { setShowModal(false); setTargetHospital(null); }}>Cancel</button>
              <button className="amb2-btn main" disabled={loading || geocoding} onClick={submitBooking}>
                {geocoding ? "Resolving Location..." : loading ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedAmb && !isSplitView && (
        <div className="amb-modal-ov" onClick={(e) => e.target === e.currentTarget && setShowDetailsModal(false)}>
          <div className="amb-modal" style={{ width: "min(880px, 100%)", background: "#fffef6", color: "#111", border: "1px solid rgba(255, 255, 255, 0.15)" }}>
            <h3 style={{ color: "#111" }}>Ambulance Detail — {selectedAmb.ambulance_number || "AMB-0000"}</h3>
            <p style={{ color: "rgba(17,17,17,0.72)" }}>
              Driver: {selectedAmb.driver || "N/A"} · Contact: {selectedAmb.driver_contact || "-"} · Status: {(statusConfig[selectedAmb.status] || statusConfig.offline).label}
            </p>

            {/* Battery Health Diagnostic Card */}
            {(() => {
              const battery = typeof selectedAmb.battery === "number" ? selectedAmb.battery : null;
              const isCriticalBattery = battery !== null && battery < 20;
              const batteryColor = isCriticalBattery ? "#ffffff" : "#22c55e";
              if (battery === null) return null;
              return (
                <div className={`amb-battery-diag${isCriticalBattery ? " critical" : ""}`}>
                  <div className="amb-battery-diag-title">🔋 Battery Health</div>
                  <div className="amb-battery-diag-row">
                    <div className={`amb-battery-diag-level ${isCriticalBattery ? "critical" : "healthy"}`}>
                      {battery}%
                    </div>
                    <div className="amb-battery-diag-bar-wrap">
                      <div
                        className="amb-battery-diag-bar-fill"
                        style={{ width: `${battery}%`, background: batteryColor }}
                      />
                    </div>
                    <div className={`amb-battery-diag-status ${isCriticalBattery ? "critical" : "healthy"}`}>
                      {isCriticalBattery ? "Critical" : "Healthy"}
                    </div>
                  </div>
                  <div className="amb-battery-diag-note">
                    {isCriticalBattery
                      ? "⚠️ Battery is critically low. Immediate charging or replacement recommended before dispatch."
                      : "✅ Battery level is adequate for deployment."}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const s = getAmbBookingStats(selectedAmb.id);
              return (
                <div className="amb-admin-card">
                  <div className="amb-admin-grid">
                    <div className="amb-admin-stat"><div className="k">Total</div><div className="v">{String(s.total).padStart(2, "0")}</div></div>
                    <div className="amb-admin-stat"><div className="k">Confirmed</div><div className="v">{String(s.confirmed).padStart(2, "0")}</div></div>
                    <div className="amb-admin-stat"><div className="k">Completed</div><div className="v">{String(s.completed).padStart(2, "0")}</div></div>
                    <div className="amb-admin-stat"><div className="k">Pending</div><div className="v">{String(s.pending).padStart(2, "0")}</div></div>
                    <div className="amb-admin-stat"><div className="k">Cancelled</div><div className="v">{String(s.cancelled).padStart(2, "0")}</div></div>
                  </div>

                  <div className="amb-admin-list">
                    {s.recent.length === 0 && (
                      <div className="amb-admin-row">
                        <div className="amb-admin-sub">No booking history for this ambulance yet.</div>
                      </div>
                    )}
                    {s.recent.map((b) => (
                      <div key={b.id} className="amb-admin-row">
                        <div className="amb-admin-row-top">
                          <b>Booking #{b.id}</b>
                          <span className="amb-admin-pill">{b.status}</span>
                        </div>
                        <div className="amb-admin-sub">User: {b.booked_by || "N/A"} · Pickup: {b.pickup_location || "-"}</div>
                        <div className="amb-admin-sub">Destination: {b.destination || "Nearest hospital"} · Created: {b.created_at || "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="amb-modal-actions" style={{ gridTemplateColumns: "1fr" }}>
              <button className="amb2-btn main" onClick={() => setShowDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
