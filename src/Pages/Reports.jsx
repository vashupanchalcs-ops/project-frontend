import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";

const COLORS = ["#E50914","#0a0a0a","#6e6e73","#d1d1d6"];

export default function Reports() {
  const [bookings,   setBookings]   = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals,  setHospitals]  = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/bookings/").then(r=>r.json()).then(setBookings).catch(()=>{});
    fetch("http://127.0.0.1:8000/api/ambulances/").then(r=>r.json()).then(setAmbulances).catch(()=>{});
    fetch("http://127.0.0.1:8000/api/hospitals/").then(r=>r.json()).then(setHospitals).catch(()=>{});
  },[]);

  const total     = bookings.length;
  const completed = bookings.filter(b=>b.status==="completed").length;
  const confirmed = bookings.filter(b=>b.status==="confirmed").length;
  const pending   = bookings.filter(b=>b.status==="pending").length;
  const cancelled = bookings.filter(b=>b.status==="cancelled").length;
  const rate      = total ? Math.round((completed/total)*100) : 0;

  const pieData = [
    { name:"Confirmed", value:confirmed },
    { name:"Completed", value:completed },
    { name:"Pending",   value:pending   },
    { name:"Cancelled", value:cancelled },
  ].filter(d=>d.value>0);

  const ambBarData = [
    { name:"Available", count:ambulances.filter(a=>a.status==="available").length },
    { name:"En Route",  count:ambulances.filter(a=>a.status==="en_route").length  },
    { name:"Busy",      count:ambulances.filter(a=>a.status==="busy").length      },
    { name:"Offline",   count:ambulances.filter(a=>a.status==="offline").length   },
  ];

  const trendData = (() => {
    const days = {};
    bookings.forEach(b=>{
      const d = b.created_at ? new Date(b.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—";
      if(!days[d]) days[d]={date:d,bookings:0,completed:0};
      days[d].bookings++;
      if(b.status==="completed") days[d].completed++;
    });
    return Object.values(days).slice(-7);
  })();

  const bedTotal = hospitals.reduce((s,h)=>s+(h.total_beds||0),0);
  const bedAvail = hospitals.reduce((s,h)=>s+(h.available_beds||0),0);

  const CustomTooltip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return(
      <div style={{background:"var(--sr-surface)",border:"1px solid var(--sr-border)",borderRadius:10,padding:"10px 14px",boxShadow:"var(--shadow)",fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--sr-text-muted)",marginBottom:5}}>{label}</div>
        {payload.map((p,i)=><div key={i} style={{fontSize:13,fontWeight:700,color:p.color||"var(--sr-text)"}}>{p.name}: {p.value}</div>)}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .rp-root {
          min-height:100vh;
          background:
            radial-gradient(circle at 12% 10%, var(--sr-bg-grad-a), transparent 34%),
            radial-gradient(circle at 88% 8%, var(--sr-bg-grad-b), transparent 38%),
            var(--sr-bg);
          padding-top:60px;
          padding-left:200px;
          font-family:'DM Sans',sans-serif;
        }
        .rp-inner { max-width:1280px; margin:0 auto; padding:28px 32px 64px; }

        .rp-tag   { display:inline-flex;align-items:center;gap:6px;background:#E50914;color:#fff;border-radius:6px;padding:4px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px; }
        .rp-title { font-size:28px;font-weight:800;color:var(--sr-text);letter-spacing:-.5px;margin:0 0 4px; }
        .rp-sub   { font-size:13px;color:var(--sr-text-sub);margin:0 0 28px; }

        /* OVERVIEW STATS */
        .rp-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:28px; }
        .rp-stat  {
          background:color-mix(in srgb, var(--sr-surface) 92%, transparent); border:1px solid var(--sr-border); border-radius:14px;
          padding:16px 18px; position:relative; overflow:hidden;
          box-shadow:var(--shadow);
          transition:transform .18s, box-shadow .18s;
        }
        .rp-stat:hover { transform:translateY(-2px); box-shadow:var(--shadow2); }
        .rp-stat-bar   { position:absolute;top:0;left:0;right:0;height:3px;border-radius:14px 14px 0 0; }
        .rp-stat-lbl   { font-size:9px;font-weight:800;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px; }
        .rp-stat-val   { font-size:28px;font-weight:800;color:var(--sr-text);letter-spacing:-1px;line-height:1; }

        /* SECTION */
        .rp-sec-title { font-size:18px;font-weight:800;color:var(--sr-text);letter-spacing:-.3px;margin-bottom:16px; }

        /* CHARTS GRID */
        .rp-charts { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:28px; }
        .rp-chart-card {
          background:color-mix(in srgb, var(--sr-surface) 92%, transparent); border:1px solid var(--sr-border); border-radius:16px;
          padding:20px 22px; box-shadow:var(--shadow);
        }
        .rp-chart-title { font-size:13px;font-weight:700;color:var(--sr-text);margin-bottom:18px;display:flex;align-items:center;gap:7px; }
        .rp-chart-title span { font-size:15px; }

        /* TREND full width */
        .rp-trend-card {
          background:color-mix(in srgb, var(--sr-surface) 92%, transparent); border:1px solid var(--sr-border); border-radius:16px;
          padding:20px 22px; box-shadow:var(--shadow); margin-bottom:28px;
        }

        /* PIE legend */
        .rp-pie-legend { display:flex;flex-direction:column;gap:8px;justify-content:center; }
        .rp-pie-legend-item { display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sr-text-sub);font-weight:600; }
        .rp-pie-legend-dot  { width:10px;height:10px;border-radius:50%;flex-shrink:0; }

        /* SUMMARY CARDS */
        .rp-summary { display:grid;grid-template-columns:repeat(3,1fr);gap:14px; }
        .rp-sum-card {
          background:color-mix(in srgb, var(--sr-surface) 92%, transparent); border:1px solid var(--sr-border); border-radius:16px;
          padding:20px 22px; box-shadow:var(--shadow);
        }
        .rp-sum-title { font-size:12px;font-weight:700;color:var(--sr-text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px; }
        .rp-sum-row   { display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--sr-border); }
        .rp-sum-row:last-child { border-bottom:none; }
        .rp-sum-k { font-size:12px;color:var(--sr-text-sub);font-weight:500; }
        .rp-sum-v { font-size:13px;font-weight:800;color:var(--sr-text); }

        /* Recharts overrides */
        .recharts-cartesian-axis-tick-value { fill:var(--sr-chart-label)!important; font-size:11px!important; font-family:'DM Sans',sans-serif!important; }
        .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke:var(--sr-chart-grid)!important; }

        @media(max-width:1100px){ .rp-stats{grid-template-columns:repeat(3,1fr);} .rp-charts{grid-template-columns:1fr;} .rp-summary{grid-template-columns:1fr 1fr;} }
        @media(max-width:767px) { .rp-root{padding-left:0;padding-bottom:72px;} .rp-inner{padding:16px 14px 80px;} .rp-stats{grid-template-columns:repeat(2,1fr);gap:10px;} .rp-summary{grid-template-columns:1fr;} }
      `}</style>

      <div className="rp-root">
        <div className="rp-inner">

          <div className="rp-tag">📊 Analytics</div>
          <h1 className="rp-title">Reports &amp; Analytics</h1>
          <p className="rp-sub">Real-time insights on bookings, fleet, and hospital capacity</p>

          {/* OVERVIEW STATS */}
          <div style={{fontSize:15,fontWeight:800,color:"var(--sr-text)",marginBottom:14,letterSpacing:"-.3px"}}>Overview</div>
          <div className="rp-stats">
            {[
              {lbl:"Total Bookings", val:String(total).padStart(2,"0"),     bar:"#a1a1a6"},
              {lbl:"Completed",      val:String(completed).padStart(2,"0"), bar:"#0a0a0a"},
              {lbl:"Confirmed",      val:String(confirmed).padStart(2,"0"), bar:"#E50914"},
              {lbl:"Cancelled",      val:String(cancelled).padStart(2,"0"), bar:"#E50914"},
              {lbl:"Success Rate",   val:`${rate}%`,                        bar:"#0a0a0a"},
            ].map((s,i)=>(
              <div key={i} className="rp-stat">
                <div className="rp-stat-bar" style={{background:s.bar}}/>
                <div className="rp-stat-lbl">{s.lbl}</div>
                <div className="rp-stat-val">{s.val}</div>
              </div>
            ))}
          </div>

          {/* BREAKDOWN */}
          <div style={{fontSize:15,fontWeight:800,color:"var(--sr-text)",marginBottom:14,letterSpacing:"-.3px"}}>Breakdown</div>

          <div className="rp-charts">
            {/* PIE CHART */}
            <div className="rp-chart-card">
              <div className="rp-chart-title"><span>🟡</span>Booking Status Distribution</div>
              {pieData.length>0 ? (
                <div style={{display:"flex",alignItems:"center",gap:24}}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3} dataKey="value">
                        {pieData.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={{background:"var(--sr-surface)",border:"1px solid var(--sr-border)",borderRadius:10,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"var(--sr-text)"}}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="rp-pie-legend">
                    {pieData.map((e,i)=>(
                      <div key={i} className="rp-pie-legend-item">
                        <div className="rp-pie-legend-dot" style={{background:COLORS[i%COLORS.length]}}/>
                        {e.name} {total?Math.round((e.value/total)*100):0}%
                      </div>
                    ))}
                  </div>
                </div>
              ):(
                <div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--sr-text-muted)",fontSize:13}}>No data yet</div>
              )}
            </div>

            {/* BAR CHART */}
            <div className="rp-chart-card">
              <div className="rp-chart-title"><span>🚑</span>Ambulance Status</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={ambBarData} margin={{top:0,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
                  <XAxis dataKey="name" tick={{fill:"var(--sr-chart-label)",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{fill:"var(--sr-chart-label)",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="count" name="Count" radius={[6,6,0,0]}>
                    {ambBarData.map((e,i)=><Cell key={i} fill={e.name==="Available"?"#0a0a0a":e.name==="En Route"?"#E50914":e.name==="Busy"?"#E50914":"#d1d1d6"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TREND LINE */}
          {trendData.length>1&&(
            <div className="rp-trend-card">
              <div className="rp-chart-title"><span>📈</span>Booking Trends (Last 7 Days)</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{top:0,right:16,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
                  <XAxis dataKey="date" tick={{fill:"var(--sr-chart-label)",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{fill:"var(--sr-chart-label)",fontSize:11,fontFamily:"'DM Sans',sans-serif"}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Legend wrapperStyle={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"var(--sr-text-sub)"}}/>
                  <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#E50914" strokeWidth={2.5} dot={{r:4,fill:"#E50914"}} activeDot={{r:6}}/>
                  <Line type="monotone" dataKey="completed" name="Completed" stroke="#0a0a0a" strokeWidth={2.5} dot={{r:4,fill:"#0a0a0a"}} activeDot={{r:6}} strokeDasharray="5 5"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* SUMMARY CARDS */}
          <div style={{fontSize:15,fontWeight:800,color:"var(--sr-text)",marginBottom:14,letterSpacing:"-.3px"}}>Fleet &amp; Hospital Summary</div>
          <div className="rp-summary">
            <div className="rp-sum-card">
              <div className="rp-sum-title">Ambulance Fleet</div>
              {[["Total Units",ambulances.length],["Available",ambulances.filter(a=>a.status==="available").length],["En Route",ambulances.filter(a=>a.status==="en_route").length],["Busy",ambulances.filter(a=>a.status==="busy").length],["Offline",ambulances.filter(a=>a.status==="offline").length]].map(([k,v],i)=>(
                <div key={i} className="rp-sum-row"><span className="rp-sum-k">{k}</span><span className="rp-sum-v">{String(v).padStart(2,"0")}</span></div>
              ))}
            </div>
            <div className="rp-sum-card">
              <div className="rp-sum-title">Hospital Network</div>
              {[["Total Hospitals",hospitals.length],["Total Beds",bedTotal],["Available Beds",bedAvail],["Occupancy",bedTotal?`${Math.round(((bedTotal-bedAvail)/bedTotal)*100)}%`:"—"]].map(([k,v],i)=>(
                <div key={i} className="rp-sum-row"><span className="rp-sum-k">{k}</span><span className="rp-sum-v">{v}</span></div>
              ))}
            </div>
            <div className="rp-sum-card">
              <div className="rp-sum-title">Booking Summary</div>
              {[["Total Bookings",total],["Confirmed",confirmed],["Completed",completed],["Cancelled",cancelled],["Success Rate",`${rate}%`]].map(([k,v],i)=>(
                <div key={i} className="rp-sum-row"><span className="rp-sum-k">{k}</span><span className="rp-sum-v">{v}</span></div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
