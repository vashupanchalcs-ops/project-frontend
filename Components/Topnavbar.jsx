import { Bell, Search, X, Camera } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
      if(role==="admin"){ setNotifs(data.slice(0,8)); setUnread(data.filter(b=>!b.is_read).length); }
      else if(role==="driver"){ const mine=data.filter(b=>b.ambulance_id===ambId).slice(0,8); setNotifs(mine.map(b=>({id:b.id,title:`🚑 #${b.id} — ${b.status}`,message:`${b.booked_by} · ${b.pickup_location}`,status:b.status,timestamp:b.created_at}))); setUnread(mine.filter(b=>b.status==="confirmed").length); }
      else { const mine=data.filter(b=>b.booked_by_email===email||b.booked_by===user).sort((a,b)=>b.id-a.id).slice(0,8); setNotifs(mine.map(b=>({id:b.id,title:b.status==="confirmed"?`✅ Booking #${b.id} Confirmed!`:`⏳ Booking #${b.id} ${b.status}`,message:`${b.ambulance_number||"—"} · ${b.pickup_location||"—"}`,status:b.status,timestamp:b.created_at}))); setUnread(mine.filter(b=>b.status==="confirmed").length); }
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
    confirmed: {c:"#00875a",bg:"rgba(0,135,90,0.09)",b:"rgba(0,135,90,0.22)"},
    cancelled: {c:"#E50914",bg:"rgba(229,9,20,0.09)",b:"rgba(229,9,20,0.22)"},
    pending:   {c:"#b36800",bg:"rgba(179,104,0,0.09)",b:"rgba(179,104,0,0.22)"},
    completed: {c:"#6e6e73",bg:"rgba(0,0,0,0.05)",b:"rgba(0,0,0,0.12)"},
  };

  const total = results.ambulances.length + results.hospitals.length;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

        .tn {
          position:fixed; top:0; left:200px; right:0; height:60px; z-index:1000;
          background:rgba(255,255,255,0.97); border-bottom:1px solid rgba(0,0,0,0.08);
          display:flex; align-items:center; padding:0 24px; gap:12px;
          font-family:'DM Sans',sans-serif;
          backdrop-filter:blur(12px);
          box-shadow:0 1px 12px rgba(0,0,0,0.05);
          box-sizing:border-box;
        }

        /* Search */
        .tn-sw { position:relative; flex-shrink:0; }
        .tn-si { display:flex;align-items:center;background:#f0f0f2;border:1.5px solid rgba(0,0,0,0.1);border-radius:12px;height:40px;width:340px;overflow:hidden;transition:border-color .2s,box-shadow .2s; }
        .tn-si:focus-within { border-color:#E50914; box-shadow:0 0 0 3px rgba(229,9,20,0.08); background:#fff; }
        .tn-si-ic { padding:0 10px; display:flex;align-items:center;flex-shrink:0;color:rgba(0,0,0,0.3); }
        .tn-inp   { flex:1;background:transparent;border:none;outline:none;color:#0a0a0a;font-size:13px;font-family:inherit;min-width:0; }
        .tn-inp::placeholder{color:rgba(0,0,0,0.3);}
        .tn-sbtn  { height:100%;padding:0 16px;background:#E50914;border:none;color:#fff;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;border-radius:0 100px 100px 0;transition:background .15s; }
        .tn-sbtn:hover{background:#c8000f;}
        .tn-mob-s { display:none;width:38px;height:38px;border-radius:10px;background:#f0f0f2;border:1.5px solid rgba(0,0,0,0.1);color:rgba(0,0,0,0.5);align-items:center;justify-content:center;cursor:pointer;flex-shrink:0; }
        .tn-mob-ov { display:none;position:fixed;top:60px;left:0;right:0;background:rgba(255,255,255,0.97);border-bottom:1px solid rgba(0,0,0,0.08);padding:10px 16px;z-index:1050;gap:8px;align-items:center; }
        .tn-mob-ov.open{display:flex;}

        /* Search dropdown */
        .tn-sd { position:absolute;top:46px;left:0;width:min(420px,95vw);background:#fff;border:1.5px solid rgba(0,0,0,0.09);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.1);z-index:1100;overflow:hidden; }
        .tn-sd-msg { padding:18px;text-align:center;font-size:12px;color:#a1a1a6; }
        .tn-sd-sec { padding:10px 14px 4px;font-size:10px;font-weight:800;color:#E50914;letter-spacing:1px;text-transform:uppercase; }
        .tn-sd-item { display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(0,0,0,0.06);transition:background .14s;cursor:pointer; }
        .tn-sd-item:hover{background:rgba(0,0,0,0.025);}
        .tn-sd-ico { width:30px;height:30px;border-radius:8px;background:rgba(229,9,20,0.07);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0; }
        .tn-sd-info { flex:1;min-width:0; }
        .tn-sd-name { font-size:12px;font-weight:700;color:#0a0a0a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .tn-sd-sub  { font-size:10px;color:#a1a1a6;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .tn-sd-btn  { font-size:10px;font-weight:700;background:#E50914;color:#fff;border:none;border-radius:7px;padding:4px 10px;cursor:pointer;font-family:inherit;white-space:nowrap; }
        .tn-sd-btn:hover{background:#c8000f;}
        .tn-sd-ft { display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-top:1px solid rgba(0,0,0,0.06);background:rgba(0,0,0,0.02);font-size:11px;color:#a1a1a6; }
        .tn-sd-ft button { font-size:11px;font-weight:700;color:#E50914;background:none;border:none;cursor:pointer;font-family:inherit; }

        .tn-sp { flex:1; }

        /* Bell */
        .tn-bw { position:relative;flex-shrink:0; }
        .tn-b  { width:38px;height:38px;border-radius:100px;background:#f0f0f2;border:1.5px solid rgba(0,0,0,0.1);color:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s; }
        .tn-b:hover{border-color:#E50914;color:#E50914;}
        .tn-badge { position:absolute;top:-5px;right:-5px;background:#E50914;color:#fff;font-size:9px;font-weight:800;border-radius:100px;min-width:17px;height:17px;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff; }
        .tn-drop  { position:absolute;top:46px;right:0;width:320px;background:#fff;border:1.5px solid rgba(0,0,0,0.09);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.1);z-index:1100;overflow:hidden; }
        .tn-drop-hd { padding:14px 16px;border-bottom:1px solid rgba(0,0,0,0.07);display:flex;justify-content:space-between;align-items:center; }
        .tn-drop-title { font-size:13px;font-weight:700;color:#0a0a0a; }
        .tn-drop-ct { font-size:10px;color:#a1a1a6;background:#f0f0f2;border-radius:100px;padding:2px 9px; }
        .tn-drop-list { max-height:310px;overflow-y:auto;scrollbar-width:thin; }
        .tn-drop-item { padding:11px 16px;border-bottom:1px solid rgba(0,0,0,0.06);cursor:pointer;transition:background .14s; }
        .tn-drop-item:hover{background:rgba(0,0,0,0.025);}
        .tn-drop-item:last-child{border-bottom:none;}
        .tn-drop-name { font-size:12px;font-weight:700;color:#0a0a0a; }
        .tn-drop-msg  { font-size:10px;color:#a1a1a6;margin-top:2px; }
        .tn-drop-st   { display:inline-flex;font-size:8px;font-weight:800;padding:2px 8px;border-radius:100px;border:1px solid;text-transform:uppercase;margin-top:5px; }
        .tn-drop-empty{ padding:28px;text-align:center;font-size:12px;color:#a1a1a6; }
        .tn-drop-ft   { padding:10px 16px;border-top:1px solid rgba(0,0,0,0.06);text-align:center; }
        .tn-drop-ft button { font-size:12px;font-weight:700;color:#E50914;background:none;border:none;cursor:pointer;font-family:inherit; }

        /* User */
        .tn-user { display:flex;align-items:center;gap:9px;flex-shrink:0; }
        .tn-uname { font-size:13px;font-weight:600;color:#3d3d3d;white-space:nowrap; }
        .tn-rbadge { font-size:9px;font-weight:800;background:rgba(229,9,20,0.09);color:#E50914;border:1px solid rgba(229,9,20,0.2);border-radius:100px;padding:3px 10px;text-transform:uppercase;white-space:nowrap; }
        .tn-avw { position:relative;flex-shrink:0;cursor:pointer; }
        .tn-av  { width:36px;height:36px;border-radius:100px;background:#E50914;border:2px solid rgba(229,9,20,0.25);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;overflow:hidden;transition:box-shadow .2s; }
        .tn-avw:hover .tn-av { box-shadow:0 0 0 3px rgba(229,9,20,0.18); }
        .tn-av img { width:100%;height:100%;object-fit:cover;border-radius:50%; }
        .tn-av-ov { position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;pointer-events:none; }
        .tn-avw:hover .tn-av-ov{opacity:1;}
        .tn-pd { position:absolute;top:44px;right:0;min-width:210px;background:#fff;border:1.5px solid rgba(0,0,0,0.09);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.1);z-index:1100;overflow:hidden;padding:6px 0; }
        .tn-pd-hd { padding:14px 16px 12px;border-bottom:1px solid rgba(0,0,0,0.07);text-align:center; }
        .tn-pd-dp { width:46px;height:46px;border-radius:100px;background:#E50914;border:2px solid rgba(229,9,20,0.25);overflow:hidden;margin:0 auto 9px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:#fff; }
        .tn-pd-dp img { width:100%;height:100%;object-fit:cover; }
        .tn-pd-name  { font-size:14px;font-weight:700;color:#0a0a0a; }
        .tn-pd-email { font-size:10px;color:#a1a1a6;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:175px; }
        .tn-pd-role  { font-size:9px;font-weight:700;color:#E50914;text-transform:uppercase;letter-spacing:.5px;margin-top:3px; }
        .tn-pd-item  { display:flex;align-items:center;gap:9px;padding:9px 16px;font-size:12px;font-weight:500;color:#3d3d3d;cursor:pointer;transition:background .14s; }
        .tn-pd-item:hover{background:rgba(0,0,0,0.03);color:#0a0a0a;}
        .tn-pd-item.red{color:#E50914;}
        .tn-pd-item.red:hover{background:rgba(229,9,20,0.05);}

        @media(max-width:767px){
          .tn{left:0!important;padding:0 12px;gap:6px;}
          .tn-sw{display:none;}
          .tn-mob-s{display:flex;}
          .tn-uname{display:none;}
          .tn-rbadge{display:none;}
          .tn-b{width:34px;height:34px;}
          .tn-drop{width:calc(100vw - 20px);right:-8px;}
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
                <div className="tn-av-ov"><Camera size={12} color="#fff"/></div>
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
            <><div className="tn-av"><span>U</span></div><Link to="/login" style={{fontSize:13,fontWeight:600,color:"#3d3d3d",textDecoration:"none"}}>Login</Link></>
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
        <div style={{position:"fixed",top:"122px",left:"8px",right:"8px",background:"#fff",border:"1.5px solid rgba(0,0,0,0.09)",borderRadius:14,boxShadow:"0 16px 48px rgba(0,0,0,0.15)",zIndex:1200,maxHeight:"62vh",overflowY:"auto"}}>
          {loading
            ? <div style={{padding:18,textAlign:"center",fontSize:12,color:"#a1a1a6"}}>Searching...</div>
            : total === 0
            ? <div style={{padding:18,textAlign:"center",fontSize:12,color:"#a1a1a6"}}>No results for "{search}"</div>
            : <>
                {results.ambulances.length > 0 && <>
                  <div style={{padding:"10px 14px 4px",fontSize:10,fontWeight:800,color:"#E50914",letterSpacing:1,textTransform:"uppercase"}}>🚑 Ambulances</div>
                  {results.ambulances.map(a => (
                    <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:"1px solid rgba(0,0,0,0.06)",cursor:"pointer"}} onClick={()=>goTo("/Ambulances")}>
                      <div style={{width:28,height:28,borderRadius:7,background:"rgba(229,9,20,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🚑</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#0a0a0a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.ambulance_number}</div>
                        <div style={{fontSize:10,color:"#a1a1a6"}}>{a.driver} · {a.location||"—"}</div>
                      </div>
                      <button style={{fontSize:10,fontWeight:700,background:"#E50914",color:"#fff",border:"none",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"inherit"}}>Details →</button>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 14px",borderTop:"1px solid rgba(0,0,0,0.06)",background:"rgba(0,0,0,0.02)",fontSize:11,color:"#a1a1a6"}}>
                    <span>{results.ambulances.length} result(s)</span>
                    <button style={{fontSize:11,fontWeight:700,color:"#E50914",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>goTo("/Ambulances")}>View All →</button>
                  </div>
                </>}
                {results.hospitals.length > 0 && <>
                  <div style={{padding:"10px 14px 4px",fontSize:10,fontWeight:800,color:"#E50914",letterSpacing:1,textTransform:"uppercase"}}>🏥 Hospitals</div>
                  {results.hospitals.map(h => (
                    <div key={h.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:"1px solid rgba(0,0,0,0.06)",cursor:"pointer"}} onClick={()=>goTo("/Hospitals")}>
                      <div style={{width:28,height:28,borderRadius:7,background:"rgba(26,115,232,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🏥</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#0a0a0a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{h.name}</div>
                        <div style={{fontSize:10,color:"#a1a1a6"}}>{h.address} · Beds:{h.available_beds??'—'}</div>
                      </div>
                      <button style={{fontSize:10,fontWeight:700,background:"#E50914",color:"#fff",border:"none",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontFamily:"inherit"}}>Details →</button>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 14px",borderTop:"1px solid rgba(0,0,0,0.06)",background:"rgba(0,0,0,0.02)",fontSize:11,color:"#a1a1a6"}}>
                    <span>{results.hospitals.length} result(s)</span>
                    <button style={{fontSize:11,fontWeight:700,color:"#E50914",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>goTo("/Hospitals")}>View All →</button>
                  </div>
                </>}
              </>}
        </div>
      )}
    </>
  );
}
