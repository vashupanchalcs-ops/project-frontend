import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TOMTOM_KEY = (import.meta.env.VITE_TOMTOM_MAPS_KEY || "").trim();
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/**
 * TomTomLiveMap.jsx
 *
 * High-performance MapLibre & TomTom Orbis map engine for Aarogya Command Center:
 * - Pickup (Red beacon marker)
 * - Ambulance (Green emergency marker with heading rotation)
 * - Destination / Hospital (Blue pin)
 * - Multi-segment traffic-aware polyline: Blue base with Red/Orange jam segments
 * - Auto fitBounds & smooth camera tracking
 * - Attribution: © TomTom / © OpenStreetMap preserved
 */
export default function TomTomLiveMap({
  ambulanceLoc = null,    // { lat, lng, heading, speed }
  pickupLoc = null,       // { lat, lng, label }
  destinationLoc = null,  // { lat, lng, name }
  routeData = null,       // Normalized JSON from POST /api/route/
  followAmbulance = false,
  loading = false,
  error = null,
  height = "100%",
  className = "",
  onMapReady = null,
}) {
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null); // MapLibre map reference
  const tomtomInstanceRef = useRef(null); // TomTomMap instance
  const ambulanceMarkerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [initError, setInitError] = useState(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;
    let isCancelled = false;

    const initMap = async () => {
      try {
        const initialCenter = ambulanceLoc
          ? [Number(ambulanceLoc.lng), Number(ambulanceLoc.lat)]
          : pickupLoc
          ? [Number(pickupLoc.lng), Number(pickupLoc.lat)]
          : [77.3056, 28.7377]; // Delhi / NCR default

        const validLng = Number.isFinite(initialCenter[0]) ? initialCenter[0] : 77.3056;
        const validLat = Number.isFinite(initialCenter[1]) ? initialCenter[1] : 28.7377;

        let mapLibreMap = null;

        // 1. If TomTom API key configured, attempt to load TomTom Orbis SDK
        if (TOMTOM_KEY) {
          try {
            const core = await import("@tomtom-org/maps-sdk/core");
            const mapModule = await import("@tomtom-org/maps-sdk/map");
            if (core.TomTomConfig && mapModule.TomTomMap) {
              core.TomTomConfig.instance.put({ apiKey: TOMTOM_KEY });
              const ttMap = new mapModule.TomTomMap({
                mapLibre: {
                  container: containerRef.current,
                  center: [validLng, validLat],
                  zoom: 13,
                  attributionControl: false,
                },
              });

              tomtomInstanceRef.current = ttMap;
              mapLibreMap = ttMap.mapLibreMap;

              if (mapModule.TrafficFlowModule) {
                try {
                  const trafficFlow = await mapModule.TrafficFlowModule.create(ttMap);
                  trafficFlow.show();
                } catch (tfErr) {
                  console.warn("Traffic flow layer skipped:", tfErr);
                }
              }
            }
          } catch (ttErr) {
            console.warn("TomTom SDK init fallback to MapLibre Positron:", ttErr);
          }
        }

        // 2. Fallback to MapLibre with OpenFreeMap Positron (Zero key requirement)
        if (!mapLibreMap) {
          mapLibreMap = new maplibregl.Map({
            container: containerRef.current,
            style: OPENFREEMAP_STYLE,
            center: [validLng, validLat],
            zoom: 13,
            attributionControl: false,
          });
        }

        if (isCancelled) return;

        mapInstanceRef.current = mapLibreMap;

        // Add standard navigation controls
        mapLibreMap.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

        mapLibreMap.on("load", () => {
          if (!isCancelled) {
            setMapLoaded(true);
            if (onMapReady) onMapReady(mapLibreMap);
          }
        });

      } catch (err) {
        console.error("Map initialization failed:", err);
        if (!isCancelled) setInitError(err.message || "Failed to initialize map");
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      if (ambulanceMarkerRef.current) ambulanceMarkerRef.current.remove();
      if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
      if (destMarkerRef.current) destMarkerRef.current.remove();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Ambulance Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !ambulanceLoc) return;

    const lat = Number(ambulanceLoc.lat);
    const lng = Number(ambulanceLoc.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const heading = Number(ambulanceLoc.heading) || 0;

    if (!ambulanceMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "tt-amb-marker";
      el.innerHTML = '<div class="tt-amb-wrap" style="transform: rotate(' + heading + 'deg);"><div class="tt-amb-pulse"></div><div class="tt-amb-badge">🚑</div></div>';
      ambulanceMarkerRef.current = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      ambulanceMarkerRef.current.setLngLat([lng, lat]);
      const wrap = ambulanceMarkerRef.current.getElement().querySelector(".tt-amb-wrap");
      if (wrap) wrap.style.transform = 'rotate(' + heading + 'deg)';
    }

    if (followAmbulance) {
      map.easeTo({ center: [lng, lat], duration: 800 });
    }
  }, [ambulanceLoc, mapLoaded, followAmbulance]);

  // Update Pickup Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    if (!pickupLoc || !Number.isFinite(Number(pickupLoc.lat)) || !Number.isFinite(Number(pickupLoc.lng))) {
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.remove();
        pickupMarkerRef.current = null;
      }
      return;
    }

    const lat = Number(pickupLoc.lat);
    const lng = Number(pickupLoc.lng);

    if (!pickupMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "tt-pickup-marker";
      el.innerHTML = '<div class="tt-pickup-wrap"><div class="tt-pickup-pulse"></div><div class="tt-pickup-badge">📍</div></div>';
      pickupMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      pickupMarkerRef.current.setLngLat([lng, lat]);
    }
  }, [pickupLoc, mapLoaded]);

  // Update Destination / Hospital Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    if (!destinationLoc || !Number.isFinite(Number(destinationLoc.lat)) || !Number.isFinite(Number(destinationLoc.lng))) {
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      return;
    }

    const lat = Number(destinationLoc.lat);
    const lng = Number(destinationLoc.lng);

    if (!destMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "tt-dest-marker";
      el.innerHTML = '<div class="tt-dest-wrap"><div class="tt-dest-badge">🏥</div></div>';
      destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      destMarkerRef.current.setLngLat([lng, lat]);
    }
  }, [destinationLoc, mapLoaded]);

  // Render Route and Traffic Sections
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    const removeLayers = () => {
      try {
        if (map.getLayer("route-traffic-jam")) map.removeLayer("route-traffic-jam");
        if (map.getLayer("route-base")) map.removeLayer("route-base");
        if (map.getLayer("route-casing")) map.removeLayer("route-casing");
        if (map.getSource("route-source")) map.removeSource("route-source");
        if (map.getSource("traffic-jam-source")) map.removeSource("traffic-jam-source");
      } catch (e) {
        // Safe layer cleanup
      }
    };

    if (!routeData || !routeData.geometry || !routeData.geometry.coordinates || routeData.geometry.coordinates.length < 2) {
      removeLayers();
      return;
    }

    removeLayers();

    const coordinates = routeData.geometry.coordinates;

    // 1. Add Main Route Line Source
    map.addSource("route-source", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates,
        },
      },
    });

    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route-source",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#1d4ed8",
        "line-width": 8,
        "line-opacity": 0.5,
      },
    });

    map.addLayer({
      id: "route-base",
      type: "line",
      source: "route-source",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#2563eb",
        "line-width": 6,
      },
    });

    // 2. Add Traffic Jam Segments Overlay (Red/Orange)
    const trafficSections = routeData.traffic_sections || [];
    const jamFeatures = [];

    trafficSections.forEach((s, idx) => {
      if ((s.category === "JAM" || s.delay_s > 30) && s.end_index > s.start_index) {
        const segCoords = coordinates.slice(s.start_index, s.end_index + 1);
        if (segCoords.length >= 2) {
          jamFeatures.push({
            type: "Feature",
            id: idx,
            properties: {
              delay: s.delay_s,
              color: s.delay_s > 120 ? "#dc2626" : "#f97316",
            },
            geometry: {
              type: "LineString",
              coordinates: segCoords,
            },
          });
        }
      }
    });

    if (jamFeatures.length > 0) {
      map.addSource("traffic-jam-source", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: jamFeatures,
        },
      });

      map.addLayer({
        id: "route-traffic-jam",
        type: "line",
        source: "traffic-jam-source",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 6.5,
        },
      });
    }

    // 3. Fit bounds to route
    try {
      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        duration: 900,
        maxZoom: 16,
      });
    } catch (e) {
      console.warn("Fit bounds error:", e);
    }
  }, [routeData, mapLoaded]);

  return (
    <div className={"tt-map-container " + className} style={{ width: "100%", height, position: "relative", overflow: "hidden" }}>
      <style>{`
        .tt-amb-marker { pointer-events: none; }
        .tt-amb-wrap {
          position: relative; width: 42px; height: 42px;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.3s ease-out;
        }
        .tt-amb-pulse {
          position: absolute; inset: 2px; border-radius: 50%;
          background: rgba(34, 197, 94, 0.4);
          animation: ttPulse 1.8s infinite ease-out;
        }
        .tt-amb-badge {
          position: relative; z-index: 2; width: 34px; height: 34px;
          border-radius: 50%; background: #16a34a; border: 2.5px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
        }

        .tt-pickup-marker { pointer-events: none; }
        .tt-pickup-wrap {
          position: relative; width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
        }
        .tt-pickup-pulse {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(239, 68, 68, 0.35);
          animation: ttPulse 1.5s infinite ease-out;
        }
        .tt-pickup-badge {
          position: relative; z-index: 2; width: 30px; height: 30px;
          border-radius: 50%; background: #dc2626; border: 2.5px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; color: #fff;
        }

        .tt-dest-marker { pointer-events: none; }
        .tt-dest-wrap {
          position: relative; width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
        }
        .tt-dest-badge {
          width: 32px; height: 32px; border-radius: 50%;
          background: #2563eb; border: 2.5px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }

        @keyframes ttPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.85); opacity: 0; }
        }

        .tt-attribution-bar {
          position: absolute; bottom: 4px; right: 8px; z-index: 10;
          font-size: 10px; color: #555; background: rgba(255,255,255,0.85);
          backdrop-filter: blur(4px); padding: 2px 6px; border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.08); font-family: system-ui, sans-serif;
          pointer-events: auto;
        }

        .tt-map-overlay {
          position: absolute; top: 12px; left: 12px; z-index: 20;
          background: rgba(255,255,255,0.96); backdrop-filter: blur(8px);
          border: 1px solid rgba(0,0,0,0.1); border-radius: 10px;
          padding: 8px 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          font-family: system-ui, sans-serif; font-size: 12px; font-weight: 700;
          display: flex; align-items: center; gap: 8px;
        }
      `}</style>

      {/* Map Canvas */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading Overlay */}
      {loading && (
        <div className="tt-map-overlay">
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
          <span>Calculating live traffic route...</span>
        </div>
      )}

      {/* Error / Route Unavailable Banner */}
      {error && !loading && (
        <div className="tt-map-overlay" style={{ borderLeft: "4px solid #ef4444" }}>
          <span>⚠️</span>
          <span style={{ color: "#b91c1c" }}>{error}</span>
        </div>
      )}

      {/* Mandatory Attribution */}
      <div className="tt-attribution-bar">
        © TomTom | © OpenStreetMap contributors
      </div>
    </div>
  );
}
