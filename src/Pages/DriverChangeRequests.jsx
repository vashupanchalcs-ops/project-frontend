import { useState, useEffect, useCallback, useMemo } from "react";
import BookingChatPanel from "../components/BookingChatPanel";

export default function DriverChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [toast,    setToast]    = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  const load = useCallback(()=>{
    fetch("http://127.0.0.1:8000/api/ambulances/change-request/")
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
      const res = await fetch("http://127.0.0.1:8000/api/bookings/chat/threads/?role=admin");
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
      const res = await fetch(`http://127.0.0.1:8000/api/ambulances/change-request/${req.id||req.driverEmail}/`, {
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
    await fetch(`http://127.0.0.1:8000/api/bookings/chat/threads/${selectedThread.id}/messages/`, {
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
          background: var(--sr-bg, #f5f5ef);
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
        .dcr-tag   { display:inline-flex;align-items:center;gap:6px;background:#d6e800;color:#111;border:1px solid #c9da00;border-radius:999px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px; }
        .dcr-title { font-size:28px;font-weight:800;color:var(--sr-text,#111);letter-spacing:-.5px;margin:0 0 4px; }
        .dcr-sub   { font-size:13px;color:var(--sr-text-sub, rgba(17,17,17,.7));margin:0; }

        .dcr-refresh {
          display:inline-flex;align-items:center;gap:7px;
          background:#ffffff;border:1px solid rgba(17,17,17,0.12);
          border-radius:10px;padding:9px 18px;
          font-size:13px;font-weight:700;color:var(--sr-text,#111);
          cursor:pointer;font-family:inherit;transition:all .15s;
        }
        .dcr-refresh:hover { background:#f3f4dd;border-color:rgba(214,232,0,0.75); }

        .dcr-sec-title { font-size:16px;font-weight:800;color:var(--sr-text,#111);margin-bottom:14px;letter-spacing:-.3px; }

        .dcr-chat-wrap {
          margin-bottom: 0;
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 16px;
          background: #fff;
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
          border:1px solid rgba(17,17,17,0.12);
          border-radius:12px;
          padding:10px;
          background:#fff;
          overflow:auto;
        }
        .dcr-thread-list {
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 12px;
          padding: 8px;
          max-height: 520px;
          overflow: auto;
          background: #fcfdf3;
        }
        .dcr-thread-item {
          width: 100%;
          text-align: left;
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 10px;
          background: #fff;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all .15s ease;
        }
        .dcr-thread-item.active {
          background: #d6e800;
          border-color: #c7d800;
        }
        .dcr-thread-item:hover {
          border-color: rgba(214,232,0,0.8);
        }
        .dcr-thread-item b { font-size: 13px; color: #111; }
        .dcr-thread-item div { font-size: 11px; color: rgba(17,17,17,.72); margin-top: 2px; }

        /* REQUEST CARD */
        .dcr-card {
          background:#ffffff;
          border:1px solid rgba(17,17,17,0.14); border-radius:16px;
          padding:20px 22px; margin-bottom:12px;
          box-shadow:0 14px 30px rgba(0,0,0,.35);
          transition:border-color .2s, box-shadow .2s, transform .2s;
        }
        .dcr-card:hover { border-color: rgba(214,232,0,0.9); box-shadow:0 12px 24px rgba(214,232,0,0.22); transform: translateY(-2px); }
        .dcr-card.pending-card { border-left:4px solid rgba(214,232,0,0.82); }

        .dcr-card-top { display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px; }
        .dcr-driver-row { display:flex;align-items:center;gap:10px; }
        .dcr-driver-av  { width:38px;height:38px;border-radius:10px;background:#d6e800;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#111;flex-shrink:0; }
        .dcr-driver-name{ font-size:14px;font-weight:800;color:var(--sr-text,#111); }
        .dcr-driver-mail{ font-size:11px;color:var(--sr-text-muted, rgba(17,17,17,.55));margin-top:2px; }
        .dcr-driver-ph  { font-size:11px;color:var(--sr-text-sub, rgba(17,17,17,.72));margin-top:1px; }

        .dcr-status-pill { font-size:10px;font-weight:800;padding:4px 14px;border-radius:100px;border:1.5px solid;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0; }

        /* Ambulance change row */
        .dcr-change-row { display:flex;align-items:center;gap:12px;background:#f7f8e8;border-radius:12px;padding:14px 16px;margin-bottom:14px; }
        .dcr-amb-box { flex:1;background:#fff;border:1px solid rgba(17,17,17,0.14);border-radius:10px;padding:12px 14px; }
        .dcr-amb-box-lbl { font-size:9px;font-weight:800;color:var(--sr-text-muted, rgba(17,17,17,.55));text-transform:uppercase;letter-spacing:1px;margin-bottom:4px; }
        .dcr-amb-num     { font-size:16px;font-weight:800;color:var(--sr-text,#111); }
        .dcr-arrow { font-size:20px;color:var(--sr-text-muted, rgba(17,17,17,.5));flex-shrink:0; }

        .dcr-meta { display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px; }
        .dcr-meta-item { font-size:11px;color:var(--sr-text-sub, rgba(17,17,17,.72)); }
        .dcr-meta-item b { color:var(--sr-text,#111); }

        .dcr-actions { display:flex;gap:8px;flex-wrap:wrap; }
        .dcr-btn { font-size:12px;font-weight:700;border:none;border-radius:9px;padding:9px 20px;cursor:pointer;font-family:inherit;transition:all .15s; }
        .dcr-btn-approve { background:#d6e800;color:#111;border:1px solid #c7d800; }
        .dcr-btn-approve:hover { filter:brightness(1.04); }
        .dcr-btn-reject  { background:#fff;color:#111;border:1.5px solid rgba(17,17,17,0.18); }
        .dcr-btn-reject:hover { background:#f4f4e8; }
        .dcr-btn-delete  { background:#fff;color:var(--sr-text-sub, rgba(17,17,17,.72));border:1.5px solid rgba(17,17,17,0.16); }
        .dcr-btn-delete:hover { background:#f3f4dd;color:#111;border-color:rgba(214,232,0,0.72); }

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
      `}</style>

      {toast&&<div className={`dcr-toast dcr-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="dcr-root">
        <div className="dcr-inner">

          <div className="dcr-top">
            <div>
              <div className="dcr-tag">🔄 Requests</div>
              <h1 className="dcr-title">Driver Requests Management</h1>
              <p className="dcr-sub">Review and approve ambulance reassignment requests</p>
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
                messageTarget="driver"
                visibleTargets={["all", "driver", "admin"]}
                allowedSenderRoles={["system", "admin", "driver"]}
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

          {/* PENDING */}
          {pending.length>0 && (
            <div style={{marginBottom:28}}>
              <div className="dcr-sec-title">
                ⏳ Pending
                <span style={{marginLeft:8,fontSize:12,fontWeight:700,background:"#eef2b2",color:"#111",border:"1px solid rgba(214,232,0,0.75)",borderRadius:100,padding:"2px 10px"}}>{pending.length}</span>
              </div>
              {pending.map((req,i)=>(
                <div key={i} className="dcr-card pending-card">
                  <div className="dcr-card-top">
                    <div className="dcr-driver-row">
                      <div className="dcr-driver-av">{req.driverName?.[0]?.toUpperCase()||"D"}</div>
                      <div>
                        <div className="dcr-driver-name">{req.driverName||"Driver"}</div>
                        <div className="dcr-driver-mail">{req.driverEmail}</div>
                        {req.driverPhone&&<div className="dcr-driver-ph">📞 {req.driverPhone}</div>}
                      </div>
                    </div>
                    <span className="dcr-status-pill" style={{color:"#b36800",background:"rgba(179,104,0,0.09)",borderColor:"rgba(179,104,0,0.22)"}}>Pending</span>
                  </div>

                  <div className="dcr-change-row">
                    <div className="dcr-amb-box">
                      <div className="dcr-amb-box-lbl">Current</div>
                      <div className="dcr-amb-num">🚑 {req.currentAmbNumber||req.currentAmbId||"—"}</div>
                    </div>
                    <div className="dcr-arrow">→</div>
                    <div className="dcr-amb-box">
                      <div className="dcr-amb-box-lbl">Requested</div>
                      <div className="dcr-amb-num" style={{color:"#111"}}>🚑 {req.newAmbNumber||req.newAmbId||"—"}</div>
                    </div>
                  </div>

                  <div className="dcr-meta">
                    {req.timestamp&&<div className="dcr-meta-item">🕐 <b>{new Date(req.timestamp).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</b></div>}
                  </div>

                  <div className="dcr-actions">
                    <button className="dcr-btn dcr-btn-approve" onClick={()=>respond(req,"approved")}>✅ Approve</button>
                    <button className="dcr-btn dcr-btn-reject"  onClick={()=>respond(req,"rejected")}>❌ Reject</button>
                    <button className="dcr-btn dcr-btn-delete"  onClick={()=>deleteRequest(req)}>🗑 Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PROCESSED */}
          {processed.length>0&&(
            <div>
              <div className="dcr-sec-title">Processed</div>
              {processed.map((req,i)=>{
                const sc = req.status==="approved"
                  ? {c:"#00875a",bg:"rgba(0,135,90,0.09)",b:"rgba(0,135,90,0.22)"}
                  : {c:"#E50914",bg:"rgba(229,9,20,0.09)",b:"rgba(229,9,20,0.22)"};
                return(
                  <div key={i} className="dcr-card" style={{opacity:.75}}>
                    <div className="dcr-card-top">
                      <div className="dcr-driver-row">
                        <div className="dcr-driver-av" style={{background:"#a1a1a6"}}>{req.driverName?.[0]?.toUpperCase()||"D"}</div>
                        <div>
                          <div className="dcr-driver-name">{req.driverName||"Driver"}</div>
                          <div className="dcr-driver-mail">{req.driverEmail}</div>
                        </div>
                      </div>
                      <span className="dcr-status-pill" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}>
                        {req.status==="approved"?"✅ Approved":"❌ Rejected"}
                      </span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
                      <div style={{fontSize:12,color:"var(--sr-text-sub, rgba(17,17,17,.72))"}}>
                        {req.currentAmbNumber||req.currentAmbId} → <b style={{color:"var(--sr-text,#111)"}}>{req.newAmbNumber||req.newAmbId}</b>
                      </div>
                      <button className="dcr-btn dcr-btn-delete" style={{padding:"5px 14px",fontSize:11}} onClick={()=>deleteRequest(req)}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
