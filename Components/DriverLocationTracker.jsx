import { useEffect, useState } from 'react';
import { MapPin, AlertCircle, Loader } from 'lucide-react';

const DriverLocationTracker = ({ ambulanceId, driverEmail, bookingId }) => {
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const themeConfig = {
    colors: {
      bg: '#0a0a0f',
      surface: '#0d0d14',
      border: '#1a1a2e',
      text: '#e8e8f0',
      textSecondary: '#888899',
      accent: '#ff2d55',
      success: '#00d4aa',
      error: '#ff2d55',
      warning: '#f7c948',
    },
    fonts: {
      body: "'Outfit', 'Helvetica Neue', sans-serif",
      mono: "'Courier New', monospace"
    }
  };

  useEffect(() => {
    if (!ambulanceId || !driverEmail) {
      setError('Missing ambulance ID or driver email');
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      return;
    }

    setTracking(true);
    setError(null);

    // Function to send location to backend
    const sendLocation = (latitude, longitude, accuracy, speed) => {
      setIsLoading(true);
      const locationData = {
        ambulance_id: ambulanceId,
        driver_email: driverEmail,
        booking_id: bookingId,
        latitude,
        longitude,
        accuracy,
        speed,
      };

      setLocation(locationData);
      setLastUpdate(new Date().toLocaleTimeString());
      setUpdateCount(prev => prev + 1);

      // Send to backend
      fetch('http://127.0.0.1:8000/api/driver-location/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            // Location saved successfully
          } else {
            setError(data.error || 'Failed to save location');
          }
        })
        .catch(err => {
          console.error('Location update failed:', err);
          setError(`Network error: ${err.message}`);
        })
        .finally(() => setIsLoading(false));
    };

    // Get location immediately
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        sendLocation(latitude, longitude, accuracy, 0);
      },
      (error) => {
        setError(`Initial location failed: ${error.message}`);
      }
    );

    // Set interval to send location every 10 seconds
    const locationInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          sendLocation(latitude, longitude, accuracy, 0);
        },
        (error) => {
          console.error('Location error:', error);
          setError(`Location error: ${error.message}`);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }, 10000); // Every 10 seconds

    // Cleanup
    return () => {
      clearInterval(locationInterval);
      setTracking(false);
    };
  }, [ambulanceId, driverEmail, bookingId]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: themeConfig.colors.surface,
      border: `1px solid ${themeConfig.colors.border}`,
      padding: '16px',
      borderRadius: '12px',
      color: themeConfig.colors.text,
      fontSize: '13px',
      fontFamily: themeConfig.fonts.body,
      zIndex: 1000,
      minWidth: '300px',
      maxWidth: '320px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(10px)',
      animation: 'slideIn 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${themeConfig.colors.border}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '14px',
        }}>
          {isLoading ? (
            <Loader size={16} color={themeConfig.colors.warning} style={{ animation: 'spin 1s linear infinite' }} />
          ) : tracking ? (
            <MapPin size={16} color={themeConfig.colors.success} />
          ) : (
            <AlertCircle size={16} color={themeConfig.colors.error} />
          )}
          <span style={{
            color: isLoading ? themeConfig.colors.warning : 
                   tracking ? themeConfig.colors.success : 
                   themeConfig.colors.error
          }}>
            {isLoading ? 'UPDATING' : tracking ? 'TRACKING ACTIVE' : 'TRACKING PAUSED'}
          </span>
        </div>
        <div style={{
          fontSize: '11px',
          color: themeConfig.colors.textSecondary,
          fontFamily: themeConfig.fonts.mono,
          backgroundColor: 'rgba(255,255,255,0.05)',
          padding: '4px 8px',
          borderRadius: '4px',
        }}>
          #{updateCount}
        </div>
      </div>

      {/* Location Details */}
      {location && (
        <div style={{
          fontSize: '12px',
          color: themeConfig.colors.textSecondary,
          lineHeight: '1.8',
          marginBottom: '12px',
          padding: '10px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '8px',
          border: `1px solid ${themeConfig.colors.border}`,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>📍 LATITUDE</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              {location.latitude.toFixed(6)}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>📍 LONGITUDE</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              {location.longitude.toFixed(6)}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>📏 ACCURACY</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              ±{Math.round(location.accuracy)}m
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: themeConfig.colors.accent }}>⚡ BOOKING</span>
            <span style={{ fontFamily: themeConfig.fonts.mono, color: themeConfig.colors.text }}>
              #{bookingId}
            </span>
          </div>
        </div>
      )}

      {/* Last Update Time */}
      {lastUpdate && (
        <div style={{
          padding: '8px',
          background: 'rgba(0,212,170,0.1)',
          borderRadius: '6px',
          border: `1px solid ${themeConfig.colors.success}20`,
          marginBottom: '12px',
          fontSize: '11px',
          color: themeConfig.colors.success,
          fontWeight: 500,
        }}>
          ✓ Last update: {lastUpdate}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          color: themeConfig.colors.error,
          fontSize: '11px',
          padding: '8px',
          background: 'rgba(255,45,85,0.1)',
          borderRadius: '6px',
          border: `1px solid ${themeConfig.colors.error}20`,
          marginTop: '8px',
          wordBreak: 'break-word',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Status Bar */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: `1px solid ${themeConfig.colors.border}`,
        fontSize: '10px',
        color: themeConfig.colors.textSecondary,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Amb ID: {ambulanceId}</span>
        <span style={{ fontFamily: themeConfig.fonts.mono }}>{driverEmail}</span>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DriverLocationTracker;
