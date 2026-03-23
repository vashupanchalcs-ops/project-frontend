import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Building2, BarChart2, ClipboardList,
  MapPin, Navigation, RefreshCw, BookOpen, Map, Settings, LogOut,
} from 'lucide-react';

const adminNav = [
  { to:"/",                    icon:LayoutDashboard, label:"Dashboard"       },
  { to:"/Ambulances",          icon:Truck,           label:"Ambulances"      },
  { to:"/Hospitals",           icon:Building2,       label:"Hospitals"       },
  { to:"/Reports",             icon:BarChart2,       label:"Reports"         },
  { to:"/Requests",            icon:ClipboardList,   label:"Bookings"        },
  { to:"/DriverChangeRequests",icon:RefreshCw,       label:"Driver Reques...",dot:true },
  { to:"/LiveMap",             icon:MapPin,          label:"Live Map",       dot:true  },
  { to:"/DriverView",          icon:Navigation,      label:"Driver View"     },
];
const userNav = [
  { to:"/",           icon:LayoutDashboard, label:"Home"        },
  { to:"/Ambulances", icon:Truck,           label:"Ambulances"  },
  { to:"/Hospitals",  icon:Building2,       label:"Hospitals"   },
  { to:"/MyBookings", icon:BookOpen,        label:"My Bookings" },
  { to:"/directions", icon:Map,             label:"Map"         },
];
const driverNav = [
  { to:"/DriverDashboard", icon:LayoutDashboard, label:"Dashboard", dot:true },
  { to:"/Ambulances",      icon:Truck,           label:"Ambulances"          },
  { to:"/Hospitals",       icon:Building2,       label:"Hospitals"           },
  { to:"/directions",      icon:Map,             label:"Map"                 },
];

export default function Leftsidebar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const role = localStorage.getItem("role");
  const user = localStorage.getItem("name") || "User";
  const email = localStorage.getItem("user") || "";
  const pic  = localStorage.getItem(`sr-profile-pic-${email}`);

  const nav = role==="admin" ? adminNav : role==="driver" ? driverNav : userNav;

  const pending = (() => {
    try { return JSON.parse(localStorage.getItem("all_change_requests")||"[]").filter(r=>r.status==="pending").length; }
    catch { return 0; }
  })();

  const logout = () => { ["user","name","role"].forEach(k=>localStorage.removeItem(k)); window.location.reload(); };

  return (
    <>
      <style>{`
        /* ── SIDEBAR ── */
        .lsb {
          position: fixed; top:0; left:0; bottom:0;
          width: var(--sb-w);
          background: color-mix(in srgb, var(--sr-sidebar-bg) 88%, transparent);
          border-right: 1px solid var(--sr-sidebar-border);
          display: flex; flex-direction: column;
          z-index: 200;
          font-family: var(--font-body);
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          /* NO overflow: hidden on root — children scroll */
        }

        /* Logo */
        .lsb-logo {
          padding: 24px 20px 18px;
          border-bottom: 1px solid var(--sr-sidebar-border);
          flex-shrink: 0;
        }
        .lsb-logo-text { font-size:22px; font-weight:700; color:var(--sr-text); letter-spacing:-.8px; line-height:1; font-family:var(--font-display); }
        .lsb-logo-text span { background:var(--sr-brand-grad); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .lsb-logo-role { font-size:9px; font-weight:700; color:var(--sr-text-muted); text-transform:uppercase; letter-spacing:1.8px; margin-top:3px; }

        /* User */
        .lsb-user {
          padding: 12px 14px 10px;
          border-bottom: 1px solid var(--sr-sidebar-border);
          flex-shrink: 0;
        }
        .lsb-user-row { display:flex; align-items:center; gap:10px; }
        .lsb-avatar {
          width:36px; height:36px; border-radius:12px;
          background:var(--sr-brand-grad); flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:14px; font-weight:800; color:#fff; overflow:hidden;
          border:1px solid var(--red-border);
        }
        .lsb-avatar img { width:100%;height:100%;object-fit:cover; }
        .lsb-uname { font-size:13px; font-weight:700; color:var(--sr-text); line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lsb-urole { font-size:10px; color:var(--sr-text-sub); margin-top:1px; text-transform:capitalize; }

        /* Nav label */
        .lsb-nav-lbl {
          padding: 14px 18px 6px;
          font-size:9px; font-weight:800; color:var(--sr-text-muted);
          text-transform:uppercase; letter-spacing:1.8px;
          flex-shrink: 0;
        }

        /* Nav scroll container — ONLY this scrolls, no scrollbar shown */
        .lsb-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 12px 10px;
          display: flex; flex-direction: column; gap: 2px;
          scrollbar-width: none;                 /* Firefox */
          -ms-overflow-style: none;              /* IE */
          overscroll-behavior: contain;
        }
        .lsb-nav::-webkit-scrollbar { display: none; } /* Chrome */

        /* Nav item */
        .lsb-item {
          display: flex; align-items: center; gap:10px;
          padding: 10px 11px; border-radius: 12px;
          color: var(--sr-sidebar-text); font-size:13px; font-weight:600;
          text-decoration: none; cursor:pointer;
          transition: background .14s, color .14s, transform .14s, border-color .14s;
          position: relative; white-space: nowrap;
          flex-shrink: 0;
          border: 1px solid transparent;
        }
        .lsb-item:hover { background:var(--sr-hover); color:var(--sr-text); transform:translateX(2px); }
        .lsb-item.act   { background:var(--sr-sidebar-active-bg); color:var(--sr-accent); font-weight:700; border-color:var(--red-border); box-shadow: inset 0 0 0 1px var(--sr-accent-muted); }
        .lsb-item-ic {
          width:32px; height:32px; border-radius:9px;
          background:var(--sr-hover);
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; transition:background .14s;
        }
        .lsb-item.act .lsb-item-ic { background:var(--sr-accent-muted); }
        .lsb-item-lbl { flex:1; overflow:hidden; text-overflow:ellipsis; }
        @keyframes lsb-blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.4)}}
        .lsb-dot { width:7px;height:7px;border-radius:50%;background:var(--sr-accent);flex-shrink:0;animation:lsb-blink 1.8s infinite; }
        .lsb-badge { min-width:18px;height:18px;background:var(--sr-accent);color:#fff;font-size:9px;font-weight:800;border-radius:100px;padding:0 5px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
        .lsb-div { height:1px; background:var(--sr-border); margin:8px 10px; flex-shrink:0; }

        /* Bottom */
        .lsb-bottom {
          padding: 8px 10px 14px;
          border-top: 1px solid var(--sr-sidebar-border);
          flex-shrink: 0;
          display: flex; flex-direction: column; gap:1px;
        }
        .lsb-btn {
          display:flex; align-items:center; gap:9px;
          padding:9px 10px; border-radius:11px;
          font-size:12px; font-weight:600; color:var(--sr-text-sub);
          background:none; border:none; cursor:pointer; font-family:inherit;
          width:100%; text-align:left; transition:all .14s;
        }
        .lsb-btn:hover { background:var(--sr-hover); color:var(--sr-text); }
        .lsb-btn.red:hover { background:var(--sr-accent-muted); color:var(--sr-accent); }
        .lsb-btn-ic { width:28px;height:28px;border-radius:8px;background:var(--sr-hover);display:flex;align-items:center;justify-content:center;flex-shrink:0; }

        /* ── MOBILE BOTTOM NAV ── */
        .lsb-mob {
          display:none;
          position:fixed; bottom:0; left:0; right:0; height:66px;
          background:var(--sr-glass); border-top:1px solid var(--sr-nav-border);
          backdrop-filter:blur(14px); z-index:999;
          align-items:stretch; box-shadow:var(--shadow);
        }
        .lsb-mob-item {
          flex:1; display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:3px; cursor:pointer; padding:6px 4px;
          position:relative; text-decoration:none; transition:all .14s;
          border-top:2px solid transparent;
        }
        .lsb-mob-item.act { border-top-color:var(--sr-accent); background:var(--sr-accent-muted); }
        .lsb-mob-icon { color:var(--sr-text-muted); transition:color .14s; font-size:0; }
        .lsb-mob-item.act .lsb-mob-icon { color:var(--sr-accent); }
        .lsb-mob-lbl { font-size:9px; font-weight:600; color:var(--sr-text-muted); font-family:var(--font-body); }
        .lsb-mob-item.act .lsb-mob-lbl { color:var(--sr-accent); font-weight:700; }
        .lsb-mob-dot { position:absolute;top:8px;right:calc(50% - 13px);width:6px;height:6px;border-radius:50%;background:var(--sr-accent);animation:lsb-blink 1.8s infinite; }
        .lsb-mob-badge { position:absolute;top:6px;right:calc(50% - 16px);background:var(--sr-accent);color:#fff;font-size:8px;font-weight:800;border-radius:100px;padding:1px 5px;min-width:14px;text-align:center; }

        @media(max-width:767px) {
          .lsb        { display:none!important; }
          .lsb-mob    { display:flex!important; }
        }
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <div className="lsb">
        <div className="lsb-logo">
          <div className="lsb-logo-text">Swift<span>Rescue</span></div>
          <div className="lsb-logo-role">{role==="admin"?"Admin Console":role==="driver"?"Driver Portal":"Emergency Services"}</div>
        </div>

        <div className="lsb-user">
          <div className="lsb-user-row">
            <div className="lsb-avatar">
              {pic ? <img src={pic} alt=""/> : <span>{user[0]?.toUpperCase()}</span>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div className="lsb-uname">{user}</div>
              <div className="lsb-urole">{role||"User"}</div>
            </div>
          </div>
        </div>

        <div className="lsb-nav-lbl">Navigation</div>

        <div className="lsb-nav">
          {nav.map((item, idx) => {
            const Icon = item.icon;
            const act  = location.pathname === item.to;
            const isPending = item.to==="/DriverChangeRequests" && pending>0;
            const div  = role==="admin" && idx===5;
            return (
              <div key={item.to} style={{display:"contents"}}>
                {div && <div className="lsb-div"/>}
                <Link to={item.to} className={`lsb-item ${act?"act":""}`}>
                  <div className="lsb-item-ic"><Icon size={16} strokeWidth={act?2.5:2}/></div>
                  <span className="lsb-item-lbl">{item.label}</span>
                  {item.dot && !isPending && <span className="lsb-dot"/>}
                  {isPending && <span className="lsb-badge">{pending}</span>}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="lsb-bottom">
          <button className="lsb-btn" onClick={()=>navigate("/settings")}>
            <div className="lsb-btn-ic"><Settings size={13}/></div>Settings
          </button>
          <button className="lsb-btn red" onClick={logout}>
            <div className="lsb-btn-ic"><LogOut size={13}/></div>Log out
          </button>
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="lsb-mob">
        {nav.slice(0,5).map(item=>{
          const Icon=item.icon;
          const act=location.pathname===item.to;
          const isPending=item.to==="/DriverChangeRequests"&&pending>0;
          return(
            <Link key={item.to} to={item.to} className={`lsb-mob-item ${act?"act":""}`}>
              {item.dot&&!isPending&&<span className="lsb-mob-dot"/>}
              {isPending&&<span className="lsb-mob-badge">{pending}</span>}
              <span className="lsb-mob-icon"><Icon size={20} strokeWidth={act?2.5:2}/></span>
              <span className="lsb-mob-lbl">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
