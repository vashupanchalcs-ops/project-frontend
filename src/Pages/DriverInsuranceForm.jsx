import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
const INSURANCE_PROVIDERS = [
  "LIC",
  "New India Assurance",
  "ICICI Lombard",
  "HDFC ERGO",
  "Star Health",
  "Niva Bupa",
  "Care Health Insurance",
  "Bajaj Allianz",
  "SBI General Insurance",
  "Reliance General Insurance",
  "Tata AIG",
  "Aditya Birla Health Insurance",
  "National Insurance",
  "Oriental Insurance",
  "United India Insurance",
];

const emptyDraft = () => ({
  full_name: "",
  date_of_birth: "",
  gender: "",
  insurance_provider: "",
  policy_member_id: "",
  policy_holder_name: "",
  government_id: "",
  sum_insured: "",
  emergency_nature: "",
  exclusions_waiting_period: "",
});

const toDateInput = (raw) => {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(new RegExp("^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})$"));
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
};

export default function DriverInsuranceForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedBookingId = Number(searchParams.get("booking") || 0);
  const driverEmail = String(localStorage.getItem("user") || "").toLowerCase().trim();
  const driverName = String(localStorage.getItem("driver_name") || localStorage.getItem("driver") || "").toLowerCase().trim();
  const ambulanceId = Number(localStorage.getItem("ambulance_id") || "0");

  const [bookings, setBookings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(0);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const savingLocksRef = useRef(new Set());
  const bookingOverridesRef = useRef(new Map());

  const loadBookings = async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/?_=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const mine = rows.filter((b) => {
        if (!(b.status === "confirmed" && b.sent_to_driver)) return false;
        const bEmail = String(b.driver_email || "").toLowerCase().trim();
        const bName = String(b.driver || "").toLowerCase().trim();
        const byAmb = ambulanceId > 0 && Number(b.ambulance_id || 0) === ambulanceId;
        const byEmail = !!driverEmail && bEmail === driverEmail;
        const byName = !!driverName && bName === driverName;
        return byAmb || byEmail || byName;
      });
      setBookings(mine.map((booking) => ({
        ...booking,
        ...(bookingOverridesRef.current.get(Number(booking.id)) || {}),
      })));
      setDrafts((prev) => {
        const next = { ...prev };
        mine.forEach((b) => {
          if (!next[b.id]) {
            next[b.id] = {
              full_name: b.insurance_full_name || b.patient_name || b.booked_by || "",
              date_of_birth: toDateInput(b.insurance_dob),
              gender: b.insurance_gender || b.patient_gender || "",
              insurance_provider: b.insurance_provider || "",
              policy_member_id: b.insurance_policy_member_id || "",
              policy_holder_name: b.insurance_policy_holder_name || "",
              government_id: b.insurance_government_id || "",
              sum_insured: b.insurance_sum_insured || "",
              emergency_nature: b.insurance_emergency_nature || b.patient_condition || "",
              exclusions_waiting_period: b.insurance_exclusions_waiting || "",
            };
          }
        });
        return next;
      });
    } catch {
      setBookings([]);
    }
  };

  useEffect(() => {
    loadBookings();
    const t = setInterval(loadBookings, 10000);
    return () => clearInterval(t);
    // The loader intentionally runs once and owns its polling interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderedBookings = useMemo(() => {
    const list = [...bookings];
    if (selectedBookingId > 0) {
      list.sort((a, b) => {
        if (a.id === selectedBookingId) return -1;
        if (b.id === selectedBookingId) return 1;
        return Number(b.id) - Number(a.id);
      });
    }
    return list;
  }, [bookings, selectedBookingId]);

  const insuranceStats = useMemo(() => {
    const submitted = orderedBookings.filter((booking) => {
      const status = String(booking.insurance_status || "").toLowerCase();
      return Boolean(booking.insurance_submitted_at) || ["submitted", "approved", "rejected"].includes(status);
    }).length;
    return {
      total: orderedBookings.length,
      submitted,
      pending: Math.max(orderedBookings.length - submitted, 0),
    };
  }, [orderedBookings]);

  const updateDraft = (bookingId, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || emptyDraft()),
        [key]: value,
      },
    }));
  };

  const sendInsurance = async (booking) => {
    if (savingLocksRef.current.has(Number(booking.id))) return;
    const draft = drafts[booking.id] || emptyDraft();
    if (!draft.full_name || !draft.insurance_provider || !draft.policy_member_id) {
      setMsgType("error");
      setMsg("Full Name, Insurance Provider, and Policy/Member ID are required.");
      return;
    }
    savingLocksRef.current.add(Number(booking.id));
    setSavingId(booking.id);
    setMsgType("success");
    setMsg("");
    const submittedAt = new Date().toISOString();
    const insurancePatch = {
      insurance_status: "submitted",
      insurance_submitted_at: submittedAt,
      insurance_full_name: draft.full_name,
      insurance_dob: draft.date_of_birth,
      insurance_gender: draft.gender,
      insurance_provider: draft.insurance_provider,
      insurance_policy_member_id: draft.policy_member_id,
      insurance_policy_holder_name: draft.policy_holder_name,
      insurance_government_id: draft.government_id,
      insurance_sum_insured: draft.sum_insured,
      insurance_emergency_nature: draft.emergency_nature,
      insurance_exclusions_waiting: draft.exclusions_waiting_period,
    };
    bookingOverridesRef.current.set(Number(booking.id), insurancePatch);
    // Optimistic update so the card doesn't fluctuate
    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? {
              ...b,
              ...insurancePatch,
            }
          : b
      )
    );
    try {
      const res = await fetch(`${BASE}/api/bookings/${booking.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurance_details: {
            ...draft,
            submitted_by: booking.driver || driverName || "Ambulance Team",
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Insurance form send failed");
      bookingOverridesRef.current.set(Number(booking.id), { ...insurancePatch, ...json });
      setMsg(`Insurance details for Booking #${booking.id} were sent to the hospital.`);
      loadBookings();
    } catch (e) {
      bookingOverridesRef.current.delete(Number(booking.id));
      setMsgType("error");
      setMsg(e.message || "Insurance details send failed.");
    } finally {
      savingLocksRef.current.delete(Number(booking.id));
      setSavingId(0);
    }
  };

  return (
    <>
      <style>{`
        .di-root { min-height:100vh; box-sizing:border-box; padding:84px 24px 72px 88px; background:#f5f6f6; color:#171717; font-family:"Helvetica Neue",Arial,sans-serif; overflow-x:hidden; }
        .di-shell { width:100%; max-width:none; margin:0; }
        .di-header { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; padding:26px 28px; border:1px solid #d9dfdc; border-radius:18px; background:#fff; }
        .di-kicker { color:#126f1e; font-size:11px; font-weight:900; letter-spacing:1.5px; text-transform:uppercase; }
        .di-title { margin:8px 0 6px; font-size:clamp(32px,4vw,52px); line-height:1; letter-spacing:-1.5px; font-weight:900; }
        .di-subtitle { margin:0; color:#5b6962; font-size:14px; line-height:1.5; }
        .di-back { flex:0 0 auto; border:1px solid #b8c9bf; border-radius:9px; background:#fff; color:#171717; padding:12px 16px; font-weight:900; cursor:pointer; }
        .di-back:hover { border-color:#126f1e; background:#f1faf3; }
        .di-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:16px; }
        .di-summary-card { border:1px solid #d9dfdc; border-radius:12px; background:#fff; padding:16px 18px; }
        .di-summary-label { color:#68766f; font-size:10px; font-weight:900; letter-spacing:.8px; text-transform:uppercase; }
        .di-summary-value { margin-top:5px; font-size:27px; font-weight:900; }
        .di-summary-card.submitted .di-summary-value { color:#126f1e; }
        .di-summary-card.pending .di-summary-value { color:#c47a00; }
        .di-message { margin-top:14px; border:1px solid #a9d9b3; border-radius:10px; background:#f0fbf2; color:#126f1e; padding:12px 14px; font-size:13px; font-weight:800; }
        .di-message.error { border-color:#efb2b7; background:#fff3f4; color:#ae202b; }
        .di-list { display:grid; gap:16px; margin-top:16px; }
        .di-empty { border:1px dashed #b9c8bf; border-radius:14px; background:#fff; padding:42px 22px; color:#68766f; text-align:center; }
        .di-card { border:1px solid #cbd9cf; border-radius:16px; background:#fff; padding:20px; box-shadow:0 5px 18px rgba(31,82,48,.05); }
        .di-card.selected { border:2px solid #f2b233; box-shadow:0 8px 22px rgba(242,178,51,.12); }
        .di-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; padding-bottom:16px; border-bottom:1px solid #e3e9e5; }
        .di-card-kicker { color:#6a796f; font-size:10px; font-weight:900; letter-spacing:1px; text-transform:uppercase; }
        .di-booking { margin:5px 0 3px; font-size:28px; line-height:1; font-weight:900; }
        .di-driver { color:#5b6962; font-size:12px; }
        .di-chips { display:flex; gap:8px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }
        .di-chip { border:1px solid #cbd9cf; border-radius:999px; background:#fff; padding:7px 10px; color:#26332c; font-size:11px; font-weight:800; }
        .di-chip.status { border-color:#e6bb58; background:#fff8df; color:#805700; }
        .di-chip.status.sent { border-color:#a9d9b3; background:#f0fbf2; color:#126f1e; }
        .di-card-body { display:grid; grid-template-columns:minmax(220px,.72fr) minmax(0,2fr); gap:20px; padding-top:18px; }
        .di-patient-panel { align-self:start; border:1px solid #d5e4d8; border-radius:12px; background:#f5fbf6; padding:16px; }
        .di-patient-label { color:#6a796f; font-size:10px; font-weight:900; letter-spacing:.8px; text-transform:uppercase; }
        .di-patient-name { margin-top:8px; font-size:23px; font-weight:900; overflow-wrap:anywhere; }
        .di-patient-line { margin-top:10px; color:#3f5046; font-size:12px; line-height:1.55; overflow-wrap:anywhere; }
        .di-patient-line b { color:#17231b; }
        .di-route { margin-top:15px; padding-top:12px; border-top:1px solid #d5e4d8; color:#526359; font-size:12px; line-height:1.55; }
        .di-form-title { margin:0 0 12px; font-size:14px; font-weight:900; }
        .di-form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .di-field { display:flex; flex-direction:column; gap:6px; min-width:0; }
        .di-field.wide { grid-column:span 2; }
        .di-field.full { grid-column:1 / -1; }
        .di-label { color:#4d5c53; font-size:10px; font-weight:900; letter-spacing:.5px; text-transform:uppercase; }
        .di-input { width:100%; min-height:43px; box-sizing:border-box; border:1px solid #cbd7ce; border-radius:8px; background:#fff; color:#17231b; padding:10px 11px; font:inherit; font-size:13px; outline:none; }
        .di-input:focus { border-color:#126f1e; box-shadow:0 0 0 3px rgba(18,111,30,.10); }
        .di-textarea { min-height:82px; resize:vertical; }
        .di-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:16px; padding-top:15px; border-top:1px solid #e3e9e5; }
        .di-submit { border:1px solid #126f1e !important; border-radius:8px; background:#126f1e !important; color:#fff !important; padding:11px 16px; font-weight:900; cursor:pointer; }
        .di-submit:hover:not(:disabled) { background:#0d5b18 !important; }
        .di-submit:disabled { cursor:wait; opacity:.58; }
        .di-submit.sent { cursor:default; opacity:1; background:#087f3d !important; border-color:#087f3d !important; }
        .di-submitted-at { color:#68766f; font-size:12px; }
        @media (max-width: 1050px) { .di-card-body { grid-template-columns:1fr; } .di-form { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width: 767px) {
          .di-root { padding:84px 12px 88px; }
          .di-header { padding:20px 16px; }
          .di-header, .di-card-head { flex-direction:column; }
          .di-back { width:100%; }
          .di-summary { grid-template-columns:1fr 1fr; }
          .di-summary-card:last-child { grid-column:1 / -1; }
          .di-card { padding:14px; }
          .di-booking { font-size:24px; }
          .di-chips { justify-content:flex-start; }
          .di-form { grid-template-columns:1fr; }
          .di-field.wide, .di-field.full { grid-column:auto; }
        }
      `}</style>
      <main className="di-root">
        <div className="di-shell">
          <header className="di-header">
            <div>
              <div className="di-kicker">Driver insurance desk</div>
              <h1 className="di-title">Medical Insurance Forms</h1>
              <p className="di-subtitle">Complete one form for every assigned patient and send the details to the hospital for verification.</p>
            </div>
            <button className="di-back" type="button" onClick={() => navigate("/driver-dashboard?tab=bookings")}>Back to Driver Bookings</button>
          </header>

          <section className="di-summary" aria-label="Insurance form summary">
            <div className="di-summary-card"><div className="di-summary-label">Assigned patients</div><div className="di-summary-value">{insuranceStats.total}</div></div>
            <div className="di-summary-card submitted"><div className="di-summary-label">Sent to hospital</div><div className="di-summary-value">{insuranceStats.submitted}</div></div>
            <div className="di-summary-card pending"><div className="di-summary-label">Pending forms</div><div className="di-summary-value">{insuranceStats.pending}</div></div>
          </section>

          {msg && <div className={`di-message ${msgType === "error" ? "error" : ""}`} role="status">{msg}</div>}

          {orderedBookings.length === 0 ? (
            <div className="di-empty">No confirmed driver bookings found for insurance submission.</div>
          ) : (
            <section className="di-list" aria-label="Patient insurance forms">
              {orderedBookings.map((b) => {
                const d = drafts[b.id] || emptyDraft();
                const insuranceStatus = String(b.insurance_status || "").toLowerCase();
                const alreadySent = Boolean(b.insurance_submitted_at) || ["submitted", "approved", "rejected"].includes(insuranceStatus);
                const statusLabel = insuranceStatus === "approved" ? "Approved by hospital" : alreadySent ? "Sent to hospital" : "Pending form";
                return (
                  <article key={b.id} className={`di-card ${selectedBookingId === b.id ? "selected" : ""}`}>
                    <div className="di-card-head">
                      <div>
                        <div className="di-card-kicker">Patient insurance form</div>
                        <h2 className="di-booking">Booking #{b.id}</h2>
                        <div className="di-driver">Driver: {b.driver || driverName || "Assigned ambulance team"}</div>
                      </div>
                      <div className="di-chips">
                        <span className="di-chip">{b.booked_by || b.patient_name || "Patient"}</span>
                        <span className="di-chip">{b.pickup_location || "Pickup not added"}</span>
                        <span className={`di-chip status ${alreadySent ? "sent" : ""}`}>{statusLabel}</span>
                      </div>
                    </div>

                    <div className="di-card-body">
                      <aside className="di-patient-panel">
                        <div className="di-patient-label">Patient snapshot</div>
                        <div className="di-patient-name">{b.patient_name || b.booked_by || "Patient"}</div>
                        <div className="di-patient-line"><b>Age / Gender:</b> {b.patient_age || "-"} / {b.patient_gender || "-"}</div>
                        <div className="di-patient-line"><b>Condition:</b> {b.patient_condition || "Emergency details pending"}</div>
                        <div className="di-route"><b>Destination</b><br />{b.destination || b.assigned_hospital_name || "Hospital not assigned"}</div>
                      </aside>

                      <div>
                        <h3 className="di-form-title">Insurance details</h3>
                        <div className="di-form">
                          <label className="di-field"><span className="di-label">Full name *</span><input className="di-input" value={d.full_name} onChange={(e) => updateDraft(b.id, "full_name", e.target.value)} placeholder="Patient full name" /></label>
                          <label className="di-field"><span className="di-label">Date of birth</span><input className="di-input" type="date" value={d.date_of_birth} onChange={(e) => updateDraft(b.id, "date_of_birth", e.target.value)} /></label>
                          <label className="di-field"><span className="di-label">Gender</span><select className="di-input" value={d.gender} onChange={(e) => updateDraft(b.id, "gender", e.target.value)}><option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
                          <label className="di-field"><span className="di-label">Insurance provider *</span><input className="di-input" list={`insurance-provider-options-${b.id}`} value={d.insurance_provider} onChange={(e) => updateDraft(b.id, "insurance_provider", e.target.value)} placeholder="Select or type provider" /></label>
                          <datalist id={`insurance-provider-options-${b.id}`}>{INSURANCE_PROVIDERS.map((name) => <option key={name} value={name} />)}</datalist>
                          <label className="di-field"><span className="di-label">Policy / member ID *</span><input className="di-input" value={d.policy_member_id} onChange={(e) => updateDraft(b.id, "policy_member_id", e.target.value)} placeholder="Policy or member ID" /></label>
                          <label className="di-field"><span className="di-label">Policy holder name</span><input className="di-input" value={d.policy_holder_name} onChange={(e) => updateDraft(b.id, "policy_holder_name", e.target.value)} placeholder="Policy holder name" /></label>
                          <label className="di-field"><span className="di-label">Government ID</span><input className="di-input" value={d.government_id} onChange={(e) => updateDraft(b.id, "government_id", e.target.value)} placeholder="Aadhaar or other ID" /></label>
                          <label className="di-field"><span className="di-label">Sum insured</span><input className="di-input" value={d.sum_insured} onChange={(e) => updateDraft(b.id, "sum_insured", e.target.value)} placeholder="e.g. ₹5,00,000" /></label>
                          <label className="di-field wide"><span className="di-label">Emergency nature / condition</span><textarea className="di-input di-textarea" value={d.emergency_nature} onChange={(e) => updateDraft(b.id, "emergency_nature", e.target.value)} placeholder="Describe the emergency or treatment condition" /></label>
                          <label className="di-field wide"><span className="di-label">Exclusions / waiting period</span><textarea className="di-input di-textarea" value={d.exclusions_waiting_period} onChange={(e) => updateDraft(b.id, "exclusions_waiting_period", e.target.value)} placeholder="Add exclusions or waiting-period notes" /></label>
                        </div>
                        <div className="di-actions">
                          <button className={`di-submit ${alreadySent ? "sent" : ""}`} type="button" onClick={() => sendInsurance(b)} disabled={savingId === b.id || alreadySent}>{savingId === b.id ? "Sending..." : alreadySent ? "✓ Sent Successfully" : "Send to Hospital"}</button>
                          {b.insurance_submitted_at && <span className="di-submitted-at">Submitted: {new Date(b.insurance_submitted_at).toLocaleString("en-IN")}</span>}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
