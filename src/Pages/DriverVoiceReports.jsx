import { useEffect, useMemo, useRef, useState } from "react";

const BASE = "http://127.0.0.1:8000";

const supportsSpeechApi = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export default function DriverVoiceReports() {
  const driverName = (localStorage.getItem("name") || "").trim();
  const driverEmail = (localStorage.getItem("user") || "").trim().toLowerCase();
  const ambulanceId = Number(localStorage.getItem("ambulance_id") || "0");

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [bookings, setBookings] = useState([]);
  const [transcriptByBooking, setTranscriptByBooking] = useState({});
  const [aiDraftByBooking, setAiDraftByBooking] = useState({});
  const [refiningBookingId, setRefiningBookingId] = useState(0);
  const [recordingBookingId, setRecordingBookingId] = useState(0);
  const [micConnected, setMicConnected] = useState(false);
  const [savingBookingId, setSavingBookingId] = useState(0);
  const [sentNowByBooking, setSentNowByBooking] = useState({});
  const [menuOpenBookingId, setMenuOpenBookingId] = useState(0);
  const [deletingBookingId, setDeletingBookingId] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const recRef = useRef(null);

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/`);
      const rows = await res.json();
      const list = Array.isArray(rows) ? rows : [];
      const filtered = list
        .filter((b) => {
          const byAmb = ambulanceId > 0 && Number(b.ambulance_id) === ambulanceId;
          const byDriverName = driverName && String(b.driver || "").trim().toLowerCase() === driverName.toLowerCase();
          const byDriverEmail = driverEmail && String(b.driver_email || "").trim().toLowerCase() === driverEmail;
          return byAmb || byDriverName || byDriverEmail;
        })
        .filter((b) => b.status === "confirmed" || b.status === "pending" || b.sent_to_driver || b.report_submitted_at)
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      setBookings(filtered);
      setSentNowByBooking((prev) => {
        const synced = {};
        filtered.forEach((b) => {
          const bid = Number(b.id || 0);
          if (!bid) return;
          // Local sent-state ko backend state ke saath sync rakho,
          // taaki false-positive "Report Sended" na dikhe.
          synced[bid] = Boolean(
            b.report_sent_to_hospital ||
            b.driver_report_sent_at ||
            prev[bid]
          );
        });
        return synced;
      });
    } catch {
      setErrorMsg("Unable to load bookings for voice report page.");
    }
  };

  useEffect(() => {
    fetchBookings();
    const timer = window.setInterval(fetchBookings, 8000);
    return () => {
      window.clearInterval(timer);
      if (recRef.current && recordingBookingId) {
        try {
          recRef.current.stop();
        } catch {}
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speechAvailable = useMemo(() => supportsSpeechApi(), []);

  const connectMic = async () => {
    setErrorMsg("");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicConnected(true);
    } catch {
      setErrorMsg("Mic permission denied. Browser settings me microphone allow karo.");
    }
  };

  const startRecording = (bookingId) => {
    setErrorMsg("");
    if (!speechAvailable) {
      setErrorMsg("Speech recognition browser me supported nahi hai.");
      return;
    }
    if (!micConnected) {
      setErrorMsg("Pehle mic connect karo.");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const rec = new SR();
      rec.lang = "en-IN";
      rec.continuous = true;
      rec.interimResults = true;
      let finalText = String(transcriptByBooking[bookingId] || "");
      rec.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const t = event.results[i][0].transcript || "";
          if (event.results[i].isFinal) finalText = `${finalText} ${t}`.trim();
          else interim += t;
        }
        setTranscriptByBooking((prev) => ({
          ...prev,
          [bookingId]: `${finalText} ${interim}`.trim(),
        }));
        setSentNowByBooking((prev) => ({ ...prev, [bookingId]: false }));
      };
      rec.onerror = () => setErrorMsg("Mic recognition error. Dobara try karo.");
      rec.onend = () => setRecordingBookingId(0);
      rec.start();
      recRef.current = rec;
      setRecordingBookingId(bookingId);
    } catch {
      setErrorMsg("Mic start nahi hua.");
    }
  };

  const stopRecording = () => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {}
    }
    setRecordingBookingId(0);
  };

  const submitReport = async (booking) => {
    const bid = Number(booking?.id || 0);
    if (!bid) return;
    const transcript = String(transcriptByBooking[bid] || "").trim();
    const aiDraft = String(aiDraftByBooking[bid] || "").trim();
    if (!transcript) {
      setErrorMsg("Transcript required hai.");
      return;
    }
    if (!aiDraft) {
      setErrorMsg("Pehle AI Modify Report karo, phir send karo.");
      return;
    }
    setSavingBookingId(bid);
    setErrorMsg("");
    try {
      const res = await fetch(`${BASE}/api/bookings/${bid}/driver-voice-report/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          ai_modified_report: aiDraft,
          driver_name: driverName || booking.driver || "Driver Team",
          send_to_hospital: true,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Report submit failed");
      }
      await fetchBookings();
      setSentNowByBooking((prev) => ({ ...prev, [bid]: true }));
    } catch (e) {
      setErrorMsg(String(e.message || "Unable to submit report"));
    } finally {
      setSavingBookingId(0);
    }
  };

  const refineReport = async (booking) => {
    const bid = Number(booking?.id || 0);
    if (!bid) return;
    const transcript = String(transcriptByBooking[bid] || "").trim();
    if (!transcript) {
      setErrorMsg("AI modify ke liye transcript required hai.");
      return;
    }
    setRefiningBookingId(bid);
    setErrorMsg("");
    try {
      const res = await fetch(`${BASE}/api/bookings/${bid}/driver-voice-refine/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "AI modify failed");
      setAiDraftByBooking((prev) => ({
        ...prev,
        [bid]: String(data.refined_report || transcript).trim(),
      }));
    } catch (e) {
      setErrorMsg(String(e.message || "AI modify failed"));
    } finally {
      setRefiningBookingId(0);
    }
  };

  const deleteBooking = async (bookingId) => {
    const bid = Number(bookingId || 0);
    if (!bid) return;
    const ok = window.confirm(`Booking #${bid} delete karni hai?`);
    if (!ok) return;
    setDeletingBookingId(bid);
    setErrorMsg("");
    try {
      const res = await fetch(`${BASE}/api/bookings/${bid}/`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMenuOpenBookingId(0);
      await fetchBookings();
    } catch (e) {
      setErrorMsg(String(e.message || "Unable to delete booking"));
    } finally {
      setDeletingBookingId(0);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", padding: isMobile ? "84px 16px 90px 16px" : "84px 16px 30px 80px", fontFamily: "'Helvetica Neue', Arial, sans-serif", overflowX: "hidden" }}>
      <div style={{ maxWidth: 1340, margin: "0 auto" }}>
        <div style={{ border: "1px solid rgba(17,17,17,0.14)", borderRadius: 16, background: "#fff", padding: 18, marginBottom: 14, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, fontWeight: 800, color: "rgba(17,17,17,0.6)" }}>DRIVER VOICE INTAKE</div>
            <h1 style={{ margin: "5px 0 0", fontSize: 34, lineHeight: 1 }}>Current Booking Voice Reports</h1>
            <div style={{ marginTop: 7, fontSize: 13, color: "rgba(17,17,17,0.7)" }}>
              Mic se patient condition bolo, system text me convert karega aur modified report hospital ko bhej dega.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={connectMic}
              style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 12, padding: "10px 14px", fontWeight: 800, background: micConnected ? "#ffffff" : "#fff", cursor: "pointer" }}
            >
              {micConnected ? "Mic Connected" : "Connect Mic"}
            </button>
            <button
              onClick={fetchBookings}
              style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 12, padding: "10px 14px", fontWeight: 800, background: "#fff", cursor: "pointer" }}
            >
              Refresh
            </button>
          </div>
        </div>

        {!speechAvailable && (
          <div style={{ border: "1px solid #d99", background: "#fff3f3", color: "#b00", borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 12 }}>
            Browser speech recognition support available nahi hai. Chrome me open karo.
          </div>
        )}
        {errorMsg && (
          <div style={{ border: "1px solid #d99", background: "#fff3f3", color: "#b00", borderRadius: 12, padding: 10, marginBottom: 12, fontSize: 12 }}>
            {errorMsg}
          </div>
        )}

        {bookings.length === 0 && (
          <div style={{ border: "1px dashed rgba(17,17,17,0.25)", borderRadius: 14, padding: 24, textAlign: "center", color: "rgba(17,17,17,0.65)", background: "rgba(255, 255, 255, 0.15)" }}>
            No current bookings mapped to this driver.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(410px,1fr))", gap: 14 }}>
          {bookings.map((b) => {
            const bid = Number(b.id || 0);
            const isRecording = recordingBookingId === bid;
            const transcript = transcriptByBooking[bid] || "";
            const aiDraft = aiDraftByBooking[bid] || "";
            const isSent = Boolean(
              b.report_sent_to_hospital ||
              b.driver_report_sent_at ||
              sentNowByBooking[bid]
            );
            return (
              <article key={bid} style={{ border: "1px solid rgba(156,171,0,0.45)", borderRadius: 16, background: "#fffef7", padding: 14, boxShadow: "0 10px 20px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>Booking #{bid}</div>
                    <div style={{ fontSize: 13, color: "rgba(17,17,17,0.75)", marginTop: 2 }}>
                      {b.booked_by || "Patient"} · {b.pickup_location || "-"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "start", gap: 8, position: "relative" }}>
                    <span style={{ alignSelf: "start", border: "1px solid rgba(17,17,17,0.2)", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: "#ffffff" }}>
                      {String(b.status || "pending")}
                    </span>
                    <button
                      onClick={() => setMenuOpenBookingId((prev) => (prev === bid ? 0 : bid))}
                      style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(17,17,17,0.2)", background: "#fff", cursor: "pointer", fontSize: 18, fontWeight: 900, lineHeight: 1 }}
                      title="More"
                    >
                      ⋯
                    </button>
                    {menuOpenBookingId === bid && (
                      <div style={{ position: "absolute", top: 36, right: 0, background: "#fff", border: "1px solid rgba(17,17,17,0.16)", borderRadius: 10, minWidth: 170, boxShadow: "0 14px 26px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 3 }}>
                        <button
                          onClick={() => deleteBooking(bid)}
                          disabled={deletingBookingId === bid}
                          style={{ width: "100%", border: "none", background: "#fff", color: "#ffffff", textAlign: "left", padding: "10px 12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}
                        >
                          {deletingBookingId === bid ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => (isRecording ? stopRecording() : startRecording(bid))}
                    style={{ border: "1px solid #111", borderRadius: 10, padding: "9px 10px", cursor: "pointer", fontWeight: 800, background: isRecording ? "#111" : "#ffffff", color: isRecording ? "#fff" : "#111" }}
                  >
                    {isRecording ? "Stop Mic" : "Start Mic"}
                  </button>
                  <button
                    onClick={() =>
                      {
                        setTranscriptByBooking((prev) => ({
                          ...prev,
                          [bid]: "",
                        }));
                        setAiDraftByBooking((prev) => ({ ...prev, [bid]: "" }));
                        setSentNowByBooking((prev) => ({ ...prev, [bid]: false }));
                      }
                    }
                    style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 10, padding: "9px 10px", cursor: "pointer", fontWeight: 700, background: "#fff" }}
                  >
                    Clear
                  </button>
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscriptByBooking((prev) => ({ ...prev, [bid]: e.target.value }))}
                  placeholder="Mic transcript yahan ayega..."
                  style={{ width: "100%", minHeight: 96, border: "1px solid rgba(17,17,17,0.18)", borderRadius: 10, padding: 10, resize: "vertical", fontFamily: "inherit", fontSize: 13, boxSizing: "border-box", background: "#fff" }}
                />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => refineReport(b)}
                    disabled={refiningBookingId === bid || isSent}
                    style={{ border: "1px solid #111", borderRadius: 10, padding: "9px 12px", cursor: refiningBookingId === bid || isSent ? "default" : "pointer", fontWeight: 800, background: "#fff", color: "#111" }}
                  >
                    {isSent ? "AI Modified" : refiningBookingId === bid ? "Modifying..." : "AI Modify Report"}
                  </button>
                </div>
                {aiDraft ? (
                  <textarea
                    value={aiDraft}
                    onChange={(e) => {
                      setAiDraftByBooking((prev) => ({ ...prev, [bid]: e.target.value }));
                      setSentNowByBooking((prev) => ({ ...prev, [bid]: false }));
                    }}
                    placeholder="AI modified report"
                    style={{ width: "100%", minHeight: 118, border: "1px solid rgba(17,17,17,0.18)", borderRadius: 10, padding: 10, resize: "vertical", fontFamily: "inherit", fontSize: 13, boxSizing: "border-box", background: "#fff", marginTop: 8 }}
                  />
                ) : null}
                <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "rgba(17,17,17,0.64)" }}>
                    {isSent && b.driver_report_sent_at
                      ? `Last report: ${new Date(b.driver_report_sent_at).toLocaleString("en-IN")}`
                      : isSent
                        ? "Report sent to hospital."
                        : "No report sent yet"}
                  </div>
                  {isSent ? (
                    <button
                      disabled
                      style={{ border: "1px solid #111", borderRadius: 10, padding: "10px 14px", cursor: "default", fontWeight: 800, background: "#f3f3e8", color: "#111" }}
                    >
                      Report Sent
                    </button>
                  ) : (
                    <button
                      onClick={() => submitReport(b)}
                      disabled={savingBookingId === bid || !aiDraft}
                      style={{ border: "1px solid #111", borderRadius: 10, padding: "10px 14px", cursor: savingBookingId === bid || !aiDraft ? "default" : "pointer", fontWeight: 800, background: !aiDraft ? "#f3f3e8" : "#ffffff", color: "#111" }}
                    >
                      {savingBookingId === bid ? "Sending..." : "Send Report To Hospital"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
