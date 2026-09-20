import { useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import GoogleMapEmbed from "../Components/GoogleMapEmbed";

// Deployment v1.0.5 - Pin selected hospital to top and enable full page scrolling with zero cutoff
const BASE = (import.meta.env.VITE_API_BASE_URL || "https://swiftrescue-backend-shlb.onrender.com").replace(/\/+$/, "");

// Keep the partner screen useful while the API is unavailable or has no seeded rows.
const DEFAULT_HOSPITALS = [
  {
    id: "default-saharda",
    name: "Saharda Hospital",
    address: "Delhi",
    latitude: "28.6139",
    longitude: "77.2090",
    contact_number: "8882128534",
    hospital_type: "government",
    total_beds: 40,
    available_beds: 10,
    icu_beds: 4,
    emergency_services: true,
    status: "active",
    is_active: true,
  },
];

export default function AdminHospitalDetails() {
  const location = useLocation();
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(
    location.state?.hospitalId != null ? Number(location.state.hospitalId) : null
  );
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [pulseTime, setPulseTime] = useState(Date.now());
  const selectedItemRef = useRef(null);

  // Auto-scroll sidebar to selected hospital
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedHospitalId, hospitals.length]);

  useEffect(() => {
    fetch(`${BASE}/api/hospitals/`)
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        const list = rows.length ? rows : DEFAULT_HOSPITALS;
        setHospitals(list);
        if (list.length && !selectedHospitalId) {
          const first = list[0];
          setSelectedHospitalId(Number(first.id));
          setSelectedDashboard({ hospital: first, summary: {}, staff: [] });
        }
      })
      .catch(() => {
        setHospitals(DEFAULT_HOSPITALS);
        if (!selectedHospitalId) {
          setSelectedHospitalId(Number(DEFAULT_HOSPITALS[0].id));
          setSelectedDashboard({ hospital: DEFAULT_HOSPITALS[0], summary: {}, staff: [] });
        }
      });
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

  // Pin selected hospital to position #1 (TOP) in the list!
  const sortedHospitals = useMemo(() => {
    if (!hospitals.length) return [];
    if (!selectedHospitalId) return hospitals;
    const selected = hospitals.find((h) => Number(h.id) === Number(selectedHospitalId));
    if (!selected) return hospitals;
    const others = hospitals.filter((h) => Number(h.id) !== Number(selectedHospitalId));
    return [selected, ...others];
  }, [hospitals, selectedHospitalId]);

  return (
    <>
      <style>{`
        .ahd-root {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 72px 16px 140px 80px;
          color: #111;
          font-family: "Segoe UI", Arial, sans-serif;
          overflow-y: auto;
          background:
            radial-gradient(880px 420px at 95% 4%, rgba(255, 255, 255, 0.15), transparent 72%),
            radial-gradient(760px 380px at 3% -4%, rgba(223,235,120,0.2), transparent 70%),
            #ffffff;
        }
        .ahd-wrap { 
          max-width: 1400px; 
          margin: 0 auto; 
          box-sizing: border-box; 
          display: flex; 
          flex-direction: column;
          padding-bottom: 40px;
        }
        .ahd-grid { 
          display: grid; 
          grid-template-columns: 340px 1fr; 
          gap: 16px; 
          align-items: start; 
          flex: 1; 
        }
        .ahd-card {
          border: 1px solid rgba(17,17,17,0.14);
          background: linear-gradient(165deg, #ffffff 0%, #f6f8e7 100%);
          border-radius: 14px;
          padding: 16px;
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
          background: #f59a23;
          color: #111;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          padding: 6px 10px;
          cursor: pointer;
        }
        .ahd-track-btn:hover { background: #126f1e; border-color: #126f1e; color: #fff; }
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
          position: sticky;
          top: 80px;
          max-height: calc(100vh - 96px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        main.ahd-card {
          min-height: auto;
          box-sizing: border-box;
          margin-bottom: 40px;
          padding-bottom: 24px;
        }
        .ahd-partners {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 6px;
          padding-bottom: 40px;
          overscroll-behavior: contain;
        }
        .ahd-partners::-webkit-scrollbar { width: 6px; }
        .ahd-partners::-webkit-scrollbar-thumb {
          background: rgba(17,17,17,0.18);
          border-radius: 8px;
        }
        .ahd-map-frame {
          width: 100%;
          height: 300px;
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
        @media (max-width: 1000px) { .ahd-grid { grid-template-columns: 1fr; } .ahd-staff-grid { grid-template-columns: 1fr; } .ahd-card.partners { position: static; max-height: 340px; } }
        @media (max-width: 767px) {
          .ahd-root { padding: 72px 12px 84px 12px; min-height: 100vh; }
          .ahd-wrap { padding: 0; min-height: auto; display: flex; flex-direction: column; }
          .ahd-grid { display: flex; flex-direction: column; }
          .ahd-card.partners { position: static; max-height: 320px; margin-bottom: 12px; }
          .ahd-partners { max-height: 260px; }
          main.ahd-card { min-height: auto; }
        }
      `}</style>

      <div className="ahd-root">
        <div className="ahd-wrap">
          <div className="ahd-grid">
            <aside className="ahd-card partners">
              <h2 className="ahd-title">Hospital Partners</h2>
              {sortedHospitals.length === 0 && <div className="ahd-empty">No hospitals found.</div>}
              <div className="ahd-partners">
                {sortedHospitals.map((h) => (
                  <div
                    key={h.id}
                    ref={Number(selectedHospitalId) === Number(h.id) ? selectedItemRef : null}
                    className={`ahd-item ${Number(selectedHospitalId) === Number(h.id) ? "active" : ""}`}
                    onClick={() => {
                      setSelectedHospitalId(Number(h.id));
                      setSelectedDashboard({ hospital: h, summary: {}, staff: [] });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>{h.email || "No email"}</div>
                    <div className="ahd-row"><span className="ahd-k">Available / Total Beds</span><span><strong style={{ color: "#166534" }}>{h.available_beds} Available</strong> / {h.total_beds}</span></div>
                    <div className="ahd-row"><span className="ahd-k">Doctors Active</span><span>{h.doctors_active ?? 0}/{h.doctors_count ?? 0}</span></div>
                    <div className="ahd-row"><span className="ahd-k">Staff (On/Off)</span><span>🟢 {h.staff_active_count ?? 0} / 🔴 {h.staff_deactive_count ?? 0}</span></div>
                    <button
                      className="ahd-track-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHospitalId(Number(h.id));
                        setSelectedDashboard({ hospital: h, summary: {}, staff: [] });
                        window.scrollTo({ top: 0, behavior: "smooth" });
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 className="ahd-title" style={{ margin: 0 }}>{selectedDashboard.hospital?.name || "Hospital Details"}</h2>
                    <span style={{ fontSize: 11, background: "#166534", color: "#fff", padding: "3px 10px", borderRadius: 999, fontWeight: 800 }}>
                      ACTIVE PARTNER
                    </span>
                  </div>
                  <div className="ahd-row"><span className="ahd-k">Address</span><span>{selectedDashboard.hospital?.address || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Contact</span><span>{selectedDashboard.hospital?.contact_number || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Specializations</span><span>{selectedDashboard.hospital?.specializations || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Facilities</span><span>{selectedDashboard.hospital?.facilities || "-"}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Active Cases</span><span>{selectedDashboard.summary?.active_cases ?? 0}</span></div>
                  <div className="ahd-row"><span className="ahd-k">Total / Booked / Available Beds</span><span>{selectedDashboard.hospital?.total_beds ?? 40} Total · <strong style={{ color: "#b45309" }}>{selectedDashboard.hospital?.booked_beds ?? Math.max(0, (selectedDashboard.hospital?.total_beds || 40) - (selectedDashboard.hospital?.available_beds || 0))} Booked</strong> · <strong style={{ color: "#166534" }}>{selectedDashboard.hospital?.available_beds ?? 10} Available</strong></span></div>
                  <div className="ahd-row"><span className="ahd-k">ICU / Ventilator Beds</span><span>{selectedDashboard.hospital?.available_icu_beds ?? selectedDashboard.hospital?.icu_beds ?? 0} Free ICU · {selectedDashboard.hospital?.available_ventilators ?? 0} Ventilators</span></div>
                  <div className="ahd-row"><span className="ahd-k">Doctors On Duty</span><span><strong style={{ color: "#166534" }}>{selectedDashboard.hospital?.doctors_active ?? 0} Active</strong> / {selectedDashboard.hospital?.doctors_count ?? 0} Total Doctors</span></div>
                  <div className="ahd-row"><span className="ahd-k">Nurses On Duty</span><span><strong style={{ color: "#166534" }}>{selectedDashboard.hospital?.nurses_active ?? 0} Active</strong> / {selectedDashboard.hospital?.nurses_count ?? 0} Total Nurses</span></div>
                  <div className="ahd-row"><span className="ahd-k">Live Staff Capacity</span><span>🟢 Active: {selectedDashboard.hospital?.staff_active_count ?? 0} · 🔴 Deactive: {selectedDashboard.hospital?.staff_deactive_count ?? 0}</span></div>

                  <section className="ahd-map-wrap">
                    <div className="ahd-map-head">
                      <span className="ahd-map-live">Live Map Tracking • {new Date(pulseTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                    {hasCoords ? (
                      <div style={{ height: 320, width: "100%", position: "relative" }}>
                        <GoogleMapEmbed
                          destinationLoc={{
                            lat,
                            lng,
                            name: selectedDashboard.hospital?.name || "Hospital",
                          }}
                          height="100%"
                        />
                      </div>
                    ) : (
                      <div className="ahd-empty">No location found for this hospital.</div>
                    )}
                  </section>

                  <h3 style={{ marginTop: 18, marginBottom: 10 }}>Doctors & Staff Directory</h3>
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

                  {/* Clean Footer Section so End of Page is clear & padded */}
                  <footer style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(17,17,17,0.1)", textAlign: "center", color: "rgba(17,17,17,0.5)", fontSize: 11 }}>
                    ✓ End of Partner Record for <strong>{selectedDashboard.hospital?.name || "Hospital"}</strong> • Live Monitoring Active
                  </footer>
                </>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
