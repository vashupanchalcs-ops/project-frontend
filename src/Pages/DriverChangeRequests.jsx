import { useState, useEffect, useCallback } from "react";

export default function DriverChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [toast,    setToast]    = useState(null);

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

  const pending   = requests.filter(r=>r.status==="pending");
  const processed = requests.filter(r=>r.status!=="pending");

  return(
    <>
      <style>{`
        .dcr-root  { min-height:100vh; background:#f5f5f7; padding-top:60px; padding-left:200px; font-family:'DM Sans',sans-serif; }
        .dcr-inner { max-width:1000px; margin:0 auto; padding:28px 32px 64px; }

        .dcr-top   { display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:28px; }
        .dcr-tag   { display:inline-flex;align-items:center;gap:6px;background:#E50914;color:#fff;border-radius:6px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px; }
        .dcr-title { font-size:28px;font-weight:800;color:#0a0a0a;letter-spacing:-.5px;margin:0 0 4px; }
        .dcr-sub   { font-size:13px;color:#6e6e73;margin:0; }

        .dcr-refresh {
          display:inline-flex;align-items:center;gap:7px;
          background:#fff;border:1.5px solid rgba(0,0,0,0.1);
          border-radius:10px;padding:9px 18px;
          font-size:13px;font-weight:700;color:#3d3d3d;
          cursor:pointer;font-family:inherit;transition:all .15s;
        }
        .dcr-refresh:hover { background:#f0f0f2;border-color:rgba(0,0,0,0.18); }

        .dcr-sec-title { font-size:16px;font-weight:800;color:#0a0a0a;margin-bottom:14px;letter-spacing:-.3px; }

        /* REQUEST CARD */
        .dcr-card {
          background:#fff; border:1px solid rgba(0,0,0,0.08); border-radius:16px;
          padding:20px 22px; margin-bottom:12px;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);
          transition:box-shadow .18s;
        }
        .dcr-card:hover { box-shadow:0 4px 16px rgba(0,0,0,0.09); }
        .dcr-card.pending-card { border-left:3px solid #E50914; }

        .dcr-card-top { display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px; }
        .dcr-driver-row { display:flex;align-items:center;gap:10px; }
        .dcr-driver-av  { width:38px;height:38px;border-radius:10px;background:#E50914;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0; }
        .dcr-driver-name{ font-size:14px;font-weight:800;color:#0a0a0a; }
        .dcr-driver-mail{ font-size:11px;color:#a1a1a6;margin-top:2px; }
        .dcr-driver-ph  { font-size:11px;color:#6e6e73;margin-top:1px; }

        .dcr-status-pill { font-size:10px;font-weight:800;padding:4px 14px;border-radius:100px;border:1.5px solid;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0; }

        /* Ambulance change row */
        .dcr-change-row { display:flex;align-items:center;gap:12px;background:#f8f8fa;border-radius:12px;padding:14px 16px;margin-bottom:14px; }
        .dcr-amb-box { flex:1;background:#fff;border:1px solid rgba(0,0,0,0.09);border-radius:10px;padding:12px 14px; }
        .dcr-amb-box-lbl { font-size:9px;font-weight:800;color:#a1a1a6;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px; }
        .dcr-amb-num     { font-size:16px;font-weight:800;color:#0a0a0a; }
        .dcr-arrow { font-size:20px;color:#a1a1a6;flex-shrink:0; }

        .dcr-meta { display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px; }
        .dcr-meta-item { font-size:11px;color:#6e6e73; }
        .dcr-meta-item b { color:#0a0a0a; }

        .dcr-actions { display:flex;gap:8px;flex-wrap:wrap; }
        .dcr-btn { font-size:12px;font-weight:700;border:none;border-radius:9px;padding:9px 20px;cursor:pointer;font-family:inherit;transition:all .15s; }
        .dcr-btn-approve { background:#0a0a0a;color:#fff; }
        .dcr-btn-approve:hover { background:#222; }
        .dcr-btn-reject  { background:rgba(229,9,20,0.08);color:#E50914;border:1.5px solid rgba(229,9,20,0.22); }
        .dcr-btn-reject:hover { background:rgba(229,9,20,0.14); }
        .dcr-btn-delete  { background:rgba(0,0,0,0.05);color:#6e6e73;border:1.5px solid rgba(0,0,0,0.1); }
        .dcr-btn-delete:hover { background:rgba(229,9,20,0.07);color:#E50914;border-color:rgba(229,9,20,0.22); }

        /* Empty */
        .dcr-empty { padding:60px 24px;text-align:center; }
        .dcr-empty-ico { font-size:44px;opacity:.35;margin-bottom:12px; }
        .dcr-empty-txt { font-size:14px;color:#a1a1a6; }

        /* Toast */
        .dcr-toast { position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,0.12);white-space:nowrap; }
        .dcr-toast-success { background:#0a0a0a;color:#fff; }
        .dcr-toast-error   { background:#E50914;color:#fff; }

        @media(max-width:767px){ .dcr-root{padding-left:0;padding-bottom:72px;} .dcr-inner{padding:16px 14px 80px;} }
      `}</style>

      {toast&&<div className={`dcr-toast dcr-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="dcr-root">
        <div className="dcr-inner">

          <div className="dcr-top">
            <div>
              <div className="dcr-tag">🔄 Requests</div>
              <h1 className="dcr-title">Driver Change Requests</h1>
              <p className="dcr-sub">Review and approve ambulance reassignment requests</p>
            </div>
            <button className="dcr-refresh" onClick={load}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
          </div>

          {/* PENDING */}
          {pending.length>0 && (
            <div style={{marginBottom:28}}>
              <div className="dcr-sec-title">
                ⏳ Pending
                <span style={{marginLeft:8,fontSize:12,fontWeight:700,background:"rgba(229,9,20,0.09)",color:"#E50914",border:"1px solid rgba(229,9,20,0.2)",borderRadius:100,padding:"2px 10px"}}>{pending.length}</span>
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
                      <div className="dcr-amb-num" style={{color:"#E50914"}}>🚑 {req.newAmbNumber||req.newAmbId||"—"}</div>
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
                      <div style={{fontSize:12,color:"#6e6e73"}}>
                        {req.currentAmbNumber||req.currentAmbId} → <b style={{color:"#0a0a0a"}}>{req.newAmbNumber||req.newAmbId}</b>
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

          {/* EMPTY */}
          {requests.length===0&&(
            <div className="dcr-empty">
              <div className="dcr-empty-ico">📬</div>
              <div className="dcr-empty-txt">No change requests yet</div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
