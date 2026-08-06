import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const BASE = "http://127.0.0.1:8000";

export default function DriverHome() {
  const navigate = useNavigate();
  const rootRef = useRef(null);

  const driverName = localStorage.getItem("name") || "Driver";
  const driverEmail = localStorage.getItem("user") || "";
  const ambId = parseInt(localStorage.getItem("ambulance_id") || "0");

  const [ambulance, setAmbulance] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/api/ambulances/`)
      .then((r) => r.json())
      .then((list) => setAmbulance(list.find((a) => a.id === ambId) || null))
      .catch(() => {});

    fetch(`${BASE}/api/bookings/`)
      .then((r) => r.json())
      .then((all) =>
        setBookings(
          all
            .filter((b) => b.ambulance_id === ambId || b.driver_contact === (ambulance?.driver_contact || ""))
            .sort((a, b) => b.id - a.id)
        )
      )
      .catch(() => {});

    fetch(`${BASE}/api/hospitals/`)
      .then((r) => r.json())
      .then(setHospitals)
      .catch(() => {});
  }, [ambId, ambulance?.driver_contact]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".dh-reveal",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.08, ease: "power2.out" }
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const activeRuns = bookings.filter((b) => b.status === "confirmed" && b.sent_to_driver && !b.driver_task_completed).length;
  const completed = bookings.filter((b) => b.driver_task_completed || b.status === "completed").length;
  const readyHospitals = hospitals.filter((h) => h.status === "active").length;

  return (
    <>
      <style>{`
        .dh-root {
          min-height: 100vh;
          background: #f7f7f2;
          color: #111;
          padding-top: 64px;
          padding-left: 64px;
          font-family: "Trebuchet MS", "Segoe UI", Tahoma, sans-serif;
        }
        .dh-wrap {
          max-width: 1520px;
          margin: 0 auto;
          padding: 28px 24px 90px;
        }
        .dh-hero {
          border: 1px solid rgba(20,20,20,0.14);
          border-radius: 24px;
          background: linear-gradient(160deg, #ffffff 0%, #fbfce8 100%);
          padding: 34px 32px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .dh-hero:hover {
          transform: translateY(-2px);
          border-color: rgba(214,232,0,0.95);
          box-shadow: 0 18px 36px rgba(214,232,0,0.22), 0 0 0 2px rgba(214,232,0,0.32) inset;
        }
        .dh-kicker {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #6a6f3a;
          margin-bottom: 10px;
        }
        .dh-title {
          margin: 0;
          font-size: clamp(34px, 6vw, 72px);
          line-height: 0.95;
          letter-spacing: -1px;
          font-family: Georgia, "Times New Roman", serif;
        }
        .dh-title span { color: #8c9600; }
        .dh-sub {
          margin-top: 16px;
          max-width: 820px;
          color: rgba(17,17,17,0.72);
          font-size: clamp(14px, 1.5vw, 18px);
          line-height: 1.6;
        }
        .dh-actions {
          margin-top: 22px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .dh-btn {
          border: 1px solid rgba(20,20,20,0.18);
          border-radius: 999px;
          padding: 12px 20px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
          transition: transform .16s, box-shadow .16s;
        }
        .dh-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,0.08); }
        .dh-btn.primary { background: #d6e800; color: #111; border-color: #d6e800; }
        .dh-btn.secondary { background: #fff; color: #111; }
        .dh-stats {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .dh-stat {
          border: 1px solid rgba(20,20,20,0.12);
          border-radius: 14px;
          background: #fff;
          padding: 14px 16px;
          transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
        }
        .dh-stat:hover {
          transform: translateY(-2px);
          border-color: rgba(214,232,0,0.95);
          box-shadow: 0 14px 28px rgba(214,232,0,0.24), 0 0 0 1px rgba(214,232,0,0.28) inset;
        }
        .dh-stat-val {
          font-size: 34px;
          font-weight: 900;
          line-height: 1;
        }
        .dh-stat-lbl {
          margin-top: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(17,17,17,0.52);
        }
        .dh-grid {
          margin-top: 22px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .dh-card {
          background: #fff;
          border: 1px solid rgba(20,20,20,0.12);
          border-radius: 18px;
          padding: 18px 20px;
          transition: transform .16s, box-shadow .16s, border-color .16s;
        }
        .dh-card:hover {
          transform: translateY(-2px);
          border-color: rgba(214,232,0,0.95);
          box-shadow: 0 18px 34px rgba(214,232,0,0.24), 0 0 0 2px rgba(214,232,0,0.34) inset;
        }
        .dh-card-tag {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #8c9600;
        }
        .dh-card h3 {
          margin: 8px 0 8px;
          font-size: 28px;
          font-family: Georgia, "Times New Roman", serif;
          line-height: 1;
        }
        .dh-card p {
          margin: 0;
          color: rgba(17,17,17,0.72);
          font-size: 14px;
          line-height: 1.6;
        }
        .dh-chip-row {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dh-chip {
          border: 1px solid rgba(20,20,20,0.16);
          border-radius: 999px;
          background: #fbfce8;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 700;
        }
        @media (max-width: 1023px) {
          .dh-root { padding-left: 64px; }
          .dh-wrap { padding: 20px 16px 84px; }
          .dh-stats { grid-template-columns: 1fr 1fr; }
          .dh-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 767px) {
          .dh-root { padding-left: 0; padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px)); }
          .dh-wrap { padding-bottom: calc(132px + env(safe-area-inset-bottom, 0px)); }
        }
      `}</style>

      <div className="dh-root" ref={rootRef}>
        <div className="dh-wrap">
          <section className="dh-hero">
            <div className="dh-kicker dh-reveal">YiCare Driver Operations</div>
            <h1 className="dh-title dh-reveal">
              Ready To Move
              <br />
              <span>{driverName}, Your Response Matters.</span>
            </h1>
            <p className="dh-sub dh-reveal">
              Accelerate every second: From instant dispatch and live routing to seamless handovers. Your mission-critical timeline, centralized
            </p>
            <div className="dh-actions dh-reveal">
              <button className="dh-btn primary" onClick={() => navigate("/driver-dashboard?tab=map")}>
                Open Driver Live Map
              </button>
              <button className="dh-btn secondary" onClick={() => navigate("/driver-dashboard?tab=bookings")}>
                View Assigned Bookings
              </button>
            </div>
          </section>

          <section className="dh-stats dh-reveal">
            <div className="dh-stat">
              <div className="dh-stat-val">{activeRuns}</div>
              <div className="dh-stat-lbl">Active Runs</div>
            </div>
            <div className="dh-stat">
              <div className="dh-stat-val">{completed}</div>
              <div className="dh-stat-lbl">Completed Tasks</div>
            </div>
            <div className="dh-stat">
              <div className="dh-stat-val">{readyHospitals}</div>
              <div className="dh-stat-lbl">Ready Hospitals</div>
            </div>
            <div className="dh-stat">
              <div className="dh-stat-val">{ambulance?.ambulance_number ? "01" : "00"}</div>
              <div className="dh-stat-lbl">Ambulance Linked</div>
            </div>
          </section>

          <section className="dh-grid">
            <article className="dh-card dh-reveal">
              <div className="dh-card-tag">Live Dispatch</div>
              <h3>Mission Queue</h3>
              <p>
                Sync live maps with bookings and destinations to execute your route..
              </p>
              <div className="dh-chip-row">
                <span className="dh-chip">Email: {driverEmail || "-"}</span>
                <span className="dh-chip">Unit: {ambulance?.ambulance_number || "Not linked"}</span>
              </div>
            </article>
            <article className="dh-card dh-reveal">
              <div className="dh-card-tag">Clinical Handover</div>
              <h3>Patient Workflow</h3>
              <p>
               Submit the patient form to trigger a pre-arrival alert for the hospital and admin, ensuring bed readiness.
              </p>
              <div className="dh-chip-row">
                <span className="dh-chip">Report chain active</span>
                <span className="dh-chip">Hospital sync ready</span>
              </div>
            </article>
          </section>
        </div>
      </div>
    </>
  );
}
