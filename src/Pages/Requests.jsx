import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { calculateBookingBill, formatMoney } from "../utils/billing";

gsap.registerPlugin(ScrollTrigger);

const statusColors = {
  pending: { color: "#111", bg: "#e50914", border: "#e50914" },
  confirmed: { color: "#111", bg: "#e50914", border: "#e50914" },
  completed: { color: "#111", bg: "#e50914", border: "#e50914" },
  cancelled: { color: "#111", bg: "#e50914", border: "#e50914" },
};

const safeText = (val, fallback = "Unknown") => {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val !== "string") return String(val);

  const v = val.trim();
  if (!v) return fallback;

  if ((v.startsWith("{") && v.endsWith("}")) || (v.startsWith("[") && v.endsWith("]"))) {
    try {
      const parsed = JSON.parse(v);
      if (parsed?.name) return parsed.name;
      if (parsed?.email) return parsed.email;
      return fallback;
    } catch {
      return fallback;
    }
  }

  return v;
};

const Requests = () => {
  const [bookings, setBookings] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);

  const fetchBookings = () => {
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then((r) => r.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        list.sort((a, b) => {
          const aId = Number(a?.id || 0);
          const bId = Number(b?.id || 0);
          return bId - aId;
        });
        setBookings(list);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchBookings();
    const intervalId = window.setInterval(fetchBookings, 5000);
    const onFocus = () => fetchBookings();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchBookings();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".req-head-anim",
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.46, stagger: 0.08, ease: "power2.out" }
      );

      gsap.utils.toArray(".req-card-item").forEach((card, idx) => {
        gsap.fromTo(
          card,
          {
            y: 48,
            opacity: 0.58,
          },
          {
            y: 0,
            opacity: 1,
            ease: "none",
            delay: Math.min(idx * 0.015, 0.2),
            scrollTrigger: {
              trigger: card,
              start: "top 94%",
              end: "top 56%",
              scrub: 1,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }, rootRef);

    return () => ctx.revert();
  }, [bookings.length]);

  useEffect(() => {
    if (location.state?.flashMsg) {
      const timer = setTimeout(() => {
        navigate(location.pathname, { replace: true, state: { ...location.state, flashMsg: null } });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state?.flashMsg, location.pathname, navigate]);

  const updateBooking = (id, payload) => {
    fetch(`http://127.0.0.1:8000/api/bookings/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(fetchBookings);
  };

  const updateStatus = (id, status) => updateBooking(id, { status });

  const openHospitalAssign = (bookingId) => {
    navigate("/Hospitals", { state: { assignBookingId: bookingId } });
  };
  const openAmbulanceAssign = (bookingId) => {
    navigate("/Ambulances", { state: { assignBookingId: bookingId } });
  };
  const openAmbulanceReassign = (bookingId) => {
    navigate("/Ambulances", { state: { reassignBookingId: bookingId, reason: "driver_rejected" } });
  };

  const deleteBooking = (id) => {
    fetch(`http://127.0.0.1:8000/api/bookings/${id}/`, { method: "DELETE" }).then(fetchBookings);
  };

  const ActionButtons = ({ b }) => {
    const btnStyle = {
      flex: 1,
      fontSize: 11,
      fontWeight: 700,
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid rgba(229, 9, 20, 0.15)",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "center",
      background: "#e50914",
      color: "#111",
      minWidth: "110px",
      width: "100%",
    };

    return (
      <div className="req-actions">
        {b.status === "pending" && (
          <>
            <button style={btnStyle} onClick={() => updateStatus(b.id, "confirmed")}>✓ Confirm</button>
            <button style={btnStyle} onClick={() => updateStatus(b.id, "cancelled")}>✕ Cancel</button>
          </>
        )}

        {b.status === "confirmed" && !b.sent_to_driver && (
          <>
            <button style={btnStyle} onClick={() => openAmbulanceAssign(b.id)}>
              {Number(b.ambulance_id || 0) > 0 ? "Reassign Ambulance" : "Assign Nearest Ambulance"}
            </button>
            {b.driver_rejected_once && (
              <button style={btnStyle} onClick={() => openAmbulanceReassign(b.id)}>
                Assign Another Ambulance
              </button>
            )}
            {Number(b.ambulance_id || 0) > 0 && b.assigned_hospital_name && b.hospital_response === "ready" && (
              <button
                style={btnStyle}
                onClick={() => updateBooking(b.id, { send_to_driver: true })}
              >
                Send To Driver
              </button>
            )}
            {!(Number(b.ambulance_id || 0) > 0 && b.assigned_hospital_name && b.hospital_response === "ready") && (
              <div
                style={{
                  ...btnStyle,
                  background: "#fffbd6",
                  borderColor: "rgba(20,20,20,0.18)",
                  color: "rgba(17,17,17,0.7)",
                  cursor: "default",
                  pointerEvents: "none",
                }}
              >
                {Number(b.ambulance_id || 0) <= 0
                  ? "Assign Ambulance First"
                  : b.assigned_hospital_name
                  ? "Waiting Hospital Approval"
                  : "Assign Hospital First"}
              </div>
            )}
            <button style={btnStyle} onClick={() => updateStatus(b.id, "cancelled")}>✕ Cancel</button>
          </>
        )}

        {b.status === "confirmed" && (
          <>
            <button style={btnStyle} onClick={() => openHospitalAssign(b.id)}>
              {b.assigned_hospital_name ? "Reassign Hospital" : "Assign Hospital"}
            </button>
          </>
        )}

        {b.report_submitted_at && !b.report_sent_to_hospital && (
          <button
            style={{
              ...btnStyle,
              opacity: b.assigned_hospital_name ? 1 : 0.6,
              cursor: b.assigned_hospital_name ? "pointer" : "not-allowed",
            }}
            disabled={!b.assigned_hospital_name}
            onClick={() => updateBooking(b.id, { send_report_to_hospital: true })}
          >
            Send Report To Hospital
          </button>
        )}

        {b.report_sent_to_hospital && (
          <button style={{ ...btnStyle, background: "#fffbd6" }} disabled>
            Report sent to hospital
          </button>
        )}

        {b.status === "confirmed" && b.sent_to_driver && (
          <button style={{ ...btnStyle, background: "#fffbd6" }} disabled>
            {b.driver_task_completed ? "Task Completed by Driver" : "Dispatched to Driver"}
          </button>
        )}
        {b.status === "confirmed" && b.sent_to_driver && !b.driver_rejected_once && (
          <button
            style={{ ...btnStyle, background: "#111", color: "#fff", borderColor: "#111" }}
            onClick={() => navigate("/LiveMap", { state: { openRouteManager: true, bookingId: b.id, ambulanceId: b.ambulance_id } })}
          >
            🗺 Live Track + Route Manager
          </button>
        )}

        {b.status === "completed" && b.driver_task_completed && (
          <button style={{ ...btnStyle, background: "#fffbd6" }} disabled>Task Completed by Driver</button>
        )}

        {(b.status === "completed" || b.status === "cancelled") && (
          <button style={btnStyle} onClick={() => deleteBooking(b.id)}>🗑 Delete</button>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .req-root {
          background:
            radial-gradient(920px 430px at 88% 8%, rgba(229, 9, 20, 0.15), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(229, 9, 20, 0.15), transparent 70%),
            var(--sr-bg, #f7f7f2);
          color: #111;
          min-height: 100vh;
          padding: 64px 0 0 64px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .req-content {
          width: 100%;
          margin: 0 auto;
          max-width: none;
          padding: 20px 16px 72px;
        }

        .req-header {
          margin-bottom: 20px;
        }

        .req-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 700;
          color: #111;
          background: rgba(229, 9, 20, 0.15);
          border: 1px solid rgba(229, 9, 20, 0.15);
          border-radius: 100px;
          padding: 4px 14px;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .req-header h1 {
          font-size: 46px;
          font-weight: 900;
          margin-bottom: 4px;
          color: #111;
          line-height: 1;
        }

        .req-header p {
          font-size: 14px;
          color: rgba(17,17,17,0.72);
        }

        .req-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          align-items: start;
        }

        .req-card-item {
          background: linear-gradient(170deg, rgba(255,255,255,0.98), rgba(248,248,238,0.98));
          border: 1px solid rgba(229, 9, 20, 0.15);
          border-radius: 16px;
          padding: 9px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
          will-change: transform, opacity;
          position: relative;
        }

        .req-card-item:hover {
          border-color: rgba(229, 9, 20, 0.15);
          box-shadow: 0 14px 30px rgba(229, 9, 20, 0.15);
          transform: translateY(-3px);
        }

        .req-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding-right: 42px;
        }
        .req-menu-trigger {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(20,20,20,0.2);
          border-radius: 8px;
          background: #ffffff;
          color: #111;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 900;
          line-height: 1;
        }
        .req-menu {
          position: absolute;
          top: 44px;
          right: 10px;
          min-width: 170px;
          border: 1px solid rgba(20,20,20,0.16);
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 18px 30px rgba(0,0,0,0.12);
          z-index: 5;
          overflow: hidden;
        }
        .req-menu-item {
          width: 100%;
          border: none;
          background: #fff;
          color: #111;
          text-align: left;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .req-menu-item:hover {
          background: rgba(229, 9, 20, 0.15);
        }
        .req-menu-item.delete {
          color: #b00020;
        }
        .req-modal-ov {
          position: fixed;
          inset: 0;
          z-index: 3000;
          background: rgba(0,0,0,0.35);
          display: grid;
          place-items: center;
          padding: 14px;
        }
        .req-modal {
          width: min(420px, 100%);
          border: 1px solid rgba(20,20,20,0.16);
          border-radius: 14px;
          background: #ffffff;
          padding: 16px;
          box-shadow: 0 24px 44px rgba(0,0,0,0.2);
        }
        .req-modal h3 {
          margin: 0 0 8px;
          font-size: 18px;
          color: #111;
        }
        .req-modal p {
          margin: 0;
          font-size: 13px;
          color: rgba(17,17,17,0.72);
          line-height: 1.45;
        }
        .req-modal-actions {
          margin-top: 14px;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .req-modal-btn {
          border: 1px solid rgba(20,20,20,0.2);
          border-radius: 10px;
          background: #fff;
          color: #111;
          font-size: 12px;
          font-weight: 800;
          padding: 8px 12px;
          cursor: pointer;
          font-family: inherit;
        }
        .req-modal-btn.danger {
          background: #e50914;
          border-color: #111;
        }

        .req-id {
          font-size: 12px;
          font-weight: 800;
          color: rgba(17,17,17,0.56);
          letter-spacing: .8px;
        }

        .req-amb {
          margin-top: 2px;
          font-size: 27px;
          font-weight: 900;
          line-height: 1;
          color: #101010;
          letter-spacing: -0.5px;
        }

        .req-driver {
          font-size: 12px;
          color: rgba(17,17,17,0.72);
          margin-top: 3px;
        }

        .req-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 100px;
          border: 1px solid;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .req-body {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }

        .req-cell {
          border: 1px solid #e50914;
          border-radius: 10px;
          padding: 5px 8px;
          background: #ffffff;
        }

        .req-label {
          font-size: 8px;
          font-weight: 700;
          color: rgba(17,17,17,0.56);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 3px;
        }

        .req-val {
          font-size: 11px;
          color: #121212;
          line-height: 1.25;
          word-break: break-word;
        }

        .req-footer {
          border-top: 1px solid rgba(20,20,20,0.12);
          padding-top: 8px;
        }

        .req-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .req-empty {
          text-align: center;
          padding: 60px;
          color: rgba(17,17,17,0.48);
          font-size: 14px;
          border: 1px dashed rgba(229, 9, 20, 0.15);
          border-radius: 14px;
          background: rgba(229, 9, 20, 0.15);
        }

        @media (max-width: 1023px) {
          .req-root { padding-left: 64px; }
          .req-content { padding: 20px 14px 72px; }
          .req-header h1 { font-size: 38px; }
          .req-grid { grid-template-columns: 1fr; }
          .req-body { grid-template-columns: 1fr 1fr; }
          .req-actions { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 767px) {
          .req-root { padding-left: 0; padding-bottom: 72px; }
          .req-content { padding: 18px 10px 84px; }
          .req-header h1 { font-size: 30px; }
          .req-grid { grid-template-columns: 1fr; gap: 12px; }
          .req-body { grid-template-columns: 1fr; }
          .req-actions { grid-template-columns: 1fr; }
          .req-amb { font-size: 22px; }
        }
      `}</style>

      <div className="req-root" ref={rootRef}>
        <div className="req-content">
          <div className="req-header">
            <div className="req-tag req-head-anim">📋 Management</div>
            <h1 className="req-head-anim">Booking Requests</h1>
            <p className="req-head-anim">All ambulance booking requests are shown as separate request cards</p>
            {location.state?.flashMsg && (
              <div
                style={{
                  marginTop: 10,
                  border: "1px solid rgba(229, 9, 20, 0.15)",
                  background: "rgba(229, 9, 20, 0.15)",
                  color: "#111",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{location.state.flashMsg}</span>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#111",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 700,
                    padding: "0 4px",
                    marginLeft: 10,
                  }}
                  onClick={() => navigate(location.pathname, { replace: true, state: { ...location.state, flashMsg: null } })}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {bookings.length === 0 ? (
            <div className="req-empty">No bookings yet — book an ambulance to see requests here!</div>
          ) : (
            <div className="req-grid">
              {bookings.map((b, i) => {
                const sc = statusColors[b.status] || statusColors.pending;
                return (
                  <motion.article key={b.id} className="req-card-item" whileHover={{ y: -2 }}>
                    <button
                      className="req-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId((prev) => (prev === b.id ? null : b.id));
                      }}
                      title="More actions"
                    >
                      ⋯
                    </button>
                    {menuOpenId === b.id && (
                      <div className="req-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="req-menu-item"
                          onClick={() => {
                            setMenuOpenId(null);
                            navigate(`/cases/${b.id}`);
                          }}
                        >
                          View Full Details
                        </button>
                        <button
                          className="req-menu-item delete"
                          onClick={() => {
                            setMenuOpenId(null);
                            setDeleteTarget(b);
                          }}
                        >
                          Delete Permanently
                        </button>
                      </div>
                    )}
                    <div className="req-card-top">
                      <div>
                        <div className="req-id">
                          REQUEST #{String(i + 1).padStart(2, "0")} · BOOKING #{b.id}
                        </div>
                        <div className="req-amb">🚑 {safeText(b.ambulance_number, Number(b.ambulance_id || 0) > 0 ? "AMB-0000" : "Not Assigned")}</div>
                        <div className="req-driver">Driver: {safeText(b.driver, Number(b.ambulance_id || 0) > 0 ? "Unknown" : "Pending Assignment")} · {safeText(b.driver_contact, "N/A")}</div>
                      </div>
                      <span className="req-pill" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                        {safeText(b.status, "pending")}
                      </span>
                    </div>

                    <div className="req-body">
                      <div className="req-cell">
                        <div className="req-label">Booked By</div>
                        <div className="req-val">{safeText(b.booked_by, "Unknown")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Email</div>
                        <div className="req-val">{safeText(b.booked_by_email, "No email")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Pickup</div>
                        <div className="req-val">📍 {safeText(b.pickup_location, "Not set")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Contact Number</div>
                        <div className="req-val">{safeText(b.patient_contact_number, "Not provided")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Landmark</div>
                        <div className="req-val">{safeText(b.pickup_landmark, "Not provided")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">City / District</div>
                        <div className="req-val">
                          {safeText(b.pickup_city, "-")} / {safeText(b.pickup_district, "-")}
                        </div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Destination</div>
                        <div className="req-val">{safeText(b.assigned_hospital_name || b.destination, "Admin will assign")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Created</div>
                        <div className="req-val">{safeText(b.created_at, "-")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Status</div>
                        <div className="req-val">
                          {safeText(b.status, "pending")}
                          {b.sent_to_driver ? " · sent to driver" : ""}
                          {b.driver_task_completed ? " · task completed" : ""}
                          {b.driver_rejected_once && !b.sent_to_driver ? " · driver can not take booking" : ""}
                        </div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Estimated Bill</div>
                        <div className="req-val">
                          {formatMoney(calculateBookingBill({ booking: b }).total)}
                        </div>
                      </div>
                      {b.driver_rejected_once && !b.sent_to_driver && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#111", background: "#f0f6b6" }}>
                          <div className="req-label">Dispatch Alert</div>
                          <div className="req-val">
                            Driver can not take booking. Please assign another available ambulance.
                          </div>
                        </div>
                      )}
                      <div className="req-cell" style={{ gridColumn: "1 / -1" }}>
                        <div className="req-label">Hospital Workflow</div>
                        <div className="req-val">
                          Assigned: {safeText(b.assigned_hospital_name, "Not assigned")} ·
                          Alert: {b.hospital_alert_sent ? " sent" : " pending"} ·
                          Response: {safeText(b.hospital_response, "pending")}
                          {b.hospital_response_note ? ` (${b.hospital_response_note})` : ""}
                        </div>
                      </div>
                      {b.report_submitted_at && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1" }}>
                          <div className="req-label">Patient Report</div>
                          <div className="req-val">
                            Patient: {safeText(b.patient_name || b.booked_by)} · Age: {safeText(b.patient_age, "-")} · Gender: {safeText(b.patient_gender, "-")}
                            <br />
                            Attendant: {safeText(b.attendant_name, "-")} ({safeText(b.attendant_contact, "-")})
                            <br />
                            Condition: {safeText(b.patient_condition, "-")}
                            <br />
                            Vitals: {safeText(b.vitals_summary, "-")}
                            <br />
                            Report By: {safeText(b.report_submitted_by, "-")}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="req-footer">
                      <ActionButtons b={b} />
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {deleteTarget && (
        <div className="req-modal-ov" onClick={() => setDeleteTarget(null)}>
          <div className="req-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Booking Permanently?</h3>
            <p>
              Booking #{deleteTarget.id} is scheduled for permanent deletion. Once executed, this process cannot be reversed or recovered
            </p>
            <div className="req-modal-actions">
              <button className="req-modal-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button
                className="req-modal-btn danger"
                onClick={() => {
                  deleteBooking(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Requests;
