import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const SYSTEM_DESCRIPTION =
  "YiCare is a smart ambulance management system designed to deliver fast and reliable emergency response. It uses real-time tracking, data-driven insights, and efficient coordination between ambulances, hospitals, and patients. The platform reduces response time, improves decision-making, and ensures timely medical assistance—making emergency care smarter, faster, and more effective when every second truly matters.";

export default function Dashboard() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const footerLinks = [
    { label: "About Us", to: "/info/about" },
    { label: "Support", to: "/info/support" },
    { label: "Help Center", to: "/info/help" },
    { label: "Privacy Policy", to: "/info/privacy" },
    { label: "Terms", to: "/info/terms" },
    { label: "Contact", to: "/info/contact" },
  ];
  const adminHighlights = [
    { title: "Live Fleet Broadcast", desc: "Monitor all active units and dispatch velocity from one control stage." },
    { title: "Hospital Approval Pulse", desc: "Review intake readiness across hospitals before final send-to-driver actions." },
    { title: "Unified Booking Timeline", desc: "Track each request from pending to completion with full event visibility." },
    { title: "Escalation Response Deck", desc: "Catch driver requests, reassignments, and critical workflow alerts in real-time." },
  ];

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".ad-hero-anim",
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" }
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <style>{`
        .ad-root {
          min-height: 100vh;
          padding: 64px 0 0 64px;
          background: var(--sr-bg, #f7f7f2);
          color: var(--sr-text, #111111);
          overflow-x: hidden;
          position: relative;
        }
        .ad-wrap {
          max-width: 1380px;
          margin: 0 auto;
          padding: 28px 24px 86px;
          display: grid;
          gap: 18px;
          position: relative;
          z-index: 2;
        }

        .ad-hero {
          position: relative;
          border: 1px solid var(--sr-border, rgba(255,255,255,0.12));
          border-radius: 26px;
          overflow: hidden;
          min-height: 560px;
          background:
            linear-gradient(115deg, rgba(8,8,12,0.9) 2%, rgba(15,8,16,0.76) 52%, rgba(20,8,14,0.88) 100%),
            url("https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=2200&q=80") center/cover no-repeat;
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
          isolation: isolate;
        }
        .ad-hero::before,
        .ad-hero::after {
          content: "";
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          filter: blur(26px);
          pointer-events: none;
          z-index: 0;
          animation: adFloat 9s ease-in-out infinite;
        }
        .ad-hero::before {
          top: -180px;
          right: -100px;
          background: radial-gradient(circle, rgba(214, 232, 0, 0.26) 0%, rgba(214, 232, 0, 0) 70%);
        }
        .ad-hero::after {
          left: -130px;
          bottom: -220px;
          background: radial-gradient(circle, rgba(235, 248, 94, 0.24) 0%, rgba(235, 248, 94, 0) 70%);
          animation-delay: -4.5s;
        }
        @keyframes adFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -18px, 0) scale(1.08); }
        }

        .ad-topnav {
          position: absolute;
          top: 16px;
          left: 20px;
          right: 20px;
          z-index: 3;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .ad-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 100px;
          padding: 7px 14px;
          background: rgba(255,255,255,0.06);
          backdrop-filter: blur(10px);
          font-size: 12px;
          font-weight: 800;
        }

        .ad-content {
          position: relative;
          z-index: 2;
          max-width: 980px;
          padding: 92px 30px 24px;
          display: grid;
          gap: 16px;
        }
        .ad-kicker {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 100px;
          padding: 7px 14px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #101010;
          background: rgba(214, 232, 0, 0.85);
          border: 1px solid rgba(214, 232, 0, 0.95);
        }
        .ad-title {
          margin: 0;
          font-size: clamp(42px, 8vw, 100px);
          line-height: 0.9;
          letter-spacing: -1px;
          font-weight: 900;
          text-transform: uppercase;
          font-family: "Arial Black", "Segoe UI Black", "Trebuchet MS", sans-serif !important;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
        }
        .ad-title span { color: #111111; }

        .ad-sub {
          margin: 0;
          max-width: 840px;
          font-size: clamp(15px, 1.8vw, 26px);
          line-height: 1.48;
          color: rgba(17,17,17,0.78);
        }

        .ad-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 8px;
        }
        .ad-btn {
          border-radius: 12px;
          padding: 12px 16px;
          border: 1px solid rgba(214,232,0,0.62);
          background: rgba(214,232,0,0.2);
          color: #111111;
          font-size: 13px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
        }
        .ad-btn.pri {
          background: linear-gradient(90deg, #d6e800, #e8f35b);
          border-color: transparent;
          box-shadow: 0 12px 30px rgba(214,232,0,0.38);
          color: #111;
        }

        .ad-contact-band {
          background: #f1f1f4;
          color: #18181b;
          border-radius: 22px 22px 0 0;
          padding: 32px 28px;
          border: 1px solid rgba(0,0,0,0.06);
          border-bottom: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          transform: none !important;
          rotate: 0deg !important;
          skew: none !important;
        }
        .ad-contact-band h2 {
          margin: 0;
          font-size: clamp(30px, 4.2vw, 62px);
          line-height: 0.95;
          letter-spacing: -1.2px;
          border-bottom: 2px solid rgba(225, 230, 92, 0.9);
          width: fit-content;
        }
        .ad-contact-badge {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #e4ff00;
          color: #111;
          display: grid;
          place-items: center;
          font-size: 22px;
          font-weight: 900;
          box-shadow: 0 12px 24px rgba(228,255,0,0.35);
        }

        .ad-contact-grid {
          border: 1px solid var(--sr-border, rgba(255,255,255,0.12));
          border-top: none;
          border-radius: 0 0 22px 22px;
          background: #0f0f14;
          display: grid;
          grid-template-columns: 1.15fr 1fr 1fr 1fr;
          gap: 1px;
          overflow: hidden;
          transform: none !important;
          rotate: 0deg !important;
          skew: none !important;
        }
        .ad-insights{
          margin-top: 14px;
          border:1px solid rgba(20,20,20,0.12);
          border-radius:22px;
          overflow:hidden;
          background:#ffffff;
        }
        .ad-insights-head{
          padding:18px 18px 10px;
          border-bottom:1px solid rgba(20,20,20,0.08);
          background:linear-gradient(120deg, rgba(214,232,0,0.24), rgba(214,232,0,0.08));
        }
        .ad-insights-head h3{
          margin:0;
          font-size:clamp(24px,3vw,40px);
          line-height:0.95;
          letter-spacing:-0.5px;
          font-family:Georgia,"Times New Roman",serif;
          color:#111;
        }
        .ad-insights-head p{
          margin:8px 0 0;
          font-size:13px;
          line-height:1.6;
          color:rgba(17,17,17,0.72);
          max-width:760px;
        }
        .ad-insights-grid{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:1px;
          background:rgba(20,20,20,0.08);
        }
        .ad-insight{
          background:linear-gradient(160deg, #ffffff 0%, #fbfce8 100%);
          padding:14px;
          min-height:150px;
          transition: background .18s, transform .18s, border-color .18s, box-shadow .18s;
          border:1px solid transparent;
        }
        .ad-insight:hover{
          background:#ffffff;
          transform:translateY(-2px);
          border-color:rgba(214,232,0,.9);
          box-shadow:0 12px 24px rgba(214,232,0,.22);
        }
        .ad-insight-no{
          width:28px;
          height:28px;
          border-radius:999px;
          background:#d6e800;
          color:#101010;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-size:11px;
          font-weight:900;
        }
        .ad-insight h4{
          margin:10px 0 6px;
          font-size:17px;
          line-height:1.2;
          font-family:Georgia,"Times New Roman",serif;
          color:#111;
        }
        .ad-insight p{
          margin:0;
          font-size:12px;
          line-height:1.6;
          color:rgba(17,17,17,0.7);
        }
        .ad-scroll-reveal {
          transform: none !important;
          rotate: 0deg !important;
          skew: none !important;
        }
        .ad-cell {
          background: #14141b;
          padding: 24px 22px;
          min-height: 190px;
        }
        .ad-c-brand {
          font-size: 36px;
          line-height: 0.96;
          font-weight: 900;
          letter-spacing: -1px;
          margin: 0 0 14px;
        }
        .ad-c-head {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(255,246,242,0.8);
        }
        .ad-c-text {
          margin: 0;
          color: rgba(255,246,242,0.66);
          font-size: 13px;
          line-height: 1.7;
        }
        .ad-c-link {
          display: inline-block;
          margin-top: 10px;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .ad-link-list{
          margin-top:10px;
          display:grid;
          gap:6px;
        }
        .ad-link-btn{
          border:none;
          background:transparent;
          padding:0;
          margin:0;
          text-align:left;
          font-family:inherit;
          font-size:12px;
          font-weight:700;
          color:#fff;
          text-decoration:underline;
          text-underline-offset:3px;
          cursor:pointer;
        }

        @media (max-width: 1100px) {
          .ad-contact-grid { grid-template-columns: 1fr 1fr; }
          .ad-insights-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 767px) {
          .ad-root { padding-left: 0; padding-bottom: 74px; }
          .ad-wrap { padding: 14px 12px 86px; }
          .ad-hero { min-height: 620px; border-radius: 18px; }
          .ad-topnav { left: 12px; right: 12px; top: 10px; }
          .ad-content { padding: 80px 16px 16px; }
          .ad-contact-band { border-radius: 16px 16px 0 0; padding: 20px 14px; }
          .ad-contact-grid { border-radius: 0 0 16px 16px; grid-template-columns: 1fr; }
          .ad-insights-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="ad-root" ref={rootRef}>
        <div className="ad-wrap">
          <section className="ad-hero">
            <div className="ad-topnav">
              <div className="ad-pill ad-hero-anim">YICARE</div>
              <div className="ad-pill ad-hero-anim">Admin Control Panel</div>
            </div>

            <div className="ad-content">
              <div className="ad-kicker ad-hero-anim">Emergency Command Platform</div>
              <h1 className="ad-title dash-brand ad-hero-anim">YICARE</h1>
              <p className="ad-sub ad-hero-anim">{SYSTEM_DESCRIPTION}</p>

              <div className="ad-cta ad-hero-anim">
                <motion.button className="ad-btn pri" whileHover={{ y: -2 }} onClick={() => navigate("/Analytics")}>
                  Open Analytics
                </motion.button>
                <motion.button className="ad-btn" whileHover={{ y: -2 }} onClick={() => navigate("/LiveMap")}>
                  Manage Live Map
                </motion.button>
                <motion.button className="ad-btn" whileHover={{ y: -2 }} onClick={() => navigate("/Requests")}>
                  Review Requests
                </motion.button>
              </div>
            </div>
          </section>

          <section className="ad-scroll-reveal">
            <div className="ad-insights">
              <div className="ad-insights-head">
                <h3>Trending Control Insights</h3>
                <p>Podcast-style intelligence cards for live dispatch operations and emergency command decisions.</p>
              </div>
              <div className="ad-insights-grid">
                {adminHighlights.map((item, idx) => (
                  <article key={item.title} className="ad-insight">
                    <span className="ad-insight-no">{String(idx + 1).padStart(2, "0")}</span>
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="ad-scroll-reveal">
            <div className="ad-contact-band">
              <h2>Contact us</h2>
              <div className="ad-contact-badge">→</div>
            </div>

            <div className="ad-contact-grid">
              <motion.article className="ad-cell" whileHover={{ y: -3 }}>
                <h3 className="ad-c-brand">SwiftRescue<br/>Command</h3>
                <p className="ad-c-text">Emergency network operations and city-level dispatch orchestration.</p>
              </motion.article>

              <motion.article className="ad-cell" whileHover={{ y: -3 }}>
                <h4 className="ad-c-head">Delhi Control</h4>
                <p className="ad-c-text">
                  ops@swiftrescue.in<br/>
                  Emergency Call: 8882128534<br/>
                  Unit 306, Emergency Wing<br/>
                  New Delhi, India
                </p>
                <span className="ad-c-link" onClick={() => navigate("/LiveMap")}>Open Live Map ↗</span>
              </motion.article>

              <motion.article className="ad-cell" whileHover={{ y: -3 }}>
                <h4 className="ad-c-head">Hospital Sync Desk</h4>
                <p className="ad-c-text">
                  hospitals@swiftrescue.in<br/>
                  +91 9899 7949 999<br/>
                  Bed availability sync<br/>
                  ICU emergency routing
                </p>
                <span className="ad-c-link" onClick={() => navigate("/Hospitals")}>View Hospitals ↗</span>
              </motion.article>

              <motion.article className="ad-cell" whileHover={{ y: -3 }}>
                <h4 className="ad-c-head">Need smarter response?</h4>
                <p className="ad-c-text">
                  Review request pipeline, live fleet health, and response analytics from one control surface.
                </p>
                <span className="ad-c-link" onClick={() => navigate("/Requests")}>Open Requests ↗</span><br/>
                <span className="ad-c-link" onClick={() => navigate("/Analytics")}>Open Analytics ↗</span>
                <div className="ad-link-list">
                  {footerLinks.map((link) => (
                    <button key={link.label} className="ad-link-btn" onClick={() => navigate(link.to)}>
                      {link.label}
                    </button>
                  ))}
                </div>
              </motion.article>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
