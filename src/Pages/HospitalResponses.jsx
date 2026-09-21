import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

export default function HospitalResponses() {
  const navigate = useNavigate();
  const cachedBookings = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("hospital_responses_cache") || "[]");
    } catch {
      return [];
    }
  }, []);

  const [bookings, setBookings] = useState(cachedBookings);
  const [ambulances, setAmbulances] = useState([]);
  const [loading, setLoading] = useState(cachedBookings.length === 0);
  const [actionLoading, setActionLoading] = useState(null);
  const [teamBooking, setTeamBooking] = useState(null);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const fetchBookings = ({ silent = false } = {}) => {
    if (!silent && bookings.length === 0) setLoading(true);
    Promise.all([
      fetch(`${BASE}/api/bookings/`).then((r) => r.json()).catch(() => []),
      fetch(`${BASE}/api/ambulances/`).then((r) => r.json()).catch(() => []),
    ])
      .then(([bookingData, ambulanceData]) => {
        const bList = Array.isArray(bookingData) ? bookingData : [];
        setBookings(bList);
        setAmbulances(Array.isArray(ambulanceData) ? ambulanceData : []);
        try {
          sessionStorage.setItem("hospital_responses_cache", JSON.stringify(bList));
        } catch {}
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBookings({ silent: bookings.length > 0 });
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchBookings({ silent: true });
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const hospitalAssigned = useMemo(
    () =>
      bookings
        .filter((b) => b.assigned_hospital_name)
        .filter((b) => b.status !== "cancelled")
        .filter((b) => ["ready", "not_ready"].includes(String(b.hospital_response || "").toLowerCase()))
        .sort((a, b) => b.id - a.id),
    [bookings]
  );

  const handleAssignBed = async (b) => {
    if (!b.assigned_hospital_id) {
      alert("No hospital associated with this booking.");
      return;
    }
    setActionLoading(`bed-${b.id}`);
    try {
      const res = await fetch(`${BASE}/api/hospitals/${b.assigned_hospital_id}/beds/assign/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: b.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign bed");
      showToast(`✅ Bed ${data.bed?.bed_number || "assigned"} allocated successfully!`);
      // Optimistic update
      setBookings((prev) =>
        prev.map((item) =>
          item.id === b.id
            ? { ...item, assigned_bed_number: data.bed?.bed_number || "G-001", assigned_bed_type: "general" }
            : item
        )
      );
      fetchBookings({ silent: true });
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSwitchIcu = async (b) => {
    if (!b.assigned_hospital_id) {
      alert("No hospital associated with this booking.");
      return;
    }
    if (!window.confirm("Switch this patient to an available ICU Bed? The previous bed will be released.")) return;
    setActionLoading(`icu-${b.id}`);
    try {
      const res = await fetch(`${BASE}/api/hospitals/${b.assigned_hospital_id}/beds/switch-icu/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: b.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No available ICU bed found");
      showToast(`🚨 Successfully switched to ICU Bed ${data.icu_bed?.bed_number}!`);
      // Optimistic update
      setBookings((prev) =>
        prev.map((item) =>
          item.id === b.id
            ? { ...item, assigned_bed_number: data.icu_bed?.bed_number || "ICU-001", assigned_bed_type: "icu" }
            : item
        )
      );
      fetchBookings({ silent: true });
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <style>{`
        .hr-root {
          min-height: 100vh;
          padding: 64px 0 0 64px;
          background: #f7f7f2;
          color: #111;
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }
        .hr-wrap { padding: 22px; }
        .hr-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .hr-sub { color: rgba(17,17,17,0.66); margin-bottom: 16px; font-size: 14px; }
        .hr-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .hr-card {
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          background: #ffffff;
          padding: 14px 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .hr-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hr-id { font-size: 12px; font-weight: 800; color: rgba(17,17,17,0.55); }
        .hr-pill {
          border: 1px solid rgba(20,20,20,0.16);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          background: #ffffff;
        }
        .hr-line { font-size: 12px; margin-bottom: 4px; color: rgba(17,17,17,0.84); }
        .hr-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
        .hr-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #111;
          color: #fff;
          padding: 12px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          z-index: 9999;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .hr-auto-note {
          margin-top: 10px;
          border: 1px solid rgba(0,0,0,0.06);
          background: #f8fafc;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
        }
        .hr-empty {
          margin-top: 20px;
          border: 1px dashed rgba(20,20,20,0.2);
          border-radius: 12px;
          background: #fff;
          padding: 28px;
          text-align: center;
          color: rgba(17,17,17,0.62);
        }
        @media (max-width: 767px) {
          .hr-grid { grid-template-columns: 1fr; }
          .hr-root { padding-left: 0; padding-bottom: 76px; }
          .hr-wrap { padding: 16px 10px 90px; }
        }
      `}</style>

      {toastMsg && <div className="hr-toast">{toastMsg}</div>}

      <div className="hr-root">
        <div className="hr-wrap">
          <h1 className="hr-title">Hospital Responses</h1>
          <div className="hr-sub">Approved emergency cases with allocated bed and multidisciplinary care team details.</div>

          {loading && hospitalAssigned.length === 0 ? (
            <div className="hr-empty">Loading...</div>
          ) : hospitalAssigned.length === 0 ? (
            <div className="hr-empty">No hospital response yet. Waiting for hospital action.</div>
          ) : (
            <div className="hr-grid">
              {hospitalAssigned.map((b) => {
                const response = String(b.hospital_response || "").toLowerCase();
                const isApproved = response === "ready";
                const statusLabel = isApproved ? "Approved" : response === "not_ready" ? "Rejected" : "Pending";
                const statusMessage = isApproved
                  ? "Request accepted. We are preparing."
                  : "Request rejected. Currently not available.";
                return (
                  <article className="hr-card" key={b.id}>
                    <div className="hr-head">
                      <div className="hr-id">BOOKING #{b.id}</div>
                      <div className="hr-pill" style={{
                        background: isApproved ? "#dcfce7" : "#fee2e2",
                        color: isApproved ? "#166534" : "#991b1b",
                        borderColor: isApproved ? "#86efac" : "#fca5a5"
                      }}>{statusLabel}</div>
                    </div>
                    <div className="hr-line"><b>Patient:</b> {b.patient_name || b.booked_by}</div>
                    <div className="hr-line"><b>Pickup:</b> {b.pickup_location}</div>
                    <div className="hr-line"><b>Hospital:</b> {b.assigned_hospital_name}</div>
                    <div className="hr-line"><b>Alert:</b> {b.hospital_alert_sent ? "sent" : "pending"}</div>
                    <div className="hr-line"><b>Note:</b> {b.hospital_response_note || "-"}</div>
                    <div className="hr-auto-note">{statusMessage}</div>

                    {/* Assigned Doctor Display */}
                    {b.assigned_doctor_names ? (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12 }}>
                        <span style={{ color: "#166534", fontWeight: 700 }}>👨‍⚕️ Assigned Doctor(s):</span> {b.assigned_doctor_names}
                        {b.assigned_doctor_specializations && <span style={{ color: "#475569" }}> ({b.assigned_doctor_specializations})</span>}
                        {b.assigned_doctor_contacts && <div style={{ color: "#64748b", marginTop: 2 }}>📞 {b.assigned_doctor_contacts}</div>}
                      </div>
                    ) : null}

                    {/* Assigned Bed Display */}
                    {b.assigned_bed_number ? (
                      <div style={{
                        marginTop: 8,
                        padding: "8px 12px",
                        background: b.assigned_bed_type === "icu" ? "#eff6ff" : "#fefce8",
                        border: `1px solid ${b.assigned_bed_type === "icu" ? "#93c5fd" : "#fde047"}`,
                        borderRadius: 8,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}>
                        <div>
                          <span style={{ color: b.assigned_bed_type === "icu" ? "#1d4ed8" : "#854d0e", fontWeight: 700 }}>
                            🛏️ Assigned Bed:
                          </span>{" "}
                          <b>{b.assigned_bed_number}</b> ({b.assigned_bed_type?.toUpperCase() || "GENERAL"})
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: b.assigned_bed_type === "icu" ? "#1d4ed8" : "#ca8a04",
                          color: "#fff"
                        }}>
                          {b.assigned_bed_type === "icu" ? "ICU BED" : "RESERVED"}
                        </span>
                      </div>
                    ) : null}

                    {/* ICU Required Alert from Driver */}
                    {b.icu_required && (
                      <div style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        background: "#fef2f2",
                        border: "1.5px solid #ef4444",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6
                      }}>
                        <div style={{ color: "#b91c1c", fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                          🚨 <span>Driver Flagged: Patient Requires ICU Bed Urgently!</span>
                        </div>
                        {b.assigned_bed_type !== "icu" && isApproved && (
                          <button
                            onClick={() => navigate(`/hospital/beds?booking_id=${b.id}&type=icu`)}
                            style={{
                              background: "#dc2626",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "6px 12px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              alignSelf: "flex-start",
                            }}
                          >
                            🚨 Allocate ICU Bed
                          </button>
                        )}
                      </div>
                    )}

                    {isApproved && b.assigned_doctor_names && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <button className="hr-view-team" onClick={() => navigate(`/hospital/team-allocation/edit?booking_id=${b.id}`)}>✎ Edit allocated team</button>
                        <button className="hr-view-team" onClick={() => setTeamBooking(b)}>👥 View allocated staff team</button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {teamBooking && (
        <div onClick={() => setTeamBooking(null)} style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 22, width: "min(560px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
            <h2 style={{ margin: "0 0 6px" }}>Allocated care team · Booking #{teamBooking.id}</h2>
            <p style={{ color: "#64748b", marginTop: 0 }}>Selected by specialization, availability, on-call status and experience.</p>
            <div style={{ display: "grid", gap: 8 }}>{String(teamBooking.assigned_doctor_names).split(", ").map((name, i) => <div key={name} style={{ padding: 10, border: "1px solid #bbf7d0", borderRadius: 10, background: "#f0fdf4" }}><b>{name}</b><div style={{ fontSize: 12, color: "#475569" }}>{String(teamBooking.assigned_doctor_specializations || "").split(", ")[i] || "Care team member"}</div></div>)}</div>
            <button onClick={() => setTeamBooking(null)} style={{ marginTop: 16, padding: "9px 16px", border: 0, borderRadius: 8, background: "#166534", color: "#fff", fontWeight: 800 }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
