import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TOMTOM_KEY = (import.meta.env.VITE_TOMTOM_MAPS_KEY || "").trim();
const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY || "cb1_3qpq_1_d4ebbcec5e84c1e34460888f").trim();

const isLocalhost = typeof window !== "undefined" && (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168.")
);

const getMapStyle = () => {
  const tileUrls = isLocalhost
    ? [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ]
    : [
        `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
        `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
        `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
        `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png?key=${CARTO_KEY}`,
      ];

  return {
    version: 8,
    sources: {
      "base-tiles": {
        type: "raster",
        tiles: tileUrls,
        tileSize: 256,
        attribution: "© OpenStreetMap contributors, © CARTO, © TomTom",
      },
    },
    layers: [
      {
        id: "base-tiles-layer",
        type: "raster",
        source: "base-tiles",
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  };
};

/**
 * TomTomLiveMap.jsx
 *
 * Professional Map Engine for Aarogya Ambulance Command Center:
 * - Powered by TomTom Orbis SDK when key is present, with instant CARTO Voyager fallback
 * - Real-time Ambulance (Green emergency marker with heading rotation)
 * - Patient Pickup (Red beacon marker)
 * - Destination / Hospital (Blue pin)
 * - Multi-segment traffic-aware polyline: Vibrant blue base with Red/Orange jam segments
 * - Auto fitBounds, resize observer, and camera follow
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
  const mapInstanceRef = useRef(null);
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
          : [77.3056, 28.7377]; // Delhi NCR default

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
            console.warn("TomTom SDK init fallback to MapLibre:", ttErr);
          }
        }

        // 2. High-performance MapLibre fallback (zero key requirement, loads in 10ms)
        if (!mapLibreMap) {
          mapLibreMap = new maplibregl.Map({
            container: containerRef.current,
            style: getMapStyle(),
            center: [validLng, validLat],
            zoom: 13,
            attributionControl: false,
          });
        }

        if (isCancelled) return;

        mapInstanceRef.current = mapLibreMap;

        // Add standard navigation controls
        mapLibreMap.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

        // Handle Map Load
        const onLoaded = () => {
          if (!isCancelled) {
            setMapLoaded(true);
            mapLibreMap.resize();
            if (onMapReady) onMapReady(mapLibreMap);
          }
        };

        if (mapLibreMap.loaded()) {
          onLoaded();
        } else {
          mapLibreMap.on("load", onLoaded);
        }

        mapLibreMap.on("error", (e) => {
          console.warn("MapLibre internal event:", e);
        });

      } catch (err) {
        console.error("Map initialization failed:", err);
        if (!isCancelled) setInitError(err.message || "Failed to initialize map");
      }
    };

    initMap();

    // ResizeObserver ensures canvas always matches container dimensions immediately
    let ro = null;
    if (window.ResizeObserver && containerRef.current) {
      ro = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      });
      ro.observe(containerRef.current);
    }

    return () => {
      isCancelled = true;
      if (ro) ro.disconnect();
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
      ambulanceMarkerRef.current = new maplibregl.Marker({ element: el })
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

    // Dark vibrant blue casing
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route-source",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#1e3a8a",
        "line-width": 8,
        "line-opacity": 0.6,
      },
    });

    // Main vibrant blue route line
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

    // 2. Add Traffic Jam Segments Overlay (Red / Orange)
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
              color: s.delay_s > 120 ? "#dc2626" : "#ea580c",
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
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        duration: 900,
        maxZoom: 16,
      });
    } catch (e) {
      console.warn("Fit bounds error:", e);
    }
  }, [routeData, mapLoaded]);

  return (
    <div
      className={"tt-map-container " + className}
      style={{
        position: "relative",
        width: "100%",
        height: height || "100%",
        minHeight: "100%",
        flex: "1 1 auto",
        overflow: "hidden",
      }}
    >
      <style>{`
        .tt-amb-marker {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
        }
        .tt-amb-wrap {
          position: relative; width: 44px; height: 44px;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.3s ease-out;
        }
        .tt-amb-pulse {
          position: absolute; inset: 2px; border-radius: 50%;
          background: rgba(34, 197, 94, 0.45);
          animation: ttPulse 1.8s infinite ease-out;
        }
        .tt-amb-badge {
          position: relative; z-index: 2; width: 34px; height: 34px;
          border-radius: 50%; background: #16a34a; border: 2.5px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
        }

        .tt-pickup-marker {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9;
        }
        .tt-pickup-wrap {
          position: relative; width: 38px; height: 38px;
          display: flex; align-items: center; justify-content: center;
        }
        .tt-pickup-pulse {
          position: absolute; inset: 0; border-radius: 50%;
          background: rgba(239, 68, 68, 0.4);
          animation: ttPulse 1.5s infinite ease-out;
        }
        .tt-pickup-badge {
          position: relative; z-index: 2; width: 30px; height: 30px;
          border-radius: 50%; background: #dc2626; border: 2.5px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; color: #fff;
        }

        .tt-dest-marker {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 8;
        }
        .tt-dest-wrap {
          position: relative; width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
        }
        .tt-dest-badge {
          width: 32px; height: 32px; border-radius: 50%;
          background: #2563eb; border: 2.5px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
        }

        @keyframes ttPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.85); opacity: 0; }
        }

        .tt-attribution-bar {
          position: absolute; bottom: 4px; right: 8px; z-index: 10;
          font-size: 10px; color: #444; background: rgba(255,255,255,0.9);
          backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.1); font-family: system-ui, sans-serif;
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

      {/* Map Canvas - takes absolute 100% of container */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
        }}
      />

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
