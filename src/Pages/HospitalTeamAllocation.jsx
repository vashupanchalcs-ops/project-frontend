import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend.onrender.com")).replace(/\/+$/, "");
const roles = ["doctor", "nurse", "technician", "support"];

export default function HospitalTeamAllocation() {
  const query = new URLSearchParams(useLocation().search);
  const [bookings, setBookings] = useState([]), [staff, setStaff] = useState([]), [active, setActive] = useState(query.get("booking_id") || "");
  const [selected, setSelected] = useState({}), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const hospitalId = localStorage.getItem("hospital_id");

  useEffect(() => { Promise.all([
    fetch(`${BASE}/api/bookings/`).then(r => r.json()),
    fetch(`${BASE}/api/hospitals/${hospitalId}/staff/`).then(r => r.json()),
  ]).then(([b, s]) => { setBookings((Array.isArray(b) ? b : []).filter(x => !hospitalId || String(x.assigned_hospital_id) === String(hospitalId))); setStaff(Array.isArray(s) ? s : []); }).finally(() => setLoading(false)); }, [hospitalId]);
  const booking = bookings.find(b => String(b.id) === String(active));
  const condition = `${booking?.patient_condition || ""} ${booking?.vitals_summary || ""}`.toLowerCase();
  const ranked = useMemo(() => Object.fromEntries(roles.map(role => [role, staff.filter(s => s.role === role && s.is_active !== false && !s.is_busy).sort((a, b) => ((b.is_on_call ? 25 : 0) + (b.years_experience || 0) * 3 + (condition.includes(String(b.specialization || "").toLowerCase()) ? 100 : 0)) - ((a.is_on_call ? 25 : 0) + (a.years_experience || 0) * 3 + (condition.includes(String(a.specialization || "").toLowerCase()) ? 100 : 0))).slice(0, 5)])), [staff, condition]);
  const toggle = (role, id) => setSelected(v => ({ ...v, [role]: v[role] === id ? null : id }));
  const allocate = async () => { const ids = Object.values(selected).filter(Boolean); if (!booking || !ids.length) return; setSaving(true); const res = await fetch(`${BASE}/api/hospitals/${hospitalId}/staff-team/assign/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ booking_id: booking.id, staff_ids: ids }) }); const data = await res.json(); setSaving(false); setNotice(res.ok ? "Team allocated and bed record updated." : (data.error || "Unable to allocate team")); if (res.ok) setBookings(v => v.map(b => b.id === booking.id ? { ...b, assigned_doctor_names: data.team.map(x => x.full_name).join(", "), assigned_doctor_specializations: data.team.map(x => `${x.role}: ${x.specialization || "General"}`).join(", ") } : b)); };
  if (loading) return <div style={{ padding: 100 }}>Loading team allocation hub…</div>;
  return <main style={{ marginLeft: 64, padding: "96px 28px 40px", minHeight: "100vh", background: "#f5f8f7", color: "#123" }}>
    <h1>Team allocation</h1><p>Build a multidisciplinary team using the best available members for each case.</p>
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18 }}><section style={{ background: "#fff", padding: 14, borderRadius: 14 }}>{bookings.map(b => <button key={b.id} onClick={() => setActive(b.id)} style={{ width: "100%", textAlign: "left", padding: 12, marginBottom: 8, borderRadius: 10, border: String(active) === String(b.id) ? "2px solid #087f72" : "1px solid #d5e0dd", background: "#fff" }}><b>Booking #{b.id}</b><div>{b.patient_name || b.booked_by || "Patient"}</div><small>{b.patient_condition || "Emergency case"}</small></button>)}</section>
      <section style={{ background: "#fff", padding: 20, borderRadius: 14 }}>{!booking ? <p>Select a booking to allocate a team.</p> : <><h2>Build team · Booking #{booking.id}</h2><div style={{ padding: 12, background: "#e7f7f0", borderRadius: 10 }}>Patient: <b>{booking.patient_name || booking.booked_by}</b> · {booking.patient_condition || "Emergency care"}</div>{roles.map(role => <div key={role} style={{ marginTop: 18 }}><h3 style={{ textTransform: "capitalize" }}>{role} <small>(top 5 available)</small></h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>{(ranked[role] || []).map(s => <button key={s.id} onClick={() => toggle(role, s.id)} style={{ textAlign: "left", padding: 12, borderRadius: 10, border: selected[role] === s.id ? "2px solid #087f72" : "1px solid #d7e3df", background: selected[role] === s.id ? "#e6f7ef" : "#fff" }}><b>{s.full_name}</b><div>{s.specialization || "General"}</div><small>{s.years_experience || 0} yrs · {s.is_on_call ? "On call" : "Available"}</small></button>)}</div></div>)}<button onClick={allocate} disabled={saving} style={{ marginTop: 22, padding: "12px 18px", border: 0, borderRadius: 9, background: "#087f72", color: "#fff", fontWeight: 800 }}>{saving ? "Allocating…" : "Allocate team & update bed"}</button>{notice && <p>{notice}</p>}</>}</section></div>
  </main>;
}
