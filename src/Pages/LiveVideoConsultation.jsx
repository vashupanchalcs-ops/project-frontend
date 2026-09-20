import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, Clock3, Image as ImageIcon, Maximize2, Mic, MicOff, PhoneCall, PhoneOff, RefreshCw, Send, Video, VideoOff, X } from "lucide-react";

const defaultApiBase = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const getTone = (booking) => {
  const value = `${booking?.patient_condition || ""} ${booking?.vitals_summary || ""}`.toLowerCase();
  if (["critical", "cardiac", "stroke", "trauma", "icu", "emergency"].some((token) => value.includes(token))) return "red";
  if (["monitor", "observation", "serious", "awaiting", "pending"].some((token) => value.includes(token))) return "yellow";
  return "green";
};

const bookingName = (booking) => booking?.patient_name || booking?.booked_by || "Patient";

export default function LiveVideoConsultation() {
  const role = localStorage.getItem("role") || "staff";
  const isDriver = role === "driver";
  const staffId = localStorage.getItem("staff_id") || "";
  const email = localStorage.getItem("user") || localStorage.getItem("driver_email") || "";
  const ambulanceId = Number(localStorage.getItem("ambulance_id") || 0);
  const queryBookingId = new URLSearchParams(window.location.search).get("booking");
  const videoRef = useRef(null);
  const signalSocketRef = useRef(null);
  const peerRef = useRef(null);
  const [bookings, setBookings] = useState([]);
  const [selectedId, setSelectedId] = useState(queryBookingId || null);
  const [photos, setPhotos] = useState([]);
  const [stream, setStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connected, setConnected] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [preview, setPreview] = useState(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isDriver
        ? `${BASE}/api/bookings/driver-assigned/?ambulance_id=${encodeURIComponent(ambulanceId)}&driver_email=${encodeURIComponent(email)}`
        : `${BASE}/api/staff/dashboard/?staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`;
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load assigned consultations");
      const rows = isDriver ? (Array.isArray(data) ? data : []) : (Array.isArray(data.cases) ? data.cases : []);
      setBookings(rows);
      setSelectedId((current) => (rows.some((row) => String(row.id) === String(current)) ? current : (rows[0]?.id || null)));
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load assigned consultations");
    } finally {
      setLoading(false);
    }
  }, [ambulanceId, email, isDriver, staffId]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const selectedBooking = useMemo(() => bookings.find((booking) => String(booking.id) === String(selectedId)) || bookings[0] || null, [bookings, selectedId]);

  const loadPhotos = useCallback(async () => {
    if (!selectedBooking?.id) { setPhotos([]); return; }
    setPhotosLoading(true);
    try {
      const access = isDriver
        ? `role=driver&ambulance_id=${encodeURIComponent(ambulanceId)}&driver_email=${encodeURIComponent(email)}`
        : `role=staff&staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`;
      const response = await fetch(`${BASE}/api/bookings/${selectedBooking.id}/photos/?${access}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      setPhotos(response.ok && Array.isArray(data.photos) ? data.photos : []);
    } catch {
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  }, [ambulanceId, email, isDriver, selectedBooking, staffId]);

  useEffect(() => {
    loadPhotos();
    const refresh = setInterval(loadPhotos, 8000);
    return () => clearInterval(refresh);
  }, [loadPhotos]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = remoteStream || stream || null;
  }, [remoteStream, stream]);

  useEffect(() => {
    if (!connected) { setElapsed(0); return undefined; }
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [connected]);

  useEffect(() => () => {
    stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  useEffect(() => () => {
    signalSocketRef.current?.close();
    peerRef.current?.close();
  }, []);

  useEffect(() => {
    if (!selectedBooking?.id) { setSavedNote(""); return; }
    setSavedNote(localStorage.getItem(`consultation_note_${selectedBooking.id}`) || "");
    setNote("");
  }, [selectedBooking]);

  const sendSignal = (payload) => {
    if (signalSocketRef.current?.readyState === WebSocket.OPEN) signalSocketRef.current.send(JSON.stringify(payload));
  };

  const createPeer = useCallback(async (localStream, makeOffer) => {
    if (peerRef.current) return peerRef.current;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    peer.onicecandidate = (event) => { if (event.candidate) sendSignal({ type: "ice-candidate", candidate: event.candidate }); };
    peer.ontrack = (event) => { if (event.streams?.[0]) setRemoteStream(event.streams[0]); };
    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) setRemoteStream(null);
    };
    peerRef.current = peer;
    if (makeOffer) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal({ type: "offer", offer });
    }
    return peer;
  }, []);

  const connectSignal = useCallback((localStream) => {
    if (!selectedBooking?.id || signalSocketRef.current) return;
    const socketBase = BASE.replace(/^http/, "ws");
    const query = isDriver
      ? `role=driver&ambulance_id=${encodeURIComponent(ambulanceId)}&email=${encodeURIComponent(email)}`
      : `role=staff&staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`;
    const socket = new WebSocket(`${socketBase}/ws/consultation/${selectedBooking.id}/?${query}`);
    signalSocketRef.current = socket;
    socket.onopen = () => sendSignal({ type: "join" });
    socket.onmessage = async (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      try {
        if (payload.type === "peer-joined" && isDriver && !peerRef.current) await createPeer(localStream, true);
        if (payload.type === "offer") {
          const peer = await createPeer(localStream, false);
          await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal({ type: "answer", answer });
        }
        if (payload.type === "answer" && peerRef.current) await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        if (payload.type === "ice-candidate" && peerRef.current && payload.candidate) await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        if (payload.type === "peer-left") setRemoteStream(null);
      } catch (err) {
        setError(err.message || "Unable to connect the consultation video.");
      }
    };
    socket.onerror = () => setError("Video signaling is unavailable. Check the backend WebSocket service.");
    socket.onclose = () => { signalSocketRef.current = null; };
  }, [ambulanceId, createPeer, email, isDriver, selectedBooking, staffId]);

  const startCall = async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera and microphone are not available in this browser.");
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(nextStream);
      setCameraOn(true);
      setMicOn(true);
      setConnected(true);
      connectSignal(nextStream);
    } catch (err) {
      setError(err.message || "Allow camera and microphone access to start the consultation.");
    }
  };

  const endCall = () => {
    sendSignal({ type: "leave" });
    signalSocketRef.current?.close();
    signalSocketRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setRemoteStream(null);
    setConnected(false);
  };

  const toggleMic = () => {
    const next = !micOn;
    stream?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicOn(next);
  };

  const toggleCamera = () => {
    const next = !cameraOn;
    stream?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraOn(next);
  };

  const saveNote = () => {
    if (!selectedBooking?.id || !note.trim()) return;
    localStorage.setItem(`consultation_note_${selectedBooking.id}`, note.trim());
    setSavedNote(note.trim());
    setNote("");
  };

  const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return <main className="live-consult-root"><style>{`
    .live-consult-root{min-height:100vh;background:#f4f7fa;color:#172235;padding:96px 16px 80px;margin-left:80px;width:calc(100% - 80px);box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow-x:hidden}.live-consult-shell{max-width:1500px;margin:0 auto}.live-consult-titlebar{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}.live-consult-title{font-size:clamp(28px,3vw,40px);line-height:1;letter-spacing:-.04em;margin:0;color:#1d293b}.live-consult-sub{margin:8px 0 0;color:#62738a;font-size:13px}.live-consult-actions{display:flex;gap:8px;flex-wrap:wrap}.live-consult-btn{border:1px solid #bfd0dc;background:#fff;border-radius:8px;padding:10px 13px;font-weight:800;color:#0e6a3d;cursor:pointer}.live-consult-btn:disabled{opacity:.5;cursor:not-allowed}.live-consult-layout{display:grid;grid-template-columns:230px minmax(0,1fr) 285px;gap:12px;align-items:stretch}.live-consult-panel{background:#fff;border:1px solid #dce5eb;border-radius:10px;padding:12px;min-width:0}.live-consult-panel-title{font-size:12px;font-weight:900;color:#26354b;margin-bottom:10px}.live-consult-badge{font-size:9px;background:#def7e8;color:#0b7440;border-radius:999px;padding:4px 7px;font-weight:900;white-space:nowrap}.live-consult-bookings{display:grid;gap:8px}.live-consult-booking{border:1px solid #dae4eb;background:#fbfdff;border-radius:8px;padding:10px;text-align:left;cursor:pointer;color:#172235}.live-consult-booking.active{border-color:#087640;box-shadow:0 0 0 2px rgba(8,118,64,.1)}.live-consult-booking-name{font-weight:900;font-size:12px;overflow-wrap:anywhere}.live-consult-booking-meta{font-size:10px;color:#6d7b8e;margin-top:4px;line-height:1.45}.live-consult-booking-open{margin-top:8px;width:100%;border:0;border-radius:6px;background:#087640;color:#fff;padding:7px;font-size:10px;font-weight:900;cursor:pointer}.live-consult-recent{border-top:1px solid #e6edf1;margin-top:14px;padding-top:12px}.live-consult-recent-item{font-size:10px;color:#6d7b8e;padding:7px 0;border-bottom:1px solid #edf1f3}.live-consult-center{min-width:0}.live-consult-center-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.live-consult-center-title{font-size:13px;font-weight:900}.live-consult-timer{color:#df252f;font-size:12px;font-weight:900}.live-consult-stage{position:relative;height:410px;min-height:410px;max-height:410px;background:#0f172a;border-radius:11px;overflow:hidden;display:grid;place-items:center}.live-consult-stage video{width:100%;height:100%;min-height:0;object-fit:cover;display:block}.live-consult-stage-placeholder{text-align:center;color:#eef4ff;padding:24px}.live-consult-avatar{width:80px;height:80px;border-radius:50%;display:grid;place-items:center;margin:0 auto 13px;background:#1f8b59;border:2px solid #4fc985;color:#fff;font-weight:900;font-size:28px}.live-consult-stage-placeholder h2{margin:0;font-size:18px}.live-consult-stage-placeholder p{margin:5px 0 0;color:#a9b9ce;font-size:11px}.live-consult-local{position:absolute;right:12px;bottom:12px;width:170px;height:108px;border:2px solid #fff;border-radius:8px;overflow:hidden;background:#25334b}.live-consult-local video{min-height:0;width:100%;height:100%;object-fit:cover}.live-consult-stage-tag{position:absolute;left:12px;top:12px;display:flex;gap:8px;flex-wrap:wrap;background:rgba(18,29,48,.82);border-radius:8px;padding:8px 10px;color:#fff;font-size:10px;font-weight:800}.live-consult-vitals{display:flex;gap:0;flex-wrap:wrap;background:#fff;border:1px solid #dce5eb;border-radius:9px;margin-top:10px;padding:10px}.live-consult-vital{min-width:125px;padding:3px 14px;border-right:1px solid #e1e9ef}.live-consult-vital:last-child{border-right:0}.live-consult-vital-label{display:block;color:#8190a3;font-size:9px}.live-consult-vital-value{font-weight:900;font-size:15px;color:#ed2a3a}.live-consult-vital:nth-child(2) .live-consult-vital-value{color:#0795db}.live-consult-vital:nth-child(3) .live-consult-vital-value{color:#dc9900}.live-consult-controls{display:flex;justify-content:center;gap:10px;margin:12px 0}.live-consult-control{width:40px;height:40px;border:0;border-radius:50%;background:#e3f4fb;color:#078dce;display:grid;place-items:center;cursor:pointer}.live-consult-control.end{background:#fa4047;color:#fff}.live-consult-control.start{background:#087640;color:#fff;width:auto;border-radius:8px;padding:0 16px;font-weight:900}.live-consult-right{display:flex;flex-direction:column;gap:12px}.live-consult-image-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.live-consult-image{border:1px solid #dce5eb;border-radius:6px;background:#fff;padding:4px;cursor:pointer;min-width:0}.live-consult-image img{display:block;width:100%;height:62px;object-fit:cover;border-radius:4px}.live-consult-image span{display:block;font-size:9px;color:#607087;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 1px 1px}.live-consult-empty{font-size:11px;color:#7b899a;border:1px dashed #c9d5df;border-radius:7px;padding:18px 9px;text-align:center}.live-consult-notes{flex:1}.live-consult-notes textarea{width:100%;min-height:150px;resize:vertical;box-sizing:border-box;border:1px solid #d4dfe7;border-radius:7px;padding:10px;font:inherit;font-size:11px;color:#26364b}.live-consult-note-saved{font-size:11px;line-height:1.5;color:#40556a;background:#f4f8fb;border-radius:7px;padding:10px;margin-bottom:8px}.live-consult-note-button{width:100%;border:0;border-radius:7px;background:#087640;color:#fff;padding:10px;font-weight:900;cursor:pointer;margin-top:7px}.live-consult-alert{margin:0 0 13px;border:1px solid #efb5ba;background:#fff4f4;color:#a11f2a;padding:11px;border-radius:8px;font-size:12px;font-weight:700}.live-consult-preview{position:fixed;inset:0;background:rgba(9,20,13,.78);z-index:10005;display:grid;place-items:center;padding:20px}.live-consult-preview-card{max-width:860px;width:100%;max-height:calc(100vh - 40px);background:#fff;border-radius:12px;padding:12px;position:relative}.live-consult-preview-card img{display:block;width:100%;max-height:78vh;object-fit:contain;background:#f4f7fa}.live-consult-preview-close{position:absolute;right:10px;top:10px;width:32px;height:32px;border:0;border-radius:50%;background:#fff;cursor:pointer}@media(max-width:1050px){.live-consult-layout{grid-template-columns:210px minmax(0,1fr)}.live-consult-right{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}.live-consult-notes{min-height:220px}}@media(max-width:720px){.live-consult-root{padding:92px 11px 82px;margin-left:0;width:100%}.live-consult-layout{display:flex;flex-direction:column}.live-consult-center{order:1}.live-consult-panel:first-child{order:2}.live-consult-right{order:3;display:flex}.live-consult-stage{height:280px;min-height:280px;max-height:280px}.live-consult-stage video{min-height:0}.live-consult-local{width:112px;height:76px}.live-consult-vital{min-width:105px;padding:3px 8px}.live-consult-vitals{gap:6px}.live-consult-vital{border-right:0}.live-consult-controls{margin-bottom:4px}.live-consult-titlebar{margin-bottom:12px}}
  `}</style><div className="live-consult-shell">
    <header className="live-consult-titlebar"><div><h1 className="live-consult-title">Live consultation</h1><p className="live-consult-sub">{isDriver ? "Connect your assigned ambulance case with the authorized medical team." : "Join the active ambulance case allocated to your care team."}</p></div><div className="live-consult-actions"><button className="live-consult-btn" onClick={loadBookings} disabled={loading}><RefreshCw size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Refresh</button></div></header>
    {error && <div className="live-consult-alert">{error}</div>}
    <div className="live-consult-layout">
      <aside className="live-consult-panel"><div className="live-consult-panel-title">{isDriver ? "Assigned consultations" : "Pending consultations"}</div><div className="live-consult-bookings">{loading && !bookings.length ? <div className="live-consult-empty">Loading cases…</div> : !bookings.length ? <div className="live-consult-empty">No assigned booking is available.</div> : bookings.slice(0, 8).map((booking) => <button key={booking.id} className={`live-consult-booking ${String(selectedBooking?.id) === String(booking.id) ? "active" : ""}`} onClick={() => setSelectedId(booking.id)}><div className="live-consult-booking-name">{bookingName(booking)}</div><div className="live-consult-booking-meta">Booking #{booking.id}<br />{booking.assigned_hospital_name || booking.destination || "Hospital pending"}</div><span className="live-consult-badge">{getTone(booking)}</span><span className="live-consult-booking-open">{connected && String(selectedBooking?.id) === String(booking.id) ? "Connected" : isDriver ? "Open call" : "Accept call"}</span></button>)}</div><div className="live-consult-recent"><div className="live-consult-panel-title">Case access</div><div className="live-consult-recent-item"><CheckCircle2 size={12} style={{ verticalAlign: "-2px", marginRight: 4, color: "#087640" }} />Only assigned team members can view this case.</div><div className="live-consult-recent-item"><Clock3 size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Photos refresh automatically after upload.</div></div></aside>
      <section className="live-consult-center"><div className="live-consult-center-head"><span className="live-consult-center-title">Active consultation hub</span><span className={connected ? "live-consult-badge" : "live-consult-timer"}>{connected ? `Connected · ${formatTime(elapsed)}` : "Ready to connect"}</span></div><div className="live-consult-stage">{connected && (remoteStream || cameraOn) ? <video ref={videoRef} autoPlay muted={!remoteStream} playsInline /> : <div className="live-consult-stage-placeholder"><div className="live-consult-avatar">{selectedBooking ? bookingName(selectedBooking).slice(0, 1).toUpperCase() : "A"}</div><h2>{selectedBooking ? bookingName(selectedBooking) : "Select an assigned case"}</h2><p>{connected ? "Camera is off. Turn it on from the controls." : "Start a secure consultation preview for this booking."}</p></div>}{connected && <div className="live-consult-stage-tag"><span>● {remoteStream ? "Medical team connected" : "Waiting for medical team"}</span><span>Booking #{selectedBooking?.id || "—"}</span></div>}{connected && stream && <div className="live-consult-local"><video ref={(element) => { if (element) element.srcObject = stream; }} autoPlay muted playsInline /></div>}</div><div className="live-consult-vitals"><div className="live-consult-vital"><span className="live-consult-vital-label">Patient</span><span className="live-consult-vital-value" style={{ color: "#172235" }}>{bookingName(selectedBooking)}</span></div><div className="live-consult-vital"><span className="live-consult-vital-label">Condition</span><span className="live-consult-vital-value" style={{ color: "#172235" }}>{selectedBooking?.patient_condition || selectedBooking?.vitals_summary || "Pending"}</span></div><div className="live-consult-vital"><span className="live-consult-vital-label">SpO₂</span><span className="live-consult-vital-value">{selectedBooking?.spo2 || "—"}</span></div><div className="live-consult-vital"><span className="live-consult-vital-label">Blood pressure</span><span className="live-consult-vital-value">{selectedBooking?.blood_pressure || "—"}</span></div></div><div className="live-consult-controls">{!connected ? <button className="live-consult-control start" onClick={startCall} disabled={!selectedBooking}><PhoneCall size={15} style={{ marginRight: 6 }} />{isDriver ? "Call medical team" : "Accept call"}</button> : <><button className="live-consult-control" onClick={toggleMic} title={micOn ? "Mute microphone" : "Unmute microphone"}>{micOn ? <Mic size={17} /> : <MicOff size={17} />}</button><button className="live-consult-control" onClick={toggleCamera} title={cameraOn ? "Turn camera off" : "Turn camera on"}>{cameraOn ? <Video size={17} /> : <VideoOff size={17} />}</button><button className="live-consult-control" onClick={() => videoRef.current?.requestPictureInPicture?.()} title="Picture in picture"><Maximize2 size={17} /></button><button className="live-consult-control end" onClick={endCall} title="End consultation"><PhoneOff size={17} /></button></>}</div></section>
      <aside className="live-consult-right"><section className="live-consult-panel"><div className="live-consult-panel-title">Shared images <span style={{ float: "right", color: "#7b899a", fontWeight: 500 }}>{photosLoading ? "Loading…" : `${photos.length} files`}</span></div>{photos.length ? <div className="live-consult-image-list">{photos.map((photo) => <button className="live-consult-image" key={photo.id} onClick={() => setPreview(photo)}><img src={photo.url} alt={photo.label || "Shared patient condition"} /><span>{photo.label || "Condition photo"}</span></button>)}</div> : <div className="live-consult-empty"><ImageIcon size={18} style={{ display: "block", margin: "0 auto 6px" }} />No photos sent for this booking yet.</div>}</section><section className="live-consult-panel live-consult-notes"><div className="live-consult-panel-title">{isDriver ? "Paramedic notes" : "Doctor observations & prescriptions"}</div>{savedNote && <div className="live-consult-note-saved"><b>Saved note</b><br />{savedNote}</div>}<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={isDriver ? "Add a condition update for the care team…" : "Type immediate directives or medical observations…"} /><button className="live-consult-note-button" onClick={saveNote} disabled={!note.trim()}><Send size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />Save note</button></section></aside>
    </div>
  </div>{preview && <div className="live-consult-preview" onClick={(event) => { if (event.target === event.currentTarget) setPreview(null); }}><div className="live-consult-preview-card"><button className="live-consult-preview-close" onClick={() => setPreview(null)}><X size={16} /></button><img src={preview.url} alt={preview.label || "Shared patient condition"} /></div></div>}
  </main>;
}
