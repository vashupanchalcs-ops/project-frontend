// Pages/Homepage.jsx — Tesla-style premium homepage for USER role
// Admin → Dashboard, Driver → DriverDashboard (handled in App.jsx)
import { useState, useEffect } from "react";
import { useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Stethoscope medical hero background
const CITY_BG = "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=2200&q=88";
export default function UserHome() {
  gsap.registerPlugin(ScrollTrigger);
  const pageRef = useRef(null);
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

  useLayoutEffect(() => {
    if (!pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".hp-hero-eyebrow, .hp-hero-h1, .hp-hero-p, .hp-hero-btns", {
        y: 28,
        autoAlpha: 0,
        duration: 0.85,
        stagger: 0.12,
        ease: "power3.out",
      });
      gsap.from(".hp-hero-stat", {
        y: 20,
        autoAlpha: 0,
        duration: 0.65,
        stagger: 0.08,
        delay: 0.2,
        ease: "power2.out",
      });
      gsap.from(".hp-social-item", {
        x: -18,
        autoAlpha: 0,
        duration: 0.55,
        stagger: 0.08,
        delay: 0.12,
        ease: "power2.out",
      });
      gsap.from(".hp-hero-horizon", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 0.9,
        delay: 0.18,
        ease: "power2.out",
      });
      gsap.utils.toArray(".hp-section, .hp-active-booking, .hp-stats-dark, .hp-footer").forEach((el) => {
        gsap.from(el, {
          y: 36,
          autoAlpha: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        });
      });

      gsap.utils.toArray(".hp-action-card").forEach((el, i) => {
        gsap.from(el, {
          x: i % 2 === 0 ? -64 : 64,
          autoAlpha: 0,
          duration: 0.82,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 86%",
            toggleActions: "play none none reverse",
          },
        });
      });

      gsap.from(".hp-steps-progress", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".hp-steps",
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      gsap.utils.toArray(".hp-step-card").forEach((el, i) => {
        gsap.from(el, {
          x: i % 2 === 0 ? -72 : 72,
          y: 24,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 84%",
            toggleActions: "play none none reverse",
          },
        });
      });

      gsap.from(".hp-step-num", {
        scale: 0.6,
        rotate: -14,
        autoAlpha: 0,
        duration: 0.52,
        stagger: 0.14,
        ease: "back.out(1.8)",
        scrollTrigger: {
          trigger: ".hp-steps",
          start: "top 84%",
          toggleActions: "play none none reverse",
        },
      });
    }, pageRef);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        /* reset */
        .hp-page {
          min-height:100vh;
          position:relative;
          background:
            radial-gradient(circle at 15% 0%, rgba(255,102,46,0.18) 0%, transparent 32%),
            radial-gradient(circle at 85% 10%, rgba(255,145,65,0.16) 0%, transparent 35%),
            linear-gradient(160deg,#120912 0%,#1b0d16 48%,#220e12 100%);
          font-family:'DM Sans',sans-serif;
          color:#f7ece8;
          overflow-x:clip;
          margin-left:var(--sb-w);
          width:calc(100vw - var(--sb-w));
          padding-top:60px;
        }
        .hp-page::before{
          content:"";
          position:fixed;
          inset:60px 0 0 var(--sb-w);
          pointer-events:none;
          opacity:.22;
          background-image:radial-gradient(circle, rgba(255,255,255,.45) 1px, transparent 1px);
          background-size:84px 84px;
          z-index:0;
        }
        .hp-page > *{position:relative;z-index:1;}
        @media(max-width:767px){
          .hp-page{
            margin-left:0;
            width:100vw;
            padding-bottom:72px;
          }
          .hp-page::before{inset:60px 0 0 0;}
        }

        /* ── HERO ── */
        .hp-hero {
          position: relative;
          height: calc(100vh - 60px);
          min-height: 560px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          overflow: hidden;
          border-top:1px solid rgba(255,255,255,0.08);
          border-bottom:1px solid rgba(255,255,255,0.08);
        }
        .hp-hero-bg {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #0d0c12 0%, #1a0710 50%, #120a10 100%);
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
          background-size: cover; background-position: center center;
          opacity: 0.52; z-index: 2;
          filter:saturate(1.1) contrast(1.02);
        }
        .hp-hero-vignette{
          position:absolute;
          inset:0;
          z-index:3;
          background:
            linear-gradient(180deg, rgba(3,10,22,0.28) 0%, rgba(3,10,22,0) 24%, rgba(10,12,20,0.56) 100%),
            linear-gradient(90deg, rgba(13,5,10,0.62) 0%, rgba(13,5,10,0.2) 34%, rgba(13,5,10,0.58) 100%);
        }
        .hp-hero-horizon{
          position:absolute;
          left:0;right:0;top:47%;
          height:2px;
          z-index:4;
          background:linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.18) 100%);
          box-shadow:0 0 35px rgba(124,208,255,0.18);
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
          padding: 0 clamp(18px, 4vw, 56px);
          max-width: 980px;
          width: 100%;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .hp-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 10px; font-weight: 800;
          color: rgba(247,61,72,0.92);
          text-transform: uppercase; letter-spacing: 3px;
          margin-bottom: 20px;
          text-shadow:0 0 14px rgba(247,61,72,0.34);
          justify-content:center;
        }
        @keyframes hp-blink{0%,100%{opacity:1}50%{opacity:.2}}
        .hp-hero-dot { width:6px;height:6px;border-radius:50%;background:#E50914;animation:hp-blink 1.6s infinite; }

        .hp-hero-h1 {
          font-size: clamp(42px, 7vw, 88px);
          font-weight: 900;
          color: #fff6f2;
          line-height: 0.92;
          letter-spacing: -2px;
          margin: 0 0 20px;
          text-shadow:
            0 14px 34px rgba(0,0,0,0.5),
            0 2px 0 rgba(255,255,255,0.06);
        }
        .hp-hero-h1 em {
          color: #ff1232;
          font-style: normal;
          display: block;
          text-shadow:
            0 0 26px rgba(255,18,50,0.45),
            0 12px 22px rgba(0,0,0,0.48);
        }

        .hp-hero-p {
          font-size: clamp(14px, 1.8vw, 18px);
          color: rgba(255,255,255,0.66);
          line-height: 1.65;
          margin: 0 0 36px;
          max-width: 760px;
        }

        .hp-hero-btns { display: flex; gap: 12px; flex-wrap: wrap; justify-content:center; }
        .hp-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #E50914; color: #fff;
          border: none; border-radius: 10px;
          padding: 14px 32px; font-size: 14px; font-weight: 800;
          font-family: inherit; cursor: pointer; letter-spacing: .5px;
          text-transform: uppercase;
          box-shadow: 0 10px 28px rgba(229,9,20,0.38);
          transition: background .15s, transform .12s, box-shadow .15s;
        }
        .hp-btn-primary:hover { background:#c8000f;transform:translateY(-2px);box-shadow:0 0 60px rgba(229,9,20,0.55); }
        .hp-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: rgba(255,255,255,0.75);
          border: 1.5px solid rgba(255,255,255,0.3); border-radius: 10px;
          padding: 14px 32px; font-size: 14px; font-weight: 700;
          font-family: inherit; cursor: pointer; letter-spacing: .5px;
          text-transform: uppercase;
          transition: border-color .15s, color .15s, background .15s;
        }
        .hp-btn-secondary:hover { border-color:rgba(255,255,255,0.7);color:#fff;background:rgba(255,255,255,0.12); }

        /* Hero stats row */
        .hp-hero-stats {
          position: absolute; bottom: 0; left: 0; right: 0;
          display: grid; grid-template-columns: repeat(3,1fr);
          z-index: 10; border-top: 1px solid rgba(255,255,255,0.14);
          background:linear-gradient(180deg, rgba(15,10,16,0.05), rgba(15,10,16,0.35));
        }
        .hp-hero-stat {
          padding: 24px 8%;
          border-right: 1px solid rgba(255,255,255,0.07);
        }
        .hp-hero-stat:last-child { border-right: none; }
        .hp-hero-stat-val { font-size: clamp(28px,4vw,42px); font-weight:900; color:#fff; letter-spacing:-1px; line-height:1; }
        .hp-hero-stat-val em { color:#E50914;font-style:normal; }
        .hp-hero-stat-lbl { font-size:10px; font-weight:700; color:rgba(255,255,255,0.45); text-transform:uppercase; letter-spacing:2px; margin-top:6px; }

        .hp-social-rail{
          position:absolute;
          left:18px;
          top:50%;
          transform:translateY(-50%);
          z-index:12;
          display:none;
          flex-direction:column;
          gap:22px;
          pointer-events:none;
        }
        .hp-social-item{
          writing-mode:vertical-rl;
          transform:rotate(180deg);
          font-size:10px;
          font-weight:700;
          letter-spacing:2px;
          color:rgba(255,255,255,0.6);
          text-transform:uppercase;
        }

        /* Scroll arrow */
        .hp-scroll-arrow {
          position: absolute; bottom: 100px; right: 8%;
          z-index: 10; display:flex;flex-direction:column;align-items:center;gap:6px;
        }
        .hp-scroll-arrow-line { width:1px;height:50px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,0.3)); }
        @keyframes hp-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
        .hp-scroll-arrow-ic { font-size:16px;color:rgba(255,255,255,0.3);animation:hp-bounce 2s infinite; }

        /* ── SECTION: Quick Actions ── */
        .hp-section { padding: 88px clamp(18px,3vw,48px); max-width: none; margin: 0; width: 100%; }
        .hp-section-tag { font-size:9px;font-weight:800;color:#e32332;text-transform:uppercase;letter-spacing:3px;margin-bottom:16px;display:flex;align-items:center;gap:8px; }
        .hp-section-tag::before { content:'';width:28px;height:1px;background:#E50914; }
        .hp-section-h2 { font-size:clamp(34px,4.8vw,62px);font-weight:900;color:#f9f4f2;letter-spacing:-1.3px;margin:0 0 10px;line-height:1.04; }
        .hp-section-sub { font-size:15px;color:rgba(249,244,242,0.66);margin:0 0 54px;max-width:560px;line-height:1.6; }
        .hp-section.hp-process-shell{
          margin:0 clamp(18px,3vw,48px);
          width:auto;
          padding:54px clamp(22px,3vw,40px) 42px;
          background:
            radial-gradient(circle at 12% -16%, rgba(255,112,64,0.26) 0%, transparent 36%),
            radial-gradient(circle at 86% 120%, rgba(102,57,255,0.18) 0%, transparent 44%),
            linear-gradient(145deg, rgba(31,10,26,0.98) 0%, rgba(17,9,20,0.98) 100%);
          border:1px solid rgba(255,203,182,0.18);
          border-radius:28px;
          box-shadow:
            0 16px 44px rgba(0,0,0,0.38),
            inset 0 1px 0 rgba(255,255,255,0.05);
          overflow:hidden;
        }
        .hp-process-shell .hp-section-h2{color:#fff3ec;}
        .hp-process-shell .hp-section-sub{color:rgba(255,233,223,0.72);}
        .hp-process-shell .hp-section-tag{color:#ff4d5f;}
        .hp-process-shell .hp-section-tag::before{background:#ff4d5f;}

        /* Action cards */
        .hp-actions {
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:1px;
          background:rgba(24,24,28,0.12);
          border:1px solid rgba(24,24,28,0.12);
          border-radius:26px;
          overflow:hidden;
        }
        .hp-action-card {
          background:rgba(255,255,255,0.02);
          padding:44px 40px;
          cursor:pointer;
          transition:background .18s, transform .18s, color .18s;
          position:relative; overflow:hidden;
          border-right:1px solid rgba(255,255,255,0.08);
        }
        .hp-action-card:hover { background:rgba(255,255,255,0.05);transform:translateY(-2px); }
        .hp-action-card::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:#e32332;opacity:0;transition:opacity .18s; }
        .hp-action-card:hover::before { opacity:1; }
        .hp-action-num { font-size:12px;font-weight:800;color:rgba(255,255,255,0.26);letter-spacing:2px;margin-bottom:30px; }
        .hp-action-ico { font-size:42px;margin-bottom:22px;display:block; }
        .hp-action-title { font-size:42px;font-weight:800;color:#fff6f2;margin-bottom:12px;letter-spacing:-.5px;line-height:1.12; }
        .hp-action-desc  { font-size:15px;color:rgba(255,255,255,0.66);line-height:1.64;max-width:92%; }
        .hp-action-arrow { font-size:26px;color:#e32332;margin-top:30px;display:block;transition:transform .15s; }
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
          max-width: none;
          margin-left: clamp(18px,3vw,48px);
          margin-right: clamp(18px,3vw,48px);
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
        .hp-steps {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:48px;
          position:relative;
          padding:0 28px;
        }
        .hp-steps-progress{
          position:absolute;
          top:28px;
          left:56px;
          right:56px;
          height:1px;
          background:linear-gradient(to right,#ff2945,rgba(255,117,91,0.45));
          transform-origin:left center;
        }
        .hp-step-card{position:relative;min-width:0;}
        .hp-step-num { width:56px;height:56px;border-radius:50%;background:#E50914;color:#fff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 0 30px rgba(229,9,20,0.3);flex-shrink:0; }
        .hp-step-title { font-size:18px;font-weight:800;color:#fff4ee;margin-bottom:8px;letter-spacing:-.3px; }
        .hp-step-desc  { font-size:13px;color:rgba(255,226,214,0.74);line-height:1.65; }

        /* ── SECTION: Stats full-width dark ── */
        .hp-stats-dark {
          background:
            radial-gradient(circle at 12% -20%, rgba(255,112,64,0.22) 0%, transparent 32%),
            radial-gradient(circle at 86% 120%, rgba(100,58,255,0.14) 0%, transparent 42%),
            linear-gradient(165deg, #0f0b16 0%, #130c1f 48%, #0e0a14 100%);
          padding: 80px 8%;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .hp-stats-dark-inner { max-width:1400px;margin:0 auto; }
        .hp-stats-grid {
          display:grid;
          grid-template-columns:repeat(4,1fr);
          gap:10px;
          background:transparent;
          border:none;
          border-radius:20px;
          overflow:visible;
          margin-top:48px;
        }
        .hp-stat-dark {
          background:linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
          border:1px solid rgba(255,215,194,0.14);
          backdrop-filter: blur(8px);
          border-radius:16px;
          padding:36px 28px;
          text-align:center;
          box-shadow: 0 12px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .hp-stat-dark-val { font-size:clamp(32px,5vw,52px);font-weight:900;color:#fff8f4;letter-spacing:-2px;line-height:1; }
        .hp-stat-dark-val em { color:#E50914;font-style:normal; }
        .hp-stat-dark-lbl { font-size:11px;font-weight:700;color:rgba(255,231,219,0.66);text-transform:uppercase;letter-spacing:1.5px;margin-top:8px; }

        /* ── FOOTER ── */
        .hp-footer {
          background:
            radial-gradient(circle at 18% 0%, rgba(255,88,74,0.16) 0%, transparent 36%),
            radial-gradient(circle at 86% 100%, rgba(96,62,255,0.12) 0%, transparent 38%),
            linear-gradient(180deg, rgba(18,12,24,0.98) 0%, rgba(8,8,12,1) 100%);
          padding:56px 8% 34px;
          border-top:1px solid rgba(255,188,160,0.16);
        }
        .hp-footer-inner { max-width:1400px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px; }
        .hp-footer-brand {
          font-size:40px;
          font-weight:900;
          color:#fff7f2;
          letter-spacing:-1.3px;
          line-height:1;
          text-shadow:0 8px 24px rgba(0,0,0,0.35);
        }
        .hp-footer-brand span {
          color:#ff2344;
          text-shadow:0 0 18px rgba(255,35,68,0.35);
        }
        .hp-footer-links { display:flex;gap:24px;flex-wrap:wrap; }
        .hp-footer-link {
          font-size:15px;
          font-weight:700;
          color:rgba(255,236,226,0.72);
          cursor:pointer;
          transition:color .14s, transform .14s;
        }
        .hp-footer-link:hover {
          color:#fff;
          transform:translateY(-1px);
        }
        .hp-footer-copy {
          width:100%;
          font-size:12px;
          color:rgba(255,222,205,0.52);
          margin-top:26px;
          padding-top:24px;
          border-top:1px solid rgba(255,188,160,0.16);
        }

        /* RESPONSIVE */
        @media(max-width:1120px){
          .hp-action-title { font-size:32px; }
        }
        @media(max-width:960px){
          .hp-actions { grid-template-columns:1fr 1fr; }
          .hp-steps   { grid-template-columns:1fr;gap:32px;padding:0; }
          .hp-steps-progress { display:none; }
          .hp-stats-grid { grid-template-columns:repeat(2,1fr); }
          .hp-hero-stats { grid-template-columns:1fr 1fr 1fr; }
        }
        @media(max-width:640px){
          .hp-hero-content { padding:0 6%; }
          .hp-section { padding:60px 6%; }
          .hp-section.hp-process-shell{margin:0 6%;padding:36px 18px 30px;border-radius:22px;}
          .hp-actions { grid-template-columns:1fr; border-radius:20px; }
          .hp-action-card { padding:30px 24px; }
          .hp-action-title { font-size:30px; }
          .hp-action-num { margin-bottom:16px; }
          .hp-action-ico { margin-bottom:12px; }
          .hp-section-sub { font-size:18px; margin-bottom:28px; }
          .hp-hero-stats { grid-template-columns:1fr; }
          .hp-hero-stat { border-right:none;border-bottom:1px solid rgba(255,255,255,0.07);padding:16px 6%; }
          .hp-social-rail{display:none;}
          .hp-active-booking { padding:28px 24px;margin:0 6% 48px; }
          .hp-stats-grid { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div className="hp-page" ref={pageRef}>

        {/* ── HERO ── */}
        <section className="hp-hero">
          <div className="hp-hero-bg"/>
          <div className="hp-hero-img" style={{ transform: "scale(" + heroScale + ")" }}/>
          <div className="hp-hero-vignette"/>
          <div className="hp-hero-horizon"/>
          <div className="hp-hero-glow"/>

          <div className="hp-social-rail">
            <div className="hp-social-item">Instagram</div>
            <div className="hp-social-item">Twitter</div>
            <div className="hp-social-item">Facebook</div>
          </div>


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
          <div style={{background:"transparent",paddingTop:48,paddingBottom:0}}>
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
        <div style={{background:"transparent",paddingTop: active>0 ? 0 : 60, paddingBottom:60}}>
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
        <div style={{background:"transparent", paddingBottom: 56}}>
          <div className="hp-section hp-process-shell">
            <div className="hp-section-tag">Process</div>
            <h2 className="hp-section-h2">How it works</h2>
            <p className="hp-section-sub">Get emergency help in 3 simple steps.</p>

            <div className="hp-steps">
              <div className="hp-steps-progress"/>
              {[
                { n:"01", title:"Book in Seconds",    desc:"Select an available ambulance and enter your pickup location. Booking confirmed instantly." },
                { n:"02", title:"Track in Real-Time", desc:"Watch your ambulance on the live map. See exact location, ETA, and driver contact." },
                { n:"03", title:"Safe Arrival",       desc:"Ambulance reaches you, takes you to the nearest hospital. All details recorded." },
              ].map(function(step, i) {
                return (
                  <div key={i} className="hp-step-card">
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
