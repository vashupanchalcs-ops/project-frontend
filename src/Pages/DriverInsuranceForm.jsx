import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const BASE = "http://127.0.0.1:8000";
const INSURANCE_PROVIDERS = [
  "LIC",
  "New India Assurance",
  "ICICI Lombard",
  "HDFC ERGO",
  "Star Health",
  "Niva Bupa",
  "Care Health Insurance",
  "Bajaj Allianz",
  "SBI General Insurance",
  "Reliance General Insurance",
  "Tata AIG",
  "Aditya Birla Health Insurance",
  "National Insurance",
  "Oriental Insurance",
  "United India Insurance",
];

const emptyDraft = () => ({
  full_name: "",
  date_of_birth: "",
  gender: "",
  insurance_provider: "",
  policy_member_id: "",
  policy_holder_name: "",
  government_id: "",
  sum_insured: "",
  emergency_nature: "",
  exclusions_waiting_period: "",
});

const toDateInput = (raw) => {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
};

export default function DriverInsuranceForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedBookingId = Number(searchParams.get("booking") || 0);
  const driverEmail = String(localStorage.getItem("user") || "").toLowerCase().trim();
  const driverName = String(localStorage.getItem("driver_name") || localStorage.getItem("driver") || "").toLowerCase().trim();
  const ambulanceId = Number(localStorage.getItem("ambulance_id") || "0");

  const [bookings, setBookings] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(0);
  const [msg, setMsg] = useState("");

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 900 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadBookings = async () => {
    try {
      const res = await fetch(`${BASE}/api/bookings/`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const mine = rows.filter((b) => {
        if (!(b.status === "confirmed" && b.sent_to_driver)) return false;
        const bEmail = String(b.driver_email || "").toLowerCase().trim();
        const bName = String(b.driver || "").toLowerCase().trim();
        const byAmb = ambulanceId > 0 && Number(b.ambulance_id || 0) === ambulanceId;
        const byEmail = !!driverEmail && bEmail === driverEmail;
        const byName = !!driverName && bName === driverName;
        return byAmb || byEmail || byName;
      });
      setBookings(mine);
      setDrafts((prev) => {
        const next = { ...prev };
        mine.forEach((b) => {
          if (!next[b.id]) {
            next[b.id] = {
              full_name: b.insurance_full_name || b.patient_name || b.booked_by || "",
              date_of_birth: toDateInput(b.insurance_dob),
              gender: b.insurance_gender || b.patient_gender || "",
              insurance_provider: b.insurance_provider || "",
              policy_member_id: b.insurance_policy_member_id || "",
              policy_holder_name: b.insurance_policy_holder_name || "",
              government_id: b.insurance_government_id || "",
              sum_insured: b.insurance_sum_insured || "",
              emergency_nature: b.insurance_emergency_nature || b.patient_condition || "",
              exclusions_waiting_period: b.insurance_exclusions_waiting || "",
            };
          }
        });
        return next;
      });
    } catch {
      setBookings([]);
    }
  };

  useEffect(() => {
    loadBookings();
    const t = setInterval(loadBookings, 10000);
    return () => clearInterval(t);
  }, []);

  const orderedBookings = useMemo(() => {
    const list = [...bookings];
    if (selectedBookingId > 0) {
      list.sort((a, b) => {
        if (a.id === selectedBookingId) return -1;
        if (b.id === selectedBookingId) return 1;
        return Number(b.id) - Number(a.id);
      });
    }
    return list;
  }, [bookings, selectedBookingId]);

  const updateDraft = (bookingId, key, value) => {
    setDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || emptyDraft()),
        [key]: value,
      },
    }));
  };

  const sendInsurance = async (booking) => {
    const draft = drafts[booking.id] || emptyDraft();
    if (!draft.full_name || !draft.insurance_provider || !draft.policy_member_id) {
      setMsg("Full Name, Insurance Provider, aur Policy/Member ID required hai.");
      return;
    }
    setSavingId(booking.id);
    setMsg("");
    try {
      const res = await fetch(`${BASE}/api/bookings/${booking.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurance_details: {
            ...draft,
            submitted_by: booking.driver || driverName || "Ambulance Team",
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Insurance form send failed");
      setMsg(`Booking #${booking.id} insurance details hospital ko send ho gayi.`);
      await loadBookings();
    } catch (e) {
      setMsg(e.message || "Insurance details send failed.");
    } finally {
      setSavingId(0);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8ef", padding: isMobile ? "84px 16px 90px 16px" : "84px 18px 30px 78px", fontFamily: "'Helvetica Neue', Arial, sans-serif", overflowX: "hidden" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <section style={{ border: "1px solid rgba(17,17,17,0.14)", borderRadius: 18, padding: 18, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1, fontWeight: 800, color: "rgba(17,17,17,0.62)" }}>DRIVER INSURANCE DESK</div>
              <h1 style={{ margin: "6px 0 0", fontSize: 42, lineHeight: 1 }}>Medical Insurance Form</h1>
              <div style={{ marginTop: 8, color: "rgba(17,17,17,0.68)", fontSize: 14 }}>
                Booking card se insurance details fill karo aur hospital verification ke liye send karo.
              </div>
            </div>
            <button
              onClick={() => navigate("/driver-dashboard?tab=bookings")}
              style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 12, background: "#d6e800", padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}
            >
              Back to Driver Bookings
            </button>
          </div>
        </section>

        {msg && (
          <div style={{ marginTop: 10, border: "1px solid rgba(156,171,0,0.5)", borderRadius: 12, background: "rgba(214,232,0,0.16)", padding: 10, fontSize: 13, fontWeight: 700 }}>
            {msg}
          </div>
        )}

        {orderedBookings.length === 0 ? (
          <div style={{ marginTop: 16, border: "1px solid rgba(17,17,17,0.14)", borderRadius: 16, background: "#fff", padding: 16 }}>
            No confirmed driver bookings found for insurance submission.
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "grid", gap: 16 }}>
            {orderedBookings.map((b) => {
              const d = drafts[b.id] || emptyDraft();
              const alreadySent = !!b.insurance_submitted_at;
              return (
                <article
                  key={b.id}
                  style={{
                    border: selectedBookingId === b.id ? "2px solid rgba(156,171,0,0.75)" : "1px solid rgba(156,171,0,0.5)",
                    borderRadius: 16,
                    background: "#fffef7",
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <div style={{ fontSize: 32, fontWeight: 900 }}>Booking #{b.id}</div>
                    <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 999, padding: "6px 10px", fontWeight: 700, fontSize: 12 }}>
                        {b.booked_by || b.patient_name || "Patient"}
                      </span>
                      <span style={{ border: "1px solid rgba(17,17,17,0.2)", borderRadius: 999, padding: "6px 10px", fontWeight: 700, fontSize: 12 }}>
                        {b.pickup_location || "-"}
                      </span>
                      <span style={{ border: "1px solid rgba(156,171,0,0.6)", background: "rgba(214,232,0,0.28)", borderRadius: 999, padding: "6px 10px", fontWeight: 800, fontSize: 12 }}>
                        {alreadySent ? "Insurance Details Sent" : "Pending Insurance Form"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                    <input value={d.full_name} onChange={(e) => updateDraft(b.id, "full_name", e.target.value)} placeholder="Full Name" style={inputStyle} />
                    <input
                      type="date"
                      value={d.date_of_birth}
                      onChange={(e) => updateDraft(b.id, "date_of_birth", e.target.value)}
                      style={inputStyle}
                    />
                    <select value={d.gender} onChange={(e) => updateDraft(b.id, "gender", e.target.value)} style={inputStyle}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      list={`insurance-provider-options-${b.id}`}
                      value={d.insurance_provider}
                      onChange={(e) => updateDraft(b.id, "insurance_provider", e.target.value)}
                      placeholder="Insurance Provider"
                      style={inputStyle}
                    />
                    <datalist id={`insurance-provider-options-${b.id}`}>
                      {INSURANCE_PROVIDERS.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                    <input value={d.policy_member_id} onChange={(e) => updateDraft(b.id, "policy_member_id", e.target.value)} placeholder="Policy / Member ID" style={inputStyle} />
                    <input value={d.policy_holder_name} onChange={(e) => updateDraft(b.id, "policy_holder_name", e.target.value)} placeholder="Policy Holder Name" style={inputStyle} />
                    <input value={d.government_id} onChange={(e) => updateDraft(b.id, "government_id", e.target.value)} placeholder="Government ID (Aadhar etc.)" style={inputStyle} />
                    <input value={d.sum_insured} onChange={(e) => updateDraft(b.id, "sum_insured", e.target.value)} placeholder="Sum Insured" style={inputStyle} />
                    <textarea value={d.emergency_nature} onChange={(e) => updateDraft(b.id, "emergency_nature", e.target.value)} placeholder="Emergency nature / condition" style={textareaStyle} />
                    <textarea value={d.exclusions_waiting_period} onChange={(e) => updateDraft(b.id, "exclusions_waiting_period", e.target.value)} placeholder="Exclusions / Waiting Period details" style={textareaStyle} />
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={() => sendInsurance(b)}
                      disabled={savingId === b.id}
                      style={{
                        border: "1px solid rgba(17,17,17,0.32)",
                        borderRadius: 12,
                        background: "#d6e800",
                        color: "#111",
                        padding: "11px 16px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {savingId === b.id ? "Sending..." : alreadySent ? "Update & Re-Send Insurance Details" : "Send To Hospital"}
                    </button>
                    {b.insurance_submitted_at && (
                      <span style={{ fontSize: 12, color: "rgba(17,17,17,0.66)" }}>
                        Submitted: {new Date(b.insurance_submitted_at).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  border: "1px solid rgba(17,17,17,0.16)",
  borderRadius: 11,
  background: "#fff",
  padding: "12px 13px",
  fontSize: 14,
  outline: "none",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 86,
  resize: "vertical",
};
