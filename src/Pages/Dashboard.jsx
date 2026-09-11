import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Ambulance, ArrowRight, Building2, ClipboardList, MapPinned, ShieldAlert } from "lucide-react";

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const asArray = (value) => (Array.isArray(value) ? value : []);
const statusLabel = (value) => String(value || "pending").replaceAll("_", " ");

export default function Dashboard() {
  const navigate = useNavigate();
  const [fleet, setFleet] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [syncing, setSyncing] = useState(true);

  const refreshDashboard = async () => {
    setSyncing(true);
    try {
      const [fleetResult, hospitalsResult, bookingsResult] = await Promise.allSettled([
        fetch(`${BASE}/api/ambulances/`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${BASE}/api/hospitals/`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${BASE}/api/bookings/`).then((r) => (r.ok ? r.json() : [])),
      ]);
      if (fleetResult.status === "fulfilled") setFleet(asArray(fleetResult.value));
      if (hospitalsResult.status === "fulfilled") setHospitals(asArray(hospitalsResult.value));
      if (bookingsResult.status === "fulfilled") setBookings(asArray(bookingsResult.value));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
    const timer = window.setInterval(refreshDashboard, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const normalized = fleet.map((item) => String(item.status || "").toLowerCase());
    const available = normalized.filter((status) => status === "available").length;
    const enRoute = normalized.filter((status) => status === "en_route" || status === "en route").length;
    const pending = bookings.filter((item) => ["pending", "confirmed", "hospital_pending"].includes(String(item.status || "").toLowerCase())).length;
    const activeHospitals = hospitals.filter((item) => String(item.status || "active").toLowerCase() !== "closed").length;
    return {
      available,
      enRoute,
      pending,
      activeHospitals,
      beds: hospitals.reduce((total, item) => total + Number(item.available_beds || 0), 0),
    };
  }, [fleet, hospitals, bookings]);

  const recentBookings = useMemo(
    () => [...bookings].sort((a, b) => Number(b.id || 0) - Number(a.id || 0)).slice(0, 6),
    [bookings]
  );

  const trend = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - offset));
      const key = date.toISOString().slice(0, 10);
      const value = bookings.filter((item) => String(item.created_at || "").slice(0, 10) === key).length;
      return { label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value };
    });
  }, [bookings]);
  const trendPeak = Math.max(...trend.map((item) => item.value), 1);

  return (
    <div className="ad-root">
      <style>{`
        .ad-root { min-height: 100vh; padding: 64px 0 0 64px; background: #f5f7fb; color: #17263a; font-family: "Outfit", "Segoe UI", sans-serif; }
        .ad-console { max-width: 1540px; margin: 0 auto; padding: 26px; }
        .ad-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 22px; margin-bottom: 20px; }
        .ad-eyebrow { margin: 0 0 6px; color: #e31b2f; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .ad-head h1 { margin: 0; color: #17263a; font-size: clamp(28px, 3vw, 42px); letter-spacing: -.04em; line-height: 1.06; }
        .ad-head p { margin: 8px 0 0; color: #657185; font-size: 14px; }
        .ad-alert { display: flex; align-items: center; gap: 11px; min-width: 232px; padding: 14px 16px; border: 0; border-radius: 10px; background: #e31b2f; color: #fff; text-align: left; cursor: pointer; }
        .ad-alert:hover { background: #bd1426; }
        .ad-alert b { display: block; font-size: 13px; }
        .ad-alert span { display: block; margin-top: 2px; font-size: 10px; opacity: .86; }
        .ad-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .ad-stat { display: flex; align-items: center; gap: 13px; min-height: 98px; padding: 16px; border: 1px solid #e1e7f0; border-radius: 12px; background: #fff; }
        .ad-stat-icon { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; border-radius: 12px; background: #fff0f2; color: #e31b2f; }
        .ad-stat-k { color: #718096; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
        .ad-stat-v { margin-top: 4px; color: #17263a; font-size: 28px; font-weight: 800; line-height: 1; }
        .ad-stat-sub { margin-top: 5px; color: #778398; font-size: 11px; }
        .ad-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, .85fr) minmax(290px, .9fr); gap: 14px; margin-top: 14px; }
        .ad-panel { min-width: 0; border: 1px solid #e1e7f0; border-radius: 12px; background: #fff; overflow: hidden; }
        .ad-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 17px; border-bottom: 1px solid #edf0f4; }
        .ad-panel-head h2 { margin: 0; color: #17263a; font-size: 14px; }
        .ad-panel-head button { border: 0; padding: 0; background: transparent; color: #e31b2f; font: 700 11px inherit; cursor: pointer; }
        .ad-chart { display: grid; grid-template-columns: repeat(7, 1fr); align-items: end; gap: 10px; height: 196px; padding: 20px 18px 16px; }
        .ad-bar-wrap { display: grid; height: 100%; grid-template-rows: 1fr auto; gap: 7px; align-items: end; text-align: center; }
        .ad-bar { min-height: 6px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, #ff6170, #e31b2f); }
        .ad-bar-wrap span { color: #788498; font-size: 10px; white-space: nowrap; }
        .ad-activity { padding: 4px 15px 12px; }
        .ad-activity-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid #edf0f4; }
        .ad-activity-row:last-child { border-bottom: 0; }
        .ad-activity-icon { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 50%; background: #fff0f2; color: #e31b2f; }
        .ad-activity-main { min-width: 0; flex: 1; }
        .ad-activity-main b { display: block; overflow: hidden; color: #243247; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
        .ad-activity-main span { display: block; overflow: hidden; margin-top: 3px; color: #7b8799; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
        .ad-status { padding: 3px 7px; border-radius: 999px; background: #fff0f2; color: #b8172a; font-size: 9px; font-weight: 800; text-transform: capitalize; }
        .ad-request-list { padding: 4px 16px 16px; }
        .ad-request { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px 0; border-bottom: 1px solid #edf0f4; }
        .ad-request:last-child { border-bottom: 0; }
        .ad-request b { color: #26364a; font-size: 12px; }
        .ad-request span { display: block; margin-top: 4px; color: #7b8799; font-size: 10px; }
        .ad-view { align-self: center; border: 0; background: #fff0f2; color: #c5192d; border-radius: 7px; padding: 6px 8px; font: 700 10px inherit; cursor: pointer; }
        .ad-bottom { display: grid; grid-template-columns: 1.4fr .9fr; gap: 14px; margin-top: 14px; }
        .ad-ready-list { padding: 4px 16px 16px; }
        .ad-ready { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #edf0f4; }
        .ad-ready:last-child { border-bottom: 0; }
        .ad-ready b { display: block; color: #26364a; font-size: 12px; }
        .ad-ready span { display: block; margin-top: 3px; color: #7b8799; font-size: 10px; }
        .ad-ready strong { color: #2e7d4e; font-size: 12px; }
        .ad-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 15px; }
        .ad-action { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 68px; padding: 12px; border: 1px solid #f1d4d9; border-radius: 10px; background: #fff7f8; color: #b8172a; text-align: left; font: 700 12px inherit; cursor: pointer; }
        .ad-action:hover { border-color: #e31b2f; background: #fff0f2; color: #b8172a; }
        .ad-empty { padding: 26px 18px; color: #7b8799; font-size: 12px; text-align: center; }

        /* Aarogya dashboard palette: white panels, green actions, and yellow data accents. */
        .ad-root { background: #ffffff; color: #111111; font-family: Roboto, sans-serif; }
        .ad-eyebrow { color: #126f1e; }
        .ad-head h1, .ad-head p, .ad-stat-v, .ad-stat-k, .ad-stat-sub, .ad-panel-head h2, .ad-activity-main b, .ad-activity-main span, .ad-request b, .ad-request span, .ad-ready b, .ad-ready span, .ad-empty, .ad-bar-wrap span { color: #111111; }
        .ad-alert { background: #126f1e; color: #ffffff; }
        .ad-alert:hover { background: #126f1e; }
        .ad-stat, .ad-panel { border-color: rgba(18, 111, 30, .20); box-shadow: none; }
        .ad-stat-icon, .ad-activity-icon { background: #fff3df; color: #f59a23; }
        .ad-panel-head button { color: #126f1e; }
        .ad-bar { background: #f59a23; }
        .ad-status { background: #fff3df; color: #111111; }
        .ad-view { background: #126f1e; color: #ffffff; }
        .ad-ready strong { color: #126f1e; }
        .ad-action, .ad-action:hover { border-color: #f59a23; background: #fff3df; color: #111111; transform: none; }
        @media (max-width: 1180px) { .ad-grid { grid-template-columns: 1fr 1fr; } .ad-grid > :last-child { grid-column: 1 / -1; } }
        @media (max-width: 820px) { .ad-root { padding-left: 0; padding-bottom: 74px; } .ad-console { padding: 18px 12px 90px; } .ad-head { flex-direction: column; } .ad-alert { width: 100%; } .ad-stats, .ad-grid, .ad-bottom { grid-template-columns: 1fr 1fr; } .ad-bottom { display: grid; } }
        @media (max-width: 560px) { .ad-stats, .ad-grid, .ad-bottom { grid-template-columns: 1fr; } .ad-grid > :last-child { grid-column: auto; } .ad-chart { gap: 5px; padding-left: 10px; padding-right: 10px; } }
      `}</style>

      <main className="ad-console">
        <header className="ad-head">
          <div><div className="ad-eyebrow">Aarogya control center</div><h1>Welcome back, Admin</h1><p>Live emergency operations across fleet, hospital partners, and booking requests.</p></div>
          <button className="ad-alert" onClick={() => navigate("/Requests")}><ShieldAlert size={24} /><span><b>Emergency Actions</b>Review pending ambulance requests</span><ArrowRight size={16} /></button>
        </header>
        <section className="ad-stats" aria-label="Live operational summary">
          <article className="ad-stat"><span className="ad-stat-icon"><Ambulance size={21} /></span><div><div className="ad-stat-k">Total Ambulances</div><div className="ad-stat-v">{fleet.length}</div><div className="ad-stat-sub">{summary.available} available · {summary.enRoute} en route</div></div></article>
          <article className="ad-stat"><span className="ad-stat-icon"><Building2 size={21} /></span><div><div className="ad-stat-k">Hospital Partners</div><div className="ad-stat-v">{hospitals.length}</div><div className="ad-stat-sub">{summary.activeHospitals} operational · {summary.beds} beds</div></div></article>
          <article className="ad-stat"><span className="ad-stat-icon"><ClipboardList size={21} /></span><div><div className="ad-stat-k">Total Bookings</div><div className="ad-stat-v">{bookings.length}</div><div className="ad-stat-sub">{summary.pending} require attention</div></div></article>
          <article className="ad-stat"><span className="ad-stat-icon"><Activity size={21} /></span><div><div className="ad-stat-k">System Sync</div><div className="ad-stat-v">{syncing ? "..." : "Live"}</div><div className="ad-stat-sub">Refreshes every 30 seconds</div></div></article>
        </section>
        <section className="ad-grid">
          <article className="ad-panel"><div className="ad-panel-head"><h2>Booking activity</h2><button onClick={refreshDashboard}>Refresh data</button></div><div className="ad-chart">{trend.map((item) => <div className="ad-bar-wrap" key={item.label}><div className="ad-bar" style={{ height: `${Math.max((item.value / trendPeak) * 100, 4)}%` }} /><span>{item.label}</span></div>)}</div></article>
          <article className="ad-panel"><div className="ad-panel-head"><h2>Live activity</h2><button onClick={() => navigate("/LiveMap")}>Open map</button></div><div className="ad-activity">{recentBookings.length ? recentBookings.slice(0, 4).map((booking) => <div className="ad-activity-row" key={booking.id}><span className="ad-activity-icon"><Ambulance size={15} /></span><div className="ad-activity-main"><b>Booking #{booking.id} · {booking.booked_by || booking.patient_name || "Patient"}</b><span>{booking.pickup_location || booking.pickup_city || "Location pending"}</span></div><span className="ad-status">{statusLabel(booking.status)}</span></div>) : <div className="ad-empty">No booking activity yet.</div>}</div></article>
          <article className="ad-panel"><div className="ad-panel-head"><h2>Recent requests</h2><button onClick={() => navigate("/Requests")}>View all</button></div><div className="ad-request-list">{recentBookings.length ? recentBookings.map((booking) => <div className="ad-request" key={`request-${booking.id}`}><div><b>#{booking.id} · {booking.patient_name || booking.booked_by || "Patient"}</b><span>{booking.pickup_location || "Pickup location pending"}</span></div><button className="ad-view" onClick={() => navigate("/Requests")}>View</button></div>) : <div className="ad-empty">Requests will appear here once bookings arrive.</div>}</div></article>
        </section>
        <section className="ad-bottom">
          <article className="ad-panel"><div className="ad-panel-head"><h2>Hospital readiness</h2><button onClick={() => navigate("/Hospitals")}>Manage hospitals</button></div><div className="ad-ready-list">{hospitals.length ? hospitals.slice(0, 5).map((hospital) => <div className="ad-ready" key={hospital.id || hospital.name}><div><b>{hospital.name || "Hospital partner"}</b><span>{hospital.city || hospital.address || "Location not added"}</span></div><strong>{Number(hospital.available_beds || 0)} beds</strong></div>) : <div className="ad-empty">No hospital partners available.</div>}</div></article>
          <article className="ad-panel"><div className="ad-panel-head"><h2>Quick actions</h2><span /></div><div className="ad-actions"><button className="ad-action" onClick={() => navigate("/Ambulances")}>Manage fleet <Ambulance size={18} /></button><button className="ad-action" onClick={() => navigate("/Hospitals")}>Hospital network <Building2 size={18} /></button><button className="ad-action" onClick={() => navigate("/LiveMap")}>Live tracking <MapPinned size={18} /></button><button className="ad-action" onClick={() => navigate("/Analytics")}>Reports <Activity size={18} /></button></div></article>
        </section>
      </main>
    </div>
  );
}
