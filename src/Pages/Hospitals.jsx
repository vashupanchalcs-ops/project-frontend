import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BedSingle, CheckCircle2, HeartPulse } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const statusConfig = {
  active: { label: "ACTIVE", color: "#ffffff", border: "#e0e0e0", bg: "#ffffff" },
  full: { label: "FULL", color: "#111111", border: "#e0e0e0", bg: "#ffffff" },
  critical: { label: "CRITICAL", color: "#ffffff", border: "#e0e0e0", bg: "#ffffff" },
  closed: { label: "CLOSED", color: "#555555", border: "#e0e0e0", bg: "#ffffff" },
};

const statsConfig = [
  { label: "Total Hospitals", key: "total", accent: "#ffffff" },
  { label: "Active", key: "active", accent: "#ffffff" },
  { label: "Critical", key: "critical", accent: "#ffffff" },
  { label: "Full", key: "full", accent: "#ffffff" },
];

const images = [
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&q=80",
  "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200&q=80",
  "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&q=80",
];

const getImage = (idx) => images[idx % images.length];

const DEFAULT_HOSPITALS = [
  {
    id: "default-saharda",
    name: "Saharda Hospital",
    address: "Delhi",
    latitude: "28.6139",
    longitude: "77.2090",
    contact_number: "8882128534",
    hospital_type: "government",
    total_beds: 40,
    available_beds: 10,
    booked_beds: 30,
    icu_beds: 4,
    available_icu_beds: 2,
    doctors_count: 12,
    doctors_active: 10,
    nurses_count: 24,
    nurses_active: 20,
    staff_active_count: 34,
    staff_deactive_count: 6,
    emergency_services: true,
    status: "active",
    is_active: true,
  },
];

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

export default function Hospitals() {
  const cachedHospitals = (() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem("hospitals_list_cache") || "null");
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_HOSPITALS;
    } catch {
      return DEFAULT_HOSPITALS;
    }
  })();
  const [hospitals, setHospitals] = useState(cachedHospitals);
  const [assignBooking, setAssignBooking] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const role = localStorage.getItem("role");
  const isAdmin = role === "admin";
  const isDriver = role === "driver";
  const isUser = !isAdmin && !isDriver && role !== "hospital";
  const assignBookingId = isAdmin ? location.state?.assignBookingId : null;
  const reselectForBookingId = location.state?.reselectForBookingId || null;

  useEffect(() => {
    const loadHospitals = () => {
      fetch(`${BASE}/api/hospitals/`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => {
          const list = Array.isArray(rows) && rows.length ? rows : DEFAULT_HOSPITALS;
          setHospitals(list);
          try { sessionStorage.setItem("hospitals_list_cache", JSON.stringify(list)); } catch {}
        })
        .catch(() => setHospitals(DEFAULT_HOSPITALS));
    };
    loadHospitals();
    const interval = setInterval(loadHospitals, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!assignBookingId) {
      setAssignBooking(null);
      return;
    }
    fetch(`${BASE}/api/bookings/${assignBookingId}/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAssignBooking(data || null))
      .catch(() => setAssignBooking(null));
  }, [assignBookingId]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(".h2-scroll", { y: 0, opacity: 1, clearProps: "all" });
    }, rootRef);
    return () => ctx.revert();
  }, [hospitals.length]);

  const getCount = (key) => {
    if (key === "total") return hospitals.length;
    return hospitals.filter((h) => h.status === key).length;
  };

  const handleDirections = (h) => {
    if (assignBookingId) return;
    const lat = parseFloat(h.latitude);
    const lng = parseFloat(h.longitude);
    // Only pass coordinates if they are valid Indian coordinates; otherwise pass null
    // so the Directions page falls back to geocoding the address text (fixes wrong-city bug)
    const validCoords =
      Number.isFinite(lat) && Number.isFinite(lng) &&
      lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
    navigate("/directions", {
      state: {
        hospital: {
          name: h.name,
          address: h.address,
          latitude:  validCoords ? lat : null,
          longitude: validCoords ? lng : null,
        },
      },
    });
  };

  const assignHospitalToBooking = async (hospital) => {
    if (!assignBookingId) return;
    if (!(hospital?.is_active && hospital?.status !== "closed" && Number(hospital?.available_beds || 0) > 0)) return;

    // 1. Optimistically update admin requests cache immediately
    try {
      const cached = JSON.parse(sessionStorage.getItem("admin_requests_cache") || "[]");
      sessionStorage.setItem("admin_requests_cache", JSON.stringify(
        cached.map((row) => {
          if (Number(row.id) === Number(assignBookingId)) {
            return {
              ...row,
              assigned_hospital_id: hospital.id,
              assigned_hospital_name: hospital.name,
              destination: hospital.name,
              hospital_response: "pending",
              hospital_alert_sent: true,
            };
          }
          return row;
        })
      ));
    } catch {}

    // 2. Instant 0ms navigation
    navigate("/Requests", {
      state: { flashMsg: `Hospital assigned: ${hospital.name}. Waiting for hospital approval.` },
    });

    // 3. Background network PATCH
    try {
      await fetch(`${BASE}/api/bookings/${assignBookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assign_hospital_id: hospital.id,
          send_hospital_alert: true,
        }),
      });
    } catch (err) {
      console.warn("Background hospital assignment error:", err);
    }
  };

  const reassignUserHospital = async (h) => {
    if (!reselectForBookingId) return;

    // 1. Optimistically update user's booking cache immediately
    try {
      const cached = JSON.parse(sessionStorage.getItem("my_bookings_cache") || "[]");
      sessionStorage.setItem("my_bookings_cache", JSON.stringify(
        cached.map((row) => {
          if (Number(row.id) === Number(reselectForBookingId)) {
            return {
              ...row,
              assigned_hospital_id: h.id,
              assigned_hospital_name: h.name,
              destination: h.name,
              is_user_selected_hospital: true,
            };
          }
          return row;
        })
      ));
    } catch {}

    // 2. Instant 0ms navigation
    navigate("/MyBookings", {
      state: { flashMsg: `Booking #${reselectForBookingId} transferred to ${h.name}. Waiting for hospital approval.` },
    });

    // 3. Background network PATCH
    try {
      await fetch(`${BASE}/api/bookings/${reselectForBookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assign_hospital_id: h.id,
          destination: h.name,
          send_hospital_alert: true,
          is_user_selected_hospital: true,
        }),
      });
    } catch (err) {
      console.warn("Background hospital transfer error:", err);
    }
  };

  const miniToneStyle = (tone) => {
    if (tone === "tone-green") {
      return { background: "#dcfce7", border: "1px solid #16a34a", color: "#166534" };
    }
    if (tone === "tone-red") {
      return { background: "#fecaca", border: "1px solid #b91c1c", color: "#991b1b" };
    }
    return { background: "#fff59d", border: "1px solid #c7b900", color: "#111111" };
  };

  const parsePickupPoint = () => {
    const lat = Number(assignBooking?.pickup_latitude);
    const lng = Number(assignBooking?.pickup_longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98) {
      return { lat, lng };
    }
    return null;
  };

  const pickupPoint = parsePickupPoint();

  const haversineKm = (a, b) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const getDistanceToPickup = (hospital) => {
    if (!pickupPoint) return null;
    const hLat = Number(hospital?.latitude);
    const hLng = Number(hospital?.longitude);
    if (!Number.isFinite(hLat) || !Number.isFinite(hLng)) return null;
    if (!(hLat >= 6 && hLat <= 38 && hLng >= 68 && hLng <= 98)) return null;
    // Multiply straight-line Haversine by 1.56 to estimate real-world road routing distance
    return haversineKm(pickupPoint, { lat: hLat, lng: hLng }) * 1.56;
  };

  // Priority scoring: higher score = better hospital for assignment
  // Weights: ICU beds (40) > Facilities (25) > Doctors (15) > Staff (10) > Distance (10)
  const getHospitalPriorityScore = (hospital) => {
    const icuBeds = Number(hospital?.available_icu_beds || hospital?.icu_beds || 0);
    const facilitiesCount = String(hospital?.facilities || "").split(",").filter(f => f.trim()).length;
    const doctorsActive = Number(hospital?.doctors_active || 0);
    const staffActive = Number(hospital?.staff_active_count || 0);
    const availableBeds = Number(hospital?.available_beds || 0);

    // ICU beds score (0-40 points): each ICU bed = 8 pts, max 40
    const icuScore = Math.min(icuBeds * 8, 40);
    // Facilities score (0-25 points): each facility = 5 pts, max 25
    const facilityScore = Math.min(facilitiesCount * 5, 25);
    // Doctor score (0-15 points): each active doctor = 3 pts, max 15
    const doctorScore = Math.min(doctorsActive * 3, 15);
    // Staff score (0-10 points): each active staff = 1 pt, max 10
    const staffScore = Math.min(staffActive * 1, 10);
    // Bed availability bonus (0-10 points)
    const bedScore = Math.min(availableBeds * 2, 10);

    // Distance penalty (0-10 points subtracted): closer = less penalty
    let distancePenalty = 0;
    if (pickupPoint) {
      const distKm = getDistanceToPickup(hospital);
      if (distKm !== null) {
        // 0 km = 0 penalty, 50+ km = 10 penalty
        distancePenalty = Math.min(distKm / 5, 10);
      } else {
        distancePenalty = 10; // unknown distance = max penalty
      }
    }

    return icuScore + facilityScore + doctorScore + staffScore + bedScore - distancePenalty;
  };

  const sortedHospitals = [...hospitals];
  // Always sort by priority — best hospitals show first
  sortedHospitals.sort((a, b) => {
    // Closed/inactive hospitals go to bottom
    const aActive = a.is_active !== false && a.status !== "closed";
    const bActive = b.is_active !== false && b.status !== "closed";
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;

    // Full hospitals go below active ones
    const aFull = a.status === "full" || Number(a.available_beds || 0) === 0;
    const bFull = b.status === "full" || Number(b.available_beds || 0) === 0;
    if (!aFull && bFull) return -1;
    if (aFull && !bFull) return 1;

    // Sort by priority score (higher first)
    return getHospitalPriorityScore(b) - getHospitalPriorityScore(a);
  });

  return (
    <>
      <style>{`
        .h2-root {
          min-height: 100vh;
          padding-top: 64px;
          padding-left: 64px;
          background:
            radial-gradient(920px 430px at 88% 8%, rgba(255, 255, 255, 0.15), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(255, 255, 255, 0.15), transparent 70%),
            var(--sr-bg, #f7f7f2);
          color: var(--sr-page-text, #111111);
          position: relative;
          overflow: hidden;
        }
        .h2-root::before,
        .h2-root::after {
          content: "";
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          filter: blur(30px);
          pointer-events: none;
          z-index: 0;
          animation: h2-float 11s ease-in-out infinite;
        }
        .h2-root::before {
          top: -190px;
          right: -120px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.15) 70%);
        }
        .h2-root::after {
          left: -170px;
          bottom: -220px;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.15) 70%);
          animation-delay: -5.5s;
        }
        @keyframes h2-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -16px, 0) scale(1.06); }
        }
        .h2-wrap {
          width: 100%;
          padding: clamp(16px, 2.2vw, 30px);
          position: relative;
          z-index: 1;
        }

        .h2-kicker {
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
        .h2-head h1 {
          margin: 0;
          font-size: clamp(32px, 4vw, 54px);
          letter-spacing: -1px;
          color: #111111;
          line-height: 0.98;
        }
        .h2-head p {
          margin: 10px 0 0;
          color: rgba(17,17,17,0.76);
          font-size: 16px;
        }
        .h2-assign-banner {
          margin-top: 14px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.15);
          color: #111;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 700;
        }

        .h2-stats {
          margin-top: 22px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .h2-stat {
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          border-top: 3.5px solid #ffffff;
          background: #ffffff;
          padding: 14px 16px;
          position: relative;
          transition: none;
        }
        .h2-stat::before {
          content: none;
        }
        .h2-stat:hover {
          background-color: #ffffff !important;
          border-color: #e0e0e0 !important;
          border-top-color: #ffffff !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .h2-stat .lbl {
          font-size: 11px;
          font-weight: 700;
          color: #555555;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }
        .h2-stat .val {
          margin-top: 8px;
          font-size: clamp(30px, 3vw, 44px);
          line-height: 1;
          font-weight: 900;
          color: #111111;
        }
        .h2-stat.filled {
          background: #ffffff;
          border: 1px solid #e0e0e0;
          border-top: 3.5px solid #ffffff;
        }
        .h2-stat.filled .lbl { color: #555555; }
        .h2-stat.filled .val { color: #111111; }

        .h2-sec {
          margin-top: 30px;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.4px;
          color: #111111;
        }

        .h2-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .h2-root.admin-cut .h2-sec {
          margin-top: 24px;
          font-size: 22px;
          letter-spacing: -0.2px;
        }
        .h2-root.admin-cut .h2-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .h2-root.admin-cut .h2-card {
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr);
          min-height: 220px;
          border-radius: 20px;
          box-shadow: 0 12px 26px rgba(17,17,17,0.1);
        }
        .h2-root.admin-cut .h2-top {
          height: 100%;
          min-height: 220px;
          border-right: 1px solid rgba(17,17,17,0.08);
        }
        .h2-root.admin-cut .h2-top::after {
          background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.34) 100%);
        }
        .h2-root.admin-cut .h2-status {
          top: 10px;
          right: 10px;
          bottom: auto;
          font-size: 10px;
          padding: 4px 10px;
          background: rgba(255,255,255,0.9) !important;
        }
        .h2-root.admin-cut .h2-body {
          padding: 14px;
          display: grid;
          align-content: start;
          gap: 8px;
        }
        .h2-root.admin-cut .h2-meta { gap: 6px; }
        .h2-root.admin-cut .h2-pill {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(17,17,17,0.14);
        }
        .h2-root.admin-cut .h2-name {
          margin-top: 2px;
          font-size: clamp(20px, 2.2vw, 28px);
        }
        .h2-root.admin-cut .h2-address {
          font-size: 13px;
          white-space: normal;
          line-height: 1.45;
        }
        .h2-root.admin-cut .h2-desc {
          margin-top: 1px;
          min-height: 0;
          font-size: 12px;
        }
        .h2-root.admin-cut .h2-stats-mini {
          margin-top: 0;
          grid-template-columns: repeat(3, minmax(95px, 1fr));
          max-width: 430px;
        }
        .h2-root.admin-cut .h2-actions { margin-top: 2px; }

        .h2-card {
          border: 1px solid rgba(20,20,20,0.16);
          border-radius: 16px;
          overflow: hidden;
          background: linear-gradient(170deg, rgba(255,255,255,0.98), rgba(246,246,236,0.98));
          box-shadow: 0 16px 34px rgba(0,0,0,0.18);
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .h2-card:hover {
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.15), rgba(255,255,255,0.96));
          border-color: #111111;
          box-shadow: 0 18px 34px rgba(255, 255, 255, 0.15), 0 0 0 1px #111111 inset;
          transform: translateY(-4px);
        }
        .h2-card:hover .h2-mini,
        .h2-card:hover .h2-btn {
          border-color: rgba(255, 255, 255, 0.15);
        }
        .h2-top {
          position: relative;
          height: 132px;
          overflow: hidden;
          background: #09070f;
        }
        .h2-top::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.08) 100%);
        }
        .h2-top img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: contrast(1.03) saturate(1.03);
          image-rendering: auto;
        }
        .h2-status {
          position: absolute;
          right: 10px;
          bottom: 10px;
          z-index: 2;
          border-radius: 100px;
          border: 1px solid;
          padding: 3px 9px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .h2-body {
          padding: 12px;
        }
        .h2-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .h2-pill {
          padding: 3px 9px;
          border-radius: 100px;
          border: 1px solid rgba(20,20,20,0.14);
          background: rgba(255, 255, 255, 0.15);
          color: rgba(17,17,17,0.9);
          font-size: 11px;
          font-weight: 700;
        }
        .h2-name {
          margin-top: 8px;
          font-size: clamp(18px, 1.9vw, 24px);
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.4px;
          color: #111111;
        }
        .h2-address {
          margin-top: 5px;
          color: rgba(17,17,17,0.84);
          font-size: clamp(12px, 1.2vw, 14px);
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .h2-desc {
          margin-top: 7px;
          color: rgba(17,17,17,0.72);
          font-size: 12px;
          line-height: 1.45;
          min-height: 34px;
        }

        .h2-stats-mini {
          margin-top: 9px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 6px;
        }
        .h2-mini {
          border: 1px solid #b7c600;
          border-radius: 10px;
          background: #ffffff;
          padding: 7px 6px;
          text-align: center;
        }
        .h2-mini.tone-green {
          background: #d9f7eb !important;
          border: 1px solid #43c18b !important;
        }
        .h2-mini.tone-yellow {
          background: #fff8bf !important;
          border: 1px solid #d8c84f !important;
        }
        .h2-mini.tone-red {
          background: #ffd9e0 !important;
          border: 1px solid #ef6b88 !important;
        }
        .h2-mini .v {
          font-size: 15px;
          font-weight: 900;
          line-height: 1;
          color: #111111;
          font-family: "Orbitron", "Rajdhani", "Segoe UI", sans-serif;
          letter-spacing: 0.6px;
        }
        .h2-mini .l {
          margin-top: 3px;
          font-size: 9px;
          font-weight: 800;
          color: rgba(17,17,17,0.78);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-family: "Orbitron", "Rajdhani", "Segoe UI", sans-serif;
        }
        .h2-mini .i {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
        }
        .h2-mini.tone-green .v,
        .h2-mini.tone-green .l { color: #125c41; }
        .h2-mini.tone-yellow .v,
        .h2-mini.tone-yellow .l { color: #111111; }
        .h2-mini.tone-red .v,
        .h2-mini.tone-red .l { color: #8a1f35; }

        .h2-actions {
          margin-top: 9px;
          display: grid;
          grid-template-columns: 1fr 40px;
          gap: 6px;
        }
        .h2-btn {
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.06);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          height: 34px;
        }
        .h2-btn.main {
          background: linear-gradient(90deg, #ff1f5a, #ff4f40);
          border-color: transparent;
          box-shadow: 0 12px 28px rgba(255, 31, 90, 0.32);
        }
        .h2-btn.assign {
          background: #ffffff;
          color: #111;
          border: 1px solid #111;
          box-shadow: none;
        }
        .h2-btn.assign:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .h2-mini:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
        }
        .h2-btn:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
        }

        @media (max-width: 1100px) {
          .h2-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .h2-grid {
            grid-template-columns: 1fr;
          }
          .h2-root.admin-cut .h2-card {
            grid-template-columns: 1fr;
          }
          .h2-root.admin-cut .h2-top {
            min-height: 150px;
            border-right: 0;
            border-bottom: 1px solid rgba(17,17,17,0.08);
          }
        }
        @media (max-width: 767px) {
          .h2-root {
            padding-left: 0;
            padding-bottom: 74px;
          }
          .h2-wrap {
            padding: 14px 12px 84px;
          }
          .h2-stats-mini {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }

        /* Two-up horizontal hospital cards keep bed data scannable at a glance. */
        html body #root .h2-grid.h2-grid,
        html body #root .h2-root.admin-cut .h2-grid.h2-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        html body #root .h2-card.h2-card,
        html body #root .h2-root.admin-cut .h2-card.h2-card {
          display: grid;
          grid-template-columns: minmax(168px, 38%) minmax(0, 1fr);
          min-height: 232px;
          background: #ffffff !important;
          border: 1px solid #ead6d7 !important;
          border-radius: 18px !important;
          box-shadow: 0 10px 24px rgba(29, 16, 17, .10) !important;
        }
        html body #root .h2-card.h2-card:hover {
          background: #ffffff !important;
          border-color: #e50914 !important;
          box-shadow: 0 14px 30px rgba(229, 9, 20, .18) !important;
          transform: translateY(-4px);
        }
        html body #root .h2-top,
        html body #root .h2-root.admin-cut .h2-top {
          height: 100% !important;
          min-height: 232px;
          border: 0 !important;
          border-right: 1px solid #f0d7d9 !important;
          background: #b20710 !important;
        }
        html body #root .h2-top::after { background: linear-gradient(135deg, rgba(229, 9, 20, .58), rgba(0, 0, 0, .12)) !important; }
        html body #root .h2-top img { filter: saturate(.88) contrast(1.05) !important; }
        html body #root .h2-status,
        html body #root .h2-root.admin-cut .h2-status {
          top: 10px !important;
          right: 10px !important;
          bottom: auto !important;
          background: #ffffff !important;
          border-color: #ffffff !important;
          color: #b20710 !important;
          border-radius: 999px !important;
        }
        html body #root .h2-body,
        html body #root .h2-root.admin-cut .h2-body {
          display: grid;
          align-content: start;
          gap: 7px;
          padding: 16px 18px !important;
        }
        html body #root .h2-pill { background: #fff6f6 !important; border-color: #f2c7ca !important; color: #a70a12 !important; }
        html body #root .h2-name { margin-top: 1px !important; color: #202124 !important; font-size: 22px !important; font-weight: 700 !important; }
        html body #root :is(.h2-address, .h2-desc) { color: #5d5d5d !important; }
        html body #root .h2-desc { min-height: 0 !important; }
        html body #root .h2-stats-mini { margin-top: 1px; gap: 5px; }
        html body #root .h2-mini { background: #fff8f8 !important; border-color: #f2dbdc !important; border-radius: 8px !important; }
        html body #root .h2-mini :is(.v, .l) { color: #202124 !important; }
        html body #root .h2-actions { margin-top: 2px; }
        html body #root .h2-btn.main,
        html body #root .h2-btn.assign {
          background: #e50914 !important;
          border-color: #e50914 !important;
          border-radius: 8px !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root .h2-btn:not(.main):not(.assign) {
          background: #fff6f6 !important;
          border-color: #e50914 !important;
          border-radius: 8px !important;
          color: #b20710 !important;
        }
        html body #root .h2-btn:hover { background: #b20710 !important; border-color: #b20710 !important; color: #ffffff !important; }

        @media (max-width: 1100px) {
          html body #root .h2-grid.h2-grid,
          html body #root .h2-root.admin-cut .h2-grid.h2-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 620px) {
          html body #root .h2-card.h2-card,
          html body #root .h2-root.admin-cut .h2-card.h2-card { grid-template-columns: 1fr; }
          html body #root .h2-top,
          html body #root .h2-root.admin-cut .h2-top {
            min-height: 154px;
            height: 154px !important;
            border-right: 0 !important;
            border-bottom: 1px solid #f0d7d9 !important;
          }
        }

        /* Keep the hospital view inside the white and #f0f0f0 application system. */
        html body #root .h2-card.h2-card,
        html body #root .h2-root.admin-cut .h2-card.h2-card {
          background: #ffffff !important;
          border-color: #dedede !important;
          box-shadow: none !important;
        }
        html body #root .h2-card.h2-card:hover { background: #ffffff !important; border-color: #bdbdbd !important; box-shadow: none !important; }
        html body #root :is(.h2-top, .h2-root.admin-cut .h2-top) { background: #f0f0f0 !important; border-color: #dedede !important; }
        html body #root .h2-top::after { background: linear-gradient(135deg, rgba(0, 0, 0, .10), transparent 68%) !important; }
        html body #root :is(.h2-status, .h2-root.admin-cut .h2-status) { background: #ffffff !important; border-color: #dedede !important; color: #111111 !important; }
        html body #root :is(.h2-pill, .h2-mini) { background: #f0f0f0 !important; border-color: #dedede !important; color: #111111 !important; }
        html body #root .h2-mini :is(.v, .l) { color: #111111 !important; }
        html body #root :is(.h2-btn, .h2-btn.main, .h2-btn.assign) {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root :is(.h2-btn, .h2-btn.main, .h2-btn.assign):hover { background: #2d2d2d !important; border-color: #2d2d2d !important; color: #ffffff !important; }

        /* Hospital cards use the same stable green and yellow treatment as fleet cards. */
        html body #root .h2-card.h2-card,
        html body #root .h2-card.h2-card:hover { background: #ffffff !important; border-color: rgba(18, 111, 30, .22) !important; box-shadow: none !important; transform: none !important; }
        html body #root .h2-card.h2-card:hover :is(.h2-mini, .h2-btn) { border-color: #f59a23 !important; }
        html body #root :is(.h2-pill, .h2-mini) { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
        html body #root .h2-mini :is(.v, .l) { color: #111111 !important; }
        html body #root :is(.h2-btn, .h2-btn.main, .h2-btn.assign),
        html body #root :is(.h2-btn, .h2-btn.main, .h2-btn.assign):hover { background: #126f1e !important; border-color: #126f1e !important; color: #ffffff !important; box-shadow: none !important; transform: none !important; }
        html body #root .h2-btn.icon,
        html body #root .h2-btn.icon:hover { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
        html body #root .h2-mini.tone-red,
        html body #root .h2-mini.tone-red:hover { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
        html body #root .h2-mini.tone-red :is(.v, .l) { color: #111111 !important; }
        /* Hospital cards keep green borders, yellow actions, and even spacing. */
        html body #root#root .h2-card.h2-card,
        html body #root#root .h2-card.h2-card:hover {
          background: #ffffff !important;
          border-color: #126f1e !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root .h2-card.h2-card:hover { background: #f4fbf4 !important; }
        html body #root#root .h2-top::after { background: linear-gradient(180deg, rgba(245, 154, 35, .48), rgba(245, 154, 35, .08)) !important; }
        html body #root#root .h2-top img { filter: sepia(.24) saturate(.92) !important; }
        html body #root#root .h2-body { padding: 18px !important; gap: 10px !important; }
        html body #root#root .h2-desc { margin: 0 !important; line-height: 1.5 !important; }
        html body #root#root .h2-stats-mini { gap: 8px !important; }
        html body #root#root :is(.h2-btn, .h2-btn.main, .h2-btn.assign),
        html body #root#root :is(.h2-btn, .h2-btn.main, .h2-btn.assign):hover:not(:disabled) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root .h2-btn:not(.main):not(.assign),
        html body #root#root .h2-btn:not(.main):not(.assign):hover { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
      `}</style>

      <div className={`h2-root ${isAdmin ? "admin-cut" : ""}`} ref={rootRef}>
        <div className="h2-wrap">
          <div className="h2-head">
            <div className="h2-kicker">Hospital Network</div>
            <h1>Hospitals</h1>
            <p>Real-time bed availability and emergency capacity.</p>
            {assignBookingId && (
              <div className="h2-assign-banner">
                Assign a hospital to #{assignBookingId} to send an immediate notification to the facility
              </div>
            )}
            {reselectForBookingId && (
              <div className="h2-assign-banner" style={{ background: "#fff7ed", border: "1.5px solid #ea580c", color: "#9a3412" }}>
                ⚠️ <strong>Re-select Hospital for Booking #{reselectForBookingId}</strong>: Your previous hospital was unavailable. Choose any available hospital below to immediately transfer your emergency request.
              </div>
            )}
          </div>

          <div className="h2-stats">
            {statsConfig.map((s) => (
              <motion.div className={`h2-stat h2-anim ${s.filled ? "filled" : ""}`} key={s.key} style={{ "--bar": s.accent }} whileHover={{ y: -3 }}>
                <div className="lbl">{s.label}</div>
                <div className="val">{String(getCount(s.key)).padStart(2, "0")}</div>
              </motion.div>
            ))}
          </div>

          <div className="h2-sec">Hospital Overview</div>

          <div className="h2-grid">
            {sortedHospitals.map((h, i) => {
              const statusKey = (h.status || "closed").toLowerCase().replace(/\s+/g, "_");
              const sc = statusConfig[statusKey] || statusConfig.closed;
              const totalBeds = h.total_beds ?? 0;
              const availableBeds = h.available_beds ?? 0;
              const icuBeds = h.icu_beds ?? 0;
              const safeTotalBeds = Math.max(0, Number(totalBeds) || 0);
              const safeAvailableBeds = Math.max(0, Number(availableBeds) || 0);
              const safeIcuBeds = Math.max(0, Number(icuBeds) || 0);
              const availableRatio = safeTotalBeds > 0 ? safeAvailableBeds / safeTotalBeds : 0;
              const totalTone =
                availableRatio <= 0
                  ? "tone-red"
                  : availableRatio <= 0.35
                    ? "tone-yellow"
                    : "tone-green";
              const availableTone =
                safeAvailableBeds === 0
                  ? "tone-red"
                  : safeAvailableBeds <= 5
                    ? "tone-yellow"
                    : "tone-green";
              const icuTone =
                safeIcuBeds === 0
                  ? "tone-red"
                  : safeIcuBeds <= 2
                    ? "tone-yellow"
                    : "tone-green";
              const canAssign = h.is_active && h.status !== "closed" && Number(availableBeds) > 0;
              const pickupDistanceKm = getDistanceToPickup(h);

              return (
                <motion.article className="h2-card h2-anim" key={h.id || i}>
                  <div className="h2-top">
                    <img src={getImage(i)} alt={h.name || "Hospital"} />
                    <div className="h2-status" style={{ color: sc.color, borderColor: sc.border, background: sc.bg }}>{sc.label}</div>
                  </div>

                  <div className="h2-body">
                    <div className="h2-meta">
                      <span className="h2-pill">{h.hospital_type || "General"}</span>
                      <span className="h2-pill">Unit #{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="h2-name">{h.name || "Unnamed Hospital"}</div>
                    <div className="h2-address">{h.address || "No address"}</div>
                    {assignBookingId && (
                      <div className="h2-address" style={{ fontWeight: 700, color: "#111" }}>
                        Distance to pickup: {pickupDistanceKm !== null ? `${pickupDistanceKm.toFixed(1)} km` : "Location unavailable"}
                      </div>
                    )}
                    <div className="h2-desc">
                      Round-the-clock emergency care with live bed visibility and rapid ambulance intake.
                    </div>

                    {(() => {
                      const safeBookedBeds = h.booked_beds ?? Math.max(0, safeTotalBeds - safeAvailableBeds);
                      const docsActive = h.doctors_active ?? 0;
                      const docsTotal = h.doctors_count ?? 0;
                      const nursesActive = h.nurses_active ?? 0;
                      const nursesTotal = h.nurses_count ?? 0;
                      const staffActive = h.staff_active_count ?? 0;
                      const staffDeactive = h.staff_deactive_count ?? 0;

                      return (
                        <>
                          <div className="h2-stats-mini" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "4px" }}>
                            <div className={`h2-mini ${totalTone}`} style={miniToneStyle(totalTone)}>
                              <div className="v">{safeTotalBeds}</div>
                              <div className="l">Total</div>
                            </div>
                            <div className="h2-mini tone-yellow" style={{ background: "#fff59d", border: "1px solid #c7b900", color: "#111111" }}>
                              <div className="v">{safeBookedBeds}</div>
                              <div className="l">Booked</div>
                            </div>
                            <div className={`h2-mini ${availableTone}`} style={miniToneStyle(availableTone)}>
                              <div className="v">{safeAvailableBeds}</div>
                              <div className="l">Available</div>
                            </div>
                            <div className={`h2-mini ${icuTone}`} style={miniToneStyle(icuTone)}>
                              <div className="v">{safeIcuBeds}</div>
                              <div className="l">ICU Beds</div>
                            </div>
                          </div>

                          <div className="h2-staff-bar" style={{ marginTop: "6px", padding: "6px 8px", background: "rgba(0,0,0,0.03)", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.08)", fontSize: "11px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800, marginBottom: "4px", color: "#111" }}>
                              <span>🩺 Doctors: <strong style={{ color: "#166534" }}>{docsActive} Active</strong> / {docsTotal}</span>
                              <span>👩‍⚕️ Nurses: <strong style={{ color: "#166534" }}>{nursesActive} Active</strong> / {nursesTotal}</span>
                            </div>
                            <div style={{ display: "flex", gap: "8px", fontSize: "10px", fontWeight: 700 }}>
                              <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: "100px", border: "1px solid #86efac" }}>
                                🟢 Active Staff: {staffActive}
                              </span>
                              <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: "100px", border: "1px solid #fca5a5" }}>
                                🔴 Deactive Staff: {staffDeactive}
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <div className="h2-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                      {assignBookingId ? (
                        <button
                          className="h2-btn assign"
                          disabled={!canAssign}
                          onClick={() => assignHospitalToBooking(h)}
                        >
                          {canAssign ? `Assign To #${assignBookingId}` : "Not Available"}
                        </button>
                      ) : reselectForBookingId ? (
                        <button
                          className="h2-btn assign"
                          style={{ background: "#16a34a", color: "#fff", borderColor: "#15803d", fontWeight: 800, flex: "1 1 auto" }}
                          disabled={!canAssign}
                          onClick={() => reassignUserHospital(h)}
                        >
                          {canAssign ? `🏥 Transfer to ${h.name}` : "Currently Full"}
                        </button>
                      ) : (
                        <>
                          {isUser && (
                            <button
                              className="h2-btn"
                              style={{
                                background: canAssign ? "#f59a23" : "#f3f4f6",
                                color: canAssign ? "#111111" : "#9ca3af",
                                borderColor: canAssign ? "#d97706" : "#e5e7eb",
                                fontWeight: 850,
                                flex: "1 1 auto",
                                cursor: canAssign ? "pointer" : "not-allowed",
                              }}
                              disabled={!canAssign}
                              onClick={() => {
                                navigate(
                                  `/Ambulances?book=1&hospital_id=${h.id}&hospital_name=${encodeURIComponent(h.name)}`,
                                  { state: { preselectedHospital: h } }
                                );
                              }}
                              title={canAssign ? "Book an ambulance directly for this hospital" : "This hospital currently has no available beds"}
                            >
                              {canAssign ? "🚑 Book for this Hospital" : "Beds Unavailable"}
                            </button>
                          )}
                          <button
                            className="h2-btn main"
                            style={isUser ? { flex: "0 0 auto", padding: "8px 12px" } : { flex: 1 }}
                            onClick={() => {
                              if (isAdmin) {
                                navigate("/HospitalPartnerDetails", { state: { hospitalId: h.id } });
                                return;
                              }
                              handleDirections(h);
                            }}
                          >
                            {isAdmin ? "More Details" : "See More"}
                          </button>
                        </>
                      )}
                      <button className="h2-btn" onClick={() => navigator.clipboard?.writeText(h.address || "")} title="Copy hospital address">📋</button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
