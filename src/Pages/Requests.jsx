import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { calculateBookingBill, formatMoney } from "../utils/billing";

gsap.registerPlugin(ScrollTrigger);

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const statusColors = {
  pending: { color: "#111", bg: "#ffffff", border: "#ffffff" },
  confirmed: { color: "#111", bg: "#ffffff", border: "#ffffff" },
  completed: { color: "#111", bg: "#ffffff", border: "#ffffff" },
  cancelled: { color: "#111", bg: "#ffffff", border: "#ffffff" },
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
  const cachedBookings = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("admin_requests_cache") || "[]");
    } catch {
      return [];
    }
  })();
  const [bookings, setBookings] = useState(cachedBookings);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingActions, setPendingActions] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  // React state updates are asynchronous. Keep a synchronous lock as well so
  // two clicks in the same event loop cannot create duplicate PATCH requests.
  const pendingActionsRef = useRef(new Map());

  const fetchBookings = () => {
    fetch(`${BASE}/api/bookings/`)
      .then((r) => r.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        list.sort((a, b) => {
          const aId = Number(a?.id || 0);
          const bId = Number(b?.id || 0);
          return bId - aId;
        });
        const visibleList = list.map((row) => {
          const pendingPayload = pendingActionsRef.current.get(Number(row?.id));
          return pendingPayload ? { ...row, ...pendingPayload } : row;
        });
        setBookings(visibleList);
        try { sessionStorage.setItem("admin_requests_cache", JSON.stringify(visibleList)); } catch {}
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
      gsap.set(".req-head-anim", { y: 0, opacity: 1, clearProps: "all" });
      gsap.set(".req-card-item", { y: 0, opacity: 1, clearProps: "all" });
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

  const updateBooking = async (id, payload) => {
    const bid = Number(id);
    if (!bid || pendingActionsRef.current.has(bid)) return null;
    pendingActionsRef.current.set(bid, payload);
    setPendingActions((prev) => ({ ...prev, [bid]: true }));

    // 1. Optimistic instant UI update in 0ms so card status turns Confirmed immediately
    setBookings((prev) => prev.map((row) => (Number(row.id) === bid ? { ...row, ...payload } : row)));
    try {
      const cached = JSON.parse(sessionStorage.getItem("admin_requests_cache") || "[]");
      sessionStorage.setItem("admin_requests_cache", JSON.stringify(
        cached.map((row) => Number(row.id) === bid ? { ...row, ...payload } : row)
      ));
    } catch {}

    // 2. Background patch
    try {
      const res = await fetch(`${BASE}/api/bookings/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Booking update failed");
      setBookings((prev) => prev.map((row) => (Number(row.id) === bid ? { ...row, ...data } : row)));
      try {
        const cached = JSON.parse(sessionStorage.getItem("admin_requests_cache") || "[]");
        sessionStorage.setItem("admin_requests_cache", JSON.stringify(
          cached.map((row) => Number(row.id) === bid ? { ...row, ...data } : row)
        ));
      } catch {}
      return data;
    } catch (err) {
      console.warn("Booking update background error:", err);
      fetchBookings();
      throw err;
    } finally {
      pendingActionsRef.current.delete(bid);
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[bid];
        return next;
      });
    }
  };

  const updateStatus = (id, status) => updateBooking(id, { status });

  const forwardReportToHospital = async (booking) => {
    const id = Number(booking?.id || 0);
    if (!id || !booking?.assigned_hospital_name) return;
    if (pendingActionsRef.current.has(id)) return;
    const sentAt = new Date().toISOString();
    setBookings((prev) =>
      prev.map((row) =>
        Number(row.id) === id
          ? { ...row, report_sent_to_hospital: true, report_sent_to_hospital_at: sentAt }
          : row
      )
    );
    try {
      await updateBooking(id, { send_report_to_hospital: true });
    } catch {
      fetchBookings();
    }
  };

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
    const bid = Number(id);
    // Instant 0ms optimistic removal from state and cache
    setBookings((prev) => prev.filter((row) => Number(row.id) !== bid));
    try {
      const cached = JSON.parse(sessionStorage.getItem("admin_requests_cache") || "[]");
      sessionStorage.setItem("admin_requests_cache", JSON.stringify(cached.filter((r) => Number(r.id) !== bid)));
    } catch {}
    fetch(`${BASE}/api/bookings/${id}/`, { method: "DELETE" }).catch(() => fetchBookings());
  };

  const ActionButtons = ({ b }) => {
    const actionPending = Boolean(pendingActions[Number(b.id)]);
    const btnStyle = {
      flex: 1,
      fontSize: 11,
      fontWeight: 700,
      padding: "8px 10px",
      borderRadius: 10,
      border: "1px solid rgba(255, 255, 255, 0.15)",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "center",
      background: "#ffffff",
      color: "#111",
      minWidth: "110px",
      width: "100%",
    };

    return (
      <div className="req-actions">
        {b.status === "pending" && (
          <>
            {b.is_user_selected_hospital && (
              <button
                className="req-action req-confirm"
                style={{ ...btnStyle, background: "#126f1e", color: "#fff", borderColor: "#126f1e" }}
                disabled={actionPending}
                onClick={() => updateBooking(b.id, { status: "confirmed", send_hospital_alert: true })}
                title="Confirm booking and immediately send alert to user's selected hospital"
              >
                {actionPending ? "Saving..." : `✓ Confirm & Send to ${b.assigned_hospital_name || "Hospital"}`}
              </button>
            )}
            <button className="req-action req-confirm" style={btnStyle} disabled={actionPending} onClick={() => updateStatus(b.id, "confirmed")}>{actionPending ? "Saving..." : "✓ Confirm"}</button>
            <button className="req-action req-cancel" style={btnStyle} disabled={actionPending} onClick={() => updateStatus(b.id, "cancelled")}>{actionPending ? "Saving..." : "✕ Cancel"}</button>
          </>
        )}

        {b.transfer_requested && b.transfer_status === "pending" && (
          <>
            <button
              className="req-action req-confirm"
              style={{
                ...btnStyle,
                background: "#126f1e",
                color: "#ffffff",
                borderColor: "#126f1e",
                fontWeight: 900,
              }}
              disabled={actionPending}
              onClick={() =>
                updateBooking(b.id, {
                  approve_ambulance_transfer: true,
                  target_ambulance_id: b.transfer_target_ambulance_id,
                })
              }
              title={`Approve transfer and immediately switch booking to ${b.transfer_target_ambulance_number}`}
            >
              ✓ Switch booking to this ambulance ({b.transfer_target_ambulance_number})
            </button>
            <button
              className="req-action req-cancel"
              style={{
                ...btnStyle,
                background: "#ffffff",
                color: "#c92828",
                borderColor: "#c92828",
                fontWeight: 800,
              }}
              disabled={actionPending}
              onClick={() =>
                updateBooking(b.id, {
                  reject_ambulance_transfer: true,
                })
              }
              title="Reject the driver's chosen ambulance to manually assign an alternate ambulance"
            >
              ✕ Reject Transfer (Assign Alternate)
            </button>
          </>
        )}

        {b.transfer_status === "rejected" && !b.transferred_to_ambulance_number && (
          <button
            className="req-action req-assign"
            style={{
              ...btnStyle,
              background: "#f59a23",
              color: "#111111",
              borderColor: "#111111",
              fontWeight: 900,
            }}
            disabled={actionPending}
            onClick={() => openAmbulanceReassign(b.id)}
          >
            🚑 Assign Another Ambulance (Proximity / ETA)
          </button>
        )}

        {b.status === "confirmed" && !b.sent_to_driver && (
          <>
            <button className="req-action req-assign" style={btnStyle} disabled={actionPending} onClick={() => openAmbulanceAssign(b.id)}>
              {Number(b.ambulance_id || 0) > 0 ? "Reassign Ambulance" : "Assign Nearest Ambulance"}
            </button>
            {b.driver_rejected_once && (
              <button className="req-action req-assign" style={btnStyle} disabled={actionPending} onClick={() => openAmbulanceReassign(b.id)}>
                Assign Another Ambulance
              </button>
            )}
            {Number(b.ambulance_id || 0) > 0 && b.assigned_hospital_name && b.hospital_response === "ready" && (
              <button
                className="req-action req-assign"
                style={btnStyle}
                disabled={actionPending}
                onClick={() => updateBooking(b.id, { send_to_driver: true })}
              >
                {actionPending ? "Saving..." : "Send To Driver"}
              </button>
            )}
            {!(Number(b.ambulance_id || 0) > 0 && b.assigned_hospital_name && b.hospital_response === "ready") && (
              <div
                className="req-action req-waiting"
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
                  : b.hospital_response === "not_ready"
                  ? "Hospital Rejected (Unavailable)"
                  : !b.hospital_alert_sent
                  ? `Send to ${b.assigned_hospital_name || "Hospital"} First`
                  : b.assigned_hospital_name
                  ? "Waiting Hospital Approval"
                  : "Assign Hospital First"}
              </div>
            )}
            <button className="req-action req-cancel" style={btnStyle} disabled={actionPending} onClick={() => updateStatus(b.id, "cancelled")}>{actionPending ? "Saving..." : "✕ Cancel"}</button>
          </>
        )}

        {b.status === "confirmed" && (
          <>
            {b.is_user_selected_hospital ? (
              !b.hospital_alert_sent && b.hospital_response !== "ready" ? (
                <button
                  className="req-action req-assign"
                  style={{ ...btnStyle, background: "#126f1e", color: "#ffffff", borderColor: "#126f1e", fontWeight: 800 }}
                  disabled={actionPending}
                  onClick={() => updateBooking(b.id, { send_hospital_alert: true })}
                >
                  {actionPending ? "Sending..." : `📤 Send to ${b.assigned_hospital_name || "Hospital"}`}
                </button>
              ) : b.hospital_response === "not_ready" ? (
                <div
                  className="req-action req-waiting"
                  style={{ ...btnStyle, background: "#fff1f0", borderColor: "#ffa39e", color: "#cf1322", cursor: "default" }}
                  title="Hospital rejected. Patient has been notified to choose another hospital."
                >
                  ❌ {b.assigned_hospital_name} Rejected (Waiting User)
                </div>
              ) : b.hospital_response === "ready" ? (
                <div
                  className="req-action req-waiting"
                  style={{ ...btnStyle, background: "#f6ffed", borderColor: "#b7eb8f", color: "#389e0d", cursor: "default" }}
                >
                  ✅ {b.assigned_hospital_name} Approved
                </div>
              ) : (
                <div
                  className="req-action req-waiting"
                  style={{ ...btnStyle, background: "#fffbe6", borderColor: "#ffe58f", color: "#d48806", cursor: "default" }}
                >
                  ⏳ Sent to {b.assigned_hospital_name} (Waiting Response)
                </div>
              )
            ) : (
              <button className="req-action req-assign" style={btnStyle} disabled={actionPending} onClick={() => openHospitalAssign(b.id)}>
                {b.assigned_hospital_name ? "Reassign Hospital" : "Assign Hospital"}
              </button>
            )}
          </>
        )}

        {b.report_submitted_at && !b.report_sent_to_hospital && (
          <button
            className="req-action req-assign"
            style={{
              ...btnStyle,
              opacity: b.assigned_hospital_name ? 1 : 0.6,
              cursor: b.assigned_hospital_name ? "pointer" : "not-allowed",
            }}
            disabled={!b.assigned_hospital_name}
            onClick={() => forwardReportToHospital(b)}
          >
            {actionPending ? "Sending..." : "Send Report To Hospital"}
          </button>
        )}

        {b.report_sent_to_hospital && (
          <button className="req-action req-waiting" style={{ ...btnStyle, background: "#fffbd6" }} disabled>
            Report sent to hospital
          </button>
        )}

        {b.status === "confirmed" && b.sent_to_driver && (
          <button
            className="req-action req-waiting"
            style={{
              ...btnStyle,
              background: b.driver_accepted ? "#dcfce7" : "#fffbd6",
              color: b.driver_accepted ? "#166534" : "#854d0e",
              borderColor: b.driver_accepted ? "#86efac" : "#fef08a",
              fontWeight: 700,
            }}
            disabled
          >
            {b.driver_task_completed
              ? "Task Completed by Driver"
              : b.driver_accepted
                ? "✅ Booking accepted by driver"
                : "Dispatched to Driver (Awaiting Acceptance)"}
          </button>
        )}
        {b.status === "confirmed" && b.sent_to_driver && !b.driver_rejected_once && (
          <button
            className="req-action req-assign"
            style={{ ...btnStyle, background: "#111", color: "#fff", borderColor: "#111" }}
            onClick={() => navigate("/LiveMap", { state: { openRouteManager: true, bookingId: b.id, ambulanceId: b.ambulance_id } })}
          >
            🗺 Live Track + Route Manager
          </button>
        )}

        {b.status === "completed" && b.driver_task_completed && (
          <button className="req-action req-waiting" style={{ ...btnStyle, background: "#fffbd6" }} disabled>Task Completed by Driver</button>
        )}

        {(b.status === "completed" || b.status === "cancelled") && (
          <button className="req-action req-cancel" style={btnStyle} onClick={() => deleteBooking(b.id)}>🗑 Delete</button>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .req-root {
          background:
            radial-gradient(920px 430px at 88% 8%, rgba(255, 255, 255, 0.15), transparent 72%),
            radial-gradient(840px 380px at 10% -4%, rgba(255, 255, 255, 0.15), transparent 70%),
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
          margin: 0;
          max-width: none;
          padding: 28px 24px 72px;
          box-sizing: border-box;
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
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.15);
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
          gap: 20px;
          align-items: start;
        }

        .req-card-item {
          background: #f4fbf6;
          border: 1px solid #cfe2d4;
          border-radius: 18px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease;
          will-change: transform, opacity;
          position: relative;
        }

        .req-card-item:hover {
          border-color: #9fc9aa;
          box-shadow: 0 8px 24px rgba(31,82,48,.08);
          transform: translateY(-2px);
        }

        .req-card-top {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: 2px 42px 16px 2px;
          border-bottom: 1px solid #d7e6db;
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
          background: rgba(255, 255, 255, 0.15);
        }
        .req-menu-item.delete {
          color: #ffffff;
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
          background: #ffffff;
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
          gap: 12px;
          padding-top: 16px;
        }

        .req-cell {
          border: 1px solid #d7e6db;
          border-radius: 10px;
          padding: 11px 12px;
          min-height: 58px;
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

        .req-section-label { grid-column: 1 / -1; margin-top: 4px; color: #126f1e; font-size: 10px; font-weight: 900; letter-spacing: .9px; text-transform: uppercase; }
        .req-footer { margin-top: 16px; border-top: 1px solid #cfe2d4; padding-top: 16px; }

        .req-actions {
          display: flex;
          align-items: stretch;
          flex-wrap: wrap;
          gap: 10px;
        }

        .req-empty {
          text-align: center;
          padding: 60px;
          color: rgba(17,17,17,0.48);
          font-size: 14px;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.15);
        }

        @media (max-width: 1023px) {
          .req-root { padding-left: 64px; }
          .req-content { padding: 20px 14px 72px; }
          .req-header h1 { font-size: 38px; }
          .req-grid { grid-template-columns: 1fr; }
          .req-body { grid-template-columns: 1fr 1fr; }
          .req-actions { flex-direction: column; }
        }

        @media (max-width: 767px) {
          .req-root { padding-left: 0; padding-bottom: 72px; }
          .req-content { padding: 18px 10px 84px; }
          .req-header h1 { font-size: 30px; }
          .req-grid { grid-template-columns: 1fr; gap: 12px; }
          .req-body { grid-template-columns: 1fr; }
          .req-actions { flex-direction: column; }
          .req-amb { font-size: 22px; }
        }

        /* Each booking stays in one structured, full-width operations card. */
        .req-grid { gap: 20px; }
        .req-card-item,
        .req-card-item:hover {
          background: #f4fbf6;
          border: 1px solid #cfe2d4;
          box-shadow: none;
          transform: none;
        }
        .req-card-item:hover { background: #f4fbf6; border-color: #9fc9aa; }
        .req-body { gap: 12px; }
        .req-cell { border-color: #d7e6db; padding: 11px 12px; }
        .req-footer { border-top-color: #cfe2d4; padding-top: 16px; }
        .req-actions { gap: 10px; }
        .req-action {
          border-color: #126f1e !important;
          background: #ffffff !important;
          color: #111111 !important;
          box-shadow: none !important;
          transition: background .15s ease, border-color .15s ease, color .15s ease !important;
        }
        .req-action:hover:not(:disabled) { background: #126f1e !important; border-color: #126f1e !important; color: #ffffff !important; }
        .req-action.req-confirm { background: #126f1e !important; border-color: #126f1e !important; color: #ffffff !important; }
        .req-action.req-confirm:hover { background: #f59a23 !important; border-color: #f59a23 !important; color: #111111 !important; }
        .req-action.req-assign:hover { background: #f59a23 !important; border-color: #f59a23 !important; color: #111111 !important; }
        .req-action.req-cancel { border-color: #c92828 !important; color: #c92828 !important; }
        .req-action.req-cancel:hover { background: #c92828 !important; border-color: #c92828 !important; color: #ffffff !important; }
        .req-action.req-waiting { background: #fff3df !important; border-color: #f59a23 !important; color: #111111 !important; }
        /* Center each request and apply yellow actions consistently. */
        html body #root#root .req-content { width: 100% !important; max-width: none !important; margin: 0 !important; box-sizing: border-box !important; }
        html body #root#root .req-card-item,
        html body #root#root .req-card-item:hover { background: #f4fbf6 !important; border-color: #cfe2d4 !important; border-radius: 18px !important; box-shadow: none !important; transform: none !important; }
        html body #root#root .req-cell { background: #ffffff !important; border-color: #f59a23 !important; }
        html body #root#root .req-action.req-confirm,
        html body #root#root .req-action.req-confirm:hover,
        html body #root#root .req-action.req-cancel,
        html body #root#root .req-action.req-cancel:hover {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
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
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  background: "rgba(255, 255, 255, 0.15)",
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
                  <article key={b.id} className="req-card-item">
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
                        <div className="req-val">
                          {safeText(b.assigned_hospital_name || b.destination, "Admin will assign")}
                          {b.is_user_selected_hospital && (
                            <span style={{ display: "inline-block", marginLeft: 6, padding: "2px 6px", borderRadius: 6, background: "#e3f2fd", color: "#1565c0", fontSize: 9, fontWeight: 800 }}>
                              👤 User Choice
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Created</div>
                        <div className="req-val">{safeText(b.created_at, "-")}</div>
                      </div>
                      <div className="req-cell">
                        <div className="req-label">Status</div>
                        <div className="req-val">
                          {safeText(b.status, "pending")}
                          {b.driver_accepted ? " · booking accepted by driver" : b.sent_to_driver ? " · sent to driver" : ""}
                          {b.patient_reached ? " · patient reached" : ""}
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
                      <div className="req-section-label">Live workflow & operational updates</div>
                      {b.assigned_doctor_names && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#86efac", background: "#f0fdf4" }}>
                          <div className="req-label" style={{ color: "#166534", fontWeight: 800 }}>
                            👨‍⚕️ Assigned Hospital Doctor(s)
                          </div>
                          <div className="req-val" style={{ color: "#14532d", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                            {b.assigned_doctor_names} {b.assigned_doctor_specializations && `(${b.assigned_doctor_specializations})`}
                            {b.assigned_doctor_contacts && <span style={{ color: "#15803d", marginLeft: 8, fontSize: 12 }}>📞 {b.assigned_doctor_contacts}</span>}
                          </div>
                        </div>
                      )}
                      {b.transfer_requested && b.transfer_status === "pending" && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#f59a23", background: "#fffbe6" }}>
                          <div className="req-label" style={{ color: "#d48806", fontWeight: 900 }}>
                            🚨 EMERGENCY AMBULANCE CHANGE REQUESTED BY DRIVER
                          </div>
                          <div className="req-val" style={{ color: "#111", fontWeight: 700, fontSize: 12, marginTop: 4 }}>
                            Driver reported that ambulance <strong>{b.transfer_from_ambulance_number || b.ambulance_number}</strong> ({b.driver}) cannot continue transport.
                            <br />
                            Driver selected nearest ambulance: <strong style={{ color: "#b45309" }}>{b.transfer_target_ambulance_number}</strong>
                            <br />
                            <span style={{ fontSize: 11, color: "#666" }}>
                              Click <strong>"Switch booking to this ambulance"</strong> to approve, or <strong>"✕ Reject Transfer"</strong> to manually assign another ambulance.
                            </span>
                          </div>
                        </div>
                      )}

                      {b.transfer_status === "rejected" && !b.transferred_to_ambulance_number && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#ffa39e", background: "#fff1f0" }}>
                          <div className="req-label" style={{ color: "#cf1322", fontWeight: 900 }}>
                            ❌ TRANSFER REJECTED BY ADMIN
                          </div>
                          <div className="req-val" style={{ color: "#cf1322", fontWeight: 700, fontSize: 12 }}>
                            Transfer to {b.transfer_target_ambulance_number} was rejected. Click "Assign Another Ambulance" above to assign based on proximity/ETA.
                          </div>
                        </div>
                      )}

                      {b.transferred_to_ambulance_number && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#86efac", background: "#f0fdf4" }}>
                          <div className="req-label" style={{ color: "#166534", fontWeight: 900 }}>
                            🔄 AMBULANCE TRANSFERRED
                          </div>
                          <div className="req-val" style={{ color: "#166534", fontWeight: 700, fontSize: 12 }}>
                            Booking transferred from <strong>{b.transfer_from_ambulance_number || "original ambulance"}</strong> to <strong>{b.transferred_to_ambulance_number || b.ambulance_number}</strong> (Driver: {b.driver}).
                            {b.driver_accepted ? " · ✅ Booking accepted by new driver." : " · ⏳ Dispatched to new driver."}
                          </div>
                        </div>
                      )}

                      {b.driver_rejected_once && !b.sent_to_driver && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#111", background: "#f0f6b6" }}>
                          <div className="req-label">Dispatch Alert</div>
                          <div className="req-val">
                            Driver can not take booking. Please assign another available ambulance.
                          </div>
                        </div>
                      )}
                      {b.is_user_selected_hospital && !b.hospital_alert_sent && b.hospital_response !== "ready" && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#126f1e", background: "#f0fdf4" }}>
                          <div className="req-label" style={{ color: "#166534" }}>👤 User-Selected Hospital</div>
                          <div className="req-val" style={{ color: "#166534", fontWeight: 700 }}>
                            User booked specifically for <strong>{b.assigned_hospital_name || b.destination}</strong>. Admin does not need to choose a hospital — click "Send to {b.assigned_hospital_name || 'Hospital'}" above.
                          </div>
                        </div>
                      )}
                      {b.hospital_response === "not_ready" && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#ffa39e", background: "#fff1f0" }}>
                          <div className="req-label" style={{ color: "#cf1322" }}>❌ Hospital Rejected (Unavailable)</div>
                          <div className="req-val" style={{ color: "#cf1322", fontWeight: 700 }}>
                            {b.assigned_hospital_name || "Hospital"} is currently unavailable ({b.hospital_response_note || "No beds/staff"}). User has been asked to choose another hospital.
                          </div>
                        </div>
                      )}
                      <div className="req-cell" style={{ gridColumn: "1 / -1" }}>
                        <div className="req-label">Hospital Workflow</div>
                        <div className="req-val">
                          {b.is_user_selected_hospital && (
                            <strong style={{ color: "#1565c0", marginRight: 6 }}>[User Choice]</strong>
                          )}
                          Assigned: {safeText(b.assigned_hospital_name, "Not assigned")} ·
                          Alert: {b.hospital_alert_sent ? " sent" : " pending"} ·
                          Response: {safeText(b.hospital_response, "pending")}
                          {b.hospital_response_note ? ` (${b.hospital_response_note})` : ""}
                        </div>
                      </div>
                      <div className="req-cell" style={{ gridColumn: "1 / -1" }}>
                        <div className="req-label">Driver Response</div>
                        <div className="req-val">
                          {b.driver_accepted ? (
                            <strong style={{ color: "#166534" }}>✅ Booking accepted by driver</strong>
                          ) : b.driver_rejected_once && !b.sent_to_driver ? (
                            <strong style={{ color: "#cf1322" }}>❌ Driver rejected / cancelled dispatch</strong>
                          ) : b.sent_to_driver ? (
                            <span style={{ color: "#b45309" }}>⏳ Dispatched (Awaiting Driver Acceptance)</span>
                          ) : (
                            <span style={{ color: "#888" }}>Pending dispatch to driver</span>
                          )}
                          {b.patient_reached && (
                            <span style={{ marginLeft: 8, color: "#166534", fontWeight: 700 }}>
                              · 🏥 Patient Reached Hospital
                            </span>
                          )}
                        </div>
                      </div>
                      {b.driver_accepted && (
                        <div className="req-cell" style={{ gridColumn: "1 / -1", borderColor: "#86efac", background: "#f0fdf4" }}>
                          <div className="req-label" style={{ color: "#166534" }}>✅ Driver Status</div>
                          <div className="req-val" style={{ color: "#166534", fontWeight: 700 }}>
                            Booking accepted by driver {b.driver_name ? `(${b.driver_name})` : ""}. Ambulance is en route.
                            {b.patient_reached ? " · 🏥 Patient reached hospital." : ""}
                          </div>
                        </div>
                      )}
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
                  </article>
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
