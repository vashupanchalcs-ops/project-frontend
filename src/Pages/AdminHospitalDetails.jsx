import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, ExternalLink, MapPin, Phone, ShieldCheck } from "lucide-react";
import GoogleMapEmbed from "../Components/GoogleMapEmbed";
import { fetchFreshJson, readDataCache, writeDataCache } from "../utils/dataCache";
import { getHospitalCondition } from "../utils/hospitalCondition";

const BASE = (import.meta.env.VITE_API_BASE_URL || "https://swiftrescue-backend-shlb.onrender.com").replace(/\/+$/, "");

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
    available_icu_beds: 2,
    emergency_services: true,
    is_24x7: true,
    status: "active",
    is_active: true,
  },
];

const splitValues = (value) => String(value || "")
  .split(/[,•\n]/)
  .map((item) => item.trim())
  .filter(Boolean);

const formatRole = (value) => String(value || "staff")
  .replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toHospitalId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? String(id) : null;
};

const isHospitalDirectoryRow = (member = {}) => Boolean(
  member.hospital_contract_id
  || member.hospital_type
  || member.total_beds != null
  || member.available_beds != null
  || member.doctors_count != null
);

// Keep the admin directory compatible with older staff payloads while the
// hospital portal remains the single source of truth for the records.
const normalizeStaffMember = (member = {}) => ({
  ...member,
  full_name: member.full_name || member.name || member.staff_name || member.doctor_name || member.display_name || "",
  role: member.role || member.staff_role || member.designation || member.type || "staff",
  staff_id: member.staff_id || member.staffId || member.employee_id || "",
  specialization: member.specialization || member.speciality || member.department || "",
  registration_number: member.registration_number || member.registration_no || member.registrationNumber || "",
  contact_number: member.contact_number || member.phone || member.mobile || "",
  email: member.email || member.staff_email || "",
});

const normalizeStaffRows = (rows) => (Array.isArray(rows) ? rows : [])
  .filter((member) => member && typeof member === "object" && !isHospitalDirectoryRow(member))
  .map(normalizeStaffMember);

export default function AdminHospitalDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hospitalId: routeHospitalId } = useParams();
  const cachedData = readDataCache("hospitals_list", []);
  const cachedHospitals = Array.isArray(cachedData) && cachedData.length ? cachedData : (() => {
    try { return JSON.parse(sessionStorage.getItem("hospitals_list_cache") || "[]"); } catch { return []; }
  })();
  // A cached first row is not a reliable selection: the API can reorder
  // hospitals and a refreshed /HospitalPartnerDetails URL has no navigation
  // state. Only an explicit route/state id may select a hospital before the
  // fresh directory response arrives.
  const initialHospitalId = toHospitalId(routeHospitalId)
    || toHospitalId(location.state?.hospitalId)
    || null;
  const [hospitals, setHospitals] = useState(cachedHospitals);
  const [selectedHospitalId, setSelectedHospitalId] = useState(initialHospitalId);
  const [selectedDashboard, setSelectedDashboard] = useState(() => {
    if (initialHospitalId == null) return null;
    const cachedDashboard = readDataCache(`hospital_dashboard_${initialHospitalId}`, null);
    return cachedDashboard
      ? { ...cachedDashboard, staff: normalizeStaffRows(cachedDashboard.staff) }
      : {
          hospital: cachedHospitals.find((item) => String(item.id) === String(initialHospitalId)),
          summary: {},
          staff: [],
        };
  });
  const [pulseTime, setPulseTime] = useState(() => Date.now());

  useEffect(() => {
    fetchFreshJson(`${BASE}/api/hospitals/`, { key: "hospitals_list", fallback: [] })
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        const list = rows.length ? rows : DEFAULT_HOSPITALS;
        setHospitals(list);
        const defaultHospital = list.find((hospital) => Number(hospital.staff_total_count || 0) > 0) || list[0];
        if (defaultHospital) setSelectedHospitalId((current) => (
          current && list.some((hospital) => String(hospital.id) === String(current))
            ? current
            : String(defaultHospital.id)
        ));
      })
      .catch(() => {
        setHospitals(DEFAULT_HOSPITALS);
        setSelectedHospitalId((current) => current || String(DEFAULT_HOSPITALS[0].id));
      });
  }, []);

  useEffect(() => {
    if (!selectedHospitalId) return undefined;
    const key = `hospital_dashboard_${selectedHospitalId}`;
    // The dashboard contains a staff snapshot for convenience, but the
    // hospital staff endpoint is authoritative for the admin directory.
    // Fetch them independently so a slow/failed dashboard can never replace
    // the hospital's real roster with an unrelated cached list.
    Promise.allSettled([
      fetchFreshJson(`${BASE}/api/hospitals/${selectedHospitalId}/dashboard/?_=${Date.now()}`, { key, fallback: null }),
      fetchFreshJson(`${BASE}/api/hospitals/${selectedHospitalId}/staff/?_=${Date.now()}`, { key: `hospital_staff_${selectedHospitalId}`, fallback: [] }),
    ])
      .then(([dashboardResult, staffResult]) => {
        const data = dashboardResult.status === "fulfilled" && dashboardResult.value && typeof dashboardResult.value === "object"
          ? dashboardResult.value
          : null;
        const staffRequestSucceeded = staffResult.status === "fulfilled";
        const directStaffRows = staffRequestSucceeded ? normalizeStaffRows(staffResult.value) : null;
        const dashboardStaffRows = normalizeStaffRows(data?.staff);
        // If a legacy/proxy response accidentally returns the hospital list,
        // discard it and use the dashboard's real staff snapshot instead.
        const staffRows = staffRequestSucceeded
          ? (directStaffRows.length || (Array.isArray(staffResult.value) && staffResult.value.length === 0) ? directStaffRows : dashboardStaffRows)
          : dashboardStaffRows;
        const fallbackHospital = hospitals.find((hospital) => String(hospital.id) === String(selectedHospitalId));

        setSelectedDashboard((current) => writeDataCache(key, {
          ...(current || {}),
          ...(data || {}),
          hospital: data?.hospital || current?.hospital || fallbackHospital || null,
          // An empty array is valid: it means this hospital has no registered
          // staff. Only retain cached rows when the staff request itself failed.
          staff: staffRequestSucceeded
            ? staffRows
            : normalizeStaffRows(data?.staff || current?.staff || []),
        }));
      })
      .catch(() => undefined);
    return undefined;
  }, [selectedHospitalId, hospitals]);

  useEffect(() => {
    const timer = setInterval(() => setPulseTime(Date.now()), 12000);
    return () => clearInterval(timer);
  }, []);

  const hospital = selectedDashboard?.hospital || hospitals.find((item) => String(item.id) === String(selectedHospitalId)) || null;
  const condition = getHospitalCondition(hospital || {});
  const lat = Number(hospital?.latitude);
  const lng = Number(hospital?.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const totalBeds = condition.totalBeds;
  const availableBeds = condition.availableBeds;
  const bookedBeds = Math.max(0, totalBeds - availableBeds);
  const staff = normalizeStaffRows(selectedDashboard?.staff);
  const facilities = splitValues(hospital?.facilities);
  const specializations = splitValues(hospital?.specializations);

  const handleDirections = () => {
    const validCoords = hasCoords && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
    navigate("/directions", {
      state: {
        hospital: {
          name: hospital?.name || "Hospital",
          address: hospital?.address || "",
          latitude: validCoords ? lat : null,
          longitude: validCoords ? lng : null,
        },
      },
    });
  };

  return (
    <>
      <style>{`
        .ahd-root { min-height: 100vh; box-sizing: border-box; padding: 82px 34px 48px 96px; background: #f4faf7; color: #18241d; font-family: "Segoe UI", Arial, sans-serif; }
        .ahd-shell { max-width: 1450px; margin: 0 auto; }
        .ahd-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 2px 18px; border-bottom: 2px solid #1a9cf0; }
        .ahd-heading h1 { margin: 0; font-size: clamp(25px, 3vw, 35px); font-weight: 500; letter-spacing: -.6px; }
        .ahd-back { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #bfd2c6; border-radius: 8px; padding: 9px 13px; background: #fff; color: #185b3c; font-weight: 800; cursor: pointer; }
        .ahd-back:hover { background: #eaf8ef; border-color: #21804d; }
        .ahd-layout { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); gap: 18px; margin-top: 18px; padding: 18px; border: 1px solid #b8d5c3; background: #fff; }
        .ahd-panel { min-width: 0; border: 1px solid #d4e3da; border-radius: 12px; padding: 18px; background: #fff; }
        .ahd-panel h2 { margin: 0; font-size: 22px; font-weight: 800; color: #145b3b; }
        .ahd-panel-sub { margin: 6px 0 16px; color: #6d7d73; font-size: 12px; }
        .ahd-condition { display: inline-flex; align-items: center; gap: 7px; border-radius: 8px; padding: 7px 10px; font-size: 11px; font-weight: 900; letter-spacing: .3px; text-transform: uppercase; }
        .ahd-condition::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .ahd-condition-green { color: #18733f; background: #e4f8ea; }
        .ahd-condition-yellow { color: #986000; background: #fff4c8; }
        .ahd-condition-red { color: #ad2438; background: #ffe5e8; }
        .ahd-profile-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .ahd-service { display: flex; align-items: center; gap: 9px; border: 1px solid #dce9e1; border-radius: 10px; padding: 12px; margin-top: 16px; color: #176c3e; font-size: 12px; font-weight: 800; }
        .ahd-service-dot { width: 9px; height: 9px; border-radius: 50%; background: #18a957; }
        .ahd-service small { color: #66776d; font-weight: 500; }
        .ahd-section { margin-top: 14px; border: 1px solid #dce6e0; border-radius: 10px; padding: 13px; }
        .ahd-section h3 { margin: 0 0 9px; font-size: 13px; color: #405348; }
        .ahd-contact-line { display: flex; align-items: flex-start; gap: 7px; margin-top: 7px; color: #506057; font-size: 12px; line-height: 1.4; }
        .ahd-contact-line svg { flex: 0 0 auto; color: #c43d4c; margin-top: 1px; }
        .ahd-capacity { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .ahd-capacity-card { min-width: 0; border-radius: 9px; padding: 11px 9px; background: #eef9f2; }
        .ahd-capacity-card small { display: block; color: #64776b; font-size: 10px; }
        .ahd-capacity-card strong { display: block; margin-top: 5px; color: #12643d; font-size: 22px; line-height: 1; }
        .ahd-chip-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
        .ahd-chip { min-height: 43px; padding: 8px; border-radius: 7px; background: #f1f8f3; color: #53645a; font-size: 11px; line-height: 1.35; }
        .ahd-assignment { margin-top: 14px; border-radius: 10px; padding: 12px; background: #e1f6eb; color: #246047; font-size: 11px; line-height: 1.5; }
        .ahd-assignment strong { display: block; margin-bottom: 3px; color: #14613b; }
        .ahd-map-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .ahd-map-head h2 { color: #202c26; }
        .ahd-map { min-height: 420px; height: min(52vw, 500px); margin-top: 10px; overflow: hidden; border-radius: 12px; background: #e9f1ec; }
        .ahd-map-empty { display: grid; place-items: center; height: 100%; color: #64766b; font-size: 13px; }
        .ahd-map-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; border: 1px solid #dce6e0; border-radius: 10px; padding: 11px 12px; color: #607068; font-size: 11px; }
        .ahd-map-footer span { overflow-wrap: anywhere; }
        .ahd-directions { border: 0; border-radius: 8px; padding: 10px 15px; background: #12834b; color: #fff; font-weight: 800; cursor: pointer; white-space: nowrap; }
        .ahd-directions:hover { background: #0c683b; }
        .ahd-staff-section { margin-top: 18px; padding: 18px; border: 1px solid #b8d5c3; background: #fff; }
        .ahd-staff-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .ahd-staff-heading h2 { margin: 0; font-size: 22px; color: #18241d; }
        .ahd-staff-count { color: #5f7167; font-size: 12px; font-weight: 800; }
        .ahd-staff-wrap { overflow-x: auto; border: 1px solid #dce7e0; border-radius: 10px; }
        .ahd-staff-table { width: 100%; min-width: 830px; border-collapse: collapse; }
        .ahd-staff-table th { padding: 11px 12px; background: #f7faf8; border-bottom: 1px solid #dce7e0; text-align: left; color: #64756b; font-size: 10px; text-transform: uppercase; letter-spacing: .7px; }
        .ahd-staff-table td { padding: 12px; border-bottom: 1px solid #edf2ee; font-size: 12px; color: #1d2c23; vertical-align: middle; }
        .ahd-staff-table tr:last-child td { border-bottom: 0; }
        .ahd-staff-table tbody tr:hover { background: #fbfefc; }
        .ahd-staff-person { display: flex; align-items: center; gap: 9px; min-width: 175px; }
        .ahd-staff-avatar { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: #eef4ff; border: 1px solid #c6d8f5; color: #275d96; font-weight: 900; }
        .ahd-staff-name { font-weight: 800; }
        .ahd-staff-sub { margin-top: 3px; color: #738178; font-size: 10px; }
        .ahd-staff-status { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; }
        .ahd-staff-status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
        .ahd-staff-status.active { color: #1d8a4d; }
        .ahd-staff-status.inactive { color: #b1283b; }
        .ahd-empty { padding: 26px 12px; text-align: center; color: #68786e; font-size: 12px; }
        @media (max-width: 1050px) { .ahd-layout { grid-template-columns: 1fr; } .ahd-map { height: 430px; } }
        @media (max-width: 700px) { .ahd-root { padding: 74px 12px 32px; } .ahd-heading { align-items: flex-start; flex-direction: column; } .ahd-layout, .ahd-staff-section { padding: 12px; } .ahd-profile-head { flex-direction: column; } .ahd-capacity, .ahd-chip-grid { grid-template-columns: 1fr 1fr; } .ahd-map { min-height: 330px; height: 330px; } .ahd-map-footer { align-items: flex-start; flex-direction: column; } }
      `}</style>

      <main className="ahd-root">
        <div className="ahd-shell">
          <header className="ahd-heading">
            <h1>Hospital Details</h1>
            <button className="ahd-back" type="button" onClick={() => navigate("/Hospitals")}><ArrowLeft size={16} /> Back to Hospital Partners</button>
          </header>

          {!hospital && <div className="ahd-panel ahd-empty">Hospital details are not available yet.</div>}

          {hospital && (
            <>
              <div className="ahd-layout">
                <section className="ahd-panel">
                  <div className="ahd-profile-head">
                    <div>
                      <h2>{hospital.name || "Hospital"}</h2>
                      <div className="ahd-panel-sub">Hospital profile & emergency capabilities</div>
                    </div>
                    <span className={`ahd-condition ahd-condition-${condition.key}`}>{condition.label} condition</span>
                  </div>

                  <div className="ahd-service"><span className="ahd-service-dot" /> Emergency Services {hospital.emergency_services ? "Available" : "Not listed"}<small> · {hospital.is_24x7 ? "24/7" : "Scheduled"}</small></div>

                  <section className="ahd-section">
                    <h3>Contact & Location</h3>
                    <div className="ahd-contact-line"><MapPin size={14} /> <span>{hospital.address || [hospital.city, hospital.state, hospital.pincode].filter(Boolean).join(", ") || "Address not added"}</span></div>
                    <div className="ahd-contact-line"><Phone size={14} /> <span>{hospital.contact_number || "Contact number not added"}</span>{hospital.emergency_contact ? <span> · Emergency {hospital.emergency_contact}</span> : null}</div>
                    <div className="ahd-contact-line"><Clock3 size={14} /> <span>{hospital.email || "Email not added"}</span></div>
                  </section>

                  <section className="ahd-section">
                    <h3>Hospital Capacity</h3>
                    <div className="ahd-capacity">
                      <div className="ahd-capacity-card"><small>Total beds</small><strong>{totalBeds}</strong><small>{bookedBeds} booked · {availableBeds} available</small></div>
                      <div className="ahd-capacity-card"><small>ICU beds</small><strong>{condition.totalIcuBeds}</strong><small>{condition.availableIcuBeds} available</small></div>
                      <div className="ahd-capacity-card"><small>Doctors</small><strong>{hospital.doctors_count ?? 0}</strong><small>{hospital.doctors_active ?? 0} active</small></div>
                    </div>
                  </section>

                  <section className="ahd-section">
                    <h3>Emergency & Facilities</h3>
                    <div className="ahd-chip-grid">
                      {(facilities.length ? facilities : specializations).slice(0, 6).map((item) => <div className="ahd-chip" key={item}>{item}</div>)}
                      {!facilities.length && !specializations.length && <div className="ahd-chip">Facilities not added</div>}
                    </div>
                  </section>

                  <div className="ahd-assignment"><strong>Aarogya Assignment</strong>Live capacity and emergency capability · {hospital.hospital_type || "Hospital partner"} · {hospital.has_blood_bank ? "Blood bank available" : "Blood bank not listed"}</div>
                </section>

                <section className="ahd-panel">
                  <div className="ahd-map-head">
                    <div><h2>Hospital Location</h2><div className="ahd-panel-sub">Live map & nearby medical facilities</div></div>
                    <ShieldCheck size={24} color="#12834b" />
                  </div>
                  <div className="ahd-map">
                    {hasCoords ? <GoogleMapEmbed destinationLoc={{ lat, lng, name: hospital.name || "Hospital" }} height="100%" /> : <div className="ahd-map-empty">No valid location found for this hospital.</div>}
                  </div>
                  <div className="ahd-map-footer">
                    <span><MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} /> {hasCoords ? `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E` : hospital.address || "Location not added"}</span>
                    <button className="ahd-directions" type="button" onClick={handleDirections}><ExternalLink size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} /> Get Directions</button>
                  </div>
                </section>
              </div>

              <section className="ahd-staff-section">
                <div className="ahd-staff-heading"><h2>Doctors & Staff Directory</h2><span className="ahd-staff-count">{staff.length} registered staff</span></div>
                {staff.length ? (
                  <div className="ahd-staff-wrap">
                    <table className="ahd-staff-table">
                      <thead><tr><th>Staff member</th><th>Role / department</th><th>Staff ID</th><th>Contact</th><th>Experience</th><th>Status</th></tr></thead>
                      <tbody>
                        {staff.map((member) => {
                          const initials = String(member.full_name || "Staff").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                          return (
                            <tr key={member.id}>
                              <td><div className="ahd-staff-person"><span className="ahd-staff-avatar">{initials || "S"}</span><div><div className="ahd-staff-name">{member.full_name || "Unnamed staff"}</div><div className="ahd-staff-sub">{member.email || "Email not added"}</div></div></div></td>
                              <td><strong>{formatRole(member.role)}</strong><div className="ahd-staff-sub">{member.specialization || "General care"}</div></td>
                              <td>{member.staff_id || "—"}<div className="ahd-staff-sub">Reg. {member.registration_number || "—"}</div></td>
                              <td>{member.contact_number || "—"}</td>
                              <td>{Number(member.years_experience || 0)} years<div className="ahd-staff-sub">{member.shift || "Day"}{member.is_on_call ? " · On call" : ""}</div></td>
                              <td><span className={`ahd-staff-status ${member.is_active ? "active" : "inactive"}`}>{member.is_active ? "Active" : "Inactive"}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="ahd-empty">No staff registered for this hospital.</div>}
              </section>

              <div style={{ marginTop: 12, textAlign: "right", color: "#738178", fontSize: 11 }}>Live data refreshed at {new Date(pulseTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
