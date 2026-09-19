import { useState, useEffect, useCallback, useMemo } from "react";
import BookingChatPanel from "../Components/BookingChatPanel";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

export default function DriverChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [toast,    setToast]    = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  const load = useCallback(()=>{
    fetch(`${BASE}/api/ambulances/change-request/`)
      .then(r=>r.json()).then(data=>{
        setRequests(Array.isArray(data)?data:[]);
        localStorage.setItem("all_change_requests",JSON.stringify(Array.isArray(data)?data:[]));
      }).catch(()=>{
        const stored = JSON.parse(localStorage.getItem("all_change_requests")||"[]");
        setRequests(stored);
      });
  },[]);

  useEffect(()=>{ load(); },[load]);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/chat/threads/?role=admin`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const driverScoped = rows.filter((t) => (t?.driver_name || t?.booking?.driver_name || "").trim().length > 0);
      setThreads(driverScoped);
      if (!selectedThreadId && driverScoped[0]?.id) setSelectedThreadId(driverScoped[0].id);
    } catch {}
  }, [selectedThreadId]);

  useEffect(() => {
    loadThreads();
    const t = setInterval(loadThreads, 4500);
    return () => clearInterval(t);
  }, [loadThreads]);

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const respond = async (req, status) => {
    try{
      const res = await fetch(`${BASE}/api/ambulances/change-request/${req.id||req.driverEmail}/`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({status}),
      });
      if(res.ok){ load(); showToast(`Request ${status}!`); }
      else{ load(); showToast(`Request ${status}!`); }
    }catch{
      const stored = JSON.parse(localStorage.getItem("all_change_requests")||"[]");
      const updated = stored.map(r=>(r.driverEmail===req.driverEmail&&r.timestamp===req.timestamp)?{...r,status}:r);
      localStorage.setItem("all_change_requests",JSON.stringify(updated));
      setRequests(updated); showToast(`Request ${status}!`);
    }
  };

  const deleteRequest = (req) => {
    const stored = JSON.parse(localStorage.getItem("all_change_requests") || "[]");
    const updated = stored.filter(
      (r) => !((r.driverEmail === req.driverEmail) && (r.timestamp === req.timestamp))
    );
    localStorage.setItem("all_change_requests", JSON.stringify(updated));
    setRequests(updated);
    showToast("Request deleted");
  };

  const pending   = requests.filter(r=>r.status==="pending");
  const processed = requests.filter(r=>r.status!=="pending");

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || threads[0] || null,
    [threads, selectedThreadId]
  );

  const quickSendDriverUpdate = async (text) => {
    if (!selectedThread?.id) return;
    await fetch(`${BASE}/api/bookings/chat/threads/${selectedThread.id}/messages/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_role: "admin",
        sender_name: localStorage.getItem("name") || "Admin",
        message_type: "update",
        message: text,
        target_role: "driver",
      }),
    }).catch(() => {});
    loadThreads();
  };

  return(
    <>
      <style>{`
        .dcr-root  {
          height:100vh;
          width: calc(100vw - 64px);
          background: var(--sr-bg, #ffffff);
          padding-top:64px;
          padding-left:64px;
          font-family:'DM Sans',sans-serif;
          color: var(--sr-page-text, #111);
          overflow: hidden;
        }
        .dcr-inner {
          width:100%;
          max-width:none;
          margin:0;
          padding:18px clamp(16px,2.2vw,32px) 18px;
          height: calc(100vh - 64px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dcr-top   { display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:4px; }
        .dcr-tag   { display:inline-flex;align-items:center;gap:6px;background:#ffffff;color:#ffffff;border:1px solid #ffffff;border-radius:999px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px; }
        .dcr-title { font-size:28px;font-weight:800;color:var(--sr-text,#111);letter-spacing:-.5px;margin:0 0 4px; }
        .dcr-sub   { font-size:13px;color:var(--sr-text-sub, rgba(17,17,17,.7));margin:0; }

        .dcr-refresh {
          display:inline-flex;align-items:center;gap:7px;
          background:#ffffff;border:1px solid #cccccc;
          border-radius:10px;padding:9px 18px;
          font-size:13px;font-weight:700;color:#111;
          cursor:pointer;font-family:inherit;transition:all .15s;
        }
        .dcr-refresh:hover { background:#f5f5f5;border-color:#ffffff; }

        .dcr-sec-title { font-size:16px;font-weight:800;color:var(--sr-text,#111);margin-bottom:14px;letter-spacing:-.3px; }

        .dcr-chat-wrap {
          margin-bottom: 0;
          border: 1px solid #e0e0e0;
          border-top: 3.5px solid #ffffff;
          border-radius: 12px;
          background: #ffffff;
          padding: 12px;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .dcr-chat-grid {
          display: grid;
          grid-template-columns: 320px 1fr 280px;
          gap: 12px;
          align-items: stretch;
          height: 100%;
          min-height: 0;
        }
        .dcr-chat-right{
          border:1px solid #e0e0e0;
          border-radius:10px;
          padding:10px;
          background:#ffffff;
          overflow:auto;
        }
        .dcr-thread-list {
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          padding: 8px;
          max-height: 520px;
          overflow: auto;
          background: #ffffff;
        }
        .dcr-thread-item {
          width: 100%;
          text-align: left;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: #ffffff;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: none;
        }
        .dcr-thread-item.active {
          background: #ffffff;
          border: 1px solid #ffffff;
          border-top: 3.5px solid #ffffff;
        }
        .dcr-thread-item:hover {
          border-color: #ffffff;
        }
        .dcr-thread-item b { font-size: 13px; color: #111; }
        .dcr-thread-item div { font-size: 11px; color: #555555; margin-top: 2px; }

        /* REQUEST CARD */
        .dcr-card {
          background:#ffffff;
          border:1px solid #e0e0e0;
          border-top:3.5px solid #ffffff;
          border-radius:12px;
          padding:20px 22px; margin-bottom:12px;
          box-shadow:0 4px 14px rgba(0,0,0,.05);
          transition:none;
        }
        .dcr-card:hover { border-color: #cccccc; border-top-color: #ffffff; box-shadow:0 4px 14px rgba(0,0,0,.05); transform: none; }
        .dcr-card.pending-card { border-left:4px solid #ffffff; }

        .dcr-card-top { display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px; }
        .dcr-driver-row { display:flex;align-items:center;gap:10px; }
        .dcr-driver-av  { width:38px;height:38px;border-radius:10px;background:#ffffff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#ffffff;flex-shrink:0; }
        .dcr-driver-name{ font-size:14px;font-weight:800;color:#111; }
        .dcr-driver-mail{ font-size:11px;color:#555555;margin-top:2px; }
        .dcr-driver-ph  { font-size:11px;color:#555555;margin-top:1px; }

        .dcr-status-pill { font-size:10px;font-weight:800;padding:4px 14px;border-radius:100px;border:1.5px solid;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0; }

        /* Ambulance change row */
        .dcr-change-row { display:flex;align-items:center;gap:12px;background:#fafafa;border:1px solid #e0e0e0;border-radius:10px;padding:14px 16px;margin-bottom:14px; }
        .dcr-amb-box { flex:1;background:#ffffff;border:1px solid #cccccc;border-radius:8px;padding:12px 14px; }
        .dcr-amb-box-lbl { font-size:9px;font-weight:800;color:#555555;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px; }
        .dcr-amb-num     { font-size:16px;font-weight:800;color:#111; }
        .dcr-arrow { font-size:20px;color:#555555;flex-shrink:0; }

        .dcr-meta { display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px; }
        .dcr-meta-item { font-size:11px;color:#555555; }
        .dcr-meta-item b { color:#111; }

        .dcr-actions { display:flex;gap:8px;flex-wrap:wrap; }
        .dcr-btn { font-size:12px;font-weight:700;border:none;border-radius:9px;padding:9px 20px;cursor:pointer;font-family:inherit;transition:all .15s; }
        .dcr-btn-approve { background:#ffffff;color:#ffffff;border:1px solid #ffffff; }
        .dcr-btn-approve:hover { background:#ffffff;border-color:#ffffff; }
        .dcr-btn-reject  { background:#ffffff;color:#111;border:1.5px solid #cccccc; }
        .dcr-btn-reject:hover { background:#f5f5f5; }
        .dcr-btn-delete  { background:#ffffff;color:#555555;border:1.5px solid #cccccc; }
        .dcr-btn-delete:hover { background:#f5f5f5;color:#ffffff;border-color:#ffffff; }

        /* Empty */
        .dcr-empty { padding:60px 24px;text-align:center; }
        .dcr-empty-ico { font-size:44px;opacity:.35;margin-bottom:12px; }
        .dcr-empty-txt { font-size:14px;color:var(--sr-text-muted, rgba(17,17,17,.58)); }

        /* Toast */
        .dcr-toast { position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,0.12);white-space:nowrap; }
        .dcr-toast-success { background:#111;color:#fff; }
        .dcr-toast-error   { background:#444;color:#fff; }

        @media(max-width:1024px){
          .dcr-chat-grid { grid-template-columns: 1fr; }
          .dcr-thread-list { max-height: 190px; }
        }

        @media(max-width:767px){
          .dcr-root{padding-left:0;padding-bottom:72px;width:100vw;overflow:auto;}
          .dcr-inner{padding:12px 12px 12px;height:calc(100vh - 64px);overflow:auto;}
          .dcr-title{font-size:22px;}
          .dcr-chat-wrap{padding:10px;min-height:72vh;}
          .dcr-thread-list{max-height:180px;}
        }

        /* Selected driver request/chat cards use yellow instead of the legacy red. */
        html body #root#root .dcr-thread-item.active,
        html body #root#root .dcr-thread-item.active:hover {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          border-top-color: #f59a23 !important;
        }
        html body #root#root .dcr-thread-item:hover { background: #fff3df !important; border-color: #f59a23 !important; }
        html body #root#root .dcr-btn-approve,
        html body #root#root .dcr-btn-approve:hover {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
      `}</style>

      {toast&&<div className={`dcr-toast dcr-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="dcr-root">
        <div className="dcr-inner">

          <div className="dcr-top">
            <div>
              <div className="dcr-tag">🤖 AI Support Console</div>
              <h1 className="dcr-title">Driver Support & AI Chat</h1>
              <p className="dcr-sub">Real-time driver AI assistance, navigation updates, and dispatch guidance</p>
            </div>
            <button className="dcr-refresh" onClick={load}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
          </div>

          <div className="dcr-chat-wrap">
            <div className="dcr-sec-title" style={{ marginBottom: 10 }}>
              Driver Support AI Chat + Voice Assistant
            </div>
            <div className="dcr-chat-grid">
              <div className="dcr-thread-list">
                {threads.length === 0 && (
                  <div style={{ fontSize: 12, color: "rgba(17,17,17,.62)", padding: 8 }}>
                    No driver chat threads yet.
                  </div>
                )}
                {threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`dcr-thread-item ${selectedThreadId === t.id ? "active" : ""}`}
                  >
                    <b>Booking #{t.booking_id} · {t.driver_name || "Driver"}</b>
                    <div>{t.booking?.pickup_location || "-"} → {t.booking?.assigned_hospital_name || t.booking?.destination || "hospital pending"}</div>
                    <div>Unread (admin): {t?.unread?.admin || 0}</div>
                  </button>
                ))}
              </div>
              <BookingChatPanel
                role="admin"
                thread={selectedThread}
                compact
                messageTarget="all"
                visibleTargets={["all", "driver", "admin", "user"]}
                allowedSenderRoles={["system", "admin", "driver", "user"]}
                title={selectedThread ? `Booking #${selectedThread.booking_id} · Driver Update Channel` : "Select driver booking thread"}
                onMessagesChange={setChatMessages}
                extraActions={
                  <div style={{ display: "flex", gap: 8, width: "100%", flexWrap: "wrap" }}>
                    <button className="chat-btn" onClick={() => quickSendDriverUpdate("Driver update: Route reviewed. Continue current corridor and avoid congestion zone.")}>
                      Route Update
                    </button>
                    <button className="chat-btn" onClick={() => quickSendDriverUpdate("Driver update: Hospital desk confirmed. Proceed to assigned hospital intake gate.")}>
                      Hospital Desk Update
                    </button>
                    <button className="chat-btn" onClick={() => quickSendDriverUpdate("Driver update: Control room monitoring active. If issue persists, send escalation with latest location.")}>
                      Escalation Guidance
                    </button>
                  </div>
                }
              />
              <div className="dcr-chat-right">
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Driver Alerts</div>
                {chatMessages.slice(-10).reverse().map((m) => (
                  <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{m.sender_name || m.sender_role}</div>
                    <div style={{ fontSize: 12, color: "rgba(17,17,17,.68)" }}>{String(m.message || "").slice(0, 80)}</div>
                  </div>
                ))}
                {chatMessages.length === 0 ? <div style={{ fontSize: 12, color: "rgba(17,17,17,.6)" }}>No updates yet.</div> : null}
              </div>
            </div>
          </div>

          
        </div>
      </div>
    </>
  );
}
