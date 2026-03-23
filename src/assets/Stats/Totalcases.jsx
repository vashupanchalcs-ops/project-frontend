import { ClipboardList } from 'lucide-react';
import { useState, useEffect } from 'react';

const Totalcases = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const f = () => fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json()).then(d => setCount(d.length));
    f(); const i = setInterval(f, 10000);
    window.addEventListener("new-booking", f);
    return () => { clearInterval(i); window.removeEventListener("new-booking", f); };
  }, []);
  return (
    <>
      <div className="stats-card-top">
        <span className="stats-card-label">Total Cases</span>
        <span className="stats-card-icon"><ClipboardList size={14} /></span>
      </div>
      <div className="stats-card-value">{String(count).padStart(2,"0")}</div>
      <div className="stats-card-sub">Total bookings so far</div>
    </>
  );
};
export default Totalcases;