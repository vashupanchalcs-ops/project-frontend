import { TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';

const Successrate = () => {
  const [rate, setRate] = useState(0);
  useEffect(() => {
    const f = () => fetch(`${(import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com")).replace(/\/+$/, "")}/api/bookings/`)
      .then(r => r.json())
      .then(d => {
        if (!d.length) return;
        setRate(Math.round((d.filter(b => b.status === "completed").length / d.length) * 100));
      });
    f(); const i = setInterval(f, 10000); return () => clearInterval(i);
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Success Rate</span>
        <span className="stats-card-icon"><TrendingUp size={14} /></span>
      </div>
      <div className="stats-card-value">{rate}%</div>
      <div className="stats-card-sub">Completed bookings</div>
    </>
  );
};
export default Successrate;