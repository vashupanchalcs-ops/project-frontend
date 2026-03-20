// Components/AnalyticsCharts.jsx
// White-themed analytics — fits inside Dashboard analytics card
import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function AnalyticsCharts() {
  const [bookings,   setBookings]   = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [activeTab,  setActiveTab]  = useState("trends");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json()).then(setBookings).catch(()=>{});
    fetch("http://127.0.0.1:8000/api/ambulances/").then(r=>r.json()).then(setAmbulances).catch(()=>{});
    const t = setInterval(()=>{
      fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json()).then(setBookings).catch(()=>{});
    }, 15000);
    return () => clearInterval(t);
  }, []);

  // Booking trend — last 7 days
  const trendData = (() => {
    const days = {};
    bookings.forEach(b => {
      const d = b.created_at
        ? new Date(b.created_at).toLocaleDateString("en-IN", {day:"numeric", month:"short"})
        : "—";
      if (!days[d]) days[d] = { date:d, bookings:0, completed:0 };
      days[d].bookings++;
      if (b.status === "completed") days[d].completed++;
    });
    return Object.values(days).slice(-7);
  })();

  // Ambulance status bar
  const ambData = [
    { name:"Available", count:ambulances.filter(a=>a.status==="available").length },
    { name:"En Route",  count:ambulances.filter(a=>a.status==="en_route").length  },
    { name:"Busy",      count:ambulances.filter(a=>a.status==="busy").length      },
    { name:"Offline",   count:ambulances.filter(a=>a.status==="offline").length   },
  ];

  const conf = bookings.filter(b=>b.status==="confirmed").length;
  const pend = bookings.filter(b=>b.status==="pending").length;
  const canc = bookings.filter(b=>b.status==="cancelled").length;
  const total= bookings.length;

  const Tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{background:"#fff",border:"1px solid rgba(0,0,0,0.09)",borderRadius:10,padding:"9px 13px",boxShadow:"0 4px 16px rgba(0,0,0,0.09)",fontFamily:"'DM Sans',sans-serif"}}>
        {label && <div style={{fontSize:10,fontWeight:700,color:"#a1a1a6",marginBottom:4}}>{label}</div>}
        {payload.map((p,i)=>(
          <div key={i} style={{fontSize:12,fontWeight:700,color:p.color||"#0a0a0a",display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .ac-root { background:#fff; height:100%; display:flex; flex-direction:column; font-family:'DM Sans',sans-serif; }

        /* Tabs + summary row */
        .ac-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 18px 8px; flex-shrink: 0;
          flex-wrap: wrap;
        }
        .ac-tab {
          font-size:11px;font-weight:700;padding:5px 14px;border-radius:100px;
          border:1.5px solid rgba(0,0,0,0.1);background:#f8f8fa;color:rgba(0,0,0,0.45);
          cursor:pointer;font-family:inherit;transition:all .15s;
        }
        .ac-tab:hover  { border-color:rgba(0,0,0,0.2);color:#0a0a0a; }
        .ac-tab.on     { background:#E50914;color:#fff;border-color:#E50914;box-shadow:0 3px 10px rgba(229,9,20,0.22); }
        .ac-pills      { display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap; }
        .ac-pill       { font-size:10px;font-weight:700;padding:3px 10px;border-radius:100px;display:flex;align-items:center;gap:4px; }
        .ac-pill-dot   { width:6px;height:6px;border-radius:50%; }

        /* Chart area */
        .ac-chart { flex:1;min-height:0;padding:0 14px 12px; }

        /* recharts overrides for white bg */
        .recharts-cartesian-axis-tick-value {
          fill:#a1a1a6 !important;
          font-size:11px !important;
          font-family:'DM Sans',sans-serif !important;
        }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
          stroke:rgba(0,0,0,0.06) !important;
        }
        .recharts-legend-item-text {
          font-size:11px !important;
          color:#3d3d3d !important;
        }
      `}</style>

      <div className="ac-root">
        <div className="ac-bar">
          <button className={`ac-tab ${activeTab==="trends"?"on":""}`} onClick={()=>setActiveTab("trends")}>📈 Booking Trends</button>
          <button className={`ac-tab ${activeTab==="fleet"?"on":""}`}  onClick={()=>setActiveTab("fleet")}>🚑 Fleet Status</button>
          <div className="ac-pills">
            <span className="ac-pill" style={{background:"rgba(0,135,90,0.09)",color:"#00875a",border:"1px solid rgba(0,135,90,0.18)"}}>
              <span className="ac-pill-dot" style={{background:"#00875a"}}/>
              {conf} Confirmed
            </span>
            <span className="ac-pill" style={{background:"rgba(179,104,0,0.09)",color:"#b36800",border:"1px solid rgba(179,104,0,0.18)"}}>
              <span className="ac-pill-dot" style={{background:"#b36800"}}/>
              {pend} Pending
            </span>
            <span className="ac-pill" style={{background:"rgba(229,9,20,0.08)",color:"#E50914",border:"1px solid rgba(229,9,20,0.18)"}}>
              <span className="ac-pill-dot" style={{background:"#E50914"}}/>
              {canc} Cancelled
            </span>
            <span className="ac-pill" style={{background:"rgba(0,0,0,0.05)",color:"#6e6e73",border:"1px solid rgba(0,0,0,0.1)"}}>
              Total: {total} bookings
            </span>
          </div>
        </div>

        <div className="ac-chart">
          {activeTab === "trends" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{top:4,right:12,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
                <XAxis dataKey="date" tick={{fill:"#a1a1a6",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                <YAxis allowDecimals={false} tick={{fill:"#a1a1a6",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <Legend wrapperStyle={{fontSize:11,fontFamily:"'DM Sans',sans-serif",paddingTop:4}}/>
                <Line type="monotone" dataKey="bookings"  name="Bookings"  stroke="#E50914" strokeWidth={2.5} dot={{r:3,fill:"#E50914"}}  activeDot={{r:5}}/>
                <Line type="monotone" dataKey="completed" name="Completed" stroke="#0a0a0a" strokeWidth={2.5} dot={{r:3,fill:"#0a0a0a"}}  activeDot={{r:5}} strokeDasharray="5 5"/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ambData} margin={{top:4,right:12,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
                <XAxis dataKey="name" tick={{fill:"#a1a1a6",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                <YAxis allowDecimals={false} tick={{fill:"#a1a1a6",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="count" name="Count" radius={[6,6,0,0]} fill="#E50914"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}
