import GoogleNavOverlay from "../Components/GoogleNavOverlay";
import TomTomLiveMap from "../Components/TomTomLiveMap";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowRight, BedSingle, MapPinned, MoreVertical, Stethoscope, Accessibility } from "lucide-react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
const RESOURCE_CACHE_KEY = "swiftrescue_hospital_resources";

const fetchJsonOrNull = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const rememberHospitalSession = (hospitalData) => {
  if (!hospitalData?.id) return;
  localStorage.setItem("hospital_id", String(hospitalData.id));
  if (hospitalData.name) localStorage.setItem("name", hospitalData.name);
};

const readResourceCache = (hospitalId) => {
  try {
    const cache = JSON.parse(localStorage.getItem(RESOURCE_CACHE_KEY) || "{}");
    return cache[String(hospitalId)] || {};
  } catch {
    return {};
  }
};

const saveResourceCache = (hospitalId, values) => {
  try {
    const cache = JSON.parse(localStorage.getItem(RESOURCE_CACHE_KEY) || "{}");
    cache[String(hospitalId)] = { ...(cache[String(hospitalId)] || {}), ...values };
    localStorage.setItem(RESOURCE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Browser storage can be unavailable; Django remains the source of truth.
  }
};

const hasCoordPair = (lat, lng) => {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) && nLat >= 6 && nLat <= 38 && nLng >= 68 && nLng <= 98;
};

const coordText = (lat, lng) => (hasCoordPair(lat, lng) ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : "-");

const toLngLat = (lat, lng) => (hasCoordPair(lat, lng) ? [Number(lng), Number(lat)] : null);

const dedupeLngLat = (coords) => {
  const out = [];
  coords.filter(Boolean).forEach((coord) => {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev[0] - coord[0]) > 0.00001 || Math.abs(prev[1] - coord[1]) > 0.00001) {
      out.push(coord);
    }
  });
  return out;
};

const routeDataFromLngLat = (coords) => {
  const clean = dedupeLngLat(coords);
  if (clean.length < 2) return null;
  return {
    distance_m: 0,
    duration_s: 0,
    traffic_delay_s: 0,
    traffic_sections: [],
    steps: [],
    geometry: {
      type: "LineString",
      coordinates: clean,
    },
  };
};

const routeDataFromSavedPolyline = (polyline) => {
  try {
    const parsed = JSON.parse(polyline || "[]");
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    const coords = parsed
      .map((coord) => {
        if (!Array.isArray(coord) || coord.length < 2) return null;
        const c0 = Number(coord[0]);
        const c1 = Number(coord[1]);
        if (!Number.isFinite(c0) || !Number.isFinite(c1)) return null;
        // In India: lat is 6..38, lng is 68..98
        if (c0 >= 6 && c0 <= 38 && c1 >= 68 && c1 <= 98) {
          return [c1, c0]; // was [lat, lng], return [lng, lat]
        }
        if (c0 >= 68 && c0 <= 98 && c1 >= 6 && c1 <= 38) {
          return [c0, c1]; // was already [lng, lat]
        }
        return null;
      })
      .filter(Boolean);
    return routeDataFromLngLat(coords);
  } catch {
    return null;
  }
};

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
  const cachedPortal = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("hospital_portal_cache") || "null");
    } catch {
      return null;
    }
  })();
  const [hospital, setHospital] = useState(cachedPortal?.hospital || null);
  const [summary, setSummary] = useState(cachedPortal?.summary || null);
  const [queue, setQueue] = useState(cachedPortal?.queue || []);
  const [staff, setStaff] = useState(cachedPortal?.staff || []);
  const [onCallSpecialists, setOnCallSpecialists] = useState(cachedPortal?.onCallSpecialists || []);
  const [redirectSuggestion, setRedirectSuggestion] = useState(cachedPortal?.redirectSuggestion || null);
  const [loading, setLoading] = useState(!cachedPortal?.hospital);
  const [err, setErr] = useState("");
  const [resourceEditMode, setResourceEditMode] = useState(false);
  const [resourceForm, setResourceForm] = useState({
    total_beds: 40,
    available_beds: 10,
    icu_beds: 4,
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
        hospitalData = await fetchJsonOrNull(`${BASE}/api/hospitals/${storedHospitalId}/`);
      }

      if (!hospitalData && hospitalEmail) {
        hospitalData = await fetchJsonOrNull(`${BASE}/api/hospitals/by-email/?email=${encodeURIComponent(hospitalEmail)}`);
      }

      if (!hospitalData) {
        const allHospitals = await fetchJsonOrNull(`${BASE}/api/hospitals/`);
        const activeHospitals = Array.isArray(allHospitals)
          ? allHospitals.filter((item) => item && item.is_active !== false)
          : [];
        const nameHint = (localStorage.getItem("name") || "").trim().toLowerCase();
        hospitalData =
          activeHospitals.find((item) => String(item.email || "").trim().toLowerCase() === hospitalEmail) ||
          activeHospitals.find((item) => nameHint && String(item.name || "").trim().toLowerCase() === nameHint) ||
          (activeHospitals.length === 1 ? activeHospitals[0] : null);
      }

      const hospitalId = Number(hospitalData?.id || hospitalData?.hospital_id);
      if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
        throw new Error("Hospital profile not configured for this account");
      }
      rememberHospitalSession({ ...hospitalData, id: hospitalId });

      const dashRes = await fetch(`${BASE}/api/hospitals/${hospitalId}/dashboard/`);
      if (!dashRes.ok) throw new Error("Unable to load hospital dashboard");
      const dashboard = await dashRes.json();

      const finalHosp = dashboard.hospital || hospitalData;
      const finalSum = dashboard.summary || null;
      const finalQueue = Array.isArray(dashboard.queue) ? dashboard.queue : [];
      const finalStaff = Array.isArray(dashboard.staff) ? dashboard.staff : [];
      const finalSpecs = Array.isArray(dashboard.on_call_specialists) ? dashboard.on_call_specialists : [];
      const finalRedir = dashboard.redirect_suggestion || null;

      setHospital(finalHosp);
      setSummary(finalSum);
      setQueue(finalQueue);
      setStaff(finalStaff);
      setOnCallSpecialists(finalSpecs);
      setRedirectSuggestion(finalRedir);

      try {
        sessionStorage.setItem("hospital_portal_cache", JSON.stringify({
          hospital: finalHosp,
          summary: finalSum,
          queue: finalQueue,
          staff: finalStaff,
          onCallSpecialists: finalSpecs,
          redirectSuggestion: finalRedir,
        }));
      } catch {}

      const serverResources = {
        total_beds: dashboard.hospital?.total_beds ?? 40,
        available_beds: dashboard.hospital?.available_beds ?? 0,
        icu_beds: dashboard.hospital?.icu_beds ?? 0,
        available_ventilators: dashboard.hospital?.available_ventilators ?? 0,
        status: dashboard.hospital?.status || "active",
        specializations: dashboard.hospital?.specializations || "",
        facilities: dashboard.hospital?.facilities || "",
      };
      // Server bed counts ALWAYS take priority – cache only keeps unsaved text edits
      const cachedResources = readResourceCache(hospitalId);
      const savedResources = {
        ...serverResources,
        // Only keep cached specializations/facilities/status if user was mid-edit
        ...(cachedResources.specializations ? { specializations: cachedResources.specializations } : {}),
        ...(cachedResources.facilities ? { facilities: cachedResources.facilities } : {}),
      };
      setResourceForm(savedResources);
      setLastSyncedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (e) {
      if (!silent) setErr(e.message || "Something went wrong");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // SWR: silent revalidation if we already have hospital data (zero flicker!)
    fetchHospitalDashboard({ silent: Boolean(hospital) });
    const pollMs =
      activeTab === "tracking" ||
      activeTab === "map" ||
      activeTab === "queue" ||
      activeTab === "responses" ||
      activeTab === "reports"
        ? 7000
        : 18000;
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
      // Clear cache after successful save so server stays source of truth
      try { localStorage.removeItem(RESOURCE_CACHE_KEY); } catch {}
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
      // Optimistically update queue immediately so cards never flash or disappear
      setQueue((prev) =>
        prev.map((item) =>
          Number(item.booking_id) === Number(bookingId)
            ? {
                ...item,
                hospital_response: response,
                hospital_response_note: response === "ready" ? "Hospital intake ready" : "No immediate bed/staff availability",
              }
            : item
        )
      );
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/hospital-response/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospital_response: response,
          hospital_response_note: response === "ready" ? "Hospital intake ready" : "No immediate bed/staff availability",
        }),
      });
      if (!res.ok) throw new Error("Response update failed");
      await fetchHospitalDashboard({ silent: true });
    } catch {
      setErr("Unable to update hospital response");
    }
  };

  const assignBedInPortal = async (bookingId) => {
    if (!hospital?.id) return;
    try {
      const res = await fetch(`${BASE}/api/hospitals/${hospital.id}/beds/assign/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign bed");
      // Optimistically update queue item with bed info
      setQueue((prev) =>
        prev.map((item) =>
          Number(item.booking_id) === Number(bookingId)
            ? {
                ...item,
                assigned_bed_id: data.bed?.id,
                assigned_bed_number: data.bed?.bed_number || "G-001",
                assigned_bed_type: "general",
              }
            : item
        )
      );
      await fetchHospitalDashboard({ silent: true });
    } catch (err) {
      alert(err.message);
    }
  };

  const switchIcuInPortal = async (bookingId) => {
    if (!hospital?.id) return;
    if (!window.confirm("Switch patient to an available ICU Bed? The existing bed will be freed.")) return;
    try {
      const res = await fetch(`${BASE}/api/hospitals/${hospital.id}/beds/switch-icu/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No available ICU bed found");
      // Optimistically update queue item with ICU bed info
      setQueue((prev) =>
        prev.map((item) =>
          Number(item.booking_id) === Number(bookingId)
            ? {
                ...item,
                assigned_bed_id: data.icu_bed?.id,
                assigned_bed_number: data.icu_bed?.bed_number || "ICU-001",
                assigned_bed_type: "icu",
              }
            : item
        )
      );
      await fetchHospitalDashboard({ silent: true });
    } catch (err) {
      alert(err.message);
    }
  };

  const markPatientReached = async (bookingId) => {
    try {
      setQueue((prev) =>
        prev.map((item) =>
          Number(item.booking_id) === Number(bookingId)
            ? { ...item, patient_reached: true, patient_reached_at: new Date().toISOString() }
            : item
        )
      );
      const res = await fetch(`${BASE}/api/bookings/${bookingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_reached: true }),
      });
      if (!res.ok) throw new Error("Patient reached update failed");
      await fetchHospitalDashboard({ silent: true });
    } catch {
      setErr("Unable to update patient reached status");
    }
  };

  const [osrmCache, setOsrmCache] = useState({});

  const formatDuration = (mins) => {
    if (!mins || mins <= 0) return "1 min";
    if (mins < 60) return `~${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `~${hrs} hr ${remMins} min` : `~${hrs} hr`;
  };

  const resolveDestinationCoord = (item, hospitalData) => {
    const hLat = Number(hospitalData?.latitude);
    const hLng = Number(hospitalData?.longitude);
    if (Number.isFinite(hLat) && Number.isFinite(hLng) && hLat > 8 && hLat < 37 && hLng > 68 && hLng < 97 && hLat !== 56) {
      return { lat: hLat, lng: hLng, name: hospitalData?.name || "Hospital" };
    }

    const text = `${item?.destination || ""} ${item?.assigned_hospital_name || ""} ${item?.assigned_hospital_address || ""} ${hospitalData?.name || ""} ${hospitalData?.address || ""}`.toLowerCase();

    if (text.includes("aiims") || text.includes("aims")) {
      return { lat: 28.5672, lng: 77.2100, name: "AIIMS Delhi" };
    }
    if (text.includes("gtb")) {
      return { lat: 28.6835, lng: 77.3108, name: "GTB Hospital, Delhi" };
    }
    if (text.includes("safdarjung")) {
      return { lat: 28.5694, lng: 77.2078, name: "Safdarjung Hospital" };
    }
    if (text.includes("max")) {
      return { lat: 28.6327, lng: 77.3094, name: "Max Hospital, Delhi" };
    }
    if (text.includes("fortis")) {
      return { lat: 28.6186, lng: 77.3725, name: "Fortis Hospital, Noida" };
    }
    if (text.includes("indra")) {
      return { lat: 28.7450, lng: 77.2850, name: "Indra Nursing Home, Loni" };
    }

    // Default to Sharda Hospital / Saharda Hospital, Greater Noida
    return { lat: 28.47314, lng: 77.48308, name: "Sharda Hospital, Greater Noida" };
  };

  useEffect(() => {
    if (!queue.length) return;
    queue.forEach((q) => {
      const bid = q.booking_id;
      if (!bid || osrmCache[bid]) return;

      const pLat = Number(q.pickup_latitude);
      const pLng = Number(q.pickup_longitude);
      const dest = resolveDestinationCoord(q, hospital);

      if (pLat && pLng && dest?.lat && dest?.lng) {
        fetch(`https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dest.lng},${dest.lat}?overview=false`)
          .then((r) => r.json())
          .then((data) => {
            if (data?.routes?.[0]) {
              const km = Number((data.routes[0].distance / 1000).toFixed(1));
              const mins = Math.max(2, Math.round((data.routes[0].duration / 60) * 1.35));
              setOsrmCache((prev) => ({
                ...prev,
                [bid]: { leg2Km: km, leg2Mins: mins },
              }));
            }
          })
          .catch(() => {});
      }
    });
  }, [queue, hospital]);

  const calculateJourneyETA = (item, hospitalData) => {
    const ambLat = Number(item?.ambulance_live?.latitude);
    const ambLng = Number(item?.ambulance_live?.longitude);
    const pickupLat = Number(item?.pickup_latitude);
    const pickupLng = Number(item?.pickup_longitude);

    const dest = resolveDestinationCoord(item, hospitalData);
    const hospLat = dest.lat;
    const hospLng = dest.lng;

    const hasAmb = Number.isFinite(ambLat) && Number.isFinite(ambLng) && ambLat > 8 && ambLat < 37 && ambLng > 68 && ambLng < 97 && ambLat !== 56;
    const hasPickup = Number.isFinite(pickupLat) && Number.isFinite(pickupLng) && pickupLat > 8 && pickupLat < 37 && pickupLng > 68 && pickupLng < 97;
    const hasHosp = Number.isFinite(hospLat) && Number.isFinite(hospLng) && hospLat > 8 && hospLat < 37 && hospLng > 68 && hospLng < 97;

    const getKm = (lat1, lon1, lat2, lon2, windingFactor = 1.45) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Number((R * c * windingFactor).toFixed(1));
    };

    // Leg 1: Ambulance to Pickup (User)
    let distToPickup = 2.5;
    let timeToPickup = 5;
    if (hasAmb && hasPickup) {
      distToPickup = getKm(ambLat, ambLng, pickupLat, pickupLng, 1.25);
      const ambSpeed = Math.max(25, Math.min(65, Number(item?.ambulance_live?.speed) || 35));
      timeToPickup = Math.max(1, Math.round((distToPickup / ambSpeed) * 60));
    }

    // Leg 2: User Pickup to Hospital
    let distPickupToHosp = 56.3;
    let timePickupToHosp = 117; // 1 hr 57 min default for Greater Noida

    const cached = item?.booking_id ? osrmCache[item.booking_id] : null;
    if (cached?.leg2Km && cached?.leg2Mins) {
      distPickupToHosp = cached.leg2Km;
      timePickupToHosp = cached.leg2Mins;
    } else if (hasPickup && hasHosp) {
      distPickupToHosp = getKm(pickupLat, pickupLng, hospLat, hospLng, 1.62);
      // In Delhi-NCR traffic average speed is ~28.5 km/h
      timePickupToHosp = Math.max(5, Math.round((distPickupToHosp / 28.5) * 60));
    }

    const bookingStatus = String(item?.status || "").toLowerCase();
    const isPatientOnboard = ["picked_up", "in_transit", "transporting", "on_the_way_to_hospital", "reaching_hospital"].includes(bookingStatus);

    let distAmbToHosp = distPickupToHosp;
    let timeAmbToHosp = timePickupToHosp;
    if (isPatientOnboard && hasAmb && hasHosp) {
      distAmbToHosp = getKm(ambLat, ambLng, hospLat, hospLng, 1.62);
      timeAmbToHosp = Math.max(5, Math.round((distAmbToHosp / 28.5) * 60));
    }

    const totalTimeToHospital = isPatientOnboard ? timeAmbToHosp : (timeToPickup + 2 + timePickupToHosp);

    return {
      isPatientOnboard,
      distToPickup,
      timeToPickup,
      distPickupToHosp,
      timePickupToHosp,
      totalTimeToHospital,
      totalDurationText: formatDuration(totalTimeToHospital),
      timeToPickupText: formatDuration(timeToPickup),
      timePickupToHospText: formatDuration(timePickupToHosp),
      destName: dest.name,
      speedKmh: item?.ambulance_live?.speed || 0,
      phaseLabel: isPatientOnboard
        ? "Patient Picked Up • Heading to Hospital"
        : "Ambulance Dispatched • Heading to User",
    };
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
    () =>
      queue.filter(
        (q) =>
          hasCoordPair(q.ambulance_live?.latitude, q.ambulance_live?.longitude) ||
          hasCoordPair(q.pickup_latitude, q.pickup_longitude)
      ),
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
      gsap.set(".hp-home-anim", { y: 0, opacity: 1, clearProps: "all" });
      gsap.set(".hp-home-chip", { y: 0, opacity: 1, clearProps: "all" });
      gsap.set(".hp-home-video", { scale: 1, clearProps: "all" });
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

  const [activeRoute, setActiveRoute] = useState(null);
  const [dynamicRoadRoute, setDynamicRoadRoute] = useState(null);

  useEffect(() => {
    const bid = selectedMapBooking?.booking_id || selectedMapBooking?.id;
    if (!bid) { setActiveRoute(null); return; }
    let cancel = false;
    fetch(`${BASE}/api/route/active/${bid}/`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancel && data?.id) setActiveRoute(data);
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [selectedMapBooking]);

  useEffect(() => {
    if (!selectedMapBooking) {
      setDynamicRoadRoute(null);
      return;
    }

    let cancel = false;

    const fetchLiveRoute = async () => {
      if (activeRoute?.polyline) return;

      const ambLat = Number(selectedMapBooking?.ambulance_live?.latitude);
      const ambLng = Number(selectedMapBooking?.ambulance_live?.longitude);
      const pLat = Number(activeRoute?.pickup_lat || selectedMapBooking?.pickup_latitude);
      const pLng = Number(activeRoute?.pickup_lng || selectedMapBooking?.pickup_longitude);
      const dLat = Number(activeRoute?.dest_lat || hospital?.latitude || selectedMapBooking?.destination_latitude);
      const dLng = Number(activeRoute?.dest_lng || hospital?.longitude || selectedMapBooking?.destination_longitude);

      if (!hasCoordPair(pLat, pLng) || !hasCoordPair(dLat, dLng)) return;

      const startLat = hasCoordPair(ambLat, ambLng) ? ambLat : pLat;
      const startLng = hasCoordPair(ambLat, ambLng) ? ambLng : pLng;

      // 1. Try backend POST /api/route/
      try {
        const res = await fetch(`${BASE}/api/route/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ambulance_lat: startLat,
            ambulance_lng: startLng,
            pickup_lat: pLat,
            pickup_lng: pLng,
            hospital_lat: dLat,
            hospital_lng: dLng,
            dest_lat: dLat,
            dest_lng: dLng,
            travel_mode: 'car',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const normalized =
            data?.geometry?.coordinates?.length >= 2
              ? data
              : data?.best_route?.geometry?.coordinates?.length >= 2
              ? data.best_route
              : null;
          if (!cancel && normalized) {
            setDynamicRoadRoute(normalized);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend route in HospitalPortal failed, trying OSRM fallback:', err);
      }

      // 2. Client-side OSRM fallback (100% free road following)
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson&steps=true`;
        const osrmRes = await fetch(osrmUrl);
        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          const r0 = osrmData?.routes?.[0];
          if (!cancel && r0?.geometry?.coordinates?.length >= 2) {
            setDynamicRoadRoute({
              distance_m: Math.round(r0.distance || 0),
              duration_s: Math.round(r0.duration || 0),
              geometry: r0.geometry,
              traffic_sections: [],
              steps: [],
            });
            return;
          }
        }
      } catch (osrmErr) {
        console.warn('Client OSRM fallback error:', osrmErr);
      }
    };

    fetchLiveRoute();

    return () => {
      cancel = true;
    };
  }, [selectedMapBooking, activeRoute, hospital]);

  const hospitalMapRouteData = useMemo(() => {
    const savedRoute = routeDataFromSavedPolyline(activeRoute?.polyline);
    if (savedRoute) return savedRoute;

    if (dynamicRoadRoute?.geometry?.coordinates?.length >= 2) {
      return dynamicRoadRoute;
    }

    const ambCoord = toLngLat(
      selectedMapBooking?.ambulance_live?.latitude,
      selectedMapBooking?.ambulance_live?.longitude
    );
    const pickupCoord =
      toLngLat(activeRoute?.pickup_lat, activeRoute?.pickup_lng) ||
      toLngLat(selectedMapBooking?.pickup_latitude, selectedMapBooking?.pickup_longitude);
    const destCoord =
      toLngLat(activeRoute?.dest_lat, activeRoute?.dest_lng) ||
      toLngLat(hospital?.latitude, hospital?.longitude);

    return routeDataFromLngLat([ambCoord, pickupCoord, destCoord]);
  }, [activeRoute, dynamicRoadRoute, selectedMapBooking, hospital]);

  const fullRouteEmbedSrc = useMemo(() => {
    const ambLat = Number(selectedMapBooking?.ambulance_live?.latitude);
    const ambLng = Number(selectedMapBooking?.ambulance_live?.longitude);
    const ambCoord = hasCoordPair(ambLat, ambLng) ? `${ambLat},${ambLng}` : "";

    const pickupLat = Number(selectedMapBooking?.pickup_latitude);
    const pickupLng = Number(selectedMapBooking?.pickup_longitude);

    const routePickupCoord = hasCoordPair(activeRoute?.pickup_lat, activeRoute?.pickup_lng)
      ? `${activeRoute.pickup_lat},${activeRoute.pickup_lng}`
      : "";
    const routeDestCoord = hasCoordPair(activeRoute?.dest_lat, activeRoute?.dest_lng)
      ? `${activeRoute.dest_lat},${activeRoute.dest_lng}`
      : "";

    const pickupCoordStr = routePickupCoord || (hasCoordPair(pickupLat, pickupLng) ? `${pickupLat},${pickupLng}` : "");
    const pickupText = activeRoute?.pickup_location || String(selectedMapBooking?.pickup_location || "").trim();

    const hospitalLat = Number(hospital?.latitude);
    const hospitalLng = Number(hospital?.longitude);
    const hospitalCoord = hasCoordPair(hospitalLat, hospitalLng) ? `${hospitalLat},${hospitalLng}` : "";
    const destText =
      routeDestCoord ||
      hospitalCoord ||
      activeRoute?.destination ||
      String(selectedMapBooking?.assigned_hospital_address || "").trim() ||
      String(selectedMapBooking?.assigned_hospital_name || "").trim() ||
      String(hospital?.address || "").trim() ||
      String(hospital?.name || "").trim() ||
      String(selectedMapBooking?.destination || "").trim();

    const startPt = ambCoord || pickupCoordStr || pickupText || "28.73724,77.30666";
    const viaPt = pickupCoordStr || pickupText;
    const endPt = destText || "Hospital";

    let daddrStr = encodeURIComponent(endPt);
    if (viaPt && viaPt !== startPt && viaPt !== endPt) {
      daddrStr = `${encodeURIComponent(viaPt)}+to:${encodeURIComponent(endPt)}`;
    }

    return `https://maps.google.com/maps?output=embed&f=d&saddr=${encodeURIComponent(startPt)}&daddr=${daddrStr}&dirflg=d`;
  }, [selectedMapBooking, hospital, activeRoute]);

  const mapEmbedSrc = fullRouteEmbedSrc;

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
    () => staff.filter((s) => s.role === "doctor" && s.is_active !== false).slice(0, 6),
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
          q.report_sent_to_hospital ||
          q.report_submitted_at ||
          q.vitals_summary ||
          q.driver_modified_report ||
          q.digital_handover?.report_sent_to_hospital ||
          q.digital_handover?.report_submitted_at ||
          q.digital_handover?.vitals_summary ||
          q.digital_handover?.driver_modified_report ||
          q.digital_handover?.driver_voice_transcript
      ),
    [responseCards]
  );

  const caseCards = useMemo(() => {
    const doctors = staff.filter((s) => String(s.role || "").toLowerCase() === "doctor" && s.is_active !== false);
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

  const toggleStaffActive = async (staffMember) => {
    if (!hospital?.id || !staffMember?.id) return;
    try {
      const res = await fetch(`${BASE}/api/hospitals/${hospital.id}/staff/${staffMember.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !staffMember.is_active }),
      });
      if (!res.ok) throw new Error("Unable to update staff status");
      await fetchHospitalDashboard({ silent: true });
    } catch {
      setErr("Unable to update staff status");
    }
  };

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
          --hp-accent: #ffffff;
          --hp-accent-soft: #ffffff;
          min-height: 100vh;
          padding: 64px 0 0 64px;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(255, 255, 255, 0.15), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(255, 255, 255, 0.15), transparent 72%),
            #ffffff;
          color: #111;
          font-family: "Segoe UI", Arial, sans-serif;
          transition: background .35s ease;
        }
        .hp-root.hp-theme-home {
          --hp-accent: #ffffff;
          --hp-accent-soft: #ffffff;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(255, 255, 255, 0.15), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(255, 255, 255, 0.15), transparent 72%),
            linear-gradient(165deg, #ffffff 0%, #ffffff 100%);
        }
        .hp-root.hp-theme-home .hp-card {
          background: linear-gradient(165deg, #ffffff 0%, #ffffff 100%);
          border-color: rgba(156,171,0,0.24);
        }
        .hp-root.hp-theme-home .hp-input,
        .hp-root.hp-theme-home .hp-select,
        .hp-root.hp-theme-home .hp-textarea {
          background: linear-gradient(165deg, #ffffff 0%, #ffffff 100%);
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
          --hp-accent: #ffffff;
          --hp-accent-soft: #ffffff;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(255, 255, 255, 0.15), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(255, 255, 255, 0.15), transparent 72%),
            #ffffff;
        }
        .hp-root.hp-theme-reports {
          --hp-accent: #ffffff;
          --hp-accent-soft: #ffffff;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(255, 255, 255, 0.15), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(255, 255, 255, 0.15), transparent 72%),
            #ffffff;
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
          --hp-accent: #ffffff;
          --hp-accent-soft: rgba(255, 255, 255, 0.15);
          background: 
            radial-gradient(980px 450px at 92% 4%, rgba(255, 255, 255, 0.15), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(255, 255, 255, 0.15), transparent 72%),
            #ffffff;
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
          box-shadow: 0 8px 24px rgba(255, 255, 255, 0.15);
        }
        .hp-root.hp-theme-analytics .hp-card-title {
          color: #111;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .hp-root.hp-theme-analytics .hp-empty { color: rgba(17,17,17,0.5); }
        .hp-root.hp-theme-cases {
          --hp-accent: #ffffff;
          --hp-accent-soft: #ffffff;
          background:
            radial-gradient(980px 450px at 92% 4%, rgba(255, 255, 255, 0.15), transparent 74%),
            radial-gradient(860px 400px at 2% -6%, rgba(255, 255, 255, 0.15), transparent 72%),
            #ffffff;
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
          background: rgba(255, 255, 255, 0.15);
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
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.15), rgba(255,255,255,0.96));
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
          background: linear-gradient(160deg, #ffffff 0%, #f8fbe8 100%);
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
          background: #ffffff;
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
          box-shadow: 0 10px 24px rgba(255, 255, 255, 0.15);
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
            radial-gradient(460px 180px at 92% 6%, rgba(255, 255, 255, 0.15), transparent 72%);
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
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.15) 72%);
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
          border: 1px solid rgba(255, 255, 255, 0.15);
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
            radial-gradient(640px 220px at 95% -20%, rgba(255, 255, 255, 0.15), transparent 72%),
            radial-gradient(520px 200px at -10% 120%, rgba(255, 255, 255, 0.15), transparent 72%),
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
        .hp-eta-box {
          margin: 8px 0;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #bbf7d0;
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
          color: #111;
        }
        .hp-eta-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .hp-eta-total {
          font-size: 13px;
          font-weight: 850;
          color: #166534;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .hp-eta-badge {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .hp-eta-badge.pickup {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .hp-eta-badge.transit {
          background: #dbeafe;
          color: #1e40af;
          border: 1px solid #bfdbfe;
        }
        .hp-eta-timeline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(17,17,17,0.06);
          border-radius: 8px;
          padding: 6px 10px;
          margin: 6px 0;
        }
        .hp-eta-step {
          display: flex;
          flex-direction: column;
        }
        .hp-eta-step .step-label {
          font-size: 10px;
          color: rgba(17,17,17,0.58);
          font-weight: 600;
        }
        .hp-eta-step .step-val {
          font-size: 11px;
          font-weight: 800;
          color: #111;
        }
        .hp-eta-arrow {
          font-size: 12px;
          color: #166534;
          font-weight: 900;
        }
        .hp-eta-footer {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: rgba(17,17,17,0.65);
          margin-top: 4px;
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
        .hp-btn.no { background: rgba(255, 255, 255, 0.15); border-color: rgba(255, 255, 255, 0.15); color: #b31321; }
        .hp-btn.primary {
          background: color-mix(in srgb, var(--hp-accent-soft) 40%, white 60%);
          border-color: color-mix(in srgb, var(--hp-accent) 65%, #333 35%);
        }
        .hp-btn.staff-top {
          background: linear-gradient(135deg, #ffffff 0%, #ffffff 100%);
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
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.15);
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
          background: linear-gradient(135deg, #ffffff 0%, #ffffff 56%, #ffffff 100%);
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
            linear-gradient(120deg, #ffffff 0%, #ffffff 52%, #ffffff 100%);
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
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.15) 0%, rgba(255,173,178,0.22) 100%);
          color: #ad101e;
          border-color: rgba(255, 255, 255, 0.15);
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
          flex: 1 1 auto;
          min-height: calc(100vh - 220px);
          height: calc(100vh - 220px);
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
          background: #f59a23;
          border-color: #f59a23;
          color: #111;
          box-shadow: 0 0 0 2px rgba(245,154,35,0.18);
        }
        .hp-map-list-item.active :is(div, span, b) { color: #111 !important; }
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
          border-color: rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.15);
        }
        .hp-map-menu-item.danger:hover {
          border-color: rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.15);
        }
        .hp-map-panel {
          border: 1px solid rgba(15,156,154,0.28);
          border-radius: 12px;
          background: linear-gradient(165deg, #fbffff 0%, #edf8ff 100%);
          overflow: hidden;
          min-height: 0;
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
          height: 100%;
          flex: 1 1 auto;
          min-height: 0;
          border: 0;
          display: block;
        }
        .hp-remove-mini {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(255, 255, 255, 0.15);
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
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.15);
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
            radial-gradient(360px 140px at 90% -20%, rgba(255, 255, 255, 0.15), transparent 70%),
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
          background: rgba(255, 255, 255, 0.15);
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
          background: rgba(255, 255, 255, 0.15);
          color: #ad101e;
          border-color: rgba(255, 255, 255, 0.15);
        }
        .hp-response-status.pending {
          background: rgba(255, 255, 255, 0.15);
          color: #677600;
          border-color: rgba(156,171,0,0.45);
        }
        .hp-response-note {
          margin-top: 8px;
          border: 1px solid rgba(156,171,0,0.48);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.15);
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
          background: rgba(255, 255, 255, 0.15);
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
          box-shadow: 0 14px 34px rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.15);
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
          background: #ffffff;
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

        /* Compact hospital command dashboard with the same data-first hierarchy as admin. */
        .hp-root.hp-theme-home .hp-home-hero,
        .hp-root.hp-theme-home .hp-hero { display: none; }
        .hp-command-top { margin-bottom: 14px; }
        .hp-command-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 14px; }
        .hp-command-eyebrow { color: #e31b2f; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        .hp-command-head h1 { margin: 5px 0 0; color: #17263a; font-size: clamp(24px, 3vw, 36px); letter-spacing: -.04em; line-height: 1.05; }
        .hp-command-head p { max-width: 650px; margin: 8px 0 0; color: #68758a; font-size: 13px; line-height: 1.5; }
        .hp-command-alert { display: flex; align-items: center; gap: 10px; min-width: 214px; padding: 13px 15px; border: 0; border-radius: 10px; background: #e31b2f; color: #fff; text-align: left; font: inherit; cursor: pointer; }
        .hp-command-alert:hover { background: #bd1426; }
        .hp-command-alert b { display: block; font-size: 12px; }
        .hp-command-alert span { display: block; margin-top: 2px; font-size: 10px; opacity: .88; }
        .hp-command-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .hp-command-stat { padding: 15px; border: 1px solid #e1e7f0; border-radius: 12px; background: #fff; }
        .hp-command-stat .k { color: #728096; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
        .hp-command-stat .v { margin-top: 7px; color: #17263a; font-size: 28px; font-weight: 800; line-height: 1; }
        .hp-command-stat .s { margin-top: 6px; color: #778398; font-size: 10px; }
        .hp-command-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(260px, .85fr) minmax(260px, .85fr); gap: 12px; margin-top: 12px; }
        .hp-command-panel { min-width: 0; border: 1px solid #e1e7f0; border-radius: 12px; background: #fff; overflow: hidden; }
        .hp-command-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 15px; border-bottom: 1px solid #edf0f4; }
        .hp-command-panel-head b { color: #26364a; font-size: 13px; }
        .hp-command-panel-head button { border: 0; padding: 0; background: transparent; color: #e31b2f; font: 700 10px inherit; cursor: pointer; }
        .hp-command-list { padding: 4px 15px 14px; }
        .hp-command-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 11px 0; border-bottom: 1px solid #edf0f4; }
        .hp-command-row:last-child { border-bottom: 0; }
        .hp-command-row b { display: block; overflow: hidden; color: #26364a; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
        .hp-command-row span { display: block; overflow: hidden; margin-top: 3px; color: #778398; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
        .hp-command-tag { border-radius: 999px; padding: 4px 7px; background: #fff0f2; color: #b8172a; font-size: 9px; font-style: normal; font-weight: 800; text-transform: capitalize; }
        .hp-command-meter { display: grid; gap: 12px; padding: 18px 15px; }
        .hp-command-meter-row { display: grid; gap: 6px; }
        .hp-command-meter-row > div { display: flex; justify-content: space-between; color: #4d5a6e; font-size: 11px; }
        .hp-command-meter-track { height: 7px; overflow: hidden; border-radius: 999px; background: #edf0f4; }
        .hp-command-meter-fill { display: block; height: 100%; border-radius: inherit; background: #e31b2f; }
        .hp-command-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; padding: 15px; }
        .hp-command-action { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 61px; padding: 10px; border: 1px solid #f1d4d9; border-radius: 10px; background: #fff7f8; color: #b8172a; text-align: left; font: 700 11px inherit; cursor: pointer; }
        .hp-command-action:hover { border-color: #e31b2f; background: #fff0f2; color: #b8172a; }
        .hp-command-empty { padding: 24px 15px; color: #778398; font-size: 12px; text-align: center; }
        @media (max-width: 1100px) {
          .hp-command-grid { grid-template-columns: 1fr 1fr; }
          .hp-command-grid > :last-child { grid-column: 1 / -1; }
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
          .hp-command-head { flex-direction: column; }
          .hp-command-alert { width: 100%; }
          .hp-command-stats, .hp-command-grid { grid-template-columns: 1fr 1fr; }
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
        @media (max-width: 520px) {
          .hp-command-stats, .hp-command-grid { grid-template-columns: 1fr; }
          .hp-command-grid > :last-child { grid-column: auto; }
        }

        /* One operational palette across every hospital portal tab. */
        html body #root#root#root .hp-root,
        html body #root#root#root .hp-root:is(
          .hp-theme-home, .hp-theme-queue, .hp-theme-responses, .hp-theme-reports,
          .hp-theme-tracking, .hp-theme-resources, .hp-theme-staff, .hp-theme-analytics,
          .hp-theme-cases
        ) {
          --hp-accent: #f59a23 !important;
          --hp-accent-soft: #fff3df !important;
          background: #ffffff !important;
          color: #111111 !important;
        }
        html body #root#root#root .hp-root :is(
          .hp-card, .hp-stat, .hp-case-card, .hp-case-detail-hero, .hp-case-modal,
          .hp-bill-panel, .hp-an-stat, .hp-an-table-w, .hp-response-card,
          .hp-report-card, .hp-resource-shell, .hp-role-card, .hp-staff-personal-card,
          .hp-doc-card, .hp-track-card, .hp-command-panel, .hp-command-stat
        ) {
          background: #ffffff !important;
          border-color: rgba(18, 111, 30, .35) !important;
          box-shadow: none !important;
        }
        html body #root#root#root .hp-root :is(
          .hp-card, .hp-stat, .hp-case-card, .hp-response-card, .hp-report-card,
          .hp-resource-shell, .hp-role-card, .hp-doc-card, .hp-track-card
        ):hover {
          background: #fff3df !important;
          border-color: #f59a23 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root#root .hp-root :is(
          .hp-btn.primary, .hp-btn.ok, .hp-btn-primary, .hp-command-alert,
          .hp-command-action, .hp-command-meter-fill, .hp-track-btn
        ) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        html body #root#root#root .hp-root :is(
          .hp-btn.primary, .hp-btn.ok, .hp-btn-primary, .hp-command-alert,
          .hp-command-action, .hp-track-btn
        ):hover:not(:disabled) {
          background: #126f1e !important;
          border-color: #126f1e !important;
          color: #ffffff !important;
        }
        html body #root#root#root .hp-root .hp-map-list-item.active,
        html body #root#root#root .hp-root .hp-map-list-item.active:hover {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root#root .hp-root .hp-map-list-item.active :is(div, span, b) {
          color: #111111 !important;
        }
        html body #root#root#root .hp-root :is(
          .hp-availability.yes, .hp-response-status.ready, .hp-an-status,
          .hp-live-pill, .hp-live-status
        ) {
          background: #e8f5e9 !important;
          color: #126f1e !important;
          border-color: #126f1e !important;
        }
        html body #root#root#root .hp-root :is(
          .hp-availability.no, .hp-response-status.not_ready, .hp-response-status.pending,
          .hp-cases-count, .hp-warning-pill
        ) {
          background: #fff3df !important;
          color: #111111 !important;
          border-color: #f59a23 !important;
        }
        html body #root#root#root .hp-root :is(.hp-input, .hp-select, .hp-textarea):focus {
          border-color: #126f1e !important;
          box-shadow: 0 0 0 3px rgba(18, 111, 30, .14) !important;
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
          {loading && !hospital && <div className="hp-empty">Loading hospital command center...</div>}
          {!loading && !hospital && <div className="hp-empty">Hospital profile not configured for this email.</div>}

          {hospital && (
            <>
              {activeTab === "home" && (
                <>
                  <section className="hp-command-top">
                    <header className="hp-command-head">
                      <div>
                        <div className="hp-command-eyebrow">Aarogya hospital command</div>
                        <h1>Welcome back, {hospital.name || "Hospital Team"}</h1>
                        <p>Live readiness across emergency intake, bed capacity, staff, and assigned ambulance cases.</p>
                      </div>
                      <button className="hp-command-alert" onClick={() => navigate("/hospital/queue")}>
                        <Stethoscope size={22} />
                        <span><b>Emergency Queue</b>{queue.length} case{queue.length === 1 ? "" : "s"} awaiting review</span>
                      </button>
                    </header>
                    <div className="hp-command-stats" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "8px" }}>
                      <article className="hp-command-stat"><div className="k">Total Beds</div><div className="v">{hospital.total_beds ?? 40}</div><div className="s">Total registered capacity</div></article>
                      <article className="hp-command-stat"><div className="k">Booked Beds</div><div className="v" style={{ color: "#d97706" }}>{hospital.booked_beds ?? Math.max(0, (hospital.total_beds || 40) - (hospital.available_beds || 0))}</div><div className="s">Currently occupied</div></article>
                      <article className="hp-command-stat"><div className="k">Available Beds</div><div className="v" style={{ color: "#166534" }}>{hospital.available_beds ?? 10}</div><div className="s">Ready for intake</div></article>
                      <article className="hp-command-stat"><div className="k">Active Doctors</div><div className="v">{hospital.doctors_active ?? 0}</div><div className="s">Out of {hospital.doctors_count ?? 0} total</div></article>
                      <article className="hp-command-stat"><div className="k">Active Nurses</div><div className="v">{hospital.nurses_active ?? 0}</div><div className="s">Out of {hospital.nurses_count ?? 0} total</div></article>
                      <article className="hp-command-stat"><div className="k">Active / Off Staff</div><div className="v" style={{ fontSize: "18px", marginTop: "4px" }}><span style={{ color: "#166534" }}>🟢 {hospital.staff_active_count ?? 0}</span> / <span style={{ color: "#991b1b" }}>🔴 {hospital.staff_deactive_count ?? 0}</span></div><div className="s">On duty / Off duty</div></article>
                    </div>
                  </section>
                  <section className="hp-command-grid">
                    <article className="hp-command-panel">
                      <div className="hp-command-panel-head"><b>Incoming patient activity</b><button onClick={() => navigate("/hospital/queue")}>View queue</button></div>
                      <div className="hp-command-list">
                        {queue.length ? queue.slice(0, 5).map((item) => {
                          const eta = calculateJourneyETA(item, hospital);
                          return (
                            <div className="hp-command-row" key={item.booking_id} style={{ cursor: "pointer" }} onClick={() => navigate("/hospital/queue")}>
                              <div>
                                <b>Booking #{item.booking_id} · {item.patient_name || "Patient"}</b>
                                <span>{item.pickup_location || item.ambulance_number || "Emergency case"}</span>
                                <div style={{ fontSize: "11px", color: "#166534", fontWeight: 750, marginTop: "2px", display: "flex", gap: "6px", alignItems: "center" }}>
                                  <span>⏱️ Hospital ETA: ~{eta.totalTimeToHospital} mins</span>
                                  <span style={{ color: "rgba(17,17,17,0.5)", fontSize: "10px" }}>• {eta.isPatientOnboard ? "In Transit" : `Pickup: ~${eta.timeToPickup}m`}</span>
                                </div>
                              </div>
                              <em className="hp-command-tag">{String(item.hospital_response || "pending").replaceAll("_", " ")}</em>
                            </div>
                          );
                        }) : <div className="hp-command-empty">No incoming emergency cases right now.</div>}
                      </div>
                    </article>
                    <article className="hp-command-panel">
                      <div className="hp-command-panel-head"><b>Resource readiness</b><button onClick={() => navigate("/hospital/resources")}>Manage</button></div>
                      <div className="hp-command-meter">
                        <div className="hp-command-meter-row"><div><span>Available beds</span><b>{hospital.available_beds ?? 0}</b></div><div className="hp-command-meter-track"><i className="hp-command-meter-fill" style={{ width: `${Math.min(Number(hospital.available_beds || 0) * 5, 100)}%` }} /></div></div>
                        <div className="hp-command-meter-row"><div><span>ICU beds</span><b>{hospital.icu_beds ?? 0}</b></div><div className="hp-command-meter-track"><i className="hp-command-meter-fill" style={{ width: `${Math.min(Number(hospital.icu_beds || 0) * 10, 100)}%` }} /></div></div>
                        <div className="hp-command-meter-row"><div><span>Ventilators</span><b>{hospital.available_ventilators ?? 0}</b></div><div className="hp-command-meter-track"><i className="hp-command-meter-fill" style={{ width: `${Math.min(Number(hospital.available_ventilators || 0) * 10, 100)}%` }} /></div></div>
                      </div>
                    </article>
                    <article className="hp-command-panel">
                      <div className="hp-command-panel-head"><b>Quick actions</b><span /></div>
                      <div className="hp-command-actions">
                        <button className="hp-command-action" onClick={() => navigate("/hospital/responses")}>Review responses <ArrowRight size={16} /></button>
                        <button className="hp-command-action" onClick={() => navigate("/hospital/staff")}>Manage staff <Stethoscope size={16} /></button>
                        <button className="hp-command-action" onClick={() => navigate("/hospital/live-track")}>Live track <MapPinned size={16} /></button>
                        <button className="hp-command-action" onClick={() => navigate("/hospital/reports")}>Case reports <BedSingle size={16} /></button>
                      </div>
                    </article>
                  </section>
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
                      <div className="hp-home-anim" style={{ fontSize: 11, color: "#ffffff", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>Emergency Care Center</div>
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
                          const eta = calculateJourneyETA(q, hospital);
                          return (
                            <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <b>{q.patient_name || "Emergency Patient"}</b>
                          <span className="hp-pill">#{q.booking_id}</span>
                        </div>

                        {/* Real-time Journey & ETA to Hospital Banner */}
                        <div className="hp-eta-box">
                          <div className="hp-eta-header">
                            <span className="hp-eta-total">⏱️ Hospital ETA: {eta.totalDurationText}</span>
                            <span className={`hp-eta-badge ${eta.isPatientOnboard ? "transit" : "pickup"}`}>
                              {eta.isPatientOnboard ? "Patient In Transit" : "En Route to Pickup"}
                            </span>
                          </div>
                          <div className="hp-eta-timeline">
                            <div className="hp-eta-step">
                              <span className="step-label">1. Ambulance ➔ User</span>
                              <span className="step-val">
                                {eta.isPatientOnboard ? "✅ Patient Picked Up" : `${eta.timeToPickupText} (${eta.distToPickup} km)`}
                              </span>
                            </div>
                            <div className="hp-eta-arrow">➔</div>
                            <div className="hp-eta-step">
                              <span className="step-label">2. User ➔ {eta.destName || "Hospital"}</span>
                              <span className="step-val">{eta.timePickupToHospText} ({eta.distPickupToHosp} km)</span>
                            </div>
                          </div>
                          <div className="hp-eta-footer">
                            <span>Live Speed: <strong>{q.ambulance_live?.speed || 0} km/h</strong></span>
                            <span>{eta.phaseLabel}</span>
                          </div>
                        </div>

                        <div className="hp-row">
                          <span className="hp-label">Live Vitals</span>
                          <span>
                            HR {q.live_vitals?.heart_rate || "76 bpm"} • SpO2 {q.live_vitals?.spo2 || "98%"} • BP {q.live_vitals?.bp || "120/80"}
                          </span>
                        </div>
                        <div className="hp-row"><span className="hp-label">Pre-Diagnosis</span><span>{q.pre_diagnosis_note || "-"}</span></div>
                        <div className="hp-row"><span className="hp-label">Handover</span><span>{q.digital_handover?.vitals_summary || "No report yet"}</span></div>
                        <div className="hp-row"><span className="hp-label">Ambulance</span><span>{q.ambulance_number || "Ambulance"} • {q.driver_name || "Assigned Driver"}</span></div>
                        {q.assigned_doctor_names && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12 }}>
                            <span style={{ color: "#166534", fontWeight: 700 }}>👨‍⚕️ Assigned Doctor(s):</span> {q.assigned_doctor_names}
                            {q.assigned_doctor_specializations && <span style={{ color: "#475569" }}> ({q.assigned_doctor_specializations})</span>}
                            {q.assigned_doctor_contacts && <div style={{ color: "#64748b", marginTop: 2 }}>📞 {q.assigned_doctor_contacts}</div>}
                          </div>
                        )}
                        <div className="hp-actions">
                          {(q.report_submitted_at || q.digital_handover?.report_submitted_at || q.patient_condition) && (
                            <button
                              className="hp-btn primary"
                              style={{ background: q.assigned_doctor_names ? "#0f766e" : "#166534", color: "#fff" }}
                              onClick={() => navigate(`/hospital/assign-doctor?booking_id=${q.booking_id}`)}
                            >
                              👨‍⚕️ {q.assigned_doctor_names ? "Manage / Re-assign Staff" : "Assign Staff"}
                            </button>
                          )}
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
                          {q.patient_reached ? (
                            <span
                              className="hp-pill"
                              style={{
                                background: "#dcfce7",
                                color: "#166534",
                                border: "1.5px solid #86efac",
                                fontWeight: 800,
                                padding: "6px 14px",
                                borderRadius: "8px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                              }}
                            >
                              🏥 Patient Reached Hospital
                            </span>
                          ) : (
                            <button
                              className="hp-btn ok"
                              style={{
                                background: "#0284c7",
                                color: "#ffffff",
                                borderColor: "#0369a1",
                                fontWeight: 800,
                                padding: "6px 14px",
                                borderRadius: "8px",
                                cursor: "pointer",
                              }}
                              onClick={() => markPatientReached(q.booking_id)}
                            >
                              🏥 Patient Reached
                            </button>
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

                          {/* Assigned Doctor Display */}
                          {q.assigned_doctor_names && (
                            <div style={{ marginTop: 8, padding: "8px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 11 }}>
                              <span style={{ color: "#166534", fontWeight: 700 }}>👨‍⚕️ Assigned Doctor:</span> {q.assigned_doctor_names}
                              {q.assigned_doctor_specializations && <span style={{ color: "#475569" }}> ({q.assigned_doctor_specializations})</span>}
                            </div>
                          )}

                          {/* Assigned Bed Display */}
                          {q.assigned_bed_number && (
                            <div style={{
                              marginTop: 8,
                              padding: "8px 10px",
                              background: q.assigned_bed_type === "icu" ? "#eff6ff" : "#fefce8",
                              border: `1px solid ${q.assigned_bed_type === "icu" ? "#93c5fd" : "#fde047"}`,
                              borderRadius: 8,
                              fontSize: 11,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}>
                              <div>
                                <span style={{ color: q.assigned_bed_type === "icu" ? "#1d4ed8" : "#854d0e", fontWeight: 700 }}>
                                  🛏️ Assigned Bed:
                                </span> <b>{q.assigned_bed_number}</b> ({q.assigned_bed_type?.toUpperCase() || "GENERAL"})
                              </div>
                              <span style={{
                                fontSize: 9,
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: 999,
                                background: q.assigned_bed_type === "icu" ? "#1d4ed8" : "#ca8a04",
                                color: "#fff"
                              }}>
                                {q.assigned_bed_type === "icu" ? "ICU BED" : "RESERVED"}
                              </span>
                            </div>
                          )}

                          {/* ICU Alert */}
                          {q.icu_required && (
                            <div style={{
                              marginTop: 8,
                              padding: "8px 10px",
                              background: "#fef2f2",
                              border: "1.5px solid #ef4444",
                              borderRadius: 8,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4
                            }}>
                              <div style={{ color: "#b91c1c", fontWeight: 800, fontSize: 11 }}>
                                🚨 Driver: Patient Requires ICU Bed!
                              </div>
                              {q.assigned_bed_type !== "icu" && response === "ready" && (
                                <button
                                  onClick={() => navigate(`/hospital/beds?booking_id=${q.booking_id}&type=icu`)}
                                  style={{
                                    background: "#dc2626",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    alignSelf: "flex-start",
                                  }}
                                >
                                  🚨 Allocate ICU Bed
                                </button>
                              )}
                            </div>
                          )}

                          <div className="hp-actions" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                            {!hasResponded && (
                              <>
                                <button className="hp-btn ok" onClick={() => updateHospitalResponse(q.booking_id, "ready")}>Approve</button>
                                <button className="hp-btn no" onClick={() => updateHospitalResponse(q.booking_id, "not_ready")}>Reject</button>
                              </>
                            )}
                            {response === "ready" && (
                              <>
                                {/* Assign Staff Button */}
                                <button
                                  className="hp-btn ok"
                                  style={{
                                    background: q.assigned_doctor_names ? "#0f766e" : "#166534",
                                    color: "#ffffff",
                                    borderColor: q.assigned_doctor_names ? "#0d9488" : "#15803d",
                                    fontWeight: 800,
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => navigate(`/hospital/assign-doctor?booking_id=${q.booking_id}`)}
                                >
                                  👨‍⚕️ {q.assigned_doctor_names ? "Manage Staff" : "Assign Staff"}
                                </button>

                                {/* Allocate Bed Button — navigates to Bed Management Console to choose specific bed */}
                                {!q.assigned_bed_number ? (
                                  <button
                                    className="hp-btn ok"
                                    style={{
                                      background: "#2563eb",
                                      color: "#ffffff",
                                      borderColor: "#1d4ed8",
                                      fontWeight: 800,
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      fontSize: "11px",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => navigate(`/hospital/beds?booking_id=${q.booking_id}&type=${q.icu_required ? "icu" : "general"}`)}
                                  >
                                    🛏️ Allocate Bed
                                  </button>
                                ) : (
                                  <button
                                    className="hp-btn"
                                    style={{
                                      background: "#f1f5f9",
                                      color: "#334155",
                                      border: "1px solid #cbd5e1",
                                      fontWeight: 700,
                                      padding: "6px 10px",
                                      borderRadius: "8px",
                                      fontSize: "10px",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => navigate(`/hospital/beds?booking_id=${q.booking_id}&type=${q.icu_required ? "icu" : "general"}`)}
                                  >
                                    🔄 Change Bed
                                  </button>
                                )}

                                {q.patient_reached ? (
                                  <span
                                    className="hp-pill"
                                    style={{
                                      background: "#dcfce7",
                                      color: "#166534",
                                      border: "1.5px solid #86efac",
                                      fontWeight: 800,
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "11px",
                                    }}
                                  >
                                    🏥 Reached
                                  </span>
                                ) : (
                                  <button
                                    className="hp-btn ok"
                                    style={{
                                      background: "#0284c7",
                                      color: "#ffffff",
                                      borderColor: "#0369a1",
                                      fontWeight: 800,
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      fontSize: "11px",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => markPatientReached(q.booking_id)}
                                  >
                                    🏥 Patient Reached
                                  </button>
                                )}
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
                          <div className="hp-report-line"><b>Submitted:</b> {(q.report_submitted_at || q.digital_handover?.report_submitted_at) ? new Date(q.report_submitted_at || q.digital_handover.report_submitted_at).toLocaleString("en-IN") : "-"}</div>
                        </div>
                        <div className="hp-report-side">
                          <span className="hp-report-tag">Case {idx + 1}</span>
                          <span className="hp-report-status">{q.report_sent_to_hospital || q.digital_handover?.report_sent_to_hospital ? "Sent to Hospital" : "Shared"}</span>
                          <div className="hp-report-summary">
                            {q.driver_modified_report || q.digital_handover?.driver_modified_report || q.vitals_summary || q.digital_handover?.vitals_summary || q.pre_diagnosis_note || "Detailed report not available yet."}
                          </div>
                          {q.assigned_doctor_names && (
                            <div style={{ marginTop: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 11, textAlign: "left" }}>
                              <b style={{ color: "#166534" }}>👨‍⚕️ Assigned Staff:</b> {q.assigned_doctor_names}
                              {q.assigned_doctor_specializations && <span style={{ color: "#475569" }}> ({q.assigned_doctor_specializations})</span>}
                              {q.assigned_doctor_contacts && <div style={{ color: "#64748b", marginTop: 2 }}>📞 {q.assigned_doctor_contacts}</div>}
                            </div>
                          )}
                          <button
                            className="hp-btn primary"
                            style={{ marginTop: 8, background: q.assigned_doctor_names ? "#0f766e" : "#166534" }}
                            onClick={() => navigate(`/hospital/assign-doctor?booking_id=${q.booking_id}`)}
                          >
                            👨‍⚕️ {q.assigned_doctor_names ? "Manage / Re-assign Staff" : "Assign Staff"}
                          </button>
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
                    {trackingRows.map((r) => {
                      const eta = calculateJourneyETA(r, hospital);
                      return (
                      <article key={`trk-${r.booking_id}`} className="hp-track-card">
                        <div className="hp-track-head">
                          <b>{r.ambulance_number}</b>
                          <span className="hp-pill">Booking #{r.booking_id}</span>
                        </div>

                        {/* Real-time Journey ETA to Hospital */}
                        <div className="hp-eta-box" style={{ margin: "8px 0" }}>
                          <div className="hp-eta-header">
                            <span className="hp-eta-total">⏱️ Hospital ETA: {eta.totalDurationText}</span>
                            <span className={`hp-eta-badge ${eta.isPatientOnboard ? "transit" : "pickup"}`}>
                              {eta.isPatientOnboard ? "Patient In Transit" : "En Route to Pickup"}
                            </span>
                          </div>
                          <div className="hp-eta-timeline">
                            <div className="hp-eta-step">
                              <span className="step-label">1. To User</span>
                              <span className="step-val">{eta.isPatientOnboard ? "✅ Picked Up" : `${eta.timeToPickupText} (${eta.distToPickup} km)`}</span>
                            </div>
                            <div className="hp-eta-arrow">➔</div>
                            <div className="hp-eta-step">
                              <span className="step-label">2. To {eta.destName || "Hospital"}</span>
                              <span className="step-val">{eta.timePickupToHospText} ({eta.distPickupToHosp} km)</span>
                            </div>
                          </div>
                          <div className="hp-eta-footer">
                            <span>Live Speed: <strong>{r.ambulance_live?.speed || 0} km/h</strong></span>
                            <span>{eta.phaseLabel}</span>
                          </div>
                        </div>

                        <div className="hp-row"><span className="hp-label">Driver</span><span>{r.driver_name || "-"}</span></div>
                        <div className="hp-row"><span className="hp-label">Ambulance Location</span><span>{coordText(r.ambulance_live?.latitude, r.ambulance_live?.longitude)}</span></div>
                        <div className="hp-row"><span className="hp-label">Patient Pickup</span><span>{coordText(r.pickup_latitude, r.pickup_longitude)}</span></div>
                        <div className="hp-row"><span className="hp-label">Pickup Address</span><span>{r.pickup_location || "-"}</span></div>
                        <div className="hp-row"><span className="hp-label">Speed</span><span>{r.ambulance_live?.speed || 0} km/h</span></div>
                        <div className="hp-row"><span className="hp-label">Battery</span><span>{r.ambulance_live?.battery_percentage ?? "-"}%</span></div>
                        <div className="hp-actions">
                          <button className="hp-btn primary" onClick={() => goToLiveTrack(r)}>Live Track</button>
                          <button className="hp-btn primary" onClick={() => navigate(`/hospital/reports/${r.booking_id}/view`)}>Manage Report</button>
                        </div>
                      </article>
                    );
                  })}
                  </div>
                </section>
              )}

              {activeTab === "map" && (
                <section className="hp-card" style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 180px)", padding: "12px" }}>
                  <div className="hp-card-head">
                    <div className="hp-card-title" style={{ marginBottom: 0 }}>Live Command Center</div>
                    {hiddenMapBookingIds.length > 0 && (
                      <button className="hp-btn" onClick={() => setHiddenMapBookingIds([])}>Reset Removed</button>
                    )}
                  </div>
                  {visibleTrackingRows.length === 0 && <div className="hp-empty">No live ambulance coordinates available yet.</div>}
                  {visibleTrackingRows.length > 0 && (
                    <div className="hp-map-layout" style={{ flex: "1 1 auto" }}>
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
                              Ambulance: {coordText(r.ambulance_live?.latitude, r.ambulance_live?.longitude)}
                              <br />
                              Pickup: {coordText(r.pickup_latitude, r.pickup_longitude)}
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
                        {selectedMapBooking ? (
                          <div style={{ position: "relative", width: "100%", height: "100%", flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
                            <TomTomLiveMap
                              ambulanceLoc={
                                hasCoordPair(selectedMapBooking?.ambulance_live?.latitude, selectedMapBooking?.ambulance_live?.longitude)
                                  ? {
                                      lat: Number(selectedMapBooking.ambulance_live.latitude),
                                      lng: Number(selectedMapBooking.ambulance_live.longitude),
                                      speed: Number(selectedMapBooking.ambulance_live.speed) || 0,
                                    }
                                  : null
                              }
                              pickupLoc={
                                hasCoordPair(selectedMapBooking?.pickup_latitude, selectedMapBooking?.pickup_longitude)
                                  ? {
                                      lat: Number(selectedMapBooking.pickup_latitude),
                                      lng: Number(selectedMapBooking.pickup_longitude),
                                      label: selectedMapBooking.pickup_location || "Pickup",
                                    }
                                  : null
                              }
                              destinationLoc={
                                hasCoordPair(hospital?.latitude, hospital?.longitude)
                                  ? {
                                      lat: Number(hospital.latitude),
                                      lng: Number(hospital.longitude),
                                      name: hospital?.name || "Hospital",
                                    }
                                  : null
                              }
                              routeData={hospitalMapRouteData}
                              height="100%"
                            />
                          </div>
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

                  <div className="hp-resource-grid" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "8px" }}>
                    <div className="hp-resource-mini">
                      <div className="v">{hospital.total_beds ?? 40}</div>
                      <div className="k">Total Beds</div>
                    </div>
                    <div className="hp-resource-mini" style={{ background: "#fff59d" }}>
                      <div className="v" style={{ color: "#b45309" }}>{hospital.booked_beds ?? Math.max(0, (hospital.total_beds || 40) - (resourceForm.available_beds || 0))}</div>
                      <div className="k" style={{ color: "#78350f" }}>Booked Beds</div>
                    </div>
                    <div className="hp-resource-mini" style={{ background: "#dcfce7" }}>
                      <div className="v" style={{ color: "#15803d" }}>{resourceForm.available_beds}</div>
                      <div className="k" style={{ color: "#166534" }}>Available Beds</div>
                    </div>
                    <div className="hp-resource-mini">
                      <div className="v">{resourceForm.icu_beds}</div>
                      <div className="k">ICU Beds</div>
                    </div>
                    <div className="hp-resource-mini">
                      <div className="v">{hospital.doctors_active ?? 0} / {hospital.doctors_count ?? 0}</div>
                      <div className="k">Active Doctors</div>
                    </div>
                    <div className="hp-resource-mini">
                      <div className="v">{hospital.staff_active_count ?? 0} / {hospital.staff_deactive_count ?? 0}</div>
                      <div className="k">Active / Deactive Staff</div>
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
                    <div style={{ marginTop: 14, padding: "16px", background: "#fcfcfd", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: "#1e293b" }}>Edit Hospital Capacity & Beds</div>
                      <div className="hp-form-grid" style={{ gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#475569" }}>Total Beds</label>
                          <input className="hp-input" type="number" value={resourceForm.total_beds ?? 40} onChange={(e) => setResourceForm((f) => ({ ...f, total_beds: Math.max(0, Number(e.target.value)) }))} placeholder="Total beds" />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#15803d" }}>Available Beds</label>
                          <input className="hp-input" type="number" value={resourceForm.available_beds ?? 0} onChange={(e) => setResourceForm((f) => ({ ...f, available_beds: Math.max(0, Number(e.target.value)) }))} placeholder="Available beds" />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#b45309" }}>Booked Beds (Calculated)</label>
                          <div className="hp-input" style={{ background: "#fff59d", color: "#78350f", fontWeight: 800, display: "flex", alignItems: "center" }}>
                            {Math.max(0, (resourceForm.total_beds ?? 40) - (resourceForm.available_beds ?? 0))}
                          </div>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#475569" }}>ICU Beds</label>
                          <input className="hp-input" type="number" value={resourceForm.icu_beds ?? 0} onChange={(e) => setResourceForm((f) => ({ ...f, icu_beds: Math.max(0, Number(e.target.value)) }))} placeholder="ICU beds" />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#475569" }}>Available Ventilators</label>
                          <input className="hp-input" type="number" value={resourceForm.available_ventilators ?? 0} onChange={(e) => setResourceForm((f) => ({ ...f, available_ventilators: Math.max(0, Number(e.target.value)) }))} placeholder="Available ventilators" />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#475569" }}>Hospital Status</label>
                          <select className="hp-select" value={resourceForm.status || "active"} onChange={(e) => setResourceForm((f) => ({ ...f, status: e.target.value }))}>
                            <option value="active">Active</option>
                            <option value="critical">Critical</option>
                            <option value="full">Full</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#475569" }}>Specializations</label>
                        <textarea className="hp-textarea" value={resourceForm.specializations} onChange={(e) => setResourceForm((f) => ({ ...f, specializations: e.target.value }))} placeholder="Specializations (e.g., Cardiology, Trauma, ICU)" />
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "#475569" }}>Facilities</label>
                        <textarea className="hp-textarea" value={resourceForm.facilities} onChange={(e) => setResourceForm((f) => ({ ...f, facilities: e.target.value }))} placeholder="Facilities (e.g., Blood Bank, 24/7 Pharmacy, Oxygen Plant)" />
                      </div>
                      <div className="hp-actions" style={{ marginTop: 14 }}>
                        <button className="hp-btn ok" onClick={updateResources}>Save Resource Update</button>
                        <button className="hp-btn" onClick={() => setResourceEditMode(false)}>Cancel</button>
                      </div>
                    </div>
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
                    const activeCount = members.filter((m) => m.is_active !== false).length;
                    return (
                      <section className="hp-card hp-staff-role-card" key={section.key}>
                        <div className="hp-role-head">
                          <div className="hp-role-title">{section.title}</div>
                          <span className="hp-role-count">
                            <span style={{ color: "#166534" }}>🟢 {activeCount} Active</span>
                            {members.length - activeCount > 0 && (
                              <span style={{ color: "#991b1b", marginLeft: 6 }}>🔴 {members.length - activeCount} Off</span>
                            )}
                          </span>
                        </div>
                        <div className="hp-role-grid">
                          {members.map((s) => (
                            <div key={s.id} style={!s.is_active ? { opacity: 0.65, filter: "grayscale(0.4)" } : undefined}>
                              <article className="hp-role-card" style={!s.is_active ? { border: "1.5px solid #fca5a5" } : undefined}>
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
                                  <button
                                    className={`hp-btn ${s.is_active ? "no" : "ok"}`}
                                    style={{ marginTop: 8, width: "100%", fontSize: 11, padding: "5px 0" }}
                                    onClick={() => toggleStaffActive(s)}
                                  >
                                    {s.is_active ? "🔴 Mark Off Duty" : "🟢 Mark Active"}
                                  </button>
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
                          <div className="hp-row" style={{ marginTop: 6 }}>
                            <span className="hp-label">Arrival</span>
                            <span>
                              {c.patient_reached ? (
                                <span style={{ color: "#166534", fontWeight: 700, fontSize: "12px" }}>✅ Patient Reached Hospital</span>
                              ) : (
                                <button
                                  className="hp-btn ok"
                                  style={{ background: "#0284c7", color: "#fff", borderColor: "#0369a1", padding: "4px 10px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", cursor: "pointer" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markPatientReached(c.booking_id);
                                  }}
                                >
                                  🏥 Patient Reached
                                </button>
                              )}
                            </span>
                          </div>

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
                        <div className="hp-case-modal-box wide">
                          <div className="k">Patient Arrival Gate</div>
                          <div className="v">
                            {openCase.patient_reached ? (
                              <span style={{ color: "#166534", fontWeight: 800 }}>✅ Patient Reached Hospital (Driver can complete task)</span>
                            ) : (
                              <button
                                className="hp-btn ok"
                                style={{ background: "#0284c7", color: "#ffffff", borderColor: "#0369a1", fontWeight: 800, padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}
                                onClick={() => markPatientReached(openCase.booking_id)}
                              >
                                🏥 Click to Confirm Patient Reached
                              </button>
                            )}
                          </div>
                        </div>
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
                            { l: "Rejected", v: queue.filter(q => q.hospital_response === "not_ready").length, c: "#ffffff", max: queue.length || 1 },
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
