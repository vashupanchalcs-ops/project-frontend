import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLocation, useNavigate } from "react-router-dom";
import useLeaflet, {
  DELHI,
  makePinIcon,
  fetchRoadRoute,
  LIGHT_TILE,
} from "../hooks/useLeaflet";

gsap.registerPlugin(ScrollTrigger);

const statusConfig = {
  available: { label: "AVAILABLE", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
  en_route: { label: "EN ROUTE", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
  busy: { label: "BUSY", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
  offline: { label: "OFFLINE", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
};

const statsConfig = [
  { label: "Total Fleet", key: "total", accent: "#e50914" },
  { label: "Available", key: "available", accent: "#e50914" },
  { label: "En Route", key: "en_route", accent: "#e50914" },
  { label: "Busy", key: "busy", accent: "#e50914" },
  { label: "Low Battery", key: "low_battery", accent: "#e50914" },
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
        <stop offset="100%" stop-color="#e50914"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="500" fill="url(#g)"/>
    <rect x="0" y="390" width="1200" height="110" fill="#111111" opacity="0.08"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" fill="#111111" font-weight="700">
      YiCare Ambulance
    </text>
  </svg>`
)}`;
const OPENCAGE_API_KEY = (import.meta?.env?.VITE_OPENCAGE_API_KEY || "").trim();

export default function Ambulances() {
  const [ambulances, setAmbulances] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAmb, setSelectedAmb] = useState(null);
  const [form, setForm] = useState({
    pickup_landmark: "",
    pickup_city: "",
    pickup_district: "",
    patient_contact_number: "",
  });
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSplitView, setIsSplitView] = useState(false);

  const leafletReady = useLeaflet();
  const mapRef = useRef(null);
  const mapElRef = useRef(null);
  const routeLineRef = useRef(null);
  const layerRef = useRef({ amb: null, pickup: null, hospital: null });

  const isAdmin = localStorage.getItem("role") === "admin";
  const isDriver = localStorage.getItem("role") === "driver";
  const isUser = !isAdmin && !isDriver;
  const location = useLocation();
  const navigate = useNavigate();
  const assignBookingId = isAdmin ? Number(location.state?.assignBookingId || 0) : 0;
  const reassignBookingId = isAdmin ? Number(location.state?.reassignBookingId || 0) : 0;
  const rootRef = useRef(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/ambulances/")
      .then((r) => r.json())
      .then(setAmbulances)
      .catch(() => {});

    fetch("http://127.0.0.1:8000/api/bookings/")
      .then((r) => r.json())
      .then(setBookings)
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
      gsap.utils.toArray(".amb2-scroll").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              end: "top 60%",
              scrub: 0.8,
            },
          }
        );
      });

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

  const openBooking = (a) => {
    if (isAdmin || isDriver) return;
    setSelectedAmb(a);
    setForm({
      pickup_landmark: "",
      pickup_city: "",
      pickup_district: "",
      patient_contact_number: "",
    });
    setShowModal(true);
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
    layerRef.current = { amb: null, pickup: null, hospital: null };
    routeLineRef.current = null;

    const alat = Number(selectedAmb.latitude);
    const alng = Number(selectedAmb.longitude);
    const ambPos = Number.isFinite(alat) && Number.isFinite(alng) ? { lat: alat, lng: alng } : null;

    const bounds = L.latLngBounds();
    if (ambPos) {
      layerRef.current.amb = L.marker([ambPos.lat, ambPos.lng], { icon: makePinIcon("#111", "🚑") }).addTo(map);
      bounds.extend([ambPos.lat, ambPos.lng]);
    }

    // Attempt to load route if there's an active booking for this ambulance
    const activeBooking = bookings.find(b => b.ambulance_id === selectedAmb.id && String(b.status).toLowerCase() === "confirmed");
    
    if (activeBooking && ambPos) {
      (async () => {
        try {
           const plat = Number(activeBooking.pickup_latitude);
           const plng = Number(activeBooking.pickup_longitude);
           let pickupPos = (Number.isFinite(plat) && Number.isFinite(plng)) ? { lat: plat, lng: plng } : null;
           
           if (pickupPos) {
             layerRef.current.pickup = L.marker([pickupPos.lat, pickupPos.lng], { icon: makePinIcon("#f7c948", "📍") }).addTo(map);
             bounds.extend([pickupPos.lat, pickupPos.lng]);
             
             const pts = await fetchRoadRoute([ambPos, pickupPos]);
             const safePts = pts?.length > 1 ? pts : [ambPos, pickupPos];
             routeLineRef.current = L.polyline(safePts, { color: "#eab308", weight: 5, opacity: 0.96 }).addTo(map);
             bounds.extend(routeLineRef.current.getBounds());
             
             map.fitBounds(bounds, { padding: [30, 30] });
           }
        } catch(e) {}
      })();
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } else {
      map.setView([DELHI.lat, DELHI.lng], 12);
    }
    
  }, [isSplitView, selectedAmb, bookings]);

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
    const hasManualLocation = Boolean(landmark || city || district);

    if (!form.patient_contact_number.trim()) {
      showToast("Contact number is required.", "err");
      return;
    }

    if (hasManualLocation && (!landmark || !city || !district)) {
      showToast("Agar manual location fill kar rahe ho to landmark, city aur district tino fill karo.", "err");
      return;
    }
    setLoading(true);
    try {
      const user = localStorage.getItem("name") || "Unknown";
      const email = localStorage.getItem("user") || "";
      let pickupLocation = hasManualLocation
        ? `${landmark}, ${city}, ${district}`
        : "Live GPS location";

      let pickupCoords = null;
      if (hasManualLocation) {
        setGeocoding(true);
        try {
          if (OPENCAGE_API_KEY) {
            const params = new URLSearchParams({
              q: `${pickupLocation}, India`,
              key: OPENCAGE_API_KEY,
              language: "en",
              countrycode: "in",
              limit: "1",
              no_annotations: "1",
            });
            const geoRes = await fetch(`https://api.opencagedata.com/geocode/v1/json?${params.toString()}`);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const first = Array.isArray(geoData?.results) ? geoData.results[0] : null;
              const lat = Number(first?.geometry?.lat);
              const lng = Number(first?.geometry?.lng);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                pickupCoords = { lat, lng };
              }
            }
          }
          if (!pickupCoords) {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(pickupLocation + ", India")}&format=json&limit=1&countrycodes=in`;
            const geoRes = await fetch(url, { headers: { "Accept-Language": "en" } });
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const first = geoData?.[0];
              const lat = Number(first?.lat);
              const lng = Number(first?.lon);
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                pickupCoords = { lat, lng };
              }
            }
          }
        } catch {
          // keep flow running even if geocoder is unreachable
        } finally {
          setGeocoding(false);
        }
      }

      if (!pickupCoords && !hasManualLocation && navigator.geolocation) {
        try {
          const gpsPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            });
          });
          const gpsLat = Number(gpsPosition?.coords?.latitude);
          const gpsLng = Number(gpsPosition?.coords?.longitude);
          if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
            pickupCoords = { lat: gpsLat, lng: gpsLng };
          }
        } catch {
          // Final fallback only; booking should primarily respect form-filled location.
        }
      }

      if (pickupCoords && !hasManualLocation && OPENCAGE_API_KEY) {
        try {
          const params = new URLSearchParams({
            q: `${pickupCoords.lat},${pickupCoords.lng}`,
            key: OPENCAGE_API_KEY,
            language: "en",
            limit: "1",
            no_annotations: "1",
          });
          const revRes = await fetch(`https://api.opencagedata.com/geocode/v1/json?${params.toString()}`);
          if (revRes.ok) {
            const revData = await revRes.json();
            const first = Array.isArray(revData?.results) ? revData.results[0] : null;
            if (first) {
              const components = first.components || {};
              const formatted = first.formatted || "Live GPS Location";
              
              const resolvedCity = components.city || components.town || components.village || components.municipality || components.state_district || "";
              const resolvedDistrict = components.county || components.subdistrict || components.state_district || "";
              const resolvedLandmark = components.suburb || components.neighbourhood || components.road || "";

              pickupLocation = formatted;
              landmark = resolvedLandmark;
              city = resolvedCity;
              district = resolvedDistrict;
            }
          }
        } catch (e) {
          console.error("Reverse geocoding failed", e);
        }
      }

      const res = await fetch("http://127.0.0.1:8000/api/bookings/", {
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
          pickup_latitude: pickupCoords?.lat ?? null,
          pickup_longitude: pickupCoords?.lng ?? null,
          pickup_landmark: landmark,
          pickup_city: city,
          pickup_district: district,
          patient_contact_number: form.patient_contact_number.trim(),
          status: "pending",
        }),
      });
      if (res.ok) {
        showToast("Request submitted successfully", "ok");
        setShowModal(false);
        window.dispatchEvent(new Event("new-booking"));
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
    if (amb.status !== "available") {
      showToast("Please select an available ambulance", "err");
      return;
    }
    try {
      const payload = reassignBookingId
        ? { reassign_ambulance_id: amb.id, notify_user_reassigned: true }
        : { assign_ambulance_id: amb.id };
      const res = await fetch(`http://127.0.0.1:8000/api/bookings/${bookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Reassignment failed", "err");
        return;
      }
      showToast(reassignBookingId ? "New ambulance reassigned and user notified" : "Ambulance assigned for this booking", "ok");
      navigate("/Requests", {
        state: { flashMsg: `Booking #${bookingId} assigned to ${amb.ambulance_number}` },
      });
    } catch {
      showToast("Server error during reassignment", "err");
    }
  };

  return (
    <>
      <style>{`
        .amb2-root {
          min-height: 100vh;
          padding-top: 64px;
          padding-left: 64px;
          background:
            radial-gradient(860px 420px at 85% 8%, rgba(229, 9, 20, 0.15), transparent 72%),
            radial-gradient(840px 380px at 12% -4%, rgba(229, 9, 20, 0.15), transparent 70%),
            var(--sr-bg, #f7f7f2);
          color: var(--sr-page-text, #111111);
          position: relative;
          overflow: hidden;
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
          background: radial-gradient(circle, rgba(229, 9, 20, 0.15) 0%, rgba(229, 9, 20, 0.15) 70%);
        }
        .amb2-root::after {
          left: -160px;
          bottom: -220px;
          background: radial-gradient(circle, rgba(229, 9, 20, 0.15) 0%, rgba(229, 9, 20, 0.15) 70%);
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
          border: 1px solid rgba(229, 9, 20, 0.15);
          color: #111111;
          background: rgba(229, 9, 20, 0.15);
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
          border-top: 3.5px solid #e50914;
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
          border-top-color: #e50914 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .amb2-stat.low-battery-stat:hover {
          background-color: #ffffff !important;
          border-color: #e0e0e0 !important;
          border-top-color: #e50914 !important;
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
          color: #ff4d4d;
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
          background: linear-gradient(165deg, rgba(229, 9, 20, 0.15), rgba(255,255,255,0.96));
          border-color: #111111;
          box-shadow: 0 18px 34px rgba(229, 9, 20, 0.15), 0 0 0 1px #111111 inset;
          transform: translateY(-4px);
        }
        .amb2-card:hover .amb2-ins,
        .amb2-card:hover .amb2-btn {
          border-color: rgba(229, 9, 20, 0.15);
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
          background: rgba(229, 9, 20, 0.15);
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
          background: rgba(229, 9, 20, 0.15);
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
          border: 1px solid rgba(229, 9, 20, 0.15);
          background: #ffffff;
          padding: 7px 6px;
        }
        .amb2-ins.speed { border-color: rgba(229, 9, 20, 0.15); background: #ffffff; }
        .amb2-ins.status { border-color: rgba(229, 9, 20, 0.15); background: #ffffff; }
        .amb2-ins.contact { border-color: rgba(229, 9, 20, 0.15); background: #ffffff; }
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
          background: #e50914;
          border-color: #e50914;
          box-shadow: none;
          color: #111111;
        }
        .amb2-btn.main.alt {
          background: #e50914;
          color: #111111;
          border-color: #e50914;
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
          border-color: rgba(229, 9, 20, 0.15);
          box-shadow: 0 0 0 1px rgba(229, 9, 20, 0.15) inset;
        }
        .amb2-btn:hover:not(:disabled) {
          border-color: rgba(229, 9, 20, 0.15);
          box-shadow: 0 0 0 1px rgba(229, 9, 20, 0.15) inset;
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
          border: 1px solid rgba(229, 9, 20, 0.15);
          border-radius: 12px;
          background: rgba(229, 9, 20, 0.15);
          padding: 10px;
        }
        .amb-admin-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
        }
        .amb-admin-stat {
          border: 1px solid rgba(229, 9, 20, 0.15);
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
          border: 1px solid rgba(229, 9, 20, 0.15);
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
          border: 1px solid rgba(229, 9, 20, 0.15);
          background: #e50914;
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
          border: 1px solid rgba(229, 9, 20, 0.15);
          border-radius: 12px;
          background: rgba(229, 9, 20, 0.15);
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
        .amb-battery-diag-level.critical { color: #ff4d4d; }
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
          border: 1px solid rgba(229, 9, 20, 0.15);
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
          border-color: #e50914;
          background: #fdfdf5;
          box-shadow: inset 4px 0 0 #e50914;
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
      `}</style>

      {toast && <div className={`amb-toast ${toast.type}`}>{toast.msg}</div>}

      <div className={`amb2-root ${isAdmin ? "admin-cut" : ""}`} ref={rootRef}>
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
                    border: "1px solid rgba(229, 9, 20, 0.15)",
                    background: "rgba(229, 9, 20, 0.15)",
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
          ) : (
            <div className="amb2-head">
              <h1>Book your ambulance here</h1>
            </div>
          )}

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

          {!isUser && !isSplitView && <div className="amb2-sec">Fleet Overview</div>}

          {!isUser && !isSplitView && (
            <div className="amb2-grid">
              {sortedAmbulances.map((a, i) => {
                const sc = statusConfig[a.status] || statusConfig.offline;
                const canBook = a.status === "available" && !isAdmin && !isDriver;
                const speed = a.speed ? `${Math.round(a.speed)} km/h` : "0 km/h";
                const battery = typeof a.battery === "number" ? a.battery : null;
                const isCriticalBattery = battery !== null && battery < 20;
                const batteryColor = isCriticalBattery ? "#ff4d4d" : "#22c55e";
                const pickupDistance = getDistanceToPickup(a);
                return (
                  <motion.article className="amb2-card amb2-anim" key={a.id} whileHover={{ y: -4 }}>
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
                          onClick={() => {
                            if (isAdmin && (reassignBookingId > 0 || assignBookingId > 0)) {
                              assignAmbulanceToBooking(a);
                              return;
                            }
                            if (isAdmin || isDriver) {
                              openDetails(a);
                              return;
                            }
                            if (canBook) {
                              openBooking(a);
                              return;
                            }
                            showToast("Unit is not available right now", "err");
                          }}
                        >
                          {isAdmin && (reassignBookingId > 0 || assignBookingId > 0)
                            ? (a.status === "available" ? "Assign This Ambulance" : "Unavailable")
                            : canBook && !isAdmin && !isDriver
                            ? "See More | Book"
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
                    const batteryColor = isCriticalBattery ? "#ff4d4d" : "#22c55e";
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
                 
                 <div className="amb-map-box">
                    <div ref={mapElRef} style={{ width: "100%", height: "100%" }} />
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

          {isUser && (
            <div className="amb2-scroll" style={{ marginTop: 18 }}>
              <div
                style={{
                  border: "1px solid rgba(229, 9, 20, 0.15)",
                  background: "linear-gradient(165deg, rgba(229, 9, 20, 0.15), rgba(255,255,255,0.98))",
                  borderRadius: 18,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#111" }}>Book My Ambulance</div>
                  <div style={{ fontSize: 13, color: "rgba(17,17,17,0.72)" }}>
                    Request submit karo. Admin nearest ambulance assign karega and aapko live updates milte rahenge.
                  </div>
                </div>
                <button
                  className="amb2-btn main"
                  style={{ minWidth: 220 }}
                  onClick={() => {
                    setSelectedAmb(null);
                    setForm({
                      pickup_landmark: "",
                      pickup_city: "",
                      pickup_district: "",
                      patient_contact_number: "",
                    });
                    setShowModal(true);
                  }}
                >
                  Book My Ambulance
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="amb-modal-ov" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="amb-modal">
            <h3>{selectedAmb ? `Book ${selectedAmb.ambulance_number}` : "Book My Ambulance"}</h3>
            <p>
              {selectedAmb
                ? `Driver: ${selectedAmb.driver} · Contact: ${selectedAmb.driver_contact || "-"}`
                : "Nearest available ambulance will be assigned by admin dispatch."}
            </p>

            <div className="amb-field">
              <label>Pickup Landmark</label>
              <input
                value={form.pickup_landmark}
                onChange={(e) => setForm((p) => ({ ...p, pickup_landmark: e.target.value }))}
                placeholder="Landmark (blank chhodo to GPS use hoga)"
              />
            </div>
            <div className="amb-field">
              <label>City</label>
              <input
                value={form.pickup_city}
                onChange={(e) => setForm((p) => ({ ...p, pickup_city: e.target.value }))}
                placeholder="City (optional with GPS)"
              />
            </div>
            <div className="amb-field">
              <label>District</label>
              <input
                value={form.pickup_district}
                onChange={(e) => setForm((p) => ({ ...p, pickup_district: e.target.value }))}
                placeholder="District (optional with GPS)"
              />
            </div>
            <div className="amb-field">
              <label>Contact Number</label>
              <input
                value={form.patient_contact_number}
                onChange={(e) => setForm((p) => ({ ...p, patient_contact_number: e.target.value }))}
                placeholder="Contact number"
              />
            </div>

            <div style={{ fontSize: 12, color: "rgba(255,246,242,0.7)" }}>
              Hospital admin assigns dispatch team based on availability.
            </div>

            <div className="amb-modal-actions">
              <button className="amb2-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="amb2-btn main" disabled={loading || geocoding} onClick={submitBooking}>
                {geocoding ? "Resolving Location..." : loading ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedAmb && !isSplitView && (
        <div className="amb-modal-ov" onClick={(e) => e.target === e.currentTarget && setShowDetailsModal(false)}>
          <div className="amb-modal" style={{ width: "min(880px, 100%)", background: "#fffef6", color: "#111", border: "1px solid rgba(229, 9, 20, 0.15)" }}>
            <h3 style={{ color: "#111" }}>Ambulance Detail — {selectedAmb.ambulance_number || "AMB-0000"}</h3>
            <p style={{ color: "rgba(17,17,17,0.72)" }}>
              Driver: {selectedAmb.driver || "N/A"} · Contact: {selectedAmb.driver_contact || "-"} · Status: {(statusConfig[selectedAmb.status] || statusConfig.offline).label}
            </p>

            {/* Battery Health Diagnostic Card */}
            {(() => {
              const battery = typeof selectedAmb.battery === "number" ? selectedAmb.battery : null;
              const isCriticalBattery = battery !== null && battery < 20;
              const batteryColor = isCriticalBattery ? "#ff4d4d" : "#22c55e";
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
