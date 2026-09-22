import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Download, Eye, Search, SlidersHorizontal } from "lucide-react";
import { formatHospitalDate, getHospitalCondition } from "../utils/hospitalCondition";

const conditionOrder = { red: 0, yellow: 1, green: 2 };

function exportHospitals(rows) {
  const headings = ["Hospital", "Email", "Phone", "Condition", "Submitted on", "Beds", "ICU beds", "Active staff"];
  const values = rows.map((hospital) => {
    const condition = getHospitalCondition(hospital);
    return [
      hospital.name || "",
      hospital.email || "",
      hospital.contact_number || "",
      condition.label,
      formatHospitalDate(hospital.created_at),
      `${condition.availableBeds}/${condition.totalBeds}`,
      `${condition.availableIcuBeds}/${condition.totalIcuBeds}`,
      `${condition.activeStaff}/${condition.totalStaff}`,
    ];
  });
  const csv = [headings, ...values]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "hospital-partners.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminHospitals({
  hospitals = [],
  assignBookingId = null,
  reselectForBookingId = null,
  onAssign,
  onReassign,
  assignmentBusy = false,
  assignmentError = "",
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("condition");

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = hospitals.filter((hospital) => {
      if (!search) return true;
      return [hospital.name, hospital.email, hospital.contact_number, hospital.city, hospital.state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

    return filtered.sort((a, b) => {
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "date") return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      return conditionOrder[getHospitalCondition(a).key] - conditionOrder[getHospitalCondition(b).key];
    });
  }, [hospitals, query, sortBy]);

  const counts = useMemo(() => hospitals.reduce((result, hospital) => {
    result[getHospitalCondition(hospital).key] += 1;
    return result;
  }, { green: 0, yellow: 0, red: 0 }), [hospitals]);

  return (
    <>
      <style>{`
        .admin-hospitals-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 88px 34px 46px 96px;
          background: #f7faf9;
          color: #101820;
          font-family: "Segoe UI", Arial, sans-serif;
        }
        .admin-hospitals-shell { max-width: 1500px; margin: 0 auto; }
        .admin-hospitals-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          padding: 25px 28px;
          border: 1px solid #b8d9c2;
          border-radius: 14px;
          background: #fff;
        }
        .admin-hospitals-kicker {
          margin: 0 0 7px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: #37604a;
        }
        .admin-hospitals-header h1 { margin: 0; font-size: clamp(28px, 3vw, 42px); font-weight: 500; letter-spacing: -1.1px; }
        .admin-hospitals-header p { margin: 8px 0 0; color: #52616b; font-size: 15px; }
        .admin-hospitals-summary { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
        .admin-hospitals-summary span { padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; white-space: nowrap; }
        .admin-summary-green { color: #146b3a; background: #e2f7e9; }
        .admin-summary-yellow { color: #8b5b00; background: #fff3c4; }
        .admin-summary-red { color: #a41f32; background: #ffe3e7; }
        .admin-hospitals-panel { margin-top: 18px; border: 1px solid #d3e3da; border-radius: 14px; background: #fff; overflow: hidden; }
        .admin-hospitals-toolbar { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #e3ece7; }
        .admin-hospitals-search { display: flex; align-items: center; gap: 9px; flex: 1; min-width: 220px; border: 1px solid #d5dfda; border-radius: 9px; padding: 0 12px; height: 40px; color: #708078; }
        .admin-hospitals-search input { border: 0; outline: 0; width: 100%; height: 100%; font-size: 14px; color: #152019; background: transparent; }
        .admin-hospitals-select { position: relative; display: flex; align-items: center; }
        .admin-hospitals-select select { appearance: none; height: 40px; min-width: 130px; padding: 0 32px 0 12px; border: 1px solid #d5dfda; border-radius: 9px; background: #fff; color: #152019; font-size: 13px; }
        .admin-hospitals-select svg { position: absolute; right: 9px; pointer-events: none; color: #63736b; }
        .admin-hospitals-tool { height: 40px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border: 1px solid #d5dfda; border-radius: 9px; background: #fff; color: #152019; font-weight: 700; cursor: pointer; }
        .admin-hospitals-tool:hover { border-color: #267a4c; background: #f0faf3; }
        .admin-hospitals-count { margin-left: auto; color: #64736b; font-size: 13px; white-space: nowrap; }
        .admin-hospitals-table-wrap { overflow-x: auto; }
        .admin-hospitals-table { width: 100%; min-width: 1050px; border-collapse: collapse; table-layout: fixed; }
        .admin-hospitals-table th { padding: 13px 15px; background: #f7f9f8; border-bottom: 1px solid #dfe9e3; text-align: left; color: #607168; font-size: 11px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; }
        .admin-hospitals-table td { padding: 14px 15px; border-bottom: 1px solid #edf2ef; vertical-align: middle; font-size: 13px; }
        .admin-hospitals-table tbody tr:hover { background: #fbfefc; }
        .admin-hospital-name { display: flex; flex-direction: column; gap: 4px; font-weight: 800; color: #14251b; }
        .admin-hospital-sub { color: #73827a; font-size: 11px; font-weight: 500; }
        .admin-hospital-contact { display: flex; flex-direction: column; gap: 4px; color: #34473c; }
        .admin-capacity { color: #3c4d43; line-height: 1.45; }
        .admin-capacity strong { color: #14251b; }
        .admin-condition { display: inline-flex; align-items: center; gap: 7px; border-radius: 7px; padding: 6px 9px; font-size: 12px; font-weight: 800; }
        .admin-condition::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
        .admin-condition-green { color: #18733f; background: #e4f8ea; }
        .admin-condition-yellow { color: #986000; background: #fff4c8; }
        .admin-condition-red { color: #ad2438; background: #ffe5e8; }
        .admin-view-button { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cddbd2; border-radius: 8px; padding: 8px 12px; background: #fff; color: #1c5c3b; font-weight: 800; cursor: pointer; }
        .admin-view-button:hover { border-color: #1c7a48; background: #ecf9f0; }
        .admin-assign-button { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #e18b12; border-radius: 8px; padding: 8px 12px; background: #f59a23; color: #111; font-weight: 800; cursor: pointer; }
        .admin-assign-button:hover:not(:disabled) { background: #e98b13; border-color: #c87308; }
        .admin-assign-button:disabled { cursor: not-allowed; opacity: .55; }
        .admin-hospital-assignment-banner { margin: 16px 18px 0; padding: 11px 13px; border: 1px solid #f0b36a; border-radius: 9px; background: #fff7e8; color: #8c4a05; font-size: 13px; font-weight: 700; }
        .admin-hospital-assignment-error { margin: 16px 18px 0; padding: 11px 13px; border: 1px solid #e7a1a8; border-radius: 9px; background: #fff0f1; color: #a41f32; font-size: 13px; font-weight: 700; }
        .admin-hospitals-empty { padding: 42px 18px; text-align: center; color: #68786e; }
        @media (max-width: 760px) {
          .admin-hospitals-page { padding: 76px 12px 28px; }
          .admin-hospitals-header { flex-direction: column; padding: 20px; }
          .admin-hospitals-summary { justify-content: flex-start; }
          .admin-hospitals-toolbar { flex-wrap: wrap; }
          .admin-hospitals-count { margin-left: 0; width: 100%; }
        }
      `}</style>

      <main className="admin-hospitals-page">
        <div className="admin-hospitals-shell">
          <header className="admin-hospitals-header">
            <div>
              <div className="admin-hospitals-kicker">Admin hospital network</div>
              <h1>Hospital Partners</h1>
              <p>Review live bed, ICU and staff capacity before approving a hospital.</p>
            </div>
            <div className="admin-hospitals-summary" aria-label="Hospital condition summary">
              <span className="admin-summary-green">{counts.green} Green</span>
              <span className="admin-summary-yellow">{counts.yellow} Yellow</span>
              <span className="admin-summary-red">{counts.red} Red</span>
            </div>
          </header>

          <section className="admin-hospitals-panel">
            {assignBookingId && <div className="admin-hospital-assignment-banner">Choose a hospital to assign Booking #{assignBookingId}. The existing hospital alert and booking workflow will continue after assignment.</div>}
            {reselectForBookingId && <div className="admin-hospital-assignment-banner">Choose a hospital to reassign Booking #{reselectForBookingId}. The booking will be updated and the hospital will be notified.</div>}
            {assignmentError && <div className="admin-hospital-assignment-error" role="alert">{assignmentError}</div>}
            <div className="admin-hospitals-toolbar">
              <label className="admin-hospitals-search">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email or phone" />
              </label>
              <label className="admin-hospitals-select">
                <SlidersHorizontal size={15} style={{ marginRight: 7, color: "#63736b" }} />
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort hospitals">
                  <option value="condition">Sort by condition</option>
                  <option value="name">Sort by name</option>
                  <option value="date">Sort by newest</option>
                </select>
                <ChevronDown size={15} />
              </label>
              <button className="admin-hospitals-tool" type="button" onClick={() => exportHospitals(rows)}>
                <Download size={15} /> Export CSV
              </button>
              <span className="admin-hospitals-count">{rows.length} of {hospitals.length} hospitals</span>
            </div>

            <div className="admin-hospitals-table-wrap">
              <table className="admin-hospitals-table">
                <colgroup><col style={{ width: "22%" }} /><col style={{ width: "18%" }} /><col style={{ width: "14%" }} /><col style={{ width: "11%" }} /><col style={{ width: "12%" }} /><col style={{ width: "14%" }} /><col style={{ width: "9%" }} /></colgroup>
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Submitted on</th>
                    <th>Approve as</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((hospital) => {
                    const condition = getHospitalCondition(hospital);
                    const canAssign = hospital.is_active !== false && String(hospital.status || "").toLowerCase() !== "closed" && condition.availableBeds > 0;
                    return (
                      <tr key={hospital.id}>
                        <td>
                          <div className="admin-hospital-name">
                            <span>{hospital.name || "Unnamed Hospital"}</span>
                            <span className="admin-hospital-sub">{hospital.city || hospital.address || "Location not added"}</span>
                          </div>
                        </td>
                        <td>{hospital.email || "—"}</td>
                        <td><div className="admin-hospital-contact"><span>{hospital.contact_number || "—"}</span><span className="admin-hospital-sub">Beds {condition.availableBeds}/{condition.totalBeds} · ICU {condition.availableIcuBeds}/{condition.totalIcuBeds}</span></div></td>
                        <td><span className={`admin-condition admin-condition-${hospital.is_active === false ? "red" : "green"}`}>{hospital.is_active === false ? "Inactive" : "Active"}</span></td>
                        <td>{formatHospitalDate(hospital.created_at)}</td>
                        <td><span className={`admin-condition admin-condition-${condition.key}`} title={condition.description}>{condition.label}</span></td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                            <button className="admin-view-button" type="button" onClick={() => navigate(`/HospitalPartnerDetails/${hospital.id}`, { state: { hospitalId: hospital.id } })}><Eye size={15} /> View</button>
                            {assignBookingId && <button className="admin-assign-button" type="button" disabled={!canAssign || assignmentBusy} onClick={() => onAssign?.(hospital)}>{assignmentBusy ? "Saving..." : canAssign ? "Assign" : "Unavailable"}</button>}
                            {reselectForBookingId && <button className="admin-assign-button" type="button" disabled={!canAssign || assignmentBusy} onClick={() => onReassign?.(hospital)}>{assignmentBusy ? "Saving..." : canAssign ? "Reassign" : "Unavailable"}</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <div className="admin-hospitals-empty">No hospital matches your search.</div>}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
