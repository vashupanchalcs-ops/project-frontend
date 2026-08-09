import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const BASE = "http://127.0.0.1:8000";

export default function HospitalInsuranceView() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/${Number(bookingId || 0)}/`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load insurance details");
      setBooking(data);
      setNote(data.insurance_hospital_note || "");
    } catch (e) {
      setError(e.message || "Unable to load booking.");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [bookingId]);

  const review = async (status) => {
    if (!booking) return;
    if (!hasInsurancePayload) {
      setError("Insurance form submit nahi hua hai. Ambulance team se form bhijwaye.");
      return;
    }
    setLoading(true);
    setMsg("");
    setError("");
    try {
      const hospitalUser = localStorage.getItem("hospital_name") || localStorage.getItem("user") || "Hospital Desk";
      const res = await fetch(`${BASE}/api/bookings/${booking.id}/insurance-review/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurance_status: status,
          insurance_hospital_note: note,
          reviewed_by: hospitalUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Insurance review update failed");
      setBooking(data);
      setNote(data.insurance_hospital_note || note);
      setMsg(status === "approved" ? "Insurance approved successfully." : "Insurance rejected successfully.");
    } catch (e) {
      setError(e.message || "Insurance review failed.");
    } finally {
      setLoading(false);
    }
  };

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

  const hasInsurancePayload = useMemo(() => {
    if (!booking) return false;
    return Boolean(
      booking.insurance_submitted_at ||
      booking.insurance_full_name ||
      booking.insurance_provider ||
      booking.insurance_policy_member_id ||
      booking.insurance_policy_holder_name ||
      booking.insurance_government_id ||
      booking.insurance_sum_insured ||
      booking.insurance_emergency_nature ||
      booking.insurance_exclusions_waiting
    );
  }, [booking]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8ef", padding: "84px 16px 30px 80px", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ border: "1px solid rgba(17,17,17,0.14)", borderRadius: 16, background: "#fff", padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>INSURANCE VERIFICATION</div>
            <h1 style={{ margin: "5px 0 0", fontSize: 30 }}>Booking #{bookingId} Medical Insurance</h1>
          </div>
          <button
            onClick={() => navigate("/hospital/reports")}
            style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 10, background: "#e50914", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            Back To Reports
          </button>
        </div>

        {msg && <div style={{ border: "1px solid rgba(0,170,120,0.4)", borderRadius: 12, background: "rgba(0,212,170,0.12)", padding: 10, marginBottom: 10 }}>{msg}</div>}
        {error && <div style={{ border: "1px solid #d99", background: "#fff3f3", color: "#a00", borderRadius: 12, padding: 10, marginBottom: 10 }}>{error}</div>}

        {booking && (
          <div style={{ border: "1px solid rgba(156,171,0,0.45)", borderRadius: 16, background: "#fffef7", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
              {fields.map(([k, v]) => (
                <div key={k} style={{ border: "1px solid rgba(17,17,17,0.13)", borderRadius: 12, padding: 10, background: "#fff" }}>
                  <div style={{ fontSize: 11, color: "rgba(17,17,17,0.6)", letterSpacing: 0.7, fontWeight: 800 }}>{k}</div>
                  <div style={{ marginTop: 5, fontSize: 14, fontWeight: 700, whiteSpace: "pre-wrap" }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, border: "1px solid rgba(17,17,17,0.14)", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8, marginBottom: 10 }}>
                <div><b>Submitted By:</b> {booking.insurance_submitted_by || "-"}</div>
                <div><b>Submitted At:</b> {booking.insurance_submitted_at ? new Date(booking.insurance_submitted_at).toLocaleString("en-IN") : "-"}</div>
                <div><b>Reviewed By:</b> {booking.insurance_reviewed_by || "-"}</div>
                <div><b>Reviewed At:</b> {booking.insurance_reviewed_at ? new Date(booking.insurance_reviewed_at).toLocaleString("en-IN") : "-"}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Hospital Review Note</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Insurance verification note"
                style={{ width: "100%", minHeight: 90, border: "1px solid rgba(17,17,17,0.16)", borderRadius: 10, padding: 10, fontSize: 14, resize: "vertical" }}
              />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {String(booking.insurance_status || "pending").toLowerCase() !== "approved" && (
                <>
                  <button
                    disabled={loading || !hasInsurancePayload}
                    onClick={() => review("approved")}
                    style={{ border: "1px solid rgba(0,170,120,0.5)", background: "#dbf8eb", color: "#007a52", borderRadius: 10, padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}
                  >
                    {loading ? "Updating..." : "Approve Insurance"}
                  </button>
                  {String(booking.insurance_status || "pending").toLowerCase() !== "rejected" && (
                    <button
                      disabled={loading || !hasInsurancePayload}
                      onClick={() => review("rejected")}
                      style={{ border: "1px solid rgba(208,64,64,0.5)", background: "#ffe9e9", color: "#a61818", borderRadius: 10, padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}
                    >
                      {loading ? "Updating..." : "Reject Insurance"}
                    </button>
                  )}
                </>
              )}
              <span style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 999, padding: "6px 12px", fontWeight: 800, fontSize: 12 }}>
                Status: {String(booking.insurance_status || "pending").toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: "rgba(17,17,17,0.65)" }}>
                {booking.insurance_submitted_at
                  ? `Submitted: ${new Date(booking.insurance_submitted_at).toLocaleString("en-IN")}`
                  : hasInsurancePayload
                    ? "Insurance details received (timestamp missing on old record)."
                    : "Insurance form abhi submit nahi hua."}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
