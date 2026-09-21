/**
 * LiveTracking.jsx → src/Pages/LiveTracking.jsx
 * Dedicated fullscreen live tracking page (sidebar 4th item for users).
 * Supports both standard ambulance dispatches and user-selected hospital bookings.
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import UserBookingMap from "../Components/UserBookingMap";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

export default function LiveTracking() {
  const cachedConfirmed = (() => {
    try {
      return JSON.parse(localStorage.getItem("active_confirmed_booking") || "null");
    } catch {
      return null;
    }
  })();
  const [booking, setBooking] = useState(cachedConfirmed);
  const [allBookings, setAllBookings] = useState(cachedConfirmed ? [cachedConfirmed] : []);
  const [loading, setLoading] = useState(!cachedConfirmed);
  const [noActive, setNoActive] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const email = (localStorage.getItem("user") || "").trim().toLowerCase();
  const name = (localStorage.getItem("name") || "").trim().toLowerCase();
  const selectedBookingId = location.state?.bookingId || null;

  const fetchConfirmed = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/`);
      const data = await res.json();
      if (!Array.isArray(data)) {
        setNoActive(true);
        setLoading(false);
        return;
      }

      // Filter for current user's bookings
      const myBookings = data.filter((b) => {
        const bEmail = String(b.booked_by_email || b.user_email || "").trim().toLowerCase();
        const bName = String(b.booked_by || "").trim().toLowerCase();
        const matchesUser = (email && bEmail === email) || (name && bName === name);
        const notCancelled = b.status !== "cancelled" && b.status !== "rejected";
        return matchesUser && notCancelled;
      });

      // Trackable bookings: confirmed dispatches or active user-selected hospital bookings
      const trackable = myBookings.filter(
        (b) =>
          b.is_user_selected_hospital ||
          b.status === "confirmed" ||
          b.sent_to_driver ||
          b.driver_accepted
      );

      setAllBookings(trackable);

      let target = null;
      // 1. If explicit bookingId passed via location state
      if (selectedBookingId) {
        target = myBookings.find((b) => Number(b.id) === Number(selectedBookingId));
      }
      // 2. Otherwise keep currently selected if still valid
      if (!target && booking?.id) {
        target = trackable.find((b) => Number(b.id) === Number(booking.id));
      }
      // 3. Fallback prioritization:
      if (!target) {
        target =
          trackable.find((b) => b.status === "confirmed" && b.driver_accepted) ||
          trackable.find((b) => b.status === "confirmed" && b.sent_to_driver) ||
          trackable.find((b) => b.is_user_selected_hospital && b.status !== "completed") ||
          trackable.find((b) => b.status === "confirmed") ||
          trackable[0] ||
          myBookings[0] ||
          null;
      }

      if (target) {
        setBooking(target);
        setNoActive(false);
      } else {
        setBooking(null);
        setNoActive(true);
      }
    } catch {
      setNoActive(true);
    }
    setLoading(false);
  }, [email, name, selectedBookingId, booking?.id]);

  useEffect(() => {
    fetchConfirmed();
    const t = setInterval(fetchConfirmed, 8000);
    return () => clearInterval(t);
  }, [fetchConfirmed]);

  return (
    <>
      <style>{`
        .lt-root {
          position: fixed;
          top: 64px;
          left: 64px;
          right: 0;
          bottom: 0;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          font-family: 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        .lt-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: #ffffff;
          border-bottom: 1px solid rgba(20,20,20,0.12);
          flex-shrink: 0;
          gap: 12px;
          flex-wrap: wrap;
        }
        .lt-topbar-left { display: flex; align-items: center; gap: 12px; }
        .lt-back-btn {
          width: 34px; height: 34px;
          background: rgba(17,17,17,0.05);
          border: 1px solid rgba(20,20,20,0.12);
          border-radius: 50%; color: rgba(17,17,17,0.7);
          cursor: pointer; font-family: inherit;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; flex-shrink: 0;
        }
        .lt-back-btn:hover { background: rgba(17,17,17,0.1); color: #111; }
        .lt-title { font-size: 16px; font-weight: 800; color: #111; }
        .lt-sub { font-size: 11px; color: rgba(17,17,17,0.58); margin-top: 2px; }

        .lt-mybookings-btn {
          background: rgba(17,17,17,0.05); border: 1px solid rgba(20,20,20,0.12); color: #111;
          border-radius: 10px; padding: 7px 16px; font-size: 11px; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: background 0.15s; white-space: nowrap;
        }
        .lt-mybookings-btn:hover { background: rgba(17,17,17,0.1); }

        .lt-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px; text-align: center; }
        @keyframes lt-spin { to { transform: rotate(360deg); } }

        @media (max-width: 767px) {
          .lt-root { top: 64px; left: 0; bottom: 60px; }
          .lt-topbar { padding: 10px 14px; }
          .lt-title { font-size: 14px; }
        }
      `}</style>

      <div className="lt-root">
        {/* Top Bar (Shown only when loading or no active booking) */}
        {(!booking || loading) && (
          <div className="lt-topbar">
            <div className="lt-topbar-left">
              <button className="lt-back-btn" onClick={() => navigate("/MyBookings")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="lt-title">🚑 Live Tracking</div>
                </div>
                <div className="lt-sub">
                  No active booking
                </div>
              </div>
            </div>
            <button className="lt-mybookings-btn" onClick={() => navigate("/MyBookings")}>
              📋 My Bookings
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="lt-center">
            <div style={{ width: 40, height: 40, border: "3px solid rgba(17,17,17,0.1)", borderTop: "3px solid #00c853", borderRadius: "50%", animation: "lt-spin 0.8s linear infinite" }} />
            <p style={{ color: "rgba(17,17,17,0.6)", fontSize: 13, fontWeight: 700 }}>Finding your booking...</p>
          </div>
        )}

        {/* No active booking */}
        {!loading && noActive && (
          <div className="lt-center">
            <div style={{ fontSize: 64, opacity: 0.3 }}>🚑</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>You have no active bookings at the moment</div>
            <div style={{ fontSize: 13, color: "rgba(17,17,17,0.6)", maxWidth: 300 }}>
              Track your ambulance and hospital route in real-time once a booking is created or confirmed
            </div>
            <button
              onClick={() => navigate("/Ambulances")}
              style={{ marginTop: 8, background: "#111111", color: "#ffffff", border: "none", borderRadius: 12, padding: "11px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
            >
              🚑 Book an Ambulance
            </button>
          </div>
        )}

        {/* Multi-booking switcher if user has more than 1 trackable booking */}
        {!loading && booking && allBookings.length > 1 && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 18,
              zIndex: 9999,
              background: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(8px)",
              border: "1.5px solid rgba(0,0,0,0.12)",
              borderRadius: 30,
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(17,17,17,0.6)", textTransform: "uppercase", paddingLeft: 6 }}>
              Active:
            </span>
            {allBookings.map((b) => {
              const isSelected = Number(b.id) === Number(booking.id);
              const label = b.is_user_selected_hospital
                ? `🏥 #${b.id} ${b.assigned_hospital_name ? `(${b.assigned_hospital_name.slice(0, 10)}...)` : ""}`
                : `🚑 #${b.id}`;
              return (
                <button
                  key={b.id}
                  onClick={() => setBooking(b)}
                  style={{
                    background: isSelected ? "#111111" : "#f1f1ee",
                    color: isSelected ? "#ffffff" : "#333333",
                    border: "none",
                    borderRadius: 20,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title={b.is_user_selected_hospital ? `Track hospital booking #${b.id} to ${b.assigned_hospital_name || 'Hospital'}` : `Track booking #${b.id}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Fullscreen User Booking Map */}
        {!loading && booking && (
          <UserBookingMap booking={booking} onClose={() => navigate("/MyBookings")} embedded />
        )}
      </div>
    </>
  );
}
