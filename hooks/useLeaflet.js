// hooks/useLeaflet.js
// Fixed version — correct zoom level for Delhi, no over-zoom
import { useState, useEffect } from "react";

export const DELHI = { lat: 28.6139, lng: 77.2090 };

// Use light tile for white theme
export const LIGHT_TILE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const DARK_TILE  = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export const STATUS_COLOR = {
  available: "#00875a",
  en_route:  "#E50914",
  busy:      "#E50914",
  offline:   "#a1a1a6",
};

export function makeIcon(color, emoji) {
  if (!window.L) return null;
  return window.L.divIcon({
    className: "",
    html: `<div style="
      width:36px;height:36px;border-radius:50% 50% 50% 0;
      background:${color};border:3px solid #fff;
      transform:rotate(-45deg);
      box-shadow:0 3px 12px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);font-size:14px">${emoji}</span></div>`,
    iconSize:[36,36], iconAnchor:[18,36], popupAnchor:[0,-40],
  });
}

export function makePinIcon(color, emoji) { return makeIcon(color, emoji); }

export default function useLeaflet() {
  const [ready, setReady] = useState(!!window.L);

  useEffect(() => {
    if (window.L) { setReady(true); return; }

    const loadCSS = (href, id) => {
      if (document.getElementById(id)) return;
      const l = document.createElement("link");
      l.id=id; l.rel="stylesheet"; l.href=href;
      document.head.appendChild(l);
    };
    const loadJS = (src, id) => new Promise((res,rej) => {
      if (document.getElementById(id)) { res(); return; }
      const s = document.createElement("script");
      s.id=id; s.src=src; s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });

    const load = async () => {
      loadCSS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css","leaflet-css");
      loadCSS("https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css","lrm-css");
      await loadJS("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js","leaflet-js");
      await loadJS("https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js","lrm-js");
      setReady(true);
    };
    load().catch(console.error);
  },[]);

  return ready;
}