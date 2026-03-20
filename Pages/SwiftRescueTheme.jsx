import { useState, useEffect } from "react";
import { Bell, Search, LogOut, Activity, MapPin, Clock, AlertCircle } from 'lucide-react';

// ============================================================================
// NETFLIX-STYLE THEME PROVIDER
// ============================================================================

export const themeConfig = {
  colors: {
    bg: '#0a0a0f',        // Nearly pure black
    surface: '#0d0d14',    // Slightly lighter black
    border: '#1a1a2e',     // Dark borders
    text: '#e8e8f0',       // Off-white text
    textSecondary: '#888899', // Muted gray
    accent: '#ff2d55',     // Bold red (Netflix-style)
    success: '#00d4aa',    // Green for available
    warning: '#f7c948',    // Gold for en route
    error: '#ff2d55',      // Red for busy
  },
  fonts: {
    display: "'Outfit', 'Helvetica Neue', sans-serif",
    body: "'Outfit', 'Helvetica Neue', sans-serif",
    mono: "'Courier New', monospace"
  }
};

// ============================================================================
// TOP NAVBAR - Netflix Style
// ============================================================================

export const Topnavbar = () => {
  const [user] = useState(localStorage.getItem("name") || "User");
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("name");
    window.location.reload();
  };

  return (
    <nav
      style={{
        background: themeConfig.colors.bg,
        borderBottom: `1px solid ${themeConfig.colors.border}`,
        fontFamily: themeConfig.fonts.body,
      }}
      className="fixed top-0 left-0 right-0 h-16 flex items-center px-8 gap-6 z-50"
    >
      {/* Logo */}
      <div style={{
        background: 'linear-gradient(135deg, #ff2d55 0%, #ff6b35 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }} className="text-2xl font-black tracking-tighter">
        SwiftRescue
      </div>

      {/* Search */}
      <div
        style={{
          background: themeConfig.colors.surface,
          border: `1px solid ${themeConfig.colors.border}`,
        }}
        className="flex items-center gap-3 rounded-lg px-4 py-2 flex-1 max-w-sm"
      >
        <Search size={16} color={themeConfig.colors.textSecondary} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ambulances, drivers..."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: themeConfig.colors.text,
            fontFamily: themeConfig.fonts.body,
            fontSize: '14px',
            width: '100%',
          }}
        />
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <button
        style={{
          background: themeConfig.colors.surface,
          border: `1px solid ${themeConfig.colors.border}`,
          color: themeConfig.colors.textSecondary,
        }}
        className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition"
      >
        <Bell size={18} />
      </button>

      {/* User Menu */}
      <div className="flex items-center gap-3 pl-6 border-l" style={{ borderColor: themeConfig.colors.border }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #ff2d55, #ff6b35)',
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: themeConfig.colors.bg,
            fontWeight: 'bold',
            fontSize: '14px',
          }}
        >
          {user[0].toUpperCase()}
        </div>

        <div>
          <p style={{ color: themeConfig.colors.text, fontSize: '14px', fontWeight: 600 }}>
            {user}
          </p>
          <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px' }}>
            Dispatcher
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            color: themeConfig.colors.accent,
            cursor: 'pointer',
          }}
          className="ml-3 hover:opacity-80 transition"
        >
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
};

// ============================================================================
// STATS CARDS - Netflix Grid
// ============================================================================

const StatsCard = ({ label, value, gradient, icon: Icon }) => (
  <div
    style={{
      background: themeConfig.colors.surface,
      border: `1px solid ${themeConfig.colors.border}`,
      borderRadius: '16px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}
    className="group"
  >
    {/* Top gradient bar */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: gradient,
      }}
    />

    <div className="flex items-start justify-between">
      <div>
        <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </p>
        <p style={{
          color: themeConfig.colors.text,
          fontSize: '36px',
          fontWeight: 900,
          fontFamily: themeConfig.fonts.mono,
          marginTop: '8px',
          letterSpacing: '-1px',
        }}>
          {String(value).padStart(2, '0')}
        </p>
      </div>
      {Icon && (
        <div style={{ opacity: 0.2 }}>
          <Icon size={32} color={themeConfig.colors.textSecondary} />
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// AMBULANCE CARD - Netflix Style
// ============================================================================

const AmbulanceCard = ({ ambulance }) => {
  const statusConfig = {
    available: { label: 'Available', bg: '#0d2818', color: '#00d4aa', border: '#0d4028' },
    en_route: { label: 'En Route', bg: '#2a1a08', color: '#f7c948', border: '#4a2a08' },
    busy: { label: 'Busy', bg: '#2a0a0a', color: '#ff2d55', border: '#4a1a1a' },
    offline: { label: 'Offline', bg: '#1a1a1a', color: '#888888', border: '#2a2a2a' },
  };

  const status = statusConfig[ambulance.status] || statusConfig.offline;

  return (
    <div
      style={{
        background: themeConfig.colors.surface,
        border: `1px solid ${themeConfig.colors.border}`,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
      className="group hover:border-opacity-100 transition-all duration-300"
    >
      {/* Image Section */}
      <div className="relative h-40 overflow-hidden bg-gray-900">
        <img
          src="https://nnccalcutta.in/wp-content/uploads/2022/04/166-1665783_2048x1536-ambulance-wallpapers-data-id-377442-high-quality-768x576.jpg"
          alt={ambulance.ambulance_number}
          className="w-full h-full object-cover opacity-60 group-hover:opacity-75 transition"
          style={{ filter: 'saturate(0.4)' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, transparent 40%, ' + themeConfig.colors.surface + ')',
          }}
        />

        {/* Status Badge Overlay */}
        <div className="absolute top-4 right-4">
          <span
            style={{
              background: status.bg,
              color: status.color,
              border: `1px solid ${status.border}`,
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }} />
            {status.label}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4">
        {/* Header */}
        <div>
          <p style={{ color: themeConfig.colors.text, fontSize: '18px', fontWeight: 900, fontFamily: themeConfig.fonts.mono, letterSpacing: '1px' }}>
            {ambulance.ambulance_number}
          </p>
          <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
            {ambulance.model}
          </p>
        </div>

        {/* Driver Info */}
        <div className="space-y-2 py-2" style={{ borderTop: `1px solid ${themeConfig.colors.border}`, borderBottom: `1px solid ${themeConfig.colors.border}` }}>
          <div className="flex justify-between items-center">
            <span style={{ color: themeConfig.colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Driver
            </span>
            <span style={{ color: themeConfig.colors.text, fontSize: '13px', fontWeight: 500 }}>
              {ambulance.driver}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: themeConfig.colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Contact
            </span>
            <span style={{ color: themeConfig.colors.text, fontSize: '13px', fontFamily: themeConfig.fonts.mono }}>
              {ambulance.driver_contact}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: themeConfig.colors.textSecondary, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Speed
            </span>
            <span style={{ color: themeConfig.colors.text, fontSize: '13px' }}>
              {ambulance.speed} km/h
            </span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2">
          <MapPin size={14} color={themeConfig.colors.accent} />
          <span style={{ color: themeConfig.colors.textSecondary, fontSize: '12px' }} className="truncate">
            {ambulance.location}
          </span>
        </div>

        {/* ETA Grid */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '16px', fontWeight: 900, fontFamily: themeConfig.fonts.mono }}>
              {ambulance.nearest_hospital || '—'}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Nearest
            </p>
          </div>
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '16px', fontWeight: 900, fontFamily: themeConfig.fonts.mono }}>
              {ambulance.eta_to_hospital || '—'}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              ETA Hosp
            </p>
          </div>
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '16px', fontWeight: 900, fontFamily: themeConfig.fonts.mono }}>
              {ambulance.eta_to_patient || '—'}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '10px', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              ETA Patient
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div
        style={{
          borderTop: `1px solid ${themeConfig.colors.border}`,
          padding: '12px',
        }}
      >
        <button
          style={{
            background: 'linear-gradient(135deg, #ff2d55, #ff6b35)',
            color: 'white',
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
          className="hover:opacity-90 transition"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// ACTIVITY FEED - Netflix Style
// ============================================================================

const ActivityFeed = ({ ambulances }) => (
  <div
    style={{
      background: themeConfig.colors.surface,
      border: `1px solid ${themeConfig.colors.border}`,
      borderRadius: '16px',
      padding: '24px',
    }}
  >
    <h2 style={{
      color: themeConfig.colors.text,
      fontSize: '20px',
      fontWeight: 900,
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <Activity size={20} color={themeConfig.colors.accent} />
      Recent Activity
    </h2>

    <div className="space-y-3">
      {ambulances.slice(0, 5).map((ambulance, idx) => (
        <div
          key={idx}
          style={{
            padding: '12px',
            background: themeConfig.colors.bg,
            borderRadius: '8px',
            border: `1px solid ${themeConfig.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          className="group hover:border-opacity-100 transition"
        >
          <div>
            <p style={{ color: themeConfig.colors.text, fontSize: '14px', fontWeight: 600 }}>
              {ambulance.driver}
            </p>
            <p style={{ color: themeConfig.colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
              {ambulance.ambulance_number} • {ambulance.status}
            </p>
          </div>
          <button
            style={{
              background: themeConfig.colors.accent,
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
            className="hover:opacity-90 transition"
          >
            Check
          </button>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// MAIN DASHBOARD - Netflix Style
// ============================================================================

export const Dashboard = () => {
  const [ambulances, setAmbulances] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/ambulances/")
      .then((res) => res.json())
      .then((data) => setAmbulances(data))
      .catch((err) => console.log(err));
  }, []);

  const getCount = (status) => {
    if (status === 'total') return ambulances.length;
    return ambulances.filter((a) => a.status === status).length;
  };

  return (
    <div
      style={{
        background: themeConfig.colors.bg,
        color: themeConfig.colors.text,
        fontFamily: themeConfig.fonts.body,
        minHeight: '100vh',
        paddingTop: '80px',
      }}
    >
      {/* HERO SECTION */}
      <div style={{ padding: '60px 40px 40px' }}>
        <div style={{ marginBottom: '40px' }}>
          <p style={{
            color: themeConfig.colors.textSecondary,
            fontSize: '12px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: '12px',
          }}>
            // Fleet Operations Center
          </p>
          <h1 style={{
            color: themeConfig.colors.text,
            fontSize: '48px',
            fontWeight: 900,
            lineHeight: '1.1',
            letterSpacing: '-2px',
            marginBottom: '12px',
          }}>
            Ambulance Network
          </h1>
          <p style={{
            color: themeConfig.colors.textSecondary,
            fontSize: '16px',
            marginTop: '8px',
          }}>
            Life Doesn't Wait — Neither Do We
          </p>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-4 gap-4 mb-12">
          <StatsCard
            label="Total Fleet"
            value={getCount('total')}
            gradient="linear-gradient(to right, #ff2d55, #ff6b35)"
            icon={AlertCircle}
          />
          <StatsCard
            label="Available"
            value={getCount('available')}
            gradient="linear-gradient(to right, #00d4aa, #00a8ff)"
            icon={Activity}
          />
          <StatsCard
            label="En Route"
            value={getCount('en_route')}
            gradient="linear-gradient(to right, #f7c948, #ff6b35)"
            icon={Clock}
          />
          <StatsCard
            label="Busy"
            value={getCount('busy')}
            gradient="linear-gradient(to right, #a78bfa, #ff2d55)"
            icon={AlertCircle}
          />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {/* Ambulance Cards */}
          <div className="col-span-2">
            <div className="grid grid-cols-2 gap-4">
              {ambulances.map((ambulance, idx) => (
                <AmbulanceCard key={idx} ambulance={ambulance} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <ActivityFeed ambulances={ambulances} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPLETE APP
// ============================================================================

export default function App() {
  return (
    <div style={{ background: themeConfig.colors.bg }}>
      <Topnavbar />
      <Dashboard />
    </div>
  );
}
