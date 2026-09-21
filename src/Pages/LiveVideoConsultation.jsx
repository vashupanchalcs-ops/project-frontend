import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Send,
  Share2,
  Shield,
  Sparkles,
  Stethoscope,
  User,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { fetchFreshJson, readDataCache, writeDataCache } from "../utils/dataCache";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const bookingName = (booking) => booking?.patient_name || booking?.booked_by || "Emergency Patient";
const initials = (value) => String(value || "Team")
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join("") || "T";

export default function LiveVideoConsultation() {
  // Read logged-in user strictly
  const role = (localStorage.getItem("role") || "staff").toLowerCase();
  const isDriver = role === "driver";
  const loggedInStaffName = localStorage.getItem("name") || "staff no 1";
  const loggedInStaffRole = (localStorage.getItem("staff_role") || "Doctor").toUpperCase();
  const hospitalName = localStorage.getItem("hospital_name") || "SAHARDA HOSPITAL";
  const staffId = localStorage.getItem("staff_id") || "";
  const email = localStorage.getItem("user") || localStorage.getItem("driver_email") || "";
  const ambulanceId = Number(localStorage.getItem("ambulance_id") || 0);
  const queryBookingId = new URLSearchParams(window.location.search).get("booking");

  const bookingCacheKey = `consult_bookings_${isDriver ? `driver_${ambulanceId}_${email}` : `staff_${staffId}_${email}`}`;
  const cachedBookings = readDataCache(bookingCacheKey, []);

  // WebRTC & Stream refs
  const localVideoRef = useRef(null);
  const chatBottomRef = useRef(null);
  const signalSocketRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const clientIdRef = useRef(globalThis.crypto?.randomUUID?.() || `consult-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  // States
  const [bookings, setBookings] = useState(() => (Array.isArray(cachedBookings) ? cachedBookings : []));
  const [selectedId, setSelectedId] = useState(queryBookingId || null);
  const [stream, setStream] = useState(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [elapsed, setElapsed] = useState(245); // 04:05
  const [loading, setLoading] = useState(!cachedBookings.length);
  const [toast, setToast] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState("remote"); // "local" or "remote"
  const [callRequests, setCallRequests] = useState([]);
  const [remoteParticipants, setRemoteParticipants] = useState({});
  const [callJoined, setCallJoined] = useState(isDriver);

  // ── DRIVER MULTI-PERSON CALL STATE ──
  const [activeTab, setActiveTab] = useState("roster"); // "roster" | "chat" | "directives"
  const [connectedStaff, setConnectedStaff] = useState([]); // staff IDs currently on video call

  const selectedBooking = useMemo(
    () => bookings.find((b) => String(b.id) === String(selectedId)) || bookings[0] || null,
    [bookings, selectedId]
  );

  // Only show the team saved on this booking. The driver occupies one tile,
  // so a call can contain at most three allocated staff members (four people total).
  const allocatedStaff = useMemo(() => {
    const candidate = selectedBooking?.assigned_team
      || selectedBooking?.allocated_staff
      || selectedBooking?.assigned_staff;
    let raw = Array.isArray(candidate) ? candidate : [];
    if (!raw.length && selectedBooking?.assigned_doctors_json) {
      try {
        const parsed = JSON.parse(selectedBooking.assigned_doctors_json);
        raw = Array.isArray(parsed) ? parsed : [];
      } catch {
        raw = [];
      }
    }
    return raw.slice(0, 3).map((person, index) => ({
      id: String(person.id ?? person.staff_id ?? `allocated-${index}`),
      contractId: person.staff_id || person.staff_contract_id || "",
      name: person.full_name || person.name || "Allocated staff",
      role: person.role || "Care team",
      specialty: person.specialization || person.specialty || "Assigned to this case",
      avatar: person.avatar || person.profile_image || "",
    }));
  }, [selectedBooking]);

  // Never carry a previous booking's participants into the next case.
  useEffect(() => {
    setConnectedStaff([]);
    setCallJoined(isDriver);
  }, [selectedBooking?.id]);


  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: localStorage.getItem("name") || "Driver",
      role: "DRIVER",
      text: "Doctor, patient is en-route. Oxygen saturation at 97%, blood pressure 120/80 mmHg.",
      time: "02:40 am",
      isStaffSender: false,
    },
    {
      id: 2,
      sender: loggedInStaffName,
      role: loggedInStaffRole,
      text: "Understood. Please keep bilateral airway open and initiate continuous 12-lead ECG telemetry.",
      time: "02:41 am",
      isStaffSender: true,
    },
    {
      id: 3,
      sender: localStorage.getItem("name") || "Driver",
      role: "DRIVER",
      text: "ECG rhythm strip transmitted. 18G IV line secured in left forearm.",
      time: "02:42 am",
      isStaffSender: false,
    },
    {
      id: 4,
      sender: loggedInStaffName,
      role: loggedInStaffRole,
      text: "Received telemetry. ICU Bed #04 cleared and emergency trauma team is standing by.",
      time: "02:43 am",
      isStaffSender: true,
    },
  ]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const requestForStaff = useCallback((staff) => (
    callRequests.find((item) => String(item.staff_profile_id) === String(staff.id)) || null
  ), [callRequests]);

  const loadCallRequests = useCallback(async () => {
    if (!selectedBooking?.id) {
      setCallRequests([]);
      return;
    }
    const params = isDriver
      ? `role=driver&booking_id=${encodeURIComponent(selectedBooking.id)}&ambulance_id=${encodeURIComponent(ambulanceId)}&driver_email=${encodeURIComponent(email)}`
      : `role=staff&booking_id=${encodeURIComponent(selectedBooking.id)}&staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`;
    try {
      const response = await fetch(`${BASE}/api/bookings/video-call/requests/?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load video call requests");
      const rows = Array.isArray(data.requests) ? data.requests : [];
      setCallRequests(rows);
      if (!isDriver && rows.some((item) => item.status === "accepted")) setCallJoined(true);
    } catch {
      // A temporary notification/API failure should not hide already rendered call members.
    }
  }, [ambulanceId, email, isDriver, selectedBooking?.id, staffId]);

  useEffect(() => {
    loadCallRequests();
    const timer = setInterval(loadCallRequests, 3500);
    return () => clearInterval(timer);
  }, [loadCallRequests]);

  useEffect(() => {
    setConnectedStaff(callRequests
      .filter((item) => item.status === "accepted")
      .map((item) => String(item.staff_profile_id)));
  }, [callRequests]);

  const sendVideoRequest = async (staff) => {
    if (!selectedBooking?.id) return;
    const current = requestForStaff(staff);
    if (current?.status === "accepted") {
      showToast(`${staff.name} is already in this group call`);
      return;
    }
    if (callRequests.filter((item) => item.status === "accepted").length >= 3) {
      showToast("Maximum members added (Driver + 3 Staff)");
      return;
    }
    try {
      const response = await fetch(`${BASE}/api/bookings/video-call/requests/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: selectedBooking.id,
          staff_id: staff.id,
          ambulance_id: ambulanceId,
          driver_email: email,
          driver_name: selectedBooking.driver || localStorage.getItem("name") || "Driver",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to send video call request");
      setCallRequests((prev) => [data, ...prev.filter((item) => item.id !== data.id && item.staff_profile_id !== data.staff_profile_id)]);
      showToast(`Video call request sent to ${staff.name}`);
    } catch (err) {
      showToast(err.message || "Video call request failed");
    }
  };

  const respondToVideoRequest = async (request, action) => {
    try {
      const response = await fetch(`${BASE}/api/bookings/video-call/requests/${request.id}/respond/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, staff_id: staffId, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to respond to video call");
      setCallRequests((prev) => prev.map((item) => item.id === data.id ? data : item));
      if (action === "accept") {
        setCallJoined(true);
        showToast("You joined the group video call");
      } else {
        showToast("Video call request declined");
      }
    } catch (err) {
      showToast(err.message || "Unable to respond to video call");
    }
  };

  // Fetch Assigned Bookings
  const loadBookings = useCallback(async () => {
    if (!cachedBookings.length) setLoading(true);
    try {
      const endpoint = isDriver
        ? `${BASE}/api/bookings/driver-assigned/?ambulance_id=${encodeURIComponent(ambulanceId)}&driver_email=${encodeURIComponent(email)}`
        : `${BASE}/api/staff/dashboard/?staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`;
      const data = await fetchFreshJson(endpoint, { key: bookingCacheKey, fallback: {} });
      const rows = (isDriver ? (Array.isArray(data) ? data : []) : (Array.isArray(data.cases) ? data.cases : []))
        .map((row) => ({ ...row, id: row.id ?? row.booking_id }))
        .filter((row) => row.id != null);

      setBookings(writeDataCache(bookingCacheKey, rows));
      setSelectedId((curr) => (rows.some((r) => String(r.id) === String(curr)) ? curr : (rows[0]?.id || null)));
    } catch {
      // Keep cached
    } finally {
      setLoading(false);
    }
  }, [ambulanceId, bookingCacheKey, cachedBookings.length, email, isDriver, staffId]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const sendSignal = useCallback((payload) => {
    if (signalSocketRef.current?.readyState === WebSocket.OPEN) {
      signalSocketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const removePeer = useCallback((remoteId) => {
    const peer = peerConnectionsRef.current.get(remoteId);
    peer?.close();
    peerConnectionsRef.current.delete(remoteId);
    setRemoteParticipants((prev) => {
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
  }, []);

  const createPeer = useCallback(async (remoteId, localStream, makeOffer) => {
    if (!localStream || typeof RTCPeerConnection === "undefined") return null;
    const existing = peerConnectionsRef.current.get(remoteId);
    if (existing) return existing;
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    peer.onicecandidate = (event) => {
      if (event.candidate) sendSignal({ type: "ice-candidate", target_id: remoteId, candidate: event.candidate });
    };
    peer.ontrack = (event) => {
      const remoteStream = event.streams?.[0];
      if (!remoteStream) return;
      setRemoteParticipants((prev) => ({
        ...prev,
        [remoteId]: { ...(prev[remoteId] || {}), stream: remoteStream },
      }));
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) removePeer(remoteId);
    };
    peerConnectionsRef.current.set(remoteId, peer);
    if (makeOffer) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal({ type: "offer", target_id: remoteId, offer });
    }
    return peer;
  }, [removePeer, sendSignal]);

  const connectSignaling = useCallback((localStream) => {
    if (!selectedBooking?.id || !localStream || signalSocketRef.current || typeof WebSocket === "undefined") return;
    const socketBase = BASE.replace(/^http/, "ws");
    const query = isDriver
      ? `role=driver&ambulance_id=${encodeURIComponent(ambulanceId)}&email=${encodeURIComponent(email)}&participant_id=${encodeURIComponent(email)}&client_id=${encodeURIComponent(clientIdRef.current)}`
      : `role=staff&staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}&participant_id=${encodeURIComponent(staffId)}&client_id=${encodeURIComponent(clientIdRef.current)}`;
    const socket = new WebSocket(`${socketBase}/ws/consultation/${selectedBooking.id}/?${query}`);
    signalSocketRef.current = socket;
    socket.onopen = () => sendSignal({ type: "join" });
    socket.onmessage = async (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      const remoteId = payload.sender_id;
      if (!remoteId || remoteId === clientIdRef.current) return;
      try {
        if (payload.type === "peer-joined") {
          setRemoteParticipants((prev) => ({
            ...prev,
            [remoteId]: { ...(prev[remoteId] || {}), role: payload.role, participantId: payload.participant_id },
          }));
          if (clientIdRef.current < remoteId) await createPeer(remoteId, localStream, true);
        }
        if (payload.type === "offer" && payload.target_id === clientIdRef.current) {
          setRemoteParticipants((prev) => ({
            ...prev,
            [remoteId]: {
              ...(prev[remoteId] || {}),
              role: payload.role || prev[remoteId]?.role || (isDriver ? "staff" : "driver"),
              participantId: payload.participant_id || prev[remoteId]?.participantId,
            },
          }));
          const peer = await createPeer(remoteId, localStream, false);
          await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal({ type: "answer", target_id: remoteId, answer });
        }
        if (payload.type === "answer" && payload.target_id === clientIdRef.current) {
          setRemoteParticipants((prev) => ({
            ...prev,
            [remoteId]: {
              ...(prev[remoteId] || {}),
              role: payload.role || prev[remoteId]?.role || (isDriver ? "staff" : "driver"),
              participantId: payload.participant_id || prev[remoteId]?.participantId,
            },
          }));
          const peer = peerConnectionsRef.current.get(remoteId);
          if (peer) await peer.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
        if (payload.type === "ice-candidate" && payload.target_id === clientIdRef.current) {
          const peer = peerConnectionsRef.current.get(remoteId);
          if (peer && payload.candidate) await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
        if (payload.type === "peer-left") removePeer(remoteId);
      } catch (err) {
        showToast(err.message || "Unable to connect this video participant");
      }
    };
    socket.onerror = () => showToast("Video signaling is unavailable");
    socket.onclose = () => { signalSocketRef.current = null; };
  }, [ambulanceId, createPeer, email, isDriver, removePeer, selectedBooking?.id, sendSignal, staffId]);

  const closeSignaling = useCallback(() => {
    sendSignal({ type: "leave" });
    signalSocketRef.current?.close();
    signalSocketRef.current = null;
    peerConnectionsRef.current.forEach((peer) => peer.close());
    peerConnectionsRef.current.clear();
    setRemoteParticipants({});
  }, [sendSignal]);

  useEffect(() => {
    if (selectedBooking?.id && stream && (isDriver || callJoined)) connectSignaling(stream);
  }, [callJoined, connectSignaling, isDriver, selectedBooking?.id, stream]);

  useEffect(() => () => closeSignaling(), [closeSignaling, selectedBooking?.id]);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Speaker simulation
  useEffect(() => {
    const spk = setInterval(() => {
      setActiveSpeaker((c) => (c === "remote" ? "local" : "remote"));
    }, 6000);
    return () => clearInterval(spk);
  }, []);

  // Camera start
  useEffect(() => {
    let localStream = null;
    async function initCam() {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStream = s;
          setStream(s);
          if (localVideoRef.current) localVideoRef.current.srcObject = s;
          setCameraOn(true);
          setMicOn(true);
        }
      } catch (err) {
        // Camera/mic not available — show toast but don't crash
        const msg = err?.name === "NotAllowedError"
          ? "Camera/microphone permission denied. Please allow access and refresh."
          : err?.name === "NotFoundError"
          ? "No camera or microphone found on this device."
          : "Camera could not start. You can still join the call in listen-only mode.";
        showToast(msg);
        setCameraOn(false);
        setMicOn(false);
      }
    }
    initCam();
    return () => {
      // Use captured localStream, not stale state reference
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = stream || null;
  }, [stream]);

  const toggleMic = () => {
    const next = !micOn;
    stream?.getAudioTracks().forEach((t) => { t.enabled = next; });
    setMicOn(next);
    showToast(next ? "Microphone Unmuted" : "Microphone Muted");
  };

  const toggleCamera = () => {
    const next = !cameraOn;
    stream?.getVideoTracks().forEach((t) => { t.enabled = next; });
    setCameraOn(next);
    showToast(next ? "Camera Turned On" : "Camera Turned Off");
  };

  const handleSendChat = (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    const isSenderStaff = !isDriver;
    const myName = isDriver ? (selectedBooking?.driver || "Driver") : loggedInStaffName;
    const myRole = isDriver ? "DRIVER" : loggedInStaffRole;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: myName,
        role: myRole,
        text: chatInput.trim(),
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        isStaffSender: isSenderStaff,
      },
    ]);
    setChatInput("");
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const driverName = selectedBooking?.driver || "Driver";
  const ambulanceNum = selectedBooking?.ambulance_number || "—";
  const participantForStaff = (staff) => {
    const request = requestForStaff(staff);
    const participantId = request?.staff_contract_id || staff.contractId;
    const match = Object.values(remoteParticipants).find((participant) =>
      (participantId && String(participant.participantId || "").toLowerCase() === String(participantId || "").toLowerCase())
      || (staff.id && String(participant.participantId || "") === String(staff.id))
      || (participant.role === "staff" && Object.values(remoteParticipants).length === 1)
    );
    return match || Object.values(remoteParticipants).find((p) => p.stream) || null;
  };
  const driverParticipant = Object.values(remoteParticipants).find((participant) => participant.role === "driver")
    || Object.values(remoteParticipants).find((participant) => participant.stream)
    || Object.values(remoteParticipants)[0]
    || null;
  const pendingStaffRequest = !isDriver ? callRequests.find((item) => item.status === "pending") : null;

  return (
    <div className="consult-middle-container">
      <style>{`
        /* ── Perfectly Centered from Top and Bottom · Modern Clean Medical Theme · Zero Cutoff ── */
        .consult-middle-container {
          margin-left: 64px;
          height: calc(100vh - 72px);
          margin-top: 72px; /* Clears fixed topnavbar cleanly! */
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 28px;
          background: #f8fafc; /* Crisp modern medical slate background */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          user-select: none;
          overflow: hidden;
        }

        .consult-two-cards-box {
          width: 100%;
          max-width: 1420px;
          height: 100%;
          max-height: 820px;
          display: grid;
          grid-template-columns: 1fr 370px;
          gap: 20px;
          box-sizing: border-box;
        }

        /* ── LEFT CARD: 2-PERSON VIDEO CANVAS (LOGGED-IN STAFF & DRIVER ONLY) ── */
        .left-video-card {
          flex: 1;
          min-width: 0;
          height: 100%;
          background: #ffffff;
          border-radius: 20px;
          border: 2px solid #087640;
          box-shadow: 0 12px 40px rgba(8, 118, 64, 0.16), 0 2px 10px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        /* Top Header inside Video Card */
        .video-card-topbar {
          height: 52px;
          padding: 0 22px;
          background: #ffffff;
          border-bottom: 1.5px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }

        .topbar-left-meta {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pulsing-live-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: emeraldPulse 1.4s infinite;
        }

        @keyframes emeraldPulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 14px #10b981; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }

        .consult-badge-pill {
          background: #087640;
          color: #ffffff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 20px;
        }

        .case-brief-title {
          color: #475569;
          font-size: 12px;
          font-weight: 600;
        }

        .case-brief-title b {
          color: #0f172a;
        }

        /* 2-PERSON STAGE: ONLY DRIVER & CURRENT LOGGED-IN STAFF MEMBER */
        .video-stage-grid {
          flex: 1;
          min-height: 0;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          position: relative;
          background: #f7fafc;
        }

        .single-stream-tile {
          position: relative;
          background: #edf4f7;
          border-radius: 14px;
          overflow: hidden;
          border: 2px solid rgba(8, 118, 64, 0.2);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }

        .single-stream-tile.speaker-active {
          border: 2.5px solid #10b981 !important;
          box-shadow: 0 0 22px rgba(16, 185, 129, 0.4) !important;
        }

        .stream-video-element {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .stream-video-element.mirror {
          transform: scaleX(-1);
        }

        .stream-initials-tile {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #dcecf3, #f8fcfd);
          color: #0e6a3d;
          font-size: clamp(34px, 5vw, 68px);
          font-weight: 900;
        }

        /* Identity Pill Overlay */
        .stream-id-pill {
          position: absolute;
          left: 12px;
          bottom: 12px;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(8, 118, 64, 0.4);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #172235;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 5;
        }

        .role-pill-badge {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.5px;
          padding: 2px 7px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .role-pill-badge.driver-role {
          background: #f59e0b;
          color: #451a03;
        }

        .role-pill-badge.staff-role {
          background: #087640;
          color: #ffffff;
        }

        .live-mic-indicator {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
        }

        .live-mic-indicator.muted {
          background: #ef4444;
        }

        /* Vitals Telemetry Ribbon — Golden Yellow #f59e0b */
        .vitals-hud-ribbon {
          position: absolute;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          background: #f59e0b;
          border: 2px solid #d97706;
          border-radius: 30px;
          padding: 6px 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          z-index: 15;
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.45);
          white-space: nowrap;
        }

        .vitals-stat-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
        }

        .vitals-stat-label {
          font-size: 9px;
          font-weight: 900;
          color: #78350f;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .vitals-stat-val {
          font-weight: 900;
          color: #0f172a;
        }

        .vitals-divider {
          width: 1px;
          height: 14px;
          background: rgba(120, 53, 15, 0.3);
          flex-shrink: 0;
        }

        /* Bottom Controls Bar */
        .video-action-bar {
          height: 64px;
          background: #ffffff;
          border-top: 1.5px solid #e2e8f0;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          z-index: 20;
        }

        .btn-action-ctrl {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          background: transparent;
          border: none;
          color: #374151;
          font-size: 10px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          min-width: 52px;
        }

        .btn-action-ctrl:hover {
          background: #f0fdf4;
          color: #087640;
        }

        .btn-action-ctrl.active-green {
          color: #087640;
        }

        .btn-action-ctrl.red-end-call {
          margin-left: auto;
          background: #dc2626;
          color: #ffffff;
          padding: 6px 16px;
          border-radius: 8px;
          font-weight: 700;
        }

        .btn-action-ctrl.red-end-call:hover {
          background: #b91c1c;
        }

        /* ── RIGHT CARD: 100% DEDICATED CLEAN CHAT CONSOLE (ALL OTHER CLUTTER REMOVED!) ── */
        .right-chat-card {
          width: 380px;
          min-width: 350px;
          max-width: 400px;
          height: 100%;
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 32px rgba(8, 118, 64, 0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: #0f172a;
        }

        .video-call-request-card {
          margin: 12px;
          padding: 14px;
          display: grid;
          gap: 6px;
          background: #f0fdf4;
          border: 1px solid #a7d9b8;
          border-radius: 14px;
          color: #172235;
          font-size: 12px;
        }

        .video-call-request-kicker {
          color: #087640;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .video-call-request-card span {
          color: #64748b;
          line-height: 1.4;
        }

        .video-call-request-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .request-accept-btn,
        .request-reject-btn {
          flex: 1;
          border: 0;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .request-accept-btn { background: #087640; color: #ffffff; }
        .request-reject-btn { background: #ffffff; color: #9f1239; border: 1px solid #f1b5c2; }

        /* Clean Chat Header */
        .chat-console-header {
          padding: 16px 20px;
          background: #ffffff;
          border-bottom: 1.5px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .chat-header-title-box h3 {
          margin: 0 0 3px 0;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        .chat-header-online-status {
          font-size: 12px;
          color: #087640;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
        }

        .online-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
        }

        /* Full Height Scrollable Chat Message Stream */
        .chat-messages-viewport {
          flex: 1;
          overflow-y: auto;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #fbfcfd;
        }

        .chat-message-row {
          display: flex;
          flex-direction: column;
          max-width: 84%;
        }

        .chat-message-row.from-staff {
          align-self: flex-end;
          align-items: flex-end;
        }

        .chat-message-row.from-driver {
          align-self: flex-start;
          align-items: flex-start;
        }

        .message-bubble {
          padding: 10px 14px;
          font-size: 12px;
          line-height: 1.45;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .message-bubble.staff-bubble {
          background: #087640; /* Hospital Emerald Green */
          color: #ffffff;
          border-radius: 14px 14px 2px 14px;
        }

        .message-bubble.driver-bubble {
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-radius: 14px 14px 14px 2px;
        }

        .bubble-meta-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: #94a3b8;
          margin-top: 4px;
          padding: 0 4px;
        }

        /* Chat Input Footer */
        .chat-input-footer-area {
          padding: 14px 16px;
          background: #ffffff;
          border-top: 1.5px solid #f1f5f9;
        }

        .chat-send-form {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chat-text-box {
          flex: 1;
          border: 1.5px solid #cbd5e1;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 12px;
          outline: none;
          color: #0f172a;
          background: #f8fafc;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .chat-text-box:focus {
          border-color: #087640;
          background: #ffffff;
        }

        .chat-submit-btn {
          background: #087640;
          color: #ffffff;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }

        .chat-submit-btn:hover {
          background: #065e33;
        }

        .toast-pill-badge {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #087640;
          color: #ffffff;
          border: 1.5px solid #065f46;
          padding: 9px 24px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 6px 24px rgba(8, 118, 64, 0.35);
          z-index: 1000;
          white-space: nowrap;
        }

        /* ── RESPONSIVE BREAKPOINTS ── */

        /* Large tablet: shrink right column slightly */
        @media (max-width: 1200px) {
          .consult-two-cards-box {
            grid-template-columns: 1fr 300px;
            max-height: 720px;
          }
          .consult-middle-container {
            padding: 16px 16px;
          }
        }

        /* Mobile ≤ 768px: keep video controls and team actions reachable by scrolling */
        @media (max-width: 768px) {
          .consult-middle-container {
            margin-left: 0;
            height: auto;
            min-height: calc(100vh - 72px);
            padding: 0 0 110px;
            align-items: stretch;
            overflow: visible;
          }
          .consult-two-cards-box {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 0;
            max-height: none;
            gap: 12px;
          }
          /* Video card fills the first viewport; roster/chat follows below it. */
          .left-video-card {
            height: calc(100vh - 154px);
            min-height: 520px;
            border-radius: 16px;
            border: 2px solid #087640;
            box-shadow: 0 8px 24px rgba(8, 118, 64, 0.12);
          }
          .video-card-topbar {
            border-radius: 0;
            height: 48px;
          }
          /* PiP layout: block positioning, NO dark blue */
          .video-stage-grid {
            display: block;
            position: relative;
            padding: 0;
            gap: 0;
            background: #f7fafc;
          }
          /* Force ALL tiles absolutely positioned on mobile */
          .video-stage-grid .single-stream-tile {
            position: absolute !important;
          }
          /* Person 1 (Driver) → FULL SCREEN background (nth-child 1 — vitals ribbon removed) */
          .video-stage-grid .single-stream-tile:nth-child(1) {
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            z-index: 1;
          }
          /* Person 2 (Staff) → Picture-in-Picture corner (nth-child 2) */
          .video-stage-grid .single-stream-tile:nth-child(2) {
            top: auto;
            left: auto;
            bottom: 20px;
            right: 14px;
            width: 110px;
            height: 148px;
            border-radius: 14px !important;
            border: 2.5px solid rgba(16, 185, 129, 0.85) !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
            z-index: 5;
          }
          /* Hide text pill inside PiP tile */
          .video-stage-grid .single-stream-tile:nth-child(2) .stream-id-pill {
            display: none !important;
          }
          /* Semi-transparent white action bar */
          .video-action-bar {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-top: 1px solid #e2e8f0;
            z-index: 20;
          }
          .right-chat-card,
          .right-team-panel {
            display: flex !important;
            width: 100%;
            min-width: 0;
            height: auto;
            min-height: 420px;
            max-height: none;
            border-radius: 16px;
            overflow: visible;
          }
          .driver-panel-body {
            max-height: none;
            overflow: visible;
          }
          .team-tab-btn {
            min-height: 48px;
            font-size: 10px;
            padding: 10px 5px;
          }
        }

          /* Small mobile ≤ 420px */
        @media (max-width: 420px) {
          .video-card-topbar {
            height: 44px;
            padding: 0 12px;
          }
          .consult-badge-pill {
            font-size: 9px;
            padding: 2px 6px;
          }
          .case-brief-title {
            font-size: 10px;
          }
          .video-stage-grid .single-stream-tile:nth-child(2) {
            width: 88px;
            height: 118px;
            bottom: 14px;
            right: 10px;
          }
          .video-action-bar {
            height: 56px;
            gap: 2px;
          }
          .btn-action-ctrl {
            padding: 4px 7px;
            font-size: 9px;
          }
        }

        /* ── DRIVER 3-TAB RIGHT PANEL ── */
        .right-team-panel {
          width: 370px;
          min-width: 320px;
          height: 100%;
          background: #ffffff;
          border-radius: 20px;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 4px 24px rgba(0,0,0,0.07);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .team-tabs-row {
          display: flex;
          border-bottom: 1.5px solid #e2e8f0;
          background: #f8fafc;
        }

        .team-tab-btn {
          flex: 1;
          padding: 12px 8px;
          background: transparent;
          border: none;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: all 0.15s ease;
          border-bottom: 2.5px solid transparent;
          white-space: nowrap;
        }

        .team-tab-btn:hover {
          color: #087640;
          background: #f0fdf4;
        }

        .team-tab-btn.active-tab {
          color: #087640;
          border-bottom-color: #087640;
          background: #ffffff;
          font-weight: 800;
        }

        .driver-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .case-heading {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .case-meta-line {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .active-dot-small {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
        }

        .case-info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
        }

        .case-info-table td {
          padding: 5px 0;
          vertical-align: top;
        }

        .case-info-table .ci-label {
          color: #087640;
          font-weight: 700;
          width: 110px;
          padding-right: 10px;
        }

        .case-info-table .ci-value {
          color: #0f172a;
          font-weight: 600;
        }

        .staff-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .staff-section-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
        }

        .assigned-badge {
          font-size: 10px;
          font-weight: 700;
          color: #10b981;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .staff-roster-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .staff-roster-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          transition: border-color 0.15s ease;
        }

        .staff-roster-card:hover {
          border-color: #10b981;
        }

        .staff-roster-card.in-call {
          border-color: #087640;
          background: #f0fdf4;
        }

        .staff-avatar-img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #e2e8f0;
          flex-shrink: 0;
        }

        .staff-avatar-img.in-call-avatar {
          border-color: #087640;
        }

        .staff-avatar-fallback {
          display: grid;
          place-items: center;
          background: #e3f4fb;
          color: #087640;
          font-size: 13px;
          font-weight: 900;
        }

        .roster-empty {
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          padding: 18px 12px;
          color: #64748b;
          font-size: 12px;
          text-align: center;
          background: #f8fafc;
        }

        .staff-card-info {
          flex: 1;
          min-width: 0;
        }

        .staff-card-name {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 2px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .staff-card-specialty {
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
          line-height: 1.3;
        }

        .connect-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 12px;
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #374151;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .connect-btn:hover {
          border-color: #087640;
          color: #087640;
          background: #f0fdf4;
        }

        .connect-btn.request-pending,
        .connect-btn.request-pending:hover {
          color: #64748b;
          border-color: #cbd5e1;
          background: #f8fafc;
          cursor: wait;
        }

        .in-call-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 12px;
          background: #f0fdf4;
          border: 1.5px solid #087640;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #087640;
          white-space: nowrap;
          cursor: pointer;
          flex-shrink: 0;
        }

        .transmit-btn-footer {
          padding: 14px 16px;
          border-top: 1.5px solid #e2e8f0;
          background: #f8fafc;
        }

        .transmit-protocol-btn {
          width: 100%;
          padding: 11px 16px;
          background: #087640;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.15s ease;
        }

        .transmit-protocol-btn:hover {
          background: #065f46;
        }

        /* Multi-person video grid for driver (2x2 max) */
        .video-stage-grid-driver {
          flex: 1;
          min-height: 0;
          display: grid;
          gap: 10px;
          padding: 12px;
          position: relative;
          background: #f7fafc;
        }

        .driver-tile-pill {
          position: absolute;
          left: 10px;
          bottom: 10px;
          background: rgba(8, 118, 64, 0.92);
          color: #ffffff;
          font-size: 9px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }

        /* Directives tab styling */
        .directives-section {
          padding: 4px 0;
        }

        .directive-card {
          background: #fffbeb;
          border: 1.5px solid #fde68a;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }

        .directive-title {
          font-size: 11px;
          font-weight: 800;
          color: #92400e;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .directive-text {
          font-size: 12px;
          color: #374151;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 960px) {
          .right-team-panel {
            width: 100%;
            min-width: 0;
            min-height: 360px;
          }
        }
      `}</style>

      <div className="consult-two-cards-box">
        {/* ─── LEFT CARD: 2-PERSON VIDEO CANVAS (DRIVER & LOGGED-IN STAFF ONLY) ─── */}
        <div className="left-video-card">
          {/* Top Bar inside Left Card */}
          <div className="video-card-topbar">
            <div className="topbar-left-meta">
              <span className="pulsing-live-dot"></span>
              <span className="consult-badge-pill">
                {isDriver ? "Ambulance Driver Console" : `${loggedInStaffRole} Emergency Console`}
              </span>
              <span className="case-brief-title">
                Booking <b>{selectedBooking ? `#${selectedBooking.id}` : "—"}</b> · <b>{bookingName(selectedBooking)}</b>
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="consult-badge-pill" style={{ background: "#087640", border: "1px solid #065f46" }}>
                ⏱️ {formatTime(elapsed)}
              </span>
              <span style={{ fontSize: 11, color: "#374151", fontWeight: 700 }}>
                🏥 {selectedBooking?.assigned_hospital_name || hospitalName}
              </span>
            </div>
          </div>
          {/* VIDEO STAGE: driver = multi-person 2x2, staff = 2-tile */}
          {isDriver ? (
            /* ── DRIVER: UP TO 4 TILES (DRIVER + MAX 3 CONNECTED STAFF) ── */
            <div
              className="video-stage-grid-driver"
              style={{
                gridTemplateColumns: connectedStaff.length === 0 ? "1fr" : "1fr 1fr",
                gridTemplateRows: connectedStaff.length <= 1 ? "1fr" : "1fr 1fr",
              }}
            >
              {/* Driver's own tile (always first) */}
              <div className={`single-stream-tile ${activeSpeaker === "local" ? "speaker-active" : ""}`}>
                {cameraOn && stream ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className="stream-video-element mirror" />
                ) : (
                  <img
                    src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80"
                    alt={driverName}
                    className="stream-video-element"
                  />
                )}
                <div className="stream-id-pill">
                  <span className={`live-mic-indicator ${!micOn ? "muted" : ""}`}></span>
                  <span>{driverName}</span>
                  <span className="role-pill-badge driver-role">PARAMEDIC / DRIVER</span>
                </div>
              </div>

              {/* Connected staff tiles (up to 3) */}
              {allocatedStaff.filter((s) => connectedStaff.includes(s.id)).length > 0 ? (
                allocatedStaff
                  .filter((s) => connectedStaff.includes(s.id))
                  .map((staff) => {
                    const participant = participantForStaff(staff);
                    return (
                      <div key={staff.id} className={`single-stream-tile ${activeSpeaker === "remote" ? "speaker-active" : ""}`}>
                        {participant?.stream ? (
                          <video ref={(element) => { if (element) element.srcObject = participant.stream; }} autoPlay playsInline className="stream-video-element" />
                        ) : staff.avatar ? (
                          <img src={staff.avatar} alt={staff.name} className="stream-video-element" style={{ objectFit: "cover" }} />
                        ) : (
                          <div className="stream-initials-tile">{initials(staff.name)}</div>
                        )}
                        <div className="stream-id-pill">
                          <span className="live-mic-indicator"></span>
                          <span>{staff.name}</span>
                          <span className="role-pill-badge staff-role">{staff.role.toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  })
              ) : Object.keys(remoteParticipants).length > 0 ? (
                Object.entries(remoteParticipants).slice(0, 3).map(([remoteId, p]) => (
                  <div key={remoteId} className={`single-stream-tile ${activeSpeaker === "remote" ? "speaker-active" : ""}`}>
                    {p.stream ? (
                      <video ref={(element) => { if (element) element.srcObject = p.stream; }} autoPlay playsInline className="stream-video-element" />
                    ) : (
                      <div className="stream-initials-tile">DOC</div>
                    )}
                    <div className="stream-id-pill">
                      <span className="live-mic-indicator"></span>
                      <span>Hospital Staff</span>
                      <span className="role-pill-badge staff-role">CARE TEAM</span>
                    </div>
                  </div>
                ))
              ) : null}
            </div>
          ) : (
            /* ── STAFF: 2 TILES ONLY (DRIVER + LOGGED-IN STAFF MEMBER) ── */
            <div className="video-stage-grid">
              {/* PERSON 1: AMBULANCE DRIVER */}
              <div className={`single-stream-tile ${activeSpeaker === "local" ? "speaker-active" : ""}`}>
                {driverParticipant?.stream ? <video ref={(element) => { if (element) element.srcObject = driverParticipant.stream; }} autoPlay playsInline className="stream-video-element" /> : <img
                  src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80"
                  alt="Driver"
                  className="stream-video-element"
                />}
                <div className="stream-id-pill">
                  <span className="live-mic-indicator"></span>
                  <span>{driverName}</span>
                  <span className="role-pill-badge driver-role">PARAMEDIC / DRIVER</span>
                </div>
              </div>

              {/* PERSON 2: CURRENTLY LOGGED-IN STAFF MEMBER */}
              <div className={`single-stream-tile ${activeSpeaker === "remote" ? "speaker-active" : ""}`}>
                {cameraOn && stream ? (
                  <video ref={localVideoRef} autoPlay playsInline muted className="stream-video-element mirror" />
                ) : (
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80"
                    alt={loggedInStaffName}
                    className="stream-video-element"
                  />
                )}
                <div className="stream-id-pill">
                  <span className="live-mic-indicator"></span>
                  <span>{loggedInStaffName}</span>
                  <span className="role-pill-badge staff-role">{loggedInStaffRole} · {hospitalName}</span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Control Bar */}
          <div className="video-action-bar">
            <button className={`btn-action-ctrl ${micOn ? "active-green" : ""}`} onClick={toggleMic} title="Mute/Unmute">
              {micOn ? <Mic size={20} /> : <MicOff size={20} style={{ color: "#ef4444" }} />}
              <span>Audio</span>
            </button>

            <button className={`btn-action-ctrl ${cameraOn ? "active-green" : ""}`} onClick={toggleCamera} title="Camera">
              {cameraOn ? <Video size={20} /> : <VideoOff size={20} style={{ color: "#ef4444" }} />}
              <span>Video</span>
            </button>

            <button
              className="btn-action-ctrl active-green"
              onClick={() => { if (isDriver) setActiveTab("chat"); showToast("Live Chat active →"); }}
              title="Live Chat"
            >
              <MessageSquare size={20} />
              <span>Chat</span>
            </button>

            <button className="btn-action-ctrl" onClick={() => showToast("❤️ Telemetry acknowledged")} title="React">
              <Heart size={20} />
              <span>React</span>
            </button>

            <button
              className="btn-action-ctrl"
              onClick={() => showToast("ECG Stream Transmitted")}
              title="Transmit ECG / Vitals"
            >
              <Share2 size={20} />
              <span>Transmit</span>
            </button>

            <button
              className="btn-action-ctrl red-end-call"
              onClick={() => showToast("Consultation archived. ER team standing by.")}
              title="End Call"
            >
              <PhoneOff size={18} />
              <span>End</span>
            </button>

            <button className="btn-action-ctrl" onClick={toggleFullscreen} title="Fullscreen">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Driver = 3-Tab, Staff = Chat Only ─── */}
        {isDriver ? (
          /* ── DRIVER RIGHT PANEL: Team Roster + Live Chat + Directives ── */
          <div className="right-team-panel">
            {/* 3 Tabs */}
            <div className="team-tabs-row">
              <button
                className={`team-tab-btn ${activeTab === "roster" ? "active-tab" : ""}`}
                onClick={() => setActiveTab("roster")}
              >
                👥 Team Roster
              </button>
              <button
                className={`team-tab-btn ${activeTab === "chat" ? "active-tab" : ""}`}
                onClick={() => setActiveTab("chat")}
              >
                💬 Live Chat ({messages.length})
              </button>
              <button
                className={`team-tab-btn ${activeTab === "directives" ? "active-tab" : ""}`}
                onClick={() => setActiveTab("directives")}
              >
                📋 Directives
              </button>
            </div>

            {/* Tab Body */}
            <div className="driver-panel-body">

              {/* ── TAB 1: TEAM ROSTER ── */}
              {activeTab === "roster" && (
                <>
                  <h3 className="case-heading">{selectedBooking ? "Emergency Care Consultation" : "No consultation selected"}</h3>
                  <div className="case-meta-line">
                    <span className="active-dot-small"></span>
                    {selectedBooking ? `${new Date().toLocaleDateString("en-IN", { weekday: "short", hour: "2-digit", minute: "2-digit" })} · Active` : "Select an assigned booking to continue"}
                    <RefreshCw size={11} style={{ cursor: "pointer", marginLeft: 2 }} onClick={loadBookings} />
                  </div>

                  {/* Patient Case Info */}
                  <table className="case-info-table">
                    <tbody>
                      <tr>
                        <td className="ci-label">Patient:</td>
                        <td className="ci-value">
                          {selectedBooking?.patient_name || "—"} {selectedBooking ? `(${selectedBooking.patient_age || "—"}y / ${selectedBooking.patient_gender?.[0] || "—"})` : ""}
                        </td>
                      </tr>
                      <tr>
                        <td className="ci-label">Emergency:</td>
                        <td className="ci-value">{selectedBooking?.patient_condition || "—"}</td>
                      </tr>
                      <tr>
                        <td className="ci-label">Hospital:</td>
                        <td className="ci-value">{selectedBooking?.assigned_hospital_name || "—"}</td>
                      </tr>
                      <tr>
                        <td className="ci-label">Bed Allocated:</td>
                        <td className="ci-value">🛏 {selectedBooking?.assigned_bed_number || "—"}</td>
                      </tr>
                      <tr>
                        <td className="ci-label">Ambulance:</td>
                        <td className="ci-value">{ambulanceNum}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Allocated Staff */}
                  <div className="staff-section-header">
                    <span className="staff-section-title">Allocated Staff ({allocatedStaff.length})</span>
                    <span className="assigned-badge">Group call: {1 + connectedStaff.length}/4</span>
                  </div>

                  <div className="staff-roster-list">
                    {allocatedStaff.length === 0 && <div className="roster-empty">No allocated team members for this booking.</div>}
                    {allocatedStaff.map((staff) => {
                      const request = requestForStaff(staff);
                      const isConnected = request?.status === "accepted" || connectedStaff.includes(staff.id);
                      return (
                        <div key={staff.id} className={`staff-roster-card ${isConnected ? "in-call" : ""}`}>
                          {staff.avatar ? <img src={staff.avatar} alt={staff.name} className={`staff-avatar-img ${isConnected ? "in-call-avatar" : ""}`} /> : <div className={`staff-avatar-img staff-avatar-fallback ${isConnected ? "in-call-avatar" : ""}`}>{initials(staff.name)}</div>}
                          <div className="staff-card-info">
                            <p className="staff-card-name">{staff.name}</p>
                            <p className="staff-card-specialty">{staff.specialty}</p>
                          </div>
                          {isConnected ? (
                            <button className="in-call-badge" onClick={() => showToast(`${staff.name} is in the group call`)} title="Participant connected">
                              ✓ In Call
                            </button>
                          ) : request?.status === "pending" ? (
                            <button className="connect-btn request-pending" disabled title="Waiting for staff acceptance">
                              ⏳ Requested
                            </button>
                          ) : (
                            <button className="connect-btn" onClick={() => sendVideoRequest(staff)} title="Send video call request">
                              📞 Request call
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── TAB 2: LIVE CHAT ── */}
              {activeTab === "chat" && (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
                  <div className="chat-console-header" style={{ paddingBottom: 10, marginBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <div className="chat-header-title-box">
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>Live Consultation Chat</h3>
                      <div className="chat-header-online-status">
                        <span className="online-dot"></span>
                        <span style={{ fontSize: 11, color: "#64748b" }}>Direct with team</span>
                      </div>
                    </div>
                  </div>
                  <div className="chat-messages-viewport" style={{ flex: 1 }}>
                    {messages.map((m) => (
                      <div key={m.id} className={`chat-message-row ${m.isStaffSender ? "from-staff" : "from-driver"}`}>
                        <div className={`message-bubble ${m.isStaffSender ? "staff-bubble" : "driver-bubble"}`}>{m.text}</div>
                        <div className="bubble-meta-info"><b>{m.sender}</b> ({m.role}) · {m.time}</div>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>
                  <div className="chat-input-footer-area" style={{ paddingTop: 8 }}>
                    <form className="chat-send-form" onSubmit={handleSendChat}>
                      <input
                        type="text"
                        className="chat-text-box"
                        placeholder="Type message to team..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                      />
                      <button type="submit" className="chat-submit-btn" disabled={!chatInput.trim()}>
                        <Send size={15} />
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* ── TAB 3: DIRECTIVES ── */}
              {activeTab === "directives" && (
                <div className="directives-section">
                  <div className="directive-card">
                    <p className="directive-title">🚨 Airway Protocol</p>
                    <p className="directive-text">Keep bilateral airway open. Position patient at 30° head elevation. Suction PRN.</p>
                  </div>
                  <div className="directive-card">
                    <p className="directive-title">💉 IV Access</p>
                    <p className="directive-text">18G IV line secured in left forearm. Normal saline 500ml running at 125ml/hr.</p>
                  </div>
                  <div className="directive-card">
                    <p className="directive-title">📡 Telemetry</p>
                    <p className="directive-text">Continuous 12-lead ECG monitoring. Transmit rhythm strip every 5 minutes to ER.</p>
                  </div>
                  <div className="directive-card">
                    <p className="directive-title">🏥 Destination</p>
                    <p className="directive-text">{selectedBooking?.assigned_hospital_name || "Hospital not selected"} {selectedBooking?.assigned_bed_number ? `— ICU Bed ${selectedBooking.assigned_bed_number} allocated.` : "— no bed allocation recorded yet."}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Transmit Protocol Button at Bottom */}
            <div className="transmit-btn-footer">
              <button className="transmit-protocol-btn" onClick={() => showToast("✅ Protocol transmitted to hospital!")}>
                ▶ Transmit Protocol to Hospital
              </button>
            </div>
          </div>
        ) : (
          /* ── STAFF RIGHT PANEL: Plain Chat Only ── */
          <div className="right-chat-card">
            {pendingStaffRequest && (
              <div className="video-call-request-card">
                <div className="video-call-request-kicker">Incoming video call</div>
                <strong>{pendingStaffRequest.driver_name || "Ambulance driver"} is requesting you</strong>
                <span>Booking #{pendingStaffRequest.booking_id} · join the group consultation.</span>
                <div className="video-call-request-actions">
                  <button className="request-accept-btn" onClick={() => respondToVideoRequest(pendingStaffRequest, "accept")}>Accept</button>
                  <button className="request-reject-btn" onClick={() => respondToVideoRequest(pendingStaffRequest, "reject")}>Decline</button>
                </div>
              </div>
            )}
            <div className="chat-console-header">
              <div className="chat-header-title-box">
                <h3>Live Consultation Chat</h3>
                <div className="chat-header-online-status">
                  <span className="online-dot"></span>
                  <span>Direct with {driverName} (Driver)</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, color: "#64748b" }}>
                <RefreshCw size={14} style={{ cursor: "pointer" }} onClick={loadBookings} title="Refresh Case" />
              </div>
            </div>

            <div className="chat-messages-viewport">
              {messages.map((m) => (
                <div key={m.id} className={`chat-message-row ${m.isStaffSender ? "from-staff" : "from-driver"}`}>
                  <div className={`message-bubble ${m.isStaffSender ? "staff-bubble" : "driver-bubble"}`}>{m.text}</div>
                  <div className="bubble-meta-info"><b>{m.sender}</b> ({m.role}) · {m.time}</div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <div className="chat-input-footer-area">
              <form className="chat-send-form" onSubmit={handleSendChat}>
                <input
                  type="text"
                  className="chat-text-box"
                  placeholder="Type directive to ambulance driver..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="chat-submit-btn" disabled={!chatInput.trim()}>
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Floating Toast Alert */}
      {toast && <div className="toast-pill-badge">{toast}</div>}
    </div>
  );
}
