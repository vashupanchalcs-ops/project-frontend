import Maps from "../Components/Map";
import AnalyticsCharts from "../Components/AnalyticsCharts";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";

export default function Dashboard() {
  const rootRef = useRef(null);
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

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".db-hdr > *", { y: 20, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: "power3.out" });
      gsap.from(".db-map-card", { x: -24, autoAlpha: 0, duration: 0.8, ease: "power3.out", delay: 0.08 });
      gsap.from(".db-stat", { y: 20, autoAlpha: 0, duration: 0.55, stagger: 0.08, ease: "power2.out", delay: 0.14 });
      gsap.from(".db-analytics", { y: 24, autoAlpha: 0, duration: 0.8, ease: "power3.out", delay: 0.2 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <style>{`
        /* ── ROOT — fixed viewport, NO page scroll ── */
        .db-root {
          position: relative;
          min-height: 100vh;
          padding-top: var(--nav-h);
          padding-left: var(--sb-w);
          background:
            radial-gradient(circle at 12% 10%, var(--sr-bg-grad-a), transparent 34%),
            radial-gradient(circle at 86% 6%, var(--sr-bg-grad-b), transparent 38%),
            var(--sr-bg);
          font-family: var(--font-body);
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          overflow-y: auto;
        }
        .db-inner {
          width: min(100%, 1640px);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          padding: 28px 30px 24px;
          gap: 18px;
        }

        /* HEADER */
        .db-hdr { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0; }
        .db-hdr h1 { font-size:42px;font-weight:700;color:var(--sr-text);letter-spacing:-1px;margin:0 0 4px;font-family:var(--font-display); }
        .db-hdr p  { font-size:15px;color:var(--sr-text-sub);margin:0; }
        @keyframes db-blink{0%,100%{opacity:1}50%{opacity:.15}}
        .db-live { display:inline-flex;align-items:center;gap:7px;background:var(--sr-accent-muted);border:1px solid var(--red-border);border-radius:100px;padding:6px 14px;font-size:11px;font-weight:700;color:var(--sr-accent);letter-spacing:1px;flex-shrink:0; }
        .db-live-dot { width:6px;height:6px;border-radius:50%;background:var(--sr-accent);animation:db-blink 1.6s infinite; }

        /* MAIN ROW — map left, 2x2 cards right */
        .db-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(270px, 22vw);
          gap: 18px;
          min-height: 0;
          align-items: stretch;
          margin-bottom: 16px;
        }

        /* MAP CARD */
        .db-map-card {
          background: color-mix(in srgb, var(--sr-surface) 90%, transparent);
          border: 1px solid var(--sr-border);
          border-radius: 18px;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          isolation: isolate;
          min-height: 0;
          backdrop-filter: blur(8px);
        }
        .db-map-hdr {
          padding: 11px 14px 0;
          display: flex;align-items:center;justify-content:space-between;
          flex-shrink: 0;
          position: relative;z-index:2;background:transparent;
        }
        .db-map-title { font-size:20px;font-weight:700;color:var(--sr-text);display:flex;align-items:center;gap:8px; }
        .db-map-pill  { font-size:9px;font-weight:800;background:var(--sr-accent-muted);color:var(--sr-accent);border:1px solid var(--red-border);border-radius:100px;padding:3px 10px;text-transform:uppercase;letter-spacing:1px; }
        .db-map-body {
          margin: 10px 11px 11px;
          border-radius: 9px;
          border: 1px solid var(--sr-border);
          position: relative;
          z-index: 1;
          overflow: hidden;
          min-height: 420px;
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
          grid-template-rows: repeat(2, minmax(170px, 1fr));
          gap: 12px;
          min-height: 0;
          align-content: stretch;
          transform: translateY(-10px);
        }
        .db-stat {
          background: color-mix(in srgb, var(--sr-surface) 90%, transparent);
          border: 1px solid var(--sr-border);
          border-radius: 16px;
          padding: 14px 15px 12px;
          position: relative;overflow:hidden;
          box-shadow: var(--shadow);
          transition: transform .18s,box-shadow .18s,border-color .18s;
          display: flex;flex-direction:column;justify-content:center;
          min-height: 170px;
          backdrop-filter: blur(8px);
        }
        .db-stat:hover { transform:translateY(-2px);box-shadow:var(--shadow2);border-color:var(--border2); }
        .db-stat-bar { position:absolute;top:0;left:0;right:0;height:3px;background:var(--sr-brand-grad);border-radius:13px 13px 0 0; }
        .db-stat-icon { font-size:16px;margin-bottom:6px; }
        .db-stat-val  { font-size:36px;font-weight:800;color:var(--sr-text);letter-spacing:-1px;line-height:1; }
        .db-stat-lbl  { font-size:11px;font-weight:800;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1.2px;margin-top:6px; }
        .db-stat-sub  { font-size:12px;color:var(--sr-text-muted);margin-top:4px; }

        /* ANALYTICS — below map row, fixed height */
        .db-analytics {
          background: color-mix(in srgb, var(--sr-surface) 90%, transparent);
          border: 1px solid var(--sr-border);
          border-radius: 18px;
          box-shadow: var(--shadow);
          overflow: hidden;
          flex-shrink: 0;
          height: 340px;
          display: flex;flex-direction:column;
          position:relative;isolation:isolate;z-index:0;
          margin-top: 14px;
        }
        .db-analytics-hdr { padding:11px 16px 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
        .db-analytics-title { font-size:13px;font-weight:700;color:var(--sr-text);display:flex;align-items:center;gap:6px; }
        .db-analytics-link  { font-size:11px;font-weight:700;color:var(--sr-accent);background:none;border:none;cursor:pointer;font-family:inherit; }
        .db-analytics-link:hover { text-decoration:underline; }
        .db-analytics-body  { flex:1;min-height:0;overflow:hidden;position:relative;z-index:0; }

        /* RESPONSIVE */
        @media(max-width:1320px) {
          .db-main { grid-template-columns: 1fr 250px; }
          .db-map-body { min-height: 360px; }
        }
        @media(max-width:1180px)  {
          .db-main { grid-template-columns: 1fr; }
          .db-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: 1fr; }
          .db-stat { min-height: 152px; }
        }
        @media(max-width:900px)  {
          .db-main { grid-template-columns: 1fr; }
          .db-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto; transform: translateY(0); }
          .db-map-body { min-height: 340px; }
        }
        @media(max-width:767px) {
          .db-root{padding-left:0;padding-bottom:72px;}
          .db-inner{padding:14px 12px 18px;}
          .db-main{grid-template-columns:1fr;}
          .db-map-body{min-height:260px;}
          .db-stats{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:auto;}
          .db-analytics{height:220px;}
          .db-stat-val{font-size:22px;}
          .db-hdr h1{font-size:30px;}
          .db-hdr p{font-size:13px;}
        }
        @media(max-width:480px){
          .db-stats{grid-template-columns:repeat(2,1fr);}
          .db-map-body{min-height:220px;}
        }
      `}</style>

      <div className="db-root" ref={rootRef}>
        <div className="db-inner">

          {/* HEADER */}
          <div className="db-hdr" data-k72="reveal">
            <div>
              <h1>Dashboard Overview</h1>
              <p>Real-time emergency network status</p>
            </div>
            <div className="db-live"><span className="db-live-dot"/> Live</div>
          </div>

          {/* MAIN: map left + 2x2 cards right */}
          <div className="db-main">

            {/* MAP */}
            <div className="db-map-card" data-k72="reveal">
              <div className="db-map-hdr">
                <div className="db-map-title">🗺 Live Fleet Map</div>
                <span className="db-map-pill">{ambulances.length} units</span>
              </div>
              <div className="db-map-body"><Maps /></div>
            </div>

            {/* 2×2 STAT CARDS */}
            <div className="db-stats" data-k72="reveal">
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
          <div className="db-analytics" data-k72="reveal">
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
