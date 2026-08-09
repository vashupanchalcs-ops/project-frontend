import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ambulance, Building2, FileText, IndianRupee, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { calculateBookingBill, formatDateTime, formatMoney } from "../utils/billing";

const BASE = "http://127.0.0.1:8000";

const safe = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const findHospital = (booking, hospitals) => {
  if (!booking || !Array.isArray(hospitals)) return null;
  return (
    hospitals.find((h) => Number(h.id) === Number(booking.assigned_hospital_id)) ||
    hospitals.find((h) => String(h.name || "").toLowerCase() === String(booking.assigned_hospital_name || "").toLowerCase()) ||
    null
  );
};

const Section = ({ icon: Icon, title, children }) => (
  <section className="cd-section">
    <div className="cd-section-title">
      <Icon size={17} />
      <span>{title}</span>
    </div>
    {children}
  </section>
);

const Field = ({ label, value, wide = false }) => (
  <div className={`cd-field ${wide ? "wide" : ""}`}>
    <div className="cd-label">{label}</div>
    <div className="cd-value">{safe(value)}</div>
  </div>
);

export default function CaseDetails() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [ambulance, setAmbulance] = useState(null);
  const [hospital, setHospital] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const [bookingsRes, ambRes, hospRes] = await Promise.all([
          fetch(`${BASE}/api/bookings/`),
          fetch(`${BASE}/api/ambulances/`),
          fetch(`${BASE}/api/hospitals/`),
        ]);
        const [bookings, ambulances, hospitals] = await Promise.all([
          bookingsRes.json(),
          ambRes.json(),
          hospRes.json(),
        ]);
        if (ignore) return;
        const row = (Array.isArray(bookings) ? bookings : []).find((b) => Number(b.id) === Number(bookingId));
        const amb = (Array.isArray(ambulances) ? ambulances : []).find((a) => Number(a.id) === Number(row?.ambulance_id));
        const hosp = findHospital(row, Array.isArray(hospitals) ? hospitals : []);
        setBooking(row || null);
        setAmbulance(amb || null);
        setHospital(hosp || null);

        if (row) {
          fetch(`${BASE}/api/route/booking/${row.id}/`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (!ignore) setRoute(data);
            })
            .catch(() => {
              if (!ignore) setRoute(null);
            });
        }
      } catch {
        if (!ignore) {
          setBooking(null);
          setAmbulance(null);
          setHospital(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [bookingId]);

  const bill = useMemo(
    () => calculateBookingBill({ booking, ambulance, hospital, route }),
    [booking, ambulance, hospital, route]
  );

  return (
    <>
      <style>{`
        .cd-root { min-height:100vh; padding:84px 18px 52px 82px; background:#f7f7f2; color:#111; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; }
        .cd-wrap { max-width:1280px; margin:0 auto; }
        .cd-top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .cd-back { display:inline-flex; align-items:center; gap:8px; border:1px solid rgba(20,20,20,0.18); background:#fff; color:#111; border-radius:10px; padding:9px 12px; font-weight:800; cursor:pointer; }
        .cd-kicker { font-size:10px; font-weight:900; letter-spacing:1px; text-transform:uppercase; color:#111; background:#e50914; display:inline-flex; padding:5px 12px; border-radius:999px; margin-bottom:10px; }
        .cd-title { margin:0; font-size:38px; line-height:1; font-weight:950; letter-spacing:0; }
        .cd-sub { margin:8px 0 0; color:rgba(17,17,17,0.62); font-size:13px; }
        .cd-status { border:1px solid #e50914; background:#eaf48b; border-radius:12px; padding:10px 14px; font-size:12px; font-weight:900; text-transform:uppercase; white-space:nowrap; }
        .cd-grid { display:grid; grid-template-columns:1.1fr 0.9fr; gap:16px; align-items:start; }
        .cd-section { background:#fff; border:1px solid rgba(229, 9, 20, 0.15); border-radius:16px; padding:16px; box-shadow:0 12px 28px rgba(229, 9, 20, 0.15); margin-bottom:16px; }
        .cd-section-title { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:950; margin-bottom:14px; color:#111; }
        .cd-fields { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
        .cd-field { border:1px solid rgba(20,20,20,0.1); border-radius:10px; background:#fffef6; padding:10px; min-width:0; }
        .cd-field.wide { grid-column:1 / -1; }
        .cd-label { font-size:9px; font-weight:900; color:rgba(17,17,17,0.5); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:5px; }
        .cd-value { font-size:13px; color:#111; line-height:1.35; word-break:break-word; white-space:pre-wrap; }
        .cd-bill-total { display:flex; align-items:center; justify-content:space-between; gap:12px; border-radius:14px; padding:16px; background:#111; color:#fff; margin-bottom:12px; }
        .cd-bill-total strong { font-size:30px; letter-spacing:0; }
        .cd-line { display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid rgba(20,20,20,0.08); padding:10px 0; font-size:13px; }
        .cd-line:last-child { border-bottom:none; }
        .cd-muted { color:rgba(17,17,17,0.62); font-size:12px; line-height:1.45; }
        .cd-empty { background:#fff; border:1px dashed rgba(20,20,20,0.2); border-radius:16px; padding:32px; text-align:center; color:rgba(17,17,17,0.65); }
        @media (max-width:900px) { .cd-root { padding-left:14px; padding-bottom:86px; } .cd-grid { grid-template-columns:1fr; } .cd-title { font-size:30px; } }
        @media (max-width:560px) { .cd-top { flex-direction:column; } .cd-fields { grid-template-columns:1fr; } .cd-status { white-space:normal; } }
      `}</style>

      <main className="cd-root">
        <div className="cd-wrap">
          <button className="cd-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>

          {loading ? (
            <div className="cd-empty" style={{ marginTop: 18 }}>Loading case details...</div>
          ) : !booking ? (
            <div className="cd-empty" style={{ marginTop: 18 }}>Case details nahi mile.</div>
          ) : (
            <>
              <div className="cd-top" style={{ marginTop: 18 }}>
                <div>
                  <div className="cd-kicker">Full Case File</div>
                  <h1 className="cd-title">Booking #{booking.id}</h1>
                  <p className="cd-sub">Created {formatDateTime(booking.created_at)} · {safe(booking.booked_by, "Unknown user")}</p>
                </div>
                <div className="cd-status">{safe(booking.status, "pending")}</div>
              </div>

              <div className="cd-grid">
                <div>
                  <Section icon={UserRound} title="Patient And User Details">
                    <div className="cd-fields">
                      <Field label="Booked By" value={booking.booked_by} />
                      <Field label="Email" value={booking.booked_by_email} />
                      <Field label="Contact Number" value={booking.patient_contact_number} />
                      <Field label="Patient Name" value={booking.patient_name || booking.booked_by} />
                      <Field label="Age" value={booking.patient_age} />
                      <Field label="Gender" value={booking.patient_gender} />
                      <Field label="Attendant" value={booking.attendant_name} />
                      <Field label="Attendant Contact" value={booking.attendant_contact} />
                    </div>
                  </Section>

                  <Section icon={MapPin} title="Pickup And Hospital Details">
                    <div className="cd-fields">
                      <Field label="Pickup Location" value={booking.pickup_location} wide />
                      <Field label="Landmark" value={booking.pickup_landmark} />
                      <Field label="City / District" value={`${safe(booking.pickup_city)} / ${safe(booking.pickup_district)}`} />
                      <Field label="Pickup GPS" value={booking.pickup_latitude && booking.pickup_longitude ? `${booking.pickup_latitude}, ${booking.pickup_longitude}` : "-"} />
                      <Field label="Destination" value={booking.assigned_hospital_name || booking.destination || "Admin will assign"} />
                      <Field label="Hospital Address" value={booking.assigned_hospital_address || hospital?.address} wide />
                      <Field label="Hospital Contact" value={booking.assigned_hospital_contact || hospital?.contact_number} />
                      <Field label="Hospital Response" value={booking.hospital_response} />
                      <Field label="Hospital Note" value={booking.hospital_response_note} wide />
                    </div>
                  </Section>

                  <Section icon={FileText} title="Medical Report">
                    <div className="cd-fields">
                      <Field label="Condition" value={booking.patient_condition} wide />
                      <Field label="Vitals Summary" value={booking.vitals_summary} wide />
                      <Field label="Driver Voice Transcript" value={booking.driver_voice_transcript} wide />
                      <Field label="Modified Report" value={booking.driver_modified_report} wide />
                      <Field label="Report Submitted By" value={booking.report_submitted_by} />
                      <Field label="Report Submitted At" value={formatDateTime(booking.report_submitted_at)} />
                    </div>
                  </Section>
                </div>

                <aside>
                  <Section icon={IndianRupee} title="Bill Calculation">
                    <div className="cd-bill-total">
                      <span>Estimated Bill</span>
                      <strong>{formatMoney(bill.total)}</strong>
                    </div>
                    <div className="cd-line"><span>Base fare first 3 km</span><strong>{formatMoney(bill.baseFare)}</strong></div>
                    <div className="cd-line"><span>Distance {bill.distanceKm.toFixed(1)} km</span><strong>{formatMoney(bill.distanceCharge)}</strong></div>
                    <div className="cd-line"><span>Emergency dispatch fee</span><strong>{formatMoney(bill.emergencyDispatchFee)}</strong></div>
                    <div className="cd-line"><span>Driver service fee</span><strong>{formatMoney(bill.serviceFee)}</strong></div>
                    <div className="cd-line"><span>GST 5%</span><strong>{formatMoney(bill.gst)}</strong></div>
                    <p className="cd-muted">
                      Bill basis: {bill.formula}. Distance source: {bill.distanceSource}.
                    </p>
                  </Section>

                  <Section icon={Ambulance} title="Ambulance And Driver">
                    <div className="cd-fields">
                      <Field label="Ambulance" value={booking.ambulance_number || ambulance?.ambulance_number} />
                      <Field label="Ambulance ID" value={booking.ambulance_id} />
                      <Field label="Driver" value={booking.driver || ambulance?.driver} />
                      <Field label="Driver Contact" value={booking.driver_contact || ambulance?.driver_contact} />
                      <Field label="Driver Email" value={booking.driver_email || ambulance?.driver_email} wide />
                      <Field label="Vehicle Status" value={ambulance?.status} />
                      <Field label="Battery" value={ambulance?.battery_percentage ? `${ambulance.battery_percentage}%` : "-"} />
                    </div>
                  </Section>

                  <Section icon={ShieldCheck} title="Insurance">
                    <div className="cd-fields">
                      <Field label="Status" value={booking.insurance_status} />
                      <Field label="Provider" value={booking.insurance_provider} />
                      <Field label="Policy / Member ID" value={booking.insurance_policy_member_id} wide />
                      <Field label="Sum Insured" value={booking.insurance_sum_insured} />
                      <Field label="Reviewed By" value={booking.insurance_reviewed_by} />
                      <Field label="Hospital Note" value={booking.insurance_hospital_note} wide />
                    </div>
                  </Section>

                  <Section icon={Building2} title="Workflow Timeline">
                    <div className="cd-fields">
                      <Field label="Sent To Driver" value={booking.sent_to_driver ? "Yes" : "No"} />
                      <Field label="Sent At" value={formatDateTime(booking.sent_to_driver_at)} />
                      <Field label="Task Completed" value={booking.driver_task_completed ? "Yes" : "No"} />
                      <Field label="Completed At" value={formatDateTime(booking.driver_task_completed_at)} />
                      <Field label="Hospital Assigned At" value={formatDateTime(booking.hospital_assigned_at)} />
                      <Field label="Hospital Responded At" value={formatDateTime(booking.hospital_responded_at)} />
                      <Field label="Driver Rejection" value={booking.driver_rejected_once ? safe(booking.driver_rejection_reason, "Rejected once") : "No"} wide />
                    </div>
                  </Section>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
