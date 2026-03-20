import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const HOSP_IMG = "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&q=80";

export default function Hospitals() {
  const [hospitals, setHospitals] = useState([]);
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
        .hp-root { min-height:100vh; background:#f5f5f7; padding-top:60px; padding-left:200px; font-family:'DM Sans',sans-serif; }
        .hp-inner { max-width:1280px; margin:0 auto; padding:28px 32px 64px; }

        /* PAGE HEADER */
        .hp-tag  { display:inline-flex;align-items:center;gap:6px;background:#E50914;color:#fff;border-radius:6px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px; }
        .hp-title{ font-size:28px;font-weight:800;color:#0a0a0a;letter-spacing:-.5px;margin:0 0 4px; }
        .hp-sub  { font-size:13px;color:#6e6e73;margin:0 0 28px; }

        /* STATS */
        .hp-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
        .hp-stat  {
          background:#fff; border:1px solid rgba(0,0,0,0.08); border-radius:16px;
          padding:18px 20px; position:relative; overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);
          transition:transform .18s, box-shadow .18s;
        }
        .hp-stat:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.09); }
        .hp-stat-bar   { position:absolute;top:0;left:0;right:0;height:3px;background:#E50914;border-radius:16px 16px 0 0; }
        .hp-stat-lbl   { font-size:10px;font-weight:700;color:#a1a1a6;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px; }
        .hp-stat-val   { font-size:32px;font-weight:800;color:#0a0a0a;letter-spacing:-1px;line-height:1; }

        /* GRID */
        .hp-section-title { font-size:18px;font-weight:800;color:#0a0a0a;margin-bottom:16px;letter-spacing:-.3px; }
        .hp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }

        /* HOSPITAL CARD */
        .hp-card {
          background:#fff; border:1px solid rgba(0,0,0,0.08); border-radius:20px;
          overflow:hidden; cursor:pointer;
          box-shadow:0 1px 4px rgba(0,0,0,0.06);
          transition:transform .2s ease, box-shadow .2s ease;
        }
        .hp-card:hover { transform:translateY(-4px); box-shadow:0 12px 40px rgba(0,0,0,0.1); }

        .hp-card-img {
          position:relative; height:160px; overflow:hidden;
          background:#f0f0f2;
        }
        .hp-card-img img {
          width:100%; height:100%; object-fit:cover;
          filter:brightness(.82) saturate(.8);
          transition:filter .2s, transform .2s;
        }
        .hp-card:hover .hp-card-img img { filter:brightness(.92) saturate(1); transform:scale(1.04); }

        .hp-card-unit {
          position:absolute; top:10px; left:10px;
          font-size:10px; font-weight:800;
          background:rgba(255,255,255,0.9); color:#0a0a0a;
          border-radius:100px; padding:4px 12px;
          border:1px solid rgba(0,0,0,0.1); backdrop-filter:blur(8px);
          display:flex; align-items:center; gap:5px;
        }
        .hp-card-unit-dot { width:6px;height:6px;border-radius:50%;background:#00875a; }

        .hp-card-status-badge {
          position:absolute; top:10px; right:10px;
          font-size:9px; font-weight:800;
          border-radius:100px; padding:4px 12px; border:1px solid;
          text-transform:uppercase; letter-spacing:.4px;
          backdrop-filter:blur(8px);
          display:flex; align-items:center; gap:4px;
        }

        .hp-card-body { padding:16px 18px 18px; }
        .hp-card-genres { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
        .hp-card-genre  { font-size:10px;font-weight:700;color:#6e6e73;background:#f0f0f2;border-radius:100px;padding:3px 10px; }
        .hp-card-name   { font-size:17px;font-weight:800;color:#0a0a0a;margin-bottom:3px;letter-spacing:-.3px; }
        .hp-card-addr   { font-size:12px;color:#6e6e73;margin-bottom:14px; display:flex;align-items:center;gap:4px; }

        /* Bed stats row */
        .hp-card-beds { display:flex; gap:16px; padding:12px 0; border-top:1px solid rgba(0,0,0,0.06); border-bottom:1px solid rgba(0,0,0,0.06); margin-bottom:14px; }
        .hp-card-bed-item { display:flex;flex-direction:column;gap:2px; }
        .hp-card-bed-val  { font-size:18px;font-weight:800;color:#0a0a0a; }
        .hp-card-bed-lbl  { font-size:9px;font-weight:700;color:#a1a1a6;text-transform:uppercase;letter-spacing:.8px; }

        /* Directions btn */
        .hp-card-dirs {
          display:flex; align-items:center; gap:7px;
          background:#0a0a0a; color:#fff;
          border:none; border-radius:10px; padding:9px 18px;
          font-size:12px; font-weight:700; font-family:inherit;
          cursor:pointer; transition:background .15s;
        }
        .hp-card-dirs:hover { background:#222; }

        /* RESPONSIVE */
        @media(max-width:767px){
          .hp-root{padding-left:0;padding-bottom:72px;}
          .hp-inner{padding:16px 14px 80px;}
          .hp-stats{grid-template-columns:repeat(2,1fr);gap:10px;}
          .hp-grid{grid-template-columns:1fr;}
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
              return(
                <div key={i} className="hp-card">
                  <div className="hp-card-img">
                    <img src={HOSP_IMG} alt=""/>
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

                    <div className="hp-card-beds">
                      {[
                        {val:h.total_beds??"—",     lbl:"Total Beds"},
                        {val:h.available_beds??"—", lbl:"Available" },
                        {val:h.icu_beds||"—",        lbl:"ICU Beds"  },
                      ].map((b,j)=>(
                        <div key={j} className="hp-card-bed-item">
                          <div className="hp-card-bed-val">{b.val}</div>
                          <div className="hp-card-bed-lbl">{b.lbl}</div>
                        </div>
                      ))}
                    </div>

                    <button className="hp-card-dirs" onClick={()=>navigate("/directions",{state:{hospital:{name:h.name,address:h.address,latitude:h.latitude,longitude:h.longitude}}})}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      Directions
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hospitals.length===0&&(
            <div style={{textAlign:"center",padding:"60px 0",color:"#a1a1a6",fontSize:14}}>
              <div style={{fontSize:48,marginBottom:12,opacity:.4}}>🏥</div>
              No hospitals in network yet
            </div>
          )}

        </div>
      </div>
    </>
  );
}