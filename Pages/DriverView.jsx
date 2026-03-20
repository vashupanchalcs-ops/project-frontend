import { useState, useEffect, useRef, useCallback } from "react";
import useLeaflet, { LIGHT_TILE, DELHI, makePinIcon } from "../hooks/useLeaflet";

const BASE = "http://127.0.0.1:8000";

export default function DriverView() {
  const leafletReady = useLeaflet();
  const mapDivRef    = useRef(null);
  const mapObj       = useRef(null);
  const markersRef   = useRef({});

  const driverEmail = localStorage.getItem("user")           || "";
  const driverName  = localStorage.getItem("name")           || "Driver";
  const ambId       = parseInt(localStorage.getItem("ambulance_id")||"0");
  const ambNumber   = localStorage.getItem("ambulance_number")||"—";

  const [isTracking, setIsTracking] = useState(false);
  const [location,   setLocation]   = useState(null);
  const [speed,      setSpeed]      = useState(0);
  const [route,      setRoute]      = useState(null);
  const [notifOk,    setNotifOk]    = useState(Notification?.permission==="granted");
  const [log,        setLog]        = useState([]);
  const [drivers,    setDrivers]    = useState([]);

  const latLoc    = useRef(null);
  const watchId   = useRef(null);
  const pingTimer = useRef(null);
  const drvMark   = useRef(null);
  const routeCtrl = useRef(null);
  const firstPan  = useRef(true);

  const addLog=(msg,type="info")=>setLog(p=>[{msg,type,time:new Date().toLocaleTimeString()},...p].slice(0,20));

  const fetchDrivers=useCallback(()=>{
    fetch(`${BASE}/api/ambulances/`).then(r=>r.json()).then(data=>{
      setDrivers(data.filter(a=>a.driver));
    }).catch(()=>{});
  },[]);

  useEffect(()=>{ fetchDrivers(); const t=setInterval(fetchDrivers,8000); return()=>clearInterval(t); },[fetchDrivers]);

  useEffect(()=>{
    if(!leafletReady||!mapDivRef.current||mapObj.current) return;
    const L=window.L;
    mapObj.current=L.map(mapDivRef.current,{center:[DELHI.lat,DELHI.lng],zoom:11,minZoom:9,maxZoom:18,zoomControl:false});
    L.tileLayer(LIGHT_TILE,{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(mapObj.current);
    L.control.zoom({position:"bottomright"}).addTo(mapObj.current);
    setTimeout(()=>mapObj.current?.invalidateSize(),200);
    return()=>{ if(mapObj.current){mapObj.current.remove();mapObj.current=null;} };
  },[leafletReady]);

  const reqNotif=async()=>{ if(!("Notification" in window)) return false; if(Notification.permission==="granted") return true; return (await Notification.requestPermission())==="granted"; };
  const pushNotif=(t,b)=>{ if(Notification?.permission!=="granted") return; const n=new Notification(t,{body:b,requireInteraction:true}); setTimeout(()=>n.close(),10000); };

  const sendPing=useCallback(()=>{
    const loc=latLoc.current; if(!loc||!driverEmail||!ambId) return;
    fetch(`${BASE}/api/driver/ping/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({driver_email:driverEmail,ambulance_id:ambId,latitude:loc.lat,longitude:loc.lng,speed:0})})
      .then(r=>r.json()).then(data=>{
        if(data.pending_route){ const nr=data.pending_route; setRoute(prev=>{ if(!prev||prev.id!==nr.id){ addLog("🗺 New route assigned!","success"); pushNotif("🚨 New Route!",`Pickup: ${nr.pickup_location}`); } return nr; }); }
      }).catch(()=>{});
  },[driverEmail,ambId]);

  const startTracking=()=>{
    if(!navigator.geolocation){ addLog("GPS not supported","error"); return; }
    setIsTracking(true); firstPan.current=true; addLog("📍 GPS tracking started","success");
    reqNotif().then(ok=>setNotifOk(ok));
    watchId.current=navigator.geolocation.watchPosition(
      pos=>{
        const loc={lat:pos.coords.latitude,lng:pos.coords.longitude};
        latLoc.current=loc; setLocation(loc); setSpeed(Math.round((pos.coords.speed||0)*3.6));
        if(mapObj.current&&window.L){
          if(firstPan.current){ mapObj.current.setView([loc.lat,loc.lng],14); firstPan.current=false; }
          else mapObj.current.panTo([loc.lat,loc.lng]);
          if(drvMark.current) drvMark.current.setLatLng([loc.lat,loc.lng]);
          else{ const ic=makePinIcon("#E50914","🚑"); if(ic) drvMark.current=window.L.marker([loc.lat,loc.lng],{icon:ic}).addTo(mapObj.current).bindPopup(`<div style="padding:10px 12px;font-family:'DM Sans',sans-serif;font-weight:700;color:#0a0a0a">📍 ${driverName}</div>`,{className:"sr-dark-popup"}); }
        }
      },
      err=>addLog(`GPS error: ${err.message}`,"error"),
      {enableHighAccuracy:true,maximumAge:2000,timeout:10000}
    );
    sendPing(); pingTimer.current=setInterval(sendPing,5000);
  };

  const stopTracking=()=>{
    if(watchId.current) navigator.geolocation.clearWatch(watchId.current);
    if(pingTimer.current) clearInterval(pingTimer.current);
    watchId.current=pingTimer.current=null; setIsTracking(false); addLog("⏹ Tracking stopped","warn");
  };
  useEffect(()=>()=>stopTracking(),[]);

  const respondRoute=async status=>{
    if(!route?.id) return;
    try{ await fetch(`${BASE}/api/driver/route/${route.id}/respond/`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})}); if(status==="completed"){ setRoute(null); addLog("🏁 Trip complete!","success"); } else{ setRoute(r=>({...r,status})); addLog(status==="accepted"?"✅ Route accepted":"❌ Route rejected"); } }catch{ addLog("Route update failed","error"); }
  };

  return(
    <>
      <style>{`
        .dv-root { min-height:100vh; background:#f5f5f7; padding-top:60px; padding-left:200px; font-family:'DM Sans',sans-serif; display:flex; flex-direction:column; }

        .dv-topbar {
          background:#fff; border-bottom:1px solid rgba(0,0,0,0.08);
          padding:12px 24px; display:flex; align-items:center;
          justify-content:space-between; flex-wrap:wrap; gap:10px;
          box-shadow:0 1px 6px rgba(0,0,0,0.04); flex-shrink:0;
        }
        .dv-tb-left h1 { font-size:20px;font-weight:800;color:#0a0a0a;letter-spacing:-.4px;margin:0 0 2px; }
        .dv-tb-left p  { font-size:12px;color:#6e6e73;margin:0; }
        .dv-tb-right   { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }

        .dv-offline-pill { display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:100px;font-size:11px;font-weight:700;border:1.5px solid; }

        .dv-btn { font-size:12px;font-weight:700;border:none;border-radius:9px;padding:9px 20px;cursor:pointer;font-family:inherit;transition:all .15s;display:inline-flex;align-items:center;gap:7px; }
        .dv-btn-red   { background:#E50914;color:#fff;box-shadow:0 3px 10px rgba(229,9,20,0.25); }
        .dv-btn-red:hover { background:#c8000f; }
        .dv-btn-dark  { background:#0a0a0a;color:#fff; }
        .dv-btn-dark:hover { background:#222; }
        .dv-btn-ghost { background:#fff;color:rgba(0,0,0,0.5);border:1.5px solid rgba(0,0,0,0.1); }
        .dv-btn-ghost:hover { background:#f0f0f2;color:#0a0a0a; }

        .dv-body { display:flex; flex:1; min-height:0; }

        /* SIDEBAR */
        .dv-sb { width:280px;flex-shrink:0;background:#fff;border-right:1px solid rgba(0,0,0,0.08);overflow-y:auto;scrollbar-width:none;display:flex;flex-direction:column;gap:0; }
        .dv-sb::-webkit-scrollbar { display:none; }

        .dv-card { background:#fff;border-bottom:1px solid rgba(0,0,0,0.06);padding:14px 16px; }
        .dv-card-title { font-size:9px;font-weight:800;color:#a1a1a6;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px; }
        .dv-row  { display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.04); }
        .dv-row:last-child { border-bottom:none; }
        .dv-rk   { font-size:11px;color:#a1a1a6; }
        .dv-rv   { font-size:11px;font-weight:700;color:#0a0a0a; }

        /* ROUTE CARD */
        @keyframes dv-rp { 0%,100%{box-shadow:0 0 0 0 rgba(229,9,20,0.25)} 50%{box-shadow:0 0 0 8px rgba(229,9,20,0)} }
        .dv-route-card { margin:12px;border-radius:14px;padding:14px;border:2px solid;background:#fff; }
        .dv-route-card.pulse { animation:dv-rp 1.5s infinite; }
        .dv-route-title { font-size:13px;font-weight:800;margin-bottom:10px; }
        .dv-route-row   { font-size:12px;color:#3d3d3d;margin-bottom:4px;line-height:1.6; }

        /* LOG */
        .dv-log-list { max-height:130px;overflow-y:auto;scrollbar-width:none; }
        .dv-log-list::-webkit-scrollbar { display:none; }
        .dv-log-item { font-size:11px;margin-bottom:4px;line-height:1.5; }

        /* MAP */
        .dv-map-wrap { flex:1;position:relative;min-width:0; }
        .dv-map-div  { position:absolute;inset:0; }
        .dv-map-overlay { position:absolute;inset:0;background:rgba(245,245,247,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:2; }

        /* DRIVERS LIST */
        .dv-drivers-wrap { padding:20px 24px;flex:1;overflow-y:auto;max-width:1000px; }
        .dv-drv-card { background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:14px;padding:16px 18px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap; }
        .dv-drv-av   { width:42px;height:42px;border-radius:11px;background:#E50914;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;flex-shrink:0; }
        .dv-drv-name { font-size:15px;font-weight:800;color:#0a0a0a; }
        .dv-drv-sub  { font-size:11px;color:#a1a1a6;margin-top:2px; }
        .dv-drv-pill { font-size:9px;font-weight:800;padding:4px 12px;border-radius:100px;border:1.5px solid;text-transform:uppercase;flex-shrink:0; }

        @media(max-width:767px){ .dv-root{padding-left:0;} .dv-sb{display:none;} }

        .sr-dark-popup .leaflet-popup-content-wrapper{background:#fff!important;border:1px solid rgba(0,0,0,0.09)!important;border-radius:12px!important;padding:0!important;box-shadow:0 8px 24px rgba(0,0,0,0.1)!important;}
        .sr-dark-popup .leaflet-popup-content{margin:0!important;}
        .sr-dark-popup .leaflet-popup-tip{background:#fff!important;}
        .leaflet-routing-container{display:none!important;}
        .leaflet-control-zoom a{background:#fff!important;color:#0a0a0a!important;border-color:rgba(0,0,0,0.1)!important;}
      `}</style>

      <div className="dv-root">

        {/* TOP BAR */}
        <div className="dv-topbar">
          <div className="dv-tb-left">
            <h1>Driver View</h1>
            <p>GPS Tracking · {ambNumber} · {driverName}</p>
          </div>
          <div className="dv-tb-right">
            {!notifOk&&<button className="dv-btn dv-btn-ghost" onClick={()=>reqNotif().then(ok=>setNotifOk(ok))}>🔔 Enable Notif</button>}
            <div className="dv-offline-pill" style={isTracking?{color:"#0a0a0a",background:"rgba(0,0,0,0.06)",borderColor:"rgba(0,0,0,0.15)"}:{color:"#a1a1a6",background:"rgba(0,0,0,0.03)",borderColor:"rgba(0,0,0,0.09)"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:isTracking?"#0a0a0a":"#a1a1a6",display:"inline-block"}}/>
              {isTracking?"LIVE":"OFFLINE"}
            </div>
            {!isTracking
              ? <button className="dv-btn dv-btn-dark" onClick={startTracking}>▶ Start Tracking</button>
              : <button className="dv-btn dv-btn-red"  onClick={stopTracking}>⏹ Stop Tracking</button>
            }
          </div>
        </div>

        <div className="dv-body">

          {/* SIDEBAR */}
          <div className="dv-sb">

            <div className="dv-card">
              <div className="dv-card-title">📍 Live Position</div>
              {[["Latitude",location?.lat?.toFixed(5)??"Waiting..."],["Longitude",location?.lng?.toFixed(5)??"Waiting..."],["Speed",`${speed} km/h`]].map(([k,v])=>(
                <div key={k} className="dv-row"><span className="dv-rk">{k}</span><span className="dv-rv">{v}</span></div>
              ))}
            </div>

            {route&&(
              <div className="dv-route-card" style={{borderColor:route.status==="pending"?"#E50914":route.status==="accepted"?"#0a0a0a":"rgba(0,0,0,0.15)"}} onClick={()=>{}} >
                <div className="dv-route-title" style={{color:route.status==="pending"?"#E50914":"#0a0a0a"}}>
                  {route.status==="pending"?"🚨 New Route!":route.status==="accepted"?"🧭 En Route":"🏁 Trip"}
                </div>
                <div className="dv-route-row">📍 <b>Pickup:</b> {route.pickup_location}</div>
                <div className="dv-route-row">🏥 <b>Hospital:</b> {route.destination}</div>
                <div style={{display:"flex",gap:7,marginTop:10}}>
                  {route.status==="pending"&&<>
                    <button className="dv-btn dv-btn-dark" style={{flex:1,padding:"8px"}} onClick={()=>respondRoute("accepted")}>✅ Accept</button>
                    <button className="dv-btn dv-btn-red"  style={{flex:1,padding:"8px"}} onClick={()=>respondRoute("rejected")}>❌ Reject</button>
                  </>}
                  {route.status==="accepted"&&<button className="dv-btn dv-btn-dark" style={{width:"100%",padding:"8px"}} onClick={()=>respondRoute("completed")}>🏁 Complete Trip</button>}
                </div>
              </div>
            )}

            <div className="dv-card" style={{flex:1}}>
              <div className="dv-card-title">📋 Activity Log</div>
              <div className="dv-log-list">
                {log.length===0
                  ? <div style={{fontSize:11,color:"#a1a1a6"}}>No activity yet</div>
                  : log.map((l,i)=>(
                    <div key={i} className="dv-log-item" style={{color:{info:"#6e6e73",success:"#0a0a0a",warn:"#b36800",error:"#E50914"}[l.type]||"#6e6e73"}}>
                      <span style={{color:"#a1a1a6"}}>{l.time} </span>{l.msg}
                    </div>
                  ))}
              </div>
            </div>

          </div>

          {/* MAP */}
          <div className="dv-map-wrap">
            <div ref={mapDivRef} className="dv-map-div"/>
            {!isTracking&&(
              <div className="dv-map-overlay">
                <div style={{fontSize:48,opacity:.3,marginBottom:10}}>📍</div>
                <div style={{fontSize:14,color:"#a1a1a6",fontWeight:600}}>Start tracking to see live position</div>
                <button className="dv-btn dv-btn-dark" style={{marginTop:16,pointerEvents:"all"}} onClick={startTracking}>▶ Start Tracking</button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}