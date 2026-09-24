import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StaffPatientCondition from "./StaffPatientCondition";
import LiveVideoConsultation from "./LiveVideoConsultation";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { fetchFreshJson, readDataCache, writeDataCache } from "../utils/dataCache";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const roleLabel = (role) => ({
  doctor: "Doctor",
  nurse: "Nurse",
  technician: "Technician",
  support: "Support Staff",
}[String(role || "").toLowerCase()] || "Hospital Staff");

const conditionTone = (booking) => {
  const text = `${booking?.patient_condition || ""} ${booking?.vitals_summary || ""}`.toLowerCase();
  if (["critical", "cardiac", "stroke", "trauma", "icu", "emergency"].some((token) => text.includes(token))) return "red";
  if (["pending", "monitor", "observation", "serious", "awaiting"].some((token) => text.includes(token))) return "yellow";
  return "green";
};

const toneCopy = {
  red: { label: "Priority", title: "Immediate attention", icon: AlertTriangle },
  yellow: { label: "Monitor", title: "Needs monitoring", icon: ShieldCheck },
  green: { label: "Stable", title: "Routine care", icon: CheckCircle2 },
};

const formatCaseStatus = (booking) => {
  if (booking?.status === "completed") return "Completed";
  if (booking?.status === "cancelled") return "Cancelled";
  if (booking?.assigned_bed_number) return "Bed assigned";
  return booking?.hospital_response === "ready" ? "Ready for intake" : "In progress";
};

export default function HospitalStaffPortal({ screen: propScreen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const staffId = localStorage.getItem("staff_id") || "";
  const email = localStorage.getItem("user") || "";
  const dashboardCacheKey = `staff_dashboard_${staffId || email}`;

  // Read cache lazily once on mount to avoid re-render loops
  const [dashboard, setDashboard] = useState(() => readDataCache(dashboardCacheKey, null));
  const [loading, setLoading] = useState(() => !readDataCache(dashboardCacheKey, null));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Single Source of Truth: URL pathname
  const currentPath = (location.pathname || window.location.pathname || "").toLowerCase().replace(/\/+$/, "");
  const activeScreen = useMemo(() => {
    if (currentPath === "/staff/profile") return "profile";
    if (currentPath === "/staff/cases") return "cases";
    if (currentPath === "/staff/patient-condition") return "patient-condition";
    if (currentPath === "/staff/live-video") return "live-video";
    if (currentPath === "/staff/home" || currentPath === "/staff/dashboard") return "home";
    return propScreen || "home";
  }, [currentPath, propScreen]);

  const isHomeRoute = activeScreen === "home";
  const isProfileRoute = activeScreen === "profile";
  const isCasesRoute = activeScreen === "cases";
  const isPhotosRoute = activeScreen === "patient-condition";
  const isVideoRoute = activeScreen === "live-video";

  const loadDashboard = useCallback(async (silent = false) => {
    if (!staffId || !email) {
      setError("Staff session is missing. Please sign in again with your hospital-issued credentials.");
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchFreshJson(
        `${BASE}/api/staff/dashboard/?staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`,
        { key: dashboardCacheKey, fallback: {} }
      );
      setDashboard(data);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load staff dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboardCacheKey, email, staffId]);

  useEffect(() => {
    if (isHomeRoute || isProfileRoute || isCasesRoute) {
      const hasCached = readDataCache(dashboardCacheKey, null) !== null;
      loadDashboard(hasCached);
    }
  }, [dashboardCacheKey, loadDashboard, currentPath, isHomeRoute, isProfileRoute, isCasesRoute]);

  if (isPhotosRoute) {
    return <StaffPatientCondition key={`staff-photos-${currentPath}`} />;
  }
  if (isVideoRoute) {
    return <LiveVideoConsultation key={`staff-video-${currentPath}`} />;
  }

  const staff = dashboard?.staff || {};
  const hospital = dashboard?.hospital || {};
  const summary = dashboard?.summary || {};
  const cases = useMemo(() => (Array.isArray(dashboard?.cases) ? dashboard.cases : []), [dashboard]);
  const sortedCases = useMemo(() => [...cases].sort((a, b) => {
    const rank = { red: 0, yellow: 1, green: 2 };
    return (rank[conditionTone(a)] ?? 3) - (rank[conditionTone(b)] ?? 3);
  }), [cases]);

  return (
    <main className="staff-portal-root">
      <style>{`
        .staff-portal-root {
          min-height: 100vh;
          width: calc(100% - 64px);
          box-sizing: border-box;
          margin-left: 64px;
          padding: 88px 24px 64px;
          background: #ffffff;
          color: #122118;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .staff-portal-shell { width: 100%; max-width: 1440px; margin: 0 auto; min-width: 0; }
        .staff-portal-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 26px; }
        .staff-kicker { color: #126f1e; font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
        .staff-title { margin: 8px 0 5px; font-size: clamp(32px, 4vw, 54px); line-height: 1; letter-spacing: -.05em; color: #101510; }
        .staff-subtitle { margin: 0; color: #66756b; font-size: 15px; }
        .staff-actions { display: flex; gap: 10px; align-items: center; }
        .staff-action { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #c8d7cb; border-radius: 9px; background: #fff; color: #12351b; padding: 11px 14px; font-weight: 800; cursor: pointer; }
        .staff-action.primary { background: #126f1e; color: #fff; border-color: #126f1e; }
        .staff-action:hover { border-color: #126f1e; }
        .staff-identity { display: flex; align-items: center; gap: 14px; background: #f5fbf6; border: 1px solid #c9e3ce; border-radius: 14px; padding: 15px 18px; margin-bottom: 22px; }
        .staff-avatar { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: #dff4e2; color: #126f1e; font-weight: 900; font-size: 19px; }
        .staff-identity-name { font-weight: 900; font-size: 17px; color: #102315; }
        .staff-identity-meta { color: #65766b; font-size: 12px; margin-top: 3px; }
        .staff-chip { margin-left: auto; color: #126f1e; background: #e8f7e9; border: 1px solid #a9d9af; border-radius: 999px; padding: 7px 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .staff-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
        .staff-stat { border: 1px solid #d4dfd6; border-radius: 13px; padding: 17px; background: #fff; }
        .staff-stat-label { color: #6d7a70; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
        .staff-stat-value { font-size: 32px; line-height: 1; margin-top: 9px; color: #126f1e; font-weight: 900; }
        .staff-stat.red .staff-stat-value { color: #c62828; }
        .staff-stat.yellow .staff-stat-value { color: #b77900; }
        .staff-content { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 20px; align-items: start; }
        .staff-panel { border: 1px solid #d4dfd6; border-radius: 15px; background: #fff; overflow: hidden; }
        .staff-panel-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid #e5ece6; }
        .staff-panel-title { font-size: 18px; font-weight: 900; color: #142019; }
        .staff-panel-caption { color: #758078; font-size: 12px; margin-top: 3px; }
        .staff-case-list { display: grid; gap: 11px; padding: 14px; background: #fbfdfb; }
        .staff-case { display: grid; grid-template-columns: 9px minmax(0, 1fr) auto; gap: 15px; align-items: center; border: 1px solid #dce7de; border-radius: 12px; padding: 16px; background: #fff; }
        .staff-case-bar { align-self: stretch; min-height: 65px; border-radius: 8px; background: #1d8c2a; }
        .staff-case-bar.red { background: #d51f2a; }
        .staff-case-bar.yellow { background: #f3b51b; }
        .staff-case-main { min-width: 0; }
        .staff-case-top { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .staff-tone { border-radius: 5px; padding: 4px 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
        .staff-tone.red { color: #a9131c; background: #ffe2e4; }
        .staff-tone.yellow { color: #835800; background: #fff1be; }
        .staff-tone.green { color: #126f1e; background: #dff4e2; }
        .staff-case-name { font-size: 16px; font-weight: 900; color: #132016; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .staff-case-meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 9px; color: #68756c; font-size: 12px; }
        .staff-case-condition { margin-top: 7px; color: #36433a; font-size: 13px; }
        .staff-case-side { text-align: right; min-width: 112px; }
        .staff-case-status { color: #126f1e; font-weight: 900; font-size: 12px; }
        .staff-case-bed { margin-top: 7px; font-size: 12px; color: #68756c; }
        .staff-side-stack { display: grid; gap: 14px; }
        .staff-info { padding: 18px; }
        .staff-info h3 { margin: 0 0 14px; font-size: 15px; color: #142019; }
        .staff-info-row { display: flex; justify-content: space-between; gap: 14px; padding: 10px 0; border-bottom: 1px solid #edf2ee; font-size: 12px; }
        .staff-info-row:last-child { border-bottom: 0; }
        .staff-info-row span:first-child { color: #738077; }
        .staff-info-row span:last-child { color: #17251a; font-weight: 800; text-align: right; overflow-wrap: anywhere; }
        .staff-empty, .staff-error { margin: 14px; padding: 34px 18px; border: 1px dashed #bcd1c0; border-radius: 11px; text-align: center; color: #69776c; background: #fbfdfb; }
        .staff-error { color: #a62028; background: #fff5f5; border-color: #efb9bd; }
        @media (max-width: 900px) { .staff-content { grid-template-columns: 1fr; } .staff-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .staff-home-grid { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr); gap:18px; align-items:stretch; }
        .staff-home-hero { border:1px solid #c9e3ce; border-radius:15px; padding:24px; background:linear-gradient(135deg,#f4fbf5,#ffffff); }
        .staff-home-hero h2 { margin:0; font-size:clamp(24px,3vw,38px); letter-spacing:-.04em; color:#142019; }
        .staff-home-hero p { color:#68756c; line-height:1.6; max-width:680px; margin:10px 0 18px; }
        .staff-home-actions { display:flex; flex-wrap:wrap; gap:9px; }
        .staff-home-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .staff-home-card { border:1px solid #d4dfd6; border-radius:14px; padding:18px; background:#fff; }
        .staff-home-card strong { display:block; font-size:26px; color:#126f1e; margin-top:8px; }
        .staff-home-card span { color:#6d7a70; font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
        .staff-home-alert { margin-top:18px; border:1px solid #f0d28a; border-radius:12px; padding:13px 15px; background:#fff9e5; color:#805b00; font-size:13px; font-weight:800; }
        .staff-home-latest { margin-top:18px; }
        .staff-home-latest .staff-case { margin-top:10px; }
        .staff-profile-layout { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:18px; align-items:start; }
        .staff-profile-card { border:1px solid #d4dfd6; border-radius:15px; background:#fff; padding:22px; }
        .staff-profile-card h2 { margin:0 0 16px; font-size:20px; color:#142019; }
        .staff-profile-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .staff-profile-field { border:1px solid #e4ece5; border-radius:10px; padding:12px; min-width:0; }
        .staff-profile-field small { display:block; color:#758078; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
        .staff-profile-field strong { display:block; margin-top:6px; color:#142019; overflow-wrap:anywhere; }
        .staff-profile-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .staff-profile-metric { border:1px solid #d4dfd6; border-radius:12px; padding:14px; background:#fbfdfb; }
        .staff-profile-metric b { display:block; font-size:26px; color:#126f1e; }
        .staff-profile-metric span { font-size:11px; color:#6d7a70; }
        @media (max-width: 900px) { .staff-content,.staff-profile-layout,.staff-home-grid { grid-template-columns:1fr; } .staff-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width: 767px) { .staff-portal-root { width: 100%; margin-left: 0; padding: 84px 12px 96px; overflow-x: hidden; } .staff-portal-shell { max-width: none; } .staff-portal-top { display: block; } .staff-actions { margin-top: 16px; } }
        @media (max-width: 600px) { .staff-stats { gap: 8px; } .staff-stat { padding: 13px; } .staff-stat-value { font-size: 25px; } .staff-case { grid-template-columns: 7px minmax(0, 1fr); } .staff-case-side { grid-column: 2; text-align: left; } .staff-chip { margin-left: 0; } .staff-profile-grid { grid-template-columns:1fr; } }
      `}</style>

      <div className="staff-portal-shell">
        <header className="staff-portal-top">
          <div>
            <div className="staff-kicker">Hospital operations · staff portal</div>
            <h1 className="staff-title">{isHomeRoute ? "Staff home" : isProfileRoute ? "My profile" : "Assigned cases"}</h1>
            <p className="staff-subtitle">{isHomeRoute ? "Your care-team workspace, alerts and daily case overview." : isProfileRoute ? "Your hospital identity, assignment history and care-team performance." : "Manage the patients, beds and handovers assigned to your care team."}</p>
          </div>
          <div className="staff-actions">
            <button className="staff-action" onClick={() => loadDashboard(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? "staff-spin" : ""} /> Refresh
            </button>
            {!isHomeRoute && <button className="staff-action" onClick={() => navigate("/staff/home")}>Staff home</button>}
            {!isCasesRoute && <button className="staff-action" onClick={() => navigate("/staff/cases")}>Assigned cases</button>}
            {!isProfileRoute && <button className="staff-action primary" onClick={() => navigate("/staff/profile")}>My profile</button>}
            <button className="staff-action" onClick={() => navigate("/staff/patient-condition")}>Patient condition photos</button>
          </div>
        </header>

        <section className="staff-identity">
          <div className="staff-avatar">{(staff.full_name || localStorage.getItem("name") || "S").charAt(0).toUpperCase()}</div>
          <div>
            <div className="staff-identity-name">{staff.full_name || localStorage.getItem("name") || "Hospital Staff"}</div>
            <div className="staff-identity-meta">{roleLabel(staff.role || localStorage.getItem("staff_role"))} · {hospital.name || localStorage.getItem("hospital_name") || "Hospital"}</div>
          </div>
          <span className="staff-chip">{staff.staff_id || staffId}</span>
        </section>

        {error && <div className="staff-error">{error}</div>}
        {loading && !dashboard && !error && <div className="staff-empty">Loading your assigned cases…</div>}

        {dashboard && isHomeRoute && (
          <>
            <section className="staff-home-grid">
              <div className="staff-home-hero">
                <div className="staff-kicker">{roleLabel(staff.role)} · {hospital.name || "Hospital"}</div>
                <h2>Welcome back, {staff.full_name || "care-team member"}.</h2>
                <p>Your allocated cases, bed details and driver condition photos are kept in one workspace. Open Assigned Cases to start working on a patient.</p>
                <div className="staff-home-actions"><button className="staff-action primary" onClick={() => navigate("/staff/cases")}>Open assigned cases <ArrowRight size={15} /></button><button className="staff-action" onClick={() => navigate("/staff/patient-condition")}>View patient photos</button></div>
                {summary.new_allocations > 0 && <div className="staff-home-alert"><Clock3 size={15} style={{ verticalAlign:"-3px", marginRight:6 }} />{summary.new_allocations} booking(s) allocated to you. Please open Assigned Cases and begin the handover.</div>}
              </div>
              <div className="staff-home-summary"><div className="staff-home-card"><span>Active care</span><strong>{summary.active_cases || 0}</strong></div><div className="staff-home-card"><span>Priority cases</span><strong style={{ color:"#c62828" }}>{summary.urgent_cases || 0}</strong></div><div className="staff-home-card"><span>Completed</span><strong>{summary.completed_cases || 0}</strong></div><div className="staff-home-card"><span>Beds allocated</span><strong>{summary.bed_allocated_cases || 0}</strong></div></div>
            </section>
            <section className="staff-panel staff-home-latest"><div className="staff-panel-head"><div><div className="staff-panel-title">Latest allocation</div><div className="staff-panel-caption">Cases assigned to your role at {hospital.name || "your hospital"}</div></div><ClipboardList size={20} color="#126f1e" /></div>{sortedCases.slice(0,3).map((booking) => { const tone = conditionTone(booking); return <article className="staff-case" key={booking.id}><div className={`staff-case-bar ${tone}`} /><div className="staff-case-main"><div className="staff-case-top"><span className={`staff-tone ${tone}`}>{toneCopy[tone].label}</span><div className="staff-case-name">{booking.patient_name || booking.booked_by || "Patient"}</div></div><div className="staff-case-meta"><span>Booking #{booking.id}</span><span>{booking.assigned_hospital_name || hospital.name || "Hospital"}</span></div><div className="staff-case-condition">{booking.patient_condition || booking.vitals_summary || "Clinical details pending"}</div></div><div className="staff-case-side"><div className="staff-case-status">{formatCaseStatus(booking)}</div><div className="staff-case-bed"><BedDouble size={13} style={{ verticalAlign:"-2px" }} /> {booking.assigned_bed_number || "Bed pending"}</div></div></article>})}{!sortedCases.length && <div className="staff-empty">No booking has been allocated to you yet.</div>}</section>
          </>
        )}

        {dashboard && isProfileRoute && (
          <section className="staff-profile-layout">
            <div className="staff-profile-card"><h2><UserRound size={18} style={{ verticalAlign:"-3px", marginRight:7 }} /> Staff details</h2><div className="staff-profile-grid"><div className="staff-profile-field"><small>Full name</small><strong>{staff.full_name || "—"}</strong></div><div className="staff-profile-field"><small>Role</small><strong>{roleLabel(staff.role)}</strong></div><div className="staff-profile-field"><small>Staff ID</small><strong>{staff.staff_id || staffId}</strong></div><div className="staff-profile-field"><small>Registration number</small><strong>{staff.registration_number || "—"}</strong></div><div className="staff-profile-field"><small>Email</small><strong><Mail size={13} style={{ verticalAlign:"-2px", marginRight:5 }} />{staff.email || email || "—"}</strong></div><div className="staff-profile-field"><small>Contact number</small><strong><Phone size={13} style={{ verticalAlign:"-2px", marginRight:5 }} />{staff.contact_number || "—"}</strong></div><div className="staff-profile-field"><small>Specialization</small><strong>{staff.specialization || "General care"}</strong></div><div className="staff-profile-field"><small>Experience / shift</small><strong>{staff.years_experience || 0} years · {staff.shift || "Day"}</strong></div><div className="staff-profile-field"><small>Hospital</small><strong>{hospital.name || "—"}</strong></div><div className="staff-profile-field"><small>On call</small><strong>{staff.is_on_call ? "Yes" : "No"}</strong></div></div></div>
            <aside className="staff-profile-card"><h2><ClipboardList size={18} style={{ verticalAlign:"-3px", marginRight:7 }} /> Assignment history</h2><div className="staff-profile-metrics"><div className="staff-profile-metric"><b>{summary.assigned_cases || 0}</b><span>Total assigned</span></div><div className="staff-profile-metric"><b>{summary.active_cases || 0}</b><span>Active cases</span></div><div className="staff-profile-metric"><b>{summary.completed_cases || 0}</b><span>Completed</span></div><div className="staff-profile-metric"><b style={{ color:"#c62828" }}>{summary.urgent_cases || 0}</b><span>Priority cases</span></div><div className="staff-profile-metric"><b>{summary.bed_allocated_cases || 0}</b><span>Beds allocated</span></div><div className="staff-profile-metric"><b>{summary.team_members || 0}</b><span>Team members on cases</span></div></div><button className="staff-action primary" style={{ marginTop:18, width:"100%", justifyContent:"center" }} onClick={() => navigate("/staff/cases")}>Open my assigned cases <ArrowRight size={15} /></button></aside>
          </section>
        )}

        {dashboard && isCasesRoute && (
          <>
            <section className="staff-stats">
              <div className="staff-stat"><div className="staff-stat-label">Assigned cases</div><div className="staff-stat-value">{summary.assigned_cases || 0}</div></div>
              <div className="staff-stat yellow"><div className="staff-stat-label">Active care</div><div className="staff-stat-value">{summary.active_cases || 0}</div></div>
              <div className="staff-stat red"><div className="staff-stat-label">Priority cases</div><div className="staff-stat-value">{summary.urgent_cases || 0}</div></div>
              <div className="staff-stat"><div className="staff-stat-label">Beds allocated</div><div className="staff-stat-value">{summary.bed_allocated_cases || 0}</div></div>
            </section>

            <section className="staff-content">
              <div className="staff-panel">
                <div className="staff-panel-head">
                  <div><div className="staff-panel-title">My assigned patients</div><div className="staff-panel-caption">Live cases linked to your staff account</div></div>
                  <ClipboardList size={20} color="#126f1e" />
                </div>
                {sortedCases.length === 0 ? (
                  <div className="staff-empty">No cases are assigned to you right now.</div>
                ) : (
                  <div className="staff-case-list">
                    {sortedCases.map((booking) => {
                      const tone = conditionTone(booking);
                      const ToneIcon = toneCopy[tone].icon;
                      return (
                        <article className="staff-case" key={booking.id}>
                          <div className={`staff-case-bar ${tone}`} />
                          <div className="staff-case-main">
                            <div className="staff-case-top">
                              <span className={`staff-tone ${tone}`}>{toneCopy[tone].label}</span>
                              <div className="staff-case-name">{booking.patient_name || booking.booked_by || "Unknown patient"}</div>
                            </div>
                            <div className="staff-case-meta">
                              <span>Booking #{booking.id}</span>
                              <span>{booking.patient_age || "Age —"} · {booking.patient_gender || "Gender —"}</span>
                              <span><Building2 size={13} style={{ verticalAlign: "-2px" }} /> {booking.assigned_hospital_name || hospital.name || "Hospital"}</span>
                            </div>
                            <div className="staff-case-condition"><ToneIcon size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} /> {booking.patient_condition || booking.vitals_summary || "Clinical details pending"}</div>
                          </div>
                          <div className="staff-case-side">
                            <div className="staff-case-status">{formatCaseStatus(booking)}</div>
                            <div className="staff-case-bed"><BedDouble size={13} style={{ verticalAlign: "-2px" }} /> {booking.assigned_bed_number || "Bed pending"}</div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="staff-side-stack">
                <div className="staff-panel staff-info">
                  <h3><UserRound size={16} style={{ verticalAlign: "-3px", marginRight: 7 }} /> My profile</h3>
                  <div className="staff-info-row"><span>Role</span><span>{roleLabel(staff.role)}</span></div>
                  <div className="staff-info-row"><span>Staff ID</span><span>{staff.staff_id || staffId}</span></div>
                  <div className="staff-info-row"><span>Registration</span><span>{staff.registration_number || localStorage.getItem("registration_number") || "—"}</span></div>
                  <div className="staff-info-row"><span>Specialization</span><span>{staff.specialization || "General care"}</span></div>
                </div>
                <div className="staff-panel staff-info">
                  <h3><Building2 size={16} style={{ verticalAlign: "-3px", marginRight: 7 }} /> Hospital</h3>
                  <div className="staff-info-row"><span>Name</span><span>{hospital.name || "—"}</span></div>
                  <div className="staff-info-row"><span>Contact</span><span>{hospital.contact_number || "—"}</span></div>
                  <div className="staff-info-row"><span>Available beds</span><span>{hospital.available_beds ?? "—"}</span></div>
                  <div className="staff-info-row"><span>Portal status</span><span style={{ color: "#126f1e" }}><Stethoscope size={13} style={{ verticalAlign: "-2px" }} /> Connected</span></div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
