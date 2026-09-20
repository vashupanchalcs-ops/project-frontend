import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from "lucide-react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

export default function HospitalCaseReportView() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(null);
  const [error, setError] = useState("");
  const invalidBooking = !Number(bookingId || 0);

  useEffect(() => {
    const id = Number(bookingId || 0);
    if (!id) {
      return;
    }
    const load = () => {
      fetch(`${BASE}/api/bookings/${id}/`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Booking not found"))))
        .then(async (data) => {
          setBooking(data);
          const hospitalId = Number(localStorage.getItem("hospital_id") || data.assigned_hospital_id || 0);
          const query = hospitalId ? `role=hospital&hospital_id=${hospitalId}` : "role=admin";
          const photoResponse = await fetch(`${BASE}/api/bookings/${id}/photos/?${query}`, { cache: "no-store" });
          const photoData = await photoResponse.json().catch(() => ({}));
          setPhotos(photoResponse.ok && Array.isArray(photoData.photos) ? photoData.photos : []);
        })
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
    <div className="night-page" style={{ minHeight: "100vh", background: "#f6f8ef", padding: isMobile ? "84px 16px 30px 16px" : "84px 16px 30px 80px", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ border: "1px solid rgba(17,17,17,0.14)", borderRadius: 16, background: "#fff", padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>HOSPITAL CASE REPORT</div>
            <h1 style={{ margin: "5px 0 0", fontSize: 30 }}>Booking #{bookingId} Report</h1>
          </div>
          <button
            onClick={() => navigate("/hospital/reports")}
            style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 10, background: "#ffffff", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
          >
            Back To Case Reports
          </button>
        </div>

        {(error || invalidBooking) && (
          <div style={{ border: "1px solid #d99", background: "#fff3f3", color: "#a00", borderRadius: 12, padding: 10 }}>
            {error || "Invalid booking id."}
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

            <section className="condition-photo-card" style={{ border: "1px solid #c9e0d0", borderRadius: 12, padding: 14, background: "#ffffff", marginBottom: 10, color: "#142019" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 0.8, color: "#587064", fontWeight: 800 }}>PATIENT CONDITION PHOTOS</div>
                  <div style={{ marginTop: 4, fontSize: 13 }}>Images sent by the assigned ambulance driver for this case.</div>
                </div>
                <span style={{ color: "#126f1e", fontWeight: 900, fontSize: 13 }}><ImageIcon size={15} style={{ verticalAlign: "-3px", marginRight: 5 }} />{photos.length} photo(s)</span>
              </div>
              {photos.length === 0 ? <div style={{ border: "1px dashed #bcd4c3", borderRadius: 9, padding: 18, color: "#68776c", fontSize: 13 }}>No condition photos have been received for this booking yet.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(125px,1fr))", gap: 10 }}>
                {photos.map((photo, index) => <button key={photo.id} type="button" onClick={() => setPhotoIndex(index)} style={{ padding: 0, border: "1px solid #c9dcd0", borderRadius: 9, overflow: "hidden", background: "#f5faf6", cursor: "pointer", color: "#142019", textAlign: "left" }}><img src={photo.url} alt={photo.label} style={{ width: "100%", height: 88, objectFit: "cover", display: "block" }} /><span style={{ display: "block", padding: "6px 7px", fontSize: 11, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.label}</span></button>)}
              </div>}
            </section>

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
      {photoIndex !== null && photos[photoIndex] && <div onClick={(event) => { if (event.target === event.currentTarget) setPhotoIndex(null); }} style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(8,20,12,.76)", display: "grid", placeItems: "center", padding: 20 }}>
        <div className="condition-photo-card" style={{ width: "min(900px, 100%)", background: "#fff", borderRadius: 14, padding: 14, position: "relative", color: "#142019" }}>
          <button type="button" onClick={() => setPhotoIndex(null)} style={{ position: "absolute", right: 10, top: 10, border: "1px solid #bfd3c4", borderRadius: "50%", background: "#fff", width: 32, height: 32, cursor: "pointer", color: "#142019" }}><X size={16} /></button>
          <div style={{ fontWeight: 900, fontSize: 18, margin: "2px 42px 12px" }}>{photos[photoIndex].label} · Booking #{bookingId}</div>
          <img src={photos[photoIndex].url} alt={photos[photoIndex].label} style={{ display: "block", width: "100%", maxHeight: "65vh", objectFit: "contain", background: "#f2f6f3", borderRadius: 10 }} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 10, fontSize: 12, color: "#587064" }}><button type="button" disabled={photoIndex <= 0} onClick={() => setPhotoIndex((value) => Math.max(0, value - 1))} style={{ border: "1px solid #bfd3c4", borderRadius: 8, background: "#fff", padding: "8px 12px", color: "#126f1e", fontWeight: 800 }}><ChevronLeft size={14} style={{ verticalAlign: "-3px" }} /> Previous</button><span>{photoIndex + 1} / {photos.length}</span><button type="button" disabled={photoIndex >= photos.length - 1} onClick={() => setPhotoIndex((value) => Math.min(photos.length - 1, value + 1))} style={{ border: "1px solid #bfd3c4", borderRadius: 8, background: "#fff", padding: "8px 12px", color: "#126f1e", fontWeight: 800 }}>Next <ChevronRight size={14} style={{ verticalAlign: "-3px" }} /></button></div>
        </div>
      </div>}
    </div>
  );
}
