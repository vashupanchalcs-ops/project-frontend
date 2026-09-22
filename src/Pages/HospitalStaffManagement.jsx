import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Edit3,
  Filter,
  Mail,
  MoreHorizontal,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const ROLE_META = {
  doctor: { label: "Doctors", singular: "Doctor", color: "#2563eb", soft: "#eff6ff" },
  nurse: { label: "Nurses", singular: "Nurse", color: "#7c3aed", soft: "#f5f3ff" },
  technician: { label: "Technicians", singular: "Technician", color: "#0891b2", soft: "#ecfeff" },
  support: { label: "Support Staff", singular: "Support Staff", color: "#d97706", soft: "#fffbeb" },
  coordinator: { label: "Coordinators", singular: "Coordinator", color: "#059669", soft: "#ecfdf5" },
  administrator: { label: "Administrators", singular: "Administrator", color: "#be185d", soft: "#fdf2f8" },
  other: { label: "Other", singular: "Other", color: "#475569", soft: "#f8fafc" },
};

const SHIFT_LABELS = { day: "Day shift", night: "Night shift", rotational: "Rotational", on_call: "On call" };
const FILTERS = [
  ["all", "All Staff"],
  ["doctor", "Doctors"],
  ["nurse", "Nurses"],
  ["technician", "Technicians"],
  ["support", "Support Staff"],
];

const EMPTY_FORM = {
  full_name: "",
  role: "doctor",
  staff_id: "",
  registration_number: "",
  specialization: "",
  contact_number: "",
  email: "",
  years_experience: 0,
  shift: "day",
  is_on_call: false,
  is_active: true,
  notes: "",
};

function safeJson(key, fallback) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function roleMeta(role) {
  return ROLE_META[String(role || "other").toLowerCase()] || ROLE_META.other;
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function getHospitalId() {
  const value = Number(localStorage.getItem("hospital_id") || "0");
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function HospitalStaffManagement({ directoryOnly = false }) {
  const cached = useMemo(() => safeJson("hospital_staff_management_cache", null), []);
  const [hospital, setHospital] = useState(cached?.hospital || null);
  const [staff, setStaff] = useState(Array.isArray(cached?.staff) ? cached.staff : []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [directoryTab, setDirectoryTab] = useState("employees");

  const resolveHospital = useCallback(async () => {
    const currentId = getHospitalId();
    if (currentId) return currentId;

    const email = (localStorage.getItem("user") || "").trim();
    if (email) {
      const byEmail = await fetch(`${BASE}/api/hospitals/by-email/?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      if (byEmail.ok) {
        const data = await byEmail.json();
        const id = Number(data?.hospital_id || data?.id || 0);
        if (id) {
          localStorage.setItem("hospital_id", String(id));
          return id;
        }
      }
    }

    const response = await fetch(`${BASE}/api/hospitals/`, { cache: "no-store" });
    if (!response.ok) throw new Error("Hospital list could not be loaded");
    const rows = await response.json();
    const first = Array.isArray(rows) ? rows[0] : null;
    const id = Number(first?.id || first?.hospital_id || 0);
    if (!id) throw new Error("Hospital account was not found");
    localStorage.setItem("hospital_id", String(id));
    return id;
  }, []);

  const loadStaff = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const id = await resolveHospital();
      // The directory should not wait on the large dashboard/queue payload.
      // Read the staff collection directly so the roster renders immediately
      // even when the live-case dashboard is slow or temporarily unavailable.
      const [staffResponse, hospitalResponse] = await Promise.all([
        fetch(`${BASE}/api/hospitals/${id}/staff/?_=${Date.now()}`, { cache: "no-store" }),
        fetch(`${BASE}/api/hospitals/${id}/?_=${Date.now()}`, { cache: "no-store" }),
      ]);
      if (!staffResponse.ok) throw new Error(`Staff data could not be loaded (${staffResponse.status})`);
      const rows = await staffResponse.json();
      const hospitalData = hospitalResponse.ok ? await hospitalResponse.json().catch(() => null) : null;
      const normalizedRows = Array.isArray(rows) ? rows : [];
      setHospital(hospitalData || null);
      setStaff(normalizedRows);
      sessionStorage.setItem("hospital_staff_management_cache", JSON.stringify({ hospital: hospitalData || null, staff: normalizedRows }));
      return { id, data: { hospital: hospitalData, staff: normalizedRows } };
    } catch (requestError) {
      setError(requestError?.message || "Staff data could not be loaded");
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveHospital]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((member) => member.is_active).length,
    inactive: staff.filter((member) => !member.is_active).length,
    doctors: staff.filter((member) => member.role === "doctor").length,
    nurses: staff.filter((member) => member.role === "nurse").length,
    technicians: staff.filter((member) => member.role === "technician").length,
  }), [staff]);

  const visibleStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? member.is_active : !member.is_active);
      const searchable = [member.full_name, member.staff_id, member.registration_number, member.specialization, member.email, member.contact_number, roleMeta(member.role).label].join(" ").toLowerCase();
      return matchesRole && matchesStatus && (!term || searchable.includes(term));
    });
  }, [roleFilter, search, staff, statusFilter]);

  const departmentRows = useMemo(() => Object.entries(ROLE_META).map(([key, meta]) => ({
    key,
    ...meta,
    total: staff.filter((member) => member.role === key).length,
    active: staff.filter((member) => member.role === key && member.is_active).length,
  })).filter((row) => row.total > 0 || !directoryOnly), [directoryOnly, staff]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setDrawer({ mode: "create", member: null });
    setError("");
  };

  const openEdit = (member) => {
    setForm({ ...EMPTY_FORM, ...member, years_experience: Number(member.years_experience || 0) });
    setDrawer({ mode: "edit", member });
    setError("");
  };

  const closeDrawer = () => {
    if (!saving) setDrawer(null);
  };

  const updateForm = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : name === "years_experience" ? Number(value) : value }));
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.staff_id.trim() || !form.registration_number.trim()) {
      setError("Name, Staff ID and Registration No. are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const id = await resolveHospital();
      const isEdit = drawer?.mode === "edit";
      const url = isEdit
        ? `${BASE}/api/hospitals/${id}/staff/${drawer.member.id}/`
        : `${BASE}/api/hospitals/${id}/staff/`;
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, years_experience: Number(form.years_experience || 0) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Staff record could not be saved");
      setNotice(isEdit ? "Staff profile updated successfully." : "Staff profile added successfully.");
      setDrawer(null);
      await loadStaff({ silent: true });
      window.setTimeout(() => setNotice(""), 3500);
    } catch (requestError) {
      setError(requestError?.message || "Staff record could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (member) => {
    try {
      const id = await resolveHospital();
      const response = await fetch(`${BASE}/api/hospitals/${id}/staff/${member.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !member.is_active }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Status could not be updated");
      setStaff((current) => current.map((row) => row.id === member.id ? payload : row));
      setNotice(`${member.full_name} is now ${payload.is_active ? "active" : "off duty"}.`);
      window.setTimeout(() => setNotice(""), 3000);
    } catch (requestError) {
      setError(requestError?.message || "Status could not be updated");
    }
  };

  const removeStaff = async (member) => {
    if (!window.confirm(`Remove ${member.full_name} from this hospital staff list?`)) return;
    try {
      const id = await resolveHospital();
      const response = await fetch(`${BASE}/api/hospitals/${id}/staff/${member.id}/`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Staff profile could not be removed");
      setStaff((current) => current.filter((row) => row.id !== member.id));
      setNotice("Staff profile removed.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (requestError) {
      setError(requestError?.message || "Staff profile could not be removed");
    }
  };

  const title = directoryOnly ? "Employment & Staff Management" : "Doctors & Staff Management";
  const subtitle = directoryOnly
    ? "A complete employee directory with department, position and current availability."
    : "Create, review and manage every doctor, nurse, technician and support professional.";

  return (
    <div className="hsm-page">
      <style>{STYLES}</style>
      {directoryOnly ? (
        <section className="hsm-directory-hero">
          <div>
            <div className="hsm-eyebrow"><UsersRound size={15} /> {hospital?.name || "Hospital"}</div>
            <h1>Employee Management System</h1>
            <p>Live employee records by department, position and current availability.</p>
          </div>
          <button className="hsm-btn hsm-btn-light" onClick={() => loadStaff({ silent: true })} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "hsm-spin" : ""} /> Refresh
          </button>
        </section>
      ) : (
        <header className="hsm-topbar">
          <div>
            <div className="hsm-eyebrow"><UsersRound size={15} /> {hospital?.name || "Hospital"}</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="hsm-actions">
            <button className="hsm-btn hsm-btn-light" onClick={() => loadStaff({ silent: true })} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "hsm-spin" : ""} /> Refresh
            </button>
            <button className="hsm-btn hsm-btn-primary" onClick={openCreate}><UserPlus size={16} /> Add Staff</button>
          </div>
        </header>
      )}

      <section className="hsm-stats">
        <Stat label="Total employees" value={stats.total} detail="Registered hospital staff" icon={<UsersRound size={18} />} />
        <Stat label="Active now" value={stats.active} detail="Available in the portal" tone="green" icon={<Check size={18} />} />
        <Stat label="Off duty" value={stats.inactive} detail="Temporarily unavailable" tone="amber" icon={<ShieldCheck size={18} />} />
        <Stat label="Doctors" value={stats.doctors} detail={`${stats.nurses} nurses · ${stats.technicians} technicians`} tone="blue" icon={<Stethoscope size={18} />} />
      </section>

      {directoryOnly && (
        <nav className="hsm-directory-tabs" aria-label="Employee views">
          {[["employees", "Employees"], ["departments", "Departments"]].map(([key, label]) => (
            <button key={key} className={directoryTab === key ? "is-active" : ""} onClick={() => setDirectoryTab(key)}>{label}</button>
          ))}
        </nav>
      )}

      {directoryOnly && directoryTab !== "employees" ? (
        <DirectorySummary tab={directoryTab} rows={departmentRows} staff={staff} />
      ) : directoryOnly ? (
        <>
          <section className="hsm-toolbar">
            <label className="hsm-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees, staff ID, email or specialty" /></label>
            <label className="hsm-select"><Filter size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Off duty</option></select><ChevronDown size={15} /></label>
            <span className="hsm-result-count">{visibleStaff.length} of {staff.length} employees</span>
          </section>
          {error && <div className="hsm-alert hsm-alert-error">{error}</div>}
          {notice && <div className="hsm-alert hsm-alert-success"><Check size={16} /> {notice}</div>}
          {loading ? <div className="hsm-empty">Loading staff records…</div> : visibleStaff.length === 0 ? <div className="hsm-empty">No staff records match this view.</div> : <EmployeeTable rows={visibleStaff} onEdit={openEdit} onToggle={toggleStatus} />}
        </>
      ) : (
        <>
          <section className="hsm-toolbar">
            <label className="hsm-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, staff ID, email or specialty" /></label>
            <label className="hsm-select"><Filter size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Off duty</option></select><ChevronDown size={15} /></label>
            <span className="hsm-result-count">{visibleStaff.length} of {staff.length} employees</span>
          </section>

          {!directoryOnly && <nav className="hsm-filter-tabs" aria-label="Staff filters">
            {FILTERS.map(([key, label]) => <button key={key} className={roleFilter === key ? "is-active" : ""} onClick={() => setRoleFilter(key)}>{label}<span>{key === "all" ? staff.length : staff.filter((member) => member.role === key).length}</span></button>)}
          </nav>}

          {error && <div className="hsm-alert hsm-alert-error">{error}</div>}
          {notice && <div className="hsm-alert hsm-alert-success"><Check size={16} /> {notice}</div>}
          {loading ? <div className="hsm-empty">Loading staff records…</div> : visibleStaff.length === 0 ? <div className="hsm-empty">No staff records match this view.</div> : (
            <section className="hsm-grid">
              {visibleStaff.map((member) => <StaffCard key={member.id} member={member} onEdit={openEdit} onToggle={toggleStatus} onRemove={removeStaff} />)}
            </section>
          )}
        </>
      )}

      {drawer && <StaffDrawer form={form} drawer={drawer} saving={saving} error={error} onChange={updateForm} onSubmit={submitForm} onClose={closeDrawer} />}
    </div>
  );
}

function Stat({ label, value, detail, icon, tone = "purple" }) {
  return <div className={`hsm-stat hsm-stat-${tone}`}><div className="hsm-stat-icon">{icon}</div><div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div></div>;
}

function StaffCard({ member, onEdit, onToggle, onRemove }) {
  const meta = roleMeta(member.role);
  return <article className="hsm-card">
    <div className="hsm-card-top" style={{ background: `linear-gradient(120deg, ${meta.soft}, #fff)` }}>
      <span className="hsm-role-chip" style={{ color: meta.color, background: meta.soft }}>{meta.singular}</span>
      <div className="hsm-card-menu"><button aria-label="Edit staff" onClick={() => onEdit(member)}><Edit3 size={15} /></button><button aria-label="Remove staff" onClick={() => onRemove(member)}><Trash2 size={15} /></button></div>
    </div>
    <div className="hsm-card-body">
      <h3>{member.full_name || "Unnamed staff"}</h3>
      <p className="hsm-handle">@{member.role || "staff"}</p>
      <div className="hsm-status-line"><span className={`hsm-status-dot ${member.is_active ? "active" : "inactive"}`} />{member.is_active ? "Active" : "Off duty"}<button onClick={() => onToggle(member)}>{member.is_active ? "Set off duty" : "Set active"}</button></div>
      <dl className="hsm-details">
        <div><dt>Staff ID</dt><dd>{member.staff_id || "Pending"}</dd></div>
        <div><dt>Reg. No.</dt><dd>{member.registration_number || "Pending"}</dd></div>
        <div><dt>Department</dt><dd>{meta.singular}</dd></div>
        <div><dt>Specialty</dt><dd>{member.specialization || "General care"}</dd></div>
        <div><dt>Experience</dt><dd>{Number(member.years_experience || 0)} years</dd></div>
        <div><dt>Shift</dt><dd>{SHIFT_LABELS[member.shift] || "Day shift"}{member.is_on_call ? " · On call" : ""}</dd></div>
      </dl>
      <div className="hsm-contact"><span><Mail size={14} /> {member.email || "Email not added"}</span><span><Phone size={14} /> {member.contact_number || "Contact not added"}</span></div>
      <div className="hsm-card-footer">Joined {formatDate(member.joined_on || member.created_at)}<button onClick={() => onEdit(member)}>View / edit <MoreHorizontal size={15} /></button></div>
    </div>
  </article>;
}

function StaffDrawer({ form, drawer, saving, error, onChange, onSubmit, onClose }) {
  const isEdit = drawer.mode === "edit";
  return <div className="hsm-drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="hsm-drawer" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit staff" : "Add staff"}>
      <div className="hsm-drawer-head"><div><span className="hsm-eyebrow">STAFF PROFILE</span><h2>{isEdit ? "Edit staff member" : "Add staff member"}</h2><p>Keep the hospital directory and assignments up to date.</p></div><button className="hsm-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <form id="staff-profile-form" className="hsm-form" onSubmit={onSubmit}>
        {error && <div className="hsm-alert hsm-alert-error">{error}</div>}
        <Field label="Full name" name="full_name" value={form.full_name} onChange={onChange} required />
        <div className="hsm-form-two"><SelectField label="Department / role" name="role" value={form.role} onChange={onChange} options={Object.entries(ROLE_META).map(([value, meta]) => [value, meta.singular])} /><SelectField label="Shift" name="shift" value={form.shift} onChange={onChange} options={Object.entries(SHIFT_LABELS)} /></div>
        <div className="hsm-form-two"><Field label="Staff ID" name="staff_id" value={form.staff_id} onChange={onChange} required /><Field label="Registration No." name="registration_number" value={form.registration_number} onChange={onChange} required /></div>
        <Field label="Specialization" name="specialization" value={form.specialization} onChange={onChange} placeholder="e.g. Cardiology / General Care" />
        <div className="hsm-form-two"><Field label="Email" name="email" type="email" value={form.email} onChange={onChange} /><Field label="Contact number" name="contact_number" value={form.contact_number} onChange={onChange} /></div>
        <div className="hsm-form-two"><Field label="Years of experience" name="years_experience" type="number" min="0" value={form.years_experience} onChange={onChange} /><label className="hsm-checkbox"><input type="checkbox" name="is_on_call" checked={Boolean(form.is_on_call)} onChange={onChange} /> On-call specialist</label></div>
        <label className="hsm-checkbox hsm-active-check"><input type="checkbox" name="is_active" checked={Boolean(form.is_active)} onChange={onChange} /> Staff member is active</label>
        <label className="hsm-field"><span>Notes</span><textarea name="notes" value={form.notes || ""} onChange={onChange} rows="4" placeholder="Additional duty or department notes" /></label>
      </form>
      <div className="hsm-drawer-foot"><button type="button" className="hsm-btn hsm-btn-light" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" form="staff-profile-form" className="hsm-btn hsm-btn-primary" disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Add staff"}</button></div>
    </aside>
  </div>;
}

function Field({ label, name, value, onChange, ...props }) {
  return <label className="hsm-field"><span>{label}</span><input name={name} value={value ?? ""} onChange={onChange} {...props} /></label>;
}

function SelectField({ label, name, value, onChange, options }) {
  return <label className="hsm-field"><span>{label}</span><select name={name} value={value} onChange={onChange}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function DirectorySummary({ tab, rows, staff }) {
  if (tab === "performance") return <section className="hsm-review"><ShieldCheck size={26} /><div><h2>Performance review</h2><p>Review readiness is based on the live staff roster. Detailed performance notes can be added in each staff profile.</p></div><strong>{staff.length} profiles ready</strong></section>;
  return <section className="hsm-summary-grid">{rows.map((row) => <article key={row.key} className="hsm-summary-card"><div className="hsm-summary-icon" style={{ color: row.color, background: row.soft }}><BriefcaseBusiness size={19} /></div><div><h3>{tab === "positions" ? row.singular : row.label}</h3><p>{row.total} employee{row.total === 1 ? "" : "s"} · {row.active} active</p></div><span style={{ color: row.color }}>{row.active}/{row.total}</span></article>)}</section>;
}

function EmployeeTable({ rows, onEdit, onToggle }) {
  return <div className="hsm-table-wrap">
    <table className="hsm-table">
      <thead><tr><th><input type="checkbox" aria-label="Select all employees" disabled /></th><th>Employee</th><th>Department</th><th>Email</th><th>Employment</th><th>Specialization</th><th>Shift</th><th>Experience</th><th>Contact</th><th>Actions</th></tr></thead>
      <tbody>{rows.map((member) => {
        const meta = roleMeta(member.role);
        return <tr key={member.id}>
          <td><input type="checkbox" aria-label={`Select ${member.full_name}`} /></td>
          <td><div className="hsm-employee-name"><strong>{member.full_name || "Unnamed staff"}</strong><small>{member.staff_id || "Staff ID pending"}</small></div></td>
          <td><span className="hsm-department-pill" style={{ color: meta.color, background: meta.soft }}><i style={{ background: meta.color }} />{meta.singular}</span></td>
          <td>{member.email || "Not added"}</td>
          <td><span className={`hsm-employment-pill ${member.is_active ? "active" : "inactive"}`}><i />{member.is_active ? "Active" : "Inactive"}</span></td>
          <td>{member.specialization || "General care"}</td>
          <td>{SHIFT_LABELS[member.shift] || "Day"}{member.is_on_call ? " · on call" : ""}</td>
          <td>{Number(member.years_experience || 0)} yrs</td>
          <td>{member.contact_number || "Not added"}</td>
          <td><div className="hsm-table-actions"><button onClick={() => onEdit(member)} aria-label={`Edit ${member.full_name}`}><Edit3 size={14} /></button><button onClick={() => onToggle(member)} aria-label={`Toggle ${member.full_name} status`}><ShieldCheck size={14} /></button></div></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

const STYLES = `
  .hsm-page{min-height:100vh;padding:88px 32px 48px 96px;background:#f6f8f7;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .hsm-topbar,.hsm-directory-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:13px 24px;margin-bottom:15px;box-shadow:0 8px 24px rgba(15,23,42,.035)}
  .hsm-directory-hero{min-height:106px}.hsm-eyebrow{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#334155}.hsm-topbar h1,.hsm-directory-hero h1{margin:4px 0 3px;font-size:25px;line-height:1.08;letter-spacing:-.035em}.hsm-topbar p,.hsm-directory-hero p{margin:0;color:#64748b;font-size:13px}.hsm-actions{display:flex;gap:10px;flex-shrink:0}.hsm-btn{border:1px solid #cbd5e1;border-radius:9px;padding:10px 15px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:14px;font-weight:750;cursor:pointer;background:#fff;color:#0f172a}.hsm-btn:disabled{opacity:.6;cursor:wait}.hsm-btn-primary{background:#f59e0b;border-color:#f59e0b;color:#111827}.hsm-btn-light:hover{border-color:#94a3b8;background:#f8fafc}
  .hsm-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.hsm-stat{display:flex;align-items:flex-start;gap:12px;background:#fff;border:1px solid #dbe5df;border-radius:15px;padding:17px}.hsm-stat-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:11px;background:#f3e8ff;color:#7e22ce}.hsm-stat strong{display:block;font-size:25px;line-height:1}.hsm-stat span{display:block;margin-top:4px;font-size:12px;font-weight:800;color:#334155}.hsm-stat small{display:block;margin-top:5px;color:#94a3b8;font-size:11px}.hsm-stat-green .hsm-stat-icon{color:#15803d;background:#dcfce7}.hsm-stat-amber .hsm-stat-icon{color:#b45309;background:#fef3c7}.hsm-stat-blue .hsm-stat-icon{color:#1d4ed8;background:#dbeafe}
  .hsm-directory-tabs,.hsm-filter-tabs{display:flex;gap:0;align-items:center;border-bottom:1px solid #d9e2dc;margin-bottom:16px;overflow-x:auto}.hsm-directory-tabs button,.hsm-filter-tabs button{white-space:nowrap;border:0;background:transparent;padding:13px 16px;color:#64748b;font-weight:750;cursor:pointer;border-bottom:2px solid transparent}.hsm-directory-tabs button.is-active,.hsm-filter-tabs button.is-active{color:#111827;border-color:#f59e0b}.hsm-filter-tabs button span{margin-left:6px;color:#94a3b8;font-size:11px}
  .hsm-toolbar{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #dbe5df;border-radius:15px;padding:12px;margin-bottom:14px}.hsm-search{display:flex;align-items:center;gap:8px;flex:1;color:#94a3b8}.hsm-search input{border:0;outline:0;width:100%;font-size:14px;color:#0f172a;background:transparent}.hsm-select{position:relative;display:flex;align-items:center;gap:7px;color:#64748b;border:1px solid #dbe5df;border-radius:9px;padding:9px 10px}.hsm-select select{border:0;appearance:none;outline:0;padding-right:15px;background:transparent;color:#334155;font-weight:700}.hsm-result-count{font-size:12px;color:#64748b;font-weight:700;white-space:nowrap;padding:0 8px}.hsm-alert{display:flex;align-items:center;gap:8px;border-radius:10px;padding:11px 13px;margin:0 0 14px;font-size:13px;font-weight:650}.hsm-alert-error{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}.hsm-alert-success{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}
  .hsm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.hsm-card{position:relative;background:#fff;border:1px solid #dbe5df;border-radius:16px;overflow:hidden;box-shadow:0 8px 25px rgba(15,23,42,.035)}.hsm-card-top{min-height:54px;padding:14px 15px;display:flex;justify-content:space-between}.hsm-role-chip{height:25px;display:inline-flex;align-items:center;border-radius:999px;padding:0 10px;font-size:11px;font-weight:850}.hsm-card-menu{display:flex;gap:6px}.hsm-card-menu button,.hsm-icon-btn{width:31px;height:31px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;display:grid;place-items:center;color:#475569;cursor:pointer}.hsm-card-menu button:hover{color:#b91c1c;border-color:#fca5a5}.hsm-card-body{padding:17px 20px 18px}.hsm-card h3{margin:0;font-size:20px;letter-spacing:-.025em;line-height:1.25;overflow-wrap:anywhere}.hsm-handle{margin:5px 0 12px;color:#64748b;font-size:13px}.hsm-status-line{display:flex;align-items:center;gap:6px;font-weight:800;font-size:12px}.hsm-status-dot{width:9px;height:9px;border-radius:50%;display:inline-block}.hsm-status-dot.active{background:#22c55e;box-shadow:0 0 0 4px #dcfce7}.hsm-status-dot.inactive{background:#ef4444;box-shadow:0 0 0 4px #fee2e2}.hsm-status-line button{margin-left:auto;border:0;background:transparent;color:#64748b;font-size:11px;cursor:pointer;text-decoration:underline}.hsm-details{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin:17px 0 15px;padding-top:15px;border-top:1px solid #edf2ef}.hsm-details div{min-width:0}.hsm-details dt{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;font-weight:800}.hsm-details dd{margin:3px 0 0;color:#334155;font-size:12px;font-weight:700;white-space:normal;overflow-wrap:anywhere;min-height:30px}.hsm-contact{display:grid;gap:6px;color:#64748b;font-size:11px}.hsm-contact span{display:flex;align-items:flex-start;gap:6px;min-width:0;white-space:normal;overflow-wrap:anywhere}.hsm-card-footer{border-top:1px solid #edf2ef;margin-top:15px;padding-top:12px;display:flex;align-items:center;justify-content:space-between;color:#94a3b8;font-size:10px}.hsm-card-footer button{display:flex;align-items:center;gap:3px;border:0;background:transparent;color:#475569;font-weight:800;cursor:pointer}
  .hsm-table-wrap{background:#fff;border:1px solid #dbe5df;border-radius:15px;overflow:auto}.hsm-table{border-collapse:collapse;width:100%;min-width:1050px;font-size:12px}.hsm-table th{padding:12px 11px;text-align:left;background:#f8faf9;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}.hsm-table td{padding:13px 11px;border-top:1px solid #edf2ef;color:#334155;white-space:nowrap}.hsm-table tr:hover td{background:#fbfefc}.hsm-table input{accent-color:#f59e0b}.hsm-employee-name{display:grid;gap:3px}.hsm-employee-name strong{font-size:13px;color:#0f172a}.hsm-employee-name small{color:#94a3b8;font-size:10px}.hsm-department-pill,.hsm-employment-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 8px;font-weight:800;font-size:11px}.hsm-department-pill i,.hsm-employment-pill i{width:7px;height:7px;border-radius:50%;display:block}.hsm-employment-pill.active{background:#dcfce7;color:#15803d}.hsm-employment-pill.active i{background:#22c55e}.hsm-employment-pill.inactive{background:#fee2e2;color:#b91c1c}.hsm-employment-pill.inactive i{background:#ef4444}.hsm-table-actions{display:flex;gap:5px}.hsm-table-actions button{width:28px;height:28px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#475569;display:grid;place-items:center;cursor:pointer}.hsm-table-actions button:hover{border-color:#f59e0b;color:#b45309}
  .hsm-empty{background:#fff;border:1px dashed #cbd5e1;border-radius:15px;padding:55px;text-align:center;color:#64748b}.hsm-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.hsm-summary-card{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #dbe5df;border-radius:14px;padding:18px}.hsm-summary-icon{width:40px;height:40px;border-radius:11px;display:grid;place-items:center}.hsm-summary-card h3{margin:0;font-size:15px}.hsm-summary-card p{margin:5px 0 0;color:#64748b;font-size:12px}.hsm-summary-card>span{margin-left:auto;font-size:13px;font-weight:850}.hsm-review{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #dbe5df;border-radius:15px;padding:24px;color:#475569}.hsm-review h2{margin:0 0 5px;color:#0f172a;font-size:20px}.hsm-review p{margin:0;font-size:13px;line-height:1.5}.hsm-review>strong{margin-left:auto;white-space:nowrap;color:#166534}
  .hsm-drawer-overlay{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.35);display:flex;justify-content:flex-end}.hsm-drawer{position:relative;width:min(460px,100vw);height:100%;background:#fff;box-shadow:-15px 0 45px rgba(15,23,42,.2);display:flex;flex-direction:column}.hsm-drawer-head{flex-shrink:0;padding:25px 24px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:14px}.hsm-drawer-head h2{margin:8px 0 5px;font-size:23px;letter-spacing:-.03em}.hsm-drawer-head p{margin:0;color:#64748b;font-size:12px;line-height:1.5}.hsm-form{flex:1;min-height:0;padding:20px 24px 28px;overflow:auto}.hsm-form-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hsm-field{display:grid;gap:6px;margin-bottom:13px}.hsm-field span{font-size:11px;font-weight:800;color:#334155}.hsm-field input,.hsm-field select,.hsm-field textarea{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:10px 11px;background:#fff;color:#0f172a;font:inherit;font-size:13px;outline:0}.hsm-field textarea{resize:vertical}.hsm-field input:focus,.hsm-field select:focus,.hsm-field textarea:focus{border-color:#f59e0b;box-shadow:0 0 0 3px #fef3c7}.hsm-checkbox{display:flex;align-items:center;gap:8px;min-height:39px;margin-top:14px;color:#334155;font-size:12px;font-weight:700}.hsm-checkbox input{accent-color:#f59e0b}.hsm-active-check{padding:10px 11px;border:1px solid #dbe5df;border-radius:8px;background:#f8fafc;margin:2px 0 13px}.hsm-drawer-foot{position:relative;flex-shrink:0;display:flex;justify-content:flex-end;gap:9px;background:#fff;border-top:1px solid #e2e8f0;padding:14px 24px;margin:0}.hsm-spin{animation:hsm-spin 1s linear infinite}@keyframes hsm-spin{to{transform:rotate(360deg)}}
  @media(max-width:1100px){.hsm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hsm-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hsm-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:720px){.hsm-page{padding:78px 14px 30px 78px}.hsm-topbar,.hsm-directory-hero{display:block}.hsm-actions{margin-top:16px}.hsm-stats,.hsm-grid,.hsm-summary-grid{grid-template-columns:1fr}.hsm-toolbar{display:block}.hsm-select{margin-top:10px}.hsm-result-count{display:block;margin-top:10px;padding:0}.hsm-form-two{grid-template-columns:1fr}}
`;
