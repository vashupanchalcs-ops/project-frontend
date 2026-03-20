// Pages/Homepage.jsx — Tesla-style premium homepage for USER role
// Admin → Dashboard, Driver → DriverDashboard (handled in App.jsx)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Futuristic city night skyline
const CITY_BG = "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1800&q=85";
export default function UserHome() {
  const navigate = useNavigate();
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals,  setHospitals]  = useState([]);
  const [bookings,   setBookings]   = useState([]);
  const [scroll,     setScroll]     = useState(0);

  const name  = localStorage.getItem("name") || "there";
  const email = localStorage.getItem("user") || "";

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/ambulances/").then(r=>r.json()).then(setAmbulances).catch(()=>{});
    fetch("http://127.0.0.1:8000/api/hospitals/").then(r=>r.json()).then(setHospitals).catch(()=>{});
    fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json())
      .then(d => setBookings(d.filter(b => b.booked_by_email===email||b.booked_by===name).slice(0,3)))
      .catch(()=>{});
  }, []);

  useEffect(() => {
    var onScroll = function() { setScroll(window.scrollY); };
    window.addEventListener("scroll", onScroll);
    return function() { window.removeEventListener("scroll", onScroll); };
  }, []);

  var avail    = ambulances.filter(function(a){ return a.status==="available"; }).length;
  var totalBeds= hospitals.reduce(function(s,h){ return s+(h.available_beds||0); }, 0);
  var active   = bookings.filter(function(b){ return b.status==="confirmed"||b.status==="pending"; }).length;

  var heroOpacity = Math.max(0, 1 - scroll / 400);
  var heroScale   = 1 + scroll * 0.0003;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        /* reset */
        .hp-page { min-height:100vh;background:#fff;font-family:'DM Sans',sans-serif;color:#0a0a0a;overflow-x:hidden;padding-left:200px;padding-top:60px; }
        @media(max-width:767px){ .hp-page{padding-left:0;padding-bottom:72px;} }

        /* ── HERO ── */
        .hp-hero {
          position: relative;
          height: calc(100vh - 60px);
          min-height: 560px;
          display: flex; flex-direction: column;
          align-items: flex-start; justify-content: center;
          overflow: hidden;
        }
        .hp-hero-bg {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0000 50%, #0a0a0a 100%);
          z-index: 0;
        }
        /* Animated subtle grid */
        .hp-hero-bg::after {
          content:'';
          position:absolute;inset:0;
          background-image: linear-gradient(rgba(229,9,20,0.06) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(229,9,20,0.06) 1px, transparent 1px);
          background-size: 80px 80px;
          z-index:1;
        }
        /* Horizontal scan line */
        .hp-hero-bg::before {
          content:'';
          position:absolute;inset:0;
          background: linear-gradient(to bottom,
            transparent 0%, transparent 40%,
            rgba(229,9,20,0.04) 50%, transparent 60%, transparent 100%);
          z-index:1;
        }
        .hp-hero-img {
          position: absolute; inset: 0;
          background-image: url(${CITY_BG});
          background-size: cover; background-position: center bottom;
          opacity: 0.38; z-index: 2;
        }
        /* Red glow bottom-left */
        .hp-hero-glow {
          position: absolute; bottom: -200px; left: -200px;
          width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(229,9,20,0.18) 0%, transparent 70%);
          z-index: 3; pointer-events: none;
        }


        .hp-hero-content {
          position: relative; z-index: 10;
          padding: 0 8% 0 8%;
          max-width: 700px;
        }
        .hp-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 10px; font-weight: 800;
          color: rgba(229,9,20,0.85);
          text-transform: uppercase; letter-spacing: 3px;
          margin-bottom: 20px;
        }
        @keyframes hp-blink{0%,100%{opacity:1}50%{opacity:.2}}
        .hp-hero-dot { width:6px;height:6px;border-radius:50%;background:#E50914;animation:hp-blink 1.6s infinite; }

        .hp-hero-h1 {
          font-size: clamp(42px, 7vw, 88px);
          font-weight: 900;
          color: #fff;
          line-height: 0.92;
          letter-spacing: -2px;
          margin: 0 0 20px;
        }
        .hp-hero-h1 em { color: #E50914; font-style: normal; display: block; }

        .hp-hero-p {
          font-size: clamp(14px, 1.8vw, 18px);
          color: rgba(255,255,255,0.5);
          line-height: 1.65;
          margin: 0 0 36px;
          max-width: 480px;
        }

        .hp-hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        .hp-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #E50914; color: #fff;
          border: none; border-radius: 4px;
          padding: 14px 32px; font-size: 14px; font-weight: 800;
          font-family: inherit; cursor: pointer; letter-spacing: .5px;
          text-transform: uppercase;
          box-shadow: 0 0 40px rgba(229,9,20,0.4);
          transition: background .15s, transform .12s, box-shadow .15s;
        }
        .hp-btn-primary:hover { background:#c8000f;transform:translateY(-2px);box-shadow:0 0 60px rgba(229,9,20,0.55); }
        .hp-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: rgba(255,255,255,0.75);
          border: 1.5px solid rgba(255,255,255,0.25); border-radius: 4px;
          padding: 14px 32px; font-size: 14px; font-weight: 700;
          font-family: inherit; cursor: pointer; letter-spacing: .5px;
          text-transform: uppercase;
          transition: border-color .15s, color .15s, background .15s;
        }
        .hp-btn-secondary:hover { border-color:rgba(255,255,255,0.6);color:#fff;background:rgba(255,255,255,0.06); }

        /* Hero stats row */
        .hp-hero-stats {
          position: absolute; bottom: 0; left: 0; right: 0;
          display: grid; grid-template-columns: repeat(3,1fr);
          z-index: 10; border-top: 1px solid rgba(255,255,255,0.07);
        }
        .hp-hero-stat {
          padding: 24px 8%;
          border-right: 1px solid rgba(255,255,255,0.07);
        }
        .hp-hero-stat:last-child { border-right: none; }
        .hp-hero-stat-val { font-size: clamp(28px,4vw,42px); font-weight:900; color:#fff; letter-spacing:-1px; line-height:1; }
        .hp-hero-stat-val em { color:#E50914;font-style:normal; }
        .hp-hero-stat-lbl { font-size:10px; font-weight:700; color:rgba(255,255,255,0.35); text-transform:uppercase; letter-spacing:2px; margin-top:6px; }

        /* Scroll arrow */
        .hp-scroll-arrow {
          position: absolute; bottom: 100px; right: 8%;
          z-index: 10; display:flex;flex-direction:column;align-items:center;gap:6px;
        }
        .hp-scroll-arrow-line { width:1px;height:50px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,0.3)); }
        @keyframes hp-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
        .hp-scroll-arrow-ic { font-size:16px;color:rgba(255,255,255,0.3);animation:hp-bounce 2s infinite; }

        /* ── SECTION: Quick Actions ── */
        .hp-section { padding: 80px 8%; max-width: 1400px; margin: 0 auto; }
        .hp-section-tag { font-size:9px;font-weight:800;color:#E50914;text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;display:flex;align-items:center;gap:8px; }
        .hp-section-tag::before { content:'';width:28px;height:1px;background:#E50914; }
        .hp-section-h2 { font-size:clamp(28px,4vw,48px);font-weight:900;color:#0a0a0a;letter-spacing:-1px;margin:0 0 8px;line-height:1.05; }
        .hp-section-sub { font-size:15px;color:#6e6e73;margin:0 0 48px;max-width:520px;line-height:1.6; }

        /* Action cards */
        .hp-actions { display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(0,0,0,0.08);border:1px solid rgba(0,0,0,0.08);border-radius:16px;overflow:hidden; }
        .hp-action-card {
          background:#fff; padding:36px 32px;
          cursor:pointer;
          transition:background .18s, transform .18s;
          position:relative; overflow:hidden;
        }
        .hp-action-card:hover { background:#f8f8fa;transform:translateY(-2px); }
        .hp-action-card::before { content:'';position:absolute;top:0;left:0;right:0;height:3px;background:#E50914;opacity:0;transition:opacity .18s; }
        .hp-action-card:hover::before { opacity:1; }
        .hp-action-num { font-size:11px;font-weight:800;color:rgba(0,0,0,0.18);letter-spacing:2px;margin-bottom:20px; }
        .hp-action-ico { font-size:36px;margin-bottom:16px;display:block; }
        .hp-action-title { font-size:20px;font-weight:800;color:#0a0a0a;margin-bottom:8px;letter-spacing:-.4px; }
        .hp-action-desc  { font-size:13px;color:#6e6e73;line-height:1.6; }
        .hp-action-arrow { font-size:18px;color:#E50914;margin-top:24px;display:block;transition:transform .15s; }
        .hp-action-card:hover .hp-action-arrow { transform:translateX(6px); }

        /* ── SECTION: Active Booking ── */
        .hp-active-booking {
          background: linear-gradient(135deg, #0a0a0a, #1a0000);
          margin: 0 8% 0;
          border-radius: 20px;
          padding: 40px 48px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 24px; flex-wrap: wrap;
          position: relative; overflow: hidden;
          max-width: calc(1400px - 16%);
          margin-left: auto; margin-right: auto;
          margin-top: -20px; margin-bottom: 60px;
        }
        .hp-active-booking::before {
          content:'';position:absolute;inset:0;border-radius:20px;
          background:linear-gradient(135deg,rgba(229,9,20,0.15),transparent);
        }
        .hp-ab-left { position:relative;z-index:1; }
        .hp-ab-tag  { font-size:9px;font-weight:800;color:#E50914;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;display:flex;align-items:center;gap:7px; }
        .hp-ab-h    { font-size:24px;font-weight:800;color:#fff;margin:0 0 6px;letter-spacing:-.5px; }
        .hp-ab-sub  { font-size:13px;color:rgba(255,255,255,0.45); }
        .hp-ab-right { position:relative;z-index:1;display:flex;gap:10px;flex-wrap:wrap; }
        .hp-ab-btn  { display:inline-flex;align-items:center;gap:7px;border:none;border-radius:8px;padding:11px 22px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .15s; }
        .hp-ab-btn-p { background:#E50914;color:#fff;box-shadow:0 4px 20px rgba(229,9,20,0.4); }
        .hp-ab-btn-p:hover { background:#c8000f;transform:translateY(-1px); }
        .hp-ab-btn-s { background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.2); }
        .hp-ab-btn-s:hover { background:rgba(255,255,255,0.18);color:#fff; }

        /* ── SECTION: How it works ── */
        .hp-steps { display:grid;grid-template-columns:repeat(3,1fr);gap:48px;position:relative; }
        .hp-steps::before { content:'';position:absolute;top:28px;left:calc(16% + 28px);right:calc(16% + 28px);height:1px;background:linear-gradient(to right,#E50914,rgba(229,9,20,0.2));pointer-events:none; }
        .hp-step-num { width:56px;height:56px;border-radius:50%;background:#E50914;color:#fff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 0 30px rgba(229,9,20,0.3);flex-shrink:0; }
        .hp-step-title { font-size:18px;font-weight:800;color:#0a0a0a;margin-bottom:8px;letter-spacing:-.3px; }
        .hp-step-desc  { font-size:13px;color:#6e6e73;line-height:1.65; }

        /* ── SECTION: Stats full-width dark ── */
        .hp-stats-dark {
          background: #0a0a0a;
          padding: 80px 8%;
        }
        .hp-stats-dark-inner { max-width:1400px;margin:0 auto; }
        .hp-stats-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden;margin-top:48px; }
        .hp-stat-dark { background:#111;padding:36px 28px;text-align:center; }
        .hp-stat-dark-val { font-size:clamp(32px,5vw,52px);font-weight:900;color:#fff;letter-spacing:-2px;line-height:1; }
        .hp-stat-dark-val em { color:#E50914;font-style:normal; }
        .hp-stat-dark-lbl { font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1.5px;margin-top:8px; }

        /* ── FOOTER ── */
        .hp-footer { background:#0a0a0a;padding:48px 8% 32px;border-top:1px solid rgba(255,255,255,0.06); }
        .hp-footer-inner { max-width:1400px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px; }
        .hp-footer-brand { font-size:22px;font-weight:900;color:#fff;letter-spacing:-1px; }
        .hp-footer-brand span { color:#E50914; }
        .hp-footer-links { display:flex;gap:24px;flex-wrap:wrap; }
        .hp-footer-link { font-size:12px;font-weight:600;color:rgba(255,255,255,0.4);cursor:pointer;transition:color .14s; }
        .hp-footer-link:hover { color:rgba(255,255,255,0.8); }
        .hp-footer-copy { width:100%;font-size:11px;color:rgba(255,255,255,0.2);margin-top:24px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.06); }

        /* RESPONSIVE */
        @media(max-width:960px){
          .hp-actions { grid-template-columns:1fr 1fr; }
          .hp-steps   { grid-template-columns:1fr;gap:32px; }
          .hp-steps::before { display:none; }
          .hp-stats-grid { grid-template-columns:repeat(2,1fr); }
          .hp-hero-stats { grid-template-columns:1fr 1fr 1fr; }
        }
        @media(max-width:640px){
          .hp-hero-content { padding:0 6%; }
          .hp-section { padding:60px 6%; }
          .hp-actions { grid-template-columns:1fr; }
          .hp-hero-stats { grid-template-columns:1fr; }
          .hp-hero-stat { border-right:none;border-bottom:1px solid rgba(255,255,255,0.07);padding:16px 6%; }
          .hp-active-booking { padding:28px 24px;margin:0 6% 48px; }
          .hp-stats-grid { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div className="hp-page">

        {/* ── HERO ── */}
        <section className="hp-hero">
          <div className="hp-hero-bg"/>
          <div className="hp-hero-img" style={{ transform: "scale(" + heroScale + ")" }}/>
          <div className="hp-hero-glow"/>


          <div className="hp-hero-content" style={{ opacity: heroOpacity }}>
            <div className="hp-hero-eyebrow">
              <span className="hp-hero-dot"/>
              Emergency Dispatch System
            </div>
            <h1 className="hp-hero-h1">
              Every second
              <em>matters.</em>
            </h1>
            <p className="hp-hero-p">
              Swift, reliable emergency ambulance services across Delhi.
              Book instantly, track in real-time, reach safety faster.
            </p>
            <div className="hp-hero-btns">
              <button className="hp-btn-primary" onClick={function(){navigate("/Ambulances");}}>
                <svg width="13" height="13" viewBox="0 0 10 12" fill="currentColor"><polygon points="0,0 10,6 0,12"/></svg>
                Book Ambulance
              </button>
              <button className="hp-btn-secondary" onClick={function(){navigate("/MyBookings");}}>
                My Bookings
              </button>
            </div>
          </div>

          {/* Stats row at bottom of hero */}
          <div className="hp-hero-stats">
            <div className="hp-hero-stat">
              <div className="hp-hero-stat-val">{avail > 0 ? String(avail).padStart(2,"0") : "—"}<em>+</em></div>
              <div className="hp-hero-stat-lbl">Available Now</div>
            </div>
            <div className="hp-hero-stat">
              <div className="hp-hero-stat-val">{ambulances.length > 0 ? String(ambulances.length).padStart(2,"0") : "—"}</div>
              <div className="hp-hero-stat-lbl">Total Fleet</div>
            </div>
            <div className="hp-hero-stat">
              <div className="hp-hero-stat-val">{totalBeds > 0 ? totalBeds : "—"}</div>
              <div className="hp-hero-stat-lbl">Hospital Beds</div>
            </div>
          </div>

          <div className="hp-scroll-arrow">
            <div className="hp-scroll-arrow-line"/>
            <div className="hp-scroll-arrow-ic">&#8964;</div>
          </div>
        </section>

        {/* ── ACTIVE BOOKING BANNER ── */}
        {active > 0 && (
          <div style={{background:"#f5f5f7",paddingTop:48,paddingBottom:0}}>
            <div className="hp-active-booking">
              <div className="hp-ab-left">
                <div className="hp-ab-tag"><span className="hp-hero-dot"/>Active Booking</div>
                <div className="hp-ab-h">You have {active} active booking{active > 1 ? "s" : ""}</div>
                <div className="hp-ab-sub">Track your ambulance in real-time</div>
              </div>
              <div className="hp-ab-right">
                <button className="hp-ab-btn hp-ab-btn-p" onClick={function(){navigate("/MyBookings");}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Track Now
                </button>
                <button className="hp-ab-btn hp-ab-btn-s" onClick={function(){navigate("/MyBookings");}}>
                  View All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── QUICK ACTIONS ── */}
        <div style={{background:"#f5f5f7",paddingTop: active>0 ? 0 : 60, paddingBottom:60}}>
          <div className="hp-section" style={{paddingTop: active>0 ? 60 : 0}}>
            <div className="hp-section-tag">Services</div>
            <h2 className="hp-section-h2">What can we help with?</h2>
            <p className="hp-section-sub">Everything you need, exactly when you need it.</p>

            <div className="hp-actions">
              {[
                { num:"01", ico:"🚑", title:"Book Ambulance", desc:"Instant ambulance dispatch to your location. Available 24/7 across Delhi.", path:"/Ambulances" },
                { num:"02", ico:"🏥", title:"Find Hospitals",  desc:"Locate nearby hospitals with real-time bed availability and emergency capacity.", path:"/Hospitals" },
                { num:"03", ico:"📋", title:"My Bookings",    desc:"View all your booking history, track live ambulance, and call your driver.", path:"/MyBookings" },
              ].map(function(card, i) {
                return (
                  <div key={i} className="hp-action-card" onClick={function(){navigate(card.path);}}>
                    <div className="hp-action-num">{card.num}</div>
                    <span className="hp-action-ico">{card.ico}</span>
                    <div className="hp-action-title">{card.title}</div>
                    <div className="hp-action-desc">{card.desc}</div>
                    <span className="hp-action-arrow">&#8594;</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div style={{background:"#fff"}}>
          <div className="hp-section">
            <div className="hp-section-tag">Process</div>
            <h2 className="hp-section-h2">How it works</h2>
            <p className="hp-section-sub">Get emergency help in 3 simple steps.</p>

            <div className="hp-steps">
              {[
                { n:"01", title:"Book in Seconds",    desc:"Select an available ambulance and enter your pickup location. Booking confirmed instantly." },
                { n:"02", title:"Track in Real-Time", desc:"Watch your ambulance on the live map. See exact location, ETA, and driver contact." },
                { n:"03", title:"Safe Arrival",       desc:"Ambulance reaches you, takes you to the nearest hospital. All details recorded." },
              ].map(function(step, i) {
                return (
                  <div key={i}>
                    <div className="hp-step-num">{step.n}</div>
                    <div className="hp-step-title">{step.title}</div>
                    <div className="hp-step-desc">{step.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── STATS DARK SECTION ── */}
        <div className="hp-stats-dark">
          <div className="hp-stats-dark-inner">
            <div className="hp-section-tag" style={{color:"rgba(229,9,20,0.7)"}}>Network</div>
            <h2 className="hp-section-h2" style={{color:"#fff"}}>Our coverage</h2>

            <div className="hp-stats-grid">
              {[
                { val:String(ambulances.length || "—"), em:"", lbl:"Ambulances" },
                { val:String(hospitals.length  || "—"), em:"", lbl:"Hospitals" },
                { val:String(avail || "—"),             em:"", lbl:"Available Now" },
                { val:String(totalBeds || "—"),         em:"+",lbl:"Hospital Beds" },
              ].map(function(s, i) {
                return (
                  <div key={i} className="hp-stat-dark">
                    <div className="hp-stat-dark-val">{s.val}<em>{s.em}</em></div>
                    <div className="hp-stat-dark-lbl">{s.lbl}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="hp-footer">
          <div className="hp-footer-inner">
            <div className="hp-footer-brand">Swift<span>Rescue</span></div>
            <div className="hp-footer-links">
              <span className="hp-footer-link" onClick={function(){navigate("/Ambulances");}}>Book</span>
              <span className="hp-footer-link" onClick={function(){navigate("/Hospitals");}}>Hospitals</span>
              <span className="hp-footer-link" onClick={function(){navigate("/MyBookings");}}>My Bookings</span>
            </div>
          </div>
          <div className="hp-footer-copy">
            &copy; 2026 SwiftRescue Emergency Dispatch · Delhi, India
          </div>
        </footer>

      </div>
    </>
  );
}
