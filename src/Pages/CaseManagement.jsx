import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com")).replace(/\/+$/, "");
const CASE_CACHE_PREFIX = "swiftrescue_case_management_v2";

const readCaseCache = (key) => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
};

const writeCaseCache = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The API remains the source of truth when browser storage is unavailable.
  }
};

const conditionMeta = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.includes("stemi") || text.includes("cardiac") || text.includes("heart")) return { type: "STEMI", icon: "❤", tone: "red" };
  if (text.includes("stroke") || text.includes("neuro")) return { type: "STROKE", icon: "◉", tone: "red" };
  if (text.includes("trauma") || text.includes("fracture") || text.includes("injur")) return { type: "TRAUMA", icon: "✚", tone: "yellow" };
  if (text.includes("sepsis") || text.includes("infection")) return { type: "SEPSIS", icon: "◈", tone: "yellow" };
  if (text.includes("respiratory") || text.includes("breath") || text.includes("asthma")) return { type: "RESPIRATORY", icon: "◌", tone: "yellow" };
  return { type: "GENERAL", icon: "✚", tone: "green" };
};

const priorityMeta = (item) => {
  const text = `${item?.patient_condition || ""} ${item?.vitals_summary || ""}`.toLowerCase();
  if (item?.icu_required || /critical|serious|stemi|cardiac arrest|unconscious|stroke/.test(text)) return { label: "Red", tone: "red" };
  if (/urgent|emergency|trauma|sepsis|respiratory|pain/.test(text)) return { label: "Yellow", tone: "yellow" };
  return { label: "Green", tone: "green" };
};

const stageMeta = (item) => {
  const status = String(item?.status || "").toLowerCase();
  if (item?.patient_reached || status === "completed") return { label: "At Destination", tone: "green" };
  if (status === "en_route" || status === "confirmed") return { label: "Inbound", tone: "yellow" };
  if (String(item?.hospital_response || "").toLowerCase() === "ready") return { label: "On Site", tone: "green" };
  if (String(item?.hospital_response || "").toLowerCase() === "not_ready") return { label: "Redirected", tone: "red" };
  return { label: "Pending", tone: "yellow" };
};

const asArray = (value, keys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
};

const parseTeamNames = (item) => {
  const rawTeam = item?.assigned_doctors_json || item?.assigned_staff_json || item?.assigned_team_json;
  if (Array.isArray(rawTeam)) return rawTeam.map((member) => member?.full_name || member?.name).filter(Boolean);
  if (rawTeam) {
    try {
      const parsed = JSON.parse(rawTeam);
      if (Array.isArray(parsed)) return parsed.map((member) => member?.full_name || member?.name).filter(Boolean);
    } catch {}
  }
  return String(item?.assigned_doctor_names || "").split(",").map((name) => name.trim()).filter(Boolean);
};

const normalizeCase = (item) => {
  const handover = item?.digital_handover || {};
  const teamNames = parseTeamNames(item);
  return {
    ...item,
    id: item?.id ?? item?.booking_id,
    patient_name: item?.patient_name || item?.booked_by || handover.patient_name || "Unknown patient",
    patient_condition: item?.patient_condition || item?.condition || item?.pre_diagnosis_note || handover.patient_condition || "General emergency",
    vitals_summary: item?.vitals_summary || handover.vitals_summary || "",
    patient_age: item?.patient_age ?? item?.age ?? handover.patient_age,
    patient_gender: item?.patient_gender || item?.gender || handover.patient_gender || "",
    assigned_hospital_name: item?.assigned_hospital_name || item?.destination || "Hospital not assigned",
    assigned_bed_number: item?.assigned_bed_number || item?.bed_number || "",
    assigned_doctor_names: teamNames.join(", "),
    assigned_team_members: teamNames,
  };
};

const safeDate = (value) => {
  if (!value) return "Recent case";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recent case" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

function CaseRow({ item, scope, onOpen }) {
  const navigate = useNavigate();
  const condition = conditionMeta(item.patient_condition);
  const priority = priorityMeta(item);
  const stage = stageMeta(item);
  const hasTeam = item.assigned_team_members?.length > 0;
  const teamCount = item.assigned_team_members?.length || 0;
  const openPath = scope === "hospital" ? `/hospital/cases/${item.id}` : `/cases/${item.id}`;

  return (
    <article className={`cm-case-row tone-${priority.tone}`} onDoubleClick={() => onOpen(item)}>
      <div className={`cm-condition-icon tone-${condition.tone}`} title={`${condition.type} case`}>{condition.icon}</div>
      <div className="cm-case-type">
        <div className="cm-type-line"><span className={`cm-priority tone-${priority.tone}`}>{priority.label}</span><b>{condition.type}</b></div>
        <small>{item.patient_condition || "Emergency care"}</small>
      </div>
      <div className="cm-patient">
        <b>{item.patient_name}</b>
        <span>{item.patient_age ? `${item.patient_age}y` : "Age —"} · {item.patient_gender || "—"}</span>
      </div>
      <div className="cm-bed">
        <small>BED</small>
        <b>{item.assigned_bed_number || "Not allocated"}</b>
        <span>{item.assigned_bed_type ? String(item.assigned_bed_type).toUpperCase() : "Awaiting bed"}</span>
      </div>
      <div className="cm-stage">
        <b className={`cm-stage-label tone-${stage.tone}`}>{stage.label}</b>
        <span>{item.ambulance_number ? `AMB-${item.ambulance_number}` : "Ambulance pending"}</span>
        <small>{safeDate(item.created_at)}</small>
      </div>
      <div className="cm-destination">
        <b>{item.assigned_hospital_name}</b>
        <span>{item.driver || item.driver_name || "Driver not assigned"}</span>
        <small>{hasTeam ? `${teamCount} team member${teamCount === 1 ? "" : "s"} allocated` : "Care team pending"}</small>
      </div>
      <div className="cm-actions">
        <button className="cm-open" onClick={() => navigate(openPath)}>{scope === "hospital" ? "Manage" : "Open"}</button>
      </div>
    </article>
  );
}

export default function CaseManagement({ scope = "hospital" }) {
  const navigate = useNavigate();
  const isAdmin = scope === "admin";
  const hospitalIdentity = isAdmin
    ? "admin"
    : localStorage.getItem("hospital_id") || localStorage.getItem("hospital_name") || localStorage.getItem("name") || "unknown";
  const cacheKey = `${CASE_CACHE_PREFIX}:${scope}:${hospitalIdentity}`;
  const initialCases = readCaseCache(cacheKey);
  const [cases, setCases] = useState(initialCases);
  const [loading, setLoading] = useState(initialCases.length === 0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selected, setSelected] = useState(null);
  const activeRequest = useRef(null);

  const loadCases = async (silent = false) => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      let visible = [];
      const request = (url) => fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const hospitalId = localStorage.getItem("hospital_id");
      let dashboardLoaded = false;

      // Hospital dashboard already applies the correct id/email/name fallback
      // and is much smaller than downloading every booking in the network.
      if (!isAdmin && hospitalId) {
        const dashboardResponse = await request(`${BASE}/api/hospitals/${encodeURIComponent(hospitalId)}/dashboard/`);
        if (dashboardResponse.ok) {
          const dashboard = await dashboardResponse.json();
          visible = asArray(dashboard?.queue, ["results"]);
          dashboardLoaded = true;
        }
      }

      if (isAdmin || !dashboardLoaded) {
        const bookingsResponse = await request(`${BASE}/api/bookings/`);
        const allBookings = bookingsResponse.ok ? asArray(await bookingsResponse.json(), ["results", "bookings"]) : [];
        visible = isAdmin ? allBookings : allBookings.filter((item) => {
          const hospitalName = String(
            localStorage.getItem("hospital_name") || localStorage.getItem("name") || ""
          ).trim().toLowerCase();
          const idMatch = hospitalId && String(item.assigned_hospital_id) === String(hospitalId);
          const name = String(item.assigned_hospital_name || item.destination || "").trim().toLowerCase();
          return idMatch || (hospitalName && name === hospitalName);
        });
      }

      const normalized = visible.map(normalizeCase).filter((item) => item.id != null);
      setCases(normalized);
      writeCaseCache(cacheKey, normalized);
      setError("");
    } catch (loadError) {
      if (loadError?.name !== "AbortError" && cases.length === 0 && !silent) {
        setError(loadError.message || "Unable to load cases");
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCases();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") loadCases(true);
    }, 10000);
    return () => {
      clearInterval(timer);
      activeRequest.current?.abort();
    };
  }, [scope, cacheKey]);

  const conditionCounts = useMemo(() => cases.reduce((counts, item) => {
    const type = conditionMeta(item.patient_condition).type;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {}), [cases]);

  const stageCounts = useMemo(() => cases.reduce((counts, item) => {
    const stage = stageMeta(item).label;
    counts[stage] = (counts[stage] || 0) + 1;
    return counts;
  }, {}), [cases]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cases
      .filter((item) => {
        const condition = conditionMeta(item.patient_condition);
        const stage = stageMeta(item);
        const haystack = [
          item.id,
          `booking ${item.id}`,
          item.patient_name,
          item.patient_condition,
          item.pickup_location,
          item.assigned_hospital_name,
          item.assigned_hospital_address,
          item.ambulance_number,
          item.assigned_bed_number,
          item.assigned_bed_type,
          item.assigned_doctor_names,
        ].filter(Boolean).join(" ").toLowerCase();
        return (!query || haystack.includes(query)) && (conditionFilter === "all" || condition.type === conditionFilter) && (stageFilter === "all" || stage.label === stageFilter) && (priorityFilter === "all" || priorityMeta(item).tone === priorityFilter);
      })
      .sort((a, b) => sortBy === "type"
        ? conditionMeta(a.patient_condition).type.localeCompare(conditionMeta(b.patient_condition).type)
        : sortBy === "priority"
          ? ({ red: 0, yellow: 1, green: 2 }[priorityMeta(a).tone] - ({ red: 0, yellow: 1, green: 2 }[priorityMeta(b).tone]))
          : Number(b.id || 0) - Number(a.id || 0));
  }, [cases, search, conditionFilter, stageFilter, priorityFilter, sortBy]);

  const stats = {
    total: cases.length,
    urgent: cases.filter((item) => priorityMeta(item).tone === "red").length,
    awaiting: cases.filter((item) => !item.assigned_bed_number || !item.assigned_team_members?.length).length,
    resolved: cases.filter((item) => stageMeta(item).label === "At Destination").length,
  };

  const openCase = (item) => setSelected(item);

  return (
    <main className={`cm-root ${isAdmin ? "cm-admin" : "cm-hospital"}`}>
      <style>{`
        .cm-root{min-height:100vh;padding:92px 24px 48px 88px;background:#101211;color:#f5f7f4;font-family:Inter,Segoe UI,sans-serif;box-sizing:border-box}.cm-root *{box-sizing:border-box}.cm-shell{max-width:1540px;margin:0 auto}.cm-eyebrow{font-size:11px;letter-spacing:1.2px;font-weight:900;color:#9bd7ad;text-transform:uppercase}.cm-title{margin:7px 0 4px;font-size:clamp(28px,3.5vw,48px);font-weight:900;letter-spacing:-1.2px}.cm-subtitle{margin:0;color:#9ba8a0;font-size:14px}.cm-header{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:20px}.cm-header-actions{display:flex;gap:8px;align-items:center}.cm-header-actions button,.cm-header-actions select{height:38px;border:1px solid #3b4740;border-radius:8px;background:#1b211e;color:#f5f7f4;padding:0 12px;font-weight:800}.cm-header-actions button{cursor:pointer}.cm-search{height:42px;min-width:min(360px,36vw);border:1px solid #3b4740;border-radius:9px;background:#202622;color:#fff;padding:0 13px;outline:none}.cm-search:focus{border-color:#79c98f}.cm-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}.cm-filters{border:1px solid #303932;background:#171b19;border-radius:10px;padding:14px;position:sticky;top:88px}.cm-filter-heading{display:flex;justify-content:space-between;align-items:center;margin:0 0 8px;font-size:11px;letter-spacing:.7px;text-transform:uppercase;color:#d8e2dc}.cm-clear{border:0;background:transparent;color:#a7c8b0;font-size:10px;cursor:pointer}.cm-filter-group{border-top:1px solid #2c342f;padding-top:14px;margin-top:14px}.cm-filter-option{width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:transparent;color:#9ba8a0;padding:9px 7px;text-align:left;cursor:pointer;border-radius:6px;font-size:12px}.cm-filter-option:hover,.cm-filter-option.selected{background:#242c27;color:#fff}.cm-filter-count{min-width:22px;text-align:center;border:1px solid #46544a;border-radius:4px;padding:2px 4px;font-size:10px}.cm-main{min-width:0}.cm-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.cm-toolbar-label{font-size:12px;color:#aab6ae}.cm-toolbar-label b{color:#fff}.cm-sort{border:1px solid #3b4740;border-radius:7px;background:#1b211e;color:#fff;padding:8px 10px;font-size:11px;font-weight:800}.cm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}.cm-stat{border:1px solid #303932;background:#171b19;border-radius:9px;padding:13px 14px}.cm-stat-label{font-size:10px;color:#8f9c94;text-transform:uppercase;letter-spacing:.5px}.cm-stat-value{font-size:24px;font-weight:900;margin-top:5px}.cm-stat.red .cm-stat-value{color:#ff5c62}.cm-stat.yellow .cm-stat-value{color:#f2b233}.cm-stat.green .cm-stat-value{color:#43ce72}.cm-list{border:1px solid #303932;border-radius:10px;overflow:hidden;background:#171b19}.cm-list-head{display:grid;grid-template-columns:36px 1.1fr 1fr .8fr 1fr 1.25fr 120px;gap:12px;align-items:center;padding:11px 14px;color:#7f8b84;font-size:9px;letter-spacing:.75px;text-transform:uppercase;border-bottom:1px solid #303932}.cm-case-row{display:grid;grid-template-columns:36px 1.1fr 1fr .8fr 1fr 1.25fr 120px;gap:12px;align-items:center;padding:13px 14px;border-bottom:1px solid #2c342f;min-height:80px;transition:background .15s}.cm-case-row:last-child{border-bottom:0}.cm-case-row:hover{background:#202722}.cm-case-row.tone-red{border-left:3px solid #ef4444}.cm-case-row.tone-yellow{border-left:3px solid #f2b233}.cm-case-row.tone-green{border-left:3px solid #22c55e}.cm-condition-icon{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:900;border:1px solid}.cm-condition-icon.tone-red{background:#531e22;color:#ff6870;border-color:#b93942}.cm-condition-icon.tone-yellow{background:#4b3918;color:#f2c14b;border-color:#a47a20}.cm-condition-icon.tone-green{background:#183d27;color:#4bda7a;border-color:#2c9b52}.cm-type-line{display:flex;align-items:center;gap:7px}.cm-case-type b,.cm-patient b,.cm-bed b,.cm-destination b{font-size:12px;color:#f5f7f4}.cm-case-type small,.cm-patient span,.cm-bed span,.cm-stage span,.cm-stage small,.cm-destination span,.cm-destination small{display:block;color:#8e9b92;font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cm-priority{display:inline-flex;align-items:center;padding:3px 7px;border-radius:3px;color:#101211;font-size:9px;font-weight:900;text-transform:uppercase}.cm-priority.tone-red{background:#ef4444}.cm-priority.tone-yellow{background:#f2b233}.cm-priority.tone-green{background:#22c55e}.cm-bed small{display:block;color:#748178;font-size:9px;letter-spacing:.5px}.cm-bed b{display:block;margin-top:3px}.cm-stage-label{font-size:11px}.cm-stage-label.tone-red{color:#ff656b}.cm-stage-label.tone-yellow{color:#f2b233}.cm-stage-label.tone-green{color:#42d475}.cm-actions{display:flex;justify-content:flex-end;gap:6px}.cm-actions button{border:1px solid #4b584e;background:#252d28;color:#fff;border-radius:6px;min-height:28px;padding:0 8px;font-weight:800;cursor:pointer;font-size:10px}.cm-actions button:hover{border-color:#7acb8e;background:#304236}.cm-actions .cm-open{background:#126f1e;border-color:#126f1e}.cm-empty{padding:48px 18px;text-align:center;color:#8e9b92}.cm-loading{padding:38px 18px;text-align:center;color:#b5c1b8}.cm-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;display:grid;place-items:center;padding:20px}.cm-modal{width:min(680px,100%);max-height:90vh;overflow:auto;background:#18201b;border:1px solid #506253;border-radius:14px;padding:20px}.cm-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.cm-modal h2{margin:0;font-size:22px}.cm-modal-close{border:0;background:#2d3930;color:#fff;border-radius:7px;padding:7px 10px;cursor:pointer}.cm-modal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:16px}.cm-modal-field{border:1px solid #334238;border-radius:8px;padding:11px}.cm-modal-field small{display:block;color:#8e9b92;font-size:10px;text-transform:uppercase}.cm-modal-field b{display:block;margin-top:5px;font-size:13px}.cm-modal-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.cm-modal-actions button{border:1px solid #4b584e;background:#126f1e;color:#fff;border-radius:7px;padding:9px 12px;font-weight:800;cursor:pointer}.cm-admin .cm-eyebrow{color:#8bc5ff}.cm-admin .cm-case-row.tone-red{background:linear-gradient(90deg,rgba(110,16,21,.65),rgba(35,22,22,.15))}.cm-admin .cm-case-row.tone-yellow{background:linear-gradient(90deg,rgba(105,77,12,.32),rgba(35,28,18,.08))}.cm-admin .cm-case-row.tone-green{background:linear-gradient(90deg,rgba(16,84,40,.28),rgba(22,32,24,.08))}@media(max-width:1180px){.cm-list-head,.cm-case-row{grid-template-columns:34px 1fr 1fr .75fr 1fr 1fr 100px;gap:8px}.cm-destination{display:none}}@media(max-width:820px){.cm-root{padding:86px 12px 80px}.cm-header{align-items:start;flex-direction:column}.cm-header-actions{width:100%;flex-wrap:wrap}.cm-search{min-width:0;flex:1}.cm-layout{grid-template-columns:1fr}.cm-filters{position:static}.cm-filter-group{display:flex;flex-wrap:wrap;gap:5px}.cm-filter-option{width:auto;gap:7px}.cm-list{overflow-x:auto}.cm-list-head,.cm-case-row{min-width:900px}.cm-stats{grid-template-columns:repeat(2,1fr)}}
        .cm-root{background:#fff;color:#17231b}
        .cm-eyebrow,.cm-admin .cm-eyebrow{color:#126F1E}
        .cm-title{color:#17231b}
        .cm-subtitle{color:#60756a}
        .cm-header-actions button,.cm-header-actions select{background:#fff;color:#17231b;border-color:#b9c8bd}
        .cm-search{background:#fff;color:#17231b;border-color:#aebdb3}
        .cm-search::placeholder{color:#7a8a80}
        .cm-search:focus{border-color:#126F1E}
        .cm-filters{background:#fff;border-color:#d5e1d8;box-shadow:none}
        .cm-filter-heading{color:#22362a}
        .cm-clear{color:#126F1E}
        .cm-filter-group{border-color:#e0e9e3}
        .cm-filter-option{color:#5c7063}
        .cm-filter-option:hover,.cm-filter-option.selected{background:#eaf6ed;color:#126F1E}
        .cm-filter-count{border-color:#b8cbbd;color:#3e5947}
        .cm-stat{background:#fff;border-color:#d5e1d8}
        .cm-stat-label{color:#6a7b70}
        .cm-stat-value{color:#17231b}
        .cm-stat.red .cm-stat-value{color:#c62835}
        .cm-stat.yellow .cm-stat-value{color:#a66b00}
        .cm-stat.green .cm-stat-value{color:#126F1E}
        .cm-toolbar-label{color:#5c7063}
        .cm-toolbar-label b{color:#17231b}
        .cm-sort{background:#fff;color:#17231b;border-color:#b9c8bd}
        .cm-list{background:#fff;border-color:#d5e1d8}
        .cm-list-head{background:#f5faf6;color:#6c7d72;border-color:#d5e1d8}
        .cm-case-row{background:#fff;border-color:#e0e9e3}
        .cm-case-row:hover{background:#fbfefb}
        .cm-case-row.tone-red{border-left-color:#dc2635;background:#fff8f8}
        .cm-case-row.tone-yellow{border-left-color:#d9a300;background:#fffdf4}
        .cm-case-row.tone-green{border-left-color:#126F1E;background:#f8fdf9}
        .cm-condition-icon.tone-red{background:#fff0f1;color:#c62835;border-color:#efa4ab}
        .cm-condition-icon.tone-yellow{background:#fff8dc;color:#9b6800;border-color:#e7c65e}
        .cm-condition-icon.tone-green{background:#e8f7eb;color:#126F1E;border-color:#9fd3aa}
        .cm-case-type b,.cm-patient b,.cm-bed b,.cm-destination b{color:#17231b}
        .cm-case-type small,.cm-patient span,.cm-bed span,.cm-stage span,.cm-stage small,.cm-destination span,.cm-destination small{color:#6c7d72}
        .cm-priority.tone-red{background:#ffdfe2;color:#b51f2c}
        .cm-priority.tone-yellow{background:#fff0b8;color:#865900}
        .cm-priority.tone-green{background:#d9f2df;color:#126F1E}
        .cm-bed small{color:#718277}
        .cm-stage-label.tone-red{color:#c62835}
        .cm-stage-label.tone-yellow{color:#9b6800}
        .cm-stage-label.tone-green{color:#126F1E}
        .cm-actions button{background:#fff;color:#17231b;border-color:#b9c8bd}
        .cm-actions button:hover{border-color:#126F1E;background:#eaf6ed}
        .cm-actions .cm-open{background:#126F1E;border-color:#126F1E;color:#fff}
        .cm-filter-option.selected .cm-filter-count{color:inherit;border-color:currentColor}
        .cm-filter-option.tone-filter-red.selected{background:#c9152d;color:#fff}
        .cm-filter-option.tone-filter-yellow.selected{background:#f2b233;color:#17231b}
        .cm-filter-option.tone-filter-green.selected{background:#35ad52;color:#fff}
        html body #root .cm-root .cm-filter-option.tone-filter-red.selected{background:#c9152d!important;color:#fff!important;border-color:#c9152d!important}
        html body #root .cm-root .cm-filter-option.tone-filter-yellow.selected{background:#f2b233!important;color:#17231b!important;border-color:#f2b233!important}
        html body #root .cm-root .cm-filter-option.tone-filter-green.selected{background:#35ad52!important;color:#fff!important;border-color:#35ad52!important}
        html body #root .cm-root .cm-filter-option.selected .cm-filter-count{color:inherit!important;border-color:currentColor!important}
        .cm-empty,.cm-loading{color:#6c7d72}
        .cm-modal{background:#fff;color:#17231b;border-color:#cbd9ce;box-shadow:0 18px 45px rgba(18,111,30,.16)}
        .cm-modal-close{background:#edf5ef;color:#17231b}
        .cm-modal-field{border-color:#d5e1d8;background:#fbfefb}
        .cm-modal-field small{color:#6c7d72}
        .cm-modal-actions button{background:#126F1E;border-color:#126F1E}
        .cm-admin .cm-stats{display:none}
        .cm-admin .cm-case-row.tone-red{background:#fff8f8}
        .cm-admin .cm-case-row.tone-yellow{background:#fffdf4}
        .cm-admin .cm-case-row.tone-green{background:#f8fdf9}
        .cm-toast{position:fixed;right:24px;top:104px;z-index:11000;display:flex;align-items:center;gap:10px;min-width:250px;max-width:360px;padding:12px 15px;border:1px solid #b9cdbd;border-radius:10px;background:#fff;color:#17231b;font-size:12px;font-weight:800;box-shadow:0 10px 28px rgba(18,111,30,.16)}
        .cm-toast-success{border-color:#8bc99a}.cm-toast-success::before{content:"✓";display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#d9f2df;color:#126F1E;font-weight:900}.cm-toast-error{border-color:#efabb1}.cm-toast-error::before{content:"!";display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#ffdfe2;color:#b51f2c;font-weight:900}
        @media(max-width:820px){.cm-toast{right:12px;top:86px;min-width:0;max-width:calc(100vw - 24px)}}
      `}</style>
      <div className="cm-shell">
        <header className="cm-header">
          <div>
            <div className="cm-eyebrow">{isAdmin ? "NETWORK OPERATIONS · LIVE CASES" : "HOSPITAL OPERATIONS · ASSIGNED CASES"}</div>
            <h1 className="cm-title">{isAdmin ? "Manage cases" : "Assigned cases"}</h1>
            <p className="cm-subtitle">{isAdmin ? "Manage every emergency case across hospitals, ambulances and patient flow." : "Manage patients assigned to your hospital with condition, bed and care-team visibility."}</p>
          </div>
          <div className="cm-header-actions">
            <input className="cm-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, booking, bed..." />
            <button onClick={() => loadCases()}>↻ Refresh</button>
          </div>
        </header>

        <div className="cm-stats">
          <div className="cm-stat"><div className="cm-stat-label">Total cases</div><div className="cm-stat-value">{stats.total}</div></div>
          <div className="cm-stat red"><div className="cm-stat-label">Red priority</div><div className="cm-stat-value">{stats.urgent}</div></div>
          <div className="cm-stat yellow"><div className="cm-stat-label">Awaiting action</div><div className="cm-stat-value">{stats.awaiting}</div></div>
          <div className="cm-stat green"><div className="cm-stat-label">At destination</div><div className="cm-stat-value">{stats.resolved}</div></div>
        </div>

        <div className="cm-layout">
          <aside className="cm-filters">
            <div className="cm-filter-heading"><span>{isAdmin ? "CONDITION" : "CASE TYPE"}</span><button className="cm-clear" onClick={() => { setConditionFilter("all"); setPriorityFilter("all"); }}>CLEAR</button></div>
            {Object.entries(conditionCounts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => <button key={type} className={`cm-filter-option ${conditionFilter === type ? "selected" : ""}`} onClick={() => setConditionFilter(type)}><span>{type}</span><span className="cm-filter-count">{count}</span></button>)}
            {!Object.keys(conditionCounts).length && <div className="cm-empty" style={{ padding: "12px 0", textAlign: "left", fontSize: 11 }}>No case types</div>}
            {isAdmin ? (
              <div className="cm-filter-group">
                <div className="cm-filter-heading"><span>STATUS</span><button className="cm-clear" onClick={() => setPriorityFilter("all")}>CLEAR</button></div>
                {["red", "yellow", "green"].map((tone) => <button key={tone} className={`cm-filter-option tone-filter-${tone} ${priorityFilter === tone ? "selected" : ""}`} onClick={() => setPriorityFilter(priorityFilter === tone ? "all" : tone)}><span>{tone[0].toUpperCase() + tone.slice(1)}</span><span className="cm-filter-count">{cases.filter((item) => priorityMeta(item).tone === tone).length}</span></button>)}
              </div>
            ) : (
              <>
                <div className="cm-filter-group">
                  <div className="cm-filter-heading"><span>CALL STATUS</span><button className="cm-clear" onClick={() => setStageFilter("all")}>CLEAR</button></div>
                  {Object.entries(stageCounts).map(([stage, count]) => <button key={stage} className={`cm-filter-option ${stageFilter === stage ? "selected" : ""}`} onClick={() => setStageFilter(stage)}><span>{stage}</span><span className="cm-filter-count">{count}</span></button>)}
                </div>
                <div className="cm-filter-group">
                  <div className="cm-filter-heading"><span>PRIORITY</span></div>
                  {["red", "yellow", "green"].map((tone) => <button key={tone} className={`cm-filter-option tone-filter-${tone} ${priorityFilter === tone ? "selected" : ""}`} onClick={() => setPriorityFilter(priorityFilter === tone ? "all" : tone)}><span>{tone[0].toUpperCase() + tone.slice(1)}</span><span className="cm-filter-count">{cases.filter((item) => priorityMeta(item).tone === tone).length}</span></button>)}
                </div>
              </>
            )}
          </aside>

          <section className="cm-main">
            <div className="cm-toolbar"><div className="cm-toolbar-label">Showing <b>{filteredCases.length}</b> of <b>{cases.length}</b> assigned cases</div><select className="cm-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">Sort by newest</option><option value="priority">Sort by priority</option><option value="type">Sort by condition</option></select></div>
            <div className="cm-list">
              <div className="cm-list-head"><span></span><span>Condition</span><span>Patient</span><span>Bed no.</span><span>Call status</span><span>{isAdmin ? "Hospital / assigned team" : "Destination / assigned team"}</span><span>Actions</span></div>
              {loading && <div className="cm-loading">Loading assigned cases...</div>}
              {!loading && error && <div className="cm-empty">{error}</div>}
              {!loading && !error && !filteredCases.length && <div className="cm-empty">No cases match the selected filters.</div>}
              {!loading && !error && filteredCases.map((item) => <CaseRow key={item.id} item={item} scope={scope} onOpen={openCase} />)}
            </div>
          </section>
        </div>
      </div>

      {selected && (
        <div className="cm-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="cm-modal">
            <div className="cm-modal-head"><div><div className="cm-eyebrow">CASE #{selected.id}</div><h2>{selected.patient_name}</h2><p className="cm-subtitle">{selected.patient_condition || "Emergency care"}</p></div><button className="cm-modal-close" onClick={() => setSelected(null)}>✕</button></div>
            <div className="cm-modal-grid">
              <div className="cm-modal-field"><small>Priority</small><b>{priorityMeta(selected).label}</b></div>
              <div className="cm-modal-field"><small>Call status</small><b>{stageMeta(selected).label}</b></div>
              <div className="cm-modal-field"><small>Bed number</small><b>{selected.assigned_bed_number || "Not allocated"}</b></div>
              <div className="cm-modal-field"><small>Hospital</small><b>{selected.assigned_hospital_name}</b></div>
              <div className="cm-modal-field"><small>Ambulance</small><b>{selected.ambulance_number || "Not assigned"}</b></div>
              <div className="cm-modal-field"><small>Care team</small><b>{selected.assigned_doctor_names || "Not allocated"}</b></div>
              <div className="cm-modal-field" style={{ gridColumn: "1 / -1" }}><small>Clinical notes</small><b>{selected.vitals_summary || "No clinical notes available"}</b></div>
            </div>
            <div className="cm-modal-actions">
              <button onClick={() => navigate(isAdmin ? `/cases/${selected.id}` : `/hospital/cases/${selected.id}`)}>Open full case</button>
              {selected.assigned_bed_number && <button onClick={() => navigate(`/hospital/beds?booking_id=${selected.id}&type=${selected.assigned_bed_type || "general"}`)}>View bed</button>}
              {selected.assigned_team_members?.length > 0 && <button onClick={() => navigate(`/hospital/team-allocation/edit?booking_id=${selected.id}`)}>View care team</button>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
