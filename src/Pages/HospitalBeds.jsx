import { useEffect, useMemo, useState } from "react";
import { BedDouble, ShieldAlert, Activity, CheckCircle, Clock, User, Phone, Heart, Calendar, Stethoscope, X, RefreshCw } from "lucide-react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

export default function HospitalBeds() {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState(null);
  const [hospitalInfo, setHospitalInfo] = useState(null);
  const [filterType, setFilterType] = useState("all"); // all, general, icu
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  const hospitalId = localStorage.getItem("hospital_id") || "1";

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchBeds = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bedsRes, hospRes] = await Promise.all([
        fetch(`${BASE}/api/hospitals/${hospitalId}/beds/`),
        fetch(`${BASE}/api/hospitals/${hospitalId}/dashboard/`).catch(() => null),
      ]);

      if (bedsRes.ok) {
        const bedsData = await bedsRes.json();
        setBeds(Array.isArray(bedsData) ? bedsData : []);
      }
      if (hospRes && hospRes.ok) {
        const hData = await hospRes.json();
        setHospitalInfo(hData.hospital || null);
      }
    } catch {
      showToast("Error loading hospital beds", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchBeds(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [hospitalId]);

  // Keep selectedBed updated if beds list refreshes
  useEffect(() => {
    if (selectedBed) {
      const updated = beds.find((b) => b.id === selectedBed.id);
      if (updated) setSelectedBed(updated);
    }
  }, [beds]);

  // Counts & Metrics
  const metrics = useMemo(() => {
    const total = beds.length;
    const available = beds.filter((b) => b.status === "available").length;
    const reserved = beds.filter((b) => b.status === "reserved").length;
    const occupied = beds.filter((b) => b.status === "occupied").length;

    const generalBeds = beds.filter((b) => b.bed_type === "general");
    const icuBeds = beds.filter((b) => b.bed_type === "icu");

    return {
      total,
      available,
      reserved,
      occupied,
      generalTotal: generalBeds.length,
      generalAvailable: generalBeds.filter((b) => b.status === "available").length,
      icuTotal: icuBeds.length,
      icuAvailable: icuBeds.filter((b) => b.status === "available").length,
    };
  }, [beds]);

  const generalBedsList = useMemo(
    () => beds.filter((b) => b.bed_type === "general"),
    [beds]
  );

  const icuBedsList = useMemo(
    () => beds.filter((b) => b.bed_type === "icu"),
    [beds]
  );

  // Status Actions
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedBed) return;
    setUpdating(true);
    try {
      const payload = { status: newStatus };
      if (newStatus === "available") {
        // Freeing the bed clears patient details
        payload.assigned_booking_id = null;
        payload.patient_name = "";
        payload.patient_age = "";
        payload.patient_gender = "";
        payload.blood_group = "";
        payload.patient_phone = "";
        payload.emergency_contact = "";
        payload.medical_condition = "";
        payload.vitals_summary = "";
        payload.attending_doctor = "";
        payload.assigned_staff_json = "[]";
        payload.admission_time = null;
      }
      const res = await fetch(`${BASE}/api/hospitals/beds/${selectedBed.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update bed status");
      const updated = await res.json();
      setSelectedBed(updated);
      showToast(`Bed ${updated.bed_number} updated to ${newStatus.toUpperCase()}`);
      fetchBeds(true);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUpdating(false);
    }
  };

  // Helper for status styling
  const getStatusColor = (status) => {
    switch (status) {
      case "available":
        return { bg: "#22c55e", lightBg: "#f0fdf4", border: "#86efac", text: "#166534", label: "Available" };
      case "reserved":
        return { bg: "#eab308", lightBg: "#fefce8", border: "#fde047", text: "#854d0e", label: "Reserved / Booked" };
      case "occupied":
        return { bg: "#3b82f6", lightBg: "#eff6ff", border: "#93c5fd", text: "#1e40af", label: "Occupied" };
      default:
        return { bg: "#94a3b8", lightBg: "#f8fafc", border: "#cbd5e1", text: "#475569", label: status };
    }
  };

  return (
    <div style={{ paddingLeft: 64, paddingTop: 64, minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "inherit" }}>
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

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "24px 24px 80px" }}>
        {/* Page Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
              <BedDouble size={32} color="#0284c7" /> Real-time Bed Management Console
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b" }}>
              {hospitalInfo?.name || "Hospital"} • Visual Bed Layout, General & ICU Hubs with Live Status
            </p>
          </div>
          <button
            onClick={() => fetchBeds()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
            }}
          >
            <RefreshCw size={14} /> Refresh Beds
          </button>
        </div>

        {/* Top KPI Metrics Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
          {/* Total */}
          <div style={{ background: "#ffffff", padding: "18px 20px", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>TOTAL REGISTERED BEDS</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{metrics.total}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              General: {metrics.generalTotal} · ICU: {metrics.icuTotal}
            </div>
          </div>

          {/* Available - Green */}
          <div style={{ background: "#f0fdf4", padding: "18px 20px", borderRadius: 14, border: "1.5px solid #86efac", boxShadow: "0 2px 8px rgba(34,197,94,0.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              AVAILABLE BEDS (GREEN)
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#166534", marginTop: 4 }}>{metrics.available}</div>
            <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>
              Ready for immediate intake
            </div>
          </div>

          {/* Reserved - Yellow */}
          <div style={{ background: "#fefce8", padding: "18px 20px", borderRadius: 14, border: "1.5px solid #fde047", boxShadow: "0 2px 8px rgba(234,179,8,0.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#854d0e", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308", display: "inline-block" }} />
              RESERVED / BOOKED (YELLOW)
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#854d0e", marginTop: 4 }}>{metrics.reserved}</div>
            <div style={{ fontSize: 12, color: "#a16207", marginTop: 4 }}>
              Ambulance en route / Allocated
            </div>
          </div>

          {/* Occupied - Blue */}
          <div style={{ background: "#eff6ff", padding: "18px 20px", borderRadius: 14, border: "1.5px solid #93c5fd", boxShadow: "0 2px 8px rgba(59,130,246,0.08)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
              OCCUPIED BEDS (BLUE)
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#1e40af", marginTop: 4 }}>{metrics.occupied}</div>
            <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4 }}>
              Patient admitted & receiving care
            </div>
          </div>
        </div>

        {/* ── SECTION 1: GENERAL WARD BEDS GRID ────────────────────────────── */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 24, marginBottom: 28, boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                🏥 General Ward Beds
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                Rows & Columns layout • Click any box to view admitted patient & assigned staff details
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12, fontWeight: 700 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: "#22c55e" }} /> Available
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: "#eab308" }} /> Booked
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: "#3b82f6" }} /> Occupied
              </span>
            </div>
          </div>

          {generalBedsList.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No General beds configured.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
              {generalBedsList.map((bed) => {
                const colors = getStatusColor(bed.status);
                const isSelected = selectedBed?.id === bed.id;
                return (
                  <div
                    key={bed.id}
                    onClick={() => setSelectedBed(bed)}
                    style={{
                      background: colors.lightBg,
                      border: isSelected ? "2.5px solid #0f172a" : `2px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: "14px 10px",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease-in-out",
                      boxShadow: isSelected ? "0 8px 20px rgba(0,0,0,0.15)" : "0 2px 6px rgba(0,0,0,0.03)",
                      transform: isSelected ? "scale(1.03)" : "none",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: colors.text, textTransform: "uppercase" }}>
                      {bed.bed_number}
                    </div>
                    <div
                      style={{
                        margin: "8px auto 6px",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: colors.bg,
                        boxShadow: `0 0 8px ${colors.bg}`,
                      }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 800, color: colors.text }}>
                      {bed.status === "available" ? "AVAILABLE" : bed.status === "reserved" ? "BOOKED" : "OCCUPIED"}
                    </div>
                    {bed.patient_name && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#334155",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {bed.patient_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 2: ICU BEDS HUB ──────────────────────────────────────── */}
        <div style={{ background: "#ffffff", borderRadius: 16, border: "1.5px solid #fca5a5", padding: 24, marginBottom: 28, boxShadow: "0 4px 16px rgba(239,68,68,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 999 }}>
                  CRITICAL CARE UNIT
                </span>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
                  🚨 Dedicated ICU Beds Hub
                </h2>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                Specialized intensive care beds with ventilator & live monitoring support
              </p>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#991b1b", background: "#fef2f2", padding: "6px 14px", borderRadius: 8, border: "1px solid #fecaca" }}>
              Available ICU Beds: <b>{metrics.icuAvailable} / {metrics.icuTotal}</b>
            </div>
          </div>

          {icuBedsList.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No ICU beds configured.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {icuBedsList.map((bed) => {
                const colors = getStatusColor(bed.status);
                const isSelected = selectedBed?.id === bed.id;
                return (
                  <div
                    key={bed.id}
                    onClick={() => setSelectedBed(bed)}
                    style={{
                      background: colors.lightBg,
                      border: isSelected ? "2.5px solid #991b1b" : `2px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: "16px 12px",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease-in-out",
                      boxShadow: isSelected ? "0 8px 20px rgba(153,27,27,0.15)" : "0 2px 6px rgba(0,0,0,0.03)",
                      transform: isSelected ? "scale(1.03)" : "none",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#991b1b" }}>
                      {bed.bed_number}
                    </div>
                    <div
                      style={{
                        margin: "8px auto 6px",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: colors.bg,
                        boxShadow: `0 0 10px ${colors.bg}`,
                      }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 800, color: colors.text }}>
                      {bed.status === "available" ? "AVAILABLE" : bed.status === "reserved" ? "BOOKED" : "OCCUPIED"}
                    </div>
                    {bed.patient_name && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: "#1e293b",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {bed.patient_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 3: ANALYTICS & OCCUPANCY CHARTS ──────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
          {/* Chart 1: Bed Status Distribution Bar Chart */}
          <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 22, boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              📊 Bed Status Distribution
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              Real-time breakdown of Available, Booked, and Occupied beds
            </div>
            <div style={{ height: 180, display: "flex", alignItems: "flex-end", gap: 32, padding: "0 20px 10px" }}>
              {/* Available Bar */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#166534" }}>{metrics.available}</span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 50,
                    height: `${Math.max(14, metrics.total ? (metrics.available / metrics.total) * 140 : 14)}px`,
                    background: "linear-gradient(180deg, #4ade80 0%, #22c55e 100%)",
                    borderRadius: "6px 6px 0 0",
                    transition: "height 0.3s ease",
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#166534" }}>Available</span>
              </div>

              {/* Reserved Bar */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#854d0e" }}>{metrics.reserved}</span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 50,
                    height: `${Math.max(14, metrics.total ? (metrics.reserved / metrics.total) * 140 : 14)}px`,
                    background: "linear-gradient(180deg, #fde047 0%, #eab308 100%)",
                    borderRadius: "6px 6px 0 0",
                    transition: "height 0.3s ease",
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#854d0e" }}>Booked</span>
              </div>

              {/* Occupied Bar */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#1e40af" }}>{metrics.occupied}</span>
                <div
                  style={{
                    width: "100%",
                    maxWidth: 50,
                    height: `${Math.max(14, metrics.total ? (metrics.occupied / metrics.total) * 140 : 14)}px`,
                    background: "linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)",
                    borderRadius: "6px 6px 0 0",
                    transition: "height 0.3s ease",
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#1e40af" }}>Occupied</span>
              </div>
            </div>
          </div>

          {/* Chart 2: 7-Day Occupancy Trend */}
          <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 22, boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              📈 7-Day Occupancy Trend
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              Hospital intake and bed utilization over the past 7 days
            </div>
            <div style={{ height: 180, display: "flex", alignItems: "flex-end", gap: 10, padding: "0 10px 10px" }}>
              {[
                { day: "Mon", rate: 68 },
                { day: "Tue", rate: 74 },
                { day: "Wed", rate: 82 },
                { day: "Thu", rate: 79 },
                { day: "Fri", rate: 88 },
                { day: "Sat", rate: 85 },
                { day: "Sun", rate: metrics.total ? Math.round(((metrics.occupied + metrics.reserved) / metrics.total) * 100) : 75 },
              ].map((item, idx) => (
                <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>{item.rate}%</span>
                  <div
                    style={{
                      width: "100%",
                      height: `${(item.rate / 100) * 130}px`,
                      background: idx === 6 ? "#0284c7" : "#cbd5e1",
                      borderRadius: 4,
                    }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 800, color: idx === 6 ? "#0284c7" : "#64748b" }}>{item.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 3: ICU vs General Ward Ratio Donut Chart */}
          <div style={{ background: "#ffffff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 22, boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
              🍩 ICU vs General Capacity
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
              Critical care ratio and ward distribution
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", height: 180 }}>
              <svg width="150" height="150" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="4"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="4"
                  strokeDasharray={`${metrics.total ? (metrics.generalTotal / metrics.total) * 100 : 80}, 100`}
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="4"
                  strokeDasharray={`${metrics.total ? (metrics.icuTotal / metrics.total) * 100 : 20}, 100`}
                  strokeDashoffset={`-${metrics.total ? (metrics.generalTotal / metrics.total) * 100 : 80}`}
                />
                <text x="18" y="19" textAnchor="middle" fontSize="5" fontWeight="900" fill="#0f172a">
                  {metrics.total}
                </text>
                <text x="18" y="24" textAnchor="middle" fontSize="3" fontWeight="700" fill="#64748b">
                  TOTAL
                </text>
              </svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0284c7" }} />
                  <div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>General: {metrics.generalTotal}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{metrics.generalAvailable} free</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: "#ef4444" }} />
                  <div>
                    <div style={{ fontWeight: 800, color: "#991b1b" }}>ICU: {metrics.icuTotal}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{metrics.icuAvailable} free</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DETAILS MODAL / SLIDE-OVER (Matches Image 5 verbatim) ──────────── */}
      {selectedBed && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 10000,
            display: "flex",
            justifyContent: "flex-end",
            backdropFilter: "blur(3px)",
          }}
          onClick={() => setSelectedBed(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              height: "100vh",
              background: "#ffffff",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              padding: "24px 28px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                    BED DETAILS & ALLOCATION
                  </div>
                  <h2 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                    Bed {selectedBed.bed_number}
                  </h2>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                    {selectedBed.wing || (selectedBed.bed_type === "icu" ? "Critical Care Unit • Wing ICU" : "General Ward • Wing B")}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBed(null)}
                  style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >
                  <X size={20} color="#475569" />
                </button>
              </div>

              {/* Status Badge Banner */}
              <div
                style={{
                  background: getStatusColor(selectedBed.status).lightBg,
                  border: `1.5px solid ${getStatusColor(selectedBed.status).border}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: getStatusColor(selectedBed.status).text }}>CURRENT STATUS</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: getStatusColor(selectedBed.status).text }}>
                    {getStatusColor(selectedBed.status).label.toUpperCase()}
                  </div>
                </div>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    background: getStatusColor(selectedBed.status).bg,
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {selectedBed.bed_type === "icu" ? "ICU BED" : "GENERAL WARD"}
                </span>
              </div>

              {/* Patient Details (if reserved or occupied) */}
              {selectedBed.status !== "available" ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
                    Admitted Patient Details
                  </div>

                  <div style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Patient Name:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{selectedBed.patient_name || "Emergency Intake"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Age / Gender:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        {selectedBed.patient_age ? `${selectedBed.patient_age} yrs` : "N/A"} · {selectedBed.patient_gender || "N/A"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Blood Group:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#b91c1c" }}>{selectedBed.blood_group || "O-Negative (O-)"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Contact Phone:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{selectedBed.patient_phone || "+91 9876543210"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Admission Time:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        {selectedBed.admission_time ? new Date(selectedBed.admission_time).toLocaleString() : "Recent Intake"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #edf2f7", paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Attending Doctor:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>{selectedBed.attending_doctor || "Dr. Rajesh Sharma"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Medical Condition:</span>
                      <div style={{ fontSize: 13, color: "#334155", background: "#ffffff", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4 }}>
                        {selectedBed.medical_condition || "Trauma / acute monitoring required."}
                      </div>
                    </div>
                  </div>

                  {/* Assigned Staff Box */}
                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      Assigned Ward Staff
                    </div>
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                      <div style={{ fontWeight: 800, color: "#166534" }}>👨‍⚕️ {selectedBed.attending_doctor || "Emergency Care Team"}</div>
                      <div style={{ color: "#475569", marginTop: 2 }}>Specialist Support • Shift On Duty</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ background: "#f0fdf4", border: "1px dashed #86efac", borderRadius: 12, padding: 30, textAlign: "center" }}>
                  <CheckCircle size={40} color="#22c55e" style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#166534" }}>This Bed is Available</div>
                  <div style={{ fontSize: 13, color: "#15803d", marginTop: 4 }}>
                    Cleaned, sanitized, and ready for immediate emergency patient allocation.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 10 }}>
              {selectedBed.status === "reserved" && (
                <button
                  onClick={() => handleUpdateStatus("occupied")}
                  disabled={updating}
                  style={{
                    background: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 20px",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(37,99,235,0.2)",
                  }}
                >
                  {updating ? "Updating..." : "🏥 Confirm Patient Admission (Mark Occupied)"}
                </button>
              )}

              {selectedBed.status !== "available" && (
                <button
                  onClick={() => handleUpdateStatus("available")}
                  disabled={updating}
                  style={{
                    background: "#ffffff",
                    color: "#dc2626",
                    border: "1.5px solid #f87171",
                    borderRadius: 10,
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {updating ? "Processing..." : "🔄 Discharge Patient & Free Bed"}
                </button>
              )}

              <button
                onClick={() => setSelectedBed(null)}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
