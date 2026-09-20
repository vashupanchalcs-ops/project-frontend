import { Ambulance, ArrowRight, MapPin } from "lucide-react";
import AMBULANCE_IMAGE from "../assets/ambulance.jpg";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com")).replace(/\/+$/, "");
// Image imported above via Vite asset pipeline (src/assets/ambulance.jpg)

export default function UserHome() {
  const navigate = useNavigate();
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch(`${BASE}/api/ambulances/`).then((response) => (response.ok ? response.json() : [])),
      fetch(`${BASE}/api/hospitals/`).then((response) => (response.ok ? response.json() : [])),
    ]).then(([fleetResult, hospitalsResult]) => {
      if (!active) return;
      if (fleetResult.status === "fulfilled" && Array.isArray(fleetResult.value)) setAmbulances(fleetResult.value);
      if (hospitalsResult.status === "fulfilled" && Array.isArray(hospitalsResult.value)) setHospitals(hospitalsResult.value);
    });
    return () => { active = false; };
  }, []);

  const availableAmbulances = useMemo(
    () => ambulances.filter((item) => String(item.status || "").toLowerCase() === "available").length,
    [ambulances]
  );

  return (
    <main className="uh-root">
      <style>{`
        .uh-root {
          min-height: 100vh;
          padding: 64px 0 0 64px;
          background: #ffffff;
          color: #163028;
          font-family: "Outfit", "Segoe UI", sans-serif;
        }
        .uh-stage {
          box-sizing: border-box;
          min-height: calc(100vh - 64px);
          max-width: 1560px;
          margin: 0 auto;
          padding: clamp(38px, 7vh, 96px) clamp(28px, 5vw, 80px);
          display: grid;
          grid-template-columns: minmax(720px, 1.08fr) minmax(420px, .92fr);
          align-items: center;
          gap: clamp(30px, 6vw, 100px);
        }
        .uh-copy { min-width: 0; }
        .uh-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          color: #126f1e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .11em;
          text-transform: uppercase;
        }
        .uh-kicker::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #f59a23; }
        .uh-title { max-width: 640px; margin: 0; color: #163028; font-size: clamp(42px, 5.2vw, 76px); font-weight: 750; letter-spacing: -.055em; line-height: 1.04; }
        .uh-title span { color: #126f1e; }
        .uh-sub { max-width: 550px; margin: 18px 0 0; color: #587066; font-size: clamp(15px, 1.5vw, 19px); line-height: 1.55; }
        .uh-data { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
        .uh-data-chip { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cde3d1; border-radius: 999px; padding: 7px 10px; background: #ffffff; color: #126f1e; font-size: 11px; font-weight: 700; }
        .uh-data-chip.accent { border-color: #f8d5a4; color: #a55b08; }
        .uh-booking-card { width: min(720px, 100%); display: grid; grid-template-columns: 1fr; align-items: center; margin-top: 28px; padding: 8px; border: 1px solid #cde3d1; border-radius: 14px; background: #ffffff; box-shadow: none; }
        .uh-location { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; }
        .uh-location-icon { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border-radius: 50%; background: #e9f4eb; color: #126f1e; }
        .uh-location-icon.drop { background: #fff2df; color: #c97108; }
        .uh-location b { display: block; overflow: hidden; color: #2c493d; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .uh-location span { display: block; margin-top: 3px; color: #111111; font-size: 10px; line-height: 1.35; white-space: normal; }
        .uh-book-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 22px; border: 1px solid #f59a23; border-radius: 9px; background: #f59a23; color: #111111; font: 750 13px inherit; white-space: nowrap; cursor: pointer; }
        .uh-book-btn:hover { background: #f59a23; border-color: #f59a23; color: #111111; }
        .uh-book-cta { width: min(320px, 100%); margin-top: 12px; }
        .uh-visual { position: relative; min-height: clamp(320px, 34vw, 470px); overflow: hidden; border-radius: 42% 42% 12px 42%; background: #eaf1eb; }
        .uh-visual img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
        .uh-visual::after { content: ""; position: absolute; inset: 0; background: linear-gradient(120deg, rgba(18,111,30,.04), transparent 58%, rgba(245,154,35,.12)); pointer-events: none; }
        .uh-visual-label { position: absolute; right: 20px; bottom: 20px; z-index: 1; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 9px 12px; background: rgba(255,255,255,.94); color: #126f1e; box-shadow: 0 7px 18px rgba(18,111,30,.14); font-size: 11px; font-weight: 800; }
        .uh-visual-label svg { color: #f59a23; }
        @media (max-width: 960px) {
          .uh-stage { grid-template-columns: 1fr; padding: 48px 42px 72px; }
          .uh-visual { min-height: 320px; max-width: 700px; width: 100%; }
        }
        @media (max-width: 720px) {
          .uh-root { padding-left: 0; padding-bottom: 74px; }
          .uh-stage { min-height: calc(100vh - 64px); padding: 36px 16px 88px; gap: 34px; }
          .uh-title { font-size: clamp(38px, 12vw, 56px); }
          .uh-booking-card { padding: 8px; }
          .uh-book-cta { width: 100%; }
          .uh-visual { min-height: 250px; border-radius: 32% 32% 10px 32%; }
        }
      `}</style>

      <section className="uh-stage" aria-label="Book an ambulance">
        <div className="uh-copy">
          <div className="uh-kicker">Aarogya emergency response</div>
          <h1 className="uh-title">Emergency care, <span>right when you need it.</span></h1>
          <p className="uh-sub">Book a verified ambulance and reach a ready hospital with a clear, real-time response flow.</p>
          <div className="uh-data" aria-label="Live availability">
            <span className="uh-data-chip"><Ambulance size={14} />{availableAmbulances} ambulance{availableAmbulances === 1 ? "" : "s"} ready</span>
            <span className="uh-data-chip accent">{hospitals.length} hospital partner{hospitals.length === 1 ? "" : "s"}</span>
          </div>
          <div className="uh-booking-card">
            <div className="uh-location"><span className="uh-location-icon"><MapPin size={17} /></span><div><b>Pickup location</b><span>Select your pickup in the booking form</span></div></div>
          </div>
          <button className="uh-book-btn uh-book-cta" onClick={() => navigate("/Ambulances?book=1")}>Book Ambulance <ArrowRight size={16} /></button>
        </div>
        <div className="uh-visual" aria-hidden="true">
          <img src={AMBULANCE_IMAGE} alt="" />
          <span className="uh-visual-label"><Ambulance size={16} />24/7 emergency support</span>
        </div>
      </section>
    </main>
  );
}
