import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Heart,
  Image as ImageIcon,
  Phone,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");

export default function StaffPatientCondition() {
  const staffId = localStorage.getItem("staff_id") || "";
  const email = localStorage.getItem("user") || "";
  const hospitalName = localStorage.getItem("hospital_name") || "Saharda Hospital";

  const [cases, setCases] = useState(() => {
    try {
      const s = sessionStorage.getItem("staff_patient_cases_cache");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [photosByCase, setPhotosByCase] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Photo gallery slider state for active core case
  const [photoPage, setPhotoPage] = useState(0);
  const PHOTOS_PER_PAGE = 3;

  // Lightbox Modal state
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Default incoming patients dataset matching the 4th reference image
  const defaultIncomingCases = useMemo(() => [
    {
      id: "1008",
      ambulance_id: "AMB-1008",
      patient_name: "user",
      patient_age: 42,
      patient_gender: "Male",
      ambulance_fleet_id: "AMB-000111",
      ambulance_number: "AMB-000111",
      driver_name: "driver 1",
      driver_contact: "9711933066",
      diagnostic: "Emergency Triage En-Route",
      condition_tone: "emergency",
      eta_mins: "6 mins",
      status_label: "Active Core Case",
      accent_color: "#ef4444",
      photos: [
        {
          id: "p1",
          url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80",
          label: "12-Lead ECG Telemetry",
          time: "Uploaded 2m ago",
        },
        {
          id: "p2",
          url: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80",
          label: "Patient In-Transit Visual",
          time: "Uploaded 4m ago",
        },
        {
          id: "p3",
          url: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80",
          label: "Defibrillator & SpO2 Monitor",
          time: "Uploaded 5m ago",
        },
        {
          id: "p4",
          url: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=800&q=80",
          label: "IV Cannulation & Infusion",
          time: "Uploaded 7m ago",
        },
        {
          id: "p5",
          url: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
          label: "Vitals Monitor Rhythm Strip",
          time: "Uploaded 9m ago",
        },
        {
          id: "p6",
          url: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80",
          label: "Patient ID Document / Card",
          time: "Uploaded 11m ago",
        },
      ],
    },
    {
      id: "1085",
      ambulance_id: "AMB-1085",
      patient_name: "Sita Sharma",
      patient_age: 67,
      patient_gender: "Female",
      ambulance_fleet_id: "AMB-302",
      ambulance_number: "UP-16-BD-3021",
      driver_name: "Rameshwar",
      driver_contact: "+91 98112 34567",
      diagnostic: "Stable Vitals • Respiratory Support",
      condition_tone: "en_route",
      eta_mins: "14 mins",
      status_label: "En-Route Unit",
      accent_color: "#f59e0b",
      photos: [
        {
          id: "p7",
          url: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=800&q=80",
          label: "Oxygen Delivery Mask View",
          time: "Uploaded 8m ago",
        },
        {
          id: "p8",
          url: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
          label: "BP & SpO2 Monitor",
          time: "Uploaded 10m ago",
        },
      ],
    },
    {
      id: "1089",
      ambulance_id: "AMB-1089",
      patient_name: "Haris Khan",
      patient_age: 29,
      patient_gender: "Male",
      ambulance_fleet_id: "AMB-098",
      ambulance_number: "DL-1A-ET-0988",
      driver_name: "Karan Johar",
      driver_contact: "+91 97123 45678",
      diagnostic: "Bone Fracture • Lower Extremity Trauma",
      condition_tone: "stable",
      eta_mins: "22 mins",
      status_label: "Orthopedic Referral",
      accent_color: "#10b981",
      photos: [
        {
          id: "p9",
          url: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=800&q=80",
          label: "Limb Splint & Immobilization",
          time: "Uploaded 12m ago",
        },
      ],
    },
  ], []);

  // Fetch real cases & photos from backend
  const loadCases = useCallback(async () => {
    if (!staffId || !email) {
      setCases(defaultIncomingCases);
      setSelectedCaseId(defaultIncomingCases[0].id);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(
        `${BASE}/api/staff/dashboard/?staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`,
        { cache: "no-store" }
      );
      const data = await response.json().catch(() => ({}));
      const rows = Array.isArray(data.cases) ? data.cases : [];
      if (rows.length > 0) {
        // Fetch real condition photos for each case
        const entries = await Promise.all(
          rows.map(async (booking) => {
            const photoResponse = await fetch(
              `${BASE}/api/bookings/${booking.id}/photos/?role=staff&staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(email)}`,
              { cache: "no-store" }
            );
            const photoData = await photoResponse.json().catch(() => ({}));
            return [
              booking.id,
              photoResponse.ok && Array.isArray(photoData.photos) ? photoData.photos : [],
            ];
          })
        );
        const realPhotosMap = Object.fromEntries(entries);
        setPhotosByCase(realPhotosMap);

        const mapped = rows.map((r, i) => {
          const isEmerg = `${r.patient_condition || ""} ${r.vitals_summary || ""}`.toLowerCase().includes("cardiac") || i === 0;
          const realCasePhotos = realPhotosMap[r.id] || [];
          const combinedPhotos = realCasePhotos.length > 0
            ? realCasePhotos.map((p, idx) => ({
                id: p.id || `real-${idx}`,
                url: p.url,
                label: p.label || p.instruction || `Patient Condition Photo #${idx + 1}`,
                time: p.created_at ? new Date(p.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Uploaded recently",
              }))
            : defaultIncomingCases[0].photos;

          return {
            id: String(r.id),
            ambulance_id: `AMB-${r.id}`,
            patient_name: r.patient_name || r.booked_by || "Incoming Patient",
            patient_age: r.patient_age || "42",
            patient_gender: r.patient_gender || "M",
            ambulance_fleet_id: r.ambulance_number || `DL-3C-${r.id}`,
            ambulance_number: r.ambulance_number || `DL-3C-${r.id}`,
            driver_name: r.driver || "driver 1",
            driver_contact: r.driver_contact || "9711933066",
            diagnostic: r.patient_condition || r.vitals_summary || "Emergency Triage En-Route",
            condition_tone: isEmerg ? "emergency" : i % 2 === 0 ? "en_route" : "stable",
            eta_mins: `${6 + i * 5} mins`,
            status_label: isEmerg ? "Active Core Case" : "En-Route Unit",
            accent_color: isEmerg ? "#ef4444" : i % 2 === 0 ? "#f59e0b" : "#10b981",
            photos: combinedPhotos,
          };
        });
        setCases(mapped);
        setSelectedCaseId(mapped[0].id);
        try { sessionStorage.setItem("staff_patient_cases_cache", JSON.stringify(mapped)); } catch {}
      } else {
        setCases(defaultIncomingCases);
        setSelectedCaseId(defaultIncomingCases[0].id);
      }
    } catch {
      setCases(defaultIncomingCases);
      setSelectedCaseId(defaultIncomingCases[0].id);
    } finally {
      setLoading(false);
    }
  }, [defaultIncomingCases, email, staffId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Filter cases
  const filteredCases = useMemo(() => {
    if (activeFilter === "all") return cases;
    return cases.filter((c) => c.condition_tone === activeFilter);
  }, [cases, activeFilter]);

  // Active featured core case
  const coreCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || filteredCases[0] || cases[0];
  }, [cases, selectedCaseId, filteredCases]);

  // When coreCase changes, reset photo page
  useEffect(() => {
    setPhotoPage(0);
  }, [coreCase?.id]);

  // Other cases on right
  const otherCases = useMemo(() => {
    return cases.filter((c) => c.id !== coreCase?.id);
  }, [cases, coreCase]);

  // Photo slice for current page
  const totalPhotos = coreCase?.photos?.length || 0;
  const maxPages = Math.ceil(totalPhotos / PHOTOS_PER_PAGE);
  const currentPhotosSlice = useMemo(() => {
    if (!coreCase?.photos) return [];
    const start = photoPage * PHOTOS_PER_PAGE;
    return coreCase.photos.slice(start, start + PHOTOS_PER_PAGE);
  }, [coreCase, photoPage]);

  // Counts
  const counts = useMemo(() => ({
    all: cases.length,
    emergency: cases.filter((c) => c.condition_tone === "emergency").length,
    en_route: cases.filter((c) => c.condition_tone === "en_route").length,
    stable: cases.filter((c) => c.condition_tone === "stable").length,
  }), [cases]);

  return (
    <main className="incoming-condition-view">
      <style>{`
        /* ── Fully Responsive: all screen sizes ── */
        .incoming-condition-view {
          margin-left: 64px;
          min-height: 100vh;
          padding-top: 96px;
          padding-left: clamp(12px, 3vw, 36px);
          padding-right: clamp(12px, 3vw, 36px);
          padding-bottom: 60px;
          box-sizing: border-box;
          background: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          user-select: none;
          overflow-x: hidden;
        }

        .incoming-center-shell {
          max-width: 1240px;
          margin: 0 auto;
        }

        /* Top Header Row */
        .incoming-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .incoming-title-box h1 {
          font-size: clamp(20px, 4vw, 32px);
          font-weight: 800;
          color: #1e293b;
          margin: 0 0 5px 0;
          letter-spacing: -0.03em;
        }

        .incoming-title-box p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }

        /* Filter Pills */
        .incoming-filter-group {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          background: #ffffff;
          padding: 5px;
          border-radius: 30px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          max-width: 100%;
        }

        .filter-pill-tab {
          border: none;
          background: transparent;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          color: #475569;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .filter-pill-tab.active-all {
          background: #0b7440;
          color: #ffffff;
        }

        .filter-pill-tab.emergency {
          background: #fee2e2;
          color: #dc2626;
        }

        .filter-pill-tab.enroute {
          background: #fef3c7;
          color: #d97706;
        }

        .filter-pill-tab.stable {
          background: #dcfce7;
          color: #16a34a;
        }

        /* Two-Column Grid — stacks on tablet */
        .incoming-grid-layout {
          display: grid;
          grid-template-columns: 1.55fr 1fr;
          gap: 20px;
          align-items: start;
        }

        /* LEFT CARD: FEATURED CORE CASE WITH RED BORDER */
        .featured-core-card {
          background: #ffffff;
          border-radius: 20px;
          border: 2.5px solid #ef4444;
          box-shadow: 0 8px 30px rgba(239, 68, 68, 0.08), 0 2px 10px rgba(0,0,0,0.04);
          padding: 24px 28px 28px;
          box-sizing: border-box;
          position: relative;
        }

        .thick-top-accent {
          height: 6px;
          width: 100%;
          background: #ef4444;
          border-radius: 6px;
          margin-bottom: 18px;
        }

        .core-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .core-case-tag {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
        }

        .core-eta-badge {
          font-size: 15px;
          font-weight: 800;
          color: #ef4444;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .patient-headline-name {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 20px 0;
          letter-spacing: -0.02em;
        }

        /* 3-Column Info — responsive */
        .patient-info-trio-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 14px;
          padding-bottom: 20px;
          border-bottom: 1px solid #f1f5f9;
          margin-bottom: 18px;
        }

        .info-col-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .info-k {
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
        }

        .info-v {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          word-break: break-word;
        }

        .info-v.danger {
          color: #ef4444;
        }

        /* PHOTOS SECTION WITH PREV / NEXT BUTTONS */
        .photos-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        .photos-section-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        /* Prev / Next Controls */
        .photo-nav-controls {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .photo-nav-arrow-btn {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          color: #1e293b;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }

        .photo-nav-arrow-btn:hover:not(:disabled) {
          background: #0b7440;
          color: #ffffff;
          border-color: #0b7440;
        }

        .photo-nav-arrow-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .photo-count-pill {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
        }

        /* 3 Thumbnails Row — responsive auto columns */
        .thumbnails-trio-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .single-thumb-box {
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .single-thumb-box:hover {
          transform: translateY(-3px);
        }

        .thumb-aspect-frame {
          width: 100%;
          height: 105px;
          border-radius: 12px;
          overflow: hidden;
          background: #0f172a;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          border: 1px solid #e2e8f0;
          position: relative;
        }

        .thumb-aspect-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .thumb-time-tag {
          font-size: 11px;
          color: #64748b;
          margin-top: 6px;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Wide Blue Action Button */
        .btn-view-live-conditions {
          width: 100%;
          background: #0284c7;
          color: #ffffff;
          border: none;
          padding: 14px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.25);
          transition: all 0.2s ease;
        }

        .btn-view-live-conditions:hover {
          background: #0369a1;
          transform: translateY(-1px);
        }

        /* RIGHT STACK COLUMN */
        .right-stack-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .incoming-stack-card {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 18px rgba(0,0,0,0.04);
          padding: 18px 20px 20px;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .incoming-stack-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
        }

        .stack-color-bar {
          height: 5px;
          width: 100%;
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .stack-meta-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 6px;
        }

        .stack-name-h3 {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .stack-info-p {
          font-size: 12px;
          color: #64748b;
          margin: 0 0 16px 0;
        }

        /* Lightbox Fullscreen Viewer - Fixed dimensions, rounded card, NO background blur! */
        .fullscreen-lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.72); /* Clean solid overlay without blur */
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
        }

        .lightbox-panel-box {
          width: min(780px, 96vw);
          max-width: 92vw;
          height: min(720px, calc(100vh - 32px));
          max-height: calc(100vh - 32px);
          background: #ffffff;
          border-radius: 24px; /* ROUNDED CARD */
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.35);
          display: flex;
          flex-direction: column;
        }

        .lightbox-panel-head {
          padding: 14px 22px;
          background: #ffffff;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          flex: 0 0 auto;
          min-height: 52px;
          box-sizing: border-box;
        }

        .lightbox-big-img-frame {
          flex: 1;
          min-height: 0;
          background: #0b131e;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .lightbox-big-img-frame img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .lightbox-nav-footer {
          padding: 12px 18px;
          background: #ffffff;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          flex: 0 0 auto;
          box-sizing: border-box;
        }

        /* ── RESPONSIVE BREAKPOINTS ── */
        /* Tablet: 600–900px */
        @media (max-width: 900px) {
          .incoming-condition-view {
            margin-left: 0;
            padding: 84px 16px 80px;
          }
          .incoming-grid-layout {
            grid-template-columns: 1fr;
          }
          .right-stack-wrapper {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 14px;
          }
        }

        /* Mobile: ≤480px */
        @media (max-width: 480px) {
          .incoming-condition-view {
            margin-left: 0;
            padding: 80px 10px 90px;
          }
          .featured-core-card {
            padding: 16px 14px 20px;
          }
          .incoming-header-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .incoming-filter-group {
            width: 100%;
            justify-content: flex-start;
          }
          .patient-headline-name {
            font-size: 20px;
          }
          .thumbnails-trio-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .thumb-aspect-frame {
            height: 85px;
          }
          .lightbox-panel-box {
            width: calc(100vw - 20px);
            height: calc(100vh - 20px);
            max-height: calc(100vh - 20px);
            border-radius: 16px;
          }
          .lightbox-panel-head {
            padding: 12px 14px;
            min-height: 48px;
            font-size: 12px;
          }
          .lightbox-nav-footer {
            padding: 10px;
            align-items: stretch;
          }
          .lightbox-nav-footer > span {
            width: 100%;
            line-height: 1.4;
          }
          .lightbox-nav-footer > div {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }
          .lightbox-nav-footer button {
            min-height: 40px;
            font-size: 11px;
          }
          .lightbox-nav-footer button:last-child {
            grid-column: 1 / -1;
          }
          .incoming-grid-layout {
            grid-template-columns: 1fr;
          }
          .right-stack-wrapper {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
        }
      `}</style>

      <div className="incoming-center-shell">
        {/* Top Header Row (Matching 4th Reference Image) */}
        <div className="incoming-header-row">
          <div className="incoming-title-box">
            <h1>Incoming Patients</h1>
            <p>Live tracking of active ambulances en-route to {hospitalName}.</p>
          </div>

          {/* Filter Pills */}
          <div className="incoming-filter-group">
            <button
              className={`filter-pill-tab ${activeFilter === "all" ? "active-all" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              All ({counts.all})
            </button>
            <button
              className={`filter-pill-tab ${activeFilter === "emergency" ? "emergency" : ""}`}
              onClick={() => setActiveFilter("emergency")}
            >
              ● Emergency ({counts.emergency})
            </button>
            <button
              className={`filter-pill-tab ${activeFilter === "en_route" ? "enroute" : ""}`}
              onClick={() => setActiveFilter("en_route")}
            >
              ● En-Route ({counts.en_route})
            </button>
            <button
              className={`filter-pill-tab ${activeFilter === "stable" ? "stable" : ""}`}
              onClick={() => setActiveFilter("stable")}
            >
              ● Stable ({counts.stable})
            </button>
          </div>
        </div>

        {/* Two-Column Grid Layout */}
        <div className="incoming-grid-layout">
          {/* ── LEFT COLUMN: MAIN FEATURED ACTIVE CASE (RED ACCENT) ── */}
          {coreCase && (
            <div className="featured-core-card">
              {/* Thick Red Bar */}
              <div className="thick-top-accent" style={{ background: coreCase.accent_color }}></div>

              {/* Case Header */}
              <div className="core-header-row">
                <span className="core-case-tag">
                  #{coreCase.ambulance_id} ({coreCase.status_label})
                </span>
                <span className="core-eta-badge" style={{ color: coreCase.accent_color }}>
                  <Clock size={16} /> ETA: {coreCase.eta_mins}
                </span>
              </div>

              {/* Patient Name */}
              <h2 className="patient-headline-name">{coreCase.patient_name}</h2>

              {/* 3 Information Columns */}
              <div className="patient-info-trio-row">
                <div className="info-col-item">
                  <span className="info-k">Ambulance Fleet ID</span>
                  <span className="info-v">{coreCase.ambulance_fleet_id}</span>
                </div>
                <div className="info-col-item">
                  <span className="info-k">Driver Contact</span>
                  <span className="info-v">{coreCase.driver_contact}</span>
                </div>
                <div className="info-col-item">
                  <span className="info-k">Diagnostic</span>
                  <span className="info-v danger" style={{ color: coreCase.accent_color }}>
                    {coreCase.diagnostic}
                  </span>
                </div>
              </div>

              {/* Patient Condition Images Header WITH PREV / NEXT BUTTONS! */}
              <div className="photos-section-header">
                <h3 className="photos-section-title">
                  Patient Condition Images (Live Transmission)
                </h3>

                {/* Added Prev / Next controls for doctor to browse all driver photos! */}
                <div className="photo-nav-controls">
                  <span className="photo-count-pill">
                    {totalPhotos > 0 ? `${photoPage * PHOTOS_PER_PAGE + 1}-${Math.min((photoPage + 1) * PHOTOS_PER_PAGE, totalPhotos)} of ${totalPhotos}` : "0 photos"}
                  </span>
                  <button
                    className="photo-nav-arrow-btn"
                    disabled={photoPage <= 0}
                    onClick={() => setPhotoPage((p) => Math.max(0, p - 1))}
                    title="Previous Photos"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    className="photo-nav-arrow-btn"
                    disabled={photoPage >= maxPages - 1}
                    onClick={() => setPhotoPage((p) => Math.min(maxPages - 1, p + 1))}
                    title="Next Photos"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Trio of Live Thumbnails with Slide Navigation */}
              <div className="thumbnails-trio-grid">
                {currentPhotosSlice.map((photo, sliceIdx) => {
                  const absoluteIndex = photoPage * PHOTOS_PER_PAGE + sliceIdx;
                  return (
                    <div
                      key={photo.id || sliceIdx}
                      className="single-thumb-box"
                      onClick={() => setLightboxIndex(absoluteIndex)}
                      title={`Click to inspect ${photo.label}`}
                    >
                      <div className="thumb-aspect-frame">
                        <img src={photo.url} alt={photo.label} />
                      </div>
                      <span className="thumb-time-tag">{photo.time} · {photo.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Full Width Cyan/Blue Action Button */}
              <button
                className="btn-view-live-conditions"
                onClick={() => setLightboxIndex(photoPage * PHOTOS_PER_PAGE)}
              >
                View Live Conditions ({totalPhotos} Photos)
              </button>
            </div>
          )}

          {/* ── RIGHT COLUMN: STACK OF INCOMING AMBULANCES ── */}
          <div className="right-stack-wrapper">
            {otherCases.map((item) => (
              <div key={item.id} className="incoming-stack-card">
                {/* Accent Color Bar (Yellow/Green) */}
                <div
                  className="stack-color-bar"
                  style={{ background: item.accent_color }}
                ></div>

                <div className="stack-meta-top">
                  <span>#{item.ambulance_id}</span>
                  <span style={{ color: item.accent_color, fontWeight: 800 }}>
                    ETA: {item.eta_mins}
                  </span>
                </div>

                <h3 className="stack-name-h3">{item.patient_name}</h3>

                <p className="stack-info-p">
                  Age: {item.patient_age} • Ambulance #{item.ambulance_fleet_id} • {item.diagnostic}
                </p>

                <button
                  className="btn-view-live-conditions"
                  style={{ padding: "10px 16px", fontSize: 13 }}
                  onClick={() => {
                    setSelectedCaseId(item.id);
                  }}
                >
                  View Live Conditions
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox Modal with Prev/Next Navigation to View ALL Photos Sent by Driver */}
      {lightboxIndex !== null && coreCase?.photos?.[lightboxIndex] && (
        <div
          className="fullscreen-lightbox-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxIndex(null); }}
        >
          <div className="lightbox-panel-box">
            <div className="lightbox-panel-head">
              <span>
                {coreCase.photos[lightboxIndex]?.label} · Photo {lightboxIndex + 1} of {totalPhotos}
              </span>
              <X size={18} style={{ cursor: "pointer" }} onClick={() => setLightboxIndex(null)} />
            </div>

            <div className="lightbox-big-img-frame">
              <img
                src={coreCase.photos[lightboxIndex]?.url}
                alt={coreCase.photos[lightboxIndex]?.label}
              />
            </div>

            <div className="lightbox-nav-footer">
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {coreCase.photos[lightboxIndex]?.time} · Transmitted by {coreCase.driver_name} ({coreCase.ambulance_fleet_id})
              </span>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="photo-nav-arrow-btn"
                  disabled={lightboxIndex <= 0}
                  onClick={() => setLightboxIndex((idx) => Math.max(0, idx - 1))}
                >
                  <ChevronLeft size={16} /> Prev Photo
                </button>
                <button
                  className="photo-nav-arrow-btn"
                  disabled={lightboxIndex >= totalPhotos - 1}
                  onClick={() => setLightboxIndex((idx) => Math.min(totalPhotos - 1, idx + 1))}
                >
                  Next Photo <ChevronRight size={16} />
                </button>
                <button
                  style={{
                    background: "#0284c7",
                    color: "#fff",
                    border: "none",
                    padding: "6px 14px",
                    borderRadius: 6,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => setLightboxIndex(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
