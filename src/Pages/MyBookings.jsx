import React, { useState, useEffect, useCallback } from "react";
import { useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
gsap.registerPlugin(ScrollTrigger);

const Icons = {
  Ambulance: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 10h4"/><path d="M12 8v4"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11h2"/><path d="M19 18h2v-4l-3-3h-4"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>),
  MapPin:    () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>),
  Clock:     () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
  User:      () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  Play:      () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
};

const getStatusConfig = (status, hospital_response, driver_accepted) => {
  if (hospital_response === "not_ready") {
    return { color: "#cf1322", bg: "#fff2f0", border: "#ff4d4f", dot: "#cf1322", pulse: true, label: "Hospital Unavailable" };
  }
  if (driver_accepted) {
    return { color: "#166534", bg: "#dcfce7", border: "#86efac", dot: "#16a34a", pulse: true, label: "Ambulance is ready" };
  }
  switch (status?.toLowerCase()) {
    case "confirmed": return { color:"#00d4aa", bg:"rgba(0,212,170,0.12)", border:"rgba(0,212,170,0.3)",    dot:"#00d4aa", pulse:true,  label:"Confirmed" };
    case "pending":   return { color:"#111111", bg:"#fff3df", border:"#f59a23", dot:"#f59a23", pulse:false, label:"Pending" };
    case "completed": return { color:"rgba(17,17,17,0.58)", bg:"rgba(20,20,20,0.06)", border:"rgba(20,20,20,0.14)", dot:"rgba(17,17,17,0.45)", pulse:false, label:"Completed" };
    case "cancelled":
    case "rejected":  return { color:"#ffffff", bg:"rgba(255, 255, 255, 0.15)", border:"rgba(255, 255, 255, 0.15)", dot:"#ffffff", pulse:false, label:status.charAt(0).toUpperCase()+status.slice(1) };
    default:          return { color:"rgba(17,17,17,0.58)", bg:"rgba(20,20,20,0.06)", border:"rgba(20,20,20,0.14)", dot:"#777", pulse:false, label:status||"Unknown" };
  }
};

const FILTERS = ["all", "confirmed", "pending", "completed", "cancelled"];

export function MyBookings() {
  const rootRef = useRef(null);
  const location = useLocation();
  const email    = localStorage.getItem("user") || "";
  const name     = localStorage.getItem("name") || "";
  const stateBookingId = Number(location.state?.bookingId || 0);

  const cachedBookings = (() => {
    try {
      const list = JSON.parse(sessionStorage.getItem("my_bookings_cache") || "[]");
      if (location.state?.newBooking && !list.some(b => b.id === location.state.newBooking.id)) {
        list.unshift(location.state.newBooking);
      }
      return list;
    } catch {
      return location.state?.newBooking ? [location.state.newBooking] : [];
    }
  })();
  const [bookings, setBookings] = useState(cachedBookings);
  const [loading,  setLoading]  = useState(cachedBookings.length === 0);
  const [filter,   setFilter]   = useState("all");
  const navigate = useNavigate();

  const fetchBookings = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE}/api/bookings/`);
      const data = await res.json();
      const normEmail = (email || "").trim().toLowerCase();
      const normName  = (name || "").trim().toLowerCase();
      const mine = data
        .filter(b => {
          const bEmail = String(b.booked_by_email || b.user_email || "").trim().toLowerCase();
          const bName  = String(b.booked_by || "").trim().toLowerCase();
          return (normEmail && bEmail === normEmail) ||
                 (normName && bName === normName) ||
                 (stateBookingId > 0 && Number(b.id) === stateBookingId);
        })
        .sort((a, b) => b.id - a.id);

      // Keep stateBookingId at top if freshly booked
      if (mine.length > 0) {
        setBookings(mine);
        try { sessionStorage.setItem("my_bookings_cache", JSON.stringify(mine)); } catch {}
      } else if (cachedBookings.length > 0) {
        setBookings(cachedBookings);
      }
      const confirmed = (mine.length > 0 ? mine : cachedBookings).find(b => b.status==="confirmed" && b.sent_to_driver);
      if (confirmed) localStorage.setItem("active_confirmed_booking", JSON.stringify(confirmed));
      else           localStorage.removeItem("active_confirmed_booking");
    } catch {
      if (cachedBookings.length > 0) setBookings(cachedBookings);
    }
    setLoading(false);
  }, [email, name, stateBookingId, cachedBookings]);

  const deleteBooking = async (id) => {
    const ok = window.confirm("Confirm deletion of completed booking?");
    if (!ok) return;
    try {
      await fetch(`${BASE}/api/bookings/${id}/`, { method: "DELETE" });
      fetchBookings();
    } catch {}
  };

  useEffect(() => {
    fetchBookings();
    const t = setInterval(fetchBookings, 8000);
    return () => clearInterval(t);
  }, [fetchBookings]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.set(".mb-reveal-top", { y: 0, opacity: 1, clearProps: "all" });
      gsap.set(".mb-stat", { y: 0, opacity: 1, clearProps: "all" });
      gsap.set(".mb-card", { y: 0, opacity: 1, clearProps: "all" });
    }, rootRef);

    return () => ctx.revert();
  }, [bookings.length]);

  const filtered         = filter==="all" ? bookings : bookings.filter(b=>b.status===filter);
  const activeTrackingBooking =
    bookings.find(b => b.status === "confirmed" && b.driver_accepted) ||
    bookings.find(b => b.status === "confirmed" && b.sent_to_driver) ||
    bookings.find(b => b.is_user_selected_hospital && b.status !== "cancelled" && b.status !== "completed") ||
    bookings.find(b => b.status === "confirmed");
  const confirmedBooking = activeTrackingBooking;
  const goToTracking     = (b) => navigate("/LiveTracking", { state:{ bookingId:b.id } });

  const stats = [
    { label:"TOTAL",     val:bookings.length },
    { label:"ACTIVE",    val:bookings.filter(b=>(b.status==="confirmed" && b.sent_to_driver) || (b.is_user_selected_hospital && b.status!=="cancelled" && b.status!=="completed")).length },
    { label:"PENDING",   val:bookings.filter(b=>b.status==="pending").length },
    { label:"COMPLETED", val:bookings.filter(b=>b.status==="completed").length },
  ];

  return (
    <>
      <style>{`
        @keyframes mb-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }
        @keyframes mb-spin   { to{transform:rotate(360deg)} }

        /* Stats */
        .mb-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
        .mb-stat  {
          background:#ffffff;
          border:1px solid rgba(255, 255, 255, 0.15);
          border-radius:14px;
          padding:20px 20px 18px;
          position:relative;
          overflow:hidden;
          box-shadow:0 8px 22px rgba(255, 255, 255, 0.15);
          transition:border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .mb-stat:hover {
          border-color:rgba(255, 255, 255, 0.15);
          box-shadow:0 14px 30px rgba(255, 255, 255, 0.15);
          transform:translateY(-2px);
        }

        /* Filters */
        .mb-filters { display:flex; flex-wrap:wrap; gap:8px; padding:16px 0 0; border-top:1px solid rgba(20,20,20,0.08); margin-bottom:0; }
        .mb-filter-btn { flex-shrink:0; padding:7px 18px; border-radius:100px; font-size:12px; font-weight:700; font-family:inherit; cursor:pointer; border:1px solid rgba(20,20,20,0.16); background:#fff; color:rgba(17,17,17,0.7); transition:all 0.2s; white-space:nowrap; }
        .mb-filter-btn:hover  { border-color:rgba(20,20,20,0.3); color:#111; }
        .mb-filter-btn.active { background:#ffffff; color:#111; border-color:#ffffff; box-shadow:0 4px 16px rgba(255, 255, 255, 0.15); }

        /* Confirmed banner */
        .mb-banner { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:rgba(0,212,170,0.07); border:1px solid rgba(0,212,170,0.2); border-radius:16px; margin-top:20px; flex-wrap:wrap; gap:10px; cursor:pointer; transition:background 0.15s; }
        .mb-banner:hover { background:rgba(0,212,170,0.13); }

        /* Cards — 2 col desktop, 1 col below 1024px */
        .mb-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin:28px auto 0; width:100%; max-width:1240px; }

        .mb-card {
          background:#ffffff;
          border:1px solid rgba(255, 255, 255, 0.15);
          border-radius:20px;
          overflow:hidden;
          transition:transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          width:100%;
          box-shadow:0 12px 30px rgba(255, 255, 255, 0.15);
        }
        .mb-card:hover {
          transform:translateY(-2px);
          border-color:rgba(255, 255, 255, 0.15);
          box-shadow:0 18px 36px rgba(255, 255, 255, 0.15);
        }
        .mb-card.confirmed-card {
          border-color:rgba(0,212,170,0.35);
          box-shadow:0 14px 34px rgba(0,212,170,0.18);
        }

        .mb-card-header { padding:16px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(20,20,20,0.08); background:#fafbe9; }
        .mb-status-pill { display:inline-flex; align-items:center; gap:6px; font-size:10px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; padding:5px 12px; border-radius:100px; border:1px solid; }
        .mb-status-dot  { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .mb-status-dot.pulse { animation:mb-pulse 1.6s infinite; }

        .mb-card-body  { padding:20px; }
        .mb-amb-strip  { background:rgba(255, 255, 255, 0.15); border:1px solid rgba(20,20,20,0.12); border-radius:14px; padding:14px 16px; display:flex; align-items:center; gap:14px; margin-bottom:18px; }
        .mb-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 12px; }
        .mb-detail-label { font-size:9px; font-weight:700; color:rgba(17,17,17,0.48); text-transform:uppercase; letter-spacing:0.7px; margin-bottom:4px; }
        .mb-detail-value { font-size:13px; color:rgba(17,17,17,0.88); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        .mb-card-footer { padding:14px 20px; background:rgba(255, 255, 255, 0.15); border-top:1px solid rgba(20,20,20,0.08); }
        .mb-track-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; background:#ffffff; color:#111; border:none; border-radius:14px; padding:13px 0; font-size:14px; font-weight:800; font-family:inherit; cursor:pointer; transition:background 0.15s, transform 0.15s; box-shadow:0 4px 20px rgba(255, 255, 255, 0.15); }
        .mb-track-btn:hover { background:#c5d700; transform:translateY(-1px); }
        .mb-track-btn .live-badge { background:#111; color:#ffffff; font-size:9px; font-weight:900; padding:2px 8px; border-radius:100px; }
        .mb-delete-btn {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          background: #fffef2;
          color: #111;
          padding: 12px 0;
          font-size: 13px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }
        .mb-delete-btn:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 10px 20px rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .mb-track-chip {
          margin-left: 8px;
          border: none;
          border-radius: 999px;
          padding: 7px 12px;
          background: #ffffff;
          color: #111;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(255, 255, 255, 0.15);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .mb-track-chip:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(255, 255, 255, 0.15);
        }

        .mb-empty { text-align:center; padding:64px 20px; background:#fff; border:1px dashed rgba(20,20,20,0.16); border-radius:20px; margin-top:20px; }

        /* Responsive */
        @media (max-width:1279px) { .mb-stats { grid-template-columns:repeat(2,1fr); } }
        @media (max-width:1023px) { .mb-grid { grid-template-columns:1fr; gap:16px; } }
        @media (max-width:767px)  {
          .mb-filter-btn { padding:6px 14px; font-size:11px; }
          .mb-detail-grid { grid-template-columns:1fr; gap:12px; }
          .mb-card-body, .mb-card-header, .mb-card-footer { padding-left:14px; padding-right:14px; }
        }
        @media (max-width:479px)  {
          .mb-stats { grid-template-columns:repeat(2,1fr); gap:8px; }
          .mb-filter-btn { padding:5px 12px; font-size:11px; }
        }

        /* Booking cards use stable spacing and a yellow pending state. */
        .mb-filters { gap: 10px; }
        .mb-filter-btn,
        .mb-filter-btn:hover { background: #ffffff; border-color: #f59a23; color: #111111; box-shadow: none; transform: none; }
        .mb-filter-btn.active { background: #f59a23; border-color: #f59a23; color: #111111; box-shadow: none; }
        .mb-card { background: #f4fbf4; border-color: #126f1e; box-shadow: none; transform: none; }
        .mb-card:hover { background: #fff3df; border-color: #f59a23; box-shadow: none; transform: none; }
        .mb-card.pending-card { border-color: #126f1e; }
        .mb-card-header, .mb-card.pending-card .mb-card-header { background: #f4fbf4; }
        .mb-card:hover .mb-card-header { background: #fff3df; }
        .mb-card-body { padding: 20px; }
        .mb-detail-grid { gap: 12px; }
        .mb-detail-item { min-width: 0; padding: 10px; border: 1px solid #f59a23; border-radius: 10px; background: #ffffff; }
        .mb-detail-label { margin-bottom: 5px; color: #666666; }
        .mb-detail-value { line-height: 1.45; white-space: normal; overflow-wrap: anywhere; }
        .mb-track-btn,
        .mb-track-btn:hover { background: #f59a23; color: #111111; box-shadow: none; transform: none; }
        html body #root#root .mb-grid { max-width: 1240px !important; margin-left: auto !important; margin-right: auto !important; }
        html body #root#root .mb-card.completed-card { background: #e8f5e9 !important; border-color: #126f1e !important; border-radius: 20px !important; }
        html body #root#root .mb-card.completed-card:hover { background: #fff3df !important; border-color: #f59a23 !important; }
        html body #root#root .mb-track-btn,
        html body #root#root .mb-track-btn:hover { background: #f59a23 !important; border-color: #f59a23 !important; color: #111111 !important; }
      `}</style>

      <div className="page-root" ref={rootRef}>
        <div className="page-content" style={{ maxWidth: "1520px", width: "100%" }}>

          {/* Header */}
          <div className="page-section-header mb-reveal-top">
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10, fontWeight:700, color:"#111", background:"rgba(255, 255, 255, 0.15)", border:"1px solid rgba(20,20,20,0.14)", borderRadius:100, padding:"4px 14px", letterSpacing:1, textTransform:"uppercase", marginBottom:12 }}>
              🚑 My Bookings
            </div>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#111", margin:"0 0 4px", letterSpacing:-0.5 }}>Booking History</h1>
            <p style={{ fontSize:13, color:"rgba(17,17,17,0.62)", margin:0 }}>Access and track all your ambulance requests through one centralized hub</p>
            {location.state?.flashMsg && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 16px",
                  background: "#dcfce7",
                  border: "1px solid #16a34a",
                  borderRadius: "12px",
                  color: "#166534",
                  fontWeight: 700,
                  fontSize: "13px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>✅ {location.state.flashMsg}</span>
                <button
                  onClick={() => navigate(location.pathname, { replace: true, state: {} })}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#166534" }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mb-stats">
            {stats.map(s=>(
              <div key={s.label} className="mb-stat">
                <div style={{ fontSize:30, fontWeight:900, color:"#111", letterSpacing:-1, lineHeight:1, marginBottom:5 }}>{String(s.val).padStart(2,"0")}</div>
                <div style={{ fontSize:9, fontWeight:700, color:"rgba(17,17,17,0.5)", letterSpacing:1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-filters mb-reveal-top">
            {FILTERS.map(f=>(
              <button key={f} className={`mb-filter-btn ${filter===f?"active":""}`} onClick={()=>setFilter(f)}>
                {f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>

          {/* Confirmed banner */}
          {confirmedBooking && !loading && (
            <div className="mb-banner" onClick={()=>goToTracking(confirmedBooking)}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background: confirmedBooking.driver_accepted ? "#16a34a" : "#00d4aa", display:"inline-block", animation:"mb-pulse 1.6s infinite", boxShadow: confirmedBooking.driver_accepted ? "0 0 8px rgba(22,163,74,0.6)" : "0 0 8px rgba(0,212,170,0.6)" }}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color: confirmedBooking.driver_accepted ? "#166534" : "#00d4aa" }}>
                    {confirmedBooking.driver_accepted
                      ? `🚑 Ambulance is ready — #${confirmedBooking.id}`
                      : confirmedBooking.is_user_selected_hospital
                      ? `🏥 Hospital Booking Active — #${confirmedBooking.id}`
                      : `Booking Confirmed — #${confirmedBooking.id}`}
                  </div>
                  <div style={{ fontSize:11, color:"rgba(17,17,17,0.58)", marginTop:3 }}>
                    {confirmedBooking.driver_accepted
                      ? "Ambulance is ready! Driver has accepted your booking and is en route. Select this card for live tracking."
                      : confirmedBooking.is_user_selected_hospital
                      ? `Booked for ${confirmedBooking.assigned_hospital_name || confirmedBooking.destination || "Hospital"}. Click here to track your route & ambulance live.`
                      : "Your driver is on the way. Select this card for live tracking."}
                  </div>
                </div>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color: confirmedBooking.driver_accepted ? "#166534" : "#00d4aa", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>🗺 Track Now →</div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"64px 0", gap:12 }}>
              <div style={{ width:36, height:36, border:"3px solid rgba(20,20,20,0.1)", borderTop:"3px solid #ffffff", borderRadius:"50%", animation:"mb-spin 0.8s linear infinite" }}/>
              <p style={{ color:"rgba(17,17,17,0.55)", fontSize:13 }}>Loading bookings...</p>
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length===0 && (
            <div className="mb-empty">
              <div style={{ fontSize:48, marginBottom:12, opacity:0.25 }}>📋</div>
              <h3 style={{ fontSize:17, fontWeight:700, color:"rgba(17,17,17,0.7)", marginBottom:6 }}>
                {filter==="all" ? "No bookings available" : `No ${filter} bookings available`}
              </h3>
              <p style={{ fontSize:12, color:"rgba(17,17,17,0.52)" }}>
                {filter==="all" ? "Book via the Ambulances page." : "Adjust filters to view more results."}
              </p>
            </div>
          )}

          {/* Cards */}
          {!loading && filtered.length>0 && (
            <div className="mb-grid">
              {filtered.map(b=>{
                const sc          = getStatusConfig(b.status, b.hospital_response, b.driver_accepted);
                const isConfirmed = b.status==="confirmed";
                const isPending = b.status==="pending";
                const isCompleted = b.status==="completed";
                const canTrack =
                  isConfirmed ||
                  (b.is_user_selected_hospital && b.status !== "cancelled" && b.status !== "rejected") ||
                  b.sent_to_driver ||
                  b.driver_accepted;
                return (
                  <div key={b.id} className={`mb-card ${isConfirmed?"confirmed-card":""} ${isPending?"pending-card":""} ${isCompleted?"completed-card":""}`}>
                    <div className="mb-card-header">
                      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                        {isConfirmed && <span style={{ width:7, height:7, borderRadius:"50%", background:"#00d4aa", display:"inline-block", animation:"mb-pulse 1.6s infinite", boxShadow:"0 0 7px rgba(0,212,170,0.8)" }}/>}
                        <span style={{ fontSize:16, fontWeight:800, color:"#111" }}>Booking <span style={{ color:"rgba(17,17,17,0.35)", fontWeight:500 }}>#{b.id}</span></span>
                        {canTrack && (
                          <button className="mb-track-chip" onClick={() => goToTracking(b)}>
                            Live Track
                          </button>
                        )}
                      </div>
                      <div className="mb-status-pill" style={{ color:sc.color, background:sc.bg, borderColor:sc.border }}>
                        <span className={`mb-status-dot ${sc.pulse?"pulse":""}`} style={{ background:sc.dot }}/>
                        {sc.label}
                      </div>
                    </div>

                    <div className="mb-card-body">
                      {(b.ambulance_number||b.ambulance_id) && (
                        <div className="mb-amb-strip">
                          <div style={{ width:38, height:38, borderRadius:"50%", background:"rgba(255, 255, 255, 0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <Icons.Ambulance/>
                          </div>
                          <div>
                            <div style={{ fontSize:18, fontWeight:900, color:"#111", letterSpacing:1 }}>{b.ambulance_number||`AMB-${b.ambulance_id}`}</div>
                            <div style={{ fontSize:9, color:"rgba(17,17,17,0.45)", letterSpacing:1, textTransform:"uppercase", marginTop:2 }}>Assigned Ambulance</div>
                          </div>
                        </div>
                      )}
                      {b.is_user_selected_hospital && (
                        <div
                          style={{
                            margin: "10px 0 14px",
                            padding: "10px 14px",
                            background: "#eff6ff",
                            border: "1.5px solid #bfdbfe",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "18px" }}>🏥</span>
                            <div>
                              <div style={{ color: "#1d4ed8", fontWeight: 800, fontSize: "12px" }}>
                                User-Selected Hospital Booking
                              </div>
                              <div style={{ color: "#2563eb", fontSize: "11px", marginTop: 1 }}>
                                Route to <strong>{b.assigned_hospital_name || b.destination}</strong> • Live tracking active
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => goToTracking(b)}
                            style={{
                              background: "#2563eb",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              padding: "6px 12px",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            🗺 Track Route
                          </button>
                        </div>
                      )}
                      {b.driver_accepted && (
                        <div
                          style={{
                            margin: "12px 0 16px",
                            padding: "12px 16px",
                            background: "#f0fdf4",
                            border: "1.5px solid #86efac",
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            boxShadow: "0 4px 12px rgba(22,163,74,0.06)",
                          }}
                        >
                          <span style={{ fontSize: "22px", lineHeight: 1 }}>🚑</span>
                          <div>
                            <div style={{ color: "#166534", fontWeight: 900, fontSize: "14px" }}>
                              Ambulance is ready
                            </div>
                            <div style={{ color: "#15803d", fontSize: "11px", marginTop: 2 }}>
                              The assigned driver has accepted your emergency booking and is on the way.
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mb-detail-grid">
                        <DetailItem icon={<Icons.MapPin/>} iconColor="#ffffff"               label="Pickup Location" value={b.pickup_location}/>
                        <DetailItem
                          icon={<Icons.MapPin/>}
                          iconColor="rgba(147,112,219,0.9)"
                          label="Assigned Hospital"
                          value={`${b.assigned_hospital_name || b.destination || "Admin will assign"}${b.is_user_selected_hospital ? " (Your Choice)" : ""}`}
                        />
                        <DetailItem icon={<Icons.User/>}   iconColor="rgba(100,149,237,0.9)" label="Booked By"       value={b.booked_by}/>
                        <DetailItem icon={<Icons.Clock/>}  iconColor="rgba(17,17,17,0.5)" label="Date & Time"     value={b.created_at?new Date(b.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):null}/>
                        <DetailItem
                          icon={<Icons.Clock/>}
                          iconColor={b.driver_accepted ? "#16a34a" : "#0284c7"}
                          label="Driver Status"
                          value={b.driver_accepted ? "Ambulance is ready (Accepted)" : b.sent_to_driver ? "Dispatched to Driver" : "Pending Driver Dispatch"}
                        />
                        <DetailItem
                          icon={<Icons.Clock/>}
                          iconColor={b.hospital_response === "ready" ? "#00a58a" : b.hospital_response === "not_ready" ? "#cf1322" : "#f59a23"}
                          label="Hospital Response"
                          value={b.hospital_response === "ready" ? "Approved / Ready" : b.hospital_response === "not_ready" ? "Rejected (Unavailable)" : "Pending Approval"}
                        />
                        <DetailItem icon={<Icons.Clock/>}  iconColor="#ffffff" label="Response Note" value={b.hospital_response_note || "-"} />
                        <DetailItem icon={<Icons.Clock/>}  iconColor="#00a58a" label="Medical Insurance" value={b.insurance_status || "pending"} />
                        {b.assigned_doctor_names && (
                          <div style={{ gridColumn: "1 / -1", marginTop: 8, padding: "10px 14px", background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, fontSize: 13 }}>
                            <div style={{ color: "#166534", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                              👥 Allocated Care Team: {b.assigned_doctor_names}
                            </div>
                            {b.assigned_doctor_specializations && (
                              <div style={{ color: "#374151", fontSize: 12, marginTop: 3 }}>
                                <b>Specialization:</b> {b.assigned_doctor_specializations}
                              </div>
                            )}
                            {b.assigned_doctor_contacts && (
                              <div style={{ color: "#4b5563", fontSize: 12, marginTop: 2 }}>
                                📞 <b>Direct Contact:</b> {b.assigned_doctor_contacts}
                              </div>
                            )}
                          </div>
                        )}
                        {b.assigned_doctor_names && (
                          <button onClick={() => navigate("/MyCareTeam")} style={{ gridColumn: "1 / -1", marginTop: 8, padding: "9px 12px", border: 0, borderRadius: 8, background: "#087f72", color: "#fff", fontWeight: 800, cursor: "pointer" }}>👥 View allocated team</button>
                        )}
                      </div>
                    </div>
                    {b.hospital_response === "not_ready" && (
                      <div
                        style={{
                          margin: "0 20px 16px",
                          padding: "14px 18px",
                          background: "#fff1f0",
                          border: "1.5px solid #ffa39e",
                          borderRadius: "14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          boxShadow: "0 6px 16px rgba(207,19,34,0.08)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <span style={{ fontSize: "22px", lineHeight: 1 }}>⚠️</span>
                          <div>
                            <div style={{ color: "#cf1322", fontWeight: 900, fontSize: "14px", lineHeight: 1.35 }}>
                              Choose another hospital this hospital is currently unavailable
                            </div>
                            <div style={{ color: "rgba(17,17,17,0.7)", fontSize: "12px", marginTop: 4 }}>
                              {b.assigned_hospital_name ? `${b.assigned_hospital_name} is currently full or unavailable.` : "Selected hospital is currently unavailable."}
                              {b.hospital_response_note ? ` (${b.hospital_response_note})` : ""} Please select another hospital from our network to proceed.
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate("/Hospitals", { state: { reselectForBookingId: b.id } })}
                          style={{
                            padding: "10px 18px",
                            background: "#cf1322",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            alignSelf: "flex-start",
                            boxShadow: "0 4px 12px rgba(207,19,34,0.25)",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#a8071a")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#cf1322")}
                        >
                          🏥 Choose Another Hospital →
                        </button>
                      </div>
                    )}
                    {String(b.insurance_status || "").toLowerCase() === "approved" && (
                      <div style={{ marginTop: 10, border: "1px solid rgba(0,170,120,0.42)", background: "rgba(0,212,170,0.12)", borderRadius: 10, padding: "9px 11px", fontSize: 13, fontWeight: 800, color: "#007a52" }}>
                        Your medical insurance approved.
                      </div>
                    )}

                    {canTrack && (
                      <div className="mb-card-footer">
                        <button className="mb-track-btn" onClick={()=>goToTracking(b)}>
                          <Icons.Play/> Live Tracking <span className="live-badge">LIVE</span>
                        </button>
                      </div>
                    )}
                    {b.status === "completed" && (
                      <div className="mb-card-footer">
                        <button className="mb-delete-btn" onClick={() => deleteBooking(b.id)}>
                          Delete Booking
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

const DetailItem = ({ icon, iconColor, label, value }) => (
  <div className="mb-detail-item" style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
    <div style={{ marginTop:1, color:iconColor, flexShrink:0 }}>{icon}</div>
    <div style={{ flex:1, overflow:"hidden" }}>
      <div className="mb-detail-label">{label}</div>
      <div className="mb-detail-value" title={value||"—"}>{value||"—"}</div>
    </div>
  </div>
);

export default MyBookings;
