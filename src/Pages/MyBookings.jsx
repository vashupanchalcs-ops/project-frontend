import React, { useState, useEffect, useCallback } from "react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const BASE = "http://127.0.0.1:8000";
gsap.registerPlugin(ScrollTrigger);

const Icons = {
  Ambulance: () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 10h4"/><path d="M12 8v4"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11h2"/><path d="M19 18h2v-4l-3-3h-4"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>),
  MapPin:    () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>),
  Clock:     () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>),
  User:      () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  Play:      () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
};

const getStatusConfig = (status) => {
  switch (status?.toLowerCase()) {
    case "confirmed": return { color:"#00d4aa", bg:"rgba(0,212,170,0.12)", border:"rgba(0,212,170,0.3)",    dot:"#00d4aa", pulse:true,  label:"Confirmed" };
    case "pending":   return { color:"#f7c948", bg:"rgba(247,201,72,0.12)", border:"rgba(247,201,72,0.3)",  dot:"#f7c948", pulse:false, label:"Pending"   };
    case "completed": return { color:"rgba(17,17,17,0.58)", bg:"rgba(20,20,20,0.06)", border:"rgba(20,20,20,0.14)", dot:"rgba(17,17,17,0.45)", pulse:false, label:"Completed" };
    case "cancelled":
    case "rejected":  return { color:"#ffffff", bg:"rgba(255, 255, 255, 0.15)", border:"rgba(255, 255, 255, 0.15)", dot:"#ffffff", pulse:false, label:status.charAt(0).toUpperCase()+status.slice(1) };
    default:          return { color:"rgba(17,17,17,0.58)", bg:"rgba(20,20,20,0.06)", border:"rgba(20,20,20,0.14)", dot:"#777", pulse:false, label:status||"Unknown" };
  }
};

const FILTERS = ["all", "confirmed", "pending", "completed", "cancelled"];

export function MyBookings() {
  const rootRef = useRef(null);
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const navigate = useNavigate();
  const email    = localStorage.getItem("user") || "";
  const name     = localStorage.getItem("name") || "";

  const fetchBookings = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE}/api/bookings/`);
      const data = await res.json();
      const mine = data
        .filter(b => b.booked_by_email===email || b.user_email===email || b.booked_by===name)
        .sort((a, b) => b.id - a.id);
      setBookings(mine);
      const confirmed = mine.find(b => b.status==="confirmed" && b.sent_to_driver);
      if (confirmed) localStorage.setItem("active_confirmed_booking", JSON.stringify(confirmed));
      else           localStorage.removeItem("active_confirmed_booking");
    } catch {}
    setLoading(false);
  }, [email, name]);

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
      gsap.fromTo(
        ".mb-reveal-top",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" }
      );

      gsap.fromTo(
        ".mb-stat",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power2.out", delay: 0.15 }
      );

      gsap.utils.toArray(".mb-card").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 22, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const filtered         = filter==="all" ? bookings : bookings.filter(b=>b.status===filter);
  const confirmedBooking = bookings.find(b=>b.status==="confirmed" && b.sent_to_driver);
  const goToTracking     = (b) => navigate("/LiveTracking", { state:{ bookingId:b.id } });

  const stats = [
    { label:"TOTAL",     val:bookings.length },
    { label:"ACTIVE",    val:bookings.filter(b=>b.status==="confirmed" && b.sent_to_driver).length },
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
        .mb-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin-top:20px; width:100%; }

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
                <span style={{ width:8, height:8, borderRadius:"50%", background:"#00d4aa", display:"inline-block", animation:"mb-pulse 1.6s infinite", boxShadow:"0 0 8px rgba(0,212,170,0.6)" }}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#00d4aa" }}>Booking Confirmed — #{confirmedBooking.id}</div>
                  <div style={{ fontSize:11, color:"rgba(17,17,17,0.58)", marginTop:3 }}>Driver aapki taraf aa raha hai — Live tracking ke liye click karo</div>
                </div>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:"#00d4aa", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>🗺 Track Now →</div>
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
                {filter==="all" ? "No bookings available" : `Koi ${filter} booking nahi`}
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
                const sc          = getStatusConfig(b.status);
                const isConfirmed = b.status==="confirmed";
                return (
                  <div key={b.id} className={`mb-card ${isConfirmed?"confirmed-card":""}`}>
                    <div className="mb-card-header">
                      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                        {isConfirmed && <span style={{ width:7, height:7, borderRadius:"50%", background:"#00d4aa", display:"inline-block", animation:"mb-pulse 1.6s infinite", boxShadow:"0 0 7px rgba(0,212,170,0.8)" }}/>}
                        <span style={{ fontSize:16, fontWeight:800, color:"#111" }}>Booking <span style={{ color:"rgba(17,17,17,0.35)", fontWeight:500 }}>#{b.id}</span></span>
                        {isConfirmed && (
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
                      <div className="mb-detail-grid">
                        <DetailItem icon={<Icons.MapPin/>} iconColor="#ffffff"               label="Pickup Location" value={b.pickup_location}/>
                        <DetailItem icon={<Icons.MapPin/>} iconColor="rgba(147,112,219,0.9)" label="Assigned Hospital" value={b.assigned_hospital_name || b.destination || "Admin will assign"}/>
                        <DetailItem icon={<Icons.User/>}   iconColor="rgba(100,149,237,0.9)" label="Booked By"       value={b.booked_by}/>
                        <DetailItem icon={<Icons.Clock/>}  iconColor="rgba(17,17,17,0.5)" label="Date & Time"     value={b.created_at?new Date(b.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):null}/>
                        <DetailItem icon={<Icons.Clock/>}  iconColor="#00a58a" label="Hospital Response" value={b.hospital_response || "pending"} />
                        <DetailItem icon={<Icons.Clock/>}  iconColor="#ffffff" label="Response Note" value={b.hospital_response_note || "-"} />
                        <DetailItem icon={<Icons.Clock/>}  iconColor="#00a58a" label="Medical Insurance" value={b.insurance_status || "pending"} />
                      </div>
                    </div>
                    {String(b.insurance_status || "").toLowerCase() === "approved" && (
                      <div style={{ marginTop: 10, border: "1px solid rgba(0,170,120,0.42)", background: "rgba(0,212,170,0.12)", borderRadius: 10, padding: "9px 11px", fontSize: 13, fontWeight: 800, color: "#007a52" }}>
                        Your medical insurance approved.
                      </div>
                    )}

                    {isConfirmed && (
                      <div className="mb-card-footer">
                        <button className="mb-track-btn" onClick={()=>goToTracking(b)}>
                          <Icons.Play/> Live Track Karo <span className="live-badge">LIVE</span>
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
  <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
    <div style={{ marginTop:1, color:iconColor, flexShrink:0 }}>{icon}</div>
    <div style={{ flex:1, overflow:"hidden" }}>
      <div className="mb-detail-label">{label}</div>
      <div className="mb-detail-value" title={value||"—"}>{value||"—"}</div>
    </div>
  </div>
);

export default MyBookings;
