// RealTimeMap.jsx — Live driver tracking (Leaflet)
import { useState, useEffect, useRef } from "react";
import useLeaflet, { DARK_TILE, DELHI, STATUS_COLOR, makeIcon, makePinIcon } from "../hooks/useLeaflet";

const BASE    = "http://127.0.0.1:8000";
const REFRESH = 5000;

export default function RealTimeMap({ onSelectDriver }) {
  const leafletReady = useLeaflet();
  const [drivers,    setDrivers]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const mapDivRef  = useRef(null);
  const mapObj     = useRef(null);
  const markersRef = useRef({});
  const popupRef   = useRef(null);

  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    mapObj.current = L.map(mapDivRef.current, {
      center: [DELHI.lat, DELHI.lng], zoom: 12, zoomControl: false,
    });
    L.tileLayer(DARK_TILE, { maxZoom: 19 }).addTo(mapObj.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapObj.current);
    popupRef.current = L.popup({ className: "sr-dark-popup" });
    return () => {
      Object.values(markersRef.current).forEach(m => { try { m.remove(); } catch {} });
      markersRef.current = {};
      if (mapObj.current) { mapObj.current.remove(); mapObj.current = null; }
    };
  }, [leafletReady]);

  useEffect(() => {
    fetchLocations();
    const t = setInterval(fetchLocations, REFRESH);
    return () => clearInterval(t);
  }, [leafletReady]);

  const fetchLocations = async () => {
    try {
      const res  = await fetch(`${BASE}/api/admin/live-locations/`);
      const data = await res.json();
      setDrivers(data);
      setLastUpdate(new Date().toLocaleTimeString());
      if (leafletReady && mapObj.current) updateMarkers(data);
    } catch {}
  };

  const updateMarkers = (data) => {
    if (!mapObj.current || !window.L) return;
    const L   = window.L;
    const seen = new Set();
    data.forEach(d => {
      seen.add(d.ambulance_id);
      const color = STATUS_COLOR[d.status] || STATUS_COLOR.offline;
      const icon  = makePinIcon(color, "🚑");
      if (!icon) return;
      if (markersRef.current[d.ambulance_id]) {
        markersRef.current[d.ambulance_id].setLatLng([d.latitude, d.longitude]);
        markersRef.current[d.ambulance_id].setIcon(icon);
      } else {
        const m = L.marker([d.latitude, d.longitude], { icon }).addTo(mapObj.current);
        m.on("click", () => {
          setSelected(d);
          popupRef.current.setLatLng([d.latitude, d.longitude]).setContent(buildPopup(d)).openOn(mapObj.current);
        });
        markersRef.current[d.ambulance_id] = m;
      }
    });
    Object.keys(markersRef.current).forEach(id => {
      if (!seen.has(parseInt(id))) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });
  };

  const buildPopup = (d) => `
    <div style="background:#1a1a1a;color:#fff;padding:12px 14px;border-radius:10px;min-width:200px;font-family:'Segoe UI',sans-serif">
      <div style="font-size:15px;font-weight:800;margin-bottom:8px">🚑 ${d.ambulance_number}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:3px">👤 ${d.driver}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px">📧 ${d.driver_email}</div>
      <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;
        background:${(STATUS_COLOR[d.status]||"#555")}22;color:${STATUS_COLOR[d.status]||"#555"};
        border:1px solid ${STATUS_COLOR[d.status]||"#555"}">
        ${d.status.replace("_"," ").toUpperCase()}
      </span>
      <div style="font-size:11px;color:#555;margin-top:8px">⚡ ${d.speed} km/h</div>
    </div>`;

  const focusDriver = (d) => {
    if (!mapObj.current) return;
    mapObj.current.flyTo([d.latitude, d.longitude], 16, { duration: 1 });
    setSelected(d);
    if (popupRef.current) popupRef.current.setLatLng([d.latitude, d.longitude]).setContent(buildPopup(d)).openOn(mapObj.current);
    setTimeout(() => onSelectDriver?.(d), 100);
  };

  // Fix map render — invalidateSize after map init
  useEffect(() => {
    if (!mapObj.current) return;
    const t1 = setTimeout(() => mapObj.current?.invalidateSize(), 100);
    const t2 = setTimeout(() => mapObj.current?.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [leafletReady]);

  const activeCount  = drivers.filter(d => d.status !== "offline").length;
  const enRouteCount = drivers.filter(d => d.status === "en_route").length;

  return (
    <>
      <style>{`
        .sr-dark-popup .leaflet-popup-content-wrapper {
          background: rgba(20,20,20,0.97) !important; border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 10px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
        }
        .sr-dark-popup .leaflet-popup-tip { background: rgba(20,20,20,0.97) !important; }
        .sr-dark-popup .leaflet-popup-close-button { color: rgba(255,255,255,0.4) !important; }
        .leaflet-control-zoom a { background: rgba(20,20,20,0.92) !important; color: #fff !important; border-color: rgba(255,255,255,0.1) !important; }
        .leaflet-control-zoom a:hover { background: rgba(40,40,40,0.95) !important; }
        .leaflet-routing-container { display: none !important; }

        /* ── RealTimeMap Layout ── */
        .rtm-root { display: flex; width: 100%; height: 100%; font-family: 'Segoe UI', sans-serif; }

        .rtm-sidebar {
          width: 280px; min-width: 280px;
          background: #111; border-right: 1px solid #1c1c1c;
          display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0;
        }
        .rtm-sidebar-header {
          padding: 12px 14px; border-bottom: 1px solid #1c1c1c;
          display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
        }
        .rtm-stats {
          display: flex; padding: 10px 12px; gap: 8px;
          border-bottom: 1px solid #1c1c1c; flex-shrink: 0;
        }
        .rtm-stat {
          flex: 1; border-radius: 8px; padding: 8px 4px; text-align: center;
        }
        .rtm-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .rtm-map-wrap { flex: 1; min-width: 0; position: relative; min-height: 0; }

        /* ── Mobile: stack vertically ── */
        @media (max-width: 767px) {
          .rtm-root { flex-direction: column; overflow-y: auto; }
          .rtm-sidebar {
            width: 100% !important;
            min-width: unset !important;
            max-width: 100% !important;
            border-right: none;
            border-bottom: 1px solid #1c1c1c;
            max-height: 300px;
            flex-shrink: 0;
          }
          .rtm-map-wrap {
            flex: none;
            height: 350px;
            min-height: 300px;
            width: 100%;
          }
          .rtm-map-wrap > div {
            position: absolute !important;
            top: 0 !important; left: 0 !important;
            right: 0 !important; bottom: 0 !important;
          }
        }
      `}</style>

      <div className="rtm-root">
        {/* Sidebar */}
        <div className="rtm-sidebar">
          <div className="rtm-sidebar-header">
            <span style={{ fontWeight:700, fontSize:14, color:"#fff" }}>🗺 Live Tracking</span>
            <span style={{ fontSize:11, color:"#444" }}>↻ {lastUpdate||"—"}</span>
          </div>
          <div className="rtm-stats">
            {[["Active",activeCount,"#00c853"],["En Route",enRouteCount,"#ff6d00"],["Total",drivers.length,"#4fc3f7"]].map(([l,v,c]) => (
              <div key={l} className="rtm-stat" style={{ background:c+"11", border:`1px solid ${c}33` }}>
                <div style={{ fontSize:20, fontWeight:700, color:"#fff" }}>{v}</div>
                <div style={{ fontSize:10, color:"#666", marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="rtm-list">
            {drivers.length === 0 && (
              <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"30px 10px", lineHeight:2 }}>
                Koi driver GPS nahi bhej raha<br/>
                <span style={{ fontSize:11, color:"#333" }}>Driver app se tracking start karo</span>
              </div>
            )}
            {drivers.map(d => (
              <div key={d.ambulance_id}
                style={{ background: selected?.ambulance_id===d.ambulance_id?"#1e1e1e":"#161616", border:`1px solid ${selected?.ambulance_id===d.ambulance_id?"#444":"#1c1c1c"}`, borderRadius:8, padding:"10px 12px", cursor:"pointer" }}
                onClick={() => focusDriver(d)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"#fff" }}>{d.ambulance_number}</span>
                  <span style={{ background:(STATUS_COLOR[d.status]||"#555")+"22", color:STATUS_COLOR[d.status]||"#555", border:`1px solid ${STATUS_COLOR[d.status]||"#555"}44`, borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:600, textTransform:"capitalize" }}>
                    {d.status.replace("_"," ")}
                  </span>
                </div>
                <div style={{ fontSize:11, color:"#555", marginBottom:2 }}>👤 {d.driver}</div>
                <div style={{ fontSize:11, color:"#555" }}>⚡ {d.speed} km/h</div>
                {d.active_route && (
                  <div style={{ fontSize:11, color:"#ff6d00", marginTop:4, background:"#ff6d0011", padding:"3px 6px", borderRadius:4 }}>
                    🗺 {d.active_route.pickup_location?.slice(0,28)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="rtm-map-wrap">
          <div ref={mapDivRef} style={{ position:"absolute", top:0, left:0, right:0, bottom:0 }} />
          {drivers.length === 0 && (
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", pointerEvents:"none", zIndex:1 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📡</div>
              <div style={{ color:"#333", fontSize:14 }}>Driver Inactive</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
