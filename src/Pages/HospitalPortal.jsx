import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { MoreVertical, Stethoscope, BedSingle, Accessibility } from "lucide-react";

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const getTabFromPath = (pathname) => {
  const p = String(pathname || "").toLowerCase();
  if (p.includes("/hospital/queue")) return "queue";
  if (p.includes("/hospital/responses")) return "responses";
  if (p.includes("/hospital/reports")) return "reports";
  if (p.includes("/hospital/live-track")) return "map";
  if (p.includes("/hospital/tracking")) return "tracking";
  if (p.includes("/hospital/resources")) return "resources";
  if (p.includes("/hospital/staff")) return "staff";
  if (p.includes("/hospital/cases")) return "cases";
  if (p.includes("/hospital/analytics")) return "analytics";
  return "home";
};

export default function HospitalPortal() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getTabFromPath(location.pathname);
  const [hospital, setHospital] = useState(null);
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState([]);
  const [staff, setStaff] = useState([]);
  const [onCallSpecialists, setOnCallSpecialists] = useState([]);
  const [redirectSuggestion, setRedirectSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [resourceEditMode, setResourceEditMode] = useState(false);
  const [resourceForm, setResourceForm] = useState({
    available_beds: 0,
    icu_beds: 0,
    available_ventilators: 0,
    status: "active",
    specializations: "",
    facilities: "",
  });
  const [staffForm, setStaffForm] = useState({
    full_name: "",
    role: "doctor",
    specialization: "",
    contact_number: "",
    email: "",
    photo_data: "",
    banner_data: "",
    years_experience: 0,
    is_on_call: false,
    is_active: true,
  });
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({
    full_name: "",
    role: "doctor",
    specialization: "",
    contact_number: "",
    email: "",
    photo_data: "",
    banner_data: "",
    years_experience: 0,
    is_on_call: false,
    is_active: true,
  });

  const hospitalEmail = (localStorage.getItem("user") || "").trim().toLowerCase();
  const storedHospitalId = Number(localStorage.getItem("hospital_id")) || null;

  const fetchHospitalDashboard = async ({ silent = false } = {}) => {
    if (!hospitalEmail && !storedHospitalId) return;
    if (!silent) setLoading(true);
    if (!silent) setErr("");
    try {
      let hospitalData = null;

      // Hospital ID is verified during login and remains valid if the contact
      // email is later updated in the hospital profile.
      if (storedHospitalId) {
        const byId = await fetch(`${BASE}/api/hospitals/${storedHospitalId}/`);
        if (byId.ok) hospitalData = await byId.json();
      }

      if (!hospitalData && hospitalEmail) {
        const byEmail = await fetch(`${BASE}/api/hospitals/by-email/?email=${encodeURIComponent(hospitalEmail)}`);
        if (byEmail.ok) hospitalData = await byEmail.json();
      }

      const hospitalId = Number(hospitalData?.id || hospitalData?.hospital_id);
      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        throw new Error("Hospital profile not configured for this account");
      }

      const dashRes = await fetch(`${BASE}/api/hospitals/${hospitalId}/dashboard/`);
      if (!dashRes.ok) throw new Error("Unable to load hospital dashboard");
      const dashboard = await dashRes.json();

      setHospital(dashboard.hospital || hospitalData);
      setSummary(dashboard.summary || null);
      setQueue(Array.isArray(dashboard.queue) ? dashboard.queue : []);
      setStaff(Array.isArray(dashboard.staff) ? dashboard.staff : []);
      setOnCallSpecialists(Array.isArray(dashboard.on_call_specialists) ? dashboard.on_call_specialists : []);
      setRedirectSuggestion(dashboard.redirect_suggestion || null);

      setResourceForm({
        available_beds: dashboard.hospital?.available_beds ?? 0,
        icu_beds: dashboard.hospital?.icu_beds ?? 0,
        available_ventilators: dashboard.hospital?.available_ventilators ?? 0,
        status: dashboard.hospital?.status || "active",
        specializations: dashboard.hospital?.specializations || "",
        facilities: dashboard.hospital?.facilities || "",
      });
      setLastSyncedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      if (!silent) setErr(e.message || "Something went wrong");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitalDashboard({ silent: false });
    const pollMs = activeTab === "tracking" || activeTab === "map" || activeTab === "queue" || activeTab === "responses" ? 7000 : 18000;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchHospitalDashboard({ silent: true });
    }, pollMs);
    return () => clearInterval(t);
  }, [hospitalEmail, storedHospitalId, activeTab]);

  const updateResources = async () => {
    if (!hospital?.id) return;
    try {
      const res = await fetch(`${BASE}/api/hospitals/${hospital.id}/resources/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resourceForm),
      });
      if (!res.ok) throw new Error("Resource update failed");
      await fetchHospitalDashboard();
      setResourceEditMode(false);
    } catch {
      setErr("Resource update failed");
    }
  };

  const addStaff = async () => {
    if (!hospital?.id || !staffForm.full_name.trim()) return;
    try {
      const res = await fetch(`${BASE}/api/hospitals/${hospital.id}/staff/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffForm),
      });
      if (!res.ok) throw new Error("Unable to add staff");
      setStaffForm({
        full_name: "",
        role: "doctor",
        specialization: "",
        contact_number: "",
        email: "",
        photo_data: "",
        banner_data: "",
        years_experience: 0,
        is_on_call: false,
        is_active: true,
      });
      setShowAddStaffForm(false);
      await fetchHospitalDashboard();
    } catch {
      setErr("Unable to add staff");
    }
  };

  const updateHospitalResponse = async (bookingId, response) => {
    try {
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/hospital-response/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospital_response: response,
          hospital_response_note: response === "ready" ? "Hospital intake ready" : "No immediate bed/staff availability",
        }),
      });
      if (!res.ok) throw new Error("Response update failed");
      await fetchHospitalDashboard();
    } catch {
      setErr("Unable to update hospital response");
    }
  };

  const goToLiveTrack = (booking) => {
    const bid = Number(booking?.booking_id || booking?.id || 0);
    if (bid > 0) {
      navigate(`/hospital/live-track?booking_id=${bid}`);
      return;
    }
    navigate("/hospital/live-track");
  };

  const trackingRows = useMemo(
    () => queue.filter((q) => q.ambulance_live?.latitude && q.ambulance_live?.longitude),
    [queue]
  );
  const selectedTrackingBookingId = useMemo(
    () => Number(new URLSearchParams(location.search).get("booking_id") || 0),
    [location.search]
  );
  const [selectedMapBookingId, setSelectedMapBookingId] = useState(0);
  const [hiddenMapBookingIds, setHiddenMapBookingIds] = useState([]);
  const [isFullRouteView, setIsFullRouteView] = useState(false);
  const [mapMenuOpenId, setMapMenuOpenId] = useState(0);
  const [deletingBookingId, setDeletingBookingId] = useState(0);
  const [openCaseId, setOpenCaseId] = useState(0);

  useEffect(() => {
    if (selectedTrackingBookingId > 0) setSelectedMapBookingId(selectedTrackingBookingId);
  }, [selectedTrackingBookingId]);

  useEffect(() => {
    if (activeTab !== "home") return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".hp-home-anim", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62, stagger: 0.08, ease: "power2.out" });
      gsap.fromTo(".hp-home-chip", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.52, stagger: 0.06, delay: 0.24, ease: "power2.out" });
      gsap.fromTo(".hp-home-video", { scale: 1.08 }, { scale: 1, duration: 1.1, ease: "power2.out" });
    });
    return () => ctx.revert();
  }, [activeTab, hospital?.id]);

  useEffect(() => {
    setIsFullRouteView(false);
  }, [selectedMapBookingId]);

  const visibleTrackingRows = useMemo(
    () => trackingRows.filter((r) => !hiddenMapBookingIds.includes(Number(r.booking_id))),
    [trackingRows, hiddenMapBookingIds]
  );

  const selectedMapBooking = useMemo(
    () => visibleTrackingRows.find((r) => Number(r.booking_id) === Number(selectedMapBookingId)) || visibleTrackingRows[0] || null,
    [visibleTrackingRows, selectedMapBookingId]
  );

  const mapEmbedSrc = useMemo(() => {
    const lat = Number(selectedMapBooking?.ambulance_live?.latitude);
    const lng = Number(selectedMapBooking?.ambulance_live?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
  }, [selectedMapBooking]);

  const fullRouteEmbedSrc = useMemo(() => {
    const lat = Number(selectedMapBooking?.ambulance_live?.latitude);
    const lng = Number(selectedMapBooking?.ambulance_live?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    const hospitalLat = Number(hospital?.latitude);
    const hospitalLng = Number(hospital?.longitude);
    const hospitalCoord =
      Number.isFinite(hospitalLat) && Number.isFinite(hospitalLng)
        ? `${hospitalLat},${hospitalLng}`
        : "";
    const pickupLat = Number(selectedMapBooking?.pickup_latitude);
    const pickupLng = Number(selectedMapBooking?.pickup_longitude);
    const pickupCoord =
      Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
        ? `${pickupLat},${pickupLng}`
        : "";
    const pickup = String(selectedMapBooking?.pickup_location || "").trim();
    const hospitalNameNorm = String(
      selectedMapBooking?.assigned_hospital_name || hospital?.name || selectedMapBooking?.destination || ""
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    const destination =
      hospitalCoord ||
      String(selectedMapBooking?.assigned_hospital_address || "").trim() ||
      String(selectedMapBooking?.assigned_hospital_name || "").trim() ||
      String(hospital?.address || "").trim() ||
      String(selectedMapBooking?.destination || "").trim() ||
      pickup;
    const start = pickupCoord || pickup || `${lat},${lng}`;
    const end = destination || pickupCoord || pickup || `${lat},${lng}`;
    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(start)}&daddr=${encodeURIComponent(end)}&dirflg=d`;
  }, [selectedMapBooking, hospital]);

  const dismissMapBooking = (bookingId) => {
    const id = Number(bookingId || 0);
    if (!id) return;
    setHiddenMapBookingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const deleteBookingPermanently = async (bookingId) => {
    const id = Number(bookingId || 0);
    if (!id) return;
    const ok = window.confirm(`Delete booking #${id} permanently? This cannot be undone.`);
    if (!ok) return;
    try {
      setDeletingBookingId(id);
      const res = await fetch(`${BASE}/api/bookings/${id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error("Unable to delete booking");
      setMapMenuOpenId(0);
      setHiddenMapBookingIds((prev) => prev.filter((x) => Number(x) !== id));
      await fetchHospitalDashboard({ silent: true });
    } catch {
      setErr("Unable to permanently delete booking");
    } finally {
      setDeletingBookingId(0);
    }
  };

  useEffect(() => {
    const closeMenu = (e) => {
      if (!e.target.closest(".hp-map-menu-wrap")) setMapMenuOpenId(0);
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  const featuredDoctors = useMemo(
    () => staff.filter((s) => s.role === "doctor").slice(0, 6),
    [staff]
  );

  const responseCards = useMemo(
    () => [...queue].sort((a, b) => Number(b.booking_id || 0) - Number(a.booking_id || 0)),
    [queue]
  );

  const reportCards = useMemo(
    () =>
      responseCards.filter(
        (q) =>
          q.digital_handover?.report_sent_to_hospital ||
          q.digital_handover?.report_submitted_at ||
          q.digital_handover?.vitals_summary ||
          q.digital_handover?.driver_modified_report ||
          q.digital_handover?.driver_voice_transcript
      ),
    [responseCards]
  );

  const caseCards = useMemo(() => {
    const doctors = staff.filter((s) => String(s.role || "").toLowerCase() === "doctor");
    const now = Date.now();
    return responseCards.map((q, index) => {
      const admittedRaw =
        q.hospital_responded_at ||
        q.hospital_assigned_at ||
        q.digital_handover?.report_submitted_at ||
        q.created_at ||
        "";
      const admittedAt = admittedRaw ? new Date(admittedRaw) : null;
      const validAdmit = admittedAt && !Number.isNaN(admittedAt.getTime());
      const daysAdmitted = validAdmit
        ? Math.max(1, Math.ceil((now - admittedAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 1;
      const doctor = doctors[index % Math.max(doctors.length, 1)] || onCallSpecialists[index % Math.max(onCallSpecialists.length, 1)] || null;
      const baseCharge = 2800;
      const dailyRate = 4200;
      const dailyCare = dailyRate * daysAdmitted;
      const isCritical = String(q.pre_diagnosis_note || q.digital_handover?.patient_condition || "")
        .toLowerCase()
        .includes("critical");
      const icuCharge = isCritical ? 8500 : 0;
      const ambulanceCharge = q.ambulance_number ? 1800 : 0;
      const billBreakdown = {
        baseCharge,
        dailyRate,
        daysAdmitted,
        dailyCare,
        icuCharge,
        ambulanceCharge,
        total: baseCharge + dailyCare + icuCharge + ambulanceCharge,
        rule: "Base intake Rs 2,800 + Rs 4,200 per admitted day + Rs 1,800 ambulance handover charge when ambulance is assigned + Rs 8,500 ICU/critical care charge when condition contains critical.",
      };
      return {
        ...q,
        admittedAtLabel: validAdmit ? admittedAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not recorded",
        daysAdmitted,
        currentBill: billBreakdown.total,
        billBreakdown,
        doctorName: doctor?.full_name || "Duty Doctor",
        doctorSpecialization: doctor?.specialization || "Emergency Medicine",
        doctorContact: doctor?.contact_number || "-",
      };
    });
  }, [responseCards, staff, onCallSpecialists]);

  const selectedCaseId = useMemo(() => {
    const match = String(location.pathname || "").match(/\/hospital\/cases\/(\d+)/i);
    return match ? Number(match[1]) : 0;
  }, [location.pathname]);

  const selectedCase = useMemo(
    () => caseCards.find((c) => Number(c.booking_id) === Number(selectedCaseId)) || null,
    [caseCards, selectedCaseId]
  );
  const openCase = useMemo(
    () => caseCards.find((c) => Number(c.booking_id) === Number(openCaseId)) || null,
    [caseCards, openCaseId]
  );

  const groupedStaff = useMemo(() => {
    const groups = {
      doctor: [],
      nurse: [],
      technician: [],
      support: [],
      other: [],
    };
    staff.forEach((s) => {
      const key = String(s.role || "").toLowerCase();
      if (groups[key]) groups[key].push(s);
      else groups.other.push(s);
    });
    return groups;
  }, [staff]);

  const handleStaffImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStaffForm((f) => ({ ...f, photo_data: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditStaffImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditStaffForm((f) => ({ ...f, photo_data: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleStaffBannerUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStaffForm((f) => ({ ...f, banner_data: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditStaffBannerUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditStaffForm((f) => ({ ...f, banner_data: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const startEditStaff = (staffMember) => {
    setEditingStaffId(staffMember.id);
    setEditStaffForm({
      full_name: staffMember.full_name || "",
      role: staffMember.role || "doctor",
      specialization: staffMember.specialization || "",
      contact_number: staffMember.contact_number || "",
      email: staffMember.email || "",
      photo_data: staffMember.photo_data || "",
      banner_data: staffMember.banner_data || "",
      years_experience: Number(staffMember.years_experience || 0),
      is_on_call: !!staffMember.is_on_call,
      is_active: staffMember.is_active !== false,
    });
  };

  const saveEditStaff = async () => {
    if (!hospital?.id || !editingStaffId) return;
    try {
      const res = await fetch(`${BASE}/api/hospitals/${hospital.id}/staff/${editingStaffId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editStaffForm),
      });
      if (!res.ok) throw new Error("Unable to update staff");
      setEditingStaffId(null);
      await fetchHospitalDashboard({ silent: true });
    } catch {
      setErr("Unable to update staff");
    }
  };

  const deleteStaff = async (staffMember) => {
    if (!hospital?.id || !staffMember?.id) return;
    const ok = window.confirm(`Delete ${staffMember.full_name}? This action cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`${BASE}/api/hospitals/${hospital.id}/staff/${staffMember.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Unable to delete staff");
      if (editingStaffId === staffMember.id) setEditingStaffId(null);
      await fetchHospitalDashboard({ silent: true });
    } catch {
      setErr("Unable to delete staff");
    }
  };

  return (
    <>
      <style>{`
        .hp-root {
          --hp-accent: #9cab00;
          --hp-accent-soft: #d6e800;
          min-height: 100vh;
          padding: 64px 0 0 64px;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(214,232,0,0.2), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(235,248,94,0.17), transparent 72%),
            #f6f6f0;
          color: #111;
          font-family: "Segoe UI", Arial, sans-serif;
          transition: background .35s ease;
        }
        .hp-root.hp-theme-home {
          --hp-accent: #9cab00;
          --hp-accent-soft: #d6e800;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(214,232,0,0.34), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(235,248,94,0.28), transparent 72%),
            linear-gradient(165deg, #f7faea 0%, #eef6d5 100%);
        }
        .hp-root.hp-theme-home .hp-card {
          background: linear-gradient(165deg, #fffef3 0%, #f3f8d8 100%);
          border-color: rgba(156,171,0,0.24);
        }
        .hp-root.hp-theme-home .hp-input,
        .hp-root.hp-theme-home .hp-select,
        .hp-root.hp-theme-home .hp-textarea {
          background: linear-gradient(165deg, #ffffff 0%, #fbfdeb 100%);
        }
        .hp-root.hp-theme-queue {
          --hp-accent: #d98200;
          --hp-accent-soft: #ffc977;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(255,201,119,0.26), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(255,230,187,0.3), transparent 72%),
            #fff8ef;
        }
        .hp-root.hp-theme-responses {
          --hp-accent: #9cab00;
          --hp-accent-soft: #d6e800;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(214,232,0,0.24), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(235,248,94,0.24), transparent 72%),
            #f6fbe5;
        }
        .hp-root.hp-theme-reports {
          --hp-accent: #8d9800;
          --hp-accent-soft: #d7e65a;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(215,230,90,0.26), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(233,245,157,0.24), transparent 72%),
            #f9fdeb;
        }
        .hp-root.hp-theme-tracking {
          --hp-accent: #0f9c9a;
          --hp-accent-soft: #79e0dd;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(121,224,221,0.25), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(188,243,241,0.3), transparent 72%),
            #eefafa;
        }
        .hp-root.hp-theme-resources {
          --hp-accent: #6277ff;
          --hp-accent-soft: #a5b2ff;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(165,178,255,0.25), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(216,223,255,0.34), transparent 72%),
            #f1f4ff;
        }
        .hp-root.hp-theme-staff {
          --hp-accent: #9a4de0;
          --hp-accent-soft: #cfabff;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(207,171,255,0.28), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(229,205,255,0.34), transparent 72%),
            #f8f2ff;
        }
        .hp-root.hp-theme-analytics {
          --hp-accent: #d6e800;
          --hp-accent-soft: rgba(214,232,0,0.3);
          background: 
            radial-gradient(980px 450px at 92% 4%, rgba(214,232,0,0.25), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(223,234,163,0.34), transparent 72%),
            #fdfdf9;
          color: #111;
        }
        .hp-root.hp-theme-analytics .hp-card {
          background: #fff;
          border: 1px solid rgba(17,17,17,0.18);
          color: #111;
          box-shadow: 0 4px 16px rgba(17,17,17,0.03);
          transition: border-color .2s ease, box-shadow .2s ease;
        }
        .hp-root.hp-theme-analytics .hp-card:hover {
          border-color: var(--hp-accent);
          box-shadow: 0 8px 24px rgba(214,232,0,0.15);
        }
        .hp-root.hp-theme-analytics .hp-card-title {
          color: #111;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .hp-root.hp-theme-analytics .hp-empty { color: rgba(17,17,17,0.5); }
        .hp-root.hp-theme-cases {
          --hp-accent: #9cab00;
          --hp-accent-soft: #d6e800;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(214,232,0,0.24), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(238,247,130,0.26), transparent 72%),
            #f8faef;
        }
        .hp-cases-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .hp-cases-count {
          min-width: 118px;
          border: 1px solid rgba(156,171,0,0.35);
          border-radius: 8px;
          padding: 10px 12px;
          background: rgba(214,232,0,0.16);
          text-align: right;
        }
        .hp-cases-count .v { font-size: 26px; font-weight: 900; line-height: 1; color: #111; }
        .hp-cases-count .k { font-size: 10px; font-weight: 800; text-transform: uppercase; color: rgba(17,17,17,0.55); margin-top: 4px; }
        .hp-cases-strip {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 2px 2px 12px;
          scroll-snap-type: x proximity;
        }
        .hp-case-card {
          flex: 0 0 min(420px, 88vw);
          scroll-snap-align: start;
          border: 1px solid rgba(17,17,17,0.12);
          border-left: 4px solid var(--hp-accent);
          border-radius: 8px;
          background: #fff;
          padding: 14px;
          box-shadow: 0 12px 26px rgba(17,17,17,0.05);
        }
        .hp-case-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: start;
        }
        .hp-case-name { font-size: 16px; font-weight: 900; color: #111; margin-bottom: 3px; }
        .hp-case-sub { font-size: 11px; color: rgba(17,17,17,0.56); font-weight: 700; }
        .hp-case-menu-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid rgba(17,17,17,0.12);
          background: rgba(17,17,17,0.03);
          color: #111;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .hp-case-menu-btn:hover,
        .hp-case-menu-btn.open {
          background: var(--hp-accent-soft);
          border-color: rgba(156,171,0,0.55);
        }
        .hp-case-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin: 12px 0;
        }
        .hp-case-metric {
          border: 1px solid rgba(17,17,17,0.08);
          border-radius: 8px;
          background: #fbfcf4;
          padding: 9px;
        }
        .hp-case-metric .k { font-size: 9px; text-transform: uppercase; font-weight: 900; color: rgba(17,17,17,0.48); }
        .hp-case-metric .v { font-size: 15px; font-weight: 900; color: #111; margin-top: 4px; }
        .hp-case-details {
          border-top: 1px solid rgba(17,17,17,0.08);
          margin-top: 12px;
          padding-top: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 12px;
        }
        .hp-case-detail-line {
          font-size: 12px;
          color: rgba(17,17,17,0.75);
          line-height: 1.45;
        }
        .hp-case-detail-line b {
          display: block;
          font-size: 9px;
          text-transform: uppercase;
          color: rgba(17,17,17,0.45);
          margin-bottom: 2px;
        }
        .hp-case-detail-wide { grid-column: 1 / -1; }
        .hp-case-detail-page {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: 14px;
        }
        .hp-case-detail-hero {
          border: 1px solid rgba(17,17,17,0.12);
          border-left: 4px solid var(--hp-accent);
          border-radius: 8px;
          background: #fff;
          padding: 18px;
          box-shadow: 0 14px 30px rgba(17,17,17,0.05);
        }
        .hp-case-detail-title {
          font-size: 26px;
          font-weight: 900;
          color: #111;
          margin: 6px 0 4px;
        }
        .hp-case-detail-sub {
          font-size: 12px;
          color: rgba(17,17,17,0.6);
          font-weight: 700;
        }
        .hp-case-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }
        .hp-case-info-box {
          border: 1px solid rgba(17,17,17,0.1);
          border-radius: 8px;
          background: #fbfcf4;
          padding: 12px;
        }
        .hp-case-info-box .k {
          font-size: 10px;
          color: rgba(17,17,17,0.48);
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .hp-case-info-box .v {
          font-size: 14px;
          color: #111;
          font-weight: 800;
          line-height: 1.45;
        }
        .hp-bill-panel {
          border: 1px solid rgba(156,171,0,0.35);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(214,232,0,0.16), rgba(255,255,255,0.96));
          padding: 16px;
          align-self: start;
          position: sticky;
          top: 82px;
        }
        .hp-bill-total {
          font-size: 34px;
          font-weight: 900;
          color: #111;
          margin: 6px 0 12px;
          line-height: 1;
        }
        .hp-bill-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid rgba(17,17,17,0.08);
          font-size: 12px;
          color: rgba(17,17,17,0.72);
        }
        .hp-bill-row b { color: #111; }
        .hp-bill-rule {
          margin-top: 12px;
          font-size: 11px;
          color: rgba(17,17,17,0.58);
          line-height: 1.55;
        }
        .hp-case-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 12000;
          background: rgba(17,17,17,0.42);
          display: grid;
          place-items: center;
          padding: 22px;
        }
        .hp-case-modal {
          width: min(980px, 100%);
          max-height: min(760px, calc(100vh - 44px));
          overflow: auto;
          border: 1px solid rgba(156,171,0,0.45);
          border-radius: 18px;
          background: linear-gradient(160deg, #fffef8 0%, #f8fbe8 100%);
          box-shadow: 0 28px 80px rgba(17,17,17,0.28);
        }
        .hp-case-modal-head {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 18px 20px;
          background: rgba(255,254,248,0.96);
          border-bottom: 1px solid rgba(17,17,17,0.1);
          backdrop-filter: blur(10px);
        }
        .hp-case-modal-title {
          font-size: 24px;
          font-weight: 900;
          margin: 0 0 4px;
          color: #111;
        }
        .hp-case-modal-sub {
          font-size: 12px;
          color: rgba(17,17,17,0.62);
          font-weight: 700;
        }
        .hp-case-modal-close {
          width: 38px;
          height: 38px;
          border-radius: 999px;
          border: 1px solid rgba(17,17,17,0.16);
          background: #d6e800;
          color: #111;
          font-size: 22px;
          line-height: 1;
          font-weight: 900;
          cursor: pointer;
          flex-shrink: 0;
        }
        .hp-case-modal-body {
          padding: 18px 20px 22px;
        }
        .hp-case-modal-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .hp-case-modal-stat,
        .hp-case-modal-box {
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 12px;
          background: #fff;
          padding: 12px;
        }
        .hp-case-modal-stat .k,
        .hp-case-modal-box .k {
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          color: rgba(17,17,17,0.52);
          margin-bottom: 6px;
        }
        .hp-case-modal-stat .v {
          font-size: 18px;
          font-weight: 900;
          color: #111;
        }
        .hp-case-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .hp-case-modal-box.wide {
          grid-column: 1 / -1;
        }
        .hp-case-modal-box .v {
          font-size: 13px;
          color: #111;
          line-height: 1.45;
          word-break: break-word;
          white-space: pre-wrap;
        }
        .hp-an-top { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
        .hp-an-stat {
          background: #fff;
          border: 1px solid rgba(17,17,17,0.18);
          border-radius: 12px;
          padding: 16px;
          position: relative;
          overflow: hidden;
          transition: transform .2s ease, border-color .2s ease;
          box-shadow: 0 4px 12px rgba(17,17,17,0.03);
        }
        .hp-an-stat::before {
          content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: var(--hp-accent); opacity: 0.3;
        }
        .hp-an-stat.hi::before { opacity: 1; }
        .hp-an-stat:hover {
          transform: translateY(-2px);
          border-color: var(--hp-accent);
          box-shadow: 0 10px 24px rgba(214,232,0,0.15);
        }
        .hp-an-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; color: rgba(17,17,17,0.5); }
        .hp-an-v { font-size: 32px; font-weight: 900; color: #111; margin: 8px 0; line-height: 1; }
        .hp-an-sub { font-size: 10px; color: rgba(17,17,17,0.5); }
        .hp-an-sub span { color: #00c853; font-weight: 700; }
        .hp-an-mid { display: grid; grid-template-columns: 1fr 1.6fr 1fr; gap: 12px; margin-bottom: 14px; }
        .hp-an-chart { height: 200px; display: flex; align-items: flex-end; justify-content: space-around; gap: 6px; padding-top: 20px; }
        .hp-an-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; top: 0; position: relative;}
        .hp-an-bar { width: 100%; max-width: 40px; background: rgba(17,17,17,0.15); border-radius: 4px 4px 0 0; position: relative; }
        .hp-an-bar.hi { background: var(--hp-accent); }
        .hp-an-b-lbl { font-size: 9px; font-weight: 800; color: rgba(17,17,17,0.5); margin-top: 6px; }
        .hp-an-circle { width: 140px; height: 140px; border-radius: 50%; border: 12px solid rgba(17,17,17,0.05); border-top-color: var(--hp-accent); border-right-color: var(--hp-accent); margin: 20px auto; display: flex; align-items: center; justify-content: center; }
        .hp-an-c-lbl { font-size: 24px; font-weight: 900; color: #111; }
        .hp-an-table-w { border: 1px solid rgba(17,17,17,0.08); border-radius: 12px; background: #fff; overflow: hidden; }
        .hp-an-th { display: grid; grid-template-columns: 80px 100px 100px 140px 120px 80px 100px; gap: 10px; padding: 12px 14px; background: rgba(17,17,17,0.03); border-bottom: 1px solid rgba(17,17,17,0.08); font-size: 10px; font-weight: 800; text-transform: uppercase; color: rgba(17,17,17,0.45); }
        .hp-an-tr { display: grid; grid-template-columns: 80px 100px 100px 140px 120px 80px 100px; gap: 10px; padding: 14px; border-bottom: 1px solid rgba(17,17,17,0.04); font-size: 13px; align-items: center; color: rgba(17,17,17,0.85); transition: background .2s; }
        .hp-an-tr:hover { background: rgba(17,17,17,0.02); }
        .hp-an-tr:last-child { border-bottom: none; }
        .hp-an-status { display: inline-flex; align-items: center; justify-content: center; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; background: rgba(0, 200, 83, 0.15); color: #00c853; border: 1px solid rgba(0, 200, 83, 0.3); }
        .hp-root.hp-map-page {
          height: 100vh;
          overflow: hidden;
        }
        .hp-root.hp-map-page .hp-wrap {
          height: calc(100vh - 64px);
          overflow: hidden;
          padding-bottom: 20px;
        }
        .hp-wrap { max-width: 1420px; margin: 0 auto; padding: 20px 20px 84px; }
        .hp-hero {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 22px;
          background: linear-gradient(140deg, #fbffe8 0%, #f1f8cc 100%);
          padding: 26px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.08);
          margin-bottom: 12px;
        }
        .hp-title { margin: 0; font-size: clamp(28px, 5vw, 58px); line-height: .95; font-family: Georgia, serif; }
        .hp-sub { margin: 10px 0 0; color: rgba(17,17,17,0.75); max-width: 880px; font-size: 14px; line-height: 1.6; }
        .hp-home-hero {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 14px;
          margin-bottom: 12px;
        }
        .hp-home-banner {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 16px;
          background: linear-gradient(135deg, #f6ffcf 0%, #ecf7b8 55%, #e3f0a7 100%);
          padding: 18px;
          min-height: 240px;
          position: relative;
          overflow: hidden;
        }
        .hp-home-video-wrap {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          border-radius: 16px;
        }
        .hp-home-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.02) contrast(1.02);
        }
        .hp-home-video-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(125deg, rgba(11,16,8,0.68) 0%, rgba(11,16,8,0.42) 48%, rgba(11,16,8,0.6) 100%),
            radial-gradient(460px 180px at 92% 6%, rgba(214,232,0,0.23), transparent 72%);
        }
        .hp-home-banner > *:not(.hp-home-video-wrap) {
          position: relative;
          z-index: 2;
        }
        .hp-home-banner::after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          right: -40px;
          top: -40px;
          background: radial-gradient(circle, rgba(214, 232, 0, 0.42) 0%, rgba(214, 232, 0, 0) 72%);
        }
        .hp-home-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .hp-home-chip-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
          max-width: 520px;
        }
        .hp-home-chip {
          border: 1px solid rgba(214,232,0,0.58);
          border-radius: 10px;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(4px);
          padding: 8px 10px;
        }
        .hp-home-chip .k {
          font-size: 10px;
          font-weight: 800;
          color: rgba(255,255,255,0.82);
          text-transform: uppercase;
          letter-spacing: .7px;
        }
        .hp-home-chip .v {
          margin-top: 4px;
          font-size: 18px;
          line-height: 1;
          color: #f4ffc4;
          font-weight: 900;
        }
        .hp-home-services {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 16px;
          background: linear-gradient(155deg, #fffef2 0%, #f4f8d8 100%);
          padding: 14px;
        }
        .hp-home-services-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .hp-svc {
          border: 1px solid rgba(17,17,17,0.1);
          border-radius: 10px;
          background: linear-gradient(160deg, #ffffff 0%, #f3f9cb 100%);
          padding: 10px;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .hp-svc b { font-size: 12px; }
        .hp-svc p { margin: 4px 0 0; font-size: 11px; color: rgba(17,17,17,0.64); }
        .hp-svc:hover {
          transform: translateY(-2px);
          border-color: rgba(156,171,0,0.7);
          box-shadow: 0 10px 22px rgba(156,171,0,0.2);
        }
        .hp-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 10px 0 14px; }
        .hp-stat {
          border: 1px solid rgba(17,17,17,0.14);
          background: linear-gradient(160deg, #ffffff 0%, #f5f9d8 100%);
          border-radius: 12px;
          padding: 12px;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .hp-stat .v { font-size: 28px; font-weight: 900; }
        .hp-stat .k { font-size: 10px; text-transform: uppercase; color: rgba(17,17,17,0.58); }
        .hp-stat:hover {
          transform: translateY(-2px);
          border-color: rgba(156,171,0,0.72);
          box-shadow: 0 10px 24px rgba(156,171,0,0.22);
        }
        .hp-card {
          border: 1px solid rgba(17,17,17,0.14);
          background: #fffef6;
          border-radius: 14px;
          padding: 14px;
          margin-bottom: 10px;
          box-shadow: 0 10px 24px rgba(0,0,0,0.06);
          transition: box-shadow .2s ease, transform .2s ease;
        }
        .hp-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(0,0,0,0.1);
        }
        .hp-card-title { font-size: 14px; font-weight: 900; margin-bottom: 8px; }
        .hp-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hp-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid rgba(17,17,17,0.2);
          background: #fff;
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .hp-icon-btn:hover {
          background: color-mix(in srgb, var(--hp-accent-soft) 38%, white 62%);
          border-color: var(--hp-accent);
        }
        .hp-resource-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 6px;
        }
        .hp-resource-shell {
          background:
            radial-gradient(640px 220px at 95% -20%, rgba(214,232,0,0.22), transparent 72%),
            radial-gradient(520px 200px at -10% 120%, rgba(235,248,94,0.2), transparent 72%),
            linear-gradient(165deg, #fbffeb 0%, #f2f8cd 100%);
          border-color: rgba(156,171,0,0.32);
        }
        .hp-resource-shell .hp-card-title {
          color: #6f8400;
        }
        .hp-resource-mini {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 10px;
          background: linear-gradient(160deg, #ffffff 0%, #f5f9d6 100%);
          padding: 10px;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .hp-resource-mini .v {
          color: #6a7e00;
        }
        .hp-resource-mini:hover {
          transform: translateY(-2px);
          border-color: rgba(156,171,0,0.72);
          box-shadow: 0 10px 24px rgba(156,171,0,0.2);
        }
        .hp-resource-notes {
          margin-top: 10px;
          border: 1px solid rgba(156,171,0,0.24);
          border-radius: 12px;
          background: linear-gradient(165deg, #ffffff 0%, #f7fbdf 100%);
          padding: 10px 12px;
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .hp-resource-notes:hover {
          transform: translateY(-1px);
          border-color: rgba(156,171,0,0.7);
          box-shadow: 0 8px 20px rgba(156,171,0,0.18);
        }
        .hp-oncall-box {
          margin-top: 10px;
          margin-bottom: 0;
          border-color: rgba(15,156,154,0.32);
          background: linear-gradient(165deg, #fbffff 0%, #ecfffd 100%);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .hp-oncall-box:hover {
          transform: translateY(-1px);
          border-color: rgba(156,171,0,0.68);
          box-shadow: 0 10px 22px rgba(156,171,0,0.2);
        }
        .hp-resource-mini .v { font-size: 20px; font-weight: 900; }
        .hp-resource-mini .k { font-size: 10px; text-transform: uppercase; color: rgba(17,17,17,0.58); }
        .hp-two { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; }
        .hp-queue { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .hp-case {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 12px;
          background: #fff;
          padding: 12px;
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .hp-case:hover {
          border-color: rgba(156,171,0,0.72);
          box-shadow: 0 12px 24px rgba(156,171,0,0.18);
          transform: translateY(-2px);
        }
        .hp-pill {
          border: 1px solid rgba(17,17,17,0.18);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          display: inline-block;
        }
        .hp-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-top: 4px; }
        .hp-label { color: rgba(17,17,17,0.62); }
        .hp-actions { display: flex; gap: 8px; margin-top: 8px; }
        .hp-btn {
          border: 1px solid rgba(17,17,17,0.2);
          border-radius: 9px;
          background: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 6px 10px;
          cursor: pointer;
        }
        .hp-btn.ok { background: rgba(0,200,83,0.14); border-color: rgba(0,200,83,0.35); color: #0b7a35; }
        .hp-btn.no { background: rgba(229,9,20,0.12); border-color: rgba(229,9,20,0.35); color: #b31321; }
        .hp-btn.primary {
          background: color-mix(in srgb, var(--hp-accent-soft) 40%, white 60%);
          border-color: color-mix(in srgb, var(--hp-accent) 65%, #333 35%);
        }
        .hp-btn.staff-top {
          background: linear-gradient(135deg, #d6e800 0%, #f0ff8a 100%);
          border-color: #a6b800;
          color: #111;
          font-weight: 900;
        }
        .hp-btn.staff-top:hover {
          background: linear-gradient(135deg, #e3f24e 0%, #f5ffaf 100%);
        }
        .hp-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .hp-input, .hp-select, .hp-textarea {
          width: 100%;
          border: 1px solid rgba(17,17,17,0.2);
          border-radius: 8px;
          background: #fff;
          padding: 8px 10px;
          font-size: 12px;
          font-family: inherit;
        }
        .hp-textarea { min-height: 70px; resize: vertical; }
        .hp-empty { text-align: center; color: rgba(17,17,17,0.58); font-size: 12px; padding: 20px 10px; }
        .hp-alert {
          border: 1px solid rgba(229,9,20,0.35);
          background: rgba(229,9,20,0.09);
          border-radius: 10px;
          color: #a80f1a;
          font-size: 12px;
          padding: 10px 12px;
          margin-bottom: 10px;
          font-weight: 700;
        }
        .hp-staff-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .hp-staff-add-btn {
          border: 1px solid rgba(17,17,17,0.2);
          background: #fff;
          border-radius: 10px;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .hp-staff-add-btn:hover {
          background: color-mix(in srgb, var(--hp-accent-soft) 35%, white 65%);
          border-color: var(--hp-accent);
        }
        .hp-staff-form-card {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 12px;
          background: #fbfde9;
          padding: 10px;
          margin-bottom: 10px;
        }
        .hp-staff-hero {
          position: relative;
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 16px;
          padding: 20px;
          overflow: hidden;
          background: linear-gradient(135deg, #d6e800 0%, #e8f46d 56%, #f5ffad 100%);
          color: #111;
          margin-bottom: 12px;
          box-shadow: 0 14px 32px rgba(156, 171, 0, 0.28);
        }
        .hp-staff-hero::before,
        .hp-staff-hero::after {
          content: "";
          position: absolute;
          border: 6px solid rgba(255,255,255,0.58);
          border-radius: 999px;
          pointer-events: none;
        }
        .hp-staff-hero::before {
          width: 220px;
          height: 88px;
          top: -44px;
          left: -18px;
        }
        .hp-staff-hero::after {
          width: 260px;
          height: 108px;
          top: -54px;
          right: -30px;
        }
        .hp-staff-hero-kicker {
          font-size: 11px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          font-weight: 800;
          color: rgba(17,17,17,0.72);
        }
        .hp-staff-hero-title {
          margin: 6px 0 0;
          font-size: clamp(24px, 3vw, 40px);
          line-height: 1.03;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
          font-weight: 900;
        }
        .hp-staff-hero-sub {
          margin: 10px 0 0;
          max-width: 700px;
          font-size: 13px;
          color: rgba(17,17,17,0.8);
          line-height: 1.55;
        }
        .hp-staff-role-card {
          margin-bottom: 12px;
          background: linear-gradient(170deg, #ffffff 0%, #fafaff 100%);
        }
        .hp-staff-list-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 4px;
        }
        .hp-role-section {
          margin-top: 10px;
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 12px;
          background: #fff;
          padding: 10px;
        }
        .hp-role-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hp-role-title {
          font-size: 15px;
          font-weight: 900;
        }
        .hp-role-count {
          font-size: 11px;
          font-weight: 800;
          border: 1px solid rgba(17,17,17,0.2);
          border-radius: 999px;
          padding: 2px 8px;
          background: #f4f4ec;
        }
        .hp-role-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .hp-role-card {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 18px;
          background: linear-gradient(165deg, #ffffff 0%, #fbfcf2 100%);
          position: relative;
          min-height: 330px;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(15,25,45,0.1);
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }
        .hp-role-card:hover {
          transform: translateY(-3px);
          border-color: rgba(156,171,0,0.78);
          box-shadow: 0 16px 34px rgba(156,171,0,0.22);
        }
        .hp-role-cover {
          height: 78px;
          background:
            radial-gradient(160px 70px at 14% 0%, rgba(255,255,255,0.35), transparent 70%),
            radial-gradient(150px 80px at 88% 0%, rgba(255,255,255,0.28), transparent 72%),
            linear-gradient(120deg, #d6e800 0%, #e3f27f 52%, #f6fcb7 100%);
          border-bottom: 1px solid rgba(156,171,0,0.45);
        }
        .hp-role-controls {
          position: absolute;
          top: 10px;
          right: 10px;
          display: inline-flex;
          gap: 6px;
        }
        .hp-role-avatar {
          position: absolute;
          top: 44px;
          left: 14px;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          border: 3px solid #fff;
          object-fit: cover;
          background: linear-gradient(145deg, #e8efbd, #d7e280);
          box-shadow: 0 8px 16px rgba(0,0,0,0.16);
        }
        .hp-role-avatar-fallback {
          font-size: 22px;
          font-weight: 900;
          color: #364200;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .hp-role-body {
          padding: 52px 14px 14px;
        }
        .hp-role-name {
          font-size: 30px;
          font-weight: 900;
          margin-bottom: 2px;
          line-height: 1;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
          letter-spacing: -0.5px;
        }
        .hp-role-handle {
          font-size: 12px;
          color: rgba(17,17,17,0.55);
          margin-bottom: 8px;
        }
        .hp-role-sub {
          font-size: 13px;
          color: #6f8400;
          margin-bottom: 8px;
          font-weight: 800;
        }
        .hp-role-meta {
          font-size: 12px;
          line-height: 1.6;
          color: rgba(17,17,17,0.82);
          margin-top: 2px;
        }
        .hp-role-edit {
          border: 1px solid rgba(255,255,255,0.74);
          border-radius: 999px;
          background: rgba(17,17,17,0.6);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 5px 11px;
          cursor: pointer;
        }
        .hp-role-edit:hover { background: rgba(17,17,17,0.82); }
        .hp-role-delete {
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,0.72);
          border-radius: 999px;
          background: rgba(167, 12, 12, 0.86);
          color: #fff;
          font-size: 13px;
          line-height: 1;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .hp-role-delete:hover {
          background: rgba(209, 17, 17, 0.92);
        }
        .hp-role-bio {
          margin-top: 8px;
          font-size: 12px;
          line-height: 1.45;
          color: rgba(17,17,17,0.7);
          min-height: 36px;
        }
        .hp-role-footer {
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .hp-role-mini-btn {
          border: 1px solid rgba(17,17,17,0.16);
          border-radius: 9px;
          background: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 6px 10px;
          color: rgba(17,17,17,0.78);
        }
        .hp-edit-card {
          border: 1px solid rgba(17,17,17,0.16);
          border-radius: 12px;
          background: #f3f7dd;
          padding: 10px;
          margin-top: 8px;
          grid-column: 1 / -1;
        }
        .hp-availability {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(17,17,17,0.2);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .25px;
          text-transform: uppercase;
          padding: 6px 12px;
          box-shadow: 0 6px 16px rgba(17,17,17,0.1);
        }
        .hp-availability::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          opacity: .9;
        }
        .hp-availability.yes {
          background: linear-gradient(145deg, rgba(0,200,83,0.18) 0%, rgba(123,242,168,0.2) 100%);
          color: #0c6d36;
          border-color: rgba(0,200,83,0.45);
        }
        .hp-availability.no {
          background: linear-gradient(145deg, rgba(229,9,20,0.14) 0%, rgba(255,173,178,0.22) 100%);
          color: #ad101e;
          border-color: rgba(229,9,20,0.45);
        }
        .hp-staff-personal-card {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 12px;
          background: #fff;
          padding: 12px;
        }
        .hp-staff-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hp-staff-id {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hp-staff-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #dfeab0;
          color: #111;
          font-size: 12px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .hp-staff-name { font-weight: 900; font-size: 15px; line-height: 1; }
        .hp-doc-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 8px;
        }
        .hp-doc-card {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
        }
        .hp-doc-photo {
          width: 100%;
          height: 170px;
          object-fit: cover;
          background: linear-gradient(135deg, #f1f1f1, #ddd);
        }
        .hp-doc-body { padding: 10px; }
        .hp-doc-name { font-weight: 900; font-size: 14px; }
        .hp-doc-meta { margin-top: 3px; font-size: 11px; color: rgba(17,17,17,0.62); }
        .hp-track-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .hp-track-card {
          border: 1px solid rgba(15,156,154,0.28);
          border-radius: 12px;
          background: linear-gradient(165deg, #ffffff 0%, #ecfffd 100%);
          padding: 12px;
          box-shadow: 0 10px 20px rgba(15,156,154,0.1);
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .hp-track-card:hover {
          border-color: rgba(156,171,0,0.75);
          box-shadow: 0 14px 24px rgba(156,171,0,0.2);
          transform: translateY(-2px);
        }
        .hp-track-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hp-map-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 10px;
          min-height: calc(100vh - 250px);
        }
        .hp-map-list {
          border: 1px solid rgba(156,171,0,0.35);
          border-radius: 12px;
          background: linear-gradient(165deg, #fffef5 0%, #f4f8d8 100%);
          padding: 10px;
          max-height: none;
          height: 100%;
          overflow: hidden;
        }
        .hp-map-list-item {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 10px;
          padding: 9px;
          background: #fff;
          margin-bottom: 8px;
          cursor: pointer;
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .hp-map-list-item:hover {
          border-color: rgba(156,171,0,0.7);
          box-shadow: 0 8px 16px rgba(156,171,0,0.18);
          transform: translateY(-1px);
        }
        .hp-map-list-item.active {
          border-color: rgba(156,171,0,0.9);
          box-shadow: 0 0 0 2px rgba(214,232,0,0.35);
        }
        .hp-map-menu-wrap { position: relative; display: inline-flex; }
        .hp-map-menu-btn {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid rgba(17,17,17,0.22);
          background: #fff;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }
        .hp-map-menu-btn:hover {
          border-color: rgba(156,171,0,0.9);
          background: #f4f9cd;
        }
        .hp-map-menu-pop {
          position: absolute;
          top: 34px;
          right: 0;
          width: 180px;
          border: 1px solid rgba(17,17,17,0.18);
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 12px 26px rgba(17,17,17,0.16);
          z-index: 6;
          padding: 8px;
        }
        .hp-map-menu-item {
          width: 100%;
          text-align: left;
          border: 1px solid rgba(17,17,17,0.14);
          background: #fff;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .hp-map-menu-item + .hp-map-menu-item { margin-top: 6px; }
        .hp-map-menu-item:hover {
          border-color: rgba(156,171,0,0.8);
          background: #f5fbd4;
        }
        .hp-map-menu-item.danger {
          color: #9c0f1a;
          border-color: rgba(229,9,20,0.3);
          background: rgba(229,9,20,0.05);
        }
        .hp-map-menu-item.danger:hover {
          border-color: rgba(229,9,20,0.62);
          background: rgba(229,9,20,0.12);
        }
        .hp-map-panel {
          border: 1px solid rgba(15,156,154,0.28);
          border-radius: 12px;
          background: linear-gradient(165deg, #fbffff 0%, #edf8ff 100%);
          overflow: hidden;
          min-height: 340px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .hp-map-panel-head {
          padding: 10px 12px;
          border-bottom: 1px solid rgba(17,17,17,0.12);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .hp-map-frame {
          width: 100%;
          flex: 1 1 auto;
          min-height: 300px;
          border: 0;
          display: block;
        }
        .hp-remove-mini {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid rgba(229,9,20,0.35);
          background: rgba(229,9,20,0.08);
          color: #c2212d;
          font-size: 14px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          line-height: 1;
        }
        .hp-remove-mini:hover {
          background: rgba(229,9,20,0.18);
          border-color: rgba(229,9,20,0.6);
        }
        .hp-response-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .hp-response-page {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .hp-response-tile {
          border: 1px solid rgba(156,171,0,0.45);
          border-radius: 18px;
          background:
            radial-gradient(360px 140px at 90% -20%, rgba(214,232,0,0.2), transparent 70%),
            linear-gradient(160deg, #fffef4 0%, #f7fcd9 100%);
          padding: 14px;
          box-shadow: 0 14px 30px rgba(156,171,0,0.16);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .hp-response-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(156,171,0,0.2);
          border-color: rgba(156,171,0,0.7);
        }
        .hp-response-tile-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .hp-response-tile-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .5px;
          text-transform: uppercase;
          color: rgba(17,17,17,0.62);
        }
        .hp-response-tile-note {
          margin-top: 8px;
          border: 1px solid rgba(156,171,0,0.45);
          border-radius: 12px;
          background: rgba(214,232,0,0.16);
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 800;
        }
        .hp-response-card {
          border: 1px solid rgba(156,171,0,0.48);
          border-radius: 12px;
          background: linear-gradient(165deg, #fffef5 0%, #f7fcd9 100%);
          padding: 12px;
          box-shadow: 0 10px 22px rgba(156,171,0,0.14);
        }
        .hp-response-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .hp-response-id {
          font-size: 11px;
          font-weight: 900;
          color: rgba(17,17,17,0.6);
          text-transform: uppercase;
          letter-spacing: .4px;
        }
        .hp-response-status {
          border: 1px solid rgba(17,17,17,0.2);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .3px;
        }
        .hp-response-status.ready {
          background: rgba(0,200,83,0.14);
          color: #0b7a35;
          border-color: rgba(0,200,83,0.35);
        }
        .hp-response-status.not_ready {
          background: rgba(229,9,20,0.1);
          color: #ad101e;
          border-color: rgba(229,9,20,0.35);
        }
        .hp-response-status.pending {
          background: rgba(214,232,0,0.24);
          color: #677600;
          border-color: rgba(156,171,0,0.45);
        }
        .hp-response-note {
          margin-top: 8px;
          border: 1px solid rgba(156,171,0,0.48);
          border-radius: 10px;
          background: rgba(214,232,0,0.14);
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
        }
        .hp-report-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .hp-report-card {
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 16px;
          background: linear-gradient(160deg, #ffffff 0%, #f8faeb 100%);
          padding: 10px;
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          box-shadow: 0 10px 20px rgba(156,171,0,0.12);
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .hp-report-card:hover {
          transform: translateY(-2px);
          border-color: rgba(156,171,0,0.75);
          box-shadow: 0 12px 24px rgba(156,171,0,0.2);
        }
        .hp-report-thumb {
          width: 96px;
          height: 96px;
          border-radius: 12px;
          background: linear-gradient(140deg, #eef6ca 0%, #d9eaa1 100%);
          border: 1px solid rgba(156,171,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          color: #5d6f00;
          font-weight: 900;
        }
        .hp-report-main { min-width: 0; }
        .hp-report-title {
          font-size: 16px;
          font-weight: 900;
          margin-bottom: 4px;
          color: #111;
        }
        .hp-report-line {
          font-size: 12px;
          color: rgba(17,17,17,0.76);
          line-height: 1.45;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hp-report-side {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          min-width: 92px;
        }
        .hp-report-tag {
          display: inline-flex;
          align-items: center;
          border: 1px solid rgba(156,171,0,0.5);
          background: rgba(214,232,0,0.22);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 900;
          padding: 3px 8px;
          text-transform: uppercase;
          letter-spacing: .3px;
        }
        .hp-report-status {
          font-size: 11px;
          font-weight: 800;
          color: #0b7a35;
          background: rgba(0,200,83,0.14);
          border: 1px solid rgba(0,200,83,0.34);
          border-radius: 999px;
          padding: 3px 8px;
        }
        .hp-report-summary {
          border: 1px solid rgba(17,17,17,0.14);
          border-radius: 10px;
          background: rgba(255,255,255,0.68);
          padding: 7px 9px;
          font-size: 11px;
          line-height: 1.5;
          max-width: 220px;
          max-height: 62px;
          overflow: auto;
        }

        .hp-home-guidance { margin-top: 30px; }
        .hp-guidance-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          margin-top: 14px;
        }
        .hp-guidance-card {
          border: 1px solid rgba(17,17,17,0.12);
          border-radius: 16px;
          background: #fff;
          padding: 30px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          box-shadow: 0 10px 30px rgba(17,17,17,0.04);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .hp-guidance-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 34px rgba(214,232,0,0.18);
          border-color: rgba(214,232,0,0.6);
        }
        .hp-g-sketch {
          position: relative;
          width: 100px;
          height: 100px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hp-g-sketch-bg {
          position: absolute;
          width: 80px;
          height: 80px;
          background: #d6e800;
          border-radius: 50%;
          transform: translate(6px, 6px);
          opacity: 0.8;
          z-index: 1;
        }
        .hp-g-sketch-icon {
          position: relative;
          z-index: 2;
          color: #111;
        }
        .hp-guidance-card b {
          font-size: 18px;
          font-weight: 900;
          margin-bottom: 10px;
          color: #111;
        }
        .hp-guidance-card p {
          font-size: 13px;
          color: rgba(17,17,17,0.7);
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 1100px) {
          .hp-home-hero { grid-template-columns: 1fr; }
          .hp-doc-grid { grid-template-columns: 1fr 1fr; }
          .hp-grid { grid-template-columns: 1fr 1fr; }
          .hp-resource-grid { grid-template-columns: 1fr 1fr; }
          .hp-staff-list-grid { grid-template-columns: 1fr; }
          .hp-role-grid { grid-template-columns: 1fr; }
          .hp-two { grid-template-columns: 1fr; }
          .hp-queue { grid-template-columns: 1fr; }
          .hp-track-grid { grid-template-columns: 1fr; }
          .hp-map-layout { grid-template-columns: 1fr; }
          .hp-response-grid { grid-template-columns: 1fr; }
          .hp-response-page { grid-template-columns: 1fr; }
          .hp-report-grid { grid-template-columns: 1fr; }
          .hp-report-card { grid-template-columns: 78px minmax(0, 1fr); }
          .hp-report-side { grid-column: 1 / -1; align-items: flex-start; }
          .hp-report-thumb { width: 78px; height: 78px; }
          .hp-home-chip-row { grid-template-columns: 1fr 1fr; }
          .hp-case-meta { grid-template-columns: 1fr; }
          .hp-case-details { grid-template-columns: 1fr; }
          .hp-case-modal-backdrop { padding: 10px; }
          .hp-case-modal-stats { grid-template-columns: 1fr 1fr; }
          .hp-case-modal-grid { grid-template-columns: 1fr; }
          .hp-an-top { grid-template-columns: repeat(2, 1fr); }
          .hp-an-mid { grid-template-columns: 1fr 1fr; }
          .hp-an-table-w { overflow-x: auto; }
        }
        @media (max-width: 767px) {
          .hp-guidance-grid { grid-template-columns: 1fr; }
          .hp-root { padding-left: 0; padding-bottom: 72px; padding-top: 64px; }
          .hp-root.hp-map-page { height: auto; overflow: auto; }
          .hp-root.hp-map-page .hp-wrap { height: auto; overflow: visible; }
          .hp-wrap { padding: 12px 12px 86px; }
          .hp-doc-grid { grid-template-columns: 1fr; }
          .hp-grid { grid-template-columns: 1fr; }
          .hp-resource-grid { grid-template-columns: 1fr; }
          .hp-form-grid { grid-template-columns: 1fr; }
          .hp-cases-head { align-items: flex-start; flex-direction: column; }
          .hp-cases-count { text-align: left; }
          .hp-an-top { grid-template-columns: repeat(2, 1fr); }
          .hp-an-mid { grid-template-columns: 1fr; }
          .hp-an-table-w { overflow-x: auto; }
        }
      `}</style>

      <div className={`hp-root hp-theme-${activeTab} ${activeTab === "map" ? "hp-map-page" : ""}`}>
        <div className="hp-wrap">
          <div
            className="hp-card"
            style={{
              display: "grid",
              gridTemplateColumns: activeTab === "staff" ? "1fr auto auto auto" : "1fr auto auto",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              marginBottom: 12,
              background: "rgba(255,255,255,0.8)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(17,17,17,0.74)" }}>
              {activeTab === "home" ? "Hospital Home" : activeTab === "queue" ? "Emergency Patient Queue" : activeTab === "responses" ? "Hospital Responses" : activeTab === "reports" ? "Case Reports" : activeTab === "map" ? "Live Tracking Map" : activeTab === "tracking" ? "Ambulance Tracking Cards" : activeTab === "resources" ? "Resource & Bed Management" : activeTab === "cases" ? "Hospital Cases" : activeTab === "analytics" ? "Hospital Analytics" : "Doctors & Staff Management"}
            </div>
            {activeTab === "staff" && (
              <button className="hp-btn staff-top" onClick={() => setShowAddStaffForm(true)}>
                + Add Staff
              </button>
            )}
            <button className="hp-btn primary" onClick={() => fetchHospitalDashboard({ silent: false })}>Refresh</button>
            <div style={{ fontSize: 11, color: "rgba(17,17,17,0.58)" }}>Last Sync: {lastSyncedAt || "--:--:--"}</div>
          </div>

          {err && <div className="hp-alert">{err}</div>}
          {loading && <div className="hp-empty">Loading hospital command center...</div>}
          {!loading && !hospital && <div className="hp-empty">Hospital profile not configured for this email.</div>}

          {!loading && hospital && (
            <>
              {activeTab === "home" && (
                <>
                  <div className="hp-home-hero">
                    <section className="hp-home-banner">
                      <div className="hp-home-video-wrap">
                        <video
                          className="hp-home-video"
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          poster="https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=1800&q=80"
                        >
                          <source src="https://cdn.coverr.co/videos/coverr-team-of-doctors-1573/1080p.mp4" type="video/mp4" />
                        </video>
                        <div className="hp-home-video-overlay" />
                      </div>
                      <div className="hp-home-anim" style={{ fontSize: 11, color: "#e3f27f", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Emergency Care Center</div>
                      <h1 className="hp-title hp-home-anim" style={{ marginTop: 8, fontSize: "clamp(26px, 4vw, 44px)", color: "#fff" }}>{hospital.name}</h1>
                      <p className="hp-sub hp-home-anim" style={{ color: "rgba(255,255,255,0.9)" }}>
                        Take care of your patients with precision. Real-time emergency intake, specialist readiness,
                        and ambulance visibility - all in one premium hospital control room.
                      </p>
                      <div className="hp-home-chip-row">
                        <div className="hp-home-chip"><div className="k">Active Cases</div><div className="v">{summary?.active_cases ?? 0}</div></div>
                        <div className="hp-home-chip"><div className="k">Available Beds</div><div className="v">{hospital.available_beds ?? 0}</div></div>
                        <div className="hp-home-chip"><div className="k">ICU Beds</div><div className="v">{hospital.icu_beds ?? 0}</div></div>
                      </div>
                      <div className="hp-home-actions hp-home-anim">
                        <button className="hp-btn primary">Emergency Dashboard</button>
                        <button className="hp-btn">Learn More</button>
                      </div>
                    </section>
                    <section className="hp-home-services">
                      <div className="hp-card-title">Our Services</div>
                      <div className="hp-home-services-grid">
                        <div className="hp-svc"><b>Easy Appointments</b><p>Fast triage and pre-arrival allocation.</p></div>
                        <div className="hp-svc"><b>Expert Consultations</b><p>On-call doctors with instant activation.</p></div>
                        <div className="hp-svc"><b>Health Monitoring</b><p>Live vitals from ambulance intake feed.</p></div>
                        <div className="hp-svc"><b>24/7 Support</b><p>Emergency-ready care at all times.</p></div>
                      </div>
                    </section>



                  </div>

                  <section className="hp-hero">
                    <div className="hp-grid">
                      <div className="hp-stat"><div className="v">{summary?.active_cases ?? 0}</div><div className="k">Emergency Cases</div></div>
                      <div className="hp-stat"><div className="v">{hospital.available_beds}</div><div className="k">Available Beds</div></div>
                      <div className="hp-stat"><div className="v">{hospital.icu_beds}</div><div className="k">ICU Beds</div></div>
                      <div className="hp-stat"><div className="v">{hospital.available_ventilators}</div><div className="k">Ventilators</div></div>
                    </div>
                  </section>

                  <div className="hp-two">
                    <section className="hp-card">
                      <div className="hp-card-title">Specializations</div>
                      <div style={{ fontSize: 13, lineHeight: 1.7 }}>{hospital.specializations || "No specializations added yet."}</div>
                    </section>
                    <section className="hp-card">
                      <div className="hp-card-title">Facilities</div>
                      <div style={{ fontSize: 13, lineHeight: 1.7 }}>{hospital.facilities || "No facilities added yet."}</div>
                    </section>
                  </div>

                  <section className="hp-card">
                    <div className="hp-card-title">Our Expert Doctors</div>
                    {featuredDoctors.length === 0 && <div className="hp-empty">Add doctors from Staff page to show them here.</div>}
                    <div className="hp-doc-grid">
                      {featuredDoctors.map((d) => (
                        <article className="hp-doc-card" key={d.id}>
                          {d.photo_data ? (
                            <img className="hp-doc-photo" src={d.photo_data} alt={d.full_name} />
                          ) : (
                            <div className="hp-doc-photo" />
                          )}
                          <div className="hp-doc-body">
                            <div className="hp-doc-name">{d.full_name}</div>
                            <div className="hp-doc-meta">{d.specialization || "General Medicine"}</div>
                            <div className="hp-doc-meta">{d.years_experience} years experience</div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {activeTab === "queue" && (
                <section className="hp-card">
                  <div className="hp-card-title">Emergency Patient Queue (Active Cases)</div>
                  <div className="hp-queue">
                    {queue.length === 0 && <div className="hp-empty">No active incoming patient right now.</div>}
                    {queue.map((q) => (
                      <article key={q.booking_id} className="hp-case">
                        {(() => {
                          const responseState = String(q.hospital_response || "pending").toLowerCase();
                          const hasResponded = responseState === "ready" || responseState === "not_ready";
                          return (
                            <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <b>{q.patient_name}</b>
                          <span className="hp-pill">#{q.booking_id}</span>
                        </div>
                        <div className="hp-row"><span className="hp-label">Live Vitals</span><span>HR {q.live_vitals.heart_rate} • SpO2 {q.live_vitals.spo2} • BP {q.live_vitals.bp}</span></div>
                        <div className="hp-row"><span className="hp-label">Pre-Diagnosis</span><span>{q.pre_diagnosis_note || "-"}</span></div>
                        <div className="hp-row"><span className="hp-label">Handover</span><span>{q.digital_handover.vitals_summary || "No report yet"}</span></div>
                        <div className="hp-row"><span className="hp-label">Ambulance</span><span>{q.ambulance_number} • {q.driver_name}</span></div>
                        <div className="hp-actions">
                          <button
                            className="hp-btn primary"
                            onClick={() => navigate(`/hospital/reports/${q.booking_id}/insurance`)}
                          >
                            View Medical Health Insurance Details
                          </button>
                          {!hasResponded && (
                            <>
                              <button className="hp-btn ok" onClick={() => updateHospitalResponse(q.booking_id, "ready")}>Approve</button>
                              <button className="hp-btn no" onClick={() => updateHospitalResponse(q.booking_id, "not_ready")}>Reject</button>
                            </>
                          )}
                        </div>
                        {hasResponded && (
                          <div className="hp-response-note" style={{ marginTop: 6 }}>
                            {responseState === "ready"
                              ? "Approved by hospital. Response already sent to admin."
                              : "Rejected by hospital. Currently not available."}
                          </div>
                        )}
                            </>
                          );
                        })()}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "responses" && (
                <section>
                  <div style={{ marginBottom: 10, fontSize: 12, color: "rgba(17,17,17,0.66)" }}>
                    Respond to assigned emergency cases so admin and dispatch can continue the workflow.
                  </div>
                  {responseCards.length === 0 && <div className="hp-empty">No assigned patient requests yet.</div>}
                  <div className="hp-response-page">
                    {responseCards.map((q) => {
                      const response = String(q.hospital_response || "pending").toLowerCase();
                      const hasResponded = response === "ready" || response === "not_ready";
                      const statusText = response === "ready" ? "Approved" : response === "not_ready" ? "Rejected" : "Pending";
                      const message = response === "ready"
                        ? "Request accepted. We are preparing."
                        : response === "not_ready"
                          ? "Request rejected. Currently not available."
                          : "Pending confirmation from hospital.";
                      return (
                        <article key={`resp-${q.booking_id}`} className="hp-response-tile">
                          <div className="hp-response-tile-head">
                            <div className="hp-response-tile-title">Booking #{q.booking_id}</div>
                            <span className={`hp-response-status ${response}`}>{statusText}</span>
                          </div>
                          <div className="hp-row"><span className="hp-label">Patient</span><span>{q.patient_name || "-"}</span></div>
                          <div className="hp-row"><span className="hp-label">Pickup</span><span>{q.pickup_location || "-"}</span></div>
                          <div className="hp-row"><span className="hp-label">Hospital</span><span>{hospital.name || "-"}</span></div>
                          <div className="hp-row"><span className="hp-label">Ambulance</span><span>{q.ambulance_number || "-"}</span></div>
                          <div className="hp-row"><span className="hp-label">Alert</span><span>{q.hospital_response ? "sent" : "pending"}</span></div>
                          <div className="hp-row"><span className="hp-label">Note</span><span>{q.hospital_response_note || "Awaiting hospital approval based on bed/staff availability."}</span></div>
                          <div className="hp-response-tile-note">{message}</div>
                          <div className="hp-actions">
                            {!hasResponded && (
                              <>
                                <button className="hp-btn ok" onClick={() => updateHospitalResponse(q.booking_id, "ready")}>Approve</button>
                                <button className="hp-btn no" onClick={() => updateHospitalResponse(q.booking_id, "not_ready")}>Reject</button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {activeTab === "reports" && (
                <section className="hp-card">
                  <div className="hp-card-title">Case Reports Received From Admin</div>
                  <div style={{ fontSize: 12, color: "rgba(17,17,17,0.66)", marginBottom: 10 }}>
                    Reports sent by admin are listed below in case cards for quick triage preparation.
                  </div>
                  {reportCards.length === 0 && <div className="hp-empty">No reports received yet.</div>}
                  <div className="hp-report-grid">
                    {reportCards.map((q, idx) => (
                      <article key={`report-${q.booking_id}`} className="hp-report-card">
                        <div className="hp-report-thumb">📄</div>
                        <div className="hp-report-main">
                          <div className="hp-report-title">Case {idx + 1} · Booking #{q.booking_id}</div>
                          <div className="hp-report-line"><b>Patient:</b> {q.patient_name || "-"}</div>
                          <div className="hp-report-line"><b>Pickup:</b> {q.pickup_location || "-"}</div>
                          <div className="hp-report-line"><b>Ambulance:</b> {q.ambulance_number || "-"}</div>
                          <div className="hp-report-line"><b>Submitted:</b> {q.digital_handover?.report_submitted_at ? new Date(q.digital_handover.report_submitted_at).toLocaleString("en-IN") : "-"}</div>
                        </div>
                        <div className="hp-report-side">
                          <span className="hp-report-tag">Case {idx + 1}</span>
                          <span className="hp-report-status">{q.digital_handover?.report_sent_to_hospital ? "Sent to Hospital" : "Shared"}</span>
                          <div className="hp-report-summary">
                            {q.digital_handover?.driver_modified_report || q.digital_handover?.vitals_summary || q.pre_diagnosis_note || "Detailed report not available yet."}
                          </div>
                          <button
                            className="hp-btn primary"
                            style={{ marginTop: 8 }}
                            onClick={() => navigate(`/hospital/reports/${q.booking_id}/view`)}
                          >
                            View Report
                          </button>
                          <button
                            className="hp-btn primary"
                            style={{ marginTop: 8 }}
                            onClick={() => navigate(`/hospital/reports/${q.booking_id}/insurance`)}
                          >
                            View Medical Health Insurance Details
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "tracking" && (
                <section className="hp-card">
                  <div className="hp-card-title">Ambulance Tracking Cards</div>
                  {trackingRows.length === 0 && <div className="hp-empty">No live ambulance coordinates available yet.</div>}
                  <div className="hp-track-grid">
                    {trackingRows.map((r) => (
                      <article key={`trk-${r.booking_id}`} className="hp-track-card">
                        <div className="hp-track-head">
                          <b>{r.ambulance_number}</b>
                          <span className="hp-pill">Booking #{r.booking_id}</span>
                        </div>
                        <div className="hp-row"><span className="hp-label">Driver</span><span>{r.driver_name || "-"}</span></div>
                        <div className="hp-row"><span className="hp-label">Live Location</span><span>{Number(r.ambulance_live.latitude).toFixed(5)}, {Number(r.ambulance_live.longitude).toFixed(5)}</span></div>
                        <div className="hp-row"><span className="hp-label">Speed</span><span>{r.ambulance_live.speed || 0} km/h</span></div>
                        <div className="hp-row"><span className="hp-label">Battery</span><span>{r.ambulance_live.battery_percentage ?? "-"}%</span></div>
                        <div className="hp-actions">
                          <button className="hp-btn primary" onClick={() => goToLiveTrack(r)}>Live Track</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "map" && (
                <section className="hp-card">
                  <div className="hp-card-head">
                    <div className="hp-card-title" style={{ marginBottom: 0 }}>Live Command Center</div>
                    {hiddenMapBookingIds.length > 0 && (
                      <button className="hp-btn" onClick={() => setHiddenMapBookingIds([])}>Reset Removed</button>
                    )}
                  </div>
                  {visibleTrackingRows.length === 0 && <div className="hp-empty">No live ambulance coordinates available yet.</div>}
                  {visibleTrackingRows.length > 0 && (
                    <div className="hp-map-layout">
                      <aside className="hp-map-list">
                        {visibleTrackingRows.map((r) => (
                          <article
                            key={`map-list-${r.booking_id}`}
                            className={`hp-map-list-item ${Number((selectedMapBooking?.booking_id || 0)) === Number(r.booking_id) ? "active" : ""}`}
                            onClick={() => setSelectedMapBookingId(Number(r.booking_id))}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <b>{r.ambulance_number}</b>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span className="hp-pill">#{r.booking_id}</span>
                                <div className="hp-map-menu-wrap">
                                  <button
                                    className="hp-map-menu-btn"
                                    type="button"
                                    title="More options"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMapMenuOpenId((prev) => (prev === Number(r.booking_id) ? 0 : Number(r.booking_id)));
                                    }}
                                  >
                                    ⋮
                                  </button>
                                  {mapMenuOpenId === Number(r.booking_id) && (
                                    <div className="hp-map-menu-pop" onClick={(e) => e.stopPropagation()}>
                                      <button className="hp-map-menu-item" onClick={() => dismissMapBooking(r.booking_id)}>
                                        Remove Card
                                      </button>
                                      <button
                                        className="hp-map-menu-item danger"
                                        onClick={() => deleteBookingPermanently(r.booking_id)}
                                        disabled={deletingBookingId === Number(r.booking_id)}
                                      >
                                        {deletingBookingId === Number(r.booking_id) ? "Deleting..." : "Permanently Delete"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(17,17,17,0.72)", marginTop: 6 }}>{r.driver_name || "-"}</div>
                            <div style={{ fontSize: 11, color: "rgba(17,17,17,0.62)", marginTop: 3 }}>
                              {Number(r.ambulance_live.latitude).toFixed(5)}, {Number(r.ambulance_live.longitude).toFixed(5)}
                            </div>
                            <div className="hp-actions" style={{ marginTop: 8 }}>
                              <button
                                className="hp-btn primary"
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMapBookingId(Number(r.booking_id));
                                }}
                              >
                                Live Track
                              </button>
                            </div>
                          </article>
                        ))}
                      </aside>
                      <section className="hp-map-panel">
                        <div className="hp-map-panel-head">
                          <div style={{ fontSize: 13, fontWeight: 800 }}>
                            {selectedMapBooking?.ambulance_number || "-"} • Booking #{selectedMapBooking?.booking_id || "-"}
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 11, color: "rgba(17,17,17,0.66)" }}>
                              {selectedMapBooking?.driver_name || "-"}
                            </div>
                            <button className="hp-btn primary" onClick={() => setIsFullRouteView((v) => !v)}>
                              {isFullRouteView ? "Close Full Route" : "Open Full Route"}
                            </button>
                          </div>
                        </div>
                        <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(17,17,17,0.12)", background: "rgba(255,255,255,0.72)", fontSize: 11, color: "rgba(17,17,17,0.7)" }}>
                          Route: Ambulance Live Location → {selectedMapBooking?.pickup_location || "Pickup"} → {selectedMapBooking?.destination || selectedMapBooking?.assigned_hospital_name || hospital?.name || "Assigned Hospital"}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(17,17,17,0.12)", background: "rgba(255,255,255,0.72)" }}>
                          <div className="hp-row" style={{ marginTop: 0 }}><span className="hp-label">Speed</span><span>{selectedMapBooking?.ambulance_live?.speed || 0} km/h</span></div>
                          <div className="hp-row" style={{ marginTop: 0 }}><span className="hp-label">Battery</span><span>{selectedMapBooking?.ambulance_live?.battery_percentage ?? "-"}%</span></div>
                        </div>
                        {(isFullRouteView ? fullRouteEmbedSrc : mapEmbedSrc) ? (
                          <iframe
                            className="hp-map-frame"
                            src={isFullRouteView ? fullRouteEmbedSrc : mapEmbedSrc}
                            title="Hospital Live Tracking Map"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        ) : (
                          <div className="hp-empty">Map coordinates unavailable for selected booking.</div>
                        )}
                      </section>
                    </div>
                  )}
                </section>
              )}

              {activeTab === "resources" && (
                <section className="hp-card hp-resource-shell">
                  <div className="hp-card-head">
                    <div className="hp-card-title" style={{ marginBottom: 0 }}>Resource & Bed Management</div>
                    <button
                      className="hp-icon-btn"
                      title={resourceEditMode ? "Close manage mode" : "Manage and update resources"}
                      onClick={() => setResourceEditMode((v) => !v)}
                    >
                      {resourceEditMode ? "✓" : "⚙"}
                    </button>
                  </div>
                  {redirectSuggestion && (
                    <div className="hp-alert">
                      Auto Redirect Suggestion: {redirectSuggestion.hospital_name} has {redirectSuggestion.available_beds} beds available.
                    </div>
                  )}

                  <div className="hp-resource-grid">
                    <div className="hp-resource-mini">
                      <div className="v">{resourceForm.available_beds}</div>
                      <div className="k">Available Beds</div>
                    </div>
                    <div className="hp-resource-mini">
                      <div className="v">{resourceForm.icu_beds}</div>
                      <div className="k">ICU Beds</div>
                    </div>
                    <div className="hp-resource-mini">
                      <div className="v">{resourceForm.available_ventilators}</div>
                      <div className="k">Ventilators</div>
                    </div>
                    <div className="hp-resource-mini">
                      <div className="v" style={{ textTransform: "uppercase", fontSize: 14, marginTop: 6 }}>{resourceForm.status}</div>
                      <div className="k">Status</div>
                    </div>
                  </div>
                  <div className="hp-resource-notes">
                    <div className="hp-row" style={{ marginTop: 0 }}>
                      <span className="hp-label">Specializations</span>
                      <span style={{ textAlign: "right", maxWidth: "75%" }}>{resourceForm.specializations || "-"}</span>
                    </div>
                    <div className="hp-row">
                      <span className="hp-label">Facilities</span>
                      <span style={{ textAlign: "right", maxWidth: "75%" }}>{resourceForm.facilities || "-"}</span>
                    </div>
                  </div>

                  {resourceEditMode && (
                    <>
                      <div className="hp-form-grid" style={{ marginTop: 10 }}>
                        <input className="hp-input" type="number" value={resourceForm.available_beds} onChange={(e) => setResourceForm((f) => ({ ...f, available_beds: Number(e.target.value) }))} placeholder="Available beds" />
                        <input className="hp-input" type="number" value={resourceForm.icu_beds} onChange={(e) => setResourceForm((f) => ({ ...f, icu_beds: Number(e.target.value) }))} placeholder="ICU beds" />
                        <input className="hp-input" type="number" value={resourceForm.available_ventilators} onChange={(e) => setResourceForm((f) => ({ ...f, available_ventilators: Number(e.target.value) }))} placeholder="Available ventilators" />
                        <select className="hp-select" value={resourceForm.status} onChange={(e) => setResourceForm((f) => ({ ...f, status: e.target.value }))}>
                          <option value="active">Active</option>
                          <option value="critical">Critical</option>
                          <option value="full">Full</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <textarea className="hp-textarea" value={resourceForm.specializations} onChange={(e) => setResourceForm((f) => ({ ...f, specializations: e.target.value }))} placeholder="Specializations" />
                      <textarea className="hp-textarea" value={resourceForm.facilities} onChange={(e) => setResourceForm((f) => ({ ...f, facilities: e.target.value }))} placeholder="Facilities" />
                      <div className="hp-actions">
                        <button className="hp-btn ok" onClick={updateResources}>Save Resource Update</button>
                        <button className="hp-btn" onClick={() => setResourceEditMode(false)}>Cancel</button>
                      </div>
                    </>
                  )}

                  <div className="hp-card hp-oncall-box">
                    <div className="hp-card-title">Specialist On-Call</div>
                    {onCallSpecialists.length === 0 && <div className="hp-empty">No specialist on-call marked yet.</div>}
                    {onCallSpecialists.map((doc) => (
                      <div key={doc.id} className="hp-row">
                        <span>{doc.full_name} ({doc.specialization || "General"})</span>
                        <span className="hp-pill">On Call</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === "staff" && (
                <>
                  <section className="hp-staff-hero">
                    <div className="hp-staff-hero-kicker">Hospital Talent Network</div>
                    <h2 className="hp-staff-hero-title">Meet Our Experts</h2>
                    <p className="hp-staff-hero-sub">
                      Doctors, nurses, technicians and support staff are shown as independent profile cards for faster review
                      before emergency handover.
                    </p>
                  </section>

                  {showAddStaffForm && (
                    <section className="hp-card hp-staff-form-card">
                      <div className="hp-card-title">Add New Staff Profile</div>
                      <div className="hp-form-grid">
                        <input className="hp-input" value={staffForm.full_name} onChange={(e) => setStaffForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Full name" />
                        <select className="hp-select" value={staffForm.role} onChange={(e) => setStaffForm((f) => ({ ...f, role: e.target.value }))}>
                          <option value="doctor">Doctor</option>
                          <option value="nurse">Nurse</option>
                          <option value="technician">Technician</option>
                          <option value="support">Support</option>
                        </select>
                        <input className="hp-input" value={staffForm.specialization} onChange={(e) => setStaffForm((f) => ({ ...f, specialization: e.target.value }))} placeholder="Specialization" />
                        <input className="hp-input" value={staffForm.contact_number} onChange={(e) => setStaffForm((f) => ({ ...f, contact_number: e.target.value }))} placeholder="Contact number" />
                        <input className="hp-input" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" />
                        <input className="hp-input" type="number" value={staffForm.years_experience} onChange={(e) => setStaffForm((f) => ({ ...f, years_experience: Number(e.target.value) }))} placeholder="Experience (years)" />
                        <select className="hp-select" value={staffForm.is_active ? "available" : "unavailable"} onChange={(e) => setStaffForm((f) => ({ ...f, is_active: e.target.value === "available" }))}>
                          <option value="available">Available</option>
                          <option value="unavailable">Unavailable</option>
                        </select>
                        <input className="hp-input" type="file" accept="image/*" onChange={handleStaffBannerUpload} />
                        <input className="hp-input" type="file" accept="image/*" onChange={handleStaffImageUpload} />
                        <div className="hp-input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "rgba(17,17,17,0.62)", fontWeight: 700 }}>Banner:</span>
                          <span style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>
                            {staffForm.banner_data ? "Banner selected" : "No banner selected"}
                          </span>
                        </div>
                        <div className="hp-input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {staffForm.photo_data ? (
                            <img src={staffForm.photo_data} alt="preview" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#dfeab0", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>IMG</div>
                          )}
                          <span style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>
                            {staffForm.photo_data ? "Image selected" : "No image selected"}
                          </span>
                        </div>
                      </div>
                      <div className="hp-actions">
                        <button className="hp-btn" onClick={() => setStaffForm((f) => ({ ...f, is_on_call: !f.is_on_call }))}>
                          {staffForm.is_on_call ? "On-Call: Yes" : "On-Call: No"}
                        </button>
                        <button className="hp-btn ok" onClick={addStaff}>Create Staff Card</button>
                        <button className="hp-btn" onClick={() => setShowAddStaffForm(false)}>Close</button>
                      </div>
                    </section>
                  )}

                  {staff.length === 0 && <div className="hp-card"><div className="hp-empty">No staff added yet.</div></div>}

                  {[
                    { key: "doctor", title: "Our Trusted Doctors" },
                    { key: "nurse", title: "Nursing Team" },
                    { key: "technician", title: "Technicians" },
                    { key: "support", title: "Support Staff" },
                  ].map((section) => {
                    const members = groupedStaff[section.key] || [];
                    if (members.length === 0) return null;
                    return (
                      <section className="hp-card hp-staff-role-card" key={section.key}>
                        <div className="hp-role-head">
                          <div className="hp-role-title">{section.title}</div>
                          <span className="hp-role-count">{members.length}</span>
                        </div>
                        <div className="hp-role-grid">
                          {members.map((s) => (
                            <div key={s.id}>
                              <article className="hp-role-card">
                                <div
                                  className="hp-role-cover"
                                  style={
                                    s.banner_data
                                      ? {
                                          backgroundImage: `linear-gradient(180deg, rgba(17,17,17,0.12), rgba(17,17,17,0.45)), url(${s.banner_data})`,
                                          backgroundSize: "cover",
                                          backgroundPosition: "center",
                                        }
                                      : undefined
                                  }
                                />
                                <div className="hp-role-controls">
                                  <button className="hp-role-delete" title="Delete Staff" onClick={() => deleteStaff(s)}>🗑</button>
                                  <button className="hp-role-edit" onClick={() => startEditStaff(s)}>Edit</button>
                                </div>
                                {s.photo_data ? (
                                  <img src={s.photo_data} alt={s.full_name} className="hp-role-avatar" />
                                ) : (
                                  <div className="hp-role-avatar hp-role-avatar-fallback">
                                    {(s.full_name || "S").trim().charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="hp-role-body">
                                  <div className="hp-role-name">{s.full_name}</div>
                                  <div className="hp-role-handle">@{String(s.role || "staff").toLowerCase()}</div>
                                  <div className="hp-role-sub">{s.specialization || "General Care Unit"}</div>
                                  <div className="hp-role-meta">Experience: {s.years_experience} years</div>
                                  <div className="hp-role-meta">Contact: {s.contact_number || "-"}</div>
                                  <div className="hp-role-meta">Email: {s.email || "-"}</div>
                                  <div className="hp-role-bio">
                                    {s.is_on_call ? "On-call specialist for emergency handovers." : "Currently assigned to scheduled hospital duties."}
                                  </div>
                                  <div className="hp-role-footer">
                                    <span className={`hp-availability ${s.is_active ? "yes" : "no"}`}>{s.is_active ? "Available" : "Unavailable"}</span>
                                    <span className="hp-role-mini-btn">{s.is_on_call ? "On Call" : "Off Duty"}</span>
                                  </div>
                                </div>
                              </article>
                              {editingStaffId === s.id && (
                                <div className="hp-edit-card">
                                  <div className="hp-form-grid">
                                    <input className="hp-input" value={editStaffForm.full_name} onChange={(e) => setEditStaffForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Full name" />
                                    <select className="hp-select" value={editStaffForm.role} onChange={(e) => setEditStaffForm((f) => ({ ...f, role: e.target.value }))}>
                                      <option value="doctor">Doctor</option>
                                      <option value="nurse">Nurse</option>
                                      <option value="technician">Technician</option>
                                      <option value="support">Support</option>
                                    </select>
                                    <input className="hp-input" value={editStaffForm.specialization} onChange={(e) => setEditStaffForm((f) => ({ ...f, specialization: e.target.value }))} placeholder="Specialization" />
                                    <input className="hp-input" value={editStaffForm.contact_number} onChange={(e) => setEditStaffForm((f) => ({ ...f, contact_number: e.target.value }))} placeholder="Contact number" />
                                    <input className="hp-input" value={editStaffForm.email} onChange={(e) => setEditStaffForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" />
                                    <input className="hp-input" type="number" value={editStaffForm.years_experience} onChange={(e) => setEditStaffForm((f) => ({ ...f, years_experience: Number(e.target.value) }))} placeholder="Experience (years)" />
                                    <select className="hp-select" value={editStaffForm.is_active ? "available" : "unavailable"} onChange={(e) => setEditStaffForm((f) => ({ ...f, is_active: e.target.value === "available" }))}>
                                      <option value="available">Available</option>
                                      <option value="unavailable">Unavailable</option>
                                    </select>
                                    <input className="hp-input" type="file" accept="image/*" onChange={handleEditStaffBannerUpload} />
                                    <input className="hp-input" type="file" accept="image/*" onChange={handleEditStaffImageUpload} />
                                    <div className="hp-input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <span style={{ fontSize: 11, color: "rgba(17,17,17,0.62)", fontWeight: 700 }}>Banner:</span>
                                      <span style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>
                                        {editStaffForm.banner_data ? "Banner selected" : "No banner selected"}
                                      </span>
                                    </div>
                                    <div className="hp-input" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      {editStaffForm.photo_data ? (
                                        <img src={editStaffForm.photo_data} alt="preview" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
                                      ) : (
                                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#dfeab0", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>IMG</div>
                                      )}
                                      <span style={{ fontSize: 11, color: "rgba(17,17,17,0.62)" }}>
                                        {editStaffForm.photo_data ? "Image selected" : "No image selected"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="hp-actions">
                                    <button className="hp-btn" onClick={() => setEditStaffForm((f) => ({ ...f, is_on_call: !f.is_on_call }))}>
                                      {editStaffForm.is_on_call ? "On-Call: Yes" : "On-Call: No"}
                                    </button>
                                    <button className="hp-btn ok" onClick={saveEditStaff}>Save Changes</button>
                                    <button className="hp-btn" onClick={() => setEditingStaffId(null)}>Cancel</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </>
              )}

              {activeTab === "cases" && (
                <section className="hp-card">
                  <div className="hp-cases-head">
                    <div>
                      <div className="hp-card-title" style={{ fontSize: 18, marginBottom: 4 }}>Hospital Cases</div>
                      <div style={{ fontSize: 12, color: "rgba(17,17,17,0.62)" }}>
                        Active admitted and assigned cases for {hospital?.name || "your hospital"}.
                      </div>
                    </div>
                    <div className="hp-cases-count">
                      <div className="v">{caseCards.length}</div>
                      <div className="k">Total Cases</div>
                    </div>
                  </div>

                  {caseCards.length === 0 && <div className="hp-empty">No hospital cases are assigned right now.</div>}

                  <div className="hp-cases-strip">
                    {caseCards.map((c) => {
                      const isOpen = Number(openCaseId) === Number(c.booking_id);
                      return (
                        <article className="hp-case-card" key={`case-${c.booking_id}`}>
                          <div className="hp-case-top">
                            <div>
                              <div className="hp-case-name">{c.patient_name || "Unknown Patient"}</div>
                              <div className="hp-case-sub">
                                Booking #{c.booking_id} - {c.patient_age || "Age -"} - {c.patient_gender || "Gender -"}
                              </div>
                            </div>
                            <button
                              className={`hp-case-menu-btn ${isOpen ? "open" : ""}`}
                              title="Show case details"
                              onClick={() => setOpenCaseId(Number(c.booking_id))}
                            >
                              <MoreVertical size={18} />
                            </button>
                          </div>

                          <div className="hp-case-meta">
                            <div className="hp-case-metric">
                              <div className="k">Admitted</div>
                              <div className="v">{c.daysAdmitted} day{c.daysAdmitted > 1 ? "s" : ""}</div>
                            </div>
                            <div className="hp-case-metric">
                              <div className="k">Current Bill</div>
                              <div className="v">Rs {Number(c.currentBill || 0).toLocaleString("en-IN")}</div>
                            </div>
                            <div className="hp-case-metric">
                              <div className="k">Doctor</div>
                              <div className="v">{c.doctorName}</div>
                            </div>
                          </div>

                          <div className="hp-row"><span className="hp-label">Condition</span><span>{c.pre_diagnosis_note || c.digital_handover?.patient_condition || "-"}</span></div>
                          <div className="hp-row"><span className="hp-label">Pickup</span><span>{c.pickup_location || "-"}</span></div>

                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {activeTab === "cases" && openCase && (
                <div className="hp-case-modal-backdrop" onClick={() => setOpenCaseId(0)}>
                  <div className="hp-case-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="hp-case-modal-head">
                      <div>
                        <div className="hp-case-modal-title">{openCase.patient_name || "Unknown Patient"}</div>
                        <div className="hp-case-modal-sub">
                          Booking #{openCase.booking_id} - {openCase.patient_age || "Age -"} - {openCase.patient_gender || "Gender -"}
                        </div>
                      </div>
                      <button className="hp-case-modal-close" onClick={() => setOpenCaseId(0)} title="Close">x</button>
                    </div>
                    <div className="hp-case-modal-body">
                      <div className="hp-case-modal-stats">
                        <div className="hp-case-modal-stat"><div className="k">Admitted</div><div className="v">{openCase.daysAdmitted} day{openCase.daysAdmitted > 1 ? "s" : ""}</div></div>
                        <div className="hp-case-modal-stat"><div className="k">Current Bill</div><div className="v">Rs {Number(openCase.currentBill || 0).toLocaleString("en-IN")}</div></div>
                        <div className="hp-case-modal-stat"><div className="k">Doctor</div><div className="v">{openCase.doctorName}</div></div>
                        <div className="hp-case-modal-stat"><div className="k">Status</div><div className="v">{openCase.hospital_response || "pending"}</div></div>
                      </div>

                      <div className="hp-case-modal-grid">
                        <div className="hp-case-modal-box"><div className="k">Admit Date</div><div className="v">{openCase.admittedAtLabel}</div></div>
                        <div className="hp-case-modal-box"><div className="k">Treating Doctor</div><div className="v">{openCase.doctorName} - {openCase.doctorSpecialization}</div></div>
                        <div className="hp-case-modal-box"><div className="k">Doctor Contact</div><div className="v">{openCase.doctorContact}</div></div>
                        <div className="hp-case-modal-box"><div className="k">Patient Contact</div><div className="v">{openCase.contact_number || openCase.patient_contact_number || "-"}</div></div>
                        <div className="hp-case-modal-box"><div className="k">Ambulance</div><div className="v">{openCase.ambulance_number || "-"} - {openCase.driver_name || "Driver pending"}</div></div>
                        <div className="hp-case-modal-box"><div className="k">Driver Contact</div><div className="v">{openCase.driver_contact || "-"}</div></div>
                        <div className="hp-case-modal-box wide"><div className="k">Pickup</div><div className="v">{openCase.pickup_location || "-"}</div></div>
                        <div className="hp-case-modal-box wide"><div className="k">Condition</div><div className="v">{openCase.pre_diagnosis_note || openCase.digital_handover?.patient_condition || "-"}</div></div>
                        <div className="hp-case-modal-box wide"><div className="k">Vitals / Handover</div><div className="v">{openCase.digital_handover?.vitals_summary || `HR ${openCase.live_vitals?.heart_rate || "-"} - SpO2 ${openCase.live_vitals?.spo2 || "-"} - BP ${openCase.live_vitals?.bp || "-"}`}</div></div>
                        <div className="hp-case-modal-box wide"><div className="k">Insurance</div><div className="v">{openCase.insurance?.provider || "Provider not submitted"} - Status: {openCase.insurance?.status || "pending"}</div></div>
                        <div className="hp-case-modal-box wide"><div className="k">Bill Basis</div><div className="v">{openCase.billBreakdown?.rule || "-"}</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "analytics" && (
                <section>
                  <div className="hp-card" style={{ padding: "20px 24px", marginBottom: 16 }}>
                    <div className="hp-card-title" style={{ fontSize: 20, marginBottom: 16 }}>
                      <span style={{ marginRight: 8 }}>🏥</span> HOSPITAL EMERGENCY ROOM DASHBOARD
                    </div>

                    <div className="hp-an-top">
                      <div className="hp-an-stat hi">
                        <div className="hp-an-lbl">Total Active Intakes</div>
                        <div className="hp-an-v">{queue.length}</div>
                        <div className="hp-an-sub">Active emergencies en route</div>
                      </div>
                      <div className="hp-an-stat">
                        <div className="hp-an-lbl">Hospital Beds Available</div>
                        <div className="hp-an-v">{hospital?.available_beds || 0}</div>
                        <div className="hp-an-sub">ICU Beds: <span>{hospital?.icu_beds || 0}</span></div>
                      </div>
                      <div className="hp-an-stat">
                        <div className="hp-an-lbl">Total Hospital Staff</div>
                        <div className="hp-an-v">{staff.length}</div>
                        <div className="hp-an-sub">Active Specialists: <span>{onCallSpecialists.length}</span></div>
                      </div>
                      <div className="hp-an-stat">
                        <div className="hp-an-lbl">Available Ventilators</div>
                        <div className="hp-an-v">{hospital?.available_ventilators || 0}</div>
                        <div className="hp-an-sub">Emergency Dept. Ready</div>
                      </div>
                    </div>

                    <div className="hp-an-mid">
                      <div className="hp-card" style={{ marginBottom: 0 }}>
                        <div className="hp-card-title" style={{ fontSize: 13 }}>Staff Demographics</div>
                        <div className="hp-an-circle">
                          <div className="hp-an-c-lbl">{Math.round((staff.filter(s => s.role === 'doctor').length / (staff.length || 1)) * 100)}%</div>
                        </div>
                        <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                          Doctors: {staff.filter(s => s.role === 'doctor').length} &nbsp;|&nbsp; Nurses: {staff.filter(s => s.role === 'nurse').length}
                        </div>
                      </div>
                      <div className="hp-card" style={{ marginBottom: 0 }}>
                        <div className="hp-card-title" style={{ fontSize: 13 }}>Case Journey Status</div>
                        <div className="hp-an-chart">
                          {[
                            { l: "Total", v: summary?.active_cases ? summary.active_cases * 4 + 10 : 80, max: 100 },
                            { l: "Completed", v: summary?.active_cases ? summary.active_cases * 3 + 2 : 45, max: 100 },
                            { l: "Active", v: summary?.active_cases || queue.length || 0, max: 50 },
                            { l: "Pending", v: queue.filter(q => q.hospital_response === "pending").length, max: 20 },
                            { l: "Cancelled", v: 2, max: 20 }
                          ].map((b, i) => (
                            <div className="hp-an-bar-wrap" key={i}>
                              <div className={`hp-an-bar ${i === 1 ? "hi" : ""}`} style={{ height: `${Math.min((b.v / Math.max(b.max, b.v || 1)) * 100, 100) || 5}%` }} />
                              <div className="hp-an-b-lbl">{b.l}</div>
                              <div style={{ fontSize: 9, fontWeight: 900, marginTop: 4, color: "#111" }}>{b.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="hp-card" style={{ marginBottom: 0, padding: 0 }}>
                        <div className="hp-card-title" style={{ fontSize: 13, padding: "14px 14px 0" }}>Booking Action Requirements</div>
                        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
                          {[
                            { l: "Pending", v: queue.filter(q => !q.hospital_response || q.hospital_response === "pending").length, c: "rgba(255,201,119,1)", max: queue.length || 1 },
                            { l: "Ready", v: queue.filter(q => q.hospital_response === "ready").length, c: "#00c853", max: queue.length || 1 },
                            { l: "Rejected", v: queue.filter(q => q.hospital_response === "not_ready").length, c: "#e50914", max: queue.length || 1 },
                          ].map(a => (
                            <div key={a.l} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 50, fontSize: 10, color: "rgba(17,17,17,0.7)" }}>{a.l}</div>
                              <div style={{ flex: 1, height: 6, background: "rgba(17,17,17,0.1)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min((a.v / a.max) * 100, 100)}%`, height: "100%", background: a.c }} />
                              </div>
                              <div style={{ fontSize: 10, fontWeight: 800, color: "#111" }}>{a.v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="hp-card" style={{ padding: "20px 24px", marginBottom: 0 }}>
                    <div className="hp-card-title" style={{ fontSize: 16, marginBottom: 16, color: "#111" }}>
                      📦 Booking Tracking & Status
                    </div>
                    <div className="hp-an-table-w">
                      <div className="hp-an-th">
                        <div>Booking ID</div>
                        <div>Booking Track</div>
                        <div>Status</div>
                        <div>ETA</div>
                        <div>Assigned Driver</div>
                        <div>Vehicle</div>
                        <div style={{ textAlign: "right" }}>Actions</div>
                      </div>
                      {queue.length === 0 && <div className="hp-empty" style={{ padding: 30 }}>No active tracking data available.</div>}
                      {queue.map((q, i) => (
                        <div className="hp-an-tr" key={q.booking_id}>
                          <div style={{ fontWeight: 800, color: "rgba(17,17,17,0.7)" }}>#{q.booking_id.toString().padStart(4, "0")}</div>
                          <div style={{ letterSpacing: 2 }}>🟡 🚑 🔴</div>
                          <div><div className="hp-an-status">ACTIVE</div></div>
                          <div style={{ color: "rgba(17,17,17,0.7)", fontSize: 12 }}>
                            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} {new Date(new Date().getTime() + 15 * 60000).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#4e35db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>🧑‍✈️</div>
                            {q.driver_name || "Assigned"}
                          </div>
                          <div style={{ color: "rgba(17,17,17,0.6)", fontSize: 12 }}>{q.ambulance_number}</div>
                          <div style={{ textAlign: "right" }}>
                            <button className="hp-icon-btn" style={{ background: "rgba(17,17,17,0.05)", borderColor: "rgba(17,17,17,0.1)", color: "#111" }} onClick={() => navigate(`/hospital/live-track?booking_id=${q.booking_id}`)}>
                              👁
                            </button>
                          </div>
                        </div>
                      ))}
                      {queue.length > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderTop: "1px solid rgba(17,17,17,0.08)" }}>
                          <div style={{ fontSize: 11, color: "rgba(17,17,17,0.5)" }}>Showing 1 to {queue.length} of {queue.length} bookings</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="hp-icon-btn" style={{ width: 24, height: 24, fontSize: 11, background: "var(--hp-accent)", color: "#111", borderColor: "var(--hp-accent)", fontWeight: 900 }}>1</button>
                            <button className="hp-icon-btn" style={{ width: 24, height: 24, fontSize: 11, background: "rgba(17,17,17,0.05)", color: "#111", borderColor: "transparent", fontWeight: 900 }}>2</button>
                            <button className="hp-icon-btn" style={{ width: 24, height: 24, fontSize: 11, background: "rgba(17,17,17,0.05)", color: "#111", borderColor: "transparent", fontWeight: 900 }}>3</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
