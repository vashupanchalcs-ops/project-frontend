import { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import {
  DELHI,
  ensureGoogleMaps,
  hasConfiguredGoogleMapsKey,
} from "../utils/googleMaps";

const BASE = "http://127.0.0.1:8000";
const REFRESH = 5000;

const statusColors = {
  available: "#00c853",
  en_route: "#f7c948",
  busy: "#ff4d5a",
  offline: "#888888",
};

const markerIcon = (color) => ({
  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
  scale: 9,
  fillColor: color,
  fillOpacity: 0.95,
  strokeColor: "#ffffff",
  strokeWeight: 2,
});

export default function RealTimeMap({ onSelectDriver }) {
  const [drivers, setDrivers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mapsReady, setMapsReady] = useState(Boolean(window.google?.maps));
  const [mapsAvailable, setMapsAvailable] = useState(hasConfiguredGoogleMapsKey());

  useEffect(() => {
    const handleUp   = () => setIsOnline(true);
    const handleDown = () => setIsOnline(false);
    window.addEventListener("online", handleUp);
    window.addEventListener("offline", handleDown);
    return () => {
      window.removeEventListener("online", handleUp);
      window.removeEventListener("offline", handleDown);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchLocations = async () => {
      try {
        const res = await fetch(`${BASE}/api/admin/live-locations/`);
        const data = await res.json();
        if (!mounted) return;
        setDrivers(Array.isArray(data) ? data : []);
        setLastUpdate(new Date().toLocaleTimeString());
      } catch {
        if (mounted) setDrivers([]);
      }
    };
    fetchLocations();
    const timer = setInterval(fetchLocations, REFRESH);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const initMaps = async () => {
      if (!hasConfiguredGoogleMapsKey()) {
        if (!active) return;
        setMapsAvailable(false);
        setMapsReady(false);
        return;
      }
      const ok = await ensureGoogleMaps(10000);
      if (!active) return;
      setMapsAvailable(true);
      setMapsReady(ok);
    };
    initMaps();
    return () => {
      active = false;
    };
  }, []);

  const activeCount = useMemo(
    () => drivers.filter((d) => d.status !== "offline").length,
    [drivers]
  );
  const enRouteCount = useMemo(
    () => drivers.filter((d) => d.status === "en_route").length,
    [drivers]
  );
  const lowBatteryDrivers = useMemo(
    () =>
      drivers.filter((d) => {
        const battery = Number(d?.battery ?? d?.battery_percentage);
        return Number.isFinite(battery) && battery <= 15;
      }),
    [drivers]
  );

  const handleSelect = (driver) => {
    setSelected(driver);
    onSelectDriver?.(driver);
  };

  return (
    <>
      <style>{`
        .rtm-root { display:flex; width:100%; height:100%; font-family:'Segoe UI',sans-serif; background:#f5f5ef; }
        .rtm-sidebar { width:280px; min-width:280px; background:#fff; border-right:1px solid rgba(17,17,17,0.12); display:flex; flex-direction:column; }
        .rtm-sidebar-header { padding:12px 14px; border-bottom:1px solid rgba(17,17,17,0.08); display:flex; justify-content:space-between; align-items:center; }
        .rtm-stats { display:flex; gap:8px; padding:10px 12px; border-bottom:1px solid rgba(17,17,17,0.08); }
        .rtm-stat { flex:1; text-align:center; border:1px solid rgba(214,232,0,0.85); background:#f9f9ee; border-radius:10px; padding:8px 4px; }
        .rtm-low-batt-alert {
          margin: 8px 10px 0;
          border: 1px solid rgba(229, 9, 20, 0.35);
          background: rgba(229, 9, 20, 0.08);
          color: #a80f1a;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 700;
        }
        .rtm-list { flex:1; overflow:auto; padding:10px; display:flex; flex-direction:column; gap:8px; }
        .rtm-item { background:#fff; border:1px solid rgba(17,17,17,0.16); border-radius:10px; padding:10px; cursor:pointer; }
        .rtm-item.sel { background:#eef2b2; border-color:#d6e800; }
        .rtm-item.critical { border-color: rgba(229, 9, 20, 0.45); background: rgba(229, 9, 20, 0.05); }
        .rtm-battery-badge {
          font-size: 10px;
          font-weight: 800;
          border-radius: 20px;
          border: 1px solid;
          padding: 2px 8px;
          line-height: 1.2;
        }
        .rtm-battery-badge.ok {
          color: #0b7a35;
          border-color: rgba(11, 122, 53, 0.35);
          background: rgba(0, 200, 83, 0.12);
        }
        .rtm-battery-badge.critical {
          color: #b31321;
          border-color: rgba(179, 19, 33, 0.35);
          background: rgba(229, 9, 20, 0.14);
        }
        .rtm-map-wrap { flex:1; min-width:0; position:relative; }
        .rtm-map { width:100%; height:100%; }
        @media (max-width: 767px) {
          .rtm-root { flex-direction:column; }
          .rtm-sidebar { width:100%; min-width:100%; max-height:300px; border-right:none; border-bottom:1px solid rgba(17,17,17,0.12); }
          .rtm-map-wrap { height:380px; min-height:300px; }
        }
      `}</style>
      <div className="rtm-root">
        <div className="rtm-sidebar">
          <div className="rtm-sidebar-header">
            <span style={{ fontWeight: 800, fontSize: 14 }}>Live Tracking</span>
            <span style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>↻ {lastUpdate || "—"}</span>
          </div>
          <div className="rtm-stats">
            <div className="rtm-stat">
              <div style={{ fontWeight: 900, fontSize: 20 }}>{activeCount}</div>
              <div style={{ fontSize: 10 }}>Active</div>
            </div>
            <div className="rtm-stat">
              <div style={{ fontWeight: 900, fontSize: 20 }}>{enRouteCount}</div>
              <div style={{ fontSize: 10 }}>En Route</div>
            </div>
            <div className="rtm-stat">
              <div style={{ fontWeight: 900, fontSize: 20 }}>{drivers.length}</div>
              <div style={{ fontSize: 10 }}>Total</div>
            </div>
          </div>
          {lowBatteryDrivers.length > 0 && (
            <div className="rtm-low-batt-alert">
              ⚠ Low battery alert: {lowBatteryDrivers.length} ambulance
              {lowBatteryDrivers.length > 1 ? "s" : ""} below 15%.
            </div>
          )}
          <div className="rtm-list">
            {drivers.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(17,17,17,0.62)", fontSize: 12, padding: "24px 6px" }}>
                No live GPS found.
              </div>
            )}
            {drivers.map((d) => {
              const isSel = selected?.ambulance_id === d.ambulance_id;
              const color = statusColors[d.status] || statusColors.offline;
              const battery = Number(d?.battery ?? d?.battery_percentage);
              const hasBattery = Number.isFinite(battery);
              const isBatteryCritical = hasBattery && battery <= 15;
              return (
                <div
                  key={d.ambulance_id}
                  className={`rtm-item ${isSel ? "sel" : ""} ${isBatteryCritical ? "critical" : ""}`}
                  onClick={() => handleSelect(d)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <b>{d.ambulance_number}</b>
                    <span style={{ color, fontSize: 11, fontWeight: 700 }}>{String(d.status || "").replace("_", " ")}</span>
                  </div>
                  <div style={{ fontSize: 11 }}>{d.driver}</div>
                  <div style={{ fontSize: 11, color: "rgba(17,17,17,0.65)", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                    <span>Speed: {d.speed || 0} km/h</span>
                    {hasBattery && (
                      <span className={`rtm-battery-badge ${isBatteryCritical ? "critical" : "ok"}`}>
                        🔋 {battery}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rtm-map-wrap">
          {!isOnline ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", background: "#e8e8e3", padding: 20 }}>
              <div style={{ fontSize: 50, marginBottom: 16 }}>📶</div>
              <h3 style={{ margin: "0 0 8px", color: "#b31321", fontSize: 20 }}>You are Offline</h3>
              <p style={{ margin: 0, color: "rgba(17,17,17,0.7)", maxWidth: 300, lineHeight: 1.5 }}>
                Live map tracking requires an active internet connection. Please check your network.
              </p>
            </div>
          ) : !mapsAvailable ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", background: "#e8e8e3", padding: 20 }}>
              <div style={{ fontSize: 46, marginBottom: 14 }}>🗺️</div>
              <h3 style={{ margin: "0 0 8px", color: "#111", fontSize: 20 }}>Google Maps key missing</h3>
              <p style={{ margin: 0, color: "rgba(17,17,17,0.7)", maxWidth: 340, lineHeight: 1.5 }}>
                Set <b>VITE_GOOGLE_MAPS_API_KEY</b> in your frontend env file to enable live map rendering.
              </p>
            </div>
          ) : !mapsReady ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", background: "#e8e8e3", padding: 20 }}>
              <div style={{ fontSize: 46, marginBottom: 14 }}>⌛</div>
              <h3 style={{ margin: "0 0 8px", color: "#111", fontSize: 20 }}>Loading live map</h3>
              <p style={{ margin: 0, color: "rgba(17,17,17,0.7)", maxWidth: 340, lineHeight: 1.5 }}>
                Map services are still initializing.
              </p>
            </div>
          ) : (
            <GoogleMap
              mapContainerClassName="rtm-map"
              center={selected ? { lat: Number(selected.latitude), lng: Number(selected.longitude) } : DELHI}
              zoom={selected ? 14 : 11}
              options={{
                fullscreenControl: false,
                streetViewControl: false,
                mapTypeControl: false,
                gestureHandling: "greedy",
              }}
            >
              {drivers.map((d) => (
                <Marker
                  key={d.ambulance_id}
                  position={{ lat: Number(d.latitude), lng: Number(d.longitude) }}
                  icon={markerIcon(statusColors[d.status] || statusColors.offline)}
                  title={`${d.ambulance_number} - ${d.driver}`}
                  onClick={() => handleSelect(d)}
                />
              ))}
              {selected && (
                <InfoWindow
                  position={{ lat: Number(selected.latitude), lng: Number(selected.longitude) }}
                  onCloseClick={() => setSelected(null)}
                >
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 800 }}>{selected.ambulance_number}</div>
                    <div style={{ fontSize: 12 }}>{selected.driver}</div>
                    <div style={{ fontSize: 12, color: "rgba(17,17,17,0.72)" }}>{selected.driver_email}</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Status: <b>{String(selected.status || "").replace("_", " ")}</b>
                    </div>
                    {Number.isFinite(Number(selected?.battery ?? selected?.battery_percentage)) && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Battery: <b>{Number(selected?.battery ?? selected?.battery_percentage)}%</b>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>
      </div>
    </>
  );
}
