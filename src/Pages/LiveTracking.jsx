/**
 * LiveTracking.jsx  →  src/Pages/LiveTracking.jsx
 * Dedicated fullscreen live tracking page (sidebar 4th item for users).
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UserBookingMap from "../Components/UserBookingMap";

const BASE = "http://127.0.0.1:8000";

export default function LiveTracking() {
  const [booking,  setBooking]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [noActive, setNoActive] = useState(false);

  const navigate = useNavigate();
  const email    = localStorage.getItem("user") || "";
  const name     = localStorage.getItem("name") || "";

  const fetchConfirmed = useCallback(async () => {
    try {
      const res  = await fetch(`${BASE}/api/bookings/`);
      const data = await res.json();
      const confirmed = data.find(b =>
        (b.booked_by_email===email || b.user_email===email || b.booked_by===name) &&
        b.status==="confirmed" &&
        b.sent_to_driver
      );
      if (confirmed) { setBooking(confirmed); setNoActive(false); }
      else           { setBooking(null); setNoActive(true); }
    } catch { setNoActive(true); }
    setLoading(false);
  }, [email, name]);

  useEffect(() => {
    fetchConfirmed();
    const t = setInterval(fetchConfirmed, 8000);
    return () => clearInterval(t);
  }, [fetchConfirmed]);

  return (
    <>
      <style>{`
        /* page-root lt-fixed — fills screen after sidebar + topbar */
        .lt-root {
          position: fixed;
          top:    64px;
          left:   64px;
          right:  0;
          bottom: 0;
          background: #f7f7f2;
          display: flex;
          flex-direction: column;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          overflow: hidden;
        }

        /* Top bar */
        .lt-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: #ffffff;
          border-bottom: 1px solid rgba(20,20,20,0.12);
          flex-shrink: 0;
          gap: 12px;
          flex-wrap: wrap;
        }
        .lt-topbar-left  { display:flex; align-items:center; gap:12px; }
        .lt-back-btn {
          width:34px; height:34px;
          background:rgba(229, 9, 20, 0.15);
          border:1px solid rgba(20,20,20,0.12);
          border-radius:50%; color:rgba(17,17,17,0.7);
          cursor:pointer; font-family:inherit;
          display:flex; align-items:center; justify-content:center;
          transition:all 0.15s; flex-shrink:0;
        }
        .lt-back-btn:hover { background:rgba(229, 9, 20, 0.15); color:#111; }
        .lt-title { font-size:16px; font-weight:800; color:#111; }
        .lt-sub   { font-size:11px; color:rgba(17,17,17,0.58); margin-top:2px; }

        @keyframes lt-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }
        .lt-live-dot { width:8px; height:8px; border-radius:50%; background:#00d4aa; flex-shrink:0; animation:lt-pulse 1.5s infinite; box-shadow:0 0 8px rgba(0,212,170,0.7); }

        .lt-mybookings-btn {
          background:rgba(229, 9, 20, 0.15); border:1px solid rgba(20,20,20,0.12); color:#111;
          border-radius:10px; padding:7px 16px; font-size:11px; font-weight:700;
          cursor:pointer; font-family:inherit; transition:background 0.15s; white-space:nowrap;
        }
        .lt-mybookings-btn:hover { background:rgba(229, 9, 20, 0.15); }

        /* Map fills all remaining space */
        .lt-map-wrap { flex:1; position:relative; overflow:hidden; min-height:0; }

        /* Center state */
        .lt-center { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:40px; text-align:center; }
        @keyframes lt-spin { to { transform:rotate(360deg); } }

        /* Mobile */
        @media (max-width:767px) {
          .lt-root   { top:64px; left:0; bottom:60px; }
          .lt-topbar { padding:10px 14px; }
          .lt-title  { font-size:14px; }
        }
        @media (max-width:479px) {
          .lt-topbar { padding:8px 12px; }
        }
      `}</style>

      <div className="lt-root">

        {/* Top Bar */}
        <div className="lt-topbar">
          <div className="lt-topbar-left">
            <button className="lt-back-btn" onClick={()=>navigate("/MyBookings")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
            </button>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {booking && <span className="lt-live-dot"/>}
                <div className="lt-title">🚑 Live Tracking</div>
              </div>
              <div className="lt-sub">
                {booking ? `Booking #${booking.id} · ${booking.ambulance_number||"—"}` : "Koi active booking nahi"}
              </div>
            </div>
          </div>
          <button className="lt-mybookings-btn" onClick={()=>navigate("/MyBookings")}>
            📋 My Bookings
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="lt-center">
            <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,0.08)", borderTop:"3px solid #E50914", borderRadius:"50%", animation:"lt-spin 0.8s linear infinite" }}/>
            <p style={{ color:"rgba(255,255,255,0.35)", fontSize:13 }}>Finding your booking...</p>
          </div>
        )}

        {/* No active booking */}
        {!loading && noActive && (
          <div className="lt-center">
            <div style={{ fontSize:64, opacity:0.2 }}>🚑</div>
            <div style={{ fontSize:18, fontWeight:800, color:"rgba(255,255,255,0.45)" }}>You have no active bookings at the moment</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.22)", maxWidth:300 }}>
              Track your ambulance in real-time once the booking is confirmed
            </div>
            <button
              onClick={()=>navigate("/Ambulances")}
              style={{ marginTop:8, background:"#E50914", color:"#fff", border:"none", borderRadius:12, padding:"11px 24px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(229,9,20,0.35)" }}
            >
              🚑 Ambulance Book Karo
            </button>
          </div>
        )}

        {/* Map */}
        {!loading && booking && (
          <div className="lt-map-wrap">
            <UserBookingMap booking={booking} onClose={()=>navigate("/MyBookings")} embedded />
          </div>
        )}

      </div>
    </>
  );
}
