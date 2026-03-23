import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const HOSP_IMG = "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80";
const RED_MAIN = "#e3282d";

export default function Hospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [favorites, setFavorites] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/hospitals/")
      .then(r=>r.json()).then(setHospitals).catch(()=>{});
  },[]);

  const counts = {
    total:    hospitals.length,
    active:   hospitals.filter(h=>h.status==="active").length,
    critical: hospitals.filter(h=>h.status==="critical").length,
    full:     hospitals.filter(h=>h.status==="full").length,
  };

  const ST = {
    active:   {c:"#00875a", bg:"rgba(0,135,90,0.09)",  b:"rgba(0,135,90,0.22)",  label:"Active"  },
    critical: {c:"#E50914", bg:"rgba(229,9,20,0.09)",  b:"rgba(229,9,20,0.22)",  label:"Critical"},
    full:     {c:"#b36800", bg:"rgba(179,104,0,0.09)", b:"rgba(179,104,0,0.22)", label:"Full"    },
    closed:   {c:"#a1a1a6", bg:"rgba(0,0,0,0.05)",     b:"rgba(0,0,0,0.12)",     label:"Closed"  },
  };

  return (
    <>
      <style>{`
        .hp-root {
          min-height:100vh;
          background:
            radial-gradient(circle at 12% 10%, var(--sr-bg-grad-a), transparent 34%),
            radial-gradient(circle at 88% 8%, var(--sr-bg-grad-b), transparent 38%),
            var(--sr-bg);
          padding-top:60px;
          padding-left:200px;
          font-family:'DM Sans',sans-serif;
        }
        .hp-inner { max-width:1280px; margin:0 auto; padding:28px 32px 64px; }

        /* PAGE HEADER */
        .hp-tag  { display:inline-flex;align-items:center;gap:6px;background:#E50914;color:#fff;border-radius:6px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px; }
        .hp-title{ font-size:28px;font-weight:800;color:var(--sr-text);letter-spacing:-.5px;margin:0 0 4px; }
        .hp-sub  { font-size:13px;color:var(--sr-text-sub);margin:0 0 28px; }

        /* STATS */
        .hp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
        .hp-stat  {
          background:color-mix(in srgb, var(--sr-surface) 92%, transparent); border:1px solid var(--sr-border); border-radius:16px;
          padding:18px 20px; position:relative; overflow:hidden;
          box-shadow:var(--shadow);
          transition:transform .18s, box-shadow .18s;
        }
        .hp-stat:hover { transform:translateY(-2px); box-shadow:var(--shadow2); }
        .hp-stat-bar   { position:absolute;top:0;left:0;right:0;height:3px;background:#E50914;border-radius:16px 16px 0 0; }
        .hp-stat-lbl   { font-size:10px;font-weight:700;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px; }
        .hp-stat-val   { font-size:32px;font-weight:800;color:var(--sr-text);letter-spacing:-1px;line-height:1; }

        /* GRID */
        .hp-section-title { font-size:18px;font-weight:800;color:var(--sr-text);margin-bottom:16px;letter-spacing:-.3px; }
        .hp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }

        /* HOSPITAL CARD */
        .hp-card {
          background:#f3ece8;
          border:1px solid rgba(255,255,255,0.22);
          border-radius:22px;
          overflow:hidden;
          cursor:pointer;
          box-shadow:0 10px 28px rgba(0,0,0,0.28);
          transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;
          position:relative;
          backdrop-filter:blur(6px);
        }
        .hp-card:hover {
          transform:translateY(-2px);
          box-shadow:0 16px 34px rgba(0,0,0,0.34);
          border-color:rgba(255,255,255,0.32);
        }

        .hp-card-img {
          position:relative;
          height:178px;
          overflow:hidden;
          background:var(--sr-surface-2);
          border-bottom:1px solid rgba(0,0,0,0.08);
        }
        .hp-card-img img {
          position:absolute;
          inset:0;
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
          filter:brightness(.94) saturate(1.02) contrast(1.01);
          transition:transform .24s ease,filter .24s ease;
          z-index:2;
        }
        .hp-card:hover .hp-card-img img { transform:scale(1.04);filter:brightness(1) saturate(1.04) contrast(1.02); }

        .hp-card-unit {
          position:absolute;
          top:38px;
          left:8px;
          display:flex;
          align-items:center;
          gap:4px;
          background:rgba(38,24,36,0.88);
          border:1px solid rgba(255,255,255,0.18);
          border-radius:999px;
          padding:4px 12px;
          font-size:11px;
          font-weight:800;
          color:#f3ebe7;
          z-index:4;
        }
        .hp-card-unit-dot { width:6px;height:6px;border-radius:50%;background:${RED_MAIN}; }

        .hp-card-status-badge {
          position:absolute;
          top:38px;
          right:8px;
          font-size:11px;
          font-weight:800;
          border-radius:999px;
          padding:4px 12px;
          text-transform:uppercase;
          letter-spacing:.4px;
          display:flex;
          align-items:center;
          gap:4px;
          background:rgba(38,24,36,0.9)!important;
          border:1px solid rgba(255,255,255,0.18)!important;
          color:#fff!important;
          z-index:4;
        }
        .hp-card-speed{
          position:absolute;
          top:8px;
          left:8px;
          display:flex;
          align-items:center;
          gap:4px;
          background:rgba(179,38,30,0.86);
          border:1px solid rgba(255,255,255,0.3);
          border-radius:999px;
          padding:3px 9px;
          font-size:9px;
          font-weight:800;
          color:#fff;
          z-index:5;
        }
        .hp-card-spd-dot{width:5px;height:5px;border-radius:50%;background:#E50914;}
        .hp-card-heart{
          position:absolute;
          top:8px;
          right:8px;
          width:22px;
          height:22px;
          border-radius:999px;
          background:#d43128;
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:10px;
          cursor:pointer;
          transition:transform .15s;
          z-index:6;
          border:1px solid rgba(0,0,0,0.08);
        }
        .hp-card-heart:hover{transform:scale(1.15);}

        .hp-card-body { padding:10px 12px 12px;background:#f8f2ef; }
        .hp-card-genres { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:5px; }
        .hp-card-genre  { font-size:12px;font-weight:800;color:#9f3e2f;background:#f2dfd8;border:1px solid rgba(159,62,47,0.22);border-radius:999px;padding:3px 10px; }
        .hp-card-name   { font-size:20px;font-weight:900;color:#2c1b24;margin-bottom:4px;letter-spacing:-.2px;line-height:1.15; }
        .hp-card-addr   { font-size:13px;color:#5c4852;line-height:1.35;margin-bottom:10px;display:flex;align-items:center;gap:4px; }
        .hp-card-divider{ height:1px;background:rgba(208,108,98,0.32);margin:8px 0 10px; }
        .hp-card-meta   { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px; }
        .hp-card-chip   {
          font-size:11px;
          font-weight:800;
          color:#fff;
          background:#2f1e2f;
          border:1px solid rgba(255,255,255,0.24);
          border-radius:999px;
          padding:4px 10px;
          text-transform:uppercase;
          letter-spacing:.4px;
          box-shadow:0 4px 10px rgba(0,0,0,0.2);
        }
        .hp-card-chip.tone-beds{
          background:linear-gradient(135deg,#0e9f6e,#0c7a56) !important;
          border-color:rgba(140,255,208,0.45) !important;
          color:#ecfff6 !important;
        }
        .hp-card-chip.tone-available{
          background:linear-gradient(135deg,#f43f5e,#c81e3a) !important;
          border-color:rgba(255,166,183,0.45) !important;
          color:#fff2f5 !important;
        }
        .hp-card-chip.tone-icu{
          background:linear-gradient(135deg,#f5c842,#d89f12) !important;
          border-color:rgba(255,234,162,0.5) !important;
          color:#3d2b00 !important;
        }

        /* Directions btn */
        .hp-card-dirs {
          display:flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          background:linear-gradient(135deg,#ffd84f,#f2b705) !important;
          color:#3a2500 !important;
          border:none;
          border-radius:999px;
          padding:10px 16px;
          font-size:13px;
          font-weight:800;
          font-family:inherit;
          cursor:pointer;
          transition:all .15s;
          width:100%;
          box-shadow:0 10px 20px rgba(214,162,17,0.35);
        }
        .hp-card-dirs:hover { filter:brightness(1.05); transform:translateY(-1px); }
        /* RESPONSIVE */
        @media(max-width:767px){
          .hp-root{padding-left:0;padding-bottom:72px;}
          .hp-inner{padding:16px 14px 80px;}
          .hp-stats{grid-template-columns:repeat(2,1fr);gap:10px;}
          .hp-grid{grid-template-columns:1fr;}
          .hp-card-name{font-size:18px;}
          .hp-card-addr{font-size:12px;}
          .hp-card-dirs{font-size:14px;}
        }
      `}</style>

      <div className="hp-root">
        <div className="hp-inner">

          <div className="hp-tag">🏥 Network</div>
          <h1 className="hp-title">Hospital Network</h1>
          <p className="hp-sub">Real-time bed availability and emergency capacity</p>

          {/* STATS */}
          <div className="hp-stats">
            {[
              {lbl:"Total Hospitals", val:String(counts.total).padStart(2,"0")   },
              {lbl:"Active",          val:String(counts.active).padStart(2,"0")  },
              {lbl:"Critical",        val:String(counts.critical).padStart(2,"0")},
              {lbl:"Full",            val:String(counts.full).padStart(2,"0")    },
            ].map((s,i)=>(
              <div key={i} className="hp-stat">
                <div className="hp-stat-bar"/>
                <div className="hp-stat-lbl">{s.lbl}</div>
                <div className="hp-stat-val">{s.val}</div>
              </div>
            ))}
          </div>

          <div className="hp-section-title">Hospital Directory</div>

          <div className="hp-grid">
            {hospitals.map((h,i)=>{
              const norm = h.status?.toLowerCase().replace(/[\s-]+/g,"_");
              const sc   = ST[norm] || ST.closed;
              const ctaLabel = norm === "active" ? "Check Availability" : "Check Availability";
              return(
                <div key={i} className="hp-card">
                  <div className="hp-card-img">
                    <img src={HOSP_IMG} alt=""/>
                    <div className="hp-card-speed">
                      <span className="hp-card-spd-dot"/>
                      {h.available_beds ?? 0} beds
                    </div>
                    <div
                      className="hp-card-heart"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFavorites((p) => ({ ...p, [h.id]: !p[h.id] }));
                      }}
                    >
                      {favorites[h.id] ? "♥" : "♡"}
                    </div>
                    <div className="hp-card-unit">
                      <span className="hp-card-unit-dot"/>
                      Unit #{String(i+1).padStart(2,"0")}
                    </div>
                    <span className="hp-card-status-badge" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}>
                      <span style={{width:5,height:5,borderRadius:"50%",background:sc.c,display:"inline-block"}}/>
                      {sc.label}
                    </span>
                  </div>

                    <div className="hp-card-body">
                      <div className="hp-card-genres">
                      {h.specialization
                        ? h.specialization.split(",").slice(0,2).map((s,j)=><span key={j} className="hp-card-genre">{s.trim()}</span>)
                        : <span className="hp-card-genre">General</span>
                      }
                      {h.hospital_type && <span className="hp-card-genre">{h.hospital_type}</span>}
                    </div>
                    <div className="hp-card-name">{h.name}</div>
                    <div className="hp-card-addr">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#E50914" style={{flexShrink:0}}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      {h.address}
                    </div>

                    <div className="hp-card-divider" />
                    <div className="hp-card-meta">
                      <span className="hp-card-chip tone-beds">Beds {h.total_beds ?? "—"}</span>
                      <span className="hp-card-chip tone-available">Available {h.available_beds ?? "—"}</span>
                      <span className="hp-card-chip tone-icu">ICU {h.icu_beds ?? "—"}</span>
                    </div>

                    <button className="hp-card-dirs" onClick={()=>navigate("/directions",{state:{hospital:{name:h.name,address:h.address,latitude:h.latitude,longitude:h.longitude}}})}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      {ctaLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hospitals.length===0&&(
            <div style={{textAlign:"center",padding:"60px 0",color:"var(--sr-text-muted)",fontSize:14}}>
              <div style={{fontSize:48,marginBottom:12,opacity:.4}}>🏥</div>
              No hospitals in network yet
            </div>
          )}

        </div>
      </div>
    </>
  );
}
