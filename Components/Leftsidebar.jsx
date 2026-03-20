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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

        /* ── SIDEBAR ── */
        .lsb {
          position: fixed; top:0; left:0; bottom:0;
          width: 200px;
          background: #fff;
          border-right: 1px solid rgba(0,0,0,0.08);
          display: flex; flex-direction: column;
          z-index: 200;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 2px 0 16px rgba(0,0,0,0.04);
          /* NO overflow: hidden on root — children scroll */
        }

        /* Logo */
        .lsb-logo {
          padding: 22px 18px 16px;
          border-bottom: 1px solid rgba(0,0,0,0.07);
          flex-shrink: 0;
        }
        .lsb-logo-text { font-size:20px; font-weight:800; color:#0a0a0a; letter-spacing:-.5px; line-height:1; }
        .lsb-logo-text span { color:#E50914; }
        .lsb-logo-role { font-size:9px; font-weight:700; color:rgba(0,0,0,0.3); text-transform:uppercase; letter-spacing:1.8px; margin-top:3px; }

        /* User */
        .lsb-user {
          padding: 12px 14px 10px;
          border-bottom: 1px solid rgba(0,0,0,0.07);
          flex-shrink: 0;
        }
        .lsb-user-row { display:flex; align-items:center; gap:10px; }
        .lsb-avatar {
          width:34px; height:34px; border-radius:10px;
          background:#E50914; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          font-size:14px; font-weight:800; color:#fff; overflow:hidden;
        }
        .lsb-avatar img { width:100%;height:100%;object-fit:cover; }
        .lsb-uname { font-size:13px; font-weight:700; color:#0a0a0a; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lsb-urole { font-size:10px; color:rgba(0,0,0,0.38); margin-top:1px; text-transform:capitalize; }

        /* Nav label */
        .lsb-nav-lbl {
          padding: 14px 18px 6px;
          font-size:9px; font-weight:800; color:rgba(0,0,0,0.3);
          text-transform:uppercase; letter-spacing:1.8px;
          flex-shrink: 0;
        }

        /* Nav scroll container — ONLY this scrolls, no scrollbar shown */
        .lsb-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 4px 10px 8px;
          display: flex; flex-direction: column; gap: 2px;
          scrollbar-width: none;                 /* Firefox */
          -ms-overflow-style: none;              /* IE */
          overscroll-behavior: contain;
        }
        .lsb-nav::-webkit-scrollbar { display: none; } /* Chrome */

        /* Nav item */
        .lsb-item {
          display: flex; align-items: center; gap:10px;
          padding: 9px 10px; border-radius: 10px;
          color: rgba(0,0,0,0.45); font-size:13px; font-weight:600;
          text-decoration: none; cursor:pointer;
          transition: background .14s, color .14s;
          position: relative; white-space: nowrap;
          flex-shrink: 0;
        }
        .lsb-item:hover { background:rgba(0,0,0,0.04); color:#0a0a0a; }
        .lsb-item.act   { background:rgba(229,9,20,0.08); color:#E50914; font-weight:700; }
        .lsb-item-ic {
          width:32px; height:32px; border-radius:9px;
          background:rgba(0,0,0,0.04);
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; transition:background .14s;
        }
        .lsb-item.act .lsb-item-ic { background:rgba(229,9,20,0.12); }
        .lsb-item-lbl { flex:1; overflow:hidden; text-overflow:ellipsis; }
        @keyframes lsb-blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.4)}}
        .lsb-dot { width:7px;height:7px;border-radius:50%;background:#E50914;flex-shrink:0;animation:lsb-blink 1.8s infinite; }
        .lsb-badge { min-width:18px;height:18px;background:#E50914;color:#fff;font-size:9px;font-weight:800;border-radius:100px;padding:0 5px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
        .lsb-div { height:1px; background:rgba(0,0,0,0.06); margin:5px 10px; flex-shrink:0; }

        /* Bottom */
        .lsb-bottom {
          padding: 8px 10px 14px;
          border-top: 1px solid rgba(0,0,0,0.07);
          flex-shrink: 0;
          display: flex; flex-direction: column; gap:1px;
        }
        .lsb-btn {
          display:flex; align-items:center; gap:9px;
          padding:8px 10px; border-radius:9px;
          font-size:12px; font-weight:600; color:rgba(0,0,0,0.42);
          background:none; border:none; cursor:pointer; font-family:inherit;
          width:100%; text-align:left; transition:all .14s;
        }
        .lsb-btn:hover { background:rgba(0,0,0,0.04); color:#0a0a0a; }
        .lsb-btn.red:hover { background:rgba(229,9,20,0.06); color:#E50914; }
        .lsb-btn-ic { width:28px;height:28px;border-radius:8px;background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;flex-shrink:0; }

        /* ── MOBILE BOTTOM NAV ── */
        .lsb-mob {
          display:none;
          position:fixed; bottom:0; left:0; right:0; height:62px;
          background:rgba(255,255,255,0.97); border-top:1px solid rgba(0,0,0,0.08);
          backdrop-filter:blur(12px); z-index:999;
          align-items:stretch; box-shadow:0 -4px 20px rgba(0,0,0,0.06);
        }
        .lsb-mob-item {
          flex:1; display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:3px; cursor:pointer; padding:6px 4px;
          position:relative; text-decoration:none; transition:all .14s;
          border-top:2px solid transparent;
        }
        .lsb-mob-item.act { border-top-color:#E50914; }
        .lsb-mob-icon { color:rgba(0,0,0,0.32); transition:color .14s; font-size:0; }
        .lsb-mob-item.act .lsb-mob-icon { color:#E50914; }
        .lsb-mob-lbl { font-size:9px; font-weight:600; color:rgba(0,0,0,0.32); font-family:'DM Sans',sans-serif; }
        .lsb-mob-item.act .lsb-mob-lbl { color:#E50914; font-weight:700; }
        .lsb-mob-dot { position:absolute;top:8px;right:calc(50% - 13px);width:6px;height:6px;border-radius:50%;background:#E50914;animation:lsb-blink 1.8s infinite; }
        .lsb-mob-badge { position:absolute;top:6px;right:calc(50% - 16px);background:#E50914;color:#fff;font-size:8px;font-weight:800;border-radius:100px;padding:1px 5px;min-width:14px;text-align:center; }

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
          <button className="lsb-btn" onClick={()=>navigate("/")}>
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