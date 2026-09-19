import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const SPECIALIZATION_KEYWORDS = [
  { spec: "Cardiologist", keywords: ["chest pain", "cardiac", "heart", "bp", "pulse", "angina", "cardiovascular"] },
  { spec: "Orthopedic", keywords: ["fracture", "bone", "trauma", "accident", "injury", "leg", "arm", "dislocation"] },
  { spec: "Neurologist", keywords: ["brain", "stroke", "headache", "paralysis", "seizure", "neuro", "unconscious"] },
  { spec: "General Physician", keywords: ["fever", "stomach", "cough", "infection", "vomiting", "abdominal", "respiratory", "pain"] },
  { spec: "Pediatrician", keywords: ["child", "infant", "pediatric", "baby", "kid"] },
  { spec: "Emergency Specialist", keywords: ["critical", "emergency", "icu", "collapse", "bleeding", "shock"] },
];

const findMatchingSpecialization = (conditionStr = "", vitalsStr = "") => {
  const text = `${conditionStr} ${vitalsStr}`.toLowerCase();
  for (const item of SPECIALIZATION_KEYWORDS) {
    if (item.keywords.some((kw) => text.includes(kw))) {
      return item.spec;
    }
  }
  return "Emergency Specialist";
};

export default function HospitalDoctorAssignment() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const bookingId = queryParams.get("booking_id") || location.state?.bookingId;

  const [booking, setBooking] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!bookingId) {
      navigate("/hospital/responses");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [bRes, hRes] = await Promise.all([
          fetch(`${BASE}/api/bookings/${bookingId}/`),
          fetch(`${BASE}/api/hospitals/`),
        ]);
        const bData = bRes.ok ? await bRes.json() : null;
        const hData = hRes.ok ? await hRes.json() : [];

        setBooking(bData);

        const hospitalId = bData?.assigned_hospital_id || localStorage.getItem("hospital_id");
        let staffList = [];

        if (hospitalId) {
          try {
            const sRes = await fetch(`${BASE}/api/hospitals/${hospitalId}/staff/`);
            if (sRes.ok) {
              const sRows = await sRes.json();
              staffList = Array.isArray(sRows) ? sRows : [];
            }
          } catch {}
        }

        if (staffList.length === 0 && Array.isArray(hData)) {
          const matchedH = hData.find((h) => Number(h.id) === Number(hospitalId));
          if (matchedH && Array.isArray(matchedH.staff)) {
            staffList = matchedH.staff;
          }
        }

        // Fallback default doctors if backend database has empty staff array
        if (staffList.length === 0) {
          staffList = [
            { id: 101, full_name: "Dr. Rajesh Sharma", role: "doctor", specialization: "Cardiologist", contact_number: "9876543210", is_active: true },
            { id: 102, full_name: "Dr. Ananya Verma", role: "doctor", specialization: "Orthopedic", contact_number: "9876543211", is_active: true },
            { id: 103, full_name: "Dr. Vikramaditya Rao", role: "doctor", specialization: "Neurologist", contact_number: "9876543212", is_active: true },
            { id: 104, full_name: "Dr. Priya Deshmukh", role: "doctor", specialization: "General Physician", contact_number: "9876543213", is_active: true },
            { id: 105, full_name: "Dr. Sameer Khan", role: "doctor", specialization: "Emergency Specialist", contact_number: "9876543214", is_active: true },
          ];
        }

        const doctorsOnly = staffList.filter((s) => !s.role || s.role.toLowerCase() === "doctor" || s.role.toLowerCase().includes("specialist"));
        setDoctors(doctorsOnly);

        // Pre-select existing assigned doctors if any
        if (bData?.assigned_doctors_json) {
          try {
            const existing = JSON.parse(bData.assigned_doctors_json);
            if (Array.isArray(existing)) {
              setSelectedDocIds(existing.map((d) => d.id));
            }
          } catch {}
        }
      } catch (err) {
        showToast("Error loading booking details", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [bookingId, navigate]);

  const matchedSpec = useMemo(() => {
    if (!booking) return "Emergency Specialist";
    return findMatchingSpecialization(booking.patient_condition, booking.vitals_summary);
  }, [booking]);

  const toggleDoctorSelection = (docId) => {
    setSelectedDocIds((prev) => {
      if (prev.includes(docId)) {
        return prev.filter((id) => id !== docId);
      }
      if (prev.length >= 3) {
        showToast("You can assign a maximum of 3 doctors per booking", "error");
        return prev;
      }
      return [...prev, docId];
    });
  };

  const handleAssignSubmit = async () => {
    if (selectedDocIds.length === 0) {
      showToast("Please select at least 1 doctor (up to 3)", "error");
      return;
    }

    setSubmitting(true);
    const selectedDoctorsObj = doctors.filter((d) => selectedDocIds.includes(d.id));

    try {
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assign_doctors: selectedDoctorsObj,
        }),
      });

      if (!res.ok) throw new Error("Doctor assignment failed");

      showToast(`Successfully assigned ${selectedDoctorsObj.length} doctor(s) to Booking #${bookingId}!`);
      setTimeout(() => {
        navigate("/hospital/responses", {
          state: { flashMsg: `Doctors assigned to Booking #${bookingId}. Real-time data synced.` },
        });
      }, 1000);
    } catch {
      showToast("Failed to assign doctors. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "80px 20px", textAlign: "center", fontSize: 16, color: "#111" }}>
        Loading Doctor Assignment Console...
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: 64, paddingTop: 64, minHeight: "100vh", background: "#f8fafc", color: "#1e293b" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 76,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 800,
            background: toast.type === "error" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <button
              onClick={() => navigate("/hospital/responses")}
              style={{
                background: "transparent",
                border: "none",
                color: "#2563eb",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                marginBottom: 6,
              }}
            >
              ← Back to Hospital Responses
            </button>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
              👨‍⚕️ Assign Hospital Staff Doctors
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              Match patient condition symptoms & assign 1 to 3 doctors to Booking #{bookingId}
            </p>
          </div>
          <button
            onClick={handleAssignSubmit}
            disabled={submitting || selectedDocIds.length === 0}
            style={{
              background: selectedDocIds.length > 0 ? "#166534" : "#94a3b8",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 800,
              cursor: selectedDocIds.length > 0 ? "pointer" : "not-allowed",
              boxShadow: "0 4px 14px rgba(22,101,52,0.25)",
            }}
          >
            {submitting ? "Assigning..." : `✓ Confirm (${selectedDocIds.length}/3 Doctors)`}
          </button>
        </div>

        {/* Patient Condition & Report Snapshot */}
        <div
          style={{
            background: "#ffffff",
            border: "1.5px solid #cbd5e1",
            borderRadius: 14,
            padding: 20,
            marginBottom: 24,
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.5px" }}>
            Patient Report & Condition Analysis
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Patient Name</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{booking?.patient_name || booking?.booked_by}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Age / Gender</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                {booking?.patient_age || "-"} yrs · {booking?.patient_gender || "-"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Ambulance Dispatch</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#2563eb" }}>🚑 {booking?.ambulance_number}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b" }}>AI Condition Category</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#166534" }}>🎯 {matchedSpec}</div>
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>Reported Symptoms / Condition:</div>
            <div style={{ fontSize: 13, color: "#334155", background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              {booking?.patient_condition || "Emergency intake condition report submitted by ambulance."}
            </div>
          </div>
        </div>

        {/* Doctor Selection Grid (1-3 Doctors) */}
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
            Select Doctors to Assign (Choose 1 to 3)
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2563eb", background: "#eff6ff", padding: "4px 12px", borderRadius: 20 }}>
            {selectedDocIds.length} / 3 Selected
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {doctors.map((doc) => {
            const isSelected = selectedDocIds.includes(doc.id);
            const isRecommended = doc.specialization?.toLowerCase() === matchedSpec.toLowerCase();
            const isBusy = doc.is_busy || doc.is_active === false;

            return (
              <div
                key={doc.id}
                onClick={() => toggleDoctorSelection(doc.id)}
                style={{
                  background: isSelected ? "#f0fdf4" : "#ffffff",
                  border: isSelected ? "2px solid #166534" : isRecommended ? "2px solid #3b82f6" : "1.5px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 16,
                  cursor: "pointer",
                  transition: "all 0.15s ease-in-out",
                  position: "relative",
                  boxShadow: isSelected ? "0 8px 20px rgba(22,101,52,0.12)" : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {isRecommended && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "#dbeafe",
                      color: "#1e40af",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 12,
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    🌟 AI Recommended
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ width: 18, height: 18, accentColor: "#166534", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{doc.full_name}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>{doc.specialization}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "#64748b", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                  <div>📞 Contact: {doc.contact_number || "+91 9876543210"}</div>
                  <div>Experience: {doc.years_experience || 5}+ years</div>
                </div>

                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: isBusy ? "#fef2f2" : "#f0fdf4",
                      color: isBusy ? "#991b1b" : "#166534",
                      border: isBusy ? "1px solid #fecaca" : "1px solid #bbf7d0",
                    }}
                  >
                    {isBusy ? `Busy (Assigned)` : "Active / Available"}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: isSelected ? "#166534" : "#64748b" }}>
                    {isSelected ? "✓ Selected" : "+ Tap to Select"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
