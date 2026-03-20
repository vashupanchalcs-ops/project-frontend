import { useState, useEffect } from "react";

export default function Requests() {
  const [bookings, setBookings] = useState([]);
  const [filter,   setFilter]   = useState("all");
  const [toast,    setToast]    = useState(null);

  const load = () => fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json()).then(setBookings).catch(()=>{});
  useEffect(()=>{ load(); const t=setInterval(load,8000); return()=>clearInterval(t); },[]);

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const patch = async (id, status) => {
    try{
      const res = await fetch(`http://127.0.0.1:8000/api/bookings/${id}/`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({status}),
      });
      if(res.ok){ load(); window.dispatchEvent(new Event("new-booking")); showToast(`Booking ${status}!`); }
    }catch{ showToast("Failed to update","error"); }
  };

  const FILTERS = [
    {k:"all",       label:"All"      },
    {k:"pending",   label:"Pending"  },
    {k:"confirmed", label:"Confirmed"},
    {k:"completed", label:"Completed"},
    {k:"cancelled", label:"Cancelled"},
  ];

  const filtered = filter==="all" ? bookings : bookings.filter(b=>b.status===filter);

  const SC = {
    pending:   {c:"#b36800", bg:"rgba(179,104,0,0.09)",  b:"rgba(179,104,0,0.22)" },
    confirmed: {c:"#00875a", bg:"rgba(0,135,90,0.09)",   b:"rgba(0,135,90,0.22)"  },
    completed: {c:"#6e6e73", bg:"rgba(0,0,0,0.05)",      b:"rgba(0,0,0,0.12)"     },
    cancelled: {c:"#E50914", bg:"rgba(229,9,20,0.09)",   b:"rgba(229,9,20,0.22)"  },
  };

  return (
    <>
      <style>{`
        .req-root  { min-height:100vh; background:#f5f5f7; padding-top:60px; padding-left:200px; font-family:'DM Sans',sans-serif; }
        .req-inner { max-width:1280px; margin:0 auto; padding:28px 32px 64px; }

        .req-tag  { display:inline-flex;align-items:center;gap:6px;background:#E50914;color:#fff;border-radius:6px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px; }
        .req-title{ font-size:28px;font-weight:800;color:#0a0a0a;letter-spacing:-.5px;margin:0 0 4px; }
        .req-sub  { font-size:13px;color:#6e6e73;margin:0 0 22px; }

        /* FILTER TABS */
        .req-tabs { display:flex;gap:6px;flex-wrap:wrap;margin-bottom:22px; }
        .req-tab  { font-size:12px;font-weight:700;padding:7px 18px;border-radius:100px;border:1.5px solid rgba(0,0,0,0.1);background:#fff;color:rgba(0,0,0,0.5);cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:6px; }
        .req-tab:hover { border-color:rgba(0,0,0,0.22);color:#0a0a0a; }
        .req-tab.on { background:#E50914;color:#fff;border-color:#E50914;box-shadow:0 4px 14px rgba(229,9,20,0.28); }
        .req-tab-n { font-size:10px;font-weight:800;background:rgba(0,0,0,0.1);border-radius:100px;padding:1px 6px; }
        .req-tab.on .req-tab-n { background:rgba(255,255,255,0.25); }

        /* TABLE CARD */
        .req-card {
          background:#fff; border:1px solid rgba(0,0,0,0.08); border-radius:18px;
          overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);
        }
        .req-table { width:100%; border-collapse:collapse; }
        .req-thead th {
          padding:13px 16px; text-align:left;
          font-size:10px; font-weight:800; color:#a1a1a6;
          text-transform:uppercase; letter-spacing:1.2px;
          background:#f8f8fa; border-bottom:1px solid rgba(0,0,0,0.07);
          white-space:nowrap;
        }
        .req-thead th:first-child { border-radius:18px 0 0 0; }
        .req-thead th:last-child  { border-radius:0 18px 0 0; }

        .req-row { border-bottom:1px solid rgba(0,0,0,0.05); transition:background .14s; }
        .req-row:last-child { border-bottom:none; }
        .req-row:hover { background:rgba(0,0,0,0.018); }
        .req-td { padding:14px 16px; vertical-align:middle; }

        /* Ambulance cell */
        .req-amb-ico { width:32px;height:32px;border-radius:9px;background:rgba(229,9,20,0.07);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0; }
        .req-amb-num { font-size:14px;font-weight:800;color:#0a0a0a;letter-spacing:-.3px;margin-bottom:2px; }
        .req-amb-sub { font-size:11px;color:#a1a1a6; }
        .req-idx     { font-size:12px;font-weight:700;color:#a1a1a6;white-space:nowrap; }

        /* User cell */
        .req-user-name  { font-size:13px;font-weight:700;color:#0a0a0a;margin-bottom:2px; }
        .req-user-email { font-size:11px;color:#a1a1a6;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }

        /* Location cell */
        .req-loc { font-size:12px;color:#3d3d3d;display:flex;align-items:flex-start;gap:4px; }
        .req-loc svg { flex-shrink:0;margin-top:1px; }

        /* Status pill */
        .req-pill { font-size:9px;font-weight:800;padding:4px 11px;border-radius:100px;border:1px solid;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap; }

        /* Time */
        .req-time { font-size:11px;color:#6e6e73;white-space:nowrap; }

        /* Action buttons */
        .req-act-wrap { display:flex;gap:6px;align-items:center; }
        .req-btn {
          font-size:11px;font-weight:700;border:none;border-radius:8px;
          padding:7px 14px;cursor:pointer;font-family:inherit;
          transition:all .15s;white-space:nowrap;
        }
        .req-btn-confirm { background:#0a0a0a;color:#fff; }
        .req-btn-confirm:hover { background:#222; }
        .req-btn-complete { background:#E50914;color:#fff;box-shadow:0 3px 10px rgba(229,9,20,0.22); }
        .req-btn-complete:hover { background:#c8000f; }
        .req-btn-cancel { background:rgba(0,0,0,0.05);color:#6e6e73;border:1px solid rgba(0,0,0,0.1); }
        .req-btn-cancel:hover { background:rgba(0,0,0,0.09);color:#0a0a0a; }

        /* Empty */
        .req-empty { padding:60px 24px;text-align:center; }
        .req-empty-ico { font-size:44px;opacity:.35;margin-bottom:12px; }
        .req-empty-txt { font-size:14px;color:#a1a1a6;font-weight:500; }

        /* Toast */
        .req-toast { position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,0.12);white-space:nowrap; }
        .req-toast-success { background:#0a0a0a;color:#fff; }
        .req-toast-error   { background:#E50914;color:#fff; }

        @media(max-width:1000px) { .req-hide-md { display:none; } }
        @media(max-width:767px)  { .req-root{padding-left:0;padding-bottom:72px;} .req-inner{padding:16px 14px 80px;} .req-card{overflow-x:auto;} .req-hide-sm{display:none;} }
      `}</style>

      {toast&&<div className={`req-toast req-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="req-root">
        <div className="req-inner">

          <div className="req-tag">📋 Management</div>
          <h1 className="req-title">Booking Requests</h1>
          <p className="req-sub">All ambulance booking requests and their status</p>

          {/* FILTER TABS */}
          <div className="req-tabs">
            {FILTERS.map(f=>{
              const cnt = f.k==="all" ? bookings.length : bookings.filter(b=>b.status===f.k).length;
              return(
                <button key={f.k} className={`req-tab ${filter===f.k?"on":""}`} onClick={()=>setFilter(f.k)}>
                  {f.label}<span className="req-tab-n">{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* TABLE */}
          <div className="req-card">
            {filtered.length===0 ? (
              <div className="req-empty">
                <div className="req-empty-ico">📋</div>
                <div className="req-empty-txt">No {filter==="all"?"":filter} bookings found</div>
              </div>
            ) : (
              <table className="req-table">
                <thead className="req-thead">
                  <tr>
                    <th>#</th>
                    <th>Ambulance</th>
                    <th>Booked By</th>
                    <th>Pickup</th>
                    <th className="req-hide-md">Destination</th>
                    <th>Status</th>
                    <th className="req-hide-md">Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b,i)=>{
                    const sc = SC[b.status]||SC.pending;
                    const showConfirm   = b.status==="pending";
                    const showComplete  = b.status==="confirmed";
                    const showCancel    = b.status==="pending"||b.status==="confirmed";
                    return(
                      <tr key={b.id} className="req-row">
                        <td className="req-td"><span className="req-idx">{String(i+1).padStart(2,"0")}</span></td>

                        <td className="req-td">
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div className="req-amb-ico">🚑</div>
                            <div>
                              <div className="req-amb-num">{b.ambulance_number}</div>
                              <div className="req-amb-sub">Driver: {b.driver}</div>
                              <div className="req-amb-sub">{b.driver_contact}</div>
                            </div>
                          </div>
                        </td>

                        <td className="req-td">
                          <div className="req-user-name">{b.booked_by}</div>
                          <div className="req-user-email">{b.booked_by_email}</div>
                        </td>

                        <td className="req-td">
                          <div className="req-loc">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="#E50914" style={{flexShrink:0,marginTop:1}}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                            {b.pickup_location}
                          </div>
                        </td>

                        <td className="req-td req-hide-md" style={{fontSize:12,color:"#3d3d3d"}}>{b.destination||"—"}</td>

                        <td className="req-td">
                          <span className="req-pill" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}>{b.status}</span>
                        </td>

                        <td className="req-td req-hide-md">
                          <div className="req-time">
                            {b.created_at ? new Date(b.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                            <br/>
                            {b.created_at ? new Date(b.created_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) : ""}
                          </div>
                        </td>

                        <td className="req-td">
                          <div className="req-act-wrap">
                            {showConfirm  && <button className="req-btn req-btn-confirm"  onClick={()=>patch(b.id,"confirmed")}>Confirm</button>}
                            {showComplete && <button className="req-btn req-btn-complete" onClick={()=>patch(b.id,"completed")}>Complete</button>}
                            {showCancel   && <button className="req-btn req-btn-cancel"   onClick={()=>patch(b.id,"cancelled")}>Cancel</button>}
                            {!showConfirm&&!showComplete&&!showCancel&&<span style={{fontSize:11,color:"#a1a1a6"}}>—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>
    </>
  );
}