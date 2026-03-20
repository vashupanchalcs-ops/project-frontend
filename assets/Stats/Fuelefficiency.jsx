import { Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';

const Fuelefficiency = () => {
  const [beds, setBeds] = useState(0);
  useEffect(() => {
    const f = () => fetch("http://127.0.0.1:8000/api/hospitals/")
      .then(r => r.json())
      .then(d => setBeds(d.reduce((s, h) => s + (h.available_beds || 0), 0)));
    f(); const i = setInterval(f, 10000); return () => clearInterval(i);
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Available Beds</span>
        <span className="stats-card-icon"><Building2 size={14} /></span>
      </div>
      <div className="stats-card-value">{String(beds).padStart(2,"0")}</div>
      <div className="stats-card-sub">Beds Available</div>
    </>
  );
};
export default Fuelefficiency;