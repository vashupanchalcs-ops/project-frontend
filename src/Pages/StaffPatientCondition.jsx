import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Image as ImageIcon, RefreshCw, X } from "lucide-react";

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const caseTone = (booking) => {
  const text = `${booking?.patient_condition || ""} ${booking?.vitals_summary || ""}`.toLowerCase();
  if (["critical", "cardiac", "stroke", "trauma", "icu", "emergency"].some((token) => text.includes(token))) return "red";
  if (["monitor", "observation", "serious", "awaiting", "pending"].some((token) => text.includes(token))) return "yellow";
  return "green";
};

export default function StaffPatientCondition() {
  const staffId = localStorage.getItem("staff_id") || "";
  const email = localStorage.getItem("user") || "";
  const [cases, setCases] = useState([]);
  const [photosByCase, setPhotosByCase] = useState({});
  const [selected, setSelected] = useState(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!staffId || !email) { setError("Staff session is missing. Please sign in again."); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch(`${BASE}/api/staff/dashboard/?staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load assigned cases");
      const rows = Array.isArray(data.cases) ? data.cases : [];
      setCases(rows);
      const entries = await Promise.all(rows.map(async (booking) => {
        const photoResponse = await fetch(`${BASE}/api/bookings/${booking.id}/photos/?role=staff&staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`, { cache: "no-store" });
        const photoData = await photoResponse.json().catch(() => ({}));
        return [booking.id, photoResponse.ok && Array.isArray(photoData.photos) ? photoData.photos : []];
      }));
      setPhotosByCase(Object.fromEntries(entries));
      setError("");
    } catch (err) { setError(err.message || "Unable to load patient condition photos"); }
    finally { setLoading(false); }
  }, [email, staffId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [load]);
  const activePhotos = useMemo(() => selected ? (photosByCase[selected.id] || []) : [], [photosByCase, selected]);
  const openViewer = (booking) => { setSelected(booking); setIndex(0); };
  const currentPhoto = activePhotos[index];

  return <main className="staff-condition-root"><style>{`.staff-condition-root{padding-top:96px!important}@media(max-width:600px){.staff-condition-root{padding-top:92px!important}}`}</style>
    <style>{`
      .staff-condition-root{min-height:100vh;background:#fff;color:#132219;padding:40px clamp(18px,5vw,72px) 80px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;box-sizing:border-box;overflow-x:hidden}.staff-condition-shell{max-width:1380px;margin:0 auto}.staff-condition-kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:#16743a}.staff-condition-title{font-size:clamp(32px,4vw,52px);letter-spacing:-.05em;line-height:1;margin:9px 0 7px;color:#111}.staff-condition-sub{margin:0;color:#66766d}.staff-condition-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.staff-condition-refresh{border:1px solid #bcd4c3;background:#fff;border-radius:9px;padding:10px 14px;color:#136b35;font-weight:900;cursor:pointer}.staff-condition-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));align-items:stretch;gap:15px;margin-top:28px}.staff-condition-card{display:flex;flex-direction:column;min-height:360px;border:1px solid #cfddd2;border-left:6px solid #23a455;border-radius:13px;background:#fff;padding:18px;min-width:0;box-shadow:0 5px 18px rgba(31,82,48,.06)}.staff-condition-card.red{border-left-color:#dc2634}.staff-condition-card.yellow{border-left-color:#e2ab12}.staff-condition-top{display:flex;justify-content:space-between;gap:10px}.staff-condition-tone{border-radius:5px;padding:5px 8px;font-size:10px;font-weight:900;text-transform:uppercase}.staff-condition-tone.red{background:#ffe2e4;color:#ad1d2a}.staff-condition-tone.yellow{background:#fff0bd;color:#805700}.staff-condition-tone.green{background:#ddf5e5;color:#13713c}.staff-condition-patient{font-weight:900;font-size:19px;margin:15px 0 4px;overflow-wrap:anywhere}.staff-condition-meta{color:#65756b;font-size:12px;line-height:1.6;min-height:58px}.staff-condition-thumbs{display:flex;gap:8px;min-height:64px;margin:10px 0 2px;overflow:hidden}.staff-condition-thumb{width:68px;height:58px;object-fit:cover;border-radius:8px;border:1px solid #c9e0d0;background:#f3f7f4}.staff-condition-thumb-more{display:grid;place-items:center;width:68px;height:58px;border:1px dashed #9fc3aa;border-radius:8px;color:#126f1e;font-size:12px;font-weight:900}.staff-condition-count{margin:9px 0 12px;color:#126f1e;font-size:13px;font-weight:900}.staff-condition-view{width:100%;margin-top:auto;border:0;border-radius:8px;background:#126f1e;color:#fff;padding:13px;font-weight:900;cursor:pointer;box-shadow:0 4px 10px rgba(18,111,30,.2)}.staff-condition-view:hover{background:#0d5718}.staff-condition-view:disabled{background:#b7c9bb;cursor:not-allowed;box-shadow:none}.staff-condition-error{margin-top:18px;padding:13px;border:1px solid #efb5ba;background:#fff4f4;border-radius:10px;color:#a31e2a}.staff-condition-empty{grid-column:1/-1;border:1px dashed #bfd2c3;border-radius:12px;padding:40px;text-align:center;color:#6f7d73}.staff-condition-overlay{position:fixed;inset:0;background:rgba(9,20,13,.72);display:grid;place-items:center;padding:20px;z-index:10001}.staff-condition-modal{width:min(900px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:16px;padding:16px;position:relative}.staff-condition-close{position:absolute;right:12px;top:12px;border:1px solid #cad8ce;background:#fff;border-radius:50%;width:34px;height:34px;cursor:pointer}.staff-condition-modal-title{font-size:20px;font-weight:900;margin:2px 42px 12px}.staff-condition-image-wrap{background:#f1f5f2;border-radius:11px;display:grid;place-items:center;min-height:300px;overflow:hidden}.staff-condition-image{max-width:100%;max-height:62vh;object-fit:contain}.staff-condition-caption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#53645a;font-size:12px;margin-top:10px}.staff-condition-nav{display:flex;justify-content:space-between;margin-top:12px}.staff-condition-nav button{border:1px solid #bcd4c3;background:#fff;color:#126f1e;border-radius:8px;padding:9px 13px;font-weight:900;cursor:pointer}.staff-condition-nav button:disabled{opacity:.4;cursor:not-allowed}@media(max-width:600px){.staff-condition-root{padding:25px 14px 82px}.staff-condition-grid{grid-template-columns:1fr}.staff-condition-refresh{margin-top:15px}.staff-condition-image-wrap{min-height:230px}}
    `}</style>
    <div className="staff-condition-shell">
      <header className="staff-condition-head"><div><div className="staff-condition-kicker">Care team · patient condition</div><h1 className="staff-condition-title">Patient photos</h1><p className="staff-condition-sub">View condition images sent by the ambulance driver for your assigned cases.</p></div><button className="staff-condition-refresh" onClick={load} disabled={loading}><RefreshCw size={15} style={{ verticalAlign: "-3px", marginRight: 5 }} />Refresh</button></header>
      {error && <div className="staff-condition-error">{error}</div>}
      {loading && !cases.length ? <div className="staff-condition-empty" style={{ marginTop: 28 }}>Loading assigned cases…</div> : <section className="staff-condition-grid">{!cases.length && <div className="staff-condition-empty">No cases are assigned to you right now.</div>}{cases.map((booking) => { const currentTone = caseTone(booking); const photos = photosByCase[booking.id] || []; return <article className={`staff-condition-card ${currentTone}`} key={booking.id}><div className="staff-condition-top"><span className={`staff-condition-tone ${currentTone}`}>{currentTone}</span><span style={{ color: "#718176", fontSize: 11 }}>Booking #{booking.id}</span></div><div className="staff-condition-patient">{booking.patient_name || booking.booked_by || "Patient"}</div><div className="staff-condition-meta">Age: {booking.patient_age || "—"} · {booking.patient_gender || "—"}<br />{booking.patient_condition || booking.vitals_summary || "Condition details pending"}<br />Bed: {booking.assigned_bed_number || "Not allocated"}</div>{photos.length > 0 && <div className="staff-condition-thumbs">{photos.slice(0, 4).map((photo) => <img className="staff-condition-thumb" key={photo.id} src={photo.url} alt={photo.label || "Patient condition"} />)}{photos.length > 4 && <span className="staff-condition-thumb-more">+{photos.length - 4}</span>}</div>}<div className="staff-condition-count"><ImageIcon size={15} style={{ verticalAlign: "-3px", marginRight: 5 }} />{photos.length} condition photo(s)</div><button className="staff-condition-view" disabled={!photos.length} onClick={() => openViewer(booking)}><Eye size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />View patient condition</button></article>;})}</section>}
    </div>
    {selected && <div className="staff-condition-overlay" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div className="staff-condition-modal"><button className="staff-condition-close" onClick={() => setSelected(null)}><X size={17} /></button><div className="staff-condition-modal-title">{selected.patient_name || selected.booked_by || "Patient"} · Condition photos</div><div className="staff-condition-image-wrap">{currentPhoto ? <img className="staff-condition-image" src={currentPhoto.url} alt={currentPhoto.label} /> : <div>No photo available</div>}</div>{currentPhoto && <div className="staff-condition-caption"><span><b>{currentPhoto.label}</b> · {currentPhoto.instruction}</span><span>{currentPhoto.created_at ? new Date(currentPhoto.created_at).toLocaleString("en-IN") : ""}</span></div>}<div className="staff-condition-nav"><button disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={15} style={{ verticalAlign: "-3px" }} /> Previous</button><span style={{ alignSelf: "center", fontSize: 12, color: "#63736a" }}>{activePhotos.length ? `${index + 1} / ${activePhotos.length}` : "0 / 0"}</span><button disabled={index >= activePhotos.length - 1} onClick={() => setIndex((value) => Math.min(activePhotos.length - 1, value + 1))}>Next <ChevronRight size={15} style={{ verticalAlign: "-3px" }} /></button></div></div></div>}
  </main>;
}
