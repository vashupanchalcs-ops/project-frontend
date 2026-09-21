import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BedDouble, ShieldAlert, Activity, CheckCircle, Clock, User, Phone, Heart, Calendar, Stethoscope, Search, X, RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

const teamInitials = (member) => String(member?.full_name || member?.name || "Staff")
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join("")
  .toUpperCase() || "S";

export default function HospitalBeds() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlBookingId = searchParams.get("booking_id");
  const urlType = searchParams.get("type"); // "icu" | "general"

  const cachedBeds = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("hospital_beds_cache") || "[]");
    } catch {
      return [];
    }
  }, []);

  const cachedHosp = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("hospital_info_cache") || "null");
    } catch {
      return null;
    }
  }, []);

  const [beds, setBeds] = useState(cachedBeds);
  const [loading, setLoading] = useState(cachedBeds.length === 0);
  const [selectedBed, setSelectedBed] = useState(null);
  const [hospitalInfo, setHospitalInfo] = useState(cachedHosp);
  const [filterType, setFilterType] = useState("all"); // all, general, icu
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAllocatedTeam, setShowAllocatedTeam] = useState(false);
  const [allocatedTeamFilter, setAllocatedTeamFilter] = useState("all");
  const [allocatedTeamSearch, setAllocatedTeamSearch] = useState("");
  const [bedSearch, setBedSearch] = useState("");
  const [bedStatusFilter, setBedStatusFilter] = useState("all");
  const [bedTypeFilter, setBedTypeFilter] = useState("all");

  // Allocation Mode states
  const [targetBooking, setTargetBooking] = useState(null);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [selectedBookingIdForBed, setSelectedBookingIdForBed] = useState(urlBookingId || "");
  const icuHubRef = useRef(null);

  const allocatedTeam = useMemo(() => {
    let parsed = [];
    try { parsed = JSON.parse(selectedBed?.assigned_staff_json || "[]"); } catch { parsed = []; }
    if (!Array.isArray(parsed) || !parsed.length) {
      parsed = String(selectedBed?.attending_doctor || "").split(",").map((full_name, index) => ({ full_name: full_name.trim(), role: index === 0 ? "doctor" : "care team", specialization: "Assigned care" })).filter((item) => item.full_name);
    }
    return parsed;
  }, [selectedBed]);

  const visibleAllocatedTeam = useMemo(() => {
    const query = allocatedTeamSearch.trim().toLowerCase();
    return allocatedTeam.filter((member) => {
      const isActive = member.is_active !== false;
      const matchesStatus = allocatedTeamFilter === "all"
        || (allocatedTeamFilter === "active" && isActive)
        || (allocatedTeamFilter === "absent" && !isActive);
      const searchable = [member.full_name, member.name, member.email, member.role, member.specialization, member.contact_number].join(" ").toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [allocatedTeam, allocatedTeamFilter, allocatedTeamSearch]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Synthesize beds from hospital metrics if backend records aren't seeded yet
  const generateBedsFromHospital = (hospital, queue = []) => {
    if (!hospital || (!hospital.total_beds && !hospital.available_beds)) return [];
    const totalBeds = Number(hospital.total_beds) || 121;
    const icuBeds = Number(hospital.icu_beds) || 42;
    const generalTotal = Math.max(1, totalBeds - icuBeds);
    const availableBeds = Number(hospital.available_beds) ?? 60;
    const bookedCount = Math.max(0, totalBeds - availableBeds);

    const generated = [];
    // 1. General beds
    for (let i = 1; i <= generalTotal; i++) {
      const bedNum = `G-${String(i).padStart(3, "0")}`;
      const matchedBooking = queue[i - 1];
      let status = "available";
      let patient_name = "";
      let medical_condition = "";
      let attending_doctor = "";

      if (matchedBooking) {
        status = matchedBooking.patient_reached ? "occupied" : "reserved";
        patient_name = matchedBooking.patient_name || matchedBooking.booked_by || "";
        medical_condition = matchedBooking.patient_condition || "";
        attending_doctor = matchedBooking.assigned_doctor_names || "";
      } else if (i <= bookedCount) {
        status = i % 2 === 0 ? "occupied" : "reserved";
      }

      generated.push({
        id: 1000 + i,
        hospital_id: hospital.id,
        bed_number: bedNum,
        bed_type: "general",
        status: status,
        wing: "General Ward",
        assigned_booking_id: matchedBooking?.booking_id || null,
        patient_name: patient_name,
        patient_age: matchedBooking?.patient_age || "",
        patient_gender: matchedBooking?.patient_gender || "",
        blood_group: "",
        patient_phone: matchedBooking?.patient_contact || "",
        emergency_contact: "",
        medical_condition: medical_condition,
        vitals_summary: matchedBooking?.vitals_summary || "",
        attending_doctor: attending_doctor,
        assigned_staff_json: matchedBooking?.assigned_doctors_json || "[]",
        admission_time: matchedBooking?.created_at || null,
      });
    }

    // 2. ICU beds
    for (let j = 1; j <= icuBeds; j++) {
      const bedNum = `ICU-${String(j).padStart(3, "0")}`;
      const icuQueue = queue.filter((q) => q.icu_required || q.assigned_bed_type === "icu");
      const matchedIcu = icuQueue[j - 1];
      let status = "available";
      let patient_name = "";
      let medical_condition = "";
      let attending_doctor = "";

      if (matchedIcu) {
        status = matchedIcu.patient_reached ? "occupied" : "reserved";
        patient_name = matchedIcu.patient_name || matchedIcu.booked_by || "";
        medical_condition = matchedIcu.patient_condition || "Critical Care Required";
        attending_doctor = matchedIcu.assigned_doctor_names || "";
      }

      generated.push({
        id: 2000 + j,
        hospital_id: hospital.id,
        bed_number: bedNum,
        bed_type: "icu",
        status: status,
        wing: "ICU Hub",
        assigned_booking_id: matchedIcu?.booking_id || null,
        patient_name: patient_name,
        patient_age: matchedIcu?.patient_age || "",
        patient_gender: matchedIcu?.patient_gender || "",
        blood_group: "",
        patient_phone: matchedIcu?.patient_contact || "",
        emergency_contact: "",
        medical_condition: medical_condition,
        vitals_summary: matchedIcu?.vitals_summary || "",
        attending_doctor: attending_doctor,
        assigned_staff_json: matchedIcu?.assigned_doctors_json || "[]",
        admission_time: matchedIcu?.created_at || null,
      });
    }

    return generated;
  };

  const fetchBeds = async (silent = false) => {
    if (!silent && beds.length === 0) setLoading(true);
    try {
      // Dynamically resolve hospital ID
      let hid = Number(localStorage.getItem("hospital_id")) || null;
      const userEmail = (localStorage.getItem("user") || "").trim().toLowerCase();
      const nameHint = (localStorage.getItem("name") || "").trim().toLowerCase();

      // If no valid hid, fetch from hospitals list
      if (!hid) {
        try {
          const allH = await fetch(`${BASE}/api/hospitals/`).then((r) => r.json());
          if (Array.isArray(allH) && allH.length > 0) {
            const match =
              allH.find((h) => String(h.email || "").toLowerCase() === userEmail) ||
              allH.find((h) => nameHint && String(h.name || "").toLowerCase().includes(nameHint)) ||
              allH[0];
            if (match?.id) {
              hid = match.id;
              localStorage.setItem("hospital_id", String(match.id));
            }
          }
        } catch {}
      }

      const effectiveHid = hid || 2; // Default to AIIMS (id: 2) if still unresolved

      const [bedsRes, hospRes] = await Promise.all([
        fetch(`${BASE}/api/hospitals/${effectiveHid}/beds/?_=${Date.now()}`, { cache: "no-store" }).catch(() => null),
        fetch(`${BASE}/api/hospitals/${effectiveHid}/dashboard/?_=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      ]);

      let finalHosp = null;
      let queue = [];
      if (hospRes && hospRes.ok) {
        const hData = await hospRes.json();
        finalHosp = hData.hospital || null;
        queue = Array.isArray(hData.queue) ? hData.queue : [];
        setHospitalInfo(finalHosp);
        try {
          sessionStorage.setItem("hospital_info_cache", JSON.stringify(finalHosp));
        } catch {}
      }

      let loadedBeds = [];
      if (bedsRes && bedsRes.ok) {
        const bedsData = await bedsRes.json();
        if (Array.isArray(bedsData) && bedsData.length > 0) {
          // Ignore stale/legacy summary objects accidentally returned by an
          // older endpoint. A real bed always has a number and a valid status.
          loadedBeds = bedsData.filter((bed) =>
            bed && String(bed.bed_number || "").trim() &&
            ["available", "reserved", "occupied"].includes(String(bed.status || "").toLowerCase())
          );
        }
      }

      // If the deployment has not seeded HospitalBed rows yet, show the
      // hospital's configured capacity in the same row/column layout. Once
      // the backend returns persisted rows, those records remain authoritative.
      if (loadedBeds.length === 0 && finalHosp) {
        loadedBeds = generateBedsFromHospital(finalHosp, queue);
      }
      if (loadedBeds.length === 0 && bedsRes && !bedsRes.ok) {
        throw new Error("Unable to load beds");
      }

      // The booking is the source of truth for the complete allocated team.
      // Refresh older bed records that may contain only a partial staff JSON.
      if (queue.length && loadedBeds.length) {
        loadedBeds = loadedBeds.map((bed) => {
          const booking = queue.find((item) => String(item.booking_id || item.id) === String(bed.assigned_booking_id));
          return booking?.assigned_doctors_json && booking.assigned_doctor_names
            ? { ...bed, assigned_staff_json: booking.assigned_doctors_json, attending_doctor: booking.assigned_doctor_names }
            : bed;
        });
      }

      setBeds(loadedBeds);
      try {
        sessionStorage.setItem("hospital_beds_cache", JSON.stringify(loadedBeds));
      } catch {}
    } catch {
      showToast("Error loading hospital beds", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeds(beds.length > 0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchBeds(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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

  const visibleBeds = useMemo(() => {
    const query = bedSearch.trim().toLowerCase();
    return beds.filter((bed) => {
      const matchesText = !query || [bed.bed_number, bed.wing, bed.patient_name, bed.attending_doctor]
        .some((value) => String(value || "").toLowerCase().includes(query));
      return matchesText &&
        (bedStatusFilter === "all" || bed.status === bedStatusFilter) &&
        (bedTypeFilter === "all" || bed.bed_type === bedTypeFilter);
    });
  }, [beds, bedSearch, bedStatusFilter, bedTypeFilter]);

  const visibleGeneralBeds = useMemo(() => visibleBeds.filter((b) => b.bed_type === "general"), [visibleBeds]);
  const visibleIcuBeds = useMemo(() => visibleBeds.filter((b) => b.bed_type === "icu"), [visibleBeds]);

  // Status Actions with OPTIMISTIC UPDATE
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedBed) return;
    setUpdating(true);
    const bedId = selectedBed.id;
    const payload = { status: newStatus };
    if (newStatus === "available") {
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

    // 1. Optimistically update local state immediately (no delay, no fluctuation)
    const updatedBed = { ...selectedBed, ...payload };
    setSelectedBed(updatedBed);
    setBeds((prev) => prev.map((b) => (b.id === bedId ? updatedBed : b)));
    showToast(`Bed ${selectedBed.bed_number} updated to ${newStatus.toUpperCase()}`);

    // 2. Send patch to backend silently
    try {
      const response = await fetch(`${BASE}/api/hospitals/beds/${bedId}/?_=${Date.now()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const savedBed = await response.json().catch(() => null);
      if (!response.ok || !savedBed?.id) throw new Error(savedBed?.error || "Unable to update bed");
      setSelectedBed(savedBed);
      setBeds((current) => current.map((bed) => bed.id === savedBed.id ? savedBed : bed));
      try {
        const cached = JSON.parse(sessionStorage.getItem("hospital_beds_cache") || "[]");
        sessionStorage.setItem("hospital_beds_cache", JSON.stringify(cached.map((bed) => bed.id === savedBed.id ? savedBed : bed)));
      } catch {}
    } catch (error) {
      showToast(error.message || "Unable to update bed", "error");
      await fetchBeds(true);
    }
    setUpdating(false);
  };

  // Load target booking and pending bookings for Allocation Mode
  useEffect(() => {
    let isMounted = true;
    const loadBookingData = async () => {
      let foundTarget = null;
      let allPending = [];

      try {
        const portalCache = JSON.parse(sessionStorage.getItem("hospital_portal_cache") || "null");
        if (portalCache?.queue && Array.isArray(portalCache.queue)) {
          allPending = portalCache.queue.map((q) => ({
            id: q.booking_id,
            patient_name: q.patient_name,
            booked_by: q.booked_by,
            patient_age: q.patient_age,
            patient_gender: q.patient_gender,
            patient_contact_number: q.patient_contact,
            patient_condition: q.patient_condition,
            vitals_summary: q.vitals_summary,
            assigned_doctor_names: q.assigned_doctor_names,
            assigned_doctors_json: q.assigned_doctors_json,
            assigned_bed_id: q.assigned_bed_id,
            assigned_bed_number: q.assigned_bed_number,
            assigned_bed_type: q.assigned_bed_type,
            icu_required: q.icu_required,
            hospital_response: q.hospital_response,
          }));
        }
      } catch {}

      try {
        const myBookingsCache = JSON.parse(sessionStorage.getItem("my_bookings_cache") || "[]");
        if (Array.isArray(myBookingsCache)) {
          myBookingsCache.forEach((b) => {
            if (!allPending.find((p) => p.id === b.id)) {
              allPending.push(b);
            }
          });
        }
      } catch {}

      if (urlBookingId) {
        foundTarget = allPending.find((b) => String(b.id) === String(urlBookingId));
        if (!foundTarget) {
          try {
            const res = await fetch(`${BASE}/api/bookings/${urlBookingId}/`);
            if (res.ok) {
              foundTarget = await res.json();
              if (!allPending.find((p) => p.id === foundTarget.id)) {
                allPending.push(foundTarget);
              }
            }
          } catch {}
        }
      }

      if (allPending.length === 0) {
        try {
          const res = await fetch(`${BASE}/api/bookings/`);
          if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list)) {
              allPending = list.filter((b) => b.status !== "cancelled");
              if (urlBookingId && !foundTarget) {
                foundTarget = allPending.find((b) => String(b.id) === String(urlBookingId));
              }
            }
          }
        } catch {}
      }

      if (isMounted) {
        setPendingBookings(allPending);
        if (foundTarget) {
          setTargetBooking(foundTarget);
          setSelectedBookingIdForBed(String(foundTarget.id));
        }
      }
    };

    loadBookingData();
    return () => { isMounted = false; };
  }, [urlBookingId]);

  // Auto-scroll to ICU Hub if requested or required
  useEffect(() => {
    if (urlType === "icu" || targetBooking?.icu_required) {
      const timer = setTimeout(() => {
        if (icuHubRef.current) {
          icuHubRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [urlType, targetBooking?.icu_required]);

  // Explicit Bed Allocation to a specific Booking
  const handleAssignBedToBooking = async (bed, booking) => {
    if (!bed || !booking) return;
    setUpdating(true);
    const bedId = bed.id;
    const bookingId = booking.id;

    const payload = {
      status: "reserved",
      assigned_booking_id: bookingId,
      patient_name: booking.patient_name || booking.booked_by || "Emergency Intake",
      patient_age: booking.patient_age || "",
      patient_gender: booking.patient_gender || "",
      patient_phone: booking.patient_contact_number || "",
      medical_condition: booking.patient_condition || (bed.bed_type === "icu" ? "Critical Care Required" : "General Inpatient Care"),
      vitals_summary: booking.vitals_summary || "",
      attending_doctor: booking.assigned_doctor_names || "",
      assigned_staff_json: booking.assigned_doctors_json || "[]",
      admission_time: new Date().toISOString(),
    };

    // 1. Optimistically update local beds list and selectedBed immediately
    const updatedBed = { ...bed, ...payload };
    setSelectedBed(updatedBed);
    setBeds((prev) =>
      prev.map((b) => {
        if (b.id === bedId) return updatedBed;
        // If this booking previously held another bed, free it!
        if (b.assigned_booking_id === bookingId && b.id !== bedId) {
          return {
            ...b,
            status: "available",
            assigned_booking_id: null,
            patient_name: "",
            patient_age: "",
            patient_gender: "",
            patient_phone: "",
            medical_condition: "",
            vitals_summary: "",
            attending_doctor: "",
            assigned_staff_json: "[]",
            admission_time: null,
          };
        }
        return b;
      })
    );

    // 2. Update targetBooking state
    const updatedTarget = {
      ...booking,
      assigned_bed_id: bed.id,
      assigned_bed_number: bed.bed_number,
      assigned_bed_type: bed.bed_type,
    };
    setTargetBooking(updatedTarget);

    showToast(`✅ Bed ${bed.bed_number} successfully assigned to ${booking.patient_name || booking.booked_by}!`);

    // 3. Update sessionStorage caches
    try {
      const pc = JSON.parse(sessionStorage.getItem("hospital_portal_cache") || "null");
      if (pc && Array.isArray(pc.queue)) {
        pc.queue = pc.queue.map((q) =>
          Number(q.booking_id) === Number(bookingId)
            ? { ...q, assigned_bed_id: bed.id, assigned_bed_number: bed.bed_number, assigned_bed_type: bed.bed_type }
            : q
        );
        sessionStorage.setItem("hospital_portal_cache", JSON.stringify(pc));
      }
      const mc = JSON.parse(sessionStorage.getItem("my_bookings_cache") || "[]");
      if (Array.isArray(mc)) {
        sessionStorage.setItem("my_bookings_cache", JSON.stringify(mc.map((b) =>
          Number(b.id) === Number(bookingId)
            ? { ...b, assigned_bed_id: bed.id, assigned_bed_number: bed.bed_number, assigned_bed_type: bed.bed_type }
            : b
        )));
      }
      const rc = JSON.parse(sessionStorage.getItem("admin_requests_cache") || "[]");
      if (Array.isArray(rc)) {
        sessionStorage.setItem("admin_requests_cache", JSON.stringify(rc.map((b) =>
          Number(b.id) === Number(bookingId)
            ? { ...b, assigned_bed_id: bed.id, assigned_bed_number: bed.bed_number, assigned_bed_type: bed.bed_type }
            : b
        )));
      }
    } catch {}

    // 4. Send API requests in parallel
    try {
      const hid = Number(hospitalInfo?.id || localStorage.getItem("hospital_id")) || 2;
      await Promise.all([
        fetch(`${BASE}/api/hospitals/${hid}/beds/assign/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: bookingId,
            bed_id: bed.id,
            bed_type: bed.bed_type,
          }),
        }).catch(() => null),
        fetch(`${BASE}/api/bookings/${bookingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_bed_id: bed.id,
            assigned_bed_number: bed.bed_number,
            assigned_bed_type: bed.bed_type,
          }),
        }).catch(() => null),
        fetch(`${BASE}/api/hospitals/beds/${bed.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => null),
      ]);
    } catch {}

    setUpdating(false);
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

      <div style={{ width: "100%", maxWidth: "none", margin: 0, padding: "20px 18px 72px", boxSizing: "border-box" }}>
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

        {/* ── ALLOCATION MODE BANNER ────────────────────────────────────────── */}
        {targetBooking && (
          <div
            style={{
              background: targetBooking.icu_required || urlType === "icu" ? "#fef2f2" : "#eff6ff",
              border: `2px solid ${targetBooking.icu_required || urlType === "icu" ? "#ef4444" : "#3b82f6"}`,
              borderRadius: 16,
              padding: "18px 24px",
              marginBottom: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
              boxShadow: targetBooking.icu_required || urlType === "icu"
                ? "0 8px 24px rgba(239,68,68,0.12)"
                : "0 8px 24px rgba(59,130,246,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: targetBooking.icu_required || urlType === "icu" ? "#fee2e2" : "#dbeafe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                {targetBooking.icu_required || urlType === "icu" ? "🚨" : "🛏️"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      background: targetBooking.icu_required || urlType === "icu" ? "#dc2626" : "#2563eb",
                      color: "#ffffff",
                      padding: "3px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {targetBooking.icu_required || urlType === "icu" ? "ICU BED ALLOCATION ACTIVE" : "BED ALLOCATION ACTIVE"}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>
                    Booking #{targetBooking.id}
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                  Patient: {targetBooking.patient_name || targetBooking.booked_by || "Emergency Patient"}
                  {targetBooking.patient_age && (
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginLeft: 8 }}>
                      ({targetBooking.patient_age} yrs, {targetBooking.patient_gender || "N/A"})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: targetBooking.icu_required || urlType === "icu" ? "#991b1b" : "#1e40af", marginTop: 4, fontWeight: 700 }}>
                  👉 Click on any <span style={{ textDecoration: "underline" }}>AVAILABLE</span> {targetBooking.icu_required || urlType === "icu" ? "ICU Bed box (Red Hub)" : "Bed box (General Ward / ICU)"} below to open its details and click <b>"Assign This Bed"</b>!
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => {
                  setTargetBooking(null);
                  navigate("/hospital/beds", { replace: true });
                }}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Exit Allocation Mode
              </button>
              <button
                onClick={() => navigate("/hospital/queue")}
                style={{
                  background: targetBooking.icu_required || urlType === "icu" ? "#dc2626" : "#2563eb",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ← Back to Queue
              </button>
            </div>
          </div>
        )}

        {/* Reference-style search and ward filters */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={bedSearch} onChange={(e) => setBedSearch(e.target.value)} placeholder="Search bed, room or patient" style={{ flex: "1 1 260px", minWidth: 220, border: "1px solid #cbd5e1", borderRadius: 7, padding: "10px 12px", fontSize: 13 }} />
          <select value={bedTypeFilter} onChange={(e) => setBedTypeFilter(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 7, padding: "10px 12px", fontSize: 13 }}>
            <option value="all">All wards</option><option value="general">General</option><option value="icu">ICU</option>
          </select>
          <select value={bedStatusFilter} onChange={(e) => setBedStatusFilter(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 7, padding: "10px 12px", fontSize: 13 }}>
            <option value="all">All statuses</option><option value="available">Available</option><option value="reserved">Booked</option><option value="occupied">Occupied</option>
          </select>
          <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 12, fontWeight: 700 }}>{visibleBeds.length} of {beds.length} beds shown</span>
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
              AVAILABLE BEDS
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
              RESERVED / BOOKED
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
              OCCUPIED BEDS
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#1e40af", marginTop: 4 }}>{metrics.occupied}</div>
            <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4 }}>
              Patient admitted & receiving care
            </div>
          </div>
        </div>

        {/* ── SECTION 3: ANALYTICS & OCCUPANCY CHARTS ──────────────────────── */}
        <div style={{ display: "none" }}>
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

        {/* ── SECTION 1: GENERAL WARD BEDS GRID ────────────────────────────── */}
        <div style={{ width: "100%", boxSizing: "border-box", marginLeft: 0, marginRight: 0, display: visibleGeneralBeds.length ? "block" : "none", background: "#ffffff", borderRadius: "16px 16px 0 0", border: "1px solid #e2e8f0", padding: 20, marginBottom: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 14 }}>
              {visibleGeneralBeds.map((bed) => {
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
                      minHeight: 108,
                      padding: "18px 10px",
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
        <div
          ref={icuHubRef}
          id="icu-hub"
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginLeft: 0,
            marginRight: 0,
            display: visibleIcuBeds.length ? "block" : "none",
            background: "#ffffff",
            borderRadius: "0 0 16px 16px",
            border: targetBooking?.icu_required || urlType === "icu" ? "2.5px solid #dc2626" : "1.5px solid #fca5a5",
            padding: 24,
            marginBottom: 20,
            boxShadow: targetBooking?.icu_required || urlType === "icu" ? "0 0 25px rgba(220,38,38,0.18)" : "0 4px 16px rgba(239,68,68,0.04)",
            transition: "all 0.3s ease",
          }}
        >
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 14 }}>
              {visibleIcuBeds.map((bed) => {
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
                      minHeight: 108,
                      padding: "18px 12px",
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
            background: "rgba(15, 23, 42, 0.65)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedBed(null)}
        >
          {showAllocatedTeam && (
            <div
              className="beds-team-pane"
              onClick={(event) => event.stopPropagation()}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100vh",
                overflowY: "auto",
                background: "#eff6f5",
                color: "#173645",
                padding: "28px clamp(22px, 4vw, 56px)",
              }}
            >
              <div style={{ maxWidth: 980, margin: "0 auto" }}>
                <button
                  className="beds-team-back-button"
                  onClick={() => setShowAllocatedTeam(false)}
                  style={{
                    border: "1px solid #f2b233",
                    background: "#f2b233",
                    color: "#173645",
                    borderRadius: 9,
                    padding: "9px 14px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  ← Back to bed details
                </button>

                <div style={{ marginTop: 30 }}>
                  <div style={{ color: "#475569", fontSize: 11, fontWeight: 900, letterSpacing: ".6px" }}>
                    ALLOCATED BED · LIVE TEAM
                  </div>
                  <h1 style={{ margin: "6px 0 4px", fontSize: 32, lineHeight: 1.1, color: "#0f172a" }}>
                    Assigned care team
                  </h1>
                  <div style={{ color: "#64748b", fontSize: 14 }}>
                    Bed {selectedBed.bed_number} · {selectedBed.patient_name || "Emergency patient"}
                  </div>
                </div>

                <div style={{ marginTop: 24, background: "#ffffff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 14, padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>{selectedBed.patient_name || "Emergency patient"}</div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>{selectedBed.medical_condition || "Clinical care"}</div>
                  </div>
                  <span style={{ background: "#f2b233", color: "#173645", borderRadius: 999, padding: "6px 11px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {selectedBed.status === "occupied" ? "Occupied" : "Reserved / booked"}
                  </span>
                </div>

                <div style={{ marginTop: 24, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 12, padding: 14, color: "#334155", fontWeight: 800 }}>
                  ✓ Team allocated · assigned to this patient and bed
                </div>

                <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>Members</h2>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>Assigned multidisciplinary team</div>
                  </div>
                  <span style={{ color: "#64748b", fontSize: 11, fontWeight: 900 }}>{visibleAllocatedTeam.length} OF {allocatedTeam.length} MEMBERS</span>
                </div>

                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", padding: 3, gap: 3, background: "#f1f5f9", borderRadius: 9 }}>
                    {[["all", "All"], ["active", "Active"], ["absent", "Absent"]].map(([key, label]) => <button key={key} onClick={() => setAllocatedTeamFilter(key)} style={{ border: 0, borderRadius: 7, padding: "7px 12px", background: allocatedTeamFilter === key ? "#ffffff" : "transparent", color: "#334155", fontWeight: 800, cursor: "pointer", boxShadow: allocatedTeamFilter === key ? "0 1px 4px rgba(15,23,42,.12)" : "none" }}>{label}</button>)}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto", minWidth: 210, border: "1px solid #cbd5e1", borderRadius: 8, padding: "7px 10px", background: "#ffffff", color: "#94a3b8" }}>
                    <Search size={15} />
                    <input value={allocatedTeamSearch} onChange={(event) => setAllocatedTeamSearch(event.target.value)} placeholder="Search members" style={{ width: "100%", border: 0, outline: 0, fontSize: 12, color: "#334155" }} />
                  </label>
                </div>

                {visibleAllocatedTeam.length ? (
                  <div style={{ marginTop: 12, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#ffffff" }}>
                    <div style={{ minWidth: 820 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "44px minmax(180px,1.35fr) minmax(190px,1.4fr) 118px 102px 84px 36px", gap: 12, alignItems: "center", padding: "11px 14px", background: "#f8fafc", color: "#64748b", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".05em" }}>
                        <span />
                        <span>Employee</span>
                        <span>Contact</span>
                        <span>Department</span>
                        <span>Status</span>
                        <span>Experience</span>
                        <span />
                      </div>
                    {visibleAllocatedTeam.map((member, index) => (
                      <div key={`${member.id || member.full_name}-${index}`} style={{ display: "grid", gridTemplateColumns: "44px minmax(180px,1.35fr) minmax(190px,1.4fr) 118px 102px 84px 36px", gap: 12, alignItems: "center", padding: "12px 14px", borderTop: "1px solid #edf2f7", color: "#334155", fontSize: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", background: "#e2e8f0", color: "#334155", fontWeight: 900, fontSize: 11 }}>{teamInitials(member)}</div>
                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 850, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.full_name || member.name || "Staff member"}</div><div style={{ marginTop: 3, color: "#64748b", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.specialization || "General care"}</div></div>
                        <div style={{ minWidth: 0 }}><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.email || "Email not added"}</div><div style={{ marginTop: 3, color: "#64748b", fontSize: 11 }}>{member.contact_number || "Contact not added"}</div></div>
                        <span style={{ display: "inline-flex", width: "fit-content", maxWidth: "100%", padding: "5px 8px", borderRadius: 999, background: "#f1f5f9", color: "#334155", fontSize: 10, fontWeight: 900, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{member.role || "Care team"}</span>
                        <span style={{ display: "inline-flex", width: "fit-content", padding: "5px 8px", borderRadius: 999, background: "#f1f5f9", color: "#334155", fontSize: 10, fontWeight: 900 }}>{member.is_active === false ? "Inactive" : "Assigned"}</span>
                        <span style={{ color: "#475569", whiteSpace: "nowrap" }}>{member.years_experience != null ? `${member.years_experience} yrs` : "—"}</span>
                        <button aria-label={`View ${member.full_name || member.name || "staff"}`} style={{ width: 28, height: 28, border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", color: "#475569", fontWeight: 900, cursor: "pointer" }}>•••</button>
                      </div>
                    ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: 14, padding: 22, color: "#64748b" }}>
                    No allocated staff team is available for this bed yet.
                  </div>
                )}
              </div>
            </div>
          )}
          <div
            className="beds-details-drawer"
            style={{
              width: "100%",
              maxWidth: 540,
              height: "100vh",
              maxHeight: "100vh",
              background: "#ffffff",
              boxShadow: "none",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              zIndex: 100000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header — never covered by TopNavbar */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#ffffff",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  BED DETAILS & ALLOCATION
                </div>
                <h2 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
                  Bed {selectedBed.bed_number}
                </h2>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  {selectedBed.wing || (selectedBed.bed_type === "icu" ? "Critical Care Unit • Wing ICU" : "General Ward • Wing B")}
                </div>
              </div>
              <button
                onClick={() => setSelectedBed(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: 38,
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={20} color="#475569" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
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
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8" }}>{selectedBed.attending_doctor || "Dr. Rajesh Sharma"}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Medical Condition:</span>
                      <div style={{ fontSize: 13, color: "#334155", background: "#ffffff", padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", marginTop: 4 }}>
                        {selectedBed.medical_condition || "Trauma / acute monitoring required."}
                      </div>
                    </div>
                  </div>

                  {/* Assigned Staff Box */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      Assigned Ward Staff
                    </div>
                    <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
                      <div style={{ fontWeight: 800, color: "#334155" }}>👨‍⚕️ {selectedBed.attending_doctor || "Emergency Care Team"}</div>
                      <div style={{ color: "#475569", marginTop: 2 }}>Specialist Support • Shift On Duty</div>
                      {selectedBed.status !== "available" && <button onClick={() => { setAllocatedTeamFilter("all"); setAllocatedTeamSearch(""); setShowAllocatedTeam(true); }} style={{ marginTop: 9, border: 0, borderRadius: 8, padding: "8px 12px", background: "#334155", color: "#fff", fontWeight: 800, cursor: "pointer" }}>👥 View allocated team</button>}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "#f0fdf4", border: "1px dashed #86efac", borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                    <CheckCircle size={36} color="#22c55e" style={{ margin: "0 auto 6px" }} />
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#166534" }}>This Bed is Available</div>
                    <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
                      Cleaned, sanitized, and ready for immediate patient allocation.
                    </div>
                  </div>

                  {/* Target Booking Details (if in allocation mode) */}
                  {targetBooking ? (
                    <div
                      style={{
                        background: targetBooking.icu_required || selectedBed.bed_type === "icu" ? "#fef2f2" : "#eff6ff",
                        border: `1.5px solid ${targetBooking.icu_required || selectedBed.bed_type === "icu" ? "#fca5a5" : "#93c5fd"}`,
                        borderRadius: 12,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: targetBooking.icu_required || selectedBed.bed_type === "icu" ? "#fee2e2" : "#dbeafe",
                            color: targetBooking.icu_required || selectedBed.bed_type === "icu" ? "#991b1b" : "#1e40af",
                          }}
                        >
                          {targetBooking.icu_required || selectedBed.bed_type === "icu" ? "🚨 ALLOCATION TARGET (ICU)" : "🛏️ ALLOCATION TARGET"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                          Booking #{targetBooking.id}
                        </span>
                      </div>

                      <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                        {targetBooking.patient_name || targetBooking.booked_by || "Emergency Patient"}
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        {targetBooking.patient_age ? `${targetBooking.patient_age} yrs` : "Age N/A"} • {targetBooking.patient_gender || "Gender N/A"}
                        {targetBooking.patient_contact_number && ` • 📞 ${targetBooking.patient_contact_number}`}
                      </div>

                      {targetBooking.patient_condition && (
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                          <b style={{ color: "#0f172a" }}>Condition:</b> <span style={{ color: "#475569" }}>{targetBooking.patient_condition}</span>
                        </div>
                      )}

                      {targetBooking.vitals_summary && (
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                          <b style={{ color: "#0f172a" }}>Vitals:</b> <span style={{ color: "#475569" }}>{targetBooking.vitals_summary}</span>
                        </div>
                      )}

                      {targetBooking.assigned_doctor_names && (
                        <div style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>
                          👨‍⚕️ Assigned Doctor: {targetBooking.assigned_doctor_names}
                        </div>
                      )}

                      {targetBooking.icu_required && selectedBed.bed_type !== "icu" && (
                        <div style={{ background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8, padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#d48806" }}>
                          ⚠️ Notice: Driver flagged that patient urgently requires an ICU bed. You are assigning a General Ward bed.
                        </div>
                      )}
                    </div>
                  ) : pendingBookings.length > 0 ? (
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: "#334155", display: "block", marginBottom: 6 }}>
                        Assign this bed to an active emergency case:
                      </label>
                      <select
                        value={selectedBookingIdForBed}
                        onChange={(e) => {
                          setSelectedBookingIdForBed(e.target.value);
                          const match = pendingBookings.find((pb) => String(pb.id) === String(e.target.value));
                          setTargetBooking(match || null);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          fontSize: 12,
                          fontWeight: 700,
                          background: "#ffffff",
                          color: "#0f172a",
                        }}
                      >
                        <option value="">-- Choose Patient / Booking --</option>
                        {pendingBookings.map((pb) => (
                          <option key={pb.id} value={pb.id}>
                            Booking #{pb.id} - {pb.patient_name || pb.booked_by} {pb.icu_required ? "(🚨 ICU Flagged)" : ""} {pb.assigned_bed_number ? `[Bed: ${pb.assigned_bed_number}]` : "[No Bed Yet]"}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Sticky Action Footer — always visible */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
                position: "sticky",
                bottom: 0,
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* PRIMARY ALLOCATE BUTTON — Click to assign this specific bed */}
              {selectedBed.status === "available" && targetBooking && (
                <button
                  onClick={() => handleAssignBedToBooking(selectedBed, targetBooking)}
                  disabled={updating}
                  style={{
                    background: selectedBed.bed_type === "icu" ? "#dc2626" : "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "14px 20px",
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: selectedBed.bed_type === "icu"
                      ? "0 4px 14px rgba(220,38,38,0.3)"
                      : "0 4px 14px rgba(22,163,74,0.3)",
                    transition: "transform 0.1s ease",
                  }}
                >
                  {updating ? (
                    "Assigning Bed..."
                  ) : selectedBed.bed_type === "icu" ? (
                    <>🚨 Assign ICU Bed {selectedBed.bed_number} to Booking #{targetBooking.id}</>
                  ) : (
                    <>🎯 Assign Bed {selectedBed.bed_number} to Booking #{targetBooking.id}</>
                  )}
                </button>
              )}

              {/* SUCCESS RETURN BUTTON if this bed is assigned to targetBooking */}
              {selectedBed.status === "reserved" && targetBooking && selectedBed.assigned_booking_id === targetBooking.id && (
                <button
                  onClick={() => navigate("/hospital/queue")}
                  style={{
                    background: "#0f766e",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 20px",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  ← Return to Emergency Queue
                </button>
              )}

              {selectedBed.status === "reserved" && (!targetBooking || selectedBed.assigned_booking_id !== targetBooking.id) && (
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
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
