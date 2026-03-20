import { Van } from 'lucide-react';
import { useState, useEffect } from 'react';

const Activevehicles = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const f = () => fetch("http://127.0.0.1:8000/api/ambulances/")
      .then(r => r.json())
      .then(d => setCount(d.filter(a => a.status === "available" || a.status === "en_route").length));
    f(); const i = setInterval(f, 10000); return () => clearInterval(i);
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Active Vehicles</span>
        <span className="stats-card-icon"><Van size={14} /></span>
      </div>
      <div className="stats-card-value">{String(count).padStart(2,"0")}</div>
      <div className="stats-card-sub">Available + En Route</div>
    </>
  );
};
export default Activevehicles;