import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const MapView = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const { state } = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Aapki location dhundh raha hai...");
  const [error, setError] = useState(null);

  // hospital passed via router state: { name, address, latitude, longitude }
  const hospital = state?.hospital;

  useEffect(() => {
    if (!hospital) {
      navigate("/");
      return;
    }

    // Dynamically load Leaflet CSS + JS
    const loadLeaflet = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Also load Leaflet Routing Machine
      if (!document.getElementById("lrm-css")) {
        const link = document.createElement("link");
        link.id = "lrm-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css";
        document.head.appendChild(link);
      }

      if (!window.L?.Routing) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      initMap();
    };

    const initMap = () => {
      if (mapInstanceRef.current) return;

      const L = window.L;

      // Init map centered on hospital first
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([hospital.latitude, hospital.longitude], 14);

      mapInstanceRef.current = map;

      // Dark tile layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Custom zoom control (bottom right)
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Hospital marker (red)
      const hospitalIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            width:36px; height:36px;
            background:#E50914;
            border:3px solid #fff;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 4px 16px rgba(229,9,20,0.6);
          "></div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -40],
      });

      const hospitalMarker = L.marker([hospital.latitude, hospital.longitude], { icon: hospitalIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:'Helvetica Neue',sans-serif; padding:4px 2px;">
            <div style="font-weight:800; font-size:13px; color:#fff; margin-bottom:4px;">🏥 ${hospital.name}</div>
            <div style="font-size:11px; color:rgba(255,255,255,0.55);">${hospital.address || ""}</div>
          </div>
        `, {
          className: "dark-popup",
          maxWidth: 220,
        })
        .openPopup();

      // Get user's current location
      setStatus("Aapki location dhundh raha hai...");

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
          const hospLatLng = L.latLng(hospital.latitude, hospital.longitude);

          setStatus("Route calculate ho raha hai...");

          // User marker (teal)
          const userIcon = L.divIcon({
            className: "",
            html: `
              <div style="position:relative; width:18px; height:18px;">
                <div style="
                  width:18px; height:18px;
                  background:#00d4aa;
                  border:3px solid #fff;
                  border-radius:50%;
                  box-shadow:0 0 0 6px rgba(0,212,170,0.25);
                "></div>
              </div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });

          L.marker(userLatLng, { icon: userIcon })
            .addTo(map)
            .bindPopup(`<div style="font-family:'Helvetica Neue',sans-serif; font-weight:700; font-size:12px; color:#fff;">📍 Aap yahan hain</div>`, {
              className: "dark-popup",
            });

          // Draw route using OSRM (free, no API key)
          const routing = L.Routing.control({
            waypoints: [userLatLng, hospLatLng],
            router: L.Routing.osrmv1({
              serviceUrl: "https://router.project-osrm.org/route/v1",
              profile: "driving",
            }),
            lineOptions: {
              styles: [
                { color: "#E50914", weight: 5, opacity: 0.9 },
                { color: "#fff",    weight: 2, opacity: 0.3 },
              ],
              extendToWaypoints: true,
              missingRouteTolerance: 0,
            },
            show: false,           // hide default turn-by-turn panel
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            showAlternatives: false,
            createMarker: () => null, // use our own markers
          }).addTo(map);

          routing.on("routesfound", (e) => {
            const summary = e.routes[0].summary;
            const km = (summary.totalDistance / 1000).toFixed(1);
            const mins = Math.round(summary.totalTime / 60);
            setStatus(`${km} km · ~${mins} min`);
          });

          routing.on("routingerror", () => {
            setStatus(null);
            setError("Route nahi mila. GPS check karein.");
            map.fitBounds([userLatLng, hospLatLng], { padding: [60, 60] });
          });
        },
        (err) => {
          setStatus(null);
          setError("Location access nahi mili. Browser settings check karein.");
          // Still show hospital on map
          map.setView([hospital.latitude, hospital.longitude], 15);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    loadLeaflet().catch(() => setError("Map load nahi hua. Internet check karein."));

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .mv-root {
          background: #0f0f0f;
          height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          overflow: hidden;
        }

        /* TOP BAR */
        .mv-topbar {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: linear-gradient(to bottom, rgba(10,10,10,0.95) 0%, transparent 100%);
        }

        .mv-back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px; height: 38px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 50%;
          cursor: pointer;
          color: #fff;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .mv-back-btn:hover { background: rgba(255,255,255,0.2); }

        .mv-hosp-info { flex: 1; min-width: 0; }
        .mv-hosp-name {
          font-size: 15px;
          font-weight: 800;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.3px;
        }
        .mv-hosp-addr {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        /* STATUS PILL */
        .mv-status-pill {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15,15,15,0.92);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 100px;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          backdrop-filter: blur(12px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        }
        .mv-status-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #00d4aa;
          animation: pulse 1.5s infinite;
          flex-shrink: 0;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }

        .mv-error-pill {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: rgba(229,9,20,0.15);
          border: 1px solid rgba(229,9,20,0.4);
          border-radius: 100px;
          padding: 10px 20px;
          font-size: 12px;
          font-weight: 600;
          color: #ff4d5a;
          white-space: nowrap;
          backdrop-filter: blur(12px);
        }

        /* MAP CONTAINER */
        .mv-map {
          flex: 1;
          width: 100%;
          height: 100%;
        }

        /* Override Leaflet popup styles */
        .dark-popup .leaflet-popup-content-wrapper {
          background: rgba(20,20,20,0.95) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
          backdrop-filter: blur(12px);
        }
        .dark-popup .leaflet-popup-tip {
          background: rgba(20,20,20,0.95) !important;
        }
        .dark-popup .leaflet-popup-close-button {
          color: rgba(255,255,255,0.4) !important;
        }

        /* Hide LRM default container */
        .leaflet-routing-container { display: none !important; }

        .leaflet-control-zoom a {
          background: rgba(20,20,20,0.9) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.12) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(40,40,40,0.95) !important;
        }
      `}</style>

      <div className="mv-root">
        {/* Top bar */}
        <div className="mv-topbar">
          <button className="mv-back-btn" onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div className="mv-hosp-info">
            <div className="mv-hosp-name">🏥 {hospital?.name}</div>
            <div className="mv-hosp-addr">{hospital?.address}</div>
          </div>
        </div>

        {/* Map */}
        <div ref={mapRef} className="mv-map" />

        {/* Status */}
        {status && !error && (
          <div className="mv-status-pill">
            <span className="mv-status-dot" />
            {status}
          </div>
        )}
        {error && (
          <div className="mv-error-pill">⚠️ {error}</div>
        )}
      </div>
    </>
  );
};

export default MapView;
