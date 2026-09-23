import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const readCachedBooking = (bookingId) => {
  const read = (key, fallback) => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || "null");
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };

  try {
    const portal = JSON.parse(sessionStorage.getItem("hospital_portal_cache") || "null");
    const portalBooking = Array.isArray(portal?.queue)
      ? portal.queue.find((item) => Number(item?.booking_id || item?.id) === Number(bookingId))
      : null;
    if (portalBooking) return portalBooking;
  } catch {}

  const sources = [
    read("hospital_responses_cache", []),
    read("my_bookings_cache", []),
    read("admin_requests_cache", []),
  ];
  return sources.flat().find((item) => Number(item?.booking_id || item?.id) === Number(bookingId)) || null;
};

const displayDate = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("en-IN");
};

export default function HospitalInsuranceView() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const cachedBooking = useMemo(() => readCachedBooking(Number(bookingId || 0)), [bookingId]);
  const [booking, setBooking] = useState(cachedBooking);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${BASE}/api/bookings/${Number(bookingId || 0)}/?_=${Date.now()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load insurance details");
        if (mounted) {
          setBooking(data);
          setError("");
        }
      } catch (requestError) {
        if (mounted && !booking) setError(requestError?.message || "Unable to load booking.");
      }
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [bookingId]);

  const fields = useMemo(() => {
    if (!booking) return [];
    return [
      ["Full Name", booking.insurance_full_name || booking.patient_name || booking.booked_by || "-"],
      ["Date of Birth", booking.insurance_dob || "-"],
      ["Gender", booking.insurance_gender || "-"],
      ["Insurance Provider", booking.insurance_provider || "-"],
      ["Policy / Member ID", booking.insurance_policy_member_id || "-"],
      ["Policy Holder Name", booking.insurance_policy_holder_name || "-"],
      ["Government ID", booking.insurance_government_id || "-"],
      ["Sum Insured", booking.insurance_sum_insured || "-"],
      ["Emergency Nature", booking.insurance_emergency_nature || "-"],
      ["Exclusions / Waiting Period", booking.insurance_exclusions_waiting || "-"],
    ];
  }, [booking]);

  const insuranceStatus = String(booking?.insurance_status || "pending").toLowerCase();

  return (
    <div className="hospital-insurance-page" style={{ minHeight: "100vh", background: "#f6f8ef", padding: "84px 16px 30px 80px", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ border: "1px solid #dbe4dc", borderRadius: 16, background: "#fff", padding: 18, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "#475569", fontWeight: 800 }}>PATIENT INSURANCE</div>
            <h1 style={{ margin: "5px 0 0", fontSize: 30 }}>Booking #{bookingId} Medical Insurance</h1>
            <div style={{ marginTop: 5, color: "#64748b", fontSize: 13 }}>Read-only insurance values shared by the ambulance team.</div>
          </div>
          <button
            onClick={() => navigate("/hospital/reports")}
            style={{ border: "1px solid #cbd5e1", borderRadius: 10, background: "#fff", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            Back To Reports
          </button>
        </div>

        {error && <div style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", borderRadius: 12, padding: 11, marginBottom: 12 }}>{error}</div>}

        {!booking ? (
          <div style={{ border: "1px dashed #cbd5e1", borderRadius: 16, background: "#fff", padding: 34, textAlign: "center", color: "#64748b" }}>Loading insurance details…</div>
        ) : (
          <div style={{ border: "1px solid #c9ded0", borderRadius: 16, background: "#fffef7", padding: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
              {fields.map(([label, value]) => (
                <div key={label} style={{ border: "1px solid #dbe4dc", borderRadius: 12, padding: 12, background: "#fff", minHeight: 76 }}>
                  <div style={{ fontSize: 11, color: "#475569", letterSpacing: 0.7, fontWeight: 800 }}>{label}</div>
                  <div style={{ marginTop: 7, fontSize: 14, fontWeight: 700, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, border: "1px solid #dbe4dc", borderRadius: 12, padding: 14, background: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, color: "#334155", fontSize: 13 }}>
                <div><b>Submitted By:</b> {booking.insurance_submitted_by || "-"}</div>
                <div><b>Submitted At:</b> {displayDate(booking.insurance_submitted_at)}</div>
                <div><b>Reviewed By:</b> {booking.insurance_reviewed_by || "-"}</div>
                <div><b>Reviewed At:</b> {displayDate(booking.insurance_reviewed_at)}</div>
              </div>
              {booking.insurance_hospital_note && (
                <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 11, color: "#334155", fontSize: 13 }}>
                  <b>Hospital Review Note:</b> <span style={{ whiteSpace: "pre-wrap" }}>{booking.insurance_hospital_note}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "7px 13px", fontWeight: 800, fontSize: 12, background: insuranceStatus === "approved" ? "#dcfce7" : insuranceStatus === "rejected" ? "#fee2e2" : "#fef3c7", color: insuranceStatus === "approved" ? "#166534" : insuranceStatus === "rejected" ? "#991b1b" : "#92400e" }}>
                Status: {insuranceStatus.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {booking.insurance_submitted_at ? `Submitted: ${displayDate(booking.insurance_submitted_at)}` : "Insurance form not submitted yet."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
