import Maps from "../Components/Map";
import AnalyticsCharts from "../Components/AnalyticsCharts";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [bookings,   setBookings]   = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals,  setHospitals]  = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => {
      fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json()).then(setBookings).catch(()=>{});
      fetch("http://127.0.0.1:8000/api/ambulances/").then(r=>r.json()).then(setAmbulances).catch(()=>{});
      fetch("http://127.0.0.1:8000/api/hospitals/").then(r=>r.json()).then(setHospitals).catch(()=>{});
    };
    load();
    const t = setInterval(load, 10000);
    window.addEventListener("new-booking", load);
    return () => { clearInterval(t); window.removeEventListener("new-booking", load); };
  }, []);

  const avail = ambulances.filter(a => a.status === "available").length;
  const pend  = bookings.filter(b => b.status === "pending").length;
  const done  = bookings.filter(b => b.status === "completed").length;
  const beds  = hospitals.reduce((s, h) => s + (h.available_beds || 0), 0);
  const rate  = bookings.length ? Math.round((done / bookings.length) * 100) : 0;

  const stats = [
    { icon:"🚑", val:String(avail).padStart(2,"0"), lbl:"Available",    sub:"Ready units"              },
    { icon:"📋", val:String(pend).padStart(2,"0"),  lbl:"Pending",      sub:"Awaiting confirm"         },
    { icon:"✅", val:`${rate}%`,                    lbl:"Success Rate", sub:`${done}/${bookings.length}`},
    { icon:"🏥", val:String(beds).padStart(2,"0"),  lbl:"Hosp. Beds",   sub:"Available now"            },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        /* ── ROOT — fixed viewport, NO page scroll ── */
        .db-root {
          position: fixed;
          top: 60px;
          left: 200px;
          right: 0;
          bottom: 0;
          background: #f5f5f7;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;   /* no scrollbar on root */
        }
        .db-inner {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 18px 22px 16px;
          gap: 14px;
          min-height: 0;
          overflow: hidden;
        }

        /* HEADER */
        .db-hdr { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0; }
        .db-hdr h1 { font-size:22px;font-weight:800;color:#0a0a0a;letter-spacing:-.5px;margin:0 0 2px; }
        .db-hdr p  { font-size:12px;color:#6e6e73;margin:0; }
        @keyframes db-blink{0%,100%{opacity:1}50%{opacity:.15}}
        .db-live { display:inline-flex;align-items:center;gap:7px;background:rgba(229,9,20,0.07);border:1px solid rgba(229,9,20,0.18);border-radius:100px;padding:5px 14px;font-size:11px;font-weight:700;color:#E50914;letter-spacing:1px;flex-shrink:0; }
        .db-live-dot { width:6px;height:6px;border-radius:50%;background:#E50914;animation:db-blink 1.6s infinite; }

        /* MAIN ROW — map left, 2x2 cards right */
        .db-main {
          display: grid;
          grid-template-columns: 1fr 230px;
          gap: 14px;
          flex: 1;
          min-height: 0;
        }

        /* MAP CARD */
        .db-map-card {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          isolation: isolate;
          min-height: 0;
        }
        .db-map-hdr {
          padding: 11px 14px 0;
          display: flex;align-items:center;justify-content:space-between;
          flex-shrink: 0;
          position: relative;z-index:2;background:#fff;
        }
        .db-map-title { font-size:13px;font-weight:700;color:#0a0a0a;display:flex;align-items:center;gap:6px; }
        .db-map-pill  { font-size:9px;font-weight:800;background:rgba(229,9,20,0.07);color:#E50914;border:1px solid rgba(229,9,20,0.18);border-radius:100px;padding:3px 10px;text-transform:uppercase;letter-spacing:1px; }
        .db-map-body {
          flex: 1;
          margin: 10px 11px 11px;
          border-radius: 9px;
          border: 1px solid rgba(0,0,0,0.06);
          position: relative;
          z-index: 1;
          overflow: hidden;
          min-height: 0;
        }
        .db-map-body .leaflet-container { width:100%!important;height:100%!important;border-radius:9px; }
        .db-map-body .leaflet-pane,
        .db-map-body .leaflet-top,
        .db-map-body .leaflet-bottom { position:absolute!important; }
        .db-map-body .leaflet-popup-pane { z-index:700!important; }
        .db-map-body .leaflet-control     { z-index:800!important; }

        /* 4 STAT CARDS — 2×2 grid */
        .db-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 11px;
        }
        .db-stat {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 13px;
          padding: 14px 15px 12px;
          position: relative;overflow:hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          transition: transform .18s,box-shadow .18s;
          display: flex;flex-direction:column;justify-content:center;
        }
        .db-stat:hover { transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.09); }
        .db-stat-bar { position:absolute;top:0;left:0;right:0;height:3px;background:#E50914;border-radius:13px 13px 0 0; }
        .db-stat-icon { font-size:16px;margin-bottom:6px; }
        .db-stat-val  { font-size:26px;font-weight:800;color:#0a0a0a;letter-spacing:-1px;line-height:1; }
        .db-stat-lbl  { font-size:8px;font-weight:800;color:#a1a1a6;text-transform:uppercase;letter-spacing:1.2px;margin-top:4px; }
        .db-stat-sub  { font-size:9px;color:#a1a1a6;margin-top:2px; }

        /* ANALYTICS — below map row, fixed height */
        .db-analytics {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          overflow: hidden;
          flex-shrink: 0;
          height: 240px;
          display: flex;flex-direction:column;
          position:relative;isolation:isolate;z-index:0;
        }
        .db-analytics-hdr { padding:11px 16px 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
        .db-analytics-title { font-size:13px;font-weight:700;color:#0a0a0a;display:flex;align-items:center;gap:6px; }
        .db-analytics-link  { font-size:11px;font-weight:700;color:#E50914;background:none;border:none;cursor:pointer;font-family:inherit; }
        .db-analytics-link:hover { text-decoration:underline; }
        .db-analytics-body  { flex:1;min-height:0;overflow:hidden;position:relative;z-index:0; }

        /* RESPONSIVE */
        @media(max-width:1100px) { .db-main{grid-template-columns:1fr 200px;} }
        @media(max-width:900px)  {
          .db-main{grid-template-columns:1fr;}
          .db-stats{grid-template-columns:repeat(4,1fr);grid-template-rows:1fr;}
        }
        @media(max-width:767px) {
          .db-root{position:static;min-height:100vh;padding-top:60px;padding-left:0;padding-bottom:72px;}
          .db-inner{padding:12px 11px 16px;overflow:auto;}
          .db-main{grid-template-columns:1fr;}
          .db-map-body{height:240px;flex:none;}
          .db-stats{grid-template-columns:repeat(2,1fr);grid-template-rows:auto;}
          .db-analytics{height:200px;}
          .db-stat-val{font-size:22px;}
        }
        @media(max-width:480px){
          .db-stats{grid-template-columns:repeat(2,1fr);}
          .db-map-body{height:200px;}
        }
      `}</style>

      <div className="db-root">
        <div className="db-inner">

          {/* HEADER */}
          <div className="db-hdr">
            <div>
              <h1>Dashboard Overview</h1>
              <p>Real-time emergency network status</p>
            </div>
            <div className="db-live"><span className="db-live-dot"/> Live</div>
          </div>

          {/* MAIN: map left + 2x2 cards right */}
          <div className="db-main">

            {/* MAP */}
            <div className="db-map-card">
              <div className="db-map-hdr">
                <div className="db-map-title">🗺 Live Fleet Map</div>
                <span className="db-map-pill">{ambulances.length} units</span>
              </div>
              <div className="db-map-body"><Maps /></div>
            </div>

            {/* 2×2 STAT CARDS */}
            <div className="db-stats">
              {stats.map((s, i) => (
                <div key={i} className="db-stat">
                  <div className="db-stat-bar" />
                  <div className="db-stat-icon">{s.icon}</div>
                  <div className="db-stat-val">{s.val}</div>
                  <div className="db-stat-lbl">{s.lbl}</div>
                  <div className="db-stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ANALYTICS BELOW */}
          <div className="db-analytics">
            <div className="db-analytics-hdr">
              <div className="db-analytics-title">📊 Analytics</div>
              <button className="db-analytics-link" onClick={() => navigate("/Reports")}>View Reports →</button>
            </div>
            <div className="db-analytics-body"><AnalyticsCharts /></div>
          </div>

        </div>
      </div>
    </>
  );
}
