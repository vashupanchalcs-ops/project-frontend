import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_BASE_URL || "https://swiftrescue-backend.onrender.com").replace(/\/+$/, "");

export default function AdminHospitalDetails() {
  const location = useLocation();
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(location.state?.hospitalId || null);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [pulseTime, setPulseTime] = useState(Date.now());

  useEffect(() => {
    fetch(`${BASE}/api/hospitals/`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setHospitals(list);
        if (list.length && !selectedHospitalId) {
          setSelectedHospitalId(list[0].id);
          setSelectedDashboard({ hospital: list[0], summary: {}, staff: [] });
        }
      })
      .catch(() => setHospitals([]));
  }, []);

  useEffect(() => {
    if (!selectedHospitalId) return;
    fetch(`${BASE}/api/hospitals/${selectedHospitalId}/dashboard/`)
      .then((r) => r.json())
      .then((data) => setSelectedDashboard(data))
      .catch(() => {
        const fallback = hospitals.find((h) => Number(h.id) === Number(selectedHospitalId));
        if (fallback) setSelectedDashboard((current) => current || { hospital: fallback, summary: {}, staff: [] });
      });
  }, [selectedHospitalId, hospitals]);

  useEffect(() => {
    const t = setInterval(() => setPulseTime(Date.now()), 12000);
    return () => clearInterval(t);
  }, []);

  const hospitalInfo = selectedDashboard?.hospital || null;
  const lat = Number(hospitalInfo?.latitude);
  const lng = Number(hospitalInfo?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const mapQuery = hasCoords
    ? `${lat},${lng}`
    : encodeURIComponent((hospitalInfo?.address || hospitalInfo?.name || "").trim());
  const mapEmbedSrc = mapQuery ? `https://maps.google.com/maps?q=${mapQuery}&z=14&output=embed` : "";
  const openMapLink = mapQuery ? `https://maps.google.com/maps?q=${mapQuery}&z=14` : "";

  return (
    <>
      <style>{`
        .ahd-root {
          height: 100vh;
          overflow: hidden;
          box-sizing: border-box;
          padding: 64px 0 0 64px;
          color: #111;
          font-family: "Segoe UI", Arial, sans-serif;
          background:
            radial-gradient(880px 420px at 95% 4%, rgba(255, 255, 255, 0.15), transparent 72%),
            radial-gradient(760px 380px at 3% -4%, rgba(223,235,120,0.2), transparent 70%),
            #ffffff;
        }
        .ahd-wrap { 
          max-width: 1400px; 
          margin: 0 auto; 
          padding: 20px; 
          height: 100%; 
          box-sizing: border-box; 
          display: flex; 
          flex-direction: column; 
        }
        .ahd-grid { 
          display: grid; 
          grid-template-columns: 320px 1fr; 
          gap: 12px; 
          align-items: start; 
          flex: 1; 
          min-height: 0; 
        }
        .ahd-card {
          border: 1px solid rgba(17,17,17,0.14);
          background: linear-gradient(165deg, #ffffff 0%, #f6f8e7 100%);
          border-radius: 14px;
          padding: 14px;
          box-sizing: border-box;
          box-shadow: 0 12px 30px rgba(17,17,17,0.06);
        }
        .ahd-title { margin: 0 0 10px; font-size: 20px; font-weight: 900; }
        .ahd-item {
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          background: linear-gradient(165deg, #ffffff 0%, #ffffff 100%);
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .ahd-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(17,17,17,0.08);
        }
        .ahd-item.active { border-color: #a7b700; background: linear-gradient(165deg, #fbffd8 0%, #f3f7c7 100%); }
        .ahd-row { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; font-size: 12px; }
        .ahd-k { color: rgba(17,17,17,0.62); }
        .ahd-track-btn {
          margin-top: 8px;
          border: 1px solid #9fb000;
          background: linear-gradient(135deg, #ffffff 0%, #ffffff 100%);
          color: #111;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          padding: 6px 10px;
          cursor: pointer;
        }
        .ahd-track-btn:hover { filter: brightness(0.98); }
        .ahd-map-wrap {
          margin-top: 12px;
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 12px;
          overflow: hidden;
          background: linear-gradient(145deg, #f8faeb 0%, #ecf3d2 100%);
        }
        .ahd-map-head {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(17,17,17,0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
        }
        .ahd-map-live {
          font-weight: 800;
          color: #0d7a38;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ahd-map-live::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00c853;
          box-shadow: 0 0 0 5px rgba(0,200,83,0.14);
        }
        .ahd-map-open {
          border: 1px solid rgba(17,17,17,0.2);
          background: #fff;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }
        .ahd-map-open:hover { background: #f4f8da; border-color: #a7b700; }
        .ahd-card.partners {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        main.ahd-card {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        main.ahd-card::-webkit-scrollbar { width: 6px; }
        main.ahd-card::-webkit-scrollbar-thumb {
          background: rgba(17,17,17,0.18);
          border-radius: 8px;
        }
        .ahd-partners {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: grid;
          gap: 10px;
          padding-right: 4px;
          overscroll-behavior: contain;
        }
        .ahd-partners::-webkit-scrollbar { width: 6px; }
        .ahd-partners::-webkit-scrollbar-thumb {
          background: rgba(17,17,17,0.18);
          border-radius: 8px;
        }
        .ahd-map-frame {
          width: 100%;
          height: 260px;
          border: 0;
          display: block;
        }
        .ahd-staff-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
        .ahd-staff-card {
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 10px;
          padding: 10px;
          background: linear-gradient(165deg, #ffffff 0%, #f9fbed 100%);
        }
        .ahd-empty { text-align: center; color: rgba(17,17,17,0.55); font-size: 12px; padding: 18px 10px; }
        @media (max-width: 1000px) { .ahd-grid { grid-template-columns: 1fr; } .ahd-staff-grid { grid-template-columns: 1fr; } }
        @media (max-width: 767px) {
          .ahd-root { padding-left: 0; padding-bottom: 72px; height: auto; overflow: visible; }
          .ahd-wrap { padding: 12px 12px 84px; height: auto; display: flex; flex-direction: column; }
          .ahd-grid { display: flex; flex-direction: column; }
          .ahd-card.partners { position: static; height: auto; margin-bottom: 12px; }
          .ahd-partners { max-height: 260px; }
          main.ahd-card { height: auto; overflow-y: visible; }
        }
      `}</style>

      <div className="ahd-root">
        <div className="ahd-wrap">
          <div className="ahd-grid">
            <aside className="ahd-card partners">
              <h2 className="ahd-title">Hospital Partners</h2>
              {hospitals.length === 0 && <div className="ahd-empty">No hospitals found.</div>}
              <div className="ahd-partners">
                {hospitals.map((h) => (
                  <div
                    key={h.id}
                    className={`ahd-item ${selectedHospitalId === h.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedHospitalId(h.id);
                      setSelectedDashboard({ hospital: h, summary: {}, staff: [] });
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>{h.email || "No email"}</div>
                    <div className="ahd-row"><span className="ahd-k">Beds</span><span>{h.available_beds}/{h.total_beds}</span></div>
                    <button
                      className="ahd-track-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHospitalId(h.id);
                        setSelectedDashboard({ hospital: h, summary: {}, staff: [] });
                      }}
                    >
                      Live Track on Map
                    </button>
                  </div>
                ))}
              </div>
            </aside>

            <main className="ahd-card">
              {!selectedDashboard && <div className="ahd-empty">Select a hospital to view complete details.</div>}
              {selectedDashboard && (
                <>
                  <h2 className="ahd-title">{selectedDashboard.hospital?.name || "Hospital Details"}</h2>
                  <div className="ahd-row"><span className="ahd-k">Address</span><span>{selectedDashboard.hospital?.address || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Contact</span><span>{selectedDashboard.hospital?.contact_number || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Specializations</span><span>{selectedDashboard.hospital?.specializations || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Facilities</span><span>{selectedDashboard.hospital?.facilities || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Active Cases</span><span>{selectedDashboard.summary?.active_cases ?? 0}</span></div>
                  <div className="ahd-row"><span className="ahd-k">ICU / Ventilator</span><span>{selectedDashboard.hospital?.icu_beds ?? 0} / {selectedDashboard.hospital?.available_ventilators ?? 0}</span></div>

                  <section className="ahd-map-wrap">
                    <div className="ahd-map-head">
                      <span className="ahd-map-live">Live Map Tracking • {new Date(pulseTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                    {mapEmbedSrc ? (
                      <iframe
                        className="ahd-map-frame"
                        src={mapEmbedSrc}
                        title={`${selectedDashboard.hospital?.name || "Hospital"} Map Tracking`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <div className="ahd-empty">No location found for this hospital.</div>
                    )}
                  </section>

                  <h3 style={{ marginTop: 14, marginBottom: 8 }}>Doctors & Staff</h3>
                  <div className="ahd-staff-grid">
                    {(selectedDashboard.staff || []).map((s) => (
                      <article key={s.id} className="ahd-staff-card">
                        <div style={{ fontWeight: 800 }}>{s.full_name}</div>
                        <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>{s.role} • {s.specialization || "General"}</div>
                        <div className="ahd-row"><span className="ahd-k">On Call</span><span>{s.is_on_call ? "Yes" : "No"}</span></div>
                        <div className="ahd-row"><span className="ahd-k">Experience</span><span>{s.years_experience} yrs</span></div>
                      </article>
                    ))}
                  </div>
                  {(selectedDashboard.staff || []).length === 0 && <div className="ahd-empty">No staff registered for this hospital.</div>}
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
