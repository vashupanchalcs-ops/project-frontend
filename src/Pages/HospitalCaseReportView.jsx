import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const BASE = "http://127.0.0.1:8000";

export default function HospitalCaseReportView() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = Number(bookingId || 0);
    if (!id) {
      setError("Invalid booking id.");
      return;
    }
    const load = () => {
      fetch(`${BASE}/api/bookings/${id}/`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Booking not found"))))
        .then((data) => setBooking(data))
        .catch((e) => setError(e.message || "Unable to load report."));
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [bookingId]);

  const reportText = useMemo(() => {
    if (!booking) return "";
    return (
      booking.driver_modified_report ||
      booking.vitals_summary ||
      booking.patient_condition ||
      "No detailed report available for this case yet."
    );
  }, [booking]);
  const hasAnyClinicalDetails = useMemo(() => {
    if (!booking) return false;
    return Boolean(
      booking.patient_condition ||
      booking.vitals_summary ||
      booking.driver_modified_report ||
      booking.driver_voice_transcript
    );
  }, [booking]);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8ef", padding: isMobile ? "84px 16px 30px 16px" : "84px 16px 30px 80px", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ border: "1px solid rgba(17,17,17,0.14)", borderRadius: 16, background: "#fff", padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>HOSPITAL CASE REPORT</div>
            <h1 style={{ margin: "5px 0 0", fontSize: 30 }}>Booking #{bookingId} Report</h1>
          </div>
          <button
            onClick={() => navigate("/hospital/reports")}
            style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 10, background: "#d6e800", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            Back To Case Reports
          </button>
        </div>

        {error && (
          <div style={{ border: "1px solid #d99", background: "#fff3f3", color: "#a00", borderRadius: 12, padding: 10 }}>
            {error}
          </div>
        )}

        {booking && (
          <div style={{ border: "1px solid rgba(156,171,0,0.45)", borderRadius: 16, background: "#fffef7", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginBottom: 12 }}>
              <div><b>Patient:</b> {booking.patient_name || booking.booked_by || "-"}</div>
              <div><b>Pickup:</b> {booking.pickup_location || "-"}</div>
              <div><b>Ambulance:</b> {booking.ambulance_number || "-"}</div>
              <div><b>Driver:</b> {booking.driver || "-"}</div>
              <div><b>Submitted By:</b> {booking.report_submitted_by || "-"}</div>
              <div><b>Submitted At:</b> {booking.report_submitted_at ? new Date(booking.report_submitted_at).toLocaleString("en-IN") : "-"}</div>
            </div>

            <div style={{ border: "1px solid rgba(17,17,17,0.14)", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 10 }}>
              <div style={{ fontSize: 12, letterSpacing: 0.8, color: "rgba(17,17,17,0.65)", fontWeight: 800, marginBottom: 6 }}>MODIFIED REPORT</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, lineHeight: 1.55, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>{reportText}</pre>
            </div>

            {hasAnyClinicalDetails && (
              <div style={{ border: "1px solid rgba(17,17,17,0.14)", borderRadius: 12, padding: 14, background: "#fff", marginBottom: 10 }}>
                <div style={{ fontSize: 12, letterSpacing: 0.8, color: "rgba(17,17,17,0.65)", fontWeight: 800, marginBottom: 8 }}>
                  CLINICAL BREAKDOWN (EXACT DRIVER SUBMISSION)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
                  <div style={{ border: "1px solid rgba(17,17,17,0.1)", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 11, letterSpacing: 0.6, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>PATIENT CONDITION</div>
                    <div style={{ marginTop: 5, whiteSpace: "pre-wrap", fontSize: 13 }}>{booking.patient_condition || "-"}</div>
                  </div>
                  <div style={{ border: "1px solid rgba(17,17,17,0.1)", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 11, letterSpacing: 0.6, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>VITALS SUMMARY</div>
                    <div style={{ marginTop: 5, whiteSpace: "pre-wrap", fontSize: 13 }}>{booking.vitals_summary || "-"}</div>
                  </div>
                  <div style={{ border: "1px solid rgba(17,17,17,0.1)", borderRadius: 10, padding: 10, gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, letterSpacing: 0.6, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>AI MODIFIED DRIVER REPORT</div>
                    <div style={{ marginTop: 5, whiteSpace: "pre-wrap", fontSize: 13 }}>{booking.driver_modified_report || "-"}</div>
                  </div>
                </div>
              </div>
            )}

            {booking.driver_voice_transcript && (
              <details style={{ border: "1px solid rgba(17,17,17,0.12)", borderRadius: 12, padding: 14, background: "#fff" }}>
                <summary style={{ fontSize: 12, letterSpacing: 0.8, color: "rgba(17,17,17,0.65)", fontWeight: 800, cursor: "pointer" }}>
                  Voice Transcript (Raw)
                </summary>
                <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>{booking.driver_voice_transcript}</div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
