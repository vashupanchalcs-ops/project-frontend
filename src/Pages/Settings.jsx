import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../ThemeContext";
import { useSmoothScroll } from "../providers/SmoothScrollProvider";

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { engine, setEngine } = useSmoothScroll();
  const [dense, setDense] = useState(() => localStorage.getItem("sr-dense-ui") === "1");
  const [largeText, setLargeText] = useState(() => localStorage.getItem("sr-large-text") === "1");
  const [alerts, setAlerts] = useState(() => localStorage.getItem("sr-alerts") !== "0");
  const [compactNotifs, setCompactNotifs] = useState(() => localStorage.getItem("sr-compact-notifs") === "1");

  useEffect(() => {
    localStorage.setItem("sr-dense-ui", dense ? "1" : "0");
    document.documentElement.style.setProperty("--r-md", dense ? "10px" : "12px");
    document.documentElement.style.setProperty("--r-lg", dense ? "14px" : "16px");
  }, [dense]);

  useEffect(() => {
    localStorage.setItem("sr-large-text", largeText ? "1" : "0");
    document.documentElement.style.fontSize = largeText ? "17px" : "16px";
  }, [largeText]);

  useEffect(() => {
    localStorage.setItem("sr-alerts", alerts ? "1" : "0");
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem("sr-compact-notifs", compactNotifs ? "1" : "0");
  }, [compactNotifs]);

  const navItems = [
    { label: "Dashboard", desc: "Overview and KPIs", to: "/" },
    { label: "Ambulances", desc: "Fleet cards and booking", to: "/Ambulances" },
    { label: "Hospitals", desc: "Live bed availability", to: "/Hospitals" },
    { label: "Bookings", desc: "Requests and tracking", to: "/MyBookings" },
    { label: "Reports", desc: "Analytics and trends", to: "/Reports" },
    { label: "Live Map", desc: "Real-time dispatch map", to: "/LiveMap" },
  ];

  return (
    <>
      <style>{`
        .st-root{
          min-height:100vh;
          padding-top:var(--nav-h);
          padding-left:var(--sb-w);
          background:
            radial-gradient(circle at 10% 10%, var(--sr-bg-grad-a), transparent 34%),
            radial-gradient(circle at 88% 8%, var(--sr-bg-grad-b), transparent 38%),
            var(--sr-bg);
          color:var(--sr-text);
          font-family:var(--font-body);
        }
        .st-inner{max-width:1080px;margin:0 auto;padding:26px 26px 60px;}
        .st-title{font-size:32px;font-weight:800;letter-spacing:-.7px;margin:0 0 6px;font-family:var(--font-display);}
        .st-sub{font-size:13px;color:var(--sr-text-sub);margin:0 0 24px;}
        .st-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .st-card{
          background:color-mix(in srgb, var(--sr-surface) 92%, transparent);
          border:1px solid var(--sr-border);
          border-radius:16px;
          box-shadow:var(--shadow);
          padding:16px;
        }
        .st-h{font-size:15px;font-weight:800;margin:0 0 12px;color:var(--sr-text);}
        .st-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid color-mix(in srgb, var(--sr-border) 70%, transparent);}
        .st-row:last-child{border-bottom:none;}
        .st-lbl{font-size:13px;font-weight:700;color:var(--sr-text);}
        .st-muted{font-size:11px;color:var(--sr-text-muted);}
        .st-btns{display:flex;gap:8px;flex-wrap:wrap;}
        .st-btn{
          border:1px solid var(--sr-input-border);
          background:var(--sr-input-bg);
          color:var(--sr-text);
          border-radius:999px;
          padding:7px 12px;
          font-size:11px;
          font-weight:700;
          cursor:pointer;
        }
        .st-btn.on{background:var(--sr-brand-grad);border-color:transparent;color:#fff;}
        .st-toggle{
          width:44px;height:24px;border-radius:999px;border:1px solid var(--sr-input-border);
          background:var(--sr-input-bg);position:relative;cursor:pointer;
        }
        .st-toggle::after{
          content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
          background:#fff;transition:transform .18s ease;
        }
        .st-toggle.on{background:var(--sr-accent-muted);border-color:var(--red-border);}
        .st-toggle.on::after{transform:translateX(20px);}
        .st-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
        .st-nav-btn{
          border:1px solid var(--sr-input-border);
          background:var(--sr-input-bg);
          color:var(--sr-text);
          border-radius:12px;
          padding:11px 12px;
          font-size:12px;
          font-weight:700;
          cursor:pointer;
          text-align:left;
          transition:all .16s ease;
        }
        .st-nav-btn small{
          display:block;
          margin-top:3px;
          font-size:10px;
          font-weight:600;
          color:var(--sr-text-muted);
        }
        .st-nav-btn:hover{
          border-color:var(--red-border);
          transform:translateY(-1px);
          box-shadow:var(--shadow);
        }
        .st-actions{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }
        .st-action-btn{
          border:none;
          background:var(--sr-brand-grad);
          color:#fff;
          border-radius:12px;
          padding:9px 14px;
          font-size:11px;
          font-weight:800;
          letter-spacing:.2px;
          cursor:pointer;
          box-shadow:0 8px 20px var(--sr-accent-muted);
        }
        .st-action-btn.alt{
          background:var(--sr-input-bg);
          border:1px solid var(--sr-input-border);
          color:var(--sr-text);
          box-shadow:none;
        }
        @media(max-width:767px){
          .st-root{padding-left:0;padding-bottom:70px;}
          .st-inner{padding:14px 12px 80px;}
          .st-grid{grid-template-columns:1fr;}
          .st-nav{grid-template-columns:1fr;}
        }
      `}</style>
      <div className="st-root">
        <div className="st-inner">
          <h1 className="st-title">Settings</h1>
          <p className="st-sub">Personalize appearance, navigation, and layout comfort.</p>

          <div className="st-grid">
            <div className="st-card">
              <h3 className="st-h">Theme</h3>
              <div className="st-row">
                <div>
                  <div className="st-lbl">Color Mode</div>
                  <div className="st-muted">Choose the visual theme for the full app</div>
                </div>
                <div className="st-btns">
                  <button className={`st-btn ${theme === "dark" ? "on" : ""}`} onClick={() => setTheme("dark")}>Night</button>
                  <button className={`st-btn ${theme === "grey" ? "on" : ""}`} onClick={() => setTheme("grey")}>Steel</button>
                  <button className={`st-btn ${theme === "white" ? "on" : ""}`} onClick={() => setTheme("white")}>Day</button>
                </div>
              </div>
              <div className="st-row">
                <div>
                  <div className="st-lbl">Scroll Engine</div>
                  <div className="st-muted">Set smooth scrolling behavior</div>
                </div>
                <div className="st-btns">
                  <button className={`st-btn ${engine === "lenis" ? "on" : ""}`} onClick={() => setEngine("lenis")}>Lenis</button>
                  <button className={`st-btn ${engine === "locomotive" ? "on" : ""}`} onClick={() => setEngine("locomotive")}>Loco</button>
                </div>
              </div>
            </div>

            <div className="st-card">
              <h3 className="st-h">Accessibility</h3>
              <div className="st-row">
                <div>
                  <div className="st-lbl">Dense Interface</div>
                  <div className="st-muted">Reduce spacing for compact view</div>
                </div>
                <button className={`st-toggle ${dense ? "on" : ""}`} onClick={() => setDense(!dense)} />
              </div>
              <div className="st-row">
                <div>
                  <div className="st-lbl">Large Text</div>
                  <div className="st-muted">Increase base text size for readability</div>
                </div>
                <button className={`st-toggle ${largeText ? "on" : ""}`} onClick={() => setLargeText(!largeText)} />
              </div>
              <div className="st-row">
                <div>
                  <div className="st-lbl">Live Alerts</div>
                  <div className="st-muted">Enable booking and emergency notifications</div>
                </div>
                <button className={`st-toggle ${alerts ? "on" : ""}`} onClick={() => setAlerts(!alerts)} />
              </div>
              <div className="st-row">
                <div>
                  <div className="st-lbl">Compact Notifications</div>
                  <div className="st-muted">Use tighter notification card spacing</div>
                </div>
                <button className={`st-toggle ${compactNotifs ? "on" : ""}`} onClick={() => setCompactNotifs(!compactNotifs)} />
              </div>
            </div>

            <div className="st-card" style={{ gridColumn: "1 / -1" }}>
              <h3 className="st-h">Quick Navigation</h3>
              <div className="st-nav">
                {navItems.map((item) => (
                  <button key={item.to} className="st-nav-btn" onClick={() => navigate(item.to)}>
                    {item.label}
                    <small>{item.desc}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="st-card" style={{ gridColumn: "1 / -1" }}>
              <h3 className="st-h">Quick Actions</h3>
              <div className="st-actions">
                <button
                  className="st-action-btn"
                  onClick={() => {
                    setTheme("dark");
                    setEngine("lenis");
                    setDense(false);
                    setLargeText(false);
                    setAlerts(true);
                    setCompactNotifs(false);
                  }}
                >
                  Reset To Recommended
                </button>
                <button
                  className="st-action-btn alt"
                  onClick={() => navigate("/Ambulances")}
                >
                  Open Fleet Booking
                </button>
                <button
                  className="st-action-btn alt"
                  onClick={() => navigate("/MyBookings")}
                >
                  Open Booking Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
