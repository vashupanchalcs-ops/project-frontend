import { createElement, useState } from "react";
import { Activity, Ambulance, Bell, CheckCircle2, Clock3, Hospital, MapPin, Menu, Radio, Route, ShieldCheck, Users, X } from "lucide-react";
import "./AarogyaDashboard.css";

const ambulances = [
  { id: "AR-204", driver: "Rohan Mehta", status: "En route", eta: "08 min", position: "52% 43%" },
  { id: "AR-118", driver: "Priya Shah", status: "Available", eta: "—", position: "27% 62%" },
  { id: "AR-076", driver: "Amit Verma", status: "At hospital", eta: "—", position: "72% 25%" },
];

export default function AarogyaDashboard() {
  const [portal, setPortal] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selected, setSelected] = useState(ambulances[0]);
  return <div className="aarogya-shell">
    <aside className={sidebarOpen ? "aarogya-sidebar open" : "aarogya-sidebar"}>
      <div className="aarogya-brand"><span className="brand-mark">✚</span><span>AAROGYA</span><button onClick={() => setSidebarOpen(false)}><X size={18}/></button></div>
      <div className="workspace-label">OPERATIONS CENTER</div>
      {[[Activity,"Overview"],[Ambulance,"Ambulances"],[Hospital,"Hospitals"],[Users,"People & teams"]].map(([Icon, label]) => <button key={label} className={portal === label ? "side-link active" : "side-link"} onClick={() => { setPortal(label); setSidebarOpen(false); }}>{createElement(Icon, { size: 18 })}<span>{label}</span></button>)}
      <div className="sidebar-spacer"/><div className="status-card"><span className="live-dot"/> All systems operational<p>WebSocket connected · 24ms</p></div>
      <div className="profile"><div className="avatar">AS</div><div><strong>Admin Suraksha</strong><small>Control room</small></div><span>•••</span></div>
    </aside>
    <main className="aarogya-main">
      <header className="aarogya-header"><button className="menu-button" onClick={() => setSidebarOpen(true)}><Menu size={20}/></button><div><p className="eyebrow">SUNDAY, SEPTEMBER 27 · 11:43 AM</p><h1>{portal}</h1></div><div className="header-actions"><button className="icon-button"><Bell size={18}/><i/></button><button className="command-button"><Radio size={16}/> Live command</button></div></header>
      <section className="welcome-row"><div><h2>Good morning, Suraksha.</h2><p>Here’s the pulse of your emergency response network.</p></div><button className="primary-button"><Ambulance size={17}/> Dispatch ambulance</button></section>
      <section className="metrics"><Metric icon={Ambulance} label="Active ambulances" value="18" note="+3 since 8:00 AM" positive/><Metric icon={Clock3} label="Avg. response time" value="08:42" note="12% faster this week" positive/><Metric icon={Hospital} label="Hospital capacity" value="76%" note="24 facilities online"/><Metric icon={ShieldCheck} label="Cases resolved today" value="42" note="6 awaiting handoff"/></section>
      <section className="dashboard-grid"><div className="map-panel"><div className="panel-heading"><div><p className="section-kicker">REAL-TIME NETWORK</p><h3>Ambulance locations</h3></div><button className="outline-button"><MapPin size={15}/> Fit all</button></div><div className="aarogya-map"><div className="map-label label-one">NORTH DISTRICT</div><div className="map-label label-two">CITY CENTER</div><div className="map-label label-three">SOUTH DISTRICT</div><div className="road road-a"/><div className="road road-b"/><div className="road road-c"/><div className="road road-d"/><div className="route-line"/>{ambulances.map((amb) => <button key={amb.id} className={selected.id === amb.id ? "map-pin selected" : "map-pin"} style={{left: amb.position.split(" ")[0], top: amb.position.split(" ")[1]}} onClick={() => setSelected(amb)}><span>✚</span></button>)}<div className="map-location"><MapPin size={15}/> Your control room</div><div className="map-legend"><span><i className="legend-dot moving"/>En route</span><span><i className="legend-dot available"/>Available</span><span><i className="legend-dot hospital"/>At hospital</span></div></div></div>
        <div className="dispatch-panel"><div className="panel-heading"><div><p className="section-kicker">SELECTED UNIT</p><h3>{selected.id}</h3></div><span className="status-pill"><i/> {selected.status}</span></div><div className="unit-summary"><div className="unit-icon"><Ambulance size={25}/></div><div><strong>{selected.driver}</strong><p>Advanced Life Support · Unit 04</p></div></div><div className="route-card"><div className="route-line-icon"><span/><span/><span/></div><div><small>Current location</small><strong>Ring Road &amp; Lake View</strong><small>Destination</small><strong>CityCare Medical Center</strong></div></div><div className="eta-row"><div><small>Estimated arrival</small><strong>{selected.eta}</strong></div><div><small>Distance</small><strong>3.2 km</strong></div><div><small>Speed</small><strong>42 km/h</strong></div></div><button className="track-button"><Route size={16}/> Open live tracking</button></div></section>
      <section className="lower-grid"><div className="activity-panel"><div className="panel-heading"><div><p className="section-kicker">ACTIVITY FEED</p><h3>Latest updates</h3></div><button className="text-button">View all</button></div>{[["Dispatch accepted","AR-204 is heading to pickup · 2 min ago","green"],["Hospital notified","CityCare Medical Center confirmed bed availability · 8 min ago","orange"],["Case resolved","Patient handoff completed at Sunrise Hospital · 16 min ago","blue"]].map(([title, text, color]) => <div className="activity-row" key={title}><div className={`activity-icon ${color}`}><CheckCircle2 size={16}/></div><div><strong>{title}</strong><p>{text}</p></div><span className="activity-arrow">›</span></div>)}</div><div className="unit-panel"><div className="panel-heading"><div><p className="section-kicker">FLEET STATUS</p><h3>Units at a glance</h3></div><button className="text-button">Manage fleet</button></div>{ambulances.map((amb) => <button className="unit-row" key={amb.id} onClick={() => setSelected(amb)}><div className="mini-ambulance"><Ambulance size={15}/></div><div><strong>{amb.id}</strong><p>{amb.driver}</p></div><span className={`unit-status ${amb.status.toLowerCase().replace(" ", "-")}`}><i/> {amb.status}</span></button>)}</div></section>
    </main>
  </div>;
}
function Metric({ icon, label, value, note, positive }) { return <div className="metric"><div className="metric-icon">{createElement(icon, { size: 18 })}</div><p>{label}</p><strong>{value}</strong><small className={positive ? "positive" : ""}>{positive && "↗ "}{note}</small></div>; }
