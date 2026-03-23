import { Bell, Search, X, Camera } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import { useSmoothScroll } from '../providers/SmoothScrollProvider';

export default function Topnavbar() {
  const [search,   setSearch]   = useState('');
  const [results,  setResults]  = useState({ambulances:[],hospitals:[]});
  const [showDrop, setShowDrop] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [unread,   setUnread]   = useState(0);
  const [notifs,   setNotifs]   = useState([]);
  const [showBell, setShowBell] = useState(false);
  const [showProf, setShowProf] = useState(false);
  const [showMobS, setShowMobS] = useState(false);
  const { theme, setTheme } = useTheme();
  const { engine, setEngine } = useSmoothScroll();

  const user   = localStorage.getItem("name");
  const email  = localStorage.getItem("user") || "guest";
  const rawRole= localStorage.getItem("role");
  // Admin override: if email matches admin email, always treat as admin
  const isAdmin = email.trim().toLowerCase() === "vashupanchal.cs@gmail.com".toLowerCase();
  const role   = isAdmin ? "admin" : (rawRole || "user");
  const ambId  = parseInt(localStorage.getItem("ambulance_id")||"0");
  const dpKey  = `sr-profile-pic-${email}`;
  const [pic,  setPic]  = useState(()=>localStorage.getItem(dpKey)||null);

  const bellRef   = useRef(null);
  const searchRef = useRef(null);
  const profRef   = useRef(null);
  const fileRef   = useRef(null);
  const navigate  = useNavigate();

  useEffect(()=>{
    setPic(localStorage.getItem(dpKey)||null);
    // Ensure admin role is set correctly in localStorage
    if (isAdmin && localStorage.getItem("role") !== "admin") {
      localStorage.setItem("role","admin");
    }
  },[dpKey]);

  const fetchN = () => {
    fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json()).then(data=>{
      if(role==="admin"){ setNotifs(data.slice(0,5)); setUnread(data.filter(b=>!b.is_read).length); }
      else if(role==="driver"){ const mine=data.filter(b=>b.ambulance_id===ambId).slice(0,5); setNotifs(mine.map(b=>({id:b.id,title:`🚑 #${b.id} — ${b.status}`,message:`${b.booked_by} · ${b.pickup_location}`,status:b.status,timestamp:b.created_at}))); setUnread(mine.filter(b=>b.status==="confirmed").length); }
      else { const mine=data.filter(b=>b.booked_by_email===email||b.booked_by===user).sort((a,b)=>b.id-a.id).slice(0,5); setNotifs(mine.map(b=>({id:b.id,title:b.status==="confirmed"?`✅ Booking #${b.id} Confirmed!`:`⏳ Booking #${b.id} ${b.status}`,message:`${b.ambulance_number||"—"} · ${b.pickup_location||"—"}`,status:b.status,timestamp:b.created_at}))); setUnread(mine.filter(b=>b.status==="confirmed").length); }
    }).catch(()=>{});
  };
  useEffect(()=>{ fetchN(); const t=setInterval(fetchN,8000); window.addEventListener("new-booking",fetchN); return()=>{ clearInterval(t); window.removeEventListener("new-booking",fetchN); }; },[role,ambId]);

  useEffect(()=>{
    const h=(e)=>{ if(bellRef.current&&!bellRef.current.contains(e.target)) setShowBell(false); if(searchRef.current&&!searchRef.current.contains(e.target)) setShowDrop(false); if(profRef.current&&!profRef.current.contains(e.target)) setShowProf(false); };
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  const doSearch = async()=>{
    const q=search.trim().toLowerCase(); if(!q) return;
    setLoading(true); setShowDrop(true);
    try{
      const [ar,hr]=await Promise.all([fetch("http://127.0.0.1:8000/api/ambulances/"),fetch("http://127.0.0.1:8000/api/hospitals/")]);
      const [ad,hd]=await Promise.all([ar.json(),hr.json()]);
      setResults({
        ambulances:ad.filter(a=>(a.ambulance_number||"").toLowerCase().includes(q)||(a.driver||"").toLowerCase().includes(q)||(a.location||"").toLowerCase().includes(q)).slice(0,5),
        hospitals: hd.filter(h=>(h.name||"").toLowerCase().includes(q)||(h.address||"").toLowerCase().includes(q)).slice(0,5),
      });
    }catch{ setResults({ambulances:[],hospitals:[]}); }
    setLoading(false);
  };

  const handleKD=(e)=>{ if(e.key==="Enter") doSearch(); if(e.key==="Escape"){setShowDrop(false);setShowMobS(false);} };
  const handleSC=(e)=>{ setSearch(e.target.value); if(!e.target.value.trim()){setShowDrop(false);setResults({ambulances:[],hospitals:[]});} };
  const goTo=(p)=>{ navigate(p); setShowDrop(false); setShowMobS(false); setSearch(""); };
  const logout=()=>{ ["user","name","role"].forEach(k=>localStorage.removeItem(k)); window.location.reload(); };

  const SC_NOTIF = {
    confirmed: { c: "var(--sr-success-text)", bg: "var(--sr-success-bg)", b: "var(--sr-success-text)" },
    cancelled: { c: "var(--sr-danger-text)", bg: "var(--sr-danger-bg)", b: "var(--sr-danger-text)" },
    pending: { c: "var(--sr-warning-text)", bg: "var(--sr-warning-bg)", b: "var(--sr-warning-text)" },
    completed: { c: "var(--sr-text-sub)", bg: "var(--sr-badge-bg)", b: "var(--sr-input-border)" },
  };

  const total = results.ambulances.length + results.hospitals.length;
  const themeOptions = [
    { key: "dark", label: "Night" },
    { key: "grey", label: "Steel" },
    { key: "white", label: "Day" },
  ];
  const scrollOptions = [
    { key: "lenis", label: "Lenis" },
    { key: "locomotive", label: "Loco" },
  ];

  return(
    <>
      <style>{`
        .tn {
          position:fixed; top:0; left:var(--sb-w); right:0; height:var(--nav-h); z-index:1000;
          background:var(--sr-glass); border-bottom:1px solid var(--sr-nav-border);
          display:flex; align-items:center; padding:0 28px; gap:14px;
          font-family:var(--font-body);
          backdrop-filter:blur(16px);
          box-shadow:var(--shadow);
          box-sizing:border-box;
        }

        /* Search */
        .tn-sw { position:relative; flex-shrink:0; }
        .tn-si { display:flex;align-items:center;background:var(--sr-nav-input-bg);border:1.5px solid var(--sr-nav-input-border);border-radius:14px;height:42px;width:360px;overflow:hidden;transition:border-color .2s,box-shadow .2s,transform .16s; }
        .tn-si:focus-within { border-color:var(--sr-accent); box-shadow:var(--sr-focus-ring); background:var(--sr-surface); transform:translateY(-1px); }
        .tn-si-ic { padding:0 10px; display:flex;align-items:center;flex-shrink:0;color:var(--sr-nav-text-muted); }
        .tn-inp   { flex:1;background:transparent;border:none;outline:none;color:var(--sr-nav-text);font-size:13px;font-family:inherit;min-width:0; }
        .tn-inp::placeholder{color:var(--sr-nav-text-muted);}
        .tn-sbtn  { height:100%;padding:0 16px;background:var(--sr-brand-grad);border:none;color:#fff;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;border-radius:0 100px 100px 0;transition:transform .15s,filter .15s; }
        .tn-sbtn:hover{transform:translateX(1px);filter:brightness(1.03);}
        .tn-mob-s { display:none;width:38px;height:38px;border-radius:10px;background:var(--sr-nav-input-bg);border:1.5px solid var(--sr-nav-input-border);color:var(--sr-nav-text-sub);align-items:center;justify-content:center;cursor:pointer;flex-shrink:0; }
        .tn-mob-ov { display:none;position:fixed;top:var(--nav-h);left:0;right:0;background:var(--sr-glass);border-bottom:1px solid var(--sr-nav-border);padding:10px 16px;z-index:1050;gap:8px;align-items:center;backdrop-filter:blur(14px); }
        .tn-mob-ov.open{display:flex;}

        /* Search dropdown */
        .tn-sd { position:absolute;top:50px;left:0;width:min(440px,95vw);background:color-mix(in srgb, var(--sr-surface) 90%, transparent);border:1.5px solid var(--sr-border);border-radius:18px;box-shadow:var(--shadow2);z-index:1100;overflow:hidden;backdrop-filter:blur(10px); }
        .tn-sd-msg { padding:18px;text-align:center;font-size:12px;color:var(--sr-text-muted); }
        .tn-sd-sec { padding:10px 14px 4px;font-size:10px;font-weight:800;color:var(--sr-accent);letter-spacing:1px;text-transform:uppercase; }
        .tn-sd-item { display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--sr-border);transition:background .14s;cursor:pointer; }
        .tn-sd-item:hover{background:var(--sr-hover);}
        .tn-sd-ico { width:30px;height:30px;border-radius:8px;background:var(--sr-accent-muted);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0; }
        .tn-sd-info { flex:1;min-width:0; }
        .tn-sd-name { font-size:12px;font-weight:700;color:var(--sr-nav-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .tn-sd-sub  { font-size:10px;color:var(--sr-text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .tn-sd-btn  { font-size:10px;font-weight:700;background:var(--sr-accent);color:#fff;border:none;border-radius:7px;padding:4px 10px;cursor:pointer;font-family:inherit;white-space:nowrap; }
        .tn-sd-btn:hover{background:var(--sr-accent-hover);}
        .tn-sd-ft { display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-top:1px solid var(--sr-border);background:var(--sr-hover);font-size:11px;color:var(--sr-text-muted); }
        .tn-sd-ft button { font-size:11px;font-weight:700;color:var(--sr-accent);background:none;border:none;cursor:pointer;font-family:inherit; }

        .tn-sp { flex:1; }

        /* Theme switch */
        .tn-theme {
          display:flex; align-items:center; gap:6px;
          background:var(--sr-nav-input-bg);
          border:1.5px solid var(--sr-nav-input-border);
          border-radius:999px;
          padding:4px;
          flex-shrink:0;
        }
        .tn-theme-btn {
          border:none; cursor:pointer; font-family:inherit;
          font-size:10px; font-weight:700; letter-spacing:.3px;
          padding:6px 10px; border-radius:999px;
          background:transparent; color:var(--sr-nav-text-sub);
          transition:all .15s;
        }
        .tn-theme-btn:hover { color:var(--sr-nav-text); }
        .tn-theme-btn.on {
          background:var(--sr-brand-grad);
          color:#fff;
          box-shadow:0 6px 16px var(--sr-accent-muted);
        }
        .tn-scroll {
          display:flex; align-items:center; gap:4px;
          background:var(--sr-nav-input-bg);
          border:1.5px solid var(--sr-nav-input-border);
          border-radius:999px;
          padding:4px;
          flex-shrink:0;
        }
        .tn-scroll-btn {
          border:none; cursor:pointer; font-family:inherit;
          font-size:10px; font-weight:700; letter-spacing:.3px;
          padding:6px 9px; border-radius:999px;
          background:transparent; color:var(--sr-nav-text-sub);
          transition:all .15s;
        }
        .tn-scroll-btn.on {
          background:var(--sr-surface-2);
          color:var(--sr-text);
        }

        /* Bell */
        .tn-bw { position:relative;flex-shrink:0; z-index:1202; }
        .tn-b  { width:40px;height:40px;border-radius:100px;background:var(--sr-nav-input-bg);border:1.5px solid var(--sr-nav-input-border);color:var(--sr-icon);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s; }
        .tn-b:hover{border-color:var(--sr-accent);color:var(--sr-accent);transform:translateY(-1px);}
        .tn-badge { position:absolute;top:-5px;right:-5px;background:var(--sr-accent);color:#fff;font-size:9px;font-weight:800;border-radius:100px;min-width:17px;height:17px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid var(--sr-surface); }
        .tn-drop  {
          position:absolute;top:50px;right:0;width:300px;
          background:var(--sr-surface);
          border:1.5px solid var(--sr-border);border-radius:18px;
          box-shadow:var(--shadow2);z-index:5000;overflow:hidden;
          backdrop-filter:blur(16px);
        }
        .tn-drop-hd { padding:11px 13px;border-bottom:1px solid var(--sr-border);display:flex;justify-content:space-between;align-items:center; }
        .tn-drop-title { font-size:13px;font-weight:700;color:var(--sr-nav-text); }
        .tn-drop-ct { font-size:10px;color:var(--sr-text-muted);background:var(--sr-nav-input-bg);border-radius:100px;padding:2px 9px; }
        .tn-drop-list {
          max-height:min(260px,46vh);
          overflow-y:auto;
          scrollbar-width:thin;
          overscroll-behavior:contain;
          background:var(--sr-surface);
        }
        .tn-drop-item { padding:8px 12px;border-bottom:1px solid var(--sr-border);cursor:pointer;transition:background .14s; }
        .tn-drop-item:hover{background:var(--sr-hover);}
        .tn-drop-item:last-child{border-bottom:none;}
        .tn-drop-name { font-size:12px;font-weight:700;color:var(--sr-nav-text); }
        .tn-drop-msg  { font-size:9px;color:var(--sr-text-muted);margin-top:1px; }
        .tn-drop-st   { display:inline-flex;font-size:8px;font-weight:800;padding:2px 8px;border-radius:100px;border:1px solid;text-transform:uppercase;margin-top:5px; }
        .tn-drop-empty{ padding:18px;text-align:center;font-size:11px;color:var(--sr-text-muted); }
        .tn-drop-ft   { padding:8px 12px;border-top:1px solid var(--sr-border);text-align:center; }
        .tn-drop-ft button { font-size:12px;font-weight:700;color:var(--sr-accent);background:none;border:none;cursor:pointer;font-family:inherit; }

        /* User */
        .tn-user { display:flex;align-items:center;gap:9px;flex-shrink:0; }
        .tn-uname { font-size:13px;font-weight:700;color:var(--sr-text);white-space:nowrap;letter-spacing:.1px; }
        .tn-rbadge { font-size:9px;font-weight:800;background:var(--sr-accent-muted);color:var(--sr-accent);border:1px solid var(--red-border);border-radius:100px;padding:3px 10px;text-transform:uppercase;white-space:nowrap; }
        .tn-avw { position:relative;flex-shrink:0;cursor:pointer; }
        .tn-av  { width:38px;height:38px;border-radius:100px;background:var(--sr-brand-grad);border:2px solid var(--red-border);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;overflow:hidden;transition:box-shadow .2s; }
        .tn-avw:hover .tn-av { box-shadow:0 0 0 3px var(--sr-accent-muted); }
        .tn-av img { width:100%;height:100%;object-fit:cover;border-radius:50%; }
        .tn-av-ov { position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.32);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;pointer-events:none; }
        .tn-avw:hover .tn-av-ov{opacity:1;}
        .tn-pd { position:absolute;top:48px;right:0;min-width:228px;background:color-mix(in srgb, var(--sr-surface) 92%, transparent);border:1.5px solid var(--sr-border);border-radius:16px;box-shadow:var(--shadow2);z-index:1100;overflow:hidden;padding:8px 0;backdrop-filter:blur(10px); }
        .tn-pd-hd { padding:14px 16px 12px;border-bottom:1px solid var(--sr-border);text-align:center; }
        .tn-pd-dp { width:48px;height:48px;border-radius:100px;background:var(--sr-brand-grad);border:2px solid var(--red-border);overflow:hidden;margin:0 auto 9px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff; }
        .tn-pd-dp img { width:100%;height:100%;object-fit:cover; }
        .tn-pd-name  { font-size:14px;font-weight:700;color:var(--sr-nav-text); }
        .tn-pd-email { font-size:10px;color:var(--sr-text-muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:175px; }
        .tn-pd-role  { font-size:9px;font-weight:700;color:var(--sr-accent);text-transform:uppercase;letter-spacing:.5px;margin-top:3px; }
        .tn-pd-item  { display:flex;align-items:center;gap:9px;padding:9px 16px;font-size:12px;font-weight:500;color:var(--sr-text-sub);cursor:pointer;transition:background .14s; }
        .tn-pd-item:hover{background:var(--sr-hover);color:var(--sr-nav-text);}
        .tn-pd-item.red{color:var(--sr-accent);}
        .tn-pd-item.red:hover{background:var(--sr-accent-muted);}

        @media(max-width:767px){
          .tn{left:0!important;padding:0 12px;gap:6px;}
          .tn-sw{display:none;}
          .tn-theme{display:none;}
          .tn-scroll{display:none;}
          .tn-mob-s{display:flex;}
          .tn-uname{display:none;}
          .tn-rbadge{display:none;}
          .tn-b{width:34px;height:34px;}
          .tn-drop{
            position:fixed;
            top:calc(var(--nav-h) + 8px);
            left:8px;
            right:8px;
            width:auto;
            max-height:calc(100vh - var(--nav-h) - 16px);
            border-radius:14px;
            background:var(--sr-surface);
            backdrop-filter:none;
          }
          .tn-drop-list{
            max-height:calc(100vh - var(--nav-h) - 120px);
            background:var(--sr-surface);
          }
        }
        @media(max-width:480px){ .tn-av{width:32px;height:32px;font-size:13px;} }
      `}</style>

      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{setPic(ev.target.result);localStorage.setItem(dpKey,ev.target.result);setShowProf(false);};r.readAsDataURL(f);}}/>

      <div className="tn">
        {/* Search */}
        <div className="tn-sw" ref={searchRef}>
          <div className="tn-si">
            <div className="tn-si-ic"><Search size={13}/></div>
            <input className="tn-inp" value={search} onChange={handleSC} onKeyDown={handleKD} placeholder="Search ambulances, hospitals..."/>
            <button className="tn-sbtn" onClick={doSearch}>Search</button>
          </div>
          {showDrop&&(
            <div className="tn-sd">
              {loading ? <div className="tn-sd-msg">Searching...</div>
               : total===0 ? <div className="tn-sd-msg">No results for "{search}"</div>
               : <>
                  {results.ambulances.length>0&&<>
                    <div className="tn-sd-sec">🚑 Ambulances</div>
                    {results.ambulances.map(a=>(
                      <div key={a.id} className="tn-sd-item" onClick={()=>goTo("/Ambulances")}>
                        <div className="tn-sd-ico">🚑</div>
                        <div className="tn-sd-info"><div className="tn-sd-name">{a.ambulance_number}</div><div className="tn-sd-sub">{a.driver} · {a.location||"—"}</div></div>
                        <button className="tn-sd-btn">Details →</button>
                      </div>
                    ))}
                    <div className="tn-sd-ft"><span>{results.ambulances.length} result(s)</span><button onClick={()=>goTo("/Ambulances")}>View All →</button></div>
                  </>}
                  {results.hospitals.length>0&&<>
                    <div className="tn-sd-sec">🏥 Hospitals</div>
                    {results.hospitals.map(h=>(
                      <div key={h.id} className="tn-sd-item" onClick={()=>goTo("/Hospitals")}>
                        <div className="tn-sd-ico">🏥</div>
                        <div className="tn-sd-info"><div className="tn-sd-name">{h.name}</div><div className="tn-sd-sub">{h.address} · Beds:{h.available_beds??'—'}</div></div>
                        <button className="tn-sd-btn">Details →</button>
                      </div>
                    ))}
                    <div className="tn-sd-ft"><span>{results.hospitals.length} result(s)</span><button onClick={()=>goTo("/Hospitals")}>View All →</button></div>
                  </>}
                 </>}
            </div>
          )}
        </div>

        <button className="tn-mob-s" onClick={()=>setShowMobS(s=>!s)}>
          {showMobS?<X size={14}/>:<Search size={14}/>}
        </button>

        <div className="tn-sp"/>
        <div className="tn-theme">
          {themeOptions.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`tn-theme-btn ${theme === t.key ? "on" : ""}`}
              onClick={() => setTheme(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="tn-scroll">
          {scrollOptions.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`tn-scroll-btn ${engine === s.key ? "on" : ""}`}
              onClick={() => setEngine(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Bell */}
        <div className="tn-bw" ref={bellRef}>
          <button className="tn-b" onClick={()=>{setShowBell(d=>!d);setUnread(0);}}>
            <Bell size={15}/>
          </button>
          {unread>0&&<span className="tn-badge">{unread>9?"9+":unread}</span>}
          {showBell&&(
            <div className="tn-drop">
              <div className="tn-drop-hd">
                <span className="tn-drop-title">Notifications</span>
                <span className="tn-drop-ct">{notifs.length}</span>
              </div>
              <div className="tn-drop-list">
                {notifs.length===0
                  ?<div className="tn-drop-empty">No notifications</div>
                  :notifs.map((n,i)=>{
                    const sc=SC_NOTIF[n.status]||SC_NOTIF.pending;
                    return(
                      <div key={i} className="tn-drop-item" onClick={()=>{setShowBell(false);navigate(role==="admin"?"/Requests":role==="driver"?"/":"/Ambulances");}}>
                        <div className="tn-drop-name">{n.title}</div>
                        <div className="tn-drop-msg">{n.message}</div>
                        <span className="tn-drop-st" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}>{n.status}</span>
                      </div>
                    );
                  })}
              </div>
              <div className="tn-drop-ft">
                <button onClick={()=>{setShowBell(false);navigate(role==="admin"?"/Requests":"/Ambulances");}}>
                  {role==="admin"?"View All Bookings →":"Go to Ambulances →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="tn-user">
          {user?(
            <>
              <span className="tn-uname">{user}</span>
              {isAdmin&&<span className="tn-rbadge">Admin</span>}
              <div className="tn-avw" ref={profRef} onClick={()=>setShowProf(m=>!m)}>
                <div className="tn-av">{pic?<img src={pic} alt=""/>:<span>{user[0]?.toUpperCase()}</span>}</div>
                <div className="tn-av-ov"><Camera size={12} color="white"/></div>
                {showProf&&(
                  <div className="tn-pd" onClick={e=>e.stopPropagation()}>
                    <div className="tn-pd-hd">
                      <div className="tn-pd-dp">{pic?<img src={pic} alt=""/>:<span>{user[0]?.toUpperCase()}</span>}</div>
                      <div className="tn-pd-name">{user}</div>
                      <div className="tn-pd-email">{email}</div>
                      {role&&<div className="tn-pd-role">{role}</div>}
                    </div>
                    <div className="tn-pd-item" onClick={()=>fileRef.current?.click()}>
                      <Camera size={13}/>{pic?"Change Photo":"Upload Photo"}
                    </div>
                    {pic&&<div className="tn-pd-item red" onClick={()=>{setPic(null);localStorage.removeItem(dpKey);}}>
                      <X size={13}/>Remove Photo
                    </div>}
                    <div className="tn-pd-item red" onClick={logout}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Log out
                    </div>
                  </div>
                )}
              </div>
            </>
          ):(
            <><div className="tn-av"><span>U</span></div><Link to="/login" style={{fontSize:13,fontWeight:600,color:"var(--sr-text-sub)",textDecoration:"none"}}>Login</Link></>
          )}
        </div>
      </div>

      {/* Mobile search overlay */}
      <div className={`tn-mob-ov ${showMobS?"open":""}`}>
        <div className="tn-si" style={{flex:1}}>
          <div className="tn-si-ic"><Search size={13}/></div>
          <input className="tn-inp" value={search} onChange={handleSC} onKeyDown={handleKD} placeholder="Search..." autoFocus/>
          <button className="tn-sbtn" onClick={doSearch}>Go</button>
        </div>
      </div>

      {/* Mobile search results dropdown */}
      {showMobS && showDrop && (total > 0 || loading) && (
        <div style={{position:"fixed",top:"122px",left:"8px",right:"8px",background:"var(--sr-surface)",border:"1.5px solid var(--sr-border)",borderRadius:14,boxShadow:"var(--shadow2)",zIndex:1200,maxHeight:"62vh",overflowY:"auto"}}>
          {loading
            ? <div style={{padding:18,textAlign:"center",fontSize:12,color:"var(--sr-text-muted)"}}>Searching...</div>
            : total === 0
            ? <div style={{padding:18,textAlign:"center",fontSize:12,color:"var(--sr-text-muted)"}}>No results for "{search}"</div>
            : <>
                {results.ambulances.length > 0 && <>
                  <div style={{padding:"10px 14px 4px",fontSize:10,fontWeight:800,color:"var(--sr-accent)",letterSpacing:1,textTransform:"uppercase"}}>🚑 Ambulances</div>
                  {results.ambulances.map(a => (
                    <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:"1px solid var(--sr-border)",cursor:"pointer"}} onClick={()=>goTo("/Ambulances")}>
                      <div style={{width:28,height:28,borderRadius:7,background:"var(--sr-accent-muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🚑</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"var(--sr-text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.ambulance_number}</div>
                        <div style={{fontSize:10,color:"var(--sr-text-muted)"}}>{a.driver} · {a.location||"—"}</div>
                      </div>
                      <button style={{fontSize:10,fontWeight:700,background:"var(--sr-accent)",color:"white",border:"none",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"inherit"}}>Details →</button>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 14px",borderTop:"1px solid var(--sr-border)",background:"var(--sr-hover)",fontSize:11,color:"var(--sr-text-muted)"}}>
                    <span>{results.ambulances.length} result(s)</span>
                    <button style={{fontSize:11,fontWeight:700,color:"var(--sr-accent)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>goTo("/Ambulances")}>View All →</button>
                  </div>
                </>}
                {results.hospitals.length > 0 && <>
                  <div style={{padding:"10px 14px 4px",fontSize:10,fontWeight:800,color:"var(--sr-accent)",letterSpacing:1,textTransform:"uppercase"}}>🏥 Hospitals</div>
                  {results.hospitals.map(h => (
                    <div key={h.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:"1px solid var(--sr-border)",cursor:"pointer"}} onClick={()=>goTo("/Hospitals")}>
                      <div style={{width:28,height:28,borderRadius:7,background:"var(--sr-accent-muted)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🏥</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"var(--sr-text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{h.name}</div>
                        <div style={{fontSize:10,color:"var(--sr-text-muted)"}}>{h.address} · Beds:{h.available_beds??'—'}</div>
                      </div>
                      <button style={{fontSize:10,fontWeight:700,background:"var(--sr-accent)",color:"white",border:"none",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"inherit"}}>Details →</button>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 14px",borderTop:"1px solid var(--sr-border)",background:"var(--sr-hover)",fontSize:11,color:"var(--sr-text-muted)"}}>
                    <span>{results.hospitals.length} result(s)</span>
                    <button style={{fontSize:11,fontWeight:700,color:"var(--sr-accent)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>goTo("/Hospitals")}>View All →</button>
                  </div>
                </>}
              </>}
        </div>
      )}
    </>
  );
}
