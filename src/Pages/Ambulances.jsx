import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AMB_INDIAN_IMAGES = [
  "https://images.unsplash.com/photo-1762805080882-84c2d3855963?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1759701058584-ea4bdce848c8?auto=format&fit=crop&w=1600&q=80",
  "https://upload.wikimedia.org/wikipedia/commons/6/63/108_Ambulance_in_India.jpg",
];
const AMB_PREMIUM_FALLBACK_IMG =
  "https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=1600&q=80";

export default function Ambulances() {
  const [ambulances,  setAmbulances]  = useState([]);
  const [filter,      setFilter]      = useState("all");
  const [showModal,   setShowModal]   = useState(false);
  const [selAmb,      setSelAmb]      = useState(null);
  const [form,        setForm]        = useState({pickup_location:"",destination:""});
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [toast,       setToast]       = useState(null);
  const isDriver = localStorage.getItem("role")==="driver";
  const isAdmin  = localStorage.getItem("role")==="admin";
  const navigate = useNavigate();

  useEffect(()=>{
    fetch("http://127.0.0.1:8000/api/ambulances/").then(r=>r.json()).then(setAmbulances).catch(()=>{});
  },[]);

  const showToast=(msg,type="success")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  const counts = {
    all:       ambulances.length,
    available: ambulances.filter(a=>a.status==="available").length,
    en_route:  ambulances.filter(a=>a.status==="en_route").length,
    busy:      ambulances.filter(a=>a.status==="busy").length,
  };

  const filtered = filter==="all" ? ambulances : ambulances.filter(a=>a.status===filter);

  const openBook=(a)=>{ setSelAmb(a); setForm({pickup_location:"",destination:""}); setSuccess(false); setShowModal(true); };

  const submit=async()=>{
    if(!form.pickup_location.trim()) return;
    setLoading(true);
    try{
      const res=await fetch("http://127.0.0.1:8000/api/bookings/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ambulance_id:selAmb.id,ambulance_number:selAmb.ambulance_number,driver:selAmb.driver,driver_contact:selAmb.driver_contact,booked_by:localStorage.getItem("name")||"Unknown",booked_by_email:localStorage.getItem("user")||"",pickup_location:form.pickup_location,destination:form.destination,status:"pending"})});
      if(res.ok){ setSuccess(true); window.dispatchEvent(new Event("new-booking")); showToast("Booking submitted!"); }
    }catch{ showToast("Something went wrong.","error"); }
    setLoading(false);
  };

  const ST={
    available:{c:"#00875a",bg:"rgba(0,135,90,0.09)", b:"rgba(0,135,90,0.22)", label:"Available"},
    en_route: {c:"#E50914",bg:"rgba(229,9,20,0.09)", b:"rgba(229,9,20,0.22)", label:"En Route" },
    busy:     {c:"#E50914",bg:"rgba(229,9,20,0.09)", b:"rgba(229,9,20,0.22)", label:"Busy"     },
    offline:  {c:"#a1a1a6",bg:"rgba(0,0,0,0.05)",    b:"rgba(0,0,0,0.12)",    label:"Offline"  },
  };

  const handleAmbImageError = (e) => {
    const idx = Number(e.currentTarget.dataset.fallbackIndex || "0");
    const next = idx + 1;
    if (next < AMB_INDIAN_IMAGES.length) {
      e.currentTarget.dataset.fallbackIndex = String(next);
      e.currentTarget.src = AMB_INDIAN_IMAGES[next];
      return;
    }
    e.currentTarget.src = AMB_PREMIUM_FALLBACK_IMG;
  };

  return(
    <>
      <style>{`
        .ab-root{min-height:100vh;background:#f5f5f7;padding-top:60px;padding-left:200px;font-family:'DM Sans',sans-serif;}
        .ab-inner{max-width:1280px;margin:0 auto;padding:28px 32px 64px;}

        .ab-toast{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:12px;font-weight:700;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,0.12);white-space:nowrap;animation:abt-in .25s ease;}
        @keyframes abt-in{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .ab-toast-success{background:#0a0a0a;color:#fff;}
        .ab-toast-error{background:#E50914;color:#fff;}

        /* HEADER ROW */
        .ab-hdr{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:22px;}
        .ab-title{font-size:26px;font-weight:800;color:#0a0a0a;letter-spacing:-.5px;margin:0 0 3px;}
        .ab-sub  {font-size:13px;color:#6e6e73;margin:0;}

        /* FILTER TABS */
        .ab-tabs{display:flex;gap:6px;flex-wrap:wrap;}
        .ab-tab{font-size:12px;font-weight:700;padding:7px 18px;border-radius:100px;border:1.5px solid rgba(0,0,0,0.1);background:#fff;color:rgba(0,0,0,0.5);cursor:pointer;font-family:inherit;transition:all .15s;display:flex;align-items:center;gap:5px;}
        .ab-tab:hover{border-color:rgba(0,0,0,0.22);color:#0a0a0a;}
        .ab-tab.on{background:#E50914;color:#fff;border-color:#E50914;box-shadow:0 4px 14px rgba(229,9,20,0.28);}
        .ab-tab-n{font-size:10px;font-weight:800;background:rgba(0,0,0,0.12);border-radius:100px;padding:1px 6px;}
        .ab-tab.on .ab-tab-n{background:rgba(255,255,255,0.25);}

        /* HERO */
        .ab-hero{position:relative;border-radius:20px;overflow:hidden;height:220px;margin-bottom:26px;background:linear-gradient(130deg,#0b1222 0%,#111d33 46%,#1a1326 100%);box-shadow:0 8px 32px rgba(0,0,0,0.14);}
        .ab-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.56) saturate(1.12) contrast(1.08);}
        .ab-hero-bg{position:absolute;inset:0;background:
          radial-gradient(circle at 18% 18%, rgba(255,90,80,0.22), transparent 28%),
          radial-gradient(circle at 78% 18%, rgba(78,168,255,0.18), transparent 30%),
          conic-gradient(from 220deg at 60% 80%, rgba(255,90,80,0.16), rgba(78,168,255,0.08), transparent 56%);
        }
        .ab-hero-grid{position:absolute;inset:0;background-image:
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);background-size:36px 36px;opacity:.32;}
        .ab-hero-glass{position:absolute;right:-120px;top:-100px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%);filter:blur(6px);}
        .ab-hero-cnt{position:absolute;left:0;top:0;bottom:0;padding:30px 36px;display:flex;flex-direction:column;justify-content:center;gap:11px;}
        .ab-hero-tags{display:flex;gap:7px;}
        .ab-hero-tag{font-size:11px;font-weight:700;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.2);border-radius:100px;padding:4px 13px;}
        .ab-hero-title{font-size:40px;font-weight:800;color:#fff;letter-spacing:-1px;line-height:.95;}
        .ab-hero-title em{color:#E50914;font-style:normal;}
        .ab-hero-desc{font-size:13px;color:rgba(255,255,255,0.55);max-width:320px;line-height:1.6;}
        .ab-hero-btns{display:flex;gap:9px;}
        .ab-hero-bp{display:flex;align-items:center;gap:7px;background:#E50914;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 4px 16px rgba(229,9,20,0.38);transition:background .15s,transform .12s;}
        .ab-hero-bp:hover{background:#c8000f;transform:translateY(-1px);}
        .ab-hero-bs{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,0.13);border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:10px;padding:10px 24px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s;}
        .ab-hero-bs:hover{background:rgba(255,255,255,0.22);}
        .ab-hero-badge{position:absolute;top:16px;right:16px;display:flex;align-items:center;gap:5px;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);border-radius:100px;padding:6px 14px;font-size:11px;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,0.12);}
        .ab-hero-badge-dot{width:6px;height:6px;border-radius:50%;background:#E50914;}

        /* SECTION TITLE */
        .ab-sec{display:flex;align-items:center;gap:8px;margin-bottom:16px;}
        .ab-sec-title{font-size:18px;font-weight:800;color:#0a0a0a;letter-spacing:-.3px;}
        .ab-sec-ct{margin-left:auto;font-size:12px;color:#a1a1a6;font-weight:600;}

        /* CARDS GRID */
        .ab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:20px;}
        .ab-card{
          background:linear-gradient(180deg,#fff8f7 0%, #fff 70%);
          border:1px solid #f1c9c3;
          border-radius:16px;
          overflow:hidden;
          cursor:pointer;
          box-shadow:0 4px 14px rgba(179,38,30,0.14);
          transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;
          position:relative;
        }
        .ab-card:hover{
          transform:translateY(-2px);
          box-shadow:0 8px 18px rgba(12,24,44,0.18);
          border-color:#e7a89e;
          z-index:5;
        }
        .ab-card-thumb{
          position:relative;
          height:130px;
          overflow:hidden;
          background:#ffeceb !important;
          backdrop-filter:none !important;
          -webkit-backdrop-filter:none !important;
          border-bottom:1px solid #edf1f6;
          border-radius:12px 12px 0 0;
        }
        .ab-card-thumb img{
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
          opacity:1 !important;
          visibility:visible !important;
          filter:brightness(1.01) saturate(1.02) contrast(1.01) !important;
          transform:scale(1);
          transition:transform .24s ease,filter .24s ease;
          z-index:2;
        }
        .ab-card:hover .ab-card-thumb img{transform:scale(1.04);filter:brightness(1.03) saturate(1.04) contrast(1.02);}
        .ab-card-art{ display:none !important; }
        .ab-card-art-grid{ display:none; }
        .ab-card-art-signal{ display:none; }
        .ab-card-art-icon{ display:none; }
        .ab-card-speed{position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:4px;background:rgba(179,38,30,0.86);border:1px solid rgba(255,255,255,0.3);border-radius:999px;padding:3px 9px;font-size:9px;font-weight:800;color:#fff;z-index:4;}
        .ab-card-spd-dot{width:5px;height:5px;border-radius:50%;background:#E50914;}
        .ab-card-st{display:none;}
        .ab-card-heart{position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:999px;background:#d43128;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;transition:transform .15s;opacity:1;z-index:4;border:1px solid rgba(0,0,0,0.08);}
        .ab-card:hover .ab-card-heart{opacity:1;}
        .ab-card-heart:hover{transform:scale(1.15);}
        .ab-card-body{padding:10px 10px 10px;background:linear-gradient(180deg,#fff 0%, #fff4f2 100%);}
        .ab-card-genres{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px;}
        .ab-card-genre{font-size:8px;font-weight:700;color:#8b2d23;background:#ffe6e2;border:1px solid #f1c5bf;border-radius:999px;padding:2px 7px;text-transform:uppercase;letter-spacing:.2px;}
        .ab-card-name{font-size:10px;font-weight:800;color:#5f1812;letter-spacing:-.05px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .ab-card-sub {font-size:9px;color:#7c3a33;line-height:1.35;margin-bottom:7px;height:24px;overflow:hidden;}
        .ab-card-ft  {display:flex;align-items:center;justify-content:space-between;gap:6px;padding-top:7px;border-top:1px solid #f4d7d2;}
        .ab-card-book{background:linear-gradient(135deg,#6b7280,#4b5563);color:#fff;border:none;border-radius:10px;padding:6px 10px;font-size:9px;font-weight:700;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap;min-width:100px;text-align:center;box-shadow:0 3px 8px rgba(75,85,99,0.25);}
        .ab-card-book:hover{filter:brightness(1.05);}
        .ab-card-book.red{
          background:linear-gradient(135deg,#ff4a3a,#c6241b);
          box-shadow:0 5px 12px rgba(198,36,27,0.3);
        }
        .ab-card-book.yellow{
          background:linear-gradient(135deg,#ffd24a,#f0b90b);
          color:#3f2c00;
          box-shadow:0 5px 12px rgba(240,185,11,0.32);
        }
        .ab-card-book.yellow:hover{filter:brightness(1.02);}
        .ab-card-book:disabled{opacity:.85;box-shadow:none;cursor:not-allowed;}
        .ab-card-book.red:disabled{
          background:linear-gradient(135deg,#ff7a6e,#d94a3f);
          color:#fff;
        }
        .ab-card-book.yellow:disabled{
          background:linear-gradient(135deg,#ffe18a,#f6c742);
          color:#6a4c00;
        }
        .ab-card-info-btn{display:none;}

        /* MODAL */
        .ab-modal-ov{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;}
        .ab-modal{
          background:linear-gradient(180deg,#ffffff 0%, #fff3f1 100%);
          border-radius:24px;
          padding:30px;
          width:100%;
          max-width:460px;
          box-shadow:0 24px 64px rgba(0,0,0,0.22);
          border:1px solid #f3c8c2;
        }
        .ab-modal-title{font-size:20px;font-weight:800;color:#4f1d1a;margin-bottom:18px;letter-spacing:-.4px;}
        .ab-modal-amb{background:#fff;border-radius:14px;padding:13px 15px;border:1px solid #f2d0cb;margin-bottom:16px;box-shadow:0 4px 12px rgba(198,36,27,0.07);}
        .ab-modal-amb-n{font-size:15px;font-weight:800;color:#0a0a0a;}
        .ab-modal-amb-s{font-size:11px;color:#6e6e73;margin-top:2px;}
        .ab-modal-lbl{font-size:10px;font-weight:700;color:#8c3b34;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
        .ab-modal-inp{width:100%;background:#fff;border:1.5px solid #f2d0cb;border-radius:12px;padding:12px 14px;color:#3f1f1c;font-size:13px;font-family:inherit;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box;margin-bottom:14px;}
        .ab-modal-inp:focus{border-color:#e8442b;background:#fff;box-shadow:0 0 0 3px rgba(232,68,43,0.12);}
        .ab-modal-inp::placeholder{color:rgba(0,0,0,0.28);}
        .ab-modal-btns{display:flex;gap:9px;margin-top:4px;}
        .ab-modal-conf{flex:1;background:linear-gradient(135deg,#ff4a3a,#c6241b);color:#fff;border:none;border-radius:12px;padding:13px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 6px 16px rgba(198,36,27,0.32);transition:all .15s;}
        .ab-modal-conf:hover:not(:disabled){background:#c8000f;}
        .ab-modal-conf:disabled{background:#f4c3bd;color:#fff;box-shadow:none;cursor:not-allowed;}
        .ab-modal-canc{flex:1;background:#fff;border:1.5px solid #f0c8c2;color:#7a3a33;border-radius:12px;padding:13px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;}
        .ab-modal-ok{display:flex;flex-direction:column;align-items:center;gap:11px;padding:8px 0;text-align:center;}

        /* RESPONSIVE */
        @media(max-width:767px){.ab-root{padding-left:0;padding-bottom:72px;}.ab-inner{padding:16px 14px 80px;}.ab-hero{height:180px;}.ab-hero-title{font-size:28px;}.ab-grid{grid-template-columns:repeat(2,1fr);gap:10px;}}
        @media(max-width:480px){.ab-hero{height:160px;}.ab-hero-title{font-size:22px;}.ab-hero-desc{display:none;}.ab-grid{gap:8px;}}
      `}</style>

      {toast&&<div className={`ab-toast ab-toast-${toast.type}`}>{toast.msg}</div>}

      <div className="ab-root">
        <div className="ab-inner">

          {/* HEADER */}
          <div className="ab-hdr">
            <div>
              <h1 className="ab-title">Ambulance Services</h1>
              <p className="ab-sub">Book emergency ambulance — Delhi</p>
            </div>
            <div className="ab-tabs">
              {[{k:"all",l:"All"},{k:"available",l:"Available"},{k:"en_route",l:"En Route"},{k:"busy",l:"Busy"}].map(t=>(
                <button key={t.k} className={`ab-tab ${filter===t.k?"on":""}`} onClick={()=>setFilter(t.k)}>
                  {t.l}<span className="ab-tab-n">{counts[t.k]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* HERO */}
          <div className="ab-hero">
            <img
              className="ab-hero-img"
              src={AMB_INDIAN_IMAGES[0]}
              alt="Indian ambulance"
              data-fallback-index="0"
              onError={handleAmbImageError}
            />
            <div className="ab-hero-bg"/>
            <div className="ab-hero-grid"/>
            <div className="ab-hero-glass"/>
            <div className="ab-hero-cnt">
              <div className="ab-hero-tags">
                <span className="ab-hero-tag">Emergency</span>
                <span className="ab-hero-tag">24/7 Service</span>
              </div>
              <div className="ab-hero-title">Swift<em>Rescue</em></div>
              <div className="ab-hero-desc">{counts.available} ambulances ready · Fastest response in India</div>
              <div className="ab-hero-btns">
                <button className="ab-hero-bp" onClick={()=>ambulances[0]&&openBook(ambulances[0])}>
                  <svg width="11" height="11" viewBox="0 0 10 12" fill="currentColor"><polygon points="0,0 10,6 0,12"/></svg>
                  Book Now
                </button>
                <button className="ab-hero-bs" onClick={()=>setFilter("available")}>View Available</button>
              </div>
            </div>
            <div className="ab-hero-badge">
              <span className="ab-hero-badge-dot"/>
              {ambulances.length} units active
            </div>
          </div>

          {/* SECTION */}
          <div className="ab-sec">
            <div className="ab-sec-title">
              {filter==="all"?"All Fleet":filter==="available"?"Available Now":filter==="en_route"?"En Route":"Busy"}
            </div>
            <span style={{fontSize:16}}>🚑</span>
            <span className="ab-sec-ct">{filtered.length} units</span>
          </div>

          <div className="ab-grid">
            {filtered.map((a,i)=>{
              const s=ST[a.status]||ST.offline;
              const bk=0; const cn=0;
              return(
                <div key={i} className="ab-card">
                  <div className="ab-card-thumb">
                    <img
                      src={AMB_INDIAN_IMAGES[(i + 1) % AMB_INDIAN_IMAGES.length]}
                      alt="Indian ambulance"
                      data-fallback-index={(i + 1) % AMB_INDIAN_IMAGES.length}
                      onError={handleAmbImageError}
                    />
                    <div className="ab-card-speed">
                      <span className="ab-card-spd-dot"/>
                      {a.speed||0} km/h
                    </div>
                    <div className="ab-card-heart" onClick={e=>{e.stopPropagation();showToast("Added to favorites");}}>♡</div>
                    <span className="ab-card-st" style={{color:s.c,background:s.bg,borderColor:s.b}}>{s.label}</span>
                  </div>
                    <div className="ab-card-body">
                      <div className="ab-card-genres">
                        <span className="ab-card-genre">{a.model||"Ambulance"}</span>
                        <span className="ab-card-genre">Unit #{String(i+1).padStart(2,"0")}</span>
                      </div>
                      <div className="ab-card-name">{a.ambulance_number}</div>
                      <div className="ab-card-sub">Driver: {a.driver} · {a.location?.slice(0,18)||"—"}</div>
                      <div className="ab-card-ft">
                        <button className={`ab-card-book ${a.status==="available" ? "red" : "yellow"}`} disabled={a.status==="offline"||isDriver} onClick={e=>{e.stopPropagation();openBook(a);}}>
                          {a.status==="available"?"Book now":"+ Add request"}
                        </button>
                      </div>
                    </div>
                  </div>
              );
            })}
          </div>

        </div>
      </div>

      {showModal&&(
        <div className="ab-modal-ov" onClick={e=>{if(e.target===e.currentTarget)setShowModal(false);}}>
          <div className="ab-modal">
            {!success?(
              <>
                <div className="ab-modal-title">🚑 Book Ambulance</div>
                <div className="ab-modal-amb">
                  <div className="ab-modal-amb-n">{selAmb?.ambulance_number}</div>
                  <div className="ab-modal-amb-s">Driver: {selAmb?.driver} · {selAmb?.driver_contact}</div>
                </div>
                <div className="ab-modal-lbl">Pickup Location *</div>
                <input className="ab-modal-inp" placeholder="e.g. Connaught Place, Delhi" value={form.pickup_location} onChange={e=>setForm(f=>({...f,pickup_location:e.target.value}))}/>
                <div className="ab-modal-lbl">Destination (optional)</div>
                <input className="ab-modal-inp" placeholder="e.g. AIIMS Delhi" value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))} style={{marginBottom:0}}/>
                <div className="ab-modal-btns">
                  <button className="ab-modal-canc" onClick={()=>setShowModal(false)}>Cancel</button>
                  <button className="ab-modal-conf" disabled={loading||!form.pickup_location.trim()} onClick={submit}>{loading?"Booking...":"Confirm →"}</button>
                </div>
              </>
            ):(
              <div className="ab-modal-ok">
                <div style={{fontSize:52}}>✅</div>
                <div style={{fontSize:18,fontWeight:800,color:"#0a0a0a"}}>Request Submitted!</div>
                <div style={{fontSize:12,color:"#6e6e73"}}>Booking for <b>{selAmb?.ambulance_number}</b> submitted. You'll be notified once confirmed.</div>
                <button className="ab-modal-conf" onClick={()=>setShowModal(false)}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
