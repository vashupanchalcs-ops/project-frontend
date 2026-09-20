import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend.onrender.com")).replace(/\/+$/, "");
const ROLES = ["doctor", "nurse", "technician", "support"];
const roleLabel = { doctor: "Doctor", nurse: "Nurse", technician: "Technician", support: "Support" };

export default function HospitalTeamAllocation() {
  const { search } = useLocation();
  const [bookings, setBookings] = useState([]);
  const [staff, setStaff] = useState([]);
  const [bookingId, setBookingId] = useState(new URLSearchParams(search).get("booking_id") || "");
  const [selected, setSelected] = useState({});
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const hospitalId = localStorage.getItem("hospital_id");
  const booking = bookings.find((item) => String(item.id) === String(bookingId));

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/bookings/`).then((r) => r.ok ? r.json() : []),
      fetch(`${BASE}/api/hospitals/${hospitalId}/staff/`).then((r) => r.ok ? r.json() : []),
    ]).then(([rows, people]) => {
      setBookings((Array.isArray(rows) ? rows : []).filter((item) => !hospitalId || String(item.assigned_hospital_id) === String(hospitalId)));
      setStaff(Array.isArray(people) ? people : []);
    }).catch(() => setNotice("Unable to load allocation data."));
  }, [hospitalId]);

  const ranked = useMemo(() => {
    const text = `${booking?.patient_condition || ""} ${booking?.vitals_summary || ""}`.toLowerCase();
    const score = (person) => (person.is_on_call ? 25 : 0) + Number(person.years_experience || 0) * 3 + (person.specialization && text.includes(String(person.specialization).toLowerCase()) ? 100 : 0);
    return Object.fromEntries(ROLES.map((role) => [role, staff.filter((person) => person.role === role && person.is_active !== false && !person.is_busy).sort((a, b) => score(b) - score(a)).slice(0, 5)]));
  }, [booking, staff]);
  const selectedMembers = Object.entries(selected).map(([role, id]) => ({ role, member: staff.find((person) => person.id === id) })).filter((item) => item.member);
  const toggle = (role, member) => setSelected((current) => ({ ...current, [role]: current[role] === member.id ? null : member.id }));
  const review = () => { const next = { ...selected }; ROLES.forEach((role) => { if (!next[role] && ranked[role]?.[0]) next[role] = ranked[role][0].id; }); if (!Object.values(next).some(Boolean)) return setNotice("No available staff found for this booking."); setSelected(next); setNotice(""); setStep(2); };
  const allocate = async () => {
    if (!booking || !selectedMembers.length) return;
    setSaving(true); setNotice("");
    const team = selectedMembers.map(({ role, member }) => ({ id: member.id, full_name: member.full_name, role, specialization: member.specialization || "General", contact_number: member.contact_number || "", years_experience: member.years_experience || 0 }));
    try {
      let response = await fetch(`${BASE}/api/hospitals/${hospitalId}/staff-team/assign/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: booking.id, staff_ids: team.map((person) => person.id) }) });
      if (!response.ok) response = await fetch(`${BASE}/api/bookings/${booking.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assign_doctors: team }) });
      if (!response.ok) throw new Error("Team allocation could not be saved. Please retry.");
      setBookings((rows) => rows.map((row) => row.id === booking.id ? { ...row, assigned_doctor_names: team.map((person) => person.full_name).join(", "), assigned_doctor_specializations: team.map((person) => `${roleLabel[person.role]}: ${person.specialization}`).join(", "), assigned_doctors_json: JSON.stringify(team) } : row));
      setNotice("Team allocated successfully. Booking and bed assignment are updated."); setStep(3);
    } catch (error) { setNotice(error.message); } finally { setSaving(false); }
  };

  return <main className="team-allocation-page">
    <style>{`.team-allocation-page{margin-left:64px;min-height:100vh;padding:94px 28px 44px;background:#eff6f5;color:#173645;font-family:Inter,Segoe UI,sans-serif}.team-allocation-page *{box-sizing:border-box}.team-hero h1{margin:0;font-size:34px;color:#173645!important}.team-hero p{margin:6px 0 18px;color:#6d858d!important}.team-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:20px}.team-panel{background:#fff!important;border:1px solid #d6e5e1!important;border-radius:18px;padding:18px;box-shadow:0 12px 30px rgba(22,61,75,.08)!important}.booking-item{width:100%;padding:13px 14px;margin-bottom:10px;text-align:left;background:#fff!important;border:1px solid #d8e4e1!important;border-radius:12px;color:#173645!important;cursor:pointer}.booking-item.active{border:2px solid #087f72!important;background:#eaf8f3!important}.step-line{display:flex;gap:10px;align-items:center;color:#087f72;font-size:11px;font-weight:900;letter-spacing:.5px}.patient-banner{display:flex;justify-content:space-between;padding:16px 18px;border-radius:14px;background:#145044!important;color:#fff!important;margin:14px 0 16px}.patient-banner *{color:#fff!important}.selected-summary{display:flex;flex-wrap:wrap;gap:8px;padding:11px;border:1px solid #c5e3d8;border-radius:12px;background:#f1fbf7;margin-bottom:16px}.selected-chip{padding:7px 10px;border-radius:999px;background:#d9f3e8;color:#12644f;font-size:12px;font-weight:800}.role-heading{display:flex;justify-content:space-between;margin:18px 0 8px;color:#173645!important}.role-heading small,.staff-meta{color:#668087!important}.staff-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.staff-card{position:relative;display:block;text-align:left;padding:14px;border-radius:14px;background:#fff!important;color:#173645!important;border:1px solid #d5e4e0!important;cursor:pointer;min-height:112px}.staff-card:hover{border-color:#087f72!important;background:#f2fbf7!important}.staff-card.selected{border:2px solid #087f72!important;background:#e4f7ee!important}.staff-check{position:absolute;right:12px;top:12px;width:19px;height:19px;accent-color:#087f72}.staff-role{display:inline-block;margin-bottom:10px;padding:4px 8px;border-radius:999px;background:#e3f0ff;color:#2b6cb0;font-size:9px;font-weight:900;text-transform:uppercase}.staff-name{font-weight:900;font-size:13px}.staff-meta{font-size:11px;margin-top:5px}.team-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.team-btn{border-radius:10px;padding:12px 18px;font-weight:900;cursor:pointer}.team-btn.primary{background:#087f72!important;color:#fff!important;border:0}.team-btn.secondary{background:#fff!important;color:#173645!important;border:1px solid #bfd5cf}.review-grid{display:grid;grid-template-columns:1fr 280px;gap:16px}.review-card{border:1px solid #c5e3d8;border-radius:14px;background:#fff;overflow:hidden}.review-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #e3efeb}.review-row:last-child{border-bottom:0}.review-role{width:82px;color:#087f72;font-weight:900;font-size:10px;text-transform:uppercase}.allocated-state{padding:26px;border-radius:14px;background:#e5f7ed!important;border:1px solid #a9dfc7!important;color:#12644f!important}@media(max-width:900px){.team-layout,.review-grid{grid-template-columns:1fr}.staff-grid{grid-template-columns:1fr 1fr}}`}</style>
    <div className="team-hero"><h1>Team allocation</h1><p>Build a multidisciplinary team using the best available members for each case.</p></div>
    <div className="team-layout"><aside className="team-panel">{bookings.map((item) => <button className={`booking-item ${String(item.id) === String(bookingId) ? "active" : ""}`} key={item.id} onClick={() => { setBookingId(item.id); setStep(1); setSelected({}); }}><b>Booking #{item.id}</b><div>{item.patient_name || item.booked_by || "Patient"}</div><small>{item.patient_condition || "Emergency case"}</small></button>)}</aside>
      <section className="team-panel">{!booking ? <p>Select a booking.</p> : <><div className="step-line">STEP 1 · TEAM SELECTION {step > 1 && "✓"}<span>→</span> STEP 2 · REVIEW {step > 2 && "✓"}<span>→</span> STEP 3 · ALLOCATED</div><h2>{step === 1 ? "Build multidisciplinary team" : step === 2 ? "Review team allocation" : "Team allocated · preparing for departure"} · Booking #{booking.id}</h2><div className="patient-banner"><div><b>{booking.patient_name || booking.booked_by || "Patient"}</b><div>{booking.patient_condition || "Emergency care"}</div></div><small>{booking.assigned_bed_number ? `Bed ${booking.assigned_bed_number}` : "Bed pending"}</small></div>{step === 1 && <><div className="selected-summary"><b>Selected team:</b>{selectedMembers.length ? selectedMembers.map(({ role, member }) => <span className="selected-chip" key={role}>{member.full_name} · {roleLabel[role]}</span>) : <span>No members selected yet</span>}</div>{ROLES.map((role) => <div key={role}><div className="role-heading"><b>{roleLabel[role]}</b><small>Top 5 available · select 1</small></div><div className="staff-grid">{(ranked[role] || []).map((member) => <label className={`staff-card ${selected[role] === member.id ? "selected" : ""}`} key={member.id}><input className="staff-check" type="checkbox" checked={selected[role] === member.id} onChange={() => toggle(role, member)} /><span className="staff-role">{roleLabel[role]}</span><div className="staff-name">{member.full_name}</div><div className="staff-meta">{member.specialization || "General"}</div><div className="staff-meta">{member.years_experience || 0} years · {member.is_on_call ? "On call" : "Available"}</div></label>)}</div></div>)}</>}{step === 2 && <div className="review-grid"><div className="review-card">{selectedMembers.map(({ role, member }) => <div className="review-row" key={role}><span className="review-role">{roleLabel[role]}</span><div><b>{member.full_name}</b><div className="staff-meta">{member.specialization || "General"} · {member.years_experience || 0} years experience</div></div><span className="selected-chip">Confirmed available</span></div>)}</div><div className="allocated-state"><b>Clinical coverage validated</b><p>Selected members will be notified and reserved for this booking.</p></div></div>}{step === 3 && <div className="allocated-state"><h3>✓ Team allocated · preparing for departure</h3><p>{selectedMembers.map(({ role, member }) => `${member.full_name} (${roleLabel[role]})`).join(" · ")}</p><p>Team details have been saved to the booking and allocated bed.</p></div>}{notice && <p style={{ color: notice.includes("success") ? "#087f72" : "#b42318", fontWeight: 800 }}>{notice}</p>}<div className="team-actions">{step === 2 && <button className="team-btn secondary" onClick={() => setStep(1)}>← Back to selection</button>}{step === 1 && <button className="team-btn primary" onClick={review}>Review team →</button>}{step === 2 && <button className="team-btn primary" disabled={saving} onClick={allocate}>{saving ? "Allocating…" : "Allocate team & notify"}</button>}</div></>}</section></div>
  </main>;
}
