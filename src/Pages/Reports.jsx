import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

gsap.registerPlugin(ScrollTrigger);
const COLORS = ["#d6e800", "#b6c900", "#8da500", "#4f5e00"];
const statusColor = { available: "#d6e800", en_route: "#b6c900", busy: "#8da500", offline: "#4f5e00" };

const Reports = () => {
  const [bookings,   setBookings]   = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [hospitals,  setHospitals]  = useState([]);
  const [trackedAmb, setTrackedAmb] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/bookings/").then(r => r.json()).then(setBookings).catch(console.log);
    fetch("http://127.0.0.1:8000/api/ambulances/").then(r => r.json()).then(setAmbulances).catch(console.log);
    fetch("http://127.0.0.1:8000/api/hospitals/").then(r => r.json()).then(setHospitals).catch(console.log);
    const interval = setInterval(() => {
      fetch("http://127.0.0.1:8000/api/ambulances/").then(r => r.json()).then(data => {
        setAmbulances(data);
        setTrackedAmb(prev => {
          if (!prev) return null;
          const u = data.find(a => a.ambulance_number === prev.number);
          return u ? { ...prev, lat: u.latitude, lng: u.longitude, updated: u.last_updated, status: u.status } : prev;
        });
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray(".rep-anim").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 22, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              end: "top 62%",
              scrub: 0.8,
            },
          }
        );
      });
    }, rootRef);
    return () => ctx.revert();
  }, [bookings.length, ambulances.length, hospitals.length]);

  const total      = bookings.length;
  const confirmed  = bookings.filter(b => b.status === "confirmed").length;
  const completed  = bookings.filter(b => b.status === "completed").length;
  const cancelled  = bookings.filter(b => b.status === "cancelled").length;
  const pending    = bookings.filter(b => b.status === "pending").length;
  const successRate = total ? Math.round((completed / total) * 100) : 0;

  const pieData = [
    { name: "Completed", value: completed },
    { name: "Cancelled", value: cancelled },
    { name: "Confirmed", value: confirmed },
    { name: "Pending",   value: pending   },
  ].filter(d => d.value > 0);

  const ambBreakdown = [
    { name: "Available", value: ambulances.filter(a => a.status === "available").length },
    { name: "En Route",  value: ambulances.filter(a => a.status === "en_route").length  },
    { name: "Busy",      value: ambulances.filter(a => a.status === "busy").length      },
    { name: "Offline",   value: ambulances.filter(a => a.status === "offline").length   },
  ];

  const hospitalBeds = hospitals.map(h => ({
    name: h.name.length > 10 ? h.name.slice(0, 10) + "…" : h.name,
    total: h.total_beds, available: h.available_beds, icu: h.icu_beds || 0,
  }));

  const bookingsPerAmb = ambulances.map(a => ({
    name: a.ambulance_number,
    bookings: bookings.filter(b => b.ambulance_id === a.id).length,
  })).filter(a => a.bookings > 0);

  const driverStats = ambulances.map(a => ({
    id: a.id, number: a.ambulance_number, driver: a.driver,
    contact: a.driver_contact, status: a.status,
    lat: a.latitude, lng: a.longitude, updated: a.last_updated,
    bookings: bookings.filter(b => b.ambulance_id === a.id).length,
  }));

  // Tooltip style always dark regardless of theme
  const ttStyle = { background: "#ffffff", border: "1px solid rgba(20,20,20,0.14)", borderRadius: 8, color: "#111111" };
  const chartTick = { fill: "#111111", fontSize: 11, fontWeight: 600 };

  return (
    <>
      <style>{`
        .rep-root {
          background:
            radial-gradient(920px 430px at 88% 8%, rgba(255,48,92,0.16), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(255,122,24,0.11), transparent 70%),
            var(--sr-bg, #06040a);
          color: var(--sr-page-text, #fff);
          min-height: 100vh;
          padding: 64px 0 0 64px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          transition: background 0.3s, color 0.2s;
          box-sizing: border-box;
        }
        .rep-content { max-width: 1200px; margin: 0 auto; padding: 32px 24px 64px; display: flex; flex-direction: column; gap: 28px; }

        /* Header — page level text */
        .rep-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #111; background: rgba(214,232,0,0.22); border: 1px solid rgba(214,232,0,0.55); border-radius: 100px; padding: 4px 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .rep-header h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; color: var(--sr-page-text, #fff); }
        .rep-header p  { font-size: 13px; color: var(--sr-page-text-sub, rgba(255,255,255,0.4)); }
        .rep-section-title { font-size: 16px; font-weight: 700; margin-bottom: 14px; color: var(--sr-page-text, #fff); }

        /* Summary cards — always dark */
        .rep-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .rep-sum-card {
          background: #241027;
          border: 1px solid rgba(255,124,166,0.34);
          border-radius: 12px;
          padding: 16px 18px;
          position: relative;
          overflow: hidden;
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .rep-sum-card:hover { border-color: rgba(255,86,140,0.75); box-shadow: 0 12px 26px rgba(255,31,90,0.2); transform: translateY(-2px); }
        .rep-sum-bar { display: none; }
        .rep-sum-label { font-size: 10px; font-weight: 600; color: var(--sr-text-sub); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px; }
        .rep-sum-value { font-size: 32px; font-weight: 900; line-height: 1; letter-spacing: -1px; color: var(--sr-text, #fff); }

        /* Chart cards — always dark */
        .rep-charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .rep-chart-card { background: #151520; border: 1px solid rgba(255,124,166,0.24); border-radius: 14px; padding: 20px; transition: border-color .2s ease, transform .2s ease; }
        .rep-chart-card:hover { border-color: var(--sr-accent-muted, rgba(255,31,90,0.35)); transform: translateY(-2px); }
        .rep-chart-title { font-size: 13px; font-weight: 700; color: var(--sr-text-sub); margin-bottom: 16px; }
        .rep-chart-empty { color: var(--sr-text-muted); text-align: center; padding: 50px 0; font-size: 13px; }

        /* Driver table card — always dark */
        .rep-table-card { background: #151520; border: 1px solid rgba(255,124,166,0.24); border-radius: 14px; padding: 20px; overflow-x: auto; transition: border-color .2s ease; }
        .rep-table-card:hover { border-color: var(--sr-accent-muted, rgba(255,31,90,0.35)); }
        .rep-table { width: 100%; border-collapse: collapse; min-width: 700px; }
        .rep-table th { font-size: 10px; font-weight: 700; color: var(--sr-text-sub); letter-spacing: 0.8px; text-transform: uppercase; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.07)); }
        .rep-table td { padding: 12px 14px; border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.04)); font-size: 12px; color: var(--sr-text, #fff); vertical-align: middle; }
        .rep-table tr:hover td { background: rgba(214,232,0,0.24); }
        .rep-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 100px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px; }
        .rep-track-btn { border-radius: 100px; padding: 4px 14px; font-size: 10px; font-weight: 700; cursor: pointer; font-family: inherit; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.15s; border: 1px solid rgba(214,232,0,0.55); white-space: nowrap; }
        .rep-track-btn:hover { background: #d6e800 !important; color: #111 !important; }

        /* Modal — always dark */
        .rep-modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .rep-modal-box { background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 20px; width: 100%; max-width: 900px; height: 70vh; display: flex; flex-direction: column; overflow: hidden; }
        .rep-modal-header { padding: 14px 20px; border-bottom: 1px solid var(--sr-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
        .rep-modal-info-bar { padding: 10px 20px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--sr-border); display: flex; gap: 20px; flex-wrap: wrap; }
        .rep-modal-info-label { font-size: 9px; color: var(--sr-text-muted); text-transform: uppercase; letter-spacing: 0.8px; }
        .rep-modal-info-val   { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); margin-top: 2px; }
        .rep-close-btn { background: rgba(214,232,0,0.16); color: #111; border: 1px solid rgba(214,232,0,0.55); border-radius: 100px; padding: 5px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .rep-close-btn:hover { background: rgba(255,255,255,0.15); }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } }
        .gps-pulse { width: 6px; height: 6px; border-radius: 50%; background: #d6e800; display: inline-block; animation: pulse 1.5s infinite; }

        @media (max-width: 1023px) {
          .rep-root { padding-left: 64px; }
          .rep-content { padding: 24px 16px 64px; }
          .rep-summary { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 767px) {
          .rep-root { padding-left: 0; padding-bottom: 72px; }
          .rep-content { padding: 20px 12px 80px; }
          .rep-header h1 { font-size: 22px; }
          .rep-summary { grid-template-columns: repeat(2, 1fr); }
          .rep-charts-row { grid-template-columns: 1fr; }
          .rep-sum-value { font-size: 26px; }
          .rep-modal-box { height: 85vh; }
        }
        @media (max-width: 480px) {
          .rep-summary { grid-template-columns: 1fr 1fr; }
        }

        /* Order Table Specific Styles */
        .rep-ord-card {
          background: linear-gradient(165deg, rgba(255,255,255,0.98), rgba(247,247,238,0.98));
          border: 1px solid rgba(214,232,0,0.6);
          border-radius: 20px;
          overflow-x: auto;
          padding: 18px 20px 16px;
          margin-top: 10px;
          box-shadow: 0 18px 38px rgba(214,232,0,0.14);
        }
        .rep-ord-table { width: 100%; border-collapse: collapse; min-width: 1000px; text-align: left; }
        .rep-ord-table th {
          font-size: 10px;
          font-weight: 800;
          color: rgba(17,17,17,0.54);
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 16px 14px;
          border-bottom: 1px solid rgba(17,17,17,0.09);
          white-space: nowrap;
        }
        .rep-ord-table th span { display: inline-flex; align-items: center; gap: 4px; }
        .rep-ord-table td {
          padding: 16px 14px;
          border-bottom: 1px solid rgba(17,17,17,0.08);
          vertical-align: middle;
          color: #111111;
        }
        .rep-ord-table tr:hover td { background: rgba(214,232,0,0.16); }
        
        .rep-id { font-weight: 900; font-size: 13px; color: #111; display: inline-flex; gap: 6px; align-items: center; letter-spacing: 0.2px; }
        
        /* Progress Track */
        .rep-track-bar { display: inline-flex; align-items: center; background: rgba(17,17,17,0.04); border-radius: 100px; padding: 5px 7px; border: 1px solid rgba(17,17,17,0.08); gap: 6px; position: relative; }
        .rep-track-line { position: absolute; top: 50%; left: 18px; right: 18px; height: 2px; background: rgba(17,17,17,0.08); z-index: 0; }
        .rep-track-dot { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; z-index: 1; border: 2px solid #f8f8ef; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .rep-track-dot.on { background: #e7f36a; color: #111; }
        .rep-track-dot.off { background: rgba(17,17,17,0.08); color: rgba(17,17,17,0.42); }
        
        .rep-badge { display: inline-flex; align-items: center; justify-content: center; padding: 5px 12px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; border: 1px solid; }
        .rep-badge.active { background: rgba(0,200,83,0.12); color: #0a8c46; border-color: rgba(0,200,83,0.24); }
        .rep-badge.delayed { background: rgba(229,9,20,0.08); color: #bf1d2d; border-color: rgba(229,9,20,0.18); }
        .rep-badge.completed { background: rgba(214,232,0,0.24); color: #111; border-color: rgba(214,232,0,0.9); }
        .rep-badge.pending { background: rgba(179,104,0,0.09); color: #9a6200; border-color: rgba(179,104,0,0.22); }

        .rep-eta { font-size: 12px; color: #111; display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .rep-eta .warn { color: #b36800; font-size: 14px; }

        .rep-driver { display: flex; align-items: center; gap: 8px; }
        .rep-driver-av { width: 28px; height: 28px; background: linear-gradient(145deg, #d6e800, #edf78a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 1px solid rgba(17,17,17,0.08); color: #111; }
        .rep-driver-name { font-size: 12px; color: #111; font-weight: 700; }

        .rep-vehicle { font-size: 12px; color: rgba(17,17,17,0.82); font-weight: 600; }
        .rep-delay { color: #bf1d2d; font-weight: 800; font-size: 12px; }
        .rep-nodelay { color: rgba(17,17,17,0.38); font-size: 12px; }
        
        .rep-action-btn { width: 34px; height: 34px; background: #fffef4; border: 1px solid rgba(17,17,17,0.12); border-radius: 10px; cursor: pointer; color: rgba(17,17,17,0.58); font-size: 16px; transition: all 0.15s; }
        .rep-action-btn:hover { color: #111; background: #d6e800; border-color: #c7d800; }
        .rep-ord-footer { margin-top: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11px; color: rgba(17,17,17,0.58); }
        .rep-ord-pages { display: flex; gap: 6px; }
        .rep-ord-page { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(17,17,17,0.1); background: rgba(17,17,17,0.04); color: rgba(17,17,17,0.56); font-weight: 800; }
        .rep-ord-page.active { background: #d6e800; color: #111; border-color: #c7d800; }

        @media (max-width: 767px) {
          .rep-ord-card { padding: 14px 14px 12px; }
          .rep-ord-footer { flex-direction: column; align-items: flex-start; }
        }

      `}</style>

      <div className="rep-root" ref={rootRef}>
        <div className="rep-content rep-anim">
          <div className="rep-header">
            <div className="rep-tag">📊 Analytics</div>
            <h1>Reports & Analytics</h1>
            <p>Real-time insights on bookings, fleet, and hospital capacity</p>
          </div>

          {/* Summary */}
          <div>
            <div className="rep-section-title">Overview</div>
            <div className="rep-summary">
              {[
                { label: "Total Bookings", value: String(total).padStart(2,"0"),     accent: "rgba(255,255,255,0.4)" },
                { label: "Completed",      value: String(completed).padStart(2,"0"), accent: "#d6e800" },
                { label: "Confirmed",      value: String(confirmed).padStart(2,"0"), accent: "#d6e800" },
                { label: "Cancelled",      value: String(cancelled).padStart(2,"0"), accent: "#d6e800" },
                { label: "Success Rate",   value: `${successRate}%`,                 accent: "#d6e800" },
              ].map((s, i) => (
                <motion.div key={i} className="rep-sum-card rep-anim" whileHover={{ y: -2 }}>
                  <div className="rep-sum-bar" style={{ background: s.accent }} />
                  <div className="rep-sum-label">{s.label}</div>
                  <div className="rep-sum-value">{s.value}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div>
            <div className="rep-section-title">Breakdown</div>
            <div className="rep-charts-row">
              <motion.div className="rep-chart-card rep-anim" whileHover={{ y: -2 }}>
                <div className="rep-chart-title">🥧 Booking Status Distribution</div>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        labelLine={{ stroke: "#111111", strokeWidth: 1.1 }}
                        label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = outerRadius + 16;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text x={x} y={y} fill="#111111" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize="12" fontWeight="700">
                              {`${name} ${(percent * 100).toFixed(0)}%`}
                            </text>
                          );
                        }}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={ttStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="rep-chart-empty">No bookings yet</div>}
              </motion.div>

              <motion.div className="rep-chart-card rep-anim" whileHover={{ y: -2 }}>
                <div className="rep-chart-title">🚑 Ambulance Status</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ambBreakdown} barSize={28}>
                    <XAxis dataKey="name" tick={chartTick} axisLine={false} tickLine={false} />
                    <YAxis tick={chartTick} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="value" radius={[6,6,0,0]}>
                      {ambBreakdown.map((_, i) => <Cell key={i} fill={Object.values(statusColor)[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div className="rep-chart-card rep-anim" whileHover={{ y: -2 }}>
                <div className="rep-chart-title">🏥 Hospital Bed Availability</div>
                {hospitalBeds.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={hospitalBeds} barSize={16}>
                      <XAxis dataKey="name" tick={{ fill: "#111111", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={chartTick} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={ttStyle} />
                      <Legend wrapperStyle={{ color: "#111111", fontSize: 11, fontWeight: 600 }} />
                      <Bar dataKey="total"     name="Total"     fill="#4f5e00" radius={[4,4,0,0]} />
                      <Bar dataKey="available" name="Available" fill="#d6e800"                radius={[4,4,0,0]} />
                      <Bar dataKey="icu"       name="ICU"       fill="#b6c900"                radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="rep-chart-empty">No hospitals yet</div>}
              </motion.div>

              <motion.div className="rep-chart-card rep-anim" whileHover={{ y: -2 }}>
                <div className="rep-chart-title">📋 Bookings Per Ambulance</div>
                {bookingsPerAmb.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={bookingsPerAmb} barSize={28}>
                      <XAxis dataKey="name" tick={{ fill: "#111111", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={chartTick} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={ttStyle} />
                      <Bar dataKey="bookings" fill="#d6e800" radius={[6,6,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="rep-chart-empty">No data yet</div>}
              </motion.div>
            </div>
          </div>

          {/* Orders Tracking Table */}
          <div>
            <div className="rep-section-title">📦 Order Tracking & Status</div>
            <motion.div className="rep-ord-card rep-anim" whileHover={{ y: -2 }}>
              <table className="rep-ord-table">
                <thead>
                  <tr>
                    <th><span>ORDER ID ↕</span></th>
                    <th><span>ORDER TRACK ↕</span></th>
                    <th><span>STATUS ↕</span></th>
                    <th><span>ETA ↕</span></th>
                    <th><span>ASSIGNED DRIVER ↕</span></th>
                    <th><span>VEHICLE ↕</span></th>
                    <th><span>DELAY DURATION ↕</span></th>
                    <th style={{ textAlign: "center" }}><span>ACTIONS ↕</span></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => {
                    const st = String(b.status || "").toLowerCase();
                    let badgeClass = "pending";
                    let badgeLabel = "PENDING";
                    let delayText = "-/-";
                    let delayClass = "rep-nodelay";
                    
                    if (st === "pending") {
                      badgeClass = "delayed"; badgeLabel = "DELAYED"; delayText = "+25 mins"; delayClass = "rep-delay";
                    } else if (st === "confirmed" || st === "en_route") {
                      badgeClass = "active"; badgeLabel = "ACTIVE";
                    } else if (st === "completed") {
                      badgeClass = "completed"; badgeLabel = "COMPLETED";
                    } else if (st === "cancelled") {
                      badgeClass = "delayed"; badgeLabel = "CANCELLED";
                    }

                    // Calculate Progress Tracker
                    const sLv = st === 'completed' ? 4 : (st === 'confirmed' || st === 'en_route') ? 3 : st === 'cancelled' ? 1 : 2;
                    const ds = [1, 2, 3, 4].map(step => step <= sLv ? "on" : "off");

                    const dateObj = b.created_at ? new Date(b.created_at) : null;
                    const etaStr = dateObj && !Number.isNaN(dateObj.getTime())
                      ? `${dateObj.getDate()} Jan ${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`
                      : "ETA pending";

                    return (
                      <tr key={i}>
                        <td>
                          <div className="rep-id">#{String(b.id).padStart(4, "0")}</div>
                        </td>
                        <td>
                          <div className="rep-track-bar">
                            <div className="rep-track-line"></div>
                            <div className={`rep-track-dot ${ds[0]}`}>📦</div>
                            <div className={`rep-track-dot ${ds[1]}`}>🚐</div>
                            <div className={`rep-track-dot ${ds[2]}`}>📍</div>
                            <div className={`rep-track-dot ${ds[3]}`}>✓</div>
                          </div>
                        </td>
                        <td>
                          <div className={`rep-badge ${badgeClass}`}>{badgeLabel}</div>
                        </td>
                        <td>
                          <div className="rep-eta">
                            {etaStr} {badgeClass === 'delayed' && <span className="warn">⚠️</span>}
                          </div>
                        </td>
                        <td>
                          <div className="rep-driver">
                            <div className="rep-driver-av">👮</div>
                            <div className="rep-driver-name">{b.driver || "Unassigned"}</div>
                          </div>
                        </td>
                        <td>
                          <div className="rep-vehicle">
                            {b.ambulance_number ? `AMB - ${b.ambulance_number}` : "Pending Auth"}
                          </div>
                        </td>
                        <td>
                          <div className={delayClass}>{delayText}</div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button className="rep-action-btn" title="View Details">👁️</button>
                        </td>
                      </tr>
                    );
                  })}
                  {bookings.length === 0 && (
                    <tr><td colSpan="8" style={{ textAlign: "center", color: "var(--sr-text-muted)", padding: "40px 0" }}>No bookings available.</td></tr>
                  )}
                </tbody>
              </table>
              <div className="rep-ord-footer">
                <div>Showing 1 to {Math.min(10, bookings.length)} of {bookings.length} orders</div>
                <div className="rep-ord-pages">
                  <span className="rep-ord-page active">1</span>
                  <span className="rep-ord-page">2</span>
                  <span className="rep-ord-page">3</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Track Modal */}
      {trackedAmb && (
        <div className="rep-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setTrackedAmb(null); }}>
          <div className="rep-modal-box">
            <div className="rep-modal-header">
              <div>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--sr-text,#fff)" }}>🚑 {trackedAmb.number} — Live Tracking</span>
                <span style={{ fontSize: 11, color: "var(--sr-text-sub)", marginLeft: 10 }}>Driver: {trackedAmb.driver}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {trackedAmb.lat
                  ? <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: "rgba(214,232,0,0.18)", color: "#111", border: "1px solid rgba(214,232,0,0.55)", display: "flex", alignItems: "center", gap: 6 }}><span className="gps-pulse" /> GPS Active</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: "rgba(214,232,0,0.18)", color: "#111", border: "1px solid rgba(214,232,0,0.55)" }}>⏳ No GPS</span>
                }
                <button className="rep-close-btn" onClick={() => setTrackedAmb(null)}>Close ✕</button>
              </div>
            </div>
            <div className="rep-modal-info-bar">
              {[["Latitude", trackedAmb.lat?.toFixed(6)||"—"], ["Longitude", trackedAmb.lng?.toFixed(6)||"—"], ["Status", trackedAmb.status], ["Last Updated", trackedAmb.updated||"—"], ["Bookings", trackedAmb.bookings]].map((s, i) => (
                <div key={i}><div className="rep-modal-info-label">{s[0]}</div><div className="rep-modal-info-val">{s[1]}</div></div>
              ))}
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              {trackedAmb.lat && trackedAmb.lng
                ? <iframe width="100%" height="100%" style={{ border: "none" }} src={`https://maps.google.com/maps?q=${trackedAmb.lat},${trackedAmb.lng}&z=15&output=embed`} />
                : <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--sr-text-muted)" }}>
                    <span style={{ fontSize: 48 }}>📍</span>
                    <span style={{ fontSize: 14 }}>No GPS data available</span>
                    <code style={{ color: "#111", fontSize: 12 }}>/driver/{trackedAmb.id}</code>
                  </div>
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Reports;
