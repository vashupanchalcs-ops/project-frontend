// Components/Map.jsx — Fixed map: correct zoom, white tile, proper centering
import { useState, useEffect, useRef } from "react";
import useLeaflet, { LIGHT_TILE, DELHI, STATUS_COLOR, makePinIcon } from "../hooks/useLeaflet";

const delhiLocations = [
  { lat:28.6139, lng:77.2090 },{ lat:28.6328, lng:77.2197 },
  { lat:28.5921, lng:77.2290 },{ lat:28.6469, lng:77.1025 },
  { lat:28.5355, lng:77.3910 },{ lat:28.7041, lng:77.1025 },
  { lat:28.6280, lng:77.3649 },
];

export default function Maps() {
  const leafletReady = useLeaflet();
  const mapDivRef    = useRef(null);
  const mapObj       = useRef(null);
  const markersRef   = useRef([]);
  const [ambulances, setAmbulances] = useState([]);
  const [bookings,   setBookings]   = useState([]);

  useEffect(() => {
    const fetchAll = () => {
      fetch("http://127.0.0.1:8000/api/ambulances/").then(r=>r.json()).then(setAmbulances).catch(()=>{});
      fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json()).then(setBookings).catch(()=>{});
    };
    fetchAll();
    const t = setInterval(fetchAll,10000);
    return ()=>clearInterval(t);
  },[]);

  // Init map with correct zoom (12 = city level, not world level)
  useEffect(() => {
    if (!leafletReady || !mapDivRef.current || mapObj.current) return;
    const L = window.L;
    mapObj.current = L.map(mapDivRef.current, {
      center: [DELHI.lat, DELHI.lng],
      zoom: 12,           // ← FIXED: was zooming to world level
      minZoom: 10,
      maxZoom: 18,
      zoomControl: false,
    });
    L.tileLayer(LIGHT_TILE, {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(mapObj.current);
    L.control.zoom({ position:"bottomright" }).addTo(mapObj.current);

    // Invalidate size after mount to fix grey tiles
    setTimeout(()=> mapObj.current?.invalidateSize(), 100);
    setTimeout(()=> mapObj.current?.invalidateSize(), 500);

    return () => { if (mapObj.current) { mapObj.current.remove(); mapObj.current=null; } };
  },[leafletReady]);

  // Update markers
  useEffect(() => {
    if (!leafletReady || !mapObj.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];

    const bookedIds = new Set(
      bookings.filter(b=>["confirmed","pending"].includes(b.status)).map(b=>b.ambulance_id)
    );

    ambulances.forEach((a,i) => {
      const lat = parseFloat(a.latitude)  || delhiLocations[i%delhiLocations.length].lat;
      const lng = parseFloat(a.longitude) || delhiLocations[i%delhiLocations.length].lng;
      const isBooked = bookedIds.has(a.id);
      const color    = isBooked ? "#E50914" : (STATUS_COLOR[a.status]||STATUS_COLOR.offline);
      const icon     = makePinIcon(color,"🚑");
      if (!icon) return;

      const marker = L.marker([lat,lng],{icon}).addTo(mapObj.current);
      marker.bindPopup(`
        <div style="padding:12px 14px;font-family:'DM Sans',sans-serif;min-width:180px">
          <div style="font-size:14px;font-weight:800;color:#0a0a0a;margin-bottom:6px">🚑 ${a.ambulance_number}</div>
          <div style="font-size:11px;color:#6e6e73;margin-bottom:2px">Driver: ${a.driver}</div>
          <div style="font-size:11px;color:#6e6e73;margin-bottom:8px">Location: ${a.location||"—"}</div>
          <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;
            background:${isBooked?"rgba(229,9,20,0.09)":"rgba(0,135,90,0.09)"};
            color:${isBooked?"#E50914":"#00875a"};
            border:1px solid ${isBooked?"rgba(229,9,20,0.22)":"rgba(0,135,90,0.22)"};
            text-transform:uppercase;letter-spacing:.5px">
            ${isBooked?"Booked":a.status}
          </span>
        </div>
      `,{className:"sr-dark-popup"});
      markersRef.current.push(marker);
    });
  },[leafletReady,ambulances,bookings]);

  return (
    <div ref={mapDivRef} style={{width:"100%",height:"100%",minHeight:"240px"}}/>
  );
}