import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const TOMTOM_KEY = (import.meta.env.VITE_TOMTOM_MAPS_KEY || "").trim();

// OpenFreeMap Liberty: rich vector style with road names, street names, shops, POIs, and city labels
const VECTOR_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// High-reliability OSM raster style fallback
const isIndiaPoint = (lat, lng) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) && nLat >= 6 && nLat <= 38 && nLng >= 68 && nLng <= 98;
};

const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    "base-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors, © OpenFreeMap",
    },
  },
  layers: [
    {
      id: "base-tiles-layer",
      type: "raster",
      source: "base-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
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
        let validLng = 77.3056;
        let validLat = 28.7377;
        if (ambulanceLoc && isIndiaPoint(ambulanceLoc.lat, ambulanceLoc.lng)) {
          validLng = Number(ambulanceLoc.lng);
          validLat = Number(ambulanceLoc.lat);
        } else if (pickupLoc && isIndiaPoint(pickupLoc.lat, pickupLoc.lng)) {
          validLng = Number(pickupLoc.lng);
          validLat = Number(pickupLoc.lat);
        } else if (destinationLoc && isIndiaPoint(destinationLoc.lat, destinationLoc.lng)) {
          validLng = Number(destinationLoc.lng);
          validLat = Number(destinationLoc.lat);
        }

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

        // 2. High-performance MapLibre vector map (OpenFreeMap Liberty with full labels)
        if (!mapLibreMap) {
          mapLibreMap = new maplibregl.Map({
            container: containerRef.current,
            style: VECTOR_STYLE_URL,
            center: [validLng, validLat],
            zoom: 13,
            attributionControl: false,
          });

          // Fallback to OSM raster tiles if vector style fails
          mapLibreMap.once("error", (e) => {
            console.warn("Vector map style warning, checking fallback:", e);
            try {
              if (!mapLibreMap.getStyle()) {
                mapLibreMap.setStyle(OSM_RASTER_STYLE);
              }
            } catch (_) {}
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
    if (!isIndiaPoint(lat, lng)) {
      if (ambulanceMarkerRef.current) {
        ambulanceMarkerRef.current.remove();
        ambulanceMarkerRef.current = null;
      }
      return;
    }

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

    if (!pickupLoc || !isIndiaPoint(pickupLoc.lat, pickupLoc.lng)) {
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

    if (!destinationLoc || !isIndiaPoint(destinationLoc.lat, destinationLoc.lng)) {
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

  // Auto-fit to active markers when no routeData is present yet
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || routeData) return;

    const points = [];
    if (ambulanceLoc && isIndiaPoint(ambulanceLoc.lat, ambulanceLoc.lng)) {
      points.push([Number(ambulanceLoc.lng), Number(ambulanceLoc.lat)]);
    }
    if (pickupLoc && isIndiaPoint(pickupLoc.lat, pickupLoc.lng)) {
      points.push([Number(pickupLoc.lng), Number(pickupLoc.lat)]);
    }
    if (destinationLoc && isIndiaPoint(destinationLoc.lat, destinationLoc.lng)) {
      points.push([Number(destinationLoc.lng), Number(destinationLoc.lat)]);
    }

    if (points.length >= 2) {
      try {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, {
          padding: { top: 70, bottom: 70, left: 70, right: 70 },
          maxZoom: 15,
          duration: 600,
        });
      } catch (_) {}
    } else if (points.length === 1) {
      map.easeTo({ center: points[0], zoom: 14, duration: 600 });
    }
  }, [ambulanceLoc, pickupLoc, destinationLoc, mapLoaded, routeData]);

  // Render Route and Traffic Sections
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let isEffectCancelled = false;

    const renderRoute = () => {
      if (isEffectCancelled || !mapInstanceRef.current) return;
      const currentMap = mapInstanceRef.current;

      // Ensure style is loaded before adding layers/sources
      if (!currentMap.getStyle()) {
        currentMap.once("style.load", renderRoute);
        return;
      }

      const removeLayers = () => {
        try {
          if (currentMap.getLayer("route-traffic-jam")) currentMap.removeLayer("route-traffic-jam");
          if (currentMap.getLayer("route-base")) currentMap.removeLayer("route-base");
          if (currentMap.getLayer("route-casing")) currentMap.removeLayer("route-casing");
          if (currentMap.getSource("route-source")) currentMap.removeSource("route-source");
          if (currentMap.getSource("traffic-jam-source")) currentMap.removeSource("traffic-jam-source");
        } catch (e) {
          // Safe layer cleanup
        }
      };

      if (!routeData || !routeData.geometry || !Array.isArray(routeData.geometry.coordinates)) {
        removeLayers();
        return;
      }

      let coordinates = (routeData.geometry.coordinates || [])
        .filter((c) => Array.isArray(c) && c.length >= 2)
        .map(([c0, c1]) => {
          const n0 = Number(c0);
          const n1 = Number(c1);
          if (!Number.isFinite(n0) || !Number.isFinite(n1)) return null;
          // In India: lat is 6..38, lng is 68..98. MapLibre GeoJSON requires [lng, lat]
          if (n0 >= 6 && n0 <= 38 && n1 >= 68 && n1 <= 98) {
            return [n1, n0];
          }
          if (n0 >= 68 && n0 <= 98 && n1 >= 6 && n1 <= 38) {
            return [n0, n1];
          }
          return null; // DISCARD ANY COORDINATE OUTSIDE INDIA (especially [0, 0])
        })
        .filter(Boolean);

      if (coordinates.length < 2) {
        removeLayers();
        return;
      }

      const geojsonFeature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates,
        },
      };

      // 1. Add or Update Main Route Line Source
      const existingSource = currentMap.getSource("route-source");
      const hasBaseLayer = Boolean(currentMap.getLayer("route-base"));

      if (existingSource && typeof existingSource.setData === "function" && hasBaseLayer) {
        existingSource.setData(geojsonFeature);
      } else {
        removeLayers();
        currentMap.addSource("route-source", {
          type: "geojson",
          data: geojsonFeature,
        });

        currentMap.addLayer({
          id: "route-casing",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#1e3a8a",
            "line-width": 8,
            "line-opacity": 0.7,
          },
        });

        currentMap.addLayer({
          id: "route-base",
          type: "line",
          source: "route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#2563eb",
            "line-width": 5,
          },
        });
      }

      // 2. Add or Update Traffic Jam Segments Overlay (Red / Orange)
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

      const jamCollection = {
        type: "FeatureCollection",
        features: jamFeatures,
      };

      const existingJamSource = currentMap.getSource("traffic-jam-source");
      if (existingJamSource && typeof existingJamSource.setData === "function" && currentMap.getLayer("route-traffic-jam")) {
        existingJamSource.setData(jamCollection);
      } else if (jamFeatures.length > 0) {
        if (currentMap.getSource("traffic-jam-source")) {
          try {
            currentMap.removeLayer("route-traffic-jam");
            currentMap.removeSource("traffic-jam-source");
          } catch (_) {}
        }
        currentMap.addSource("traffic-jam-source", {
          type: "geojson",
          data: jamCollection,
        });

        currentMap.addLayer({
          id: "route-traffic-jam",
          type: "line",
          source: "traffic-jam-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 5.5,
          },
        });
      }

      // 3. Fit bounds to route
      try {
        if (coordinates.length >= 2) {
          const bounds = new maplibregl.LngLatBounds();
          coordinates.forEach((c) => bounds.extend(c));
          currentMap.fitBounds(bounds, {
            padding: { top: 70, bottom: 70, left: 70, right: 70 },
            duration: 900,
            maxZoom: 16,
          });
        }
      } catch (e) {
        console.warn("Fit bounds error:", e);
      }
    };

    renderRoute();

    return () => {
      isEffectCancelled = true;
      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.off("style.load", renderRoute);
        }
      } catch (_) {}
    };
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
