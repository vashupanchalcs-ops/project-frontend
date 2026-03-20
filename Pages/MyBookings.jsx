import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const BASE = "http://127.0.0.1:8000";

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter,   setFilter]   = useState("all");
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  const email = localStorage.getItem("user") || "";
  const name  = localStorage.getItem("name") || "";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`${BASE}/api/bookings/`);
        const data = await res.json();
        const mine = data.filter(b =>
          b.booked_by_email === email ||
          b.user_email      === email ||
          b.booked_by       === name
        ).sort((a, b) => b.id - a.id);
        setBookings(mine);
      } catch {}
      setLoading(false);
    };
    load();
    const t = setInterval(load, 10000);
    window.addEventListener("new-booking", load);
    return () => { clearInterval(t); window.removeEventListener("new-booking", load); };
  }, [email, name]);

  const FILTERS = [
    { k:"all",       label:"All"       },
    { k:"confirmed", label:"Confirmed" },
    { k:"pending",   label:"Pending"   },
    { k:"completed", label:"Completed" },
    { k:"cancelled", label:"Cancelled" },
  ];

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  const total     = bookings.length;
  const active    = bookings.filter(b => ["pending","confirmed"].includes(b.status)).length;
  const completed = bookings.filter(b => b.status === "completed").length;

  const SC = {
    confirmed: { c:"#00875a", bg:"rgba(0,135,90,0.09)",  b:"rgba(0,135,90,0.22)"  },
    pending:   { c:"#b36800", bg:"rgba(179,104,0,0.09)", b:"rgba(179,104,0,0.22)" },
    completed: { c:"#6e6e73", bg:"rgba(0,0,0,0.05)",     b:"rgba(0,0,0,0.12)"     },
    cancelled: { c:"#E50914", bg:"rgba(229,9,20,0.09)",  b:"rgba(229,9,20,0.22)"  },
  };

  // Navigate to directions page with booking data for live tracking
  const handleLiveTrack = (b) => {
    navigate("/directions", {
      state: {
        tracking: true,
        bookingId:        b.id,
        ambulanceNumber:  b.ambulance_number,
        driver:           b.driver,
        driverContact:    b.driver_contact,
        pickupLocation:   b.pickup_location,
        destination:      b.destination,
        ambulanceId:      b.ambulance_id,
        status:           b.status,
      }
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');

        .mb-root {
          min-height: 100vh;
          background: #f5f5f7;
          padding-top: 60px;
          padding-left: 200px;
          font-family: 'DM Sans', sans-serif;
          color: #0a0a0a;
        }
        .mb-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 16px 64px;
        }

        /* PAGE HEADER */
        .mb-hdr { margin-bottom: 22px; }
        .mb-tag { display:inline-flex;align-items:center;gap:6px;background:#E50914;color:#fff;border-radius:6px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px; }
        .mb-h1  { font-size:26px;font-weight:800;color:#0a0a0a;letter-spacing:-.5px;margin:0 0 3px; }
        .mb-sub { font-size:13px;color:#6e6e73;margin:0; }

        /* SUMMARY CARDS - 3 horizontal */
        .mb-summary { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px; }
        .mb-sum-card {
          background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:14px;
          padding:16px 20px;position:relative;overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,0.05);
        }
        .mb-sum-bar { position:absolute;top:0;left:0;right:0;height:3px;background:#E50914;border-radius:14px 14px 0 0; }
        .mb-sum-val { font-size:28px;font-weight:800;color:#0a0a0a;letter-spacing:-1px;line-height:1;margin-bottom:4px; }
        .mb-sum-lbl { font-size:10px;font-weight:700;color:#a1a1a6;text-transform:uppercase;letter-spacing:1px; }

        /* FILTER TABS */
        .mb-tabs { display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px; }
        .mb-tab  { font-size:12px;font-weight:700;padding:7px 18px;border-radius:100px;border:1.5px solid rgba(0,0,0,0.1);background:#fff;color:rgba(0,0,0,0.5);cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:5px; }
        .mb-tab:hover { border-color:rgba(0,0,0,0.2);color:#0a0a0a; }
        .mb-tab.on { background:#E50914;color:#fff;border-color:#E50914;box-shadow:0 4px 14px rgba(229,9,20,0.28); }
        .mb-tab-n  { font-size:10px;font-weight:800;background:rgba(0,0,0,0.1);border-radius:100px;padding:1px 6px; }
        .mb-tab.on .mb-tab-n { background:rgba(255,255,255,0.25); }

        /* BOOKING CARD - wide, compact height */
        .mb-card {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px;
          padding: 0;
          margin-bottom: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
          overflow: hidden;
          transition: box-shadow .18s, transform .18s;
        }
        .mb-card:hover { box-shadow:0 6px 24px rgba(0,0,0,0.09);transform:translateY(-1px); }

        /* Card top row */
        .mb-card-top {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 12px 16px 10px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          gap: 12px; flex-wrap: wrap;
        }
        .mb-card-booking-id { font-size:15px;font-weight:800;color:#0a0a0a;letter-spacing:-.3px; }
        .mb-card-booking-id span { color:#E50914; }
        .mb-card-pill {
          font-size:9px;font-weight:800;padding:4px 12px;border-radius:100px;border:1.5px solid;
          text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:5px;
          flex-shrink:0;
        }
        .mb-pill-dot { width:5px;height:5px;border-radius:50%; }

        /* Card body - 4 columns in one row (compact) */
        .mb-card-body {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 0;
          padding: 0;
        }
        .mb-card-col {
          padding: 12px 16px 14px;
          border-right: 1px solid rgba(0,0,0,0.05);
        }
        .mb-card-col:last-child { border-right: none; }
        .mb-col-lbl { font-size:9px;font-weight:800;color:#a1a1a6;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;display:flex;align-items:center;gap:4px; }
        .mb-col-val { font-size:13px;font-weight:700;color:#0a0a0a;line-height:1.3; }
        .mb-col-val-sub { font-size:11px;color:#6e6e73;margin-top:2px; }

        /* Ambulance highlighted column */
        .mb-card-amb {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px 14px;
          background: rgba(229,9,20,0.03);
          border-right: 1px solid rgba(0,0,0,0.05);
        }
        .mb-amb-ico { width:36px;height:36px;border-radius:9px;background:rgba(229,9,20,0.09);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0; }
        .mb-amb-num { font-size:14px;font-weight:800;color:#0a0a0a;letter-spacing:-.3px; }
        .mb-amb-lbl { font-size:9px;font-weight:700;color:#a1a1a6;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px; }

        /* Card footer - action buttons */
        .mb-card-ft {
          padding: 9px 16px;
          background: #f8f8fa;
          border-top: 1px solid rgba(0,0,0,0.06);
          display: flex; align-items: center;
          gap: 8px; flex-wrap: wrap;
        }
        .mb-btn-track {
          display:flex;align-items:center;gap:7px;
          background:#0a0a0a; color:#fff;
          border:none;border-radius:9px;padding:8px 18px;
          font-size:12px;font-weight:700;font-family:inherit;
          cursor:pointer;transition:background .15s;
        }
        .mb-btn-track:hover { background:#222; }
        .mb-btn-book {
          display:flex;align-items:center;gap:7px;
          background:#E50914;color:#fff;
          border:none;border-radius:9px;padding:8px 18px;
          font-size:12px;font-weight:700;font-family:inherit;
          cursor:pointer;box-shadow:0 3px 10px rgba(229,9,20,0.22);
          transition:background .15s;
        }
        .mb-btn-book:hover { background:#c8000f; }
        .mb-ft-meta { margin-left:auto;font-size:11px;color:#a1a1a6; }

        /* Empty state */
        .mb-empty { padding:60px 24px;text-align:center; }
        .mb-empty-ico { font-size:48px;opacity:.3;margin-bottom:12px; }
        .mb-empty-txt { font-size:15px;color:#a1a1a6;font-weight:600;margin-bottom:16px; }
        .mb-empty-btn { display:inline-flex;align-items:center;gap:7px;background:#E50914;color:#fff;border:none;border-radius:10px;padding:11px 24px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(229,9,20,0.28);transition:background .15s; }
        .mb-empty-btn:hover { background:#c8000f; }

        /* Loading */
        .mb-loading { display:flex;align-items:center;justify-content:center;padding:60px;gap:10px;color:#a1a1a6;font-size:14px; }
        @keyframes mb-spin { to{transform:rotate(360deg)} }
        .mb-spin { width:20px;height:20px;border-radius:50%;border:2.5px solid rgba(229,9,20,0.2);border-top-color:#E50914;animation:mb-spin .8s linear infinite; }

        /* Live badge */
        @keyframes mb-blink { 0%,100%{opacity:1}50%{opacity:.2} }
        .mb-live-dot { display:inline-block;width:6px;height:6px;border-radius:50%;background:#E50914;animation:mb-blink 1.5s infinite; }

        @media(max-width:900px) { .mb-inner{padding:18px 16px 80px;} }
        @media(max-width:767px) {
          .mb-root { padding-left:0; padding-bottom:72px; }
          .mb-inner { padding:16px 14px 80px; }
          .mb-summary { grid-template-columns:repeat(3,1fr); gap:8px; }
          .mb-card-body { grid-template-columns:1fr 1fr; }
          .mb-card-col:nth-child(2) { border-right:none; }
          .mb-card-amb { grid-column:1/-1; border-right:none;border-bottom:1px solid rgba(0,0,0,0.05); }
        }
        @media(max-width:480px) {
          .mb-summary { grid-template-columns:repeat(3,1fr); gap:6px; }
          .mb-sum-val { font-size:22px; }
          .mb-card-body { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div className="mb-root">
        <div className="mb-inner">

          {/* HEADER */}
          <div className="mb-hdr">
            <div className="mb-tag">🚑 My Bookings</div>
            <h1 className="mb-h1">Booking History</h1>
            <p className="mb-sub">All your ambulance bookings in one place</p>
          </div>

          {/* SUMMARY */}
          <div className="mb-summary">
            {[
              { val:String(total).padStart(2,"0"),     lbl:"Total Bookings"  },
              { val:String(active).padStart(2,"0"),    lbl:"Active"          },
              { val:String(completed).padStart(2,"0"), lbl:"Completed"       },
            ].map((s,i) => (
              <div key={i} className="mb-sum-card">
                <div className="mb-sum-bar"/>
                <div className="mb-sum-val">{s.val}</div>
                <div className="mb-sum-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* FILTER TABS */}
          <div className="mb-tabs">
            {FILTERS.map(f => {
              const cnt = f.k === "all" ? bookings.length : bookings.filter(b=>b.status===f.k).length;
              return (
                <button key={f.k} className={`mb-tab ${filter===f.k?"on":""}`} onClick={()=>setFilter(f.k)}>
                  {f.label}<span className="mb-tab-n">{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* CONTENT */}
          {loading ? (
            <div className="mb-loading"><div className="mb-spin"/><span>Loading bookings…</span></div>
          ) : filtered.length === 0 ? (
            <div className="mb-empty">
              <div className="mb-empty-ico">🚑</div>
              <div className="mb-empty-txt">
                {filter === "all" ? "No bookings yet" : `No ${filter} bookings`}
              </div>
              {filter === "all" && (
                <button className="mb-empty-btn" onClick={()=>navigate("/Ambulances")}>
                  Book an Ambulance →
                </button>
              )}
            </div>
          ) : (
            filtered.map((b, i) => {
              const sc  = SC[b.status] || SC.cancelled;
              const isActive = ["pending","confirmed"].includes(b.status);
              const dt  = b.created_at
                ? new Date(b.created_at).toLocaleString("en-IN", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
                : "—";
              return (
                <div key={i} className="mb-card">

                  {/* TOP ROW */}
                  <div className="mb-card-top">
                    <div className="mb-card-booking-id">
                      Booking <span>#{b.id}</span>
                      {isActive && <span style={{marginLeft:8,fontSize:10,color:"#6e6e73",fontWeight:500}}>
                        <span className="mb-live-dot" style={{marginRight:4}}/>Active
                      </span>}
                    </div>
                    <span className="mb-card-pill" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}>
                      <span className="mb-pill-dot" style={{background:sc.c}}/>
                      {b.status}
                    </span>
                  </div>

                  {/* BODY - 4 columns */}
                  <div className="mb-card-body">

                    {/* Ambulance */}
                    <div className="mb-card-amb">
                      <div className="mb-amb-ico">🚑</div>
                      <div>
                        <div className="mb-amb-lbl">Assigned Ambulance</div>
                        <div className="mb-amb-num">{b.ambulance_number || "—"}</div>
                        <div style={{fontSize:11,color:"#6e6e73",marginTop:2}}>Driver: {b.driver || "—"}</div>
                      </div>
                    </div>

                    {/* Pickup */}
                    <div className="mb-card-col">
                      <div className="mb-col-lbl">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#E50914"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        Pickup Location
                      </div>
                      <div className="mb-col-val">{b.pickup_location || "—"}</div>
                    </div>

                    {/* Destination */}
                    <div className="mb-card-col">
                      <div className="mb-col-lbl">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#6e6e73"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        Destination
                      </div>
                      <div className="mb-col-val">{b.destination || "—"}</div>
                    </div>

                    {/* Date */}
                    <div className="mb-card-col">
                      <div className="mb-col-lbl">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1a6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        Date &amp; Time
                      </div>
                      <div className="mb-col-val" style={{fontSize:12}}>{dt}</div>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="mb-card-ft">
                    {/* Live Track button — only for active bookings */}
                    {isActive && (
                      <button className="mb-btn-track" onClick={() => handleLiveTrack(b)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        Live Track
                      </button>
                    )}

                    {/* Book again */}
                    {(b.status === "completed" || b.status === "cancelled") && (
                      <button className="mb-btn-book" onClick={() => navigate("/Ambulances")}>
                        <svg width="11" height="11" viewBox="0 0 10 12" fill="currentColor"><polygon points="0,0 10,6 0,12"/></svg>
                        Book Again
                      </button>
                    )}

                    {/* Contact driver */}
                    {isActive && b.driver_contact && (
                      <a href={`tel:${b.driver_contact}`} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:"#3d3d3d",textDecoration:"none",padding:"8px 14px",background:"rgba(0,0,0,0.05)",borderRadius:9,border:"1px solid rgba(0,0,0,0.1)"}}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.6a16 16 0 0 0 5.49 5.49l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 18.56z"/></svg>
                        Call Driver
                      </a>
                    )}

                    <div className="mb-ft-meta">#{b.id} · {b.ambulance_number}</div>
                  </div>

                </div>
              );
            })
          )}

        </div>
      </div>
    </>
  );
}
