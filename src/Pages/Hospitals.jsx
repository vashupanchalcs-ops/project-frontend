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

export default function Hospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [assignBooking, setAssignBooking] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  const isAdmin = localStorage.getItem("role") === "admin";
  const assignBookingId = isAdmin ? location.state?.assignBookingId : null;

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/hospitals/")
      .then((r) => r.json())
      .then(setHospitals)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!assignBookingId) {
      setAssignBooking(null);
      return;
    }
    fetch(`http://127.0.0.1:8000/api/bookings/${assignBookingId}/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAssignBooking(data || null))
      .catch(() => setAssignBooking(null));
  }, [assignBookingId]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray(".h2-scroll").forEach((el) => {
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

      gsap.utils.toArray(".h2-top img").forEach((img) => {
        gsap.to(img, {
          yPercent: -10,
          ease: "none",
          scrollTrigger: {
            trigger: img,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        });
      });
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
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/bookings/${assignBookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assign_hospital_id: hospital.id,
          send_hospital_alert: true,
        }),
      });
      if (!res.ok) throw new Error("Assign failed");
      navigate("/Requests", {
        state: { flashMsg: `Hospital assigned: ${hospital.name}. Waiting for hospital approval.` },
      });
    } catch {
      navigate("/Requests", {
        state: { flashMsg: "Hospital assign failed. Try again." },
      });
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

  const sortedHospitals = [...hospitals];
  if (assignBookingId && pickupPoint) {
    sortedHospitals.sort((a, b) => (getDistanceToPickup(a) ?? Infinity) - (getDistanceToPickup(b) ?? Infinity));
  }

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
                <motion.article className="h2-card h2-anim" key={h.id || i} whileHover={{ y: -4 }}>
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

                    <div className="h2-stats-mini">
                      <div className={`h2-mini ${totalTone}`} style={miniToneStyle(totalTone)}>
                        <div className="v">{safeTotalBeds}</div>
                        <div className="l">
                          <span className="i"><BedSingle size={12} strokeWidth={2.4} /></span>
                          Total Beds
                        </div>
                      </div>
                      <div className={`h2-mini ${availableTone}`} style={miniToneStyle(availableTone)}>
                        <div className="v">{safeAvailableBeds}</div>
                        <div className="l">
                          <span className="i"><CheckCircle2 size={12} strokeWidth={2.4} /></span>
                          Available
                        </div>
                      </div>
                      <div className={`h2-mini ${icuTone}`} style={miniToneStyle(icuTone)}>
                        <div className="v">{safeIcuBeds}</div>
                        <div className="l">
                          <span className="i"><HeartPulse size={12} strokeWidth={2.4} /></span>
                          ICU
                        </div>
                      </div>
                    </div>

                    <div className="h2-actions">
                      {assignBookingId ? (
                        <button
                          className="h2-btn assign"
                          disabled={!canAssign}
                          onClick={() => assignHospitalToBooking(h)}
                        >
                          {canAssign ? `Assign To #${assignBookingId}` : "Not Available"}
                        </button>
                      ) : (
                        <button
                          className="h2-btn main"
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
                      )}
                      <button className="h2-btn" onClick={() => navigator.clipboard?.writeText(h.address || "")}>📋</button>
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
