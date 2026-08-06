import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE = "http://127.0.0.1:8000";

export default function HospitalResponses() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    Promise.all([
      fetch(`${BASE}/api/bookings/`).then((r) => r.json()).catch(() => []),
      fetch(`${BASE}/api/ambulances/`).then((r) => r.json()).catch(() => []),
    ])
      .then(([bookingData, ambulanceData]) => {
        setBookings(Array.isArray(bookingData) ? bookingData : []);
        setAmbulances(Array.isArray(ambulanceData) ? ambulanceData : []);
      })
      .catch(() => {
        setBookings([]);
        setAmbulances([]);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    fetchBookings({ silent: false });
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchBookings({ silent: true });
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const hospitalAssigned = useMemo(
    () =>
      bookings
        .filter((b) => b.assigned_hospital_name)
        .filter((b) => b.status !== "cancelled")
        .filter((b) => ["ready", "not_ready"].includes(String(b.hospital_response || "").toLowerCase()))
        .sort((a, b) => b.id - a.id),
    [bookings]
  );

  return (
    <>
      <style>{`
        .hr-root {
          min-height: 100vh;
          padding: 64px 0 0 64px;
          background: #f7f7f2;
          color: #111;
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }
        .hr-wrap { padding: 22px; }
        .hr-title { font-size: 34px; font-weight: 900; margin: 0 0 8px; }
        .hr-sub { color: rgba(17,17,17,0.66); margin-bottom: 16px; font-size: 14px; }
        .hr-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .hr-card {
          border: 1px solid rgba(214,232,0,0.7);
          border-radius: 14px;
          background: #fffef5;
          padding: 11px 12px;
          box-shadow: 0 10px 24px rgba(214,232,0,0.16);
        }
        .hr-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hr-id { font-size: 12px; font-weight: 800; color: rgba(17,17,17,0.55); }
        .hr-pill {
          border: 1px solid rgba(20,20,20,0.16);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          background: #d6e800;
        }
        .hr-line { font-size: 12px; margin-bottom: 4px; color: rgba(17,17,17,0.84); }
        .hr-actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
        .hr-btn {
          border: 1px solid #111;
          border-radius: 10px;
          background: #d6e800;
          color: #111;
          height: 36px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
        }
        .hr-btn.secondary {
          background: #fff;
        }
        .hr-btn.remove {
          background: #fff;
          border-color: rgba(20,20,20,0.28);
          color: rgba(17,17,17,0.88);
        }
        .hr-btn.remove:hover {
          border-color: #111;
          background: #f4f4ea;
        }
        .hr-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .hr-auto-note {
          margin-top: 10px;
          border: 1px solid rgba(214,232,0,0.68);
          background: rgba(214,232,0,0.2);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 700;
          color: #111;
        }
        .hr-empty {
          margin-top: 20px;
          border: 1px dashed rgba(20,20,20,0.2);
          border-radius: 12px;
          background: #fff;
          padding: 28px;
          text-align: center;
          color: rgba(17,17,17,0.62);
        }
        @media (max-width: 767px) {
          .hr-grid { grid-template-columns: 1fr; }
          .hr-root { padding-left: 0; padding-bottom: 76px; }
          .hr-wrap { padding: 16px 10px 90px; }
        }
      `}</style>

      <div className="hr-root">
        <div className="hr-wrap">
          <h1 className="hr-title">Hospital Responses</h1>
          <div className="hr-sub">Only hospital-confirmed responses are shown here after hospital sends Ready/Not Ready alert.</div>

          {loading ? (
            <div className="hr-empty">Loading...</div>
          ) : hospitalAssigned.length === 0 ? (
            <div className="hr-empty">No hospital response yet. Waiting for hospital action.</div>
          ) : (
            <div className="hr-grid">
              {hospitalAssigned.map((b) => {
                const response = String(b.hospital_response || "").toLowerCase();
                const statusLabel = response === "ready" ? "Approved" : response === "not_ready" ? "Rejected" : "Pending";
                const statusMessage = response === "ready"
                  ? "Request accepted. We are preparing."
                  : "Request rejected. Currently not available.";
                return (
                  <article className="hr-card" key={b.id}>
                    <div className="hr-head">
                      <div className="hr-id">BOOKING #{b.id}</div>
                      <div className="hr-pill">{statusLabel}</div>
                    </div>
                    <div className="hr-line"><b>Patient:</b> {b.patient_name || b.booked_by}</div>
                    <div className="hr-line"><b>Pickup:</b> {b.pickup_location}</div>
                    <div className="hr-line"><b>Hospital:</b> {b.assigned_hospital_name}</div>
                    <div className="hr-line"><b>Alert:</b> {b.hospital_alert_sent ? "sent" : "pending"}</div>
                    <div className="hr-line"><b>Note:</b> {b.hospital_response_note || "-"}</div>
                    <div className="hr-auto-note">
                      {statusMessage}
                    </div>
                    {b.report_submitted_at && (
                      <div className="hr-auto-note" style={{ marginTop: 8 }}>
                        Driver report received and hospital notified automatically.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
