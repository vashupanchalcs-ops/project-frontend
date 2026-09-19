import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Users, UserCheck, Stethoscope, ArrowLeft, ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";

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
  const initialBookingId = queryParams.get("booking_id") || location.state?.bookingId || null;

  const cachedBookings = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("staff_hub_bookings_cache") || "[]");
    } catch {
      return [];
    }
  }, []);

  const cachedDocs = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("staff_hub_doctors_cache") || "[]");
    } catch {
      return [];
    }
  }, []);

  const [activeBookingId, setActiveBookingId] = useState(initialBookingId);
  const [allBookings, setAllBookings] = useState(cachedBookings);
  const [activeBooking, setActiveBooking] = useState(null);
  const [doctors, setDoctors] = useState(cachedDocs);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [loading, setLoading] = useState(cachedBookings.length === 0 && cachedDocs.length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync activeBookingId with URL parameter if it changes
  useEffect(() => {
    const bId = queryParams.get("booking_id") || location.state?.bookingId || null;
    setActiveBookingId(bId);
  }, [location.search]);

  // Load all bookings and doctors
  const loadHubData = async () => {
    if (allBookings.length === 0) setLoading(true);
    try {
      const hospitalId = localStorage.getItem("hospital_id");
      const [bRes, hRes] = await Promise.all([
        fetch(`${BASE}/api/bookings/`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${BASE}/api/hospitals/`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      const bList = Array.isArray(bRes) ? bRes : [];
      // Filter bookings relevant to this hospital or active cases
      const relevantBookings = bList.filter(
        (b) => !hospitalId || String(b.assigned_hospital_id) === String(hospitalId) || !b.assigned_hospital_id
      );
      setAllBookings(relevantBookings);
      try {
        sessionStorage.setItem("staff_hub_bookings_cache", JSON.stringify(relevantBookings));
      } catch {}

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

      if (staffList.length === 0 && Array.isArray(hRes)) {
        const matchedH = hRes.find((h) => Number(h.id) === Number(hospitalId));
        if (matchedH && Array.isArray(matchedH.staff)) {
          staffList = matchedH.staff;
        }
      }

      if (staffList.length === 0) {
        staffList = [
          { id: 101, full_name: "Dr. Rajesh Sharma", role: "doctor", specialization: "Cardiologist", contact_number: "9876543210", is_active: true },
          { id: 102, full_name: "Dr. Ananya Verma", role: "doctor", specialization: "Orthopedic", contact_number: "9876543211", is_active: true },
          { id: 103, full_name: "Dr. Vikramaditya Rao", role: "doctor", specialization: "Neurologist", contact_number: "9876543212", is_active: true },
          { id: 104, full_name: "Dr. Priya Deshmukh", role: "doctor", specialization: "General Physician", contact_number: "9876543213", is_active: true },
          { id: 105, full_name: "Dr. Sameer Khan", role: "doctor", specialization: "Emergency Specialist", contact_number: "9876543214", is_active: true },
        ];
      }

      const doctorsOnly = staffList.filter(
        (s) => !s.role || s.role.toLowerCase() === "doctor" || s.role.toLowerCase().includes("specialist")
      );
      setDoctors(doctorsOnly);

      // If activeBookingId is present, set activeBooking and preselect existing doctors
      if (activeBookingId) {
        const matchedBooking = relevantBookings.find((b) => String(b.id) === String(activeBookingId));
        if (matchedBooking) {
          setActiveBooking(matchedBooking);
          // Sort doctors: specialization-matched first, then by experience
          const condSpec = findMatchingSpecialization(matchedBooking.patient_condition, matchedBooking.vitals_summary);
          doctorsOnly.sort((a, b) => {
            const aMatch = a.specialization?.toLowerCase() === condSpec.toLowerCase() ? 1 : 0;
            const bMatch = b.specialization?.toLowerCase() === condSpec.toLowerCase() ? 1 : 0;
            if (bMatch !== aMatch) return bMatch - aMatch;
            return (Number(b.years_experience) || 0) - (Number(a.years_experience) || 0);
          });
          setDoctors([...doctorsOnly]);
          if (matchedBooking.assigned_doctors_json) {
            try {
              const existing = JSON.parse(matchedBooking.assigned_doctors_json);
              if (Array.isArray(existing)) {
                setSelectedDocIds(existing.map((d) => d.id));
              }
            } catch {}
          }
        }
      }
    } catch {
      showToast("Error loading staff allocation data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHubData();
  }, [activeBookingId]);

  const matchedSpec = useMemo(() => {
    if (!activeBooking) return "Emergency Specialist";
    return findMatchingSpecialization(activeBooking.patient_condition, activeBooking.vitals_summary);
  }, [activeBooking]);

  // Re-sort doctors whenever matchedSpec changes (after activeBooking loads)
  useEffect(() => {
    if (!activeBooking || doctors.length === 0) return;
    const condSpec = matchedSpec;
    const sorted = [...doctors].sort((a, b) => {
      const aMatch = a.specialization?.toLowerCase() === condSpec.toLowerCase() ? 1 : 0;
      const bMatch = b.specialization?.toLowerCase() === condSpec.toLowerCase() ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
      return (Number(b.years_experience) || 0) - (Number(a.years_experience) || 0);
    });
    setDoctors(sorted);
  }, [matchedSpec]);

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
    const docNames = selectedDoctorsObj.map((d) => d.full_name).join(", ");
    const docSpecs = selectedDoctorsObj.map((d) => d.specialization).filter(Boolean).join(", ");
    const docPhones = selectedDoctorsObj.map((d) => d.contact_number).filter(Boolean).join(", ");

    // Optimistically update allBookings state immediately
    setAllBookings((prev) =>
      prev.map((b) =>
        String(b.id) === String(activeBookingId)
          ? {
              ...b,
              assigned_doctor_names: docNames,
              assigned_doctor_specializations: docSpecs,
              assigned_doctor_contacts: docPhones,
              assigned_doctors_json: JSON.stringify(selectedDoctorsObj),
            }
          : b
      )
    );

    try {
      const res = await fetch(`${BASE}/api/bookings/${activeBookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assign_doctors: selectedDoctorsObj,
        }),
      });

      if (!res.ok) throw new Error("Doctor assignment failed");

      showToast(`Successfully assigned ${selectedDoctorsObj.length} doctor(s) to Case #${activeBookingId}!`);
      // Return to Hub view
      setTimeout(() => {
        setActiveBookingId(null);
        navigate("/hospital/assign-doctor", { replace: true });
        loadHubData();
      }, 700);
    } catch {
      showToast("Failed to assign doctors. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignmentFor = (b) => {
    setActiveBookingId(b.id);
    setActiveBooking(b);
    setSelectedDocIds([]);
    if (b.assigned_doctors_json) {
      try {
        const existing = JSON.parse(b.assigned_doctors_json);
        if (Array.isArray(existing)) {
          setSelectedDocIds(existing.map((d) => d.id));
        }
      } catch {}
    }
    navigate(`/hospital/assign-doctor?booking_id=${b.id}`);
  };

  if (loading) {
    return (
      <div style={{ paddingLeft: 64, paddingTop: 100, textAlign: "center", fontSize: 16, color: "#111" }}>
        Loading Staff Allocation Console...
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SINGLE CASE ASSIGNMENT VIEW (when activeBookingId is set)
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeBookingId && activeBooking) {
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
                onClick={() => {
                  setActiveBookingId(null);
                  navigate("/hospital/assign-doctor", { replace: true });
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#2563eb",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <ArrowLeft size={16} /> Back to Staff Allocation Hub
              </button>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
                👨‍⚕️ Assign Staff Doctors to Case #{activeBookingId}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                Match patient condition symptoms & assign 1 to 3 doctors to this case
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
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                  {activeBooking?.patient_name || activeBooking?.booked_by}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Age / Gender</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                  {activeBooking?.patient_age || "-"} yrs · {activeBooking?.patient_gender || "-"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Ambulance Dispatch</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#2563eb" }}>
                  🚑 {activeBooking?.ambulance_number || "Ambulance"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b" }}>AI Condition Match</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#166534" }}>🎯 {matchedSpec}</div>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 4 }}>Reported Symptoms / Condition:</div>
              <div style={{ fontSize: 13, color: "#334155", background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                {activeBooking?.patient_condition || "Emergency intake condition report submitted by ambulance team."}
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. STAFF ALLOCATION HUB (All cases overview)
  // ─────────────────────────────────────────────────────────────────────────────
  const assignedCasesCount = allBookings.filter((b) => b.assigned_doctor_names).length;
  const pendingCasesCount = allBookings.length - assignedCasesCount;

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

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={32} color="#0f766e" /> Staff Allocation & Medical Teams Hub
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>
            Track and manage which doctors and emergency staff are assigned to every incoming case in real time.
          </p>
        </div>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>TOTAL CASES</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{allBookings.length}</div>
          </div>
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#166534" }}>STAFF ASSIGNED</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#166534", marginTop: 4 }}>{assignedCasesCount}</div>
          </div>
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#b45309" }}>AWAITING ALLOCATION</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#b45309", marginTop: 4 }}>{pendingCasesCount}</div>
          </div>
          <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>AVAILABLE DOCTORS</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#2563eb", marginTop: 4 }}>
              {doctors.filter((d) => !d.is_busy).length} / {doctors.length}
            </div>
          </div>
        </div>

        {/* Cases Grid */}
        {allBookings.length === 0 ? (
          <div style={{ background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: 14, padding: 40, textAlign: "center", color: "#64748b" }}>
            No patient cases registered yet.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
            {allBookings.map((b) => {
              const hasAssigned = Boolean(b.assigned_doctor_names);
              const isIcu = b.icu_required || b.assigned_bed_type === "icu";
              const conditionMatch = findMatchingSpecialization(b.patient_condition, b.vitals_summary);

              return (
                <article
                  key={b.id}
                  style={{
                    background: "#ffffff",
                    border: isIcu ? "1.5px solid #fca5a5" : hasAssigned ? "1.5px solid #bbf7d0" : "1.5px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 18,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    {/* Top status bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>
                        CASE #{b.id}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {isIcu && (
                          <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, border: "1px solid #fca5a5" }}>
                            🚨 ICU CASE
                          </span>
                        )}
                        <span style={{
                          background: hasAssigned ? "#dcfce7" : "#fee2e2",
                          color: hasAssigned ? "#166534" : "#991b1b",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: hasAssigned ? "1px solid #bbf7d0" : "1px solid #fca5a5",
                        }}>
                          {hasAssigned ? "✅ ASSIGNED" : "🔴 UNASSIGNED"}
                        </span>
                      </div>
                    </div>

                    {/* Patient info */}
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                      {b.patient_name || b.booked_by || "Emergency Patient"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {b.patient_age ? `${b.patient_age} yrs · ` : ""}{b.patient_gender || "Gender N/A"} · Pickup: {b.pickup_location || "Dispatched Location"}
                    </div>

                    {/* Reported condition */}
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#334155", border: "1px solid #f1f5f9" }}>
                      <b>Condition:</b> {b.patient_condition || "Emergency symptoms recorded by ambulance."}
                    </div>

                    {/* Assigned bed if available */}
                    {b.assigned_bed_number && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#1e40af", background: "#eff6ff", padding: "6px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        🛏️ <b>Bed:</b> {b.assigned_bed_number} ({b.assigned_bed_type?.toUpperCase()})
                      </div>
                    )}

                    {/* Assigned Staff Box */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                        Assigned Medical Staff:
                      </div>
                      {hasAssigned ? (
                        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ color: "#166534", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                            <UserCheck size={16} /> {b.assigned_doctor_names}
                          </div>
                          {b.assigned_doctor_specializations && (
                            <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                              Specialization: {b.assigned_doctor_specializations}
                            </div>
                          )}
                          {b.assigned_doctor_contacts && (
                            <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                              📞 {b.assigned_doctor_contacts}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#991b1b" }}>
                          ⚠️ No doctors assigned yet. Suggested: <b>{conditionMatch}</b>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action button — only shown when NOT yet assigned */}
                  {!hasAssigned && (
                    <div style={{ marginTop: 16 }}>
                      <button
                        onClick={() => openAssignmentFor(b)}
                        style={{
                          width: "100%",
                          background: "#166534",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 16px",
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Stethoscope size={16} />
                        Assign Doctors
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
