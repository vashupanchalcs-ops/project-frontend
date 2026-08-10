import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  ChevronsRight, Truck, Building2, BarChart2,
  ClipboardList, MapPin, Navigation, RefreshCw, Map, House, HeartPulse, Ambulance, Repeat, BookOpen, Bot, MessageSquareWarning,
  Compass, Send, Search, PlayCircle, Plus, CircleUserRound, Grid3X3, Route, Activity, ShieldCheck, Siren, Users, MapPinned, BriefcaseBusiness, PhoneCall, Mic, FileText,
} from 'lucide-react';

const adminNavItems = [
  { to: "/",                     icon: Grid3X3,       label: "Home"             },
  { to: "/Ambulances",           icon: Siren,         label: "Ambulances"       },
  { to: "/Hospitals",            icon: Building2,     label: "Hospitals"        },
  { to: "/HospitalResponses",    icon: ShieldCheck,   label: "Hospital Response" },
  { to: "/HospitalPartnerDetails", icon: BookOpen,    label: "Hospital Details" },
  { to: "/Analytics",            icon: Activity,      label: "Analytics"        },
  { to: "/Requests",             icon: ClipboardList, label: "Requests"         },
  { to: "/CallIntakeConsole",    icon: PhoneCall,     label: "Call Intake"      },
  { to: "/DriverChangeRequests", icon: RefreshCw,     label: "Driver Requests", dot: true },
  { to: "/AdminChatControl",     icon: Bot,           label: "AI Chat Control", dot: true },
  { to: "/LiveMap",              icon: Compass,       label: "Live Map",        dot: true },
];

const hospitalNavItems = [
  { to: "/hospital/home",      icon: Building2,     label: "Hospital Home" },
  { to: "/hospital/responses", icon: ShieldCheck,   label: "Hospital Response", dot: true },
  { to: "/hospital/reports",   icon: BookOpen,      label: "Case Reports", dot: true },
  { to: "/hospital/live-track", icon: MapPinned,    label: "Live Map", dot: true },
  { to: "/hospital/resources", icon: BriefcaseBusiness, label: "Resources & Beds" },
  { to: "/hospital/staff",     icon: Users,           label: "Doctors & Staff" },
  { to: "/hospital/cases",     icon: FileText,        label: "Cases" },
];

const userNavItems = [
  { to: "/",            icon: House,     label: "Home"        },
  { to: "/Ambulances",  icon: PlayCircle,label: "Ambulances"  },
  { to: "/Hospitals",   icon: Send,      label: "Hospitals"   },
  { to: "/MyBookings",  icon: Search,    label: "My Bookings" },
  { to: "/UserChatbot", icon: Plus,      label: "AI Assistant" },
  { to: "/LiveTracking",icon: Compass,   label: "Live Track"  },
];

const driverNavItems = [
  { to: "/",                                   icon: Navigation,    label: "Home"           },
  { to: "/driver-dashboard?tab=bookings",     icon: ClipboardList, label: "My Bookings",   dot: true, tab: "bookings" },
  { to: "/driver/insurance-form",              icon: ShieldCheck,   label: "Insurance Form", dot: true },
  { to: "/driver/voice-reports",               icon: Mic,           label: "Voice Reports", dot: true },
  { to: "/driver/guidance",                    icon: BookOpen,      label: "Guidance", dot: true },
  { to: "/driver-dashboard?tab=change-request", icon: Repeat,      label: "Change Request", tab: "change-request" },
  { to: "/DriverRequestChat",                   icon: MessageSquareWarning, label: "Request Chat", dot: true },
  { to: "/Hospitals",                          icon: Building2,     label: "Hospitals"      },
  { to: "/driver-dashboard?tab=map",          icon: Route,         label: "Live Track",    tab: "map" },
];

const Leftsidebar = () => {
  const location = useLocation();
  const role     = localStorage.getItem("role");
  const [mobileNavExpanded, setMobileNavExpanded] = useState(false);

  const navItems =
    role === "admin"  ? adminNavItems  :
    role === "hospital" ? hospitalNavItems :
    role === "driver" ? driverNavItems :
    userNavItems;

  const pendingCount = (() => {
    try {
      const all = JSON.parse(localStorage.getItem("all_change_requests") || "[]");
      return all.filter(r => r.status === "pending").length;
    } catch { return 0; }
  })();

  // Driver dashboard ke internal tabs remove kar diye gaye hain,
  // isliye mobile par bhi common sidebar bottom nav show hoga.
  const hideBottomNav = false;

  return (
    <>
      <style>{`
        .lsb-root {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          height: 100vh !important;
          width: 64px !important;
          background: #000000 !important;
          border-right: 1px solid #111111 !important;
          display: flex !important;
          flex-direction: column;
          align-items: center;
          z-index: 9999 !important;
          padding: 0 0 16px;
        }
        .lsb-logo {
          height: 64px; width: 100%;
          display: flex; align-items: center; justify-content: center;
          border-bottom: 1px solid #111111;
          color: #ffffff; cursor: pointer; transition: color 0.2s, background 0.2s;
          text-decoration: none; flex-shrink: 0;
        }
        .lsb-logo:hover { color: #000000; background: #ffffff; }
        .lsb-nav {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; gap: 4px;
          padding: 12px 0; width: 100%;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .lsb-nav::-webkit-scrollbar { display: none; }
        .lsb-item {
          position: relative; width: 44px; height: 44px;
          border-radius: 14px; display: flex; align-items: center;
          justify-content: center; color: #ffffff;
          border: 1px solid rgba(255,255,255,0.15);
          background: transparent;
          transition: all 0.2s; cursor: pointer; text-decoration: none; flex-shrink: 0;
        }
        .lsb-item:hover {
          background: #ffffff;
          color: #000000;
          border-color: #ffffff;
          box-shadow: none;
          transform: none;
        }
        .lsb-item.active {
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          box-shadow: none;
        }
        .lsb-tooltip {
          position: absolute; left: 54px;
          background: #000000; color: #fff;
          white-space: nowrap; opacity: 0; pointer-events: none;
          transition: opacity 0.15s; border: 1px solid #000000;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; z-index: 99999;
        }
        .lsb-item:hover .lsb-tooltip { opacity: 1; }
        .lsb-dot {
          position: absolute; top: 6px; right: 6px;
          width: 6px; height: 6px; border-radius: 50%;
          background: #000000; box-shadow: none;
          animation: lsb-pulse 1.5s infinite;
        }
        .lsb-dot-red {
          position: absolute;
          background: #000000; box-shadow: none;
          animation: lsb-pulse 1.5s infinite;
          display: flex; align-items: center; justify-content: center;
          font-size: 8px; font-weight: 800; color: #fff;
          min-width: 14px; height: 14px;
          padding: 0 3px; border-radius: 7px;
          top: 2px; right: 2px;
        }
        @keyframes lsb-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
        .lsb-divider {
          width: 28px; height: 1px;
          background: #000000;
          margin: 4px 0; flex-shrink: 0;
        }

        /* Mobile Bottom Nav */
        .lsb-bottom {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 62px; background: #ffffff;
          border-top: 1px solid #000000;
          z-index: 9999;
          align-items: stretch;
          gap: 6px;
          padding: 4px 6px;
          transition: height 0.2s ease;
        }
        .lsb-bottom.expanded {
          height: 110px;
        }
        .lsb-bottom-inner {
          flex: 1;
          display: grid;
          grid-auto-flow: column;
          grid-template-rows: 1fr;
          gap: 6px;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
        }
        .lsb-bottom.expanded .lsb-bottom-inner {
          grid-template-rows: 1fr 1fr;
        }
        .lsb-bottom-toggle {
          width: 30px;
          border: 1px solid #000000;
          border-radius: 10px;
          background: #000000;
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          align-self: stretch;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .lsb-bottom-item {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 2px; min-width: 72px; height: 100%;
          color: rgba(0,0,0,0.72); text-decoration: none;
          transition: color 0.2s; position: relative;
          border-top: 2px solid transparent;
          border-radius: 10px;
        }
        .lsb-bottom-item.active {
          color: #fff;
          border-top-color: #ffffff;
          background: #000000;
          border-radius: 10px 10px 0 0;
        }
        .lsb-bottom-item:hover  {
          color: #fff;
          background: #000000;
          border-radius: 10px 10px 0 0;
        }
        .lsb-bottom-label {
          font-size: 8px; font-weight: 600;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          white-space: nowrap;
          max-width: 68px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lsb-bottom-dot {
          position: absolute; top: 6px; right: calc(50% - 14px);
          width: 5px; height: 5px; border-radius: 50%;
          background: #000000; box-shadow: none;
          animation: lsb-pulse 1.5s infinite;
        }

        @media (max-width: 767px) {
          .lsb-root   { display: none !important; }
          .lsb-bottom { display: flex !important; }
          .lsb-bottom.hidden { display: none !important; }
        }
      `}</style>

      {/* Desktop Sidebar */}
      <div className={`lsb-root role-${role || "user"}`}>
        <Link to="/" className="lsb-logo"><ChevronsRight size={28} /></Link>
        <div className="lsb-nav">
          {navItems.map((item, index) => {
            const Icon         = item.icon;
            const isDriverTabItem = role === "driver" && item.tab;
            const currentTab = new URLSearchParams(location.search).get("tab");
            const isActive = isDriverTabItem
              ? location.pathname.toLowerCase() === "/driver-dashboard" && currentTab === item.tab
              : location.pathname === item.to;
            const isPendingReq = item.to === "/DriverChangeRequests" && pendingCount > 0;
            return (
              <div key={item.to} style={{ display: "contents" }}>
                {role === "admin" && index === 6 && <div className="lsb-divider" />}
                <Link to={item.to} className={`lsb-item ${isActive ? "active" : ""}`}>
                  <Icon size={20} />
                  {item.dot && !isPendingReq && <div className="lsb-dot" />}
                  {isPendingReq && <div className="lsb-dot-red">{pendingCount}</div>}
                  <span className="lsb-tooltip">{item.label}{isPendingReq ? ` (${pendingCount})` : ""}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Nav — Driver role pe hamesha hide (unka apna nav hai) */}
      <div className={`lsb-bottom ${hideBottomNav ? "hidden" : ""} ${mobileNavExpanded ? "expanded" : ""}`}>
        <div className="lsb-bottom-inner">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isDriverTabItem = role === "driver" && item.tab;
            const currentTab = new URLSearchParams(location.search).get("tab");
            const isActive = isDriverTabItem
              ? location.pathname.toLowerCase() === "/driver-dashboard" && currentTab === item.tab
              : location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={`lsb-bottom-item ${isActive ? "active" : ""}`}>
                <Icon size={18} />
                <span className="lsb-bottom-label">{item.label}</span>
                {item.dot && <div className="lsb-bottom-dot" />}
              </Link>
            );
          })}
        </div>
        {navItems.length > 5 && (
          <button
            className="lsb-bottom-toggle"
            onClick={() => setMobileNavExpanded((v) => !v)}
            title={mobileNavExpanded ? "Collapse Menu" : "Expand Menu"}
          >
            {mobileNavExpanded ? "−" : "≡"}
          </button>
        )}
      </div>
    </>
  );
};

export default Leftsidebar;
