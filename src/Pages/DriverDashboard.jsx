import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import useLeaflet, { DARK_TILE, DELHI, makePinIcon } from "../hooks/useLeaflet";
import gsap from "gsap";

const BASE = "http://127.0.0.1:8000";
const PING = 5000;
const POLL = 8000;

const reqNotif = async () => { if (!("Notification" in window)) return false; if (Notification.permission==="granted") return true; return (await Notification.requestPermission())==="granted"; };
const pushNotif = (t, b) => { if (Notification.permission!=="granted") return; const n=new Notification(t,{body:b,icon:"https://cdn-icons-png.flaticon.com/512/2966/2966327.png",requireInteraction:true}); setTimeout(()=>n.close(),10000); };

const ST = {
  available:{ c:"var(--sr-success-text)",  bg:"var(--sr-success-bg)", b:"var(--sr-success-text)" },
  en_route: { c:"var(--sr-warning-text)",  bg:"var(--sr-warning-bg)", b:"var(--sr-warning-text)" },
  busy:     { c:"var(--sr-danger-text)",   bg:"var(--sr-danger-bg)",  b:"var(--sr-danger-text)" },
  offline:  { c:"var(--sr-text-muted)",    bg:"var(--sr-hover)",      b:"var(--sr-input-border)" },
};

export default function DriverDashboard() {
  const rootRef = useRef(null);
  const navigate     = useNavigate();
  const leafletReady = useLeaflet();

  const driverEmail = localStorage.getItem("user") || "";
  const driverName  = localStorage.getItem("name") || "Driver";
  const ambId       = parseInt(localStorage.getItem("ambulance_id") || "0");
  const ambNumber   = localStorage.getItem("ambulance_number") || "—";
  const driverPhone = localStorage.getItem("phone") || "";

  const [ambulance,  setAmbulance]  = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [location,   setLocation]   = useState(null);
  const [speed,      setSpeed]      = useState(0);
  const [route,      setRoute]      = useState(null);
  const [notifOk,    setNotifOk]    = useState(Notification.permission==="granted");
  const [log,        setLog]        = useState([]);
  const [tab,        setTab]        = useState("dash");
  const [allAmbs,    setAllAmbs]    = useState([]);
  const [allHosp,    setAllHosp]    = useState([]);
  const [notifs,     setNotifs]     = useState([]);
  const [unread,     setUnread]     = useState(0);
  const [changeAmb,  setChangeAmb]  = useState(null);
  const [pendingReq, setPendingReq] = useState(()=>{ try{ return JSON.parse(localStorage.getItem("dr_change_req")||"null"); }catch{ return null; } });

  const mapRef    = useRef(null);
  const mapObj    = useRef(null);
  const drvMark   = useRef(null);
  const routeRef  = useRef(null);
  const latLoc    = useRef(null);
  const watchId   = useRef(null);
  const pingTimer = useRef(null);
  const firstPan  = useRef(true);

  const addLog = (msg,type="info") => setLog(p=>[{msg,type,time:new Date().toLocaleTimeString()},...p].slice(0,30));

  const loadNotifs = useCallback(()=>{
    const k=`dr_notif_${driverEmail}`; try{ const s=JSON.parse(localStorage.getItem(k)||"[]"); setNotifs(s); setUnread(s.filter(n=>!n.read).length); }catch{ setNotifs([]); setUnread(0); }
  },[driverEmail]);

  const fetchData = useCallback(()=>{
    fetch(`${BASE}/api/ambulances/`).then(r=>r.json()).then(d=>{ setAllAmbs(d); const m=d.find(a=>a.id===ambId); if(m) setAmbulance(m); }).catch(()=>{});
    fetch(`${BASE}/api/hospitals/`).then(r=>r.json()).then(setAllHosp).catch(()=>{});
    fetch(`${BASE}/api/bookings/`).then(r=>r.json()).then(d=>{ setMyBookings(d.filter(b=>b.ambulance_id===ambId).sort((a,b)=>b.id-a.id)); }).catch(()=>{});
  },[ambId]);

  useEffect(()=>{
    fetchData(); loadNotifs(); reqNotif().then(ok=>setNotifOk(ok));
    const t1=setInterval(fetchData,POLL); const t2=setInterval(loadNotifs,5000);
    return()=>{ clearInterval(t1); clearInterval(t2); };
  },[fetchData,loadNotifs]);

  useEffect(()=>{
    if(tab!=="map") return;
    if(!leafletReady||!mapRef.current||mapObj.current) return;
    const L=window.L;
    mapObj.current=L.map(mapRef.current,{center:[DELHI.lat,DELHI.lng],zoom:15,minZoom:10,maxZoom:19,zoomControl:false});
    L.tileLayer(DARK_TILE,{maxZoom:19}).addTo(mapObj.current);
    L.control.zoom({position:"bottomright"}).addTo(mapObj.current);
    firstPan.current=true;
    return()=>{ if(mapObj.current){ mapObj.current.remove(); mapObj.current=null; } };
  },[leafletReady,tab]);

  const startTracking=()=>{
    if(!navigator.geolocation){ addLog("GPS not supported","error"); return; }
    setIsTracking(true); firstPan.current=true; addLog("📍 Tracking started","success");
    watchId.current=navigator.geolocation.watchPosition(
      pos=>{ const loc={lat:pos.coords.latitude,lng:pos.coords.longitude}; latLoc.current=loc; setLocation(loc); setSpeed(Math.round((pos.coords.speed||0)*3.6)); if(mapObj.current&&window.L){ if(firstPan.current){ mapObj.current.setView([loc.lat,loc.lng],15); firstPan.current=false; } else mapObj.current.panTo([loc.lat,loc.lng]); if(drvMark.current) drvMark.current.setLatLng([loc.lat,loc.lng]); else{ const ic=makePinIcon("#E50914","🚑"); if(ic) drvMark.current=window.L.marker([loc.lat,loc.lng],{icon:ic}).addTo(mapObj.current).bindPopup(`<div style="background:#fff;color:#0a0a0a;padding:8px 12px;border-radius:8px;font-weight:700;border:1px solid rgba(0,0,0,0.1)">📍 ${driverName}</div>`,{className:"sr-dark-popup"}); } } },
      err=>addLog(`GPS error: ${err.message}`,"error"),
      {enableHighAccuracy:true,maximumAge:2000,timeout:10000}
    );
    sendPing(); pingTimer.current=setInterval(sendPing,PING);
  };

  const stopTracking=()=>{
    if(watchId.current) navigator.geolocation.clearWatch(watchId.current);
    if(pingTimer.current) clearInterval(pingTimer.current);
    watchId.current=pingTimer.current=null; setIsTracking(false); addLog("⏹ Tracking stopped","warn");
  };
  useEffect(()=>()=>stopTracking(),[]);

  const sendPing=useCallback(()=>{
    const loc=latLoc.current; if(!loc||!driverEmail||!ambId) return;
    fetch(`${BASE}/api/driver/ping/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({driver_email:driverEmail,ambulance_id:ambId,latitude:loc.lat,longitude:loc.lng,speed:0})})
      .then(r=>r.json()).then(data=>{ if(data.pending_route){ const nr=data.pending_route; setRoute(prev=>{ if(!prev||prev.id!==nr.id){ addLog("🗺 New route assigned!","success"); pushNotif("🚨 New Route!",`Pickup: ${nr.pickup_location}`); } return nr; }); } }).catch(()=>{});
  },[driverEmail,ambId]);

  const geocode=async addr=>{ const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr+", Delhi, India")}&format=json&limit=1`,{headers:{"Accept-Language":"en"}}); const d=await r.json(); if(!d.length) throw new Error(`"${addr}" not found`); return window.L.latLng(parseFloat(d[0].lat),parseFloat(d[0].lon)); };

  const drawRoute=async(pickup,dest)=>{
    if(!leafletReady||!mapObj.current||!window.L) return;
    const L=window.L; if(routeRef.current){ try{ mapObj.current.removeControl(routeRef.current); }catch{} routeRef.current=null; }
    try{
      const pLL=await geocode(pickup); const dLL=dest?await geocode(dest):null;
      const orig=latLoc.current?L.latLng(latLoc.current.lat,latLoc.current.lng):L.latLng(DELHI.lat,DELHI.lng);
      const r=L.Routing.control({waypoints:[orig,pLL,...(dLL?[dLL]:[])],router:L.Routing.osrmv1({serviceUrl:"https://router.project-osrm.org/route/v1",profile:"driving"}),lineOptions:{styles:[{color:"#E50914",weight:5,opacity:.9}],extendToWaypoints:true,missingRouteTolerance:0},show:false,addWaypoints:false,draggableWaypoints:false,fitSelectedRoutes:true,showAlternatives:false,createMarker:()=>null}).addTo(mapObj.current);
      routeRef.current=r; r.on("routesfound",e=>{ const s=e.routes[0].summary; addLog(`Route: ${(s.totalDistance/1000).toFixed(1)} km, ~${Math.round(s.totalTime/60)} min`,"success"); });
    }catch(err){ addLog(`Route error: ${err.message}`,"error"); }
  };

  const respondRoute=async status=>{
    if(!route?.id) return;
    try{ await fetch(`${BASE}/api/driver/route/${route.id}/respond/`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})}); if(status==="completed"){ setRoute(null); if(routeRef.current){ try{ mapObj.current?.removeControl(routeRef.current); }catch{} routeRef.current=null; } addLog("🏁 Trip complete!","success"); pushNotif("🏁 Trip Complete!","Patient safe."); } else{ setRoute(r=>({...r,status})); addLog(status==="accepted"?"✅ Route accepted":"❌ Route rejected",status==="accepted"?"success":"warn"); } }catch{ addLog("Route update failed","error"); }
  };

  const sendChangeReq=async()=>{
    if(!changeAmb) return;
    const req={driverEmail,driverName,driverPhone,currentAmbId:ambId,currentAmbNumber:ambNumber,newAmbId:changeAmb.id,newAmbNumber:changeAmb.ambulance_number,status:"pending",timestamp:new Date().toISOString()};
    try{ await fetch(`${BASE}/api/ambulances/change-request/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(req)}); localStorage.setItem("dr_change_req",JSON.stringify(req)); setPendingReq(req); setChangeAmb(null); addLog(`Request sent — ${changeAmb.ambulance_number}`,"success"); }catch{ addLog("Request failed","error"); }
  };

  const sc    = ambulance?(ST[ambulance.status]||ST.offline):ST.offline;
  const rbord = route?.status==="pending"?"#E50914":route?.status==="accepted"?"#0a0a0a":"rgba(0,0,0,0.2)";
  const onlineUnits = allAmbs.filter((a) => ["available", "en_route", "busy"].includes(a.status)).length;
  const availableUnits = allAmbs.filter((a) => a.status === "available").length;
  const criticalHospitals = allHosp.filter((h) => ["critical", "full"].includes((h.status || "").toLowerCase())).length;
  const completedTrips = myBookings.filter((b) => b.status === "completed").length;
  const activeTrips = myBookings.filter((b) => ["pending", "confirmed"].includes(b.status)).length;
  const completionRate = myBookings.length ? Math.round((completedTrips / myBookings.length) * 100) : 0;
  const todayTrips = myBookings.filter((b) => {
    if (!b.created_at) return false;
    const d = new Date(b.created_at);
    const n = new Date();
    return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const smartEta = Math.max(9, 26 - Math.min(16, availableUnits * 2));

  const tabs=[
    {k:"dash",  icon:"📊",  label:"Dashboard", count:0},
    {k:"book",  icon:"📋",  label:"Bookings",  count:myBookings.filter(b=>b.status==="confirmed").length},
    {k:"notif", icon:"🔔",  label:"Alerts",    count:unread},
    {k:"amb",   icon:"🚑",  label:"Ambulance", count:0},
    {k:"ambs",  icon:"🚒",  label:"Fleet",     count:0},
    {k:"hosp",  icon:"🏥",  label:"Hospitals", count:0},
  ];

  const switchTab=k=>{ setTab(k); if(k==="notif"){ const u=notifs.map(n=>({...n,read:true})); localStorage.setItem(`dr_notif_${driverEmail}`,JSON.stringify(u)); setNotifs(u); setUnread(0); } };

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".drd-header", { y: -16, autoAlpha: 0, duration: 0.65, ease: "power3.out" });
      gsap.from(".drd-tabs", { y: -12, autoAlpha: 0, duration: 0.55, ease: "power2.out", delay: 0.08 });
      gsap.from(".drd-card, .drd-bcard, .drd-ncard", {
        y: 24,
        autoAlpha: 0,
        duration: 0.6,
        stagger: 0.05,
        ease: "power2.out",
        delay: 0.12,
      });
    }, rootRef);
    return () => ctx.revert();
  }, [tab]);

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const cards = Array.from(rootRef.current.querySelectorAll(".drd-anim-card"));
    if (!cards.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".drd-anim-card",
        { autoAlpha: 0, y: 26, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.62,
          stagger: 0.06,
          ease: "power3.out",
          clearProps: "opacity,transform",
        }
      );
    }, rootRef);

    const cleanups = cards.map((card) => {
      const onEnter = () => {
        gsap.to(card, {
          y: -4,
          scale: 1.012,
          boxShadow: "0 18px 34px rgba(8, 18, 30, 0.24)",
          duration: 0.28,
          ease: "power2.out",
        });
      };
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * 4;
        const y = ((e.clientY - r.top) / r.height - 0.5) * -4;
        gsap.to(card, {
          rotateX: y,
          rotateY: x,
          transformPerspective: 700,
          transformOrigin: "center center",
          duration: 0.24,
          ease: "power2.out",
        });
      };
      const onLeave = () => {
        gsap.to(card, {
          y: 0,
          scale: 1,
          rotateX: 0,
          rotateY: 0,
          boxShadow: "var(--shadow)",
          duration: 0.32,
          ease: "power2.out",
        });
      };

      card.addEventListener("mouseenter", onEnter);
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
      return () => {
        card.removeEventListener("mouseenter", onEnter);
        card.removeEventListener("mousemove", onMove);
        card.removeEventListener("mouseleave", onLeave);
      };
    });

    return () => {
      cleanups.forEach((fn) => fn());
      ctx.revert();
    };
  }, [tab, myBookings.length, allAmbs.length, allHosp.length]);

  return(
    <>
      <style>{`
        .drd-root{
          min-height:100vh;
          background:
            radial-gradient(circle at 12% 10%, var(--sr-bg-grad-a), transparent 32%),
            radial-gradient(circle at 86% 8%, var(--sr-bg-grad-b), transparent 36%),
            var(--sr-bg);
          color:var(--sr-text);
          font-family:var(--font-body);
          padding-top:var(--nav-h);
          padding-left:var(--sb-w);
        }

        /* HEADER */
        .drd-header{background:color-mix(in srgb,var(--sr-surface) 88%,transparent);border-bottom:1px solid var(--sr-border);padding:12px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:var(--shadow);backdrop-filter:blur(8px);}
        .drd-avatar{width:40px;height:40px;border-radius:100px;background:var(--sr-brand-grad);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0;overflow:hidden;border:2px solid var(--red-border);}
        .drd-avatar img{width:100%;height:100%;object-fit:cover;}
        .drd-name{font-size:14px;font-weight:800;color:var(--sr-text);}
        .drd-meta{font-size:10px;color:var(--sr-text-sub);margin-top:1px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
        .drd-mpill{background:var(--sr-hover);border:1px solid var(--sr-border);border-radius:100px;padding:1px 7px;font-size:9px;color:var(--sr-text-sub);}
        .drd-st-pill{display:flex;align-items:center;gap:5px;padding:4px 12px;border-radius:100px;font-size:10px;font-weight:700;border:1.5px solid;}
        @keyframes drd-pulse{0%,100%{opacity:1}50%{opacity:.25}}

        /* TABS */
        .drd-tabs{background:color-mix(in srgb,var(--sr-surface) 88%,transparent);border-bottom:1px solid var(--sr-border);display:flex;overflow-x:auto;scrollbar-width:none;padding:0 8px;backdrop-filter:blur(8px);}
        .drd-tabs::-webkit-scrollbar{display:none;}
        .drd-tab{flex:1;min-width:fit-content;padding:11px 10px;text-align:center;font-size:12px;font-weight:600;color:var(--sr-text-sub);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap;}
        .drd-tab.on{color:var(--sr-text);border-bottom-color:var(--sr-accent);font-weight:700;}
        .drd-tab:hover:not(.on){color:var(--sr-text);}
        .drd-tbadge{background:var(--sr-accent);color:#fff;font-size:9px;font-weight:800;border-radius:100px;padding:1px 5px;min-width:14px;text-align:center;}

        /* MAP LAYOUT */
        .drd-map-layout{display:flex;height:calc(100vh - 56px - 44px - 52px);}
        .drd-sidebar{width:276px;min-width:276px;background:color-mix(in srgb,var(--sr-surface) 90%,transparent);border-right:1px solid var(--sr-border);padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;flex-shrink:0;scrollbar-width:thin;scrollbar-color:var(--sr-border) transparent;backdrop-filter:blur(8px);}
        .drd-sidebar::-webkit-scrollbar{width:2px;}
        .drd-sidebar::-webkit-scrollbar-thumb{background:var(--sr-border);border-radius:2px;}
        .drd-map-wrap{flex:1;position:relative;min-width:0;}

        /* CARDS */
        .drd-card{background:color-mix(in srgb,var(--sr-surface) 90%,transparent);border:1px solid var(--sr-border);border-radius:16px;padding:12px;box-shadow:var(--shadow);backdrop-filter:blur(8px);}
        .drd-card-title{font-size:9px;font-weight:800;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
        .drd-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--sr-border);}
        .drd-row:last-child{border-bottom:none;}
        .drd-rk{font-size:11px;color:var(--sr-text-sub);}
        .drd-rv{font-size:11px;font-weight:700;color:var(--sr-text);}

        /* BUTTONS */
        .drd-btn{border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;width:100%;margin-top:5px;}
        .drd-btn-r{background:var(--sr-brand-grad);color:#fff;box-shadow:0 10px 22px var(--sr-accent-muted);}
        .drd-btn-r:hover{filter:brightness(1.03);}
        .drd-btn-g{background:var(--sr-surface-2);color:var(--sr-text);border:1px solid var(--sr-input-border);}
        .drd-btn-g:hover{background:var(--sr-surface-3);}
        .drd-btn-w{background:var(--sr-hover);color:var(--sr-text-sub);border:1px solid var(--sr-border);}

        /* ROUTE CARD */
        .drd-route{border-radius:14px;padding:12px;}
        @keyframes drd-rp{0%,100%{box-shadow:0 0 0 0 rgba(229,9,20,0.3)}50%{box-shadow:0 0 0 8px rgba(229,9,20,0)}}
        .drd-route-pulse{animation:drd-rp 1.5s infinite;}

        /* CONTENT */
        .drd-content{max-width:1280px;margin:0 auto;padding:18px 14px 86px;background:transparent;}

        /* CARDS */
        .drd-bcard{
          background:color-mix(in srgb,var(--sr-surface) 90%,transparent);border:1px solid var(--sr-border);border-radius:18px;
          overflow:hidden;margin-bottom:12px;
          box-shadow:var(--shadow);
          transition:box-shadow .18s,transform .18s;
          will-change:transform,box-shadow;
        }
        .drd-bcard:hover{box-shadow:var(--shadow2);transform:translateY(-1px);}
        .drd-bcard-top{
          display:flex;justify-content:space-between;align-items:center;
          flex-wrap:wrap;gap:8px;
          padding:14px 18px 12px;
          border-bottom:1px solid var(--sr-border);
        }
        .drd-bnum{font-weight:800;font-size:15px;color:var(--sr-text);letter-spacing:-.3px;}
        .drd-bpill{font-size:9px;font-weight:800;padding:4px 12px;border-radius:100px;border:1.5px solid;text-transform:uppercase;letter-spacing:.4px;}
        .drd-bgrid{
          display:grid;grid-template-columns:1fr 1fr 1fr;
          gap:0;
          border-bottom:1px solid var(--sr-border);
        }
        .drd-bgrid > div{padding:11px 18px;border-right:1px solid var(--sr-border);}
        .drd-bgrid > div:last-child{border-right:none;}
        .drd-blbl{font-size:8px;font-weight:800;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;}
        .drd-bval{font-size:13px;color:var(--sr-text);font-weight:600;}
        .drd-bcard-ft{padding:10px 18px;background:var(--sr-hover);display:flex;align-items:center;gap:8px;}
        .drd-overview{display:flex;flex-direction:column;gap:14px;}
        .drd-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
        .drd-kpi{
          background:color-mix(in srgb,var(--sr-surface) 92%,transparent);
          border:1px solid var(--sr-border);
          border-radius:14px;
          padding:14px;
          box-shadow:var(--shadow);
        }
        .drd-kpi-k{font-size:10px;font-weight:800;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
        .drd-kpi-v{font-size:28px;font-weight:900;color:var(--sr-text);line-height:1;}
        .drd-kpi-s{font-size:11px;color:var(--sr-text-sub);margin-top:6px;}
        .drd-op-grid{display:grid;grid-template-columns:1.25fr .95fr;gap:12px;}
        .drd-op-list{display:flex;flex-direction:column;gap:8px;}
        .drd-op-item{
          display:flex;justify-content:space-between;align-items:center;gap:10px;
          padding:10px 12px;border-radius:10px;background:var(--sr-hover);border:1px solid var(--sr-border);
        }
        .drd-op-l{font-size:12px;font-weight:700;color:var(--sr-text);}
        .drd-op-r{font-size:11px;font-weight:700;color:var(--sr-text-sub);}
        .drd-tech-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
        .drd-tech{
          background:color-mix(in srgb,var(--sr-surface-2) 90%,transparent);
          border:1px solid var(--sr-border);
          border-radius:12px;
          padding:12px;
        }
        .drd-tech-h{font-size:11px;font-weight:800;color:var(--sr-text);margin-bottom:6px;}
        .drd-tech-p{font-size:11px;color:var(--sr-text-sub);}

        /* NOTIF */
        .drd-ncard{background:color-mix(in srgb,var(--sr-surface) 92%,transparent);border:1px solid var(--sr-border);border-radius:12px;padding:12px 14px;margin-bottom:7px;cursor:pointer;transition:all .15s;box-shadow:var(--shadow);}
        .drd-ncard.unread{border-color:var(--red-border);background:var(--sr-accent-muted);}
        .drd-ncard:hover{transform:translateY(-1px);box-shadow:var(--shadow2);}
        .drd-ntitle{font-size:13px;font-weight:700;color:var(--sr-text);}
        .drd-ntime{font-size:10px;color:var(--sr-text-muted);white-space:nowrap;}
        .drd-nmsg{font-size:11px;color:var(--sr-text-sub);margin-top:3px;}

        /* AMB LIST */
        .drd-alist{display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;scrollbar-width:none;}
        .drd-alist::-webkit-scrollbar{display:none;}
        .drd-aitem{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid var(--sr-border);background:var(--sr-surface);cursor:pointer;transition:all .15s;}
        .drd-aitem:hover{background:var(--sr-hover);border-color:var(--sr-input-border);}
        .drd-aitem.sel{background:var(--sr-accent-muted);border-color:var(--red-border);}
        .drd-aname{font-size:13px;font-weight:700;color:var(--sr-text);}
        .drd-asub{font-size:10px;color:var(--sr-text-sub);margin-top:1px;}

        /* BOTTOM NAV — mobile */
        .drd-bnav{display:none;position:fixed;bottom:0;left:0;right:0;height:64px;background:var(--sr-glass);border-top:1px solid var(--sr-nav-border);z-index:9999;align-items:stretch;backdrop-filter:blur(14px);box-shadow:var(--shadow);}
        .drd-bni{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:6px 4px;position:relative;border-top:2px solid transparent;transition:all .15s;}
        .drd-bni.on{border-top-color:var(--sr-accent);}
        .drd-bni-icon{font-size:18px;line-height:1;color:var(--sr-text-sub);}
        .drd-bni.on .drd-bni-icon{color:var(--sr-accent);}
        .drd-bni-label{font-size:8px;font-weight:600;color:var(--sr-text-sub);font-family:var(--font-body);}
        .drd-bni.on .drd-bni-label{color:var(--sr-accent);font-weight:700;}
        .drd-bni-badge{position:absolute;top:4px;right:calc(50% - 14px);background:var(--sr-accent);color:#fff;font-size:8px;font-weight:800;border-radius:100px;padding:1px 4px;min-width:14px;text-align:center;}

        /* LEAFLET */
        .sr-dark-popup .leaflet-popup-content-wrapper{background:var(--sr-surface)!important;border:1px solid var(--sr-border)!important;border-radius:12px!important;padding:0!important;box-shadow:var(--shadow2)!important;}
        .sr-dark-popup .leaflet-popup-content{margin:0!important;}
        .sr-dark-popup .leaflet-popup-tip{background:var(--sr-surface)!important;}
        .leaflet-routing-container{display:none!important;}
        .leaflet-control-zoom a{background:var(--sr-surface)!important;color:var(--sr-text)!important;border-color:var(--sr-border)!important;}

        /* RESPONSIVE */
        @media(max-width:767px){
          .drd-root{padding-top:var(--nav-h);padding-left:0;padding-bottom:64px;}
          .drd-tabs{display:none;}
          .drd-bnav{display:flex;}
          .drd-map-layout{flex-direction:column;height:calc(100vh - 56px - 62px);}
          .drd-sidebar{width:100%;min-width:unset;border-right:none;border-bottom:1px solid var(--sr-border);max-height:220px;}
          .drd-map-wrap{flex:1;min-height:180px;}
          .drd-content{padding:12px 12px 80px;}
          .drd-bgrid{grid-template-columns:1fr;}
          .drd-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
          .drd-op-grid{grid-template-columns:1fr;}
          .drd-tech-grid{grid-template-columns:1fr;}
        }
      `}</style>

      <div className="drd-root" ref={rootRef}>

        {/* HEADER */}
        <div className="drd-header">
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            <div className="drd-avatar">
              {(()=>{ const p=localStorage.getItem(`sr-profile-pic-${driverEmail}`); return p?<img src={p} alt=""/>:<span>{driverName[0]?.toUpperCase()}</span>; })()}
            </div>
            <div style={{minWidth:0}}>
              <div className="drd-name">🚑 {driverName}</div>
              <div className="drd-meta">
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{driverEmail}</span>
                <span className="drd-mpill">{ambNumber}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
            {ambulance&&<div className="drd-st-pill" style={{color:sc.c,background:sc.bg,borderColor:sc.b}}><div style={{width:6,height:6,borderRadius:"50%",background:sc.c,animation:isTracking?"drd-pulse 1.5s infinite":"none"}}/>{ambulance.status?.replace("_"," ")}</div>}
            <div className="drd-st-pill" style={{color:isTracking?"#0a0a0a":"rgba(0,0,0,0.35)",background:isTracking?"rgba(0,0,0,0.06)":"rgba(0,0,0,0.03)",borderColor:isTracking?"rgba(0,0,0,0.2)":"rgba(0,0,0,0.08)"}}>
              {isTracking?"● LIVE":"OFFLINE"}
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="drd-tabs">
          {tabs.map(({k,icon,label,count})=>(
            <div key={k} className={`drd-tab ${tab===k?"on":""}`} onClick={()=>switchTab(k)}>
              {icon} {label} {count>0&&<span className="drd-tbadge">{count}</span>}
            </div>
          ))}
        </div>

        {/* ── DASHBOARD OVERVIEW (no map) ── */}
        {tab==="dash"&&(
          <div className="drd-content">
            <div className="drd-overview">
              <div className="drd-kpi-grid">
                <div className="drd-kpi drd-anim-card">
                  <div className="drd-kpi-k">Online Fleet</div>
                  <div className="drd-kpi-v">{String(onlineUnits).padStart(2,"0")}</div>
                  <div className="drd-kpi-s">{availableUnits} units immediately dispatchable</div>
                </div>
                <div className="drd-kpi drd-anim-card">
                  <div className="drd-kpi-k">Active Trips</div>
                  <div className="drd-kpi-v">{String(activeTrips).padStart(2,"0")}</div>
                  <div className="drd-kpi-s">{todayTrips} trips created today</div>
                </div>
                <div className="drd-kpi drd-anim-card">
                  <div className="drd-kpi-k">Smart ETA</div>
                  <div className="drd-kpi-v">~{smartEta}m</div>
                  <div className="drd-kpi-s">AI routing forecast for next pickup</div>
                </div>
                <div className="drd-kpi drd-anim-card">
                  <div className="drd-kpi-k">Completion Rate</div>
                  <div className="drd-kpi-v">{completionRate}%</div>
                  <div className="drd-kpi-s">{completedTrips}/{myBookings.length || 0} successful closures</div>
                </div>
              </div>

              <div className="drd-op-grid">
                <div className="drd-card drd-anim-card">
                  <div className="drd-card-title">⚙ Operations Command</div>
                  <div className="drd-op-list">
                    <div className="drd-op-item">
                      <span className="drd-op-l">Dispatch Queue</span>
                      <span className="drd-op-r">{myBookings.filter((b)=>b.status==="pending").length} pending approvals</span>
                    </div>
                    <div className="drd-op-item">
                      <span className="drd-op-l">Critical Hospital Network</span>
                      <span className="drd-op-r">{criticalHospitals} flagged facilities</span>
                    </div>
                    <div className="drd-op-item">
                      <span className="drd-op-l">Driver Telemetry Stream</span>
                      <span className="drd-op-r">{isTracking ? "Live feed active" : "Paused"} · {speed} km/h</span>
                    </div>
                    <div className="drd-op-item">
                      <span className="drd-op-l">Geo Precision</span>
                      <span className="drd-op-r">{location ? "High precision lock" : "Awaiting lock"}</span>
                    </div>
                  </div>
                </div>

                <div className="drd-card drd-anim-card">
                  <div className="drd-card-title">🧠 Autonomous Controls</div>
                  {!isTracking
                    ? <button className="drd-btn drd-btn-g" onClick={startTracking}>▶ Start GPS Tracking</button>
                    : <button className="drd-btn drd-btn-r" onClick={stopTracking}>⏹ Stop GPS Tracking</button>
                  }
                  {!notifOk && (
                    <button className="drd-btn drd-btn-w" style={{marginTop:6}} onClick={()=>reqNotif().then(ok=>setNotifOk(ok))}>
                      🔔 Enable Smart Alerts
                    </button>
                  )}
                  {route && (
                    <div className={`drd-route drd-card ${route.status==="pending"?"drd-route-pulse":""}`} style={{marginTop:8,border:`2px solid ${rbord}`}}>
                      <div style={{fontWeight:700,fontSize:12,color:rbord,marginBottom:6}}>
                        {route.status==="pending"?"🚨 New Route Assigned":"🧭 Active Route"}
                      </div>
                      <div style={{fontSize:11,color:"var(--sr-text-sub)",lineHeight:1.7}}>
                        <div>Pickup: {route.pickup_location}</div>
                        <div>Destination: {route.destination}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="drd-tech-grid">
                <div className="drd-tech drd-anim-card">
                  <div className="drd-tech-h">Predictive Dispatch</div>
                  <div className="drd-tech-p">Auto-prioritizes requests using congestion and fleet density scoring.</div>
                </div>
                <div className="drd-tech drd-anim-card">
                  <div className="drd-tech-h">SLA Monitor</div>
                  <div className="drd-tech-p">Live monitoring of response windows with escalation for delayed legs.</div>
                </div>
                <div className="drd-tech drd-anim-card">
                  <div className="drd-tech-h">Resilience Layer</div>
                  <div className="drd-tech-p">Fallback routing and smart reassignment to keep operations uninterrupted.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BOOKINGS ── */}
        {tab==="book"&&(
          <div className="drd-content">
            <div style={{fontSize:16,fontWeight:800,marginBottom:14,color:"#0a0a0a"}}>
              My Bookings <span style={{fontSize:12,fontWeight:500,color:"rgba(0,0,0,0.35)"}}>({myBookings.length})</span>
            </div>
            {myBookings.length===0
              ?<div style={{textAlign:"center",padding:"50px 0",color:"rgba(0,0,0,0.2)",fontSize:14}}><div style={{fontSize:44,marginBottom:10}}>📋</div>No bookings yet</div>
              :myBookings.map(b=>{
                const bsc={pending:{c:"#b36800",bg:"rgba(179,104,0,0.08)",bd:"rgba(179,104,0,0.2)"},confirmed:{c:"#0a0a0a",bg:"rgba(0,0,0,0.06)",bd:"rgba(0,0,0,0.15)"},completed:{c:"rgba(0,0,0,0.35)",bg:"rgba(0,0,0,0.04)",bd:"rgba(0,0,0,0.08)"},cancelled:{c:"#E50914",bg:"rgba(229,9,20,0.08)",bd:"rgba(229,9,20,0.2)"}}[b.status]||{c:"rgba(0,0,0,0.35)",bg:"rgba(0,0,0,0.04)",bd:"rgba(0,0,0,0.08)"};
                return(
                  <div key={b.id} className="drd-bcard drd-anim-card">
                    <div className="drd-bcard-top">
                      <div>
                        <div className="drd-bnum">🚑 {b.ambulance_number}</div>
                        {b.created_at&&<div style={{fontSize:10,color:"#a1a1a6",marginTop:2}}>{new Date(b.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>}
                      </div>
                      <span className="drd-bpill" style={{color:bsc.c,background:bsc.bg,borderColor:bsc.bd}}>{b.status}</span>
                    </div>
                    <div className="drd-bgrid">
                      <div><div className="drd-blbl">Patient</div><div className="drd-bval">{b.booked_by}</div></div>
                      <div><div className="drd-blbl">📍 Pickup</div><div className="drd-bval">{b.pickup_location}</div></div>
                      <div><div className="drd-blbl">🏥 Destination</div><div className="drd-bval">{b.destination||"—"}</div></div>
                    </div>
                    {b.status==="confirmed"&&(
                      <div className="drd-bcard-ft">
                        <button className="drd-btn drd-btn-r" style={{marginTop:0,flex:1}} onClick={()=>navigate("/directions",{state:{
                          tracking:true,
                          bookingId:b.id,
                          ambulanceNumber:b.ambulance_number,
                          driver:driverName,
                          driverContact:driverPhone||ambulance?.driver_contact,
                          pickupLocation:b.pickup_location,
                          destination:b.destination,
                          ambulanceId:b.ambulance_id||ambId,
                          status:b.status,
                        }})}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          View Route on Map
                        </button>
                        {b.booked_by && (
                          <div style={{fontSize:11,color:"#6e6e73",fontWeight:600}}>Patient: <b style={{color:"#0a0a0a"}}>{b.booked_by}</b></div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab==="notif"&&(
          <div className="drd-content">
            <div style={{fontSize:16,fontWeight:800,marginBottom:14,color:"#0a0a0a"}}>
              Notifications <span style={{fontSize:12,fontWeight:500,color:"rgba(0,0,0,0.35)"}}>({notifs.length})</span>
            </div>
            {notifs.length===0
              ?<div style={{textAlign:"center",padding:"50px 0",color:"rgba(0,0,0,0.2)",fontSize:14}}><div style={{fontSize:44,marginBottom:10}}>🔔</div>No notifications</div>
              :notifs.map((n,i)=>(
                <div key={i} className={`drd-ncard ${!n.read?"unread":""}`}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div className="drd-ntitle">{n.title}</div>
                    <div className="drd-ntime">{new Date(n.timestamp).toLocaleString("en-IN",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})}</div>
                  </div>
                  <div className="drd-nmsg">{n.message}</div>
                </div>
              ))}
          </div>
        )}

        {/* ── MY AMBULANCE ── */}
        {tab==="amb"&&(
          <div className="drd-content">
            {ambulance&&(
              <div style={{background:"#fff",border:"2px solid rgba(229,9,20,0.18)",borderRadius:16,overflow:"hidden",marginBottom:14,boxShadow:"0 2px 12px rgba(229,9,20,0.06)"}}>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 14px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                  <div>
                    <div style={{fontSize:9,fontWeight:800,color:"#a1a1a6",textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:4}}>My Ambulance</div>
                    <div style={{fontSize:26,fontWeight:900,color:"#0a0a0a",letterSpacing:"-1px",lineHeight:1}}>{ambNumber}</div>
                  </div>
                  <span style={{fontSize:9,fontWeight:800,padding:"5px 14px",borderRadius:100,color:sc.c,background:sc.bg,border:`1.5px solid ${sc.b}`,textTransform:"uppercase",letterSpacing:".5px"}}>{ambulance.status?.replace("_"," ")}</span>
                </div>
                {/* Info grid — 4 columns, all on one row */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0}}>
                  {[
                    ["Driver",   driverName],
                    ["Contact",  driverPhone||ambulance.driver_contact||"—"],
                    ["Location", ambulance.location||"—"],
                    ["Model",    ambulance.model||"—"],
                  ].map(([l,v],i)=>(
                    <div key={l} style={{padding:"12px 18px",borderRight:i<3?"1px solid rgba(0,0,0,0.06)":"none"}}>
                      <div style={{fontSize:8,fontWeight:800,color:"#a1a1a6",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:700,color:"#0a0a0a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pendingReq
              ?<div style={{background:"rgba(179,104,0,0.06)",border:"1px solid rgba(179,104,0,0.2)",borderRadius:12,padding:"12px 14px",fontSize:12,color:"#b36800",marginBottom:14}}>
                  ⏳ Change request pending — {pendingReq.newAmbNumber}
               </div>
              :<div className="drd-card">
                <div className="drd-card-title">🔄 Change Ambulance</div>
                <div className="drd-alist">
                  {allAmbs.filter(a=>a.id!==ambId).map(a=>{
                    const as=ST[a.status]||ST.offline;
                    return(
                      <div key={a.id} className={`drd-aitem ${changeAmb?.id===a.id?"sel":""}`} onClick={()=>setChangeAmb(a)}>
                        <div style={{width:30,height:30,borderRadius:8,background:"rgba(229,9,20,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🚑</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div className="drd-aname">{a.ambulance_number}</div>
                          <div className="drd-asub">{a.location||"—"}</div>
                        </div>
                        <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:100,color:as.c,background:as.bg,border:`1.5px solid ${as.b}`,textTransform:"uppercase",flexShrink:0}}>{a.status?.replace("_"," ")}</span>
                      </div>
                    );
                  })}
                </div>
                <button className="drd-btn drd-btn-r" disabled={!changeAmb} onClick={sendChangeReq}>
                  {changeAmb?`Send Request — ${changeAmb.ambulance_number}`:"Select an ambulance first"}
                </button>
              </div>
            }
          </div>
        )}

        {/* ── FLEET ── */}
        {tab==="ambs"&&(
          <div className="drd-content">
            <div style={{fontSize:16,fontWeight:800,marginBottom:14,color:"#0a0a0a"}}>All Ambulances ({allAmbs.length})</div>
            {allAmbs.map(a=>{ const as=ST[a.status]||ST.offline; const isMe=a.id===ambId; return(
              <div key={a.id} className="drd-bcard drd-anim-card" style={{border:isMe?"2px solid rgba(229,9,20,0.2)":"1px solid rgba(0,0,0,0.08)"}}>
                <div className="drd-bcard-top">
                  <div className="drd-bnum">🚑 {a.ambulance_number}{isMe&&<span style={{marginLeft:8,fontSize:9,fontWeight:700,background:"rgba(229,9,20,0.08)",color:"#E50914",border:"1px solid rgba(229,9,20,0.2)",borderRadius:6,padding:"2px 7px"}}>MINE</span>}</div>
                  <span className="drd-bpill" style={{color:as.c,background:as.bg,borderColor:as.b}}>{a.status?.replace("_"," ")}</span>
                </div>
                <div className="drd-bgrid">
                  <div><div className="drd-blbl">Driver</div><div className="drd-bval">{a.driver||"—"}</div></div>
                  <div><div className="drd-blbl">Location</div><div className="drd-bval">📍 {a.location||"—"}</div></div>
                </div>
              </div>
            ); })}
          </div>
        )}

        {/* ── HOSPITALS ── */}
        {tab==="hosp"&&(
          <div className="drd-content">
            <div style={{fontSize:16,fontWeight:800,marginBottom:14,color:"#0a0a0a"}}>Hospitals ({allHosp.length})</div>
            {allHosp.map(h=>{ const hsc={active:{c:"#0a0a0a",bg:"rgba(0,0,0,0.06)",b:"rgba(0,0,0,0.14)"},full:{c:"#b36800",bg:"rgba(179,104,0,0.08)",b:"rgba(179,104,0,0.2)"},critical:{c:"#E50914",bg:"rgba(229,9,20,0.08)",b:"rgba(229,9,20,0.2)"},closed:{c:"rgba(0,0,0,0.3)",bg:"rgba(0,0,0,0.04)",b:"rgba(0,0,0,0.08)"}}[h.status]||{c:"rgba(0,0,0,0.3)",bg:"rgba(0,0,0,0.04)",b:"rgba(0,0,0,0.08)"}; return(
              <div key={h.id} className="drd-bcard drd-anim-card">
                <div className="drd-bcard-top">
                  <div className="drd-bnum">🏥 {h.name}</div>
                  <span className="drd-bpill" style={{color:hsc.c,background:hsc.bg,borderColor:hsc.b}}>{h.status}</span>
                </div>
                <div className="drd-bgrid">
                  <div><div className="drd-blbl">Address</div><div className="drd-bval">📍 {h.address||"—"}</div></div>
                  <div><div className="drd-blbl">Available Beds</div><div className="drd-bval">🛏 {h.available_beds??"—"}</div></div>
                </div>
              </div>
            ); })}
          </div>
        )}

      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="drd-bnav">
        {tabs.map(({k,icon,label,count})=>(
          <div key={k} className={`drd-bni ${tab===k?"on":""}`} onClick={()=>switchTab(k)}>
            {count>0&&<span className="drd-bni-badge">{count}</span>}
            <span className="drd-bni-icon">{icon}</span>
            <span className="drd-bni-label">{label}</span>
          </div>
        ))}
      </nav>
    </>
  );
}
