import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const BASE = "http://127.0.0.1:8000";

export default function UserHome() {
  const navigate = useNavigate();
  const rootRef = useRef(null);

  const [ambulances, setAmbulances] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [myBookings, setMyBookings] = useState([]);

  const name = localStorage.getItem("name") || "User";
  const email = localStorage.getItem("user") || "";

  useEffect(() => {
    fetch(`${BASE}/api/ambulances/`)
      .then((r) => r.json())
      .then(setAmbulances)
      .catch(() => {});

    fetch(`${BASE}/api/hospitals/`)
      .then((r) => r.json())
      .then(setHospitals)
      .catch(() => {});

    fetch(`${BASE}/api/bookings/`)
      .then((r) => r.json())
      .then((d) =>
        setMyBookings(d.filter((b) => b.booked_by_email === email || b.booked_by === name))
      )
      .catch(() => {});
  }, [email, name]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".uh-hero-reveal",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: "power3.out" }
      );

      gsap.utils.toArray(".uh-scroll-reveal").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 26, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      gsap.fromTo(
        ".uh-how-progress",
        { scaleX: 0, transformOrigin: "left center" },
        {
          scaleX: 1,
          duration: 1.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".uh-how",
            start: "top 80%",
            end: "bottom 45%",
            scrub: true,
          },
        }
      );

      gsap.fromTo(
        ".uh-how-step",
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.16,
          scrollTrigger: {
            trigger: ".uh-how-steps",
            start: "top 85%",
          },
        }
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const availableNow = ambulances.filter((a) => a.status === "available").length;
  const totalBeds = hospitals.reduce((sum, h) => sum + (h.available_beds || 0), 0);
  const activeBookings = myBookings.filter(
    (b) => b.status === "Pending" || b.status === "Confirmed"
  ).length;
  const highlightCards = [
    { title: "Live Dispatch Stories", desc: "Track real emergency journeys with status transitions from booking to hospital handover." },
    { title: "Fastest Response Zones", desc: "See high-performance city zones where available ambulances respond fastest." },
    { title: "Hospital Readiness Pulse", desc: "Monitor intake approvals and facility readiness before destination finalization." },
    { title: "Care Timeline Visibility", desc: "Every booking carries clear milestones so families stay informed in real-time." },
  ];
  const footerLinks = [
    { label: "About Us", to: "/info/about" },
    { label: "Support", to: "/info/support" },
    { label: "Help Center", to: "/info/help" },
    { label: "Privacy Policy", to: "/info/privacy" },
    { label: "Terms", to: "/info/terms" },
    { label: "Contact", to: "/info/contact" },
  ];

  return (
    <>
      <style>{`
        .uh-root {
          min-height: 100vh;
          background: transparent;
          color: #000000;
          padding-top: 64px;
          padding-left: 64px;
          font-family: "Trebuchet MS", "Segoe UI", Tahoma, sans-serif;
        }
        .uh-wrap {
          max-width: 1520px;
          margin: 0 auto;
          padding: 28px 24px 88px;
        }

        .uh-hero {
          border: 1px solid #1f1f1f;
          border-radius: 16px;
          background: #0a0a0a;
          padding: 34px 32px;
          box-shadow: none;
        }
        .uh-kicker {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #ffffff;
          margin-bottom: 10px;
        }
        .uh-title {
          margin: 0;
          font-size: clamp(34px, 6vw, 76px);
          line-height: 0.95;
          letter-spacing: -1px;
          font-family: Georgia, "Times New Roman", serif;
          color: #000000;
        }
        .uh-title span { color: #000000; }
        .uh-sub {
          margin: 18px 0 0;
          max-width: 760px;
          font-size: clamp(14px, 1.5vw, 18px);
          color: #333333;
          line-height: 1.65;
        }
        .uh-actions {
          margin-top: 24px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .uh-btn {
          border: 1px solid #1f1f1f;
          border-radius: 999px;
          padding: 12px 20px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: none;
          font-family: inherit;
        }
        .uh-btn:hover {
          transform: none;
          box-shadow: none;
        }
        .uh-btn.primary {
          background: #ffffff;
          color: #000000;
          border-color: #ffffff;
        }
        .uh-btn.secondary {
          background: #1c1c1c;
          color: #ffffff;
          border: 1px solid #333333;
        }

        .uh-stats {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .uh-stat {
          border: 1px solid #1f1f1f;
          border-radius: 12px;
          background: #0a0a0a;
          padding: 14px 16px;
        }
        .uh-stat-val {
          font-size: 32px;
          font-weight: 900;
          line-height: 1;
          color: #ffffff;
          letter-spacing: -0.8px;
        }
        .uh-stat-lbl {
          font-size: 11px;
          color: #cccccc;
          font-weight: 700;
          margin-top: 4px;
        }

        .uh-grid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .uh-trending {
          margin-top: 24px;
          border: 1px solid #1f1f1f;
          border-radius: 16px;
          background: #0a0a0a;
          padding: 24px;
        }
        .uh-trending-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .uh-trending-title {
          margin: 0;
          font-size: clamp(28px, 4vw, 48px);
          letter-spacing: -0.8px;
          font-family: Georgia, "Times New Roman", serif;
          color: #ffffff;
        }
        .uh-trending-sub {
          margin: 0;
          font-size: 13px;
          color: #cccccc;
          max-width: 440px;
        }
        .uh-trending-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .uh-trend-card {
          border: 1px solid #1f1f1f;
          border-radius: 12px;
          background: #0a0a0a;
          padding: 14px;
        }
        .uh-trend-no {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
          background: #ffffff;
          color: #000000;
        }
        .uh-trend-card h4 {
          margin: 8px 0 5px;
          font-size: 16px;
          line-height: 1.2;
          letter-spacing: -0.2px;
          font-family: Georgia, "Times New Roman", serif;
          color: #ffffff;
        }
        .uh-trend-card p {
          margin: 0;
          font-size: 12px;
          line-height: 1.55;
          color: #cccccc;
        }
        .uh-card {
          background: #0a0a0a;
          border: 1px solid #1f1f1f;
          border-radius: 16px;
          overflow: hidden;
          transition: none;
        }
        .uh-card:hover {
          transform: none !important;
          border-color: #333333 !important;
          box-shadow: none !important;
        }
        .uh-card-top {
          padding: 24px 24px 14px;
          border-bottom: 1px solid #1f1f1f;
          background: #0a0a0a;
        }
        .uh-card-tag {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #ffffff;
        }
        .uh-card-title {
          margin-top: 8px;
          font-size: clamp(24px, 3vw, 42px);
          line-height: 0.98;
          letter-spacing: -0.6px;
          font-family: Georgia, "Times New Roman", serif;
          color: #ffffff;
        }
        .uh-card-body {
          padding: 16px 24px 24px;
          background: #0a0a0a;
        }
        .uh-card-desc {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #cccccc;
        }
        .uh-card-meta {
          margin-top: 12px;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 12px;
          color: #cccccc;
          font-weight: 600;
        }
        .uh-card-cta {
          margin-top: 14px;
          border: none;
          border-radius: 8px;
          background: #ffffff;
          color: #000000;
          padding: 11px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
        }

        .uh-footer {
          margin-top: 24px;
          border: 1px solid #1f1f1f;
          border-radius: 16px;
          background: #0a0a0a;
          padding: 28px 24px;
        }
        .uh-footer-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .uh-footer-title {
          margin: 0;
          font-size: clamp(36px, 6vw, 74px);
          line-height: 0.9;
          letter-spacing: -1px;
          font-family: Georgia, "Times New Roman", serif;
          color: #ffffff;
        }
        .uh-footer-btn {
          width: 56px;
          height: 56px;
          border: none;
          border-radius: 50%;
          background: #ffffff;
          color: #000000;
          font-size: 22px;
          cursor: pointer;
        }
        .uh-footer-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1fr 1fr;
          gap: 18px;
          border-top: 1px solid #1f1f1f;
          padding-top: 18px;
        }
        .uh-foot-col h4 {
          margin: 0 0 8px;
          font-size: 15px;
          letter-spacing: 0.2px;
          font-weight: 800;
          color: #ffffff;
        }
        .uh-foot-col p,
        .uh-foot-col li {
          margin: 0 0 6px;
          font-size: 14px;
          color: #cccccc;
          line-height: 1.55;
        }
        .uh-foot-col ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .uh-foot-link {
          display: inline-flex;
          border: none;
          background: transparent;
          padding: 0;
          margin: 0 0 8px;
          font-family: inherit;
          font-size: 14px;
          color: #cccccc;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .uh-foot-link:hover {
          color: #ffffff;
        }

        .uh-how {
          margin-top: 22px;
          border: 1px solid #1f1f1f;
          border-radius: 16px;
          background: #0a0a0a;
          padding: 24px;
          overflow: hidden;
        }
        .uh-how-head {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 12px;
          flex-wrap: wrap;
        }
        .uh-how-kicker {
          font-size: 11px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          font-weight: 800;
          color: #ffffff;
        }
        .uh-how-title {
          margin: 4px 0 0;
          font-size: clamp(30px, 5vw, 56px);
          letter-spacing: -0.8px;
          line-height: 0.95;
          font-family: Georgia, "Times New Roman", serif;
          color: #ffffff;
        }
        .uh-how-sub {
          margin: 0;
          max-width: 460px;
          font-size: 14px;
          line-height: 1.6;
          color: #cccccc;
        }
        .uh-how-track {
          margin-top: 16px;
          width: 100%;
          height: 3px;
          border-radius: 999px;
          background: #1f1f1f;
          overflow: hidden;
        }
        .uh-how-progress {
          width: 100%;
          height: 100%;
          background: #ffffff;
        }
        .uh-how-steps {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .uh-how-step {
          border: 1px solid #1f1f1f;
          border-radius: 12px;
          background: #0a0a0a;
          padding: 14px;
          min-height: 136px;
        }
        .uh-how-no {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #ffffff;
          color: #000000;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
        }
        .uh-how-step h4 {
          margin: 10px 0 6px;
          font-size: 19px;
          line-height: 1.1;
          letter-spacing: -0.3px;
          font-family: Georgia, "Times New Roman", serif;
        }
        .uh-how-step p {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(16, 16, 16, 0.7);
        }

        @media (max-width: 1023px) {
          .uh-root { padding-left: 64px; }
          .uh-wrap { padding: 20px 16px 84px; }
          .uh-grid { grid-template-columns: 1fr; }
          .uh-trending-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .uh-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .uh-how-steps { grid-template-columns: 1fr; }
        }
        @media (max-width: 767px) {
          .uh-root {
            padding-left: 0;
            padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));
          }
          .uh-wrap {
            padding-bottom: calc(132px + env(safe-area-inset-bottom, 0px));
          }
          .uh-stats { grid-template-columns: 1fr 1fr; }
          .uh-trending-grid { grid-template-columns: 1fr; }
          .uh-footer-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .uh-stats { grid-template-columns: 1fr; }
          .uh-hero, .uh-footer { padding: 18px 14px; }
          .uh-card-top, .uh-card-body { padding-left: 14px; padding-right: 14px; }
          .uh-footer { margin-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>

      <div className="uh-root" ref={rootRef}>
        <div className="uh-wrap">
          <section className="uh-hero">
            <div className="uh-kicker uh-hero-reveal">YiCare Public Response Network</div>
            <h1 className="uh-title uh-hero-reveal">
              Rapid City Care
              <br />
              <span>When Every Minute Counts.</span>
            </h1>
            <p className="uh-sub uh-hero-reveal">
              Welcome, {name}. Our dispatch agency coordinates ambulance routes and hospital
              readiness so your emergency request reaches the right team without delay.
            </p>
            <div className="uh-actions uh-hero-reveal">
              <button className="uh-btn primary" onClick={() => navigate("/Ambulances")}>
                Book Ambulance
              </button>
              <button className="uh-btn secondary" onClick={() => navigate("/MyBookings")}>
                My Bookings
              </button>
            </div>
          </section>

          <section className="uh-stats uh-scroll-reveal">
            <div className="uh-stat">
              <div className="uh-stat-val">{String(availableNow || 0).padStart(2, "0")}</div>
              <div className="uh-stat-lbl">Available Ambulances</div>
            </div>
            <div className="uh-stat">
              <div className="uh-stat-val">{activeBookings}</div>
              <div className="uh-stat-lbl">Active Bookings</div>
            </div>
            <div className="uh-stat">
              <div className="uh-stat-val">{totalBeds || 0}</div>
              <div className="uh-stat-lbl">Hospital Beds Tracked</div>
            </div>
          </section>

          <section className="uh-grid">
            <article className="uh-card uh-scroll-reveal">
              <div className="uh-card-top">
                <div className="uh-card-tag">Emergency Service</div>
                <div className="uh-card-title">Book Ambulance</div>
              </div>
              <div className="uh-card-body">
                <p className="uh-card-desc">
                  Immediate booking for available city ambulances with driver details, pickup
                  confirmation, and live response updates.
                </p>
                <div className="uh-card-meta">
                  <span>24x7 Dispatch</span>
                  <span>{availableNow} Units Free</span>
                </div>
                <button className="uh-card-cta" onClick={() => navigate("/Ambulances")}>
                  Open Ambulance Panel
                </button>
              </div>
            </article>

            <article className="uh-card uh-scroll-reveal">
              <div className="uh-card-top">
                <div className="uh-card-tag">Medical Network</div>
                <div className="uh-card-title">Hospital Directory</div>
              </div>
              <div className="uh-card-body">
                <p className="uh-card-desc">
                  Check partnered hospitals with live bed count, status, and emergency intake
                  readiness before final destination selection.
                </p>
                <div className="uh-card-meta">
                  <span>{hospitals.length} Hospitals</span>
                  <span>{totalBeds} Beds Visible</span>
                </div>
                <button className="uh-card-cta" onClick={() => navigate("/Hospitals")}>
                  View Hospitals
                </button>
              </div>
            </article>
          </section>

          <section className="uh-trending uh-scroll-reveal">
            <div className="uh-trending-head">
              <h3 className="uh-trending-title">Trending Emergency Insights</h3>
              <p className="uh-trending-sub">
                Real-time response themes generated from active fleet, booking, and hospital coordination patterns.
              </p>
            </div>
            <div className="uh-trending-grid">
              {highlightCards.map((item, idx) => (
                <article key={item.title} className="uh-trend-card">
                  <span className="uh-trend-no">{String(idx + 1).padStart(2, "0")}</span>
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <footer className="uh-footer uh-scroll-reveal">
            <div className="uh-footer-head">
              <h2 className="uh-footer-title">About Us</h2>
              <button className="uh-footer-btn" onClick={() => navigate("/MyBookings")}>
                →
              </button>
            </div>
            <div className="uh-footer-grid">
              <div className="uh-foot-col">
                <h4>YiCare Command</h4>
                <p>
                  City-level emergency dispatch orchestration focused on faster ambulance movement,
                  smart routing, and reliable hospital coordination.
                </p>
              </div>
              <div className="uh-foot-col">
                <h4>Delhi Control</h4>
                <p>ops@yicare.in</p>
                <p>Emergency Call: 8882128534</p>
                <p>Emergency Wing, New Delhi</p>
              </div>
              <div className="uh-foot-col">
                <h4>Hospital Sync Desk</h4>
                <p>hospitals@yicare.in</p>
                <p>Live bed availability sync</p>
                <p>ICU emergency routing support</p>
              </div>
              <div className="uh-foot-col">
                <h4>Core Features</h4>
                <ul>
                  {footerLinks.map((link) => (
                    <li key={link.label}>
                      <button className="uh-foot-link" onClick={() => navigate(link.to)}>
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </footer>

          <section className="uh-how uh-scroll-reveal">
            <div className="uh-how-head">
              <div>
                <div className="uh-how-kicker">Process</div>
                <h3 className="uh-how-title">How It Works</h3>
              </div>
              <p className="uh-how-sub">
                The end-to-end dispatch workflow, spanning from the initial request to the hospital handover, is designed for maximum transparency, speed, and continuous oversight
              </p>
            </div>
            <div className="uh-how-track">
              <div className="uh-how-progress" />
            </div>
            <div className="uh-how-steps">
              <article className="uh-how-step">
                <span className="uh-how-no">01</span>
                <h4>Request Raised</h4>
                <p>
                  The system processes the user's pickup information, allowing the control room to shortlist the nearest available units in real-time.
                </p>
              </article>
              <article className="uh-how-step">
                <span className="uh-how-no">02</span>
                <h4>Dispatch + Route</h4>
                <p>
                  Following the Admin's assignment of the unit and medical facility, the driver receives dynamic, live-traffic route updates to ensure the fastest arrival
                </p>
              </article>
              <article className="uh-how-step">
                <span className="uh-how-no">03</span>
                <h4>Care Handover</h4>
                <p>
                  The system transmits real-time patient reports to the facility in advance, facilitating an instant transition to care upon arrival.
                </p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
