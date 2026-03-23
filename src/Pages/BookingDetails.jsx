import { useState, useEffect } from "react";

const statusColors = {
  pending:   { color: "#f7c948", bg: "rgba(247,201,72,0.15)",  border: "rgba(247,201,72,0.35)" },
  confirmed: { color: "#00d4aa", bg: "rgba(0,212,170,0.15)",   border: "rgba(0,212,170,0.35)" },
  completed: { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.15)" },
  cancelled: { color: "#ff4d5a", bg: "rgba(229,9,20,0.15)",    border: "rgba(229,9,20,0.4)" },
};

const BookingDetails = () => {
  const [bookings, setBookings] = useState([]);

  const fetchBookings = () => {
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(setBookings)
      .catch(console.log);
  };

  useEffect(() => { fetchBookings(); }, []);

  const updateStatus = (id, status) => {
    fetch(`http://127.0.0.1:8000/api/bookings/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(fetchBookings);
  };

  return (
    <>
      <style>{`
        .bd-root { background: #0f0f0f; color: #fff; min-height: 100vh; padding-top: 56px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .bd-content { max-width: 1100px; margin: 0 auto; padding: 40px 32px 64px; }
        .bd-header { margin-bottom: 32px; }
        .bd-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: #E50914; background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.3); border-radius: 100px; padding: 4px 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
        .bd-header h1 { font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .bd-header p { font-size: 13px; color: rgba(255,255,255,0.35); }
        .bd-table { width: 100%; border-collapse: collapse; }
        .bd-table th { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; text-transform: uppercase; padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .bd-table td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; color: rgba(255,255,255,0.8); vertical-align: middle; }
        .bd-table tr:hover td { background: rgba(255,255,255,0.03); }
        .bd-amb { font-weight: 800; color: #fff; font-size: 14px; }
        .bd-driver { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .bd-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 100px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px; }
        .bd-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .bd-btn { font-size: 10px; font-weight: 700; padding: 5px 12px; border-radius: 100px; border: 1px solid; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
        .bd-btn:hover { opacity: 0.8; }
        .bd-empty { text-align: center; padding: 60px; color: rgba(255,255,255,0.2); font-size: 14px; }
      `}</style>

      <div className="bd-root">
        <div className="bd-content">
          <div className="bd-header">
            <div className="bd-tag">📋 Management</div>
            <h1>Booking Details</h1>
            <p>All ambulance booking requests and their status</p>
          </div>

          {bookings.length === 0 ? (
            <div className="bd-empty">No bookings yet</div>
          ) : (
            <table className="bd-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ambulance</th>
                  <th>Booked By</th>
                  <th>Pickup</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => {
                  const sc = statusColors[b.status] || statusColors.pending;
                  return (
                    <tr key={b.id}>
                      <td style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{String(i+1).padStart(2,"0")}</td>
                      <td>
                        <div className="bd-amb">🚑 {b.ambulance_number}</div>
                        <div className="bd-driver">Driver: {b.driver} · {b.driver_contact}</div>
                      </td>
                      <td>
                        <div>{b.booked_by}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{b.booked_by_email}</div>
                      </td>
                      <td>📍 {b.pickup_location}</td>
                      <td>{b.destination || "—"}</td>
                      <td>
                        <span className="bd-pill" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{b.created_at}</td>
                      <td>
                        <div className="bd-actions">
                          {b.status === "pending" && <>
                            <button className="bd-btn" style={{ background: "rgba(0,212,170,0.1)", color: "#00d4aa", borderColor: "rgba(0,212,170,0.3)" }} onClick={() => updateStatus(b.id, "confirmed")}>Confirm</button>
                            <button className="bd-btn" style={{ background: "rgba(229,9,20,0.1)", color: "#ff4d5a", borderColor: "rgba(229,9,20,0.3)" }} onClick={() => updateStatus(b.id, "cancelled")}>Cancel</button>
                          </>}
                          {b.status === "confirmed" && (
                            <button className="bd-btn" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.15)" }} onClick={() => updateStatus(b.id, "completed")}>Complete</button>
                          )}
                          {(b.status === "completed" || b.status === "cancelled") && (
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default BookingDetails;