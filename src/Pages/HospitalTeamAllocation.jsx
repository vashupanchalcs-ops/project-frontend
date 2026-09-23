import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com")).replace(/\/+$/, "");
const ROLES = ["doctor", "nurse", "technician", "support"];
const roleLabel = { doctor: "Doctor", nurse: "Nurse", technician: "Technician", support: "Support" };
const asArray = (value, keys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
};

const normalizeBooking = (item) => (
  item && typeof item === "object"
    ? { ...item, id: item.id ?? item.booking_id }
    : null
);

const readPortalCache = () => {
  try {
    return JSON.parse(sessionStorage.getItem("hospital_portal_cache") || "null");
  } catch {
    return null;
  }
};

const readStaffCache = () => {
  try {
    const cached = JSON.parse(sessionStorage.getItem("hospital_staff_management_cache") || "null");
    return asArray(cached?.staff, ["results", "staff", "members"]);
  } catch {
    return [];
  }
};

const roleFromValue = (value) => {
  const text = String(value || "").toLowerCase();
  return ROLES.find((role) => text === role || text.includes(role)) || "support";
};

const parseSavedTeam = (booking) => {
  if (!booking) return [];
  const raw = booking.assigned_doctors_json || booking.assigned_staff_json || booking.assigned_team_json;
  if (Array.isArray(raw)) return raw;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  if (!booking.assigned_doctor_names) return [];
  const names = String(booking.assigned_doctor_names).split(",").map((name) => name.trim()).filter(Boolean);
  const specs = String(booking.assigned_doctor_specializations || "").split(",").map((item) => item.trim());
  return names.map((full_name, index) => ({
    full_name,
    role: roleFromValue(specs[index]),
    specialization: specs[index] || "Assigned care",
    contact_number: String(booking.assigned_doctor_contacts || "").split(",")[index]?.trim() || "",
  }));
};

export default function HospitalTeamAllocation() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const requestedBookingId = new URLSearchParams(search).get("booking_id") || "";
  const editMode = pathname.endsWith("/edit") || new URLSearchParams(search).get("edit") === "1";
  const cachedPortal = readPortalCache();
  const cachedHospitalId = cachedPortal?.hospital?.id || cachedPortal?.hospital?.hospital_id || "";
  const cachedDirectoryStaff = readStaffCache();
  const [bookings, setBookings] = useState(() => (
    asArray(cachedPortal?.queue, ["bookings", "results"]).map(normalizeBooking).filter((item) => item?.id)
  ));
  const [staff, setStaff] = useState(() => {
    const portalStaff = asArray(cachedPortal?.staff, ["results", "staff", "members"]);
    return portalStaff.length ? portalStaff : cachedDirectoryStaff;
  });
  const [bookingId, setBookingId] = useState(requestedBookingId);
  const [selected, setSelected] = useState({});
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const savingRef = useRef(false);
  const hospitalId = localStorage.getItem("hospital_id") || String(cachedHospitalId || "");
  const activeBookingId = bookingId || requestedBookingId;
  const booking = useMemo(() => bookings.find((item) => String(item.id) === String(activeBookingId)) || (!activeBookingId ? bookings[0] || null : null), [bookings, activeBookingId]);
  const savedTeam = useMemo(() => parseSavedTeam(booking), [booking]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      let dashboard = null;
      let dashboardOk = false;
      let people = [];
      let staffOk = false;
      let rawRows = [];
      let resolvedHospitalId = String(hospitalId || cachedHospitalId || "");

      const loadScopedHospital = async (id) => {
        if (!id) return { dashboard: null, dashboardOk: false, people: [], staffOk: false };
        const [dashboardResponse, staffResponse] = await Promise.all([
          fetch(`${BASE}/api/hospitals/${id}/dashboard/?_=${Date.now()}`, { cache: "no-store", signal: controller.signal }),
          fetch(`${BASE}/api/hospitals/${id}/staff/?_=${Date.now()}`, { cache: "no-store", signal: controller.signal }),
        ]);
        return {
          dashboard: dashboardResponse.ok ? await dashboardResponse.json() : null,
          dashboardOk: dashboardResponse.ok,
          people: staffResponse.ok ? await staffResponse.json() : [],
          staffOk: staffResponse.ok,
        };
      };

      let scoped = await loadScopedHospital(resolvedHospitalId);
      // A stale hospital_id can still return a valid but empty portal. Resolve
      // the logged-in hospital by email/name before rendering an empty staff list.
      if (!asArray(scoped.people, ["results", "staff", "members"]).length
        && !asArray(scoped.dashboard?.staff, ["results", "staff", "members"]).length) {
        const email = String(localStorage.getItem("user") || "").trim().toLowerCase();
        const nameHint = String(localStorage.getItem("hospital_name") || localStorage.getItem("name") || "").trim().toLowerCase();
        let candidate = null;
        if (email) {
          const byEmail = await fetch(`${BASE}/api/hospitals/by-email/?email=${encodeURIComponent(email)}&_=${Date.now()}`, { cache: "no-store", signal: controller.signal }).catch(() => null);
          if (byEmail?.ok) candidate = await byEmail.json().catch(() => null);
        }
        if (!candidate || !candidate.id && !candidate.hospital_id) {
          const hospitalsResponse = await fetch(`${BASE}/api/hospitals/?_=${Date.now()}`, { cache: "no-store", signal: controller.signal }).catch(() => null);
          const hospitals = hospitalsResponse?.ok ? await hospitalsResponse.json().catch(() => []) : [];
          const rows = Array.isArray(hospitals) ? hospitals : [];
          candidate = rows.find((item) => email && String(item.email || "").trim().toLowerCase() === email)
            || rows.find((item) => nameHint && String(item.name || "").trim().toLowerCase() === nameHint)
            || (rows.length === 1 ? rows[0] : null);
        }
        const candidateId = String(candidate?.hospital_id || candidate?.id || "");
        if (candidateId && candidateId !== resolvedHospitalId) {
          resolvedHospitalId = candidateId;
          localStorage.setItem("hospital_id", candidateId);
          scoped = await loadScopedHospital(candidateId);
        }
      }
      dashboard = scoped.dashboard;
      dashboardOk = scoped.dashboardOk;
      people = scoped.people;
      staffOk = scoped.staffOk;
      rawRows = asArray(dashboard?.queue, ["bookings", "results"]);

      // Use the fast, hospital-scoped dashboard response first. The global
      // endpoint remains a compatibility fallback for older records.
      if (!rawRows.length) {
        const bookingsResponse = await fetch(`${BASE}/api/bookings/`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (bookingsResponse.ok) rawRows = await bookingsResponse.json();
      }

      if (cancelled) return;
      const rows = (Array.isArray(rawRows) ? rawRows : (rawRows?.results || rawRows?.bookings || []))
        .map(normalizeBooking)
        .filter((item) => item?.id);
      const dashboardRows = asArray(dashboard?.queue, ["bookings", "results"])
        .map(normalizeBooking)
        .filter((item) => item?.id);
      const hospitalRows = dashboardRows.length
        ? dashboardRows
        : rows.filter((item) => !resolvedHospitalId || String(item.assigned_hospital_id) === String(resolvedHospitalId));
      const requested = rows.find((item) => String(item.id) === String(requestedBookingId));
      const filtered = hospitalRows.length ? hospitalRows : (requested ? [requested] : hospitalRows);
      setBookings(filtered);
      const loadedStaff = asArray(people, ["results", "staff", "members"]);
      const dashboardStaff = asArray(dashboard?.staff, ["results", "staff", "members"]);
      const nextStaff = loadedStaff.length
        ? loadedStaff
        : dashboardStaff.length
          ? dashboardStaff
          : (asArray(cachedPortal?.staff, ["results", "staff", "members"]).length
            ? asArray(cachedPortal?.staff, ["results", "staff", "members"])
            : cachedDirectoryStaff);
      setStaff(nextStaff);
      if (nextStaff.length) {
        try {
          const cache = JSON.parse(sessionStorage.getItem("hospital_portal_cache") || "{}");
          sessionStorage.setItem("hospital_portal_cache", JSON.stringify({ ...cache, staff: nextStaff }));
          sessionStorage.setItem("hospital_staff_management_cache", JSON.stringify({ hospital: cache.hospital || null, staff: nextStaff }));
        } catch {}
      }
      const selectedBooking = filtered.find((item) => String(item.id) === String(requestedBookingId));
      setBookingId(String((selectedBooking || filtered[0])?.id || ""));
      if (!dashboardOk && !filtered.length && !people.length) {
        setNotice("Unable to load allocation data. Please retry.");
      } else {
        setNotice("");
      }
    };
    load().catch((error) => {
      if (!cancelled && error?.name !== "AbortError") setNotice("Unable to load allocation data. Please retry.");
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hospitalId, requestedBookingId]);

  const ranked = useMemo(() => {
    const text = `${booking?.patient_condition || ""} ${booking?.vitals_summary || ""}`.toLowerCase();
    const score = (person) => (person.is_on_call ? 25 : 0) + Number(person.years_experience || 0) * 3 + (person.specialization && text.includes(String(person.specialization).toLowerCase()) ? 100 : 0);
    const isAlreadyAssigned = (person) => savedTeam.some((saved) => String(saved.id || "") === String(person.id) || String(saved.full_name || saved.name || "").toLowerCase() === String(person.full_name || "").toLowerCase());
    return Object.fromEntries(ROLES.map((role) => {
      const members = staff
        .filter((person) => roleFromValue(person.role) === role && person.is_active !== false)
        .sort((a, b) => {
          // Prefer genuinely free members, but keep busy active members
          // visible. Older records can retain stale is_busy flags after a
          // booking closes, and hiding every member made allocation appear
          // empty even though the hospital roster was present.
          const availability = Number(Boolean(!a.is_busy || isAlreadyAssigned(a))) - Number(Boolean(!b.is_busy || isAlreadyAssigned(b)));
          return availability || score(b) - score(a);
        })
        .slice(0, 5);
      return [role, members];
    }));
  }, [booking, savedTeam, staff]);

  const savedSelection = useMemo(() => {
    const next = {};
    savedTeam.forEach((saved) => {
      const role = roleFromValue(saved.role);
      const member = staff.find((person) => String(person.id) === String(saved.id) || String(person.full_name || "").toLowerCase() === String(saved.full_name || saved.name || "").toLowerCase());
      if (member) next[role] = member.id;
    });
    return next;
  }, [savedTeam, staff]);

  useEffect(() => {
    if (!booking) {
      setSelected({});
      setStep(1);
      return;
    }
    if (savedTeam.length && !editMode) {
      setSelected(savedSelection);
      setStep(3);
    } else {
      setSelected({});
      setStep(1);
    }
    setNotice("");
  }, [booking?.id, savedTeam.length, JSON.stringify(savedSelection), editMode]);

  const selectedMembers = Object.entries(selected)
    .map(([role, id]) => ({ role, member: staff.find((person) => String(person.id) === String(id)) }))
    .filter((item) => item.member);

  const toggle = (role, member) => setSelected((current) => ({ ...current, [role]: current[role] === member.id ? null : member.id }));

  const review = () => {
    const next = { ...selected };
    ROLES.forEach((role) => { if (!next[role] && ranked[role]?.[0]) next[role] = ranked[role][0].id; });
    if (!Object.values(next).some(Boolean)) return setNotice("No available staff found for this booking.");
    setSelected(next);
    setNotice("");
    setStep(2);
  };

  const allocate = async () => {
    if (!booking || !selectedMembers.length || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setNotice("");
    const team = selectedMembers.map(({ role, member }) => ({
      id: member.id,
      full_name: member.full_name,
      role,
      specialization: member.specialization || "General",
      contact_number: member.contact_number || "",
      years_experience: member.years_experience || 0,
    }));
    try {
      const targetHospitalId = localStorage.getItem("hospital_id") || String(cachedHospitalId || "");
      const response = await fetch(`${BASE}/api/bookings/${booking.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assign_doctors: team, hospital_id: targetHospitalId || undefined }),
      });
      let responseData = {};
      try { responseData = await response.json(); } catch {}
      if (!response.ok) throw new Error(responseData.error || "Team allocation could not be saved. Please retry.");
      const savedTeamPayload = Array.isArray(responseData.team) && responseData.team.length ? responseData.team : team;
      const saved = {
        assigned_doctor_names: savedTeamPayload.map((person) => person.full_name).join(", "),
        assigned_doctor_specializations: savedTeamPayload.map((person) => `${roleLabel[roleFromValue(person.role)]}: ${person.specialization || "General"}`).join(", "),
        assigned_doctors_json: JSON.stringify(savedTeamPayload),
      };
      setBookings((rows) => rows.map((row) => String(row.id) === String(booking.id) ? { ...row, ...saved } : row));
      setNotice("Team allocated successfully. Booking and bed assignment are updated.");
      setStep(3);
    } catch (error) {
      setNotice(error.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <main className="team-allocation-page">
      <style>{`.team-allocation-page{margin-left:64px;min-height:100vh;padding:94px 28px 44px;background:#eff6f5;color:#173645;font-family:Inter,Segoe UI,sans-serif}.team-allocation-page *{box-sizing:border-box}.team-hero h1{margin:0;font-size:34px;color:#173645!important}.team-hero p{margin:6px 0 18px;color:#6d858d!important}.team-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:20px}.team-panel{background:#fff!important;border:1px solid #d6e5e1!important;border-radius:18px;padding:18px;box-shadow:none!important}.booking-item{width:100%;padding:13px 14px;margin-bottom:10px;text-align:left;background:#fff!important;border:1px solid #d8e4e1!important;border-radius:12px;color:#173645!important;cursor:pointer}.booking-item.active{border:2px solid #126F1E!important;background:#eaf8f3!important}.step-line{display:flex;gap:10px;align-items:center;color:#126F1E;font-size:11px;font-weight:900;letter-spacing:.5px}.patient-banner{display:flex;justify-content:space-between;padding:16px 18px;border-radius:14px;background:#126F1E!important;color:#fff!important;margin:14px 0 16px}.patient-banner *{color:#fff!important}.selected-summary{display:flex;flex-wrap:wrap;gap:8px;padding:11px;border:1px solid #c5e3d8;border-radius:12px;background:#f1fbf7;margin-bottom:16px}.selected-chip{padding:7px 10px;border-radius:999px;background:#d9f3e8;color:#12644f;font-size:12px;font-weight:800}.role-heading{display:flex;justify-content:space-between;margin:18px 0 8px;color:#173645!important}.role-heading small,.staff-meta{color:#668087!important}.staff-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.staff-card{position:relative;display:block;text-align:left;padding:14px;border-radius:14px;background:#fff!important;color:#173645!important;border:1px solid #d5e4e0!important;cursor:pointer;min-height:112px}.staff-card:hover{border-color:#126F1E!important;background:#f2fbf7!important}.staff-card.selected{border:2px solid #126F1E!important;background:#e4f7ee!important}.staff-check{position:absolute;right:12px;top:12px;width:19px;height:19px;accent-color:#126F1E}.staff-role{display:inline-block;margin-bottom:10px;padding:4px 8px;border-radius:999px;background:#e5f7ed;color:#126F1E;font-size:9px;font-weight:900;text-transform:uppercase}.staff-name{font-weight:900;font-size:13px}.staff-meta{font-size:11px;margin-top:5px}.team-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.team-btn{border-radius:10px;padding:12px 18px;font-weight:900;cursor:pointer}.team-btn.primary{background:#126F1E!important;color:#fff!important;border:0}.team-btn.secondary{background:#fff!important;color:#173645!important;border:1px solid #bfd5cf}.review-grid{display:grid;grid-template-columns:1fr 280px;gap:16px}.review-card{border:1px solid #c5e3d8;border-radius:14px;background:#fff;overflow:hidden}.review-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #e3efeb}.review-row:last-child{border-bottom:0}.review-role{width:82px;color:#126F1E;font-weight:900;font-size:10px;text-transform:uppercase}.allocated-state{padding:26px;border-radius:14px;background:#e5f7ed!important;border:1px solid #a9dfc7!important;color:#12644f!important}@media(max-width:900px){.team-layout,.review-grid{grid-template-columns:1fr}.staff-grid{grid-template-columns:1fr 1fr}}`}</style>
      <div className="team-hero"><h1>Team allocation</h1><p>Build a multidisciplinary team using the best available members for each case.</p></div>
      <div className="team-layout">
        <aside className="team-panel">
          {bookings.map((item) => (
            <button className={`booking-item ${String(item.id) === String(bookingId) ? "active" : ""}`} key={item.id} onClick={() => setBookingId(String(item.id))}>
              <b>Booking #{item.id}</b>
              <div>{item.patient_name || item.booked_by || "Patient"}</div>
              <small>{item.patient_condition || "Emergency case"}</small>
            </button>
          ))}
        </aside>
        <section className="team-panel">
          {!booking ? <p>Select a booking.</p> : <>
            <div className="step-line">STEP 1 · TEAM SELECTION {step > 1 && "✓"}<span>→</span> STEP 2 · REVIEW {step > 2 && "✓"}<span>→</span> STEP 3 · ALLOCATED</div>
            <h2>{step === 1 ? "Build multidisciplinary team" : step === 2 ? "Review team allocation" : "Team allocated · preparing for departure"} · Booking #{booking.id}</h2>
            <div className="patient-banner"><div><b>{booking.patient_name || booking.booked_by || "Patient"}</b><div>{booking.patient_condition || "Emergency care"}</div></div><small>{booking.assigned_bed_number ? `Bed ${booking.assigned_bed_number}` : "Bed pending"}</small></div>
            {step === 1 && <>
              <div className="selected-summary"><b>Selected team:</b>{selectedMembers.length ? selectedMembers.map(({ role, member }) => <span className="selected-chip" key={role}>{member.full_name} · {roleLabel[role]}</span>) : <span>No members selected yet</span>}</div>
              {ROLES.map((role) => <div key={role}><div className="role-heading"><b>{roleLabel[role]}</b><small>Top 5 available · select 1</small></div><div className="staff-grid">{(ranked[role] || []).map((member) => <label className={`staff-card ${selected[role] === member.id ? "selected" : ""}`} key={member.id}><input className="staff-check" type="checkbox" checked={selected[role] === member.id} onChange={() => toggle(role, member)} /><span className="staff-role">{roleLabel[role]}</span><div className="staff-name">{member.full_name}</div><div className="staff-meta">{member.specialization || "General"}</div><div className="staff-meta">{member.years_experience || 0} years · {member.is_on_call ? "On call" : "Available"}</div></label>)}</div></div>)}
            </>}
            {step === 2 && <div className="review-grid"><div className="review-card">{selectedMembers.map(({ role, member }) => <div className="review-row" key={role}><span className="review-role">{roleLabel[role]}</span><div><b>{member.full_name}</b><div className="staff-meta">{member.specialization || "General"} · {member.years_experience || 0} years experience</div></div><span className="selected-chip">Confirmed available</span></div>)}</div><div className="allocated-state"><b>Clinical coverage validated</b><p>Selected members will be notified and reserved for this booking.</p></div></div>}
            {step === 3 && <div className="allocated-state"><h3>✓ Team allocated · preparing for departure</h3><p>{savedTeam.length ? savedTeam.map((member) => `${member.full_name || member.name} (${roleLabel[roleFromValue(member.role)]})`).join(" · ") : selectedMembers.map(({ role, member }) => `${member.full_name} (${roleLabel[role]})`).join(" · ")}</p><p>Team details have been saved to the booking and allocated bed.</p></div>}
            {notice && <p style={{ color: notice.includes("success") ? "#126F1E" : "#b77900", background: notice.includes("success") ? "#e5f7ed" : "#fff6d6", padding: "10px 12px", borderRadius: 10, fontWeight: 800 }}>{notice}</p>}
            <div className="team-actions">{step === 3 && <button className="team-btn secondary" onClick={() => navigate(`/hospital/team-allocation/edit?booking_id=${booking.id}`)}>✎ Edit allocated team</button>}{step === 2 && <button className="team-btn secondary" onClick={() => setStep(1)}>← Back to selection</button>}{step === 1 && <button className="team-btn primary" onClick={review}>Review team →</button>}{step === 2 && <button className="team-btn primary" disabled={saving} onClick={allocate}>{saving ? "Saving…" : "Save team changes"}</button>}</div>
          </>}
        </section>
      </div>
    </main>
  );
}
