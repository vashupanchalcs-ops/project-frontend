import { useCallback, useEffect, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, RefreshCw, Send, Trash2 } from "lucide-react";

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
const requirements = [
  { type: "ecg", label: "ECG", hint: "Send a clear ECG strip or ECG monitor photo." },
  { type: "patient", label: "Patient condition", hint: "Show the patient's current visible condition." },
  { type: "patient_id", label: "Patient ID", hint: "Capture the patient ID/document only when permitted." },
  { type: "vitals", label: "Vitals / monitor", hint: "Keep the monitor numbers readable." },
  { type: "documents", label: "Medical document", hint: "Send prescriptions or relevant medical documents." },
  { type: "other", label: "Other", hint: "Send another clinically relevant image." },
];

const tone = (booking) => {
  const text = `${booking?.patient_condition || ""} ${booking?.vitals_summary || ""}`.toLowerCase();
  if (["critical", "cardiac", "stroke", "trauma", "icu", "emergency"].some((x) => text.includes(x))) return "red";
  if (["monitor", "observation", "serious", "awaiting", "pending"].some((x) => text.includes(x))) return "yellow";
  return "green";
};

export default function DriverVoiceReports() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [photoType, setPhotoType] = useState("patient");
  const [draftsByBooking, setDraftsByBooking] = useState({});
  const [pendingByBooking, setPendingByBooking] = useState({});
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const ambulanceId = Number(localStorage.getItem("ambulance_id") || 0);
  const driverEmail = localStorage.getItem("user") || localStorage.getItem("driver_email") || "";
  const driverName = localStorage.getItem("name") || localStorage.getItem("driver_name") || "Ambulance driver";

  const load = useCallback(async () => {
    if (!ambulanceId) {
      setError("Your ambulance is not linked to this driver session. Please sign in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${BASE}/api/bookings/driver-assigned/?ambulance_id=${ambulanceId}&driver_email=${encodeURIComponent(driverEmail)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load assigned bookings");
      setBookings(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load assigned bookings");
    } finally {
      setLoading(false);
    }
  }, [ambulanceId, driverEmail]);

  useEffect(() => { load(); }, [load]);

  const requirementFor = (type) => requirements.find((item) => item.type === type) || requirements[1];
  const chooseFile = (event, bookingId) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const draft = { id: `${Date.now()}-${Math.random()}`, file, type: photoType, preview: URL.createObjectURL(file) };
    const previous = pendingByBooking[bookingId];
    if (previous?.preview) URL.revokeObjectURL(previous.preview);
    setPendingByBooking((current) => ({ ...current, [bookingId]: draft }));
    setActiveId(bookingId);
    setMessage("");
  };
  const updatePendingType = (bookingId, type) => setPendingByBooking((current) => current[bookingId] ? ({ ...current, [bookingId]: { ...current[bookingId], type } }) : current);
  const storePhoto = (bookingId) => {
    const pending = pendingByBooking[bookingId];
    if (!pending) { setMessage("Choose an image first, then store it in the photo hub."); return; }
    setDraftsByBooking((current) => ({ ...current, [bookingId]: [...(current[bookingId] || []), pending] }));
    setPendingByBooking((current) => ({ ...current, [bookingId]: null }));
    setMessage("Photo stored in the hub. Add more photos or transfer the complete set.");
  };
  const removePending = (bookingId) => setPendingByBooking((current) => {
    const pending = current[bookingId];
    if (pending?.preview) URL.revokeObjectURL(pending.preview);
    return { ...current, [bookingId]: null };
  });
  const updateDraftType = (bookingId, draftId, type) => setDraftsByBooking((current) => ({ ...current, [bookingId]: (current[bookingId] || []).map((draft) => draft.id === draftId ? { ...draft, type } : draft) }));
  const removeDraft = (bookingId, draftId) => setDraftsByBooking((current) => {
    const draft = (current[bookingId] || []).find((item) => item.id === draftId);
    if (draft?.preview) URL.revokeObjectURL(draft.preview);
    return { ...current, [bookingId]: (current[bookingId] || []).filter((item) => item.id !== draftId) };
  });

  const upload = async () => {
    const drafts = activeId ? (draftsByBooking[activeId] || []) : [];
    if (!activeId || !drafts.length) {
      setMessage("Select and prepare at least one image first.");
      return;
    }
    setSending(true);
    setMessage("");
    try {
      const payload = new FormData();
      drafts.forEach((draft) => {
        payload.append("photos", draft.file);
        payload.append("photo_types", draft.type);
        payload.append("instructions", requirementFor(draft.type).hint);
      });
      payload.append("photo_type", drafts[0].type);
      payload.append("role", "driver");
      payload.append("ambulance_id", String(ambulanceId));
      payload.append("driver_email", driverEmail);
      payload.append("driver_name", driverName);
      const response = await fetch(`${BASE}/api/bookings/${activeId}/photos/`, { method: "POST", body: payload });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Photo upload failed");
      drafts.forEach((draft) => draft.preview && URL.revokeObjectURL(draft.preview));
      setDraftsByBooking((current) => ({ ...current, [activeId]: [] }));
      setMessage(`${data.photos?.length || drafts.length} photo(s) transferred to the hospital and assigned staff.`);
      await load();
    } catch (err) {
      setMessage(err.message || "Photo upload failed");
    } finally {
      setSending(false);
    }
  };

  return <main className="driver-photo-root"><style>{`
    .driver-photo-root{min-height:100vh;background:#f7fafc;color:#1f2937;padding:96px clamp(16px,4vw,56px) 80px;margin-left:80px;width:calc(100% - 80px);font-family:Inter,ui-sans-serif,system-ui,sans-serif;box-sizing:border-box;overflow-x:hidden}.driver-photo-shell{max-width:1400px;margin:0 auto}.driver-photo-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap}.driver-photo-kicker{color:#067647;font-size:12px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.driver-photo-title{font-size:clamp(32px,4vw,50px);letter-spacing:-.05em;line-height:1;margin:9px 0 7px;color:#162033}.driver-photo-sub{margin:0;color:#61708a;font-size:14px}.driver-photo-refresh{border:1px solid #bfd0df;background:#fff;border-radius:9px;padding:11px 15px;font-weight:800;color:#14633e;cursor:pointer}.driver-photo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:28px}.driver-booking{background:#fff;border:1px solid #d7e1e9;border-radius:14px;padding:16px;box-shadow:0 4px 16px rgba(27,52,72,.04);min-width:0}.driver-booking.red{border-color:#ff8d8d}.driver-booking.yellow{border-color:#ecc65a}.driver-booking.green{border-color:#b8dcca}.driver-booking-bar{height:5px;border-radius:9px;background:#1c8b4a;margin:-2px 0 15px}.driver-booking.red .driver-booking-bar{background:#e11d2e}.driver-booking.yellow .driver-booking-bar{background:#eab308}.driver-booking-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.driver-booking-id{font-size:11px;font-weight:900;color:#65748a}.driver-status{padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase}.driver-status.red{background:#ffe1e4;color:#b4232f}.driver-status.yellow{background:#fff2c5;color:#946200}.driver-status.green{background:#def7e7;color:#08763d}.driver-patient{font-size:19px;font-weight:900;margin:13px 0 4px;color:#1b283b;overflow-wrap:anywhere}.driver-meta{font-size:12px;color:#687990;line-height:1.6}.driver-destination{font-size:13px;font-weight:800;color:#08763d;margin-top:10px;overflow-wrap:anywhere}.driver-existing{display:flex;justify-content:center;align-items:flex-start;gap:10px;flex-wrap:wrap;max-width:680px;min-height:82px;margin:14px auto 10px;padding:10px;border:1px solid #d8e5ec;border-radius:10px;background:#f8fbfd;box-sizing:border-box}.driver-thumb{width:74px;height:64px;object-fit:cover;border-radius:7px;border:1px solid #d5e0e7}.driver-thumb-count{display:grid;place-items:center;width:74px;height:64px;border:1px dashed #9db4c2;border-radius:7px;color:#587087;font-size:11px}.driver-upload{border:1px dashed #a9baca;background:#f7fafc;border-radius:10px;padding:14px;text-align:center;cursor:pointer;display:block;width:100%;box-sizing:border-box}.driver-upload svg{color:#2675a8}.driver-upload-title{font-size:12px;font-weight:800;margin-top:5px}.driver-upload-sub{font-size:11px;color:#708198;margin-top:3px}.driver-controls{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;margin-top:11px}.driver-select{border:1px solid #cad7e2;border-radius:8px;padding:10px;background:#fff;color:#243348;min-width:0}.driver-store,.driver-send{border:0;border-radius:8px;background:#08763d;color:#fff;font-weight:900;padding:0 15px;cursor:pointer;white-space:nowrap}.driver-store{background:#dff4e7;color:#08763d;border:1px solid #9fcfb0}.driver-send:disabled,.driver-store:disabled{opacity:.55;cursor:not-allowed}.driver-hint{font-size:11px;color:#6b7a8f;margin-top:8px;line-height:1.45}.driver-alert{margin-top:18px;border:1px solid #b9ddc7;background:#effbf3;border-radius:10px;padding:11px;color:#136c3e;font-size:13px;font-weight:700}.driver-error{margin-top:18px;border:1px solid #efb2b7;background:#fff3f4;border-radius:10px;padding:14px;color:#ae202b}.driver-empty{grid-column:1/-1;border:1px dashed #bccbd6;border-radius:12px;background:#fff;padding:40px;text-align:center;color:#687990}.driver-hub{margin-top:12px;border:1px solid #c7d8e3;border-radius:10px;background:#f9fcfe;padding:10px}.driver-hub-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:12px;color:#486276}.driver-hub-list{display:grid;gap:8px;margin-top:8px}.driver-hub-item,.driver-pending{display:grid;grid-template-columns:48px minmax(0,1fr) 28px;gap:8px;align-items:center;background:#fff;border:1px solid #dce6ed;border-radius:8px;padding:6px}.driver-pending{margin-top:10px;border-color:#efc46e;background:#fffaf0}.driver-hub-preview{width:48px;height:42px;object-fit:cover;border-radius:5px}.driver-hub-item .driver-select,.driver-pending .driver-select{padding:7px;font-size:11px}.driver-remove{border:0;background:#fff0f1;color:#b4232f;border-radius:6px;padding:7px;cursor:pointer}.driver-photo-label{font-size:10px;color:#607289;margin-top:3px;max-width:74px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:650px){.driver-photo-root{padding:92px 13px 82px;margin-left:0;width:100%}.driver-photo-head{display:block}.driver-photo-refresh{margin-top:16px}.driver-controls{grid-template-columns:1fr}.driver-store,.driver-send{min-height:42px}}
  `}</style><div className="driver-photo-shell"><header className="driver-photo-head"><div><div className="driver-photo-kicker">Ambulance operations · condition reports</div><h1 className="driver-photo-title">Active bookings</h1><p className="driver-photo-sub">Select one image at a time, label it, store it in the photo hub, then transfer the complete set together.</p></div><button className="driver-photo-refresh" onClick={load} disabled={loading}><RefreshCw size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />Refresh</button></header>
    {error && <div className="driver-error">{error}</div>}{message && <div className="driver-alert"><CheckCircle2 size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />{message}</div>}
    {loading && !bookings.length ? <div className="driver-empty" style={{ marginTop: 28 }}>Loading assigned bookings…</div> : <section className="driver-photo-grid">{!bookings.length && <div className="driver-empty">No active bookings are assigned to this ambulance.</div>}{bookings.map((booking) => { const currentTone = tone(booking); const selected = activeId === booking.id; const photos = Array.isArray(booking.condition_photos) ? booking.condition_photos : []; const bookingDrafts = draftsByBooking[booking.id] || []; const pendingPhoto = pendingByBooking[booking.id]; return <article className={`driver-booking ${currentTone}`} key={booking.id}><div className="driver-booking-bar" /><div className="driver-booking-top"><span className="driver-booking-id">#AMB-{booking.ambulance_number || booking.ambulance_id} · Booking #{booking.id}</span><span className={`driver-status ${currentTone}`}>{currentTone}</span></div><div className="driver-patient">{booking.patient_name || booking.booked_by || "Patient"}</div><div className="driver-meta">Age: {booking.patient_age || "—"} · {booking.patient_gender || "—"}<br />{booking.patient_condition || booking.vitals_summary || "Condition details pending"}</div><div className="driver-destination">● {booking.assigned_hospital_name || booking.destination || "Hospital pending"}</div><div className="driver-existing">{photos.slice(0, 5).map((photo) => <div key={photo.id}><img className="driver-thumb" src={photo.url} alt={photo.label} /><div className="driver-photo-label">{photo.label}</div></div>)}{photos.length > 5 && <div className="driver-thumb-count">+{photos.length - 5}</div>}</div><label className="driver-upload"><Camera size={22} /><div className="driver-upload-title">Add one condition photo</div><div className="driver-upload-sub">Camera opens on supported mobile devices</div><input type="file" accept="image/*" capture="environment" hidden onChange={(event) => chooseFile(event, booking.id)} onClick={() => setActiveId(booking.id)} /></label>{selected ? <>{pendingPhoto && <div className="driver-pending"><img className="driver-hub-preview" src={pendingPhoto.preview} alt={pendingPhoto.file.name} /><select className="driver-select" value={pendingPhoto.type} onChange={(event) => updatePendingType(booking.id, event.target.value)}>{requirements.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select><button className="driver-remove" type="button" aria-label="Remove pending photo" onClick={() => removePending(booking.id)}><Trash2 size={15} /></button></div>}{bookingDrafts.length > 0 && <div className="driver-hub"><div className="driver-hub-head"><b>Photo hub</b><span>{bookingDrafts.length} stored</span></div><div className="driver-hub-list">{bookingDrafts.map((draft) => <div className="driver-hub-item" key={draft.id}><img className="driver-hub-preview" src={draft.preview} alt={draft.file.name} /><select className="driver-select" value={draft.type} onChange={(event) => updateDraftType(booking.id, draft.id, event.target.value)}>{requirements.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select><button className="driver-remove" type="button" aria-label="Remove photo" onClick={() => removeDraft(booking.id, draft.id)}><Trash2 size={15} /></button></div>)}</div></div>}<div className="driver-controls"><select className="driver-select" value={photoType} onChange={(event) => setPhotoType(event.target.value)}>{requirements.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select><button className="driver-store" onClick={() => storePhoto(booking.id)} disabled={!pendingPhoto}><ImagePlus size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Store in hub</button><button className="driver-send" onClick={upload} disabled={sending || !bookingDrafts.length}><Send size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />{sending ? "Transferring…" : `Transfer all${bookingDrafts.length ? ` (${bookingDrafts.length})` : ""}`}</button></div><div className="driver-hint">Choose a photo, select its type, click “Store in hub”, then transfer all stored images together.</div></> : <button className="driver-upload" style={{ marginTop: 9 }} onClick={() => setActiveId(booking.id)}><ImagePlus size={16} style={{ verticalAlign: "-3px", marginRight: 5 }} />Open photo hub</button>}</article>; })}</section>}</div></main>;
}
