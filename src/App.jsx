import { useEffect } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Homepage              from "./Pages/Homepage";
import Reports               from "./Pages/Reports";
import Analytics             from "./Pages/Analytics";
import Requests              from "./Pages/Request";
import Leftsidebar           from "./Components/Leftsidebar";
import Topnavbar             from "./Components/Topnavbar";
import Ambulances            from "./Pages/Ambulances";
import Hospitals             from "./Pages/Hospitals";
import Login                 from "./Pages/Login";
import SignInHelp            from "./Pages/SignInHelp";
import Signup                from "./Pages/Signup";
import BookingDetails        from "./Pages/BookingDetails";
import CaseDetails           from "./Pages/CaseDetails";
import DriverView            from "./Pages/DriverView";
import DriverDashboard       from "./Pages/DriverDashboard";
import DriverHome            from "./Pages/DriverHome";
import DriverGuidance        from "./Pages/DriverGuidance";
import DriverChangeRequests  from "./Pages/DriverChangeRequests";
import LiveMap               from "./Pages/LiveMap";
import MapView               from "./Pages/Mapview";
import UserLiveTracking      from "./Components/UserLiveTracking";
import DriverBatteryTracker  from "./Components/DriverBatteryTracker";
import MyBookings            from "./Pages/MyBookings";
import LiveTracking          from "./Pages/LiveTracking"; 
import HospitalResponses     from "./Pages/HospitalResponses";
import AdminChatControl      from "./Pages/AdminChatControl";
import UserChatbot           from "./Pages/UserChatbot";
import DriverRequestChat     from "./Pages/DriverRequestChat";
import HospitalPortal        from "./Pages/HospitalPortal";
import AdminHospitalDetails  from "./Pages/AdminHospitalDetails";
import InfoPage              from "./Pages/InfoPage";
import CallIntakeConsole     from "./Pages/CallIntakeConsole";
import DriverVoiceReports    from "./Pages/DriverVoiceReports";
import LiveVideoConsultation from "./Pages/LiveVideoConsultation";
import HospitalCaseReportView from "./Pages/HospitalCaseReportView";
import DriverInsuranceForm   from "./Pages/DriverInsuranceForm";
import HospitalInsuranceView from "./Pages/HospitalInsuranceView";
import HospitalDoctorAssignment from "./Pages/HospitalDoctorAssignment";
import HospitalBeds             from "./Pages/HospitalBeds";
import HospitalTeamAllocation  from "./Pages/HospitalTeamAllocation";
import UserCareTeam             from "./Pages/UserCareTeam";
import CaseManagement            from "./Pages/CaseManagement";
import HospitalStaffPortal       from "./Pages/HospitalStaffPortal";
import StaffPatientCondition     from "./Pages/StaffPatientCondition";

const AdminRoute = ({ element }) => {
  const role = localStorage.getItem("role");
  return role === "admin" ? element : <Navigate to="/Ambulances" replace />;
};

const ProtectedRoute = ({ element }) => {
  const user = localStorage.getItem("user");
  return user ? element : <Navigate to="/Login" replace />;
};

const HospitalRoute = ({ element }) => {
  const user = localStorage.getItem("user");
  const role = localStorage.getItem("role");
  return user && role === "hospital" ? element : <Navigate to="/" replace />;
};

const StaffRoute = ({ element }) => {
  const user = localStorage.getItem("user");
  const role = localStorage.getItem("role");
  return user && role === "staff" ? element : <Navigate to="/Login" replace />;
};

const ConfirmedTrackingRoute = ({ element }) => {
  const raw = localStorage.getItem("active_confirmed_booking");
  if (!raw) return <Navigate to="/MyBookings" replace />;
  try {
    const booking = JSON.parse(raw);
    if (booking?.status === "confirmed") return element;
  } catch {
    return <Navigate to="/MyBookings" replace />;
  }
  return <Navigate to="/MyBookings" replace />;
};

const DriverAwareRoute = ({ driverElement, defaultElement }) => {
  const role = localStorage.getItem("role");
  const user = localStorage.getItem("user");
  if (role === "driver" && user) return driverElement;
  if (role === "hospital" && user) return <Navigate to="/hospital/home" replace />;
  if (role === "staff" && user) return <Navigate to="/staff/home" replace />;
  return defaultElement;
};

const App = () => {
  const location = useLocation();
  const { pathname } = location;
  const p = pathname.toLowerCase();
  const role = localStorage.getItem("role");
  const email = (localStorage.getItem("user") || "").trim().toLowerCase();

  useEffect(() => {
    if (email === "vashupanchal.cs@gmail.com" && localStorage.getItem("role") !== "admin") {
      localStorage.setItem("role", "admin");
    }
  }, [email]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const animatedSelector = [
      ".ad-cell", ".ad-contact-card", ".ad-contact-col",
      ".amb2-card", ".amb2-stat", ".amb2-ins",
      ".h2-card", ".h2-stat", ".h2-mini",
      ".rep-sum-card", ".rep-chart-card", ".rep-table-card",
      ".req-card", ".req-table-wrap",
      ".dd-card", ".dd-booking-card", ".dd-amb-card", ".dn-card",
      ".dl-card", ".mb-card", ".profile-card", ".setting-card"
    ].join(",");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return undefined;

    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray(animatedSelector);
      targets.forEach((card) => {
        gsap.set(card, { y: 0, opacity: 1, clearProps: "all" });
      });
    });

    return () => ctx.revert();
  }, [pathname]);
  
  const isAuth = p === "/login" || p === "/signup" || p === "/login/help";
  const isMapView = p === "/directions";

  // Background polling for confirmed booking (user only)
  const isUser = role !== "admin" && role !== "driver" && role !== "hospital" && role !== "staff" && !!localStorage.getItem("user");
  const isDriver = role === "driver" && !!localStorage.getItem("user");
  const driverAmbulanceId = Number(localStorage.getItem("ambulance_id") || "0");

  return (
    <>
      {!isAuth && !isMapView && <Leftsidebar />}
      {!isAuth && !isMapView && <Topnavbar />}

      {/* Silent background poller — no UI */}
      {!isAuth && !isMapView && isUser && <UserLiveTracking />}
      {!isAuth && !isMapView && isDriver && <DriverBatteryTracker ambulanceId={driverAmbulanceId} />}

      <Routes>
        {/* Public */}
        <Route path="/Login" element={<Login />} />
        <Route path="/login/help" element={<SignInHelp />} />
        <Route path="/signup" element={<Signup />} />

        {/* Homepage */}
        <Route path="/" element={
          <DriverAwareRoute
            driverElement={<DriverHome />}
            defaultElement={<Homepage />}
          />
        }
        />

        {/* Driver */}
        <Route path="/driver-dashboard" element={<ProtectedRoute element={<DriverDashboard />} />} />
        <Route path="/driver/:id" element={<ProtectedRoute element={<DriverView />} />} />
        <Route path="/DriverView" element={<ProtectedRoute element={<DriverView />} />} />
        <Route path="/DriverChatbot" element={<Navigate to="/DriverRequestChat" replace />} />
        <Route path="/DriverRequestChat" element={<ProtectedRoute element={<DriverRequestChat />} />} />
        <Route path="/driver/voice-reports" element={<ProtectedRoute element={<DriverVoiceReports />} />} />
        <Route path="/driver/live-video" element={<ProtectedRoute element={<LiveVideoConsultation />} />} />
        <Route path="/driver/insurance-form" element={<ProtectedRoute element={<DriverInsuranceForm />} />} />
        <Route path="/driver/guidance" element={<ProtectedRoute element={<DriverGuidance />} />} />

        {/* Hospital */}
        <Route path="/hospital/home" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/queue" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/responses" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/reports" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/reports/:bookingId/view" element={<HospitalRoute element={<HospitalCaseReportView />} />} />
        <Route path="/hospital/reports/:bookingId/insurance" element={<HospitalRoute element={<HospitalInsuranceView />} />} />
        <Route path="/hospital/live-track" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/tracking" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/resources" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/staff" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/cases" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/cases/:bookingId" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/analytics" element={<HospitalRoute element={<HospitalPortal />} />} />
        <Route path="/hospital/manage-cases" element={<HospitalRoute element={<CaseManagement scope="hospital" />} />} />
        <Route path="/hospital/assign-doctor" element={<HospitalRoute element={<HospitalTeamAllocation />} />} />
        <Route path="/hospital/team-allocation" element={<HospitalRoute element={<HospitalTeamAllocation />} />} />
        <Route path="/hospital/team-allocation/edit" element={<HospitalRoute element={<HospitalTeamAllocation />} />} />
        <Route path="/hospital/beds" element={<HospitalRoute element={<HospitalBeds />} />} />

        {/* Hospital staff */}
        <Route path="/staff/home" element={<StaffRoute element={<HospitalStaffPortal />} />} />
        <Route path="/staff/dashboard" element={<StaffRoute element={<HospitalStaffPortal />} />} />
        <Route path="/staff/cases" element={<StaffRoute element={<HospitalStaffPortal />} />} />
        <Route path="/staff/patient-condition" element={<StaffRoute element={<StaffPatientCondition />} />} />
        <Route path="/staff/live-video" element={<StaffRoute element={<LiveVideoConsultation />} />} />
        <Route path="/staff/profile" element={<StaffRoute element={<HospitalStaffPortal />} />} />

        {/* Shared */}
        <Route path="/Ambulances" element={<ProtectedRoute element={<Ambulances />} />} />
        <Route path="/Hospitals" element={<ProtectedRoute element={<Hospitals />} />} />
        <Route path="/MyBookings" element={<ProtectedRoute element={<MyBookings />} />} />
        <Route path="/MyCareTeam" element={<ProtectedRoute element={<UserCareTeam />} />} />
        <Route path="/cases/:bookingId" element={<ProtectedRoute element={<CaseDetails />} />} />
        <Route path="/UserChatbot" element={<ProtectedRoute element={<UserChatbot />} />} />
        <Route path="/info/:section" element={<ProtectedRoute element={<InfoPage />} />} />
        <Route
          path="/LiveTracking"
          element={<ProtectedRoute element={<ConfirmedTrackingRoute element={<LiveTracking />} />} />}
        />
        <Route path="/directions" element={<ProtectedRoute element={<MapView />} />} />

        {/* Admin only */}
        <Route path="/Reports" element={<AdminRoute element={<Reports />} />} />
        <Route path="/Analytics" element={<AdminRoute element={<Analytics />} />} />
        <Route path="/Requests" element={<AdminRoute element={<Requests />} />} />
        <Route path="/bookings" element={<AdminRoute element={<BookingDetails />} />} />
        <Route path="/LiveMap" element={<AdminRoute element={<LiveMap />} />} />
        <Route path="/DriverChangeRequests" element={<AdminRoute element={<DriverChangeRequests />} />} />
        <Route path="/HospitalResponses" element={<AdminRoute element={<HospitalResponses />} />} />
        <Route path="/AdminChatControl" element={<AdminRoute element={<AdminChatControl />} />} />
        <Route path="/HospitalPartnerDetails" element={<AdminRoute element={<AdminHospitalDetails />} />} />
        <Route path="/CallIntakeConsole" element={<AdminRoute element={<CallIntakeConsole />} />} />
        <Route path="/ManageCases" element={<AdminRoute element={<CaseManagement scope="admin" />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Rendered after page styles so every route shares the same application surface. */}
      <style>{`
        html body #root .team-allocation button { background: #ffffff !important; color: #173645 !important; border-color: #c9d9d5 !important; }
        html body #root .team-allocation button:hover { background: #e5f7ef !important; color: #087f72 !important; border-color: #087f72 !important; }
        html body #root .team-allocation-page .staff-role { background: #d9f3e8 !important; color: #145044 !important; }
        html body #root .team-allocation-page .team-btn.primary { background: #145044 !important; color: #ffffff !important; }
        html body #root .team-allocation-page .staff-check { accent-color: #145044 !important; }
        html body #root .team-allocation-page button.team-btn.primary:hover { background: #145044 !important; color: #ffffff !important; }
        html body #root .team-allocation-page .staff-card:hover { background: #fffdf0 !important; border-color: #f2b233 !important; }
        html body #root .team-allocation-page .staff-card.selected { background: #e5f7ed !important; border-color: #145044 !important; }
        #root,
        body { background: #101211 !important; color: #f6f5f0 !important; }

        :is(.page-root, [class*="-root"]) {
          background: #101211 !important;
          background-image: none !important;
          color: #f6f5f0 !important;
          border-color: #303532 !important;
        }

        :is([class*="-card"], [class$="card"], [class*="-panel"], [class*="-modal"], [class*="-box"], .card) {
          background: #181b1a !important;
          background-image: none !important;
          color: #f6f5f0 !important;
          border-color: #303532 !important;
          box-shadow: none !important;
        }

        :is(.page-root, [class*="-root"]) :is(p, span, div, label, li, td, th, small) {
          color: #f6f5f0 !important;
        }

        :is(.page-root, [class*="-root"]) :is(h1, h2, h3, h4, h5, h6, [class*="-title"], [class*="-heading"], [class*="-label"]) {
          color: #f6f5f0 !important;
        }

        :is(.page-root, [class*="-root"]) :is([class*="-sub"], [class*="-desc"], [class*="-meta"], [class*="-hint"], [class*="-muted"]) {
          color: #b7bcb7 !important;
        }

        #root a,
        #root .link {
          color: #f6f5f0 !important;
        }

        #root button {
          background: transparent !important;
          color: #f6f5f0 !important;
          border-color: #4a504c !important;
          box-shadow: none !important;
        }

        #root :is(
          button[type="submit"], .primary, .pri, .main, .auth-btn,
          .auth-mode.on, .auth-role.on, .nf-search-btn, .nf-role-badge,
          .lsb-item.active, .lsb-bottom-item.active, .lsb-bottom-toggle,
          .chat-btn, .chat-chip.on, .cd-status, .ad-contact-badge
        ) {
          background: #f6f5f0 !important;
          color: #101211 !important;
          border-color: #f6f5f0 !important;
        }

        #root :is(
          button[type="submit"], .primary, .pri, .main, .auth-btn,
          .auth-mode.on, .auth-role.on, .nf-search-btn, .nf-role-badge,
          .lsb-item.active, .lsb-bottom-item.active, .lsb-bottom-toggle,
          .chat-btn, .chat-chip.on, .cd-status, .ad-contact-badge
        ) :is(span, svg, path) {
          color: #101211 !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }

        #root button:not(:disabled):hover {
          background: #f6f5f0 !important;
          border-color: #f6f5f0 !important;
          color: #101211 !important;
        }

        #root button:disabled {
          background: #202422 !important;
          color: #858b86 !important;
          border-color: #303532 !important;
        }

        #root :is(input, select, textarea) {
          background: #181b1a !important;
          color: #f6f5f0 !important;
          border-color: #3a403d !important;
        }

        #root :is(input, select, textarea):focus {
          border-color: #f6f5f0 !important;
          box-shadow: 0 0 0 3px rgba(246, 245, 240, .14) !important;
        }

        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) {
          background: #101211 !important;
          border-color: #303532 !important;
          color: #f6f5f0 !important;
        }

        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) :is(span, div, a, svg, path, button) {
          color: #f6f5f0 !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }

        #root .nf-search-inner,
        #root .nf-drop,
        #root .nf-profile-drop,
        #root .nf-search-drop,
        #root .nf-mobile-search-drop,
        #root .nf-mobile-search-overlay,
        #root .lsb-tooltip,
        #root .chat-head,
        #root .chat-ctrl,
        #root .chat-voice-row {
          background: #181b1a !important;
          background-image: none !important;
          border-color: #303532 !important;
          color: #f6f5f0 !important;
        }

        #root .nf-brand,
        #root .nf-logout-link,
        #root .nf-login-link,
        #root .nf-profile-role { color: #f6f5f0 !important; }

        #root .lsb-item:not(.active) {
          background: transparent !important;
          border-color: transparent !important;
          color: #b7bcb7 !important;
        }

        #root .lsb-item:not(.active):hover {
          background: #202422 !important;
          color: #f6f5f0 !important;
          border-color: #303532 !important;
        }

        #root :is(.nf-badge, .lsb-dot, .lsb-dot-red) {
          background: #f6f5f0 !important;
          border-color: #f6f5f0 !important;
          color: #101211 !important;
        }

        #root .auth-root {
          background: #101211 !important;
          color: #f6f5f0 !important;
        }

        #root :is(.auth-brandbar, .auth-shell, .auth-right) {
          background: #101211 !important;
          border-color: #303532 !important;
          color: #f6f5f0 !important;
          box-shadow: none !important;
        }

        #root :is(.auth-brand, .auth-step-title, .auth-step-title .hl, .auth-field label, .auth-pass-toggle, .auth-link, .auth-back, .auth-help-toggle, .auth-help-toggle span, .auth-help-learn) {
          color: #f6f5f0 !important;
        }

        #root :is(.auth-step-sub, .auth-note, .auth-meta, .auth-legal, .auth-resend, .auth-help-body) {
          color: #b7bcb7 !important;
        }

        #root :is(.auth-msg.err, .auth-msg.ok) {
          background: #202422 !important;
          border-color: #3a403d !important;
          color: #f6f5f0 !important;
        }

        /* Some operational screens use inline styles; scope their legacy light panels into the shared night palette. */
        #root .night-page {
          background: #101211 !important;
          color: #f6f5f0 !important;
        }

        #root .night-page *[style*="background"] {
          background: #181b1a !important;
          background-image: none !important;
        }

        #root .night-page *[style*="color"] {
          color: #f6f5f0 !important;
        }

        #root .night-page *[style*="border"] {
          border-color: #303532 !important;
        }

        #root :is(.recharts-wrapper) { background: transparent !important; }

        #root :is(.recharts-text, .recharts-label, .recharts-legend-item-text) {
          fill: #b7bcb7 !important;
          color: #b7bcb7 !important;
        }
      `}</style>
      <style>{`
        /* Final editorial workspace: open white content, not a wall of cards. */
        #root,
        body { background: #ffffff !important; color: #101211 !important; }

        #root :is(.page-root, [class*="-root"]) {
          background: #ffffff !important;
          color: #101211 !important;
          border-color: #e3e3e3 !important;
        }

        #root :is([class*="-card"], [class$="card"], [class*="-panel"], [class*="-box"], .card) {
          background: transparent !important;
          background-image: none !important;
          color: #101211 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        #root :is([class*="-modal"], [role="dialog"]) {
          background: #ffffff !important;
          color: #101211 !important;
          border: 1px solid #e3e3e3 !important;
          border-radius: 0 !important;
          box-shadow: 0 18px 50px rgba(16,18,17,.12) !important;
        }

        #root :is(.page-root, [class*="-root"]) :is(p, span, div, label, li, td, th, small, strong) {
          color: #101211 !important;
        }

        #root :is(.page-root, [class*="-root"]) :is(h1, h2, h3, h4, h5, h6, [class*="-title"], [class*="-heading"], [class*="-label"]) {
          color: #101211 !important;
        }

        #root :is(.page-root, [class*="-root"]) :is([class*="-sub"], [class*="-desc"], [class*="-meta"], [class*="-hint"], [class*="-muted"]) {
          color: #6b6b6b !important;
        }

        #root a,
        #root .link { color: #101211 !important; }

        #root button {
          background: transparent !important;
          color: #101211 !important;
          border-color: #8b8b8b !important;
          border-radius: 3px !important;
          box-shadow: none !important;
        }

        #root :is(button[type="submit"], .primary, .pri, .main, .nf-search-btn, .chat-btn, .chat-chip.on) {
          background: #101211 !important;
          color: #ffffff !important;
          border-color: #101211 !important;
        }

        #root :is(button[type="submit"], .primary, .pri, .main, .nf-search-btn, .chat-btn, .chat-chip.on) :is(span, svg, path) {
          color: #ffffff !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }

        #root button:not(:disabled):hover {
          background: #101211 !important;
          border-color: #101211 !important;
          color: #ffffff !important;
        }

        #root button:disabled {
          background: #f0f0f0 !important;
          color: #909090 !important;
          border-color: #e3e3e3 !important;
        }

        #root :is(input, select, textarea) {
          background: #ffffff !important;
          color: #101211 !important;
          border: 1px solid #a7a7a7 !important;
          border-radius: 2px !important;
        }

        #root :is(input, select, textarea)::placeholder { color: #777777 !important; }
        #root :is(input, select, textarea):focus {
          border-color: #101211 !important;
          box-shadow: 0 0 0 2px rgba(16,18,17,.12) !important;
        }

        /* The compact dark control bar shown across authenticated screens. */
        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) {
          background: #101211 !important;
          border-color: #2a2d2c !important;
          color: #f6f6f6 !important;
        }

        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) :is(span, div, a, svg, path, button) {
          color: #f6f6f6 !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }

        #root .nf-brand { color: #ffffff !important; letter-spacing: .12em; }
        #root .nf-search-inner,
        #root .nf-mobile-search-overlay {
          background: #1a1d1c !important;
          border-color: #343837 !important;
          border-radius: 10px !important;
        }
        #root .nf-search-input,
        #root .nf-search-input::placeholder { color: #f6f6f6 !important; }
        #root .nf-search-btn {
          background: #f6f6f6 !important;
          color: #101211 !important;
          border-color: #f6f6f6 !important;
          border-radius: 9px !important;
        }
        #root .nf-search-btn:hover { background: #dedede !important; color: #101211 !important; }
        #root :is(.nf-drop, .nf-profile-drop, .nf-search-drop, .nf-mobile-search-drop) {
          background: #ffffff !important;
          border-color: #e3e3e3 !important;
          color: #101211 !important;
          box-shadow: 0 14px 34px rgba(16,18,17,.14) !important;
        }
        #root :is(.nf-drop, .nf-profile-drop, .nf-search-drop, .nf-mobile-search-drop) :is(span, div, button) {
          color: #101211 !important;
        }
        #root .lsb-item:not(.active) { background: transparent !important; border-color: transparent !important; color: #d1d1d1 !important; }
        #root .lsb-item:not(.active):hover { background: #252827 !important; color: #ffffff !important; border-color: transparent !important; }
        #root :is(.lsb-item.active, .lsb-bottom-item.active, .lsb-bottom-toggle) {
          background: #f6f6f6 !important;
          color: #101211 !important;
          border-color: #f6f6f6 !important;
        }

        /* Inline-style pages use the same simple white canvas. */
        #root .night-page {
          background: #ffffff !important;
          color: #101211 !important;
        }
        #root .night-page *[style*="background"] {
          background: #ffffff !important;
          background-image: none !important;
        }
        #root .night-page *[style*="color"] { color: #101211 !important; }
        #root .night-page *[style*="border"] { border-color: #e3e3e3 !important; }

        #root :is(.recharts-text, .recharts-label, .recharts-legend-item-text) {
          fill: #4f4f4f !important;
          color: #4f4f4f !important;
        }

        /* Login is intentionally separate: dark backdrop, a broad light card, and a single red action. */
        #root .auth-root {
          min-height: 100vh;
          padding: 116px 24px 42px;
          background-color: #090a0a !important;
          background-image:
            linear-gradient(rgba(0,0,0,.66), rgba(0,0,0,.82)),
            url("/images/yicare-login-background.jpg") !important;
          background-position: center;
          background-size: cover;
          color: #101211 !important;
        }
        #root .auth-brandbar {
          height: 82px;
          background: rgba(9,10,10,.82) !important;
          border-color: rgba(255,255,255,.16) !important;
          padding: 0 clamp(24px, 11vw, 216px);
        }
        #root .auth-brand,
        #root .auth-brand-mark { color: #e50914 !important; border-color: #e50914 !important; }
        #root .auth-shell { width: min(780px, 100%); max-width: 780px; }
        #root .auth-right {
          width: 100%;
          padding: 30px 50px 26px;
          background: #f4f4f4 !important;
          border: 0 !important;
          border-radius: 0 !important;
          color: #101211 !important;
          box-shadow: 0 20px 48px rgba(0,0,0,.32) !important;
        }
        #root .auth-right :is(h1, h2, h3, p, span, div, label, b, small) { color: #101211 !important; }
        #root :is(.auth-step-title, .auth-step-title .hl) { font-size: clamp(28px, 3vw, 40px); color: #101211 !important; }
        #root .auth-step-sub { color: #343434 !important; }
        #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt) {
          background: transparent !important;
          color: #101211 !important;
          border: 1px solid #7d7d7d !important;
          border-radius: 2px !important;
        }
        #root :is(.auth-mode.on, .auth-role.on) { background: #101211 !important; border-color: #101211 !important; color: #ffffff !important; }
        #root .auth-btn {
          min-height: 48px;
          background: #e50914 !important;
          color: #ffffff !important;
          border-color: #e50914 !important;
          border-radius: 3px !important;
        }
        #root .auth-btn:hover { background: #b20710 !important; border-color: #b20710 !important; color: #ffffff !important; }
        #root .auth-field label,
        #root .auth-pass-toggle,
        #root :is(.auth-link, .auth-back, .auth-help-toggle, .auth-help-toggle span, .auth-help-learn) { color: #101211 !important; }
        #root .auth-field input,
        #root .auth-otp input { background: #ffffff !important; color: #101211 !important; border-color: #8d8d8d !important; }
        #root :is(.auth-note, .auth-meta, .auth-legal, .auth-resend, .auth-help-body) { color: #555555 !important; }
        #root :is(.auth-msg.err, .auth-msg.ok) { background: #ffffff !important; color: #101211 !important; border-color: #bcbcbc !important; }

        @media (max-width: 760px) {
          #root .auth-root { padding: 88px 14px 26px; }
          #root .auth-brandbar { height: 66px; padding: 0 18px; }
          #root .auth-right { padding: 24px 20px 22px; }
        }
      `}</style>
      <style>{`
        /* Reference palette correction: light editorial content, charcoal controls, and a Netflix-style login. */
        #root,
        body {
          background: #ffffff !important;
          color: #111111 !important;
        }

        #root :is(.page-root, [class*="-root"]),
        #root .night-page {
          background: #ffffff !important;
          color: #111111 !important;
          border-color: #e3e3e3 !important;
        }

        #root :is(.page-root, [class*="-root"], .night-page) :is(p, span, div, label, li, td, th, small, strong, h1, h2, h3, h4, h5, h6, [class*="-title"], [class*="-heading"], [class*="-label"]) {
          color: #111111 !important;
        }

        #root :is(.page-root, [class*="-root"], .night-page) :is([class*="-sub"], [class*="-desc"], [class*="-meta"], [class*="-hint"], [class*="-muted"]) {
          color: #626262 !important;
        }

        #root :is(a, .link) { color: #111111 !important; }
        #root button {
          color: #111111 !important;
          border-color: #8a8a8a !important;
        }
        #root :is(button[type="submit"], .primary, .pri, .main, .chat-btn, .chat-chip.on) {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
        }
        #root :is(button[type="submit"], .primary, .pri, .main, .chat-btn, .chat-chip.on) :is(span, svg, path) {
          color: #ffffff !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        #root button:not(:disabled):hover {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
        }
        #root :is(input, select, textarea) {
          color: #111111 !important;
          border-color: #9b9b9b !important;
        }
        #root :is(input, select, textarea):focus {
          border-color: #111111 !important;
          box-shadow: 0 0 0 2px rgba(17, 17, 17, .12) !important;
        }

        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) {
          background: #171717 !important;
          border-color: #303030 !important;
          color: #ffffff !important;
        }
        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) :is(span, div, a, svg, path, button) {
          color: #ffffff !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        #root .nf-search-inner,
        #root .nf-mobile-search-overlay {
          background: #242424 !important;
          border-color: #3d3d3d !important;
        }
        #root .nf-search-btn,
        #root .nf-search-btn:hover {
          background: #f5f5f5 !important;
          border-color: #f5f5f5 !important;
          color: #111111 !important;
        }
        #root .nf-search-btn :is(span, svg, path) {
          color: #111111 !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        #root :is(.nf-drop, .nf-profile-drop, .nf-search-drop, .nf-mobile-search-drop) :is(span, div, button) {
          color: #111111 !important;
        }
        #root .lsb-item:not(.active):hover { background: #303030 !important; }
        #root :is(.lsb-item.active, .lsb-bottom-item.active, .lsb-bottom-toggle) {
          background: #f5f5f5 !important;
          border-color: #f5f5f5 !important;
          color: #111111 !important;
        }

        #root .night-page *[style*="background"] {
          background: #ffffff !important;
          background-image: none !important;
        }
        #root .night-page *[style*="color"] { color: #111111 !important; }
        #root .night-page *[style*="border"] { border-color: #e3e3e3 !important; }

        #root .auth-root {
          background-color: #080808 !important;
          color: #111111 !important;
        }
        #root .auth-brandbar { background: rgba(8, 8, 8, .86) !important; }
        #root :is(.auth-brand, .auth-brand-mark) {
          color: #e50914 !important;
          border-color: #e50914 !important;
        }
        #root .auth-right {
          background: #f4f4f4 !important;
          color: #111111 !important;
        }
        #root .auth-right :is(h1, h2, h3, p, span, div, label, b, small),
        #root :is(.auth-step-title, .auth-step-title .hl, .auth-field label, .auth-pass-toggle, .auth-link, .auth-back, .auth-help-toggle, .auth-help-toggle span, .auth-help-learn) {
          color: #111111 !important;
        }
        #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt) {
          color: #111111 !important;
          border-color: #777777 !important;
        }
        #root :is(.auth-mode.on, .auth-role.on) {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
        }
        #root :is(.auth-mode.on, .auth-role.on) :is(span, svg, path) {
          color: #ffffff !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        #root .auth-btn,
        #root .auth-btn:hover {
          background: #e50914 !important;
          border-color: #e50914 !important;
          color: #ffffff !important;
        }
        #root .auth-btn:hover { background: #b20710 !important; border-color: #b20710 !important; }
        #root .auth-field input,
        #root .auth-otp input { color: #111111 !important; }
      `}</style>
      <style>{`
        /* White card system: clear separation without heavy boxed layouts. */
        #root,
        body {
          background: #f5f6f6 !important;
          color: #171717 !important;
        }

        #root :is(.page-root, [class*="-root"]):not(.auth-root),
        #root .night-page {
          background: #f5f6f6 !important;
          color: #171717 !important;
        }

        #root :is([class$="-card"], [class*="-card "], [class$="-panel"], [class*="-panel "], .card) {
          background: #ffffff !important;
          background-image: none !important;
          color: #171717 !important;
          border: 1px solid #e1e3e3 !important;
          border-radius: 10px !important;
          box-shadow: 0 7px 18px rgba(23, 23, 23, .10) !important;
        }

        #root :is([class$="-card"], [class*="-card "], [class$="-panel"], [class*="-panel "], .card):hover {
          box-shadow: 0 11px 24px rgba(23, 23, 23, .14) !important;
        }

        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) {
          background: #ffffff !important;
          border-color: #e1e3e3 !important;
          color: #171717 !important;
        }
        #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) :is(span, div, a, svg, path, button) {
          color: #171717 !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        #root .nf-brand { color: #171717 !important; }
        #root .nf-search-inner,
        #root .nf-mobile-search-overlay {
          background: #ffffff !important;
          border-color: #d8dada !important;
        }
        #root .nf-search-btn,
        #root .nf-search-btn:hover {
          background: #171717 !important;
          border-color: #171717 !important;
          color: #ffffff !important;
        }
        #root .nf-search-btn :is(span, svg, path) {
          color: #ffffff !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        #root :is(.nf-drop, .nf-profile-drop, .nf-search-drop, .nf-mobile-search-drop) {
          background: #ffffff !important;
          border-color: #e1e3e3 !important;
          box-shadow: 0 10px 24px rgba(23, 23, 23, .12) !important;
        }
        #root .lsb-item:not(.active):hover,
        #root :is(.lsb-item.active, .lsb-bottom-item.active, .lsb-bottom-toggle) {
          background: #f0f1f1 !important;
          border-color: #e1e3e3 !important;
          color: #171717 !important;
        }

        /* Compact, light sign-in form that retains YiCare's role and OTP data flow. */
        #root .auth-root {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 104px 20px 32px;
          background: #f5f8f8 !important;
          background-image: none !important;
          color: #171717 !important;
        }
        #root .auth-brandbar {
          position: absolute !important;
          top: 32px;
          left: 0;
          right: 0;
          height: auto;
          display: flex;
          justify-content: center;
          padding: 0;
          background: transparent !important;
          border: 0 !important;
        }
        #root .auth-brand,
        #root .auth-brand-mark {
          color: #171717 !important;
          border-color: #171717 !important;
        }
        #root .auth-brand,
        #root .auth-brand:hover { background: transparent !important; }
        #root .auth-brand { font-size: 26px; letter-spacing: -.055em; }
        #root .auth-brand-mark { width: 22px; height: 22px; font-size: 14px; border-width: 1px; }
        #root .auth-shell {
          width: min(820px, calc(100vw - 40px));
          max-width: 820px;
          margin: 0 auto;
        }
        #root .auth-right {
          width: 100%;
          padding: 24px 32px 20px;
          gap: 8px;
          background: #ffffff !important;
          color: #171717 !important;
          border: 1px solid #dfe2e2 !important;
          border-radius: 9px !important;
          box-shadow: 0 10px 25px rgba(23, 23, 23, .12) !important;
        }
        #root .auth-right :is(h1, h2, h3, p, span, div, label, b, small),
        #root :is(.auth-step-title, .auth-step-title .hl, .auth-field label, .auth-pass-toggle, .auth-link, .auth-back, .auth-help-toggle, .auth-help-toggle span, .auth-help-learn) {
          color: #171717 !important;
        }
        #root .auth-step-title { font-size: 23px !important; line-height: 1.1; }
        #root .auth-step-sub { margin-bottom: 3px; color: #5d6262 !important; font-size: 13px; }
        #root .auth-modes { margin-bottom: 2px; gap: 6px; }
        #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt) {
          min-height: 36px;
          color: #171717 !important;
          background: #ffffff !important;
          border-color: #d6d9d9 !important;
          border-radius: 5px !important;
          font-size: 12px;
        }
        #root :is(.auth-mode.on, .auth-role.on) {
          background: #171717 !important;
          border-color: #171717 !important;
          color: #ffffff !important;
        }
        #root :is(.auth-mode.on, .auth-role.on) :is(span, svg, path) {
          color: #ffffff !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }
        #root .auth-form { gap: 8px; }
        #root .auth-login-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-areas:
            "email password"
            "role role"
            "action action";
          column-gap: 12px;
          row-gap: 8px;
        }
        #root .auth-login-form .auth-email-field { grid-area: email; }
        #root .auth-login-form .auth-password-field { grid-area: password; }
        #root .auth-login-form .auth-role-field { grid-area: role; }
        #root .auth-login-form .auth-note,
        #root .auth-login-form .auth-btn { grid-area: action; }
        #root .auth-login-form .auth-note { display: none; }
        #root .auth-field { gap: 3px; }
        #root .auth-field label { font-size: 11px; font-weight: 700; }
        #root .auth-field input {
          height: 40px;
          color: #171717 !important;
          background: #ffffff !important;
          border-color: #cfd3d3 !important;
          border-radius: 5px !important;
          font-size: 13px;
        }
        #root .auth-field input:focus {
          border-color: #171717 !important;
          box-shadow: 0 0 0 2px rgba(23, 23, 23, .10) !important;
        }
        #root .auth-roles { gap: 6px; }
        #root .auth-btn,
        #root .auth-btn:hover {
          min-height: 40px;
          background: #e4574f !important;
          border-color: #e4574f !important;
          color: #ffffff !important;
          border-radius: 5px !important;
          font-size: 13px;
        }
        #root .auth-btn:hover { background: #c9443d !important; border-color: #c9443d !important; }
        #root .auth-google {
          min-height: 38px;
          background: #ffffff !important;
          border-color: #d6d9d9 !important;
          color: #171717 !important;
        }
        #root .auth-google:hover { background: #f5f6f6 !important; color: #171717 !important; }
        #root :is(.auth-note, .auth-legal, .auth-meta, .auth-resend, .auth-help-body) {
          color: #686d6d !important;
          font-size: 11px;
        }
        #root .auth-meta { margin-top: 2px; }
        #root .auth-legal { margin-top: 3px; }
        #root .auth-help { display: none; }

        @media (max-width: 640px) {
          #root .auth-root { padding: 84px 14px 24px; }
          #root .auth-brandbar { top: 24px; }
          #root .auth-shell { width: min(100%, 520px); }
          #root .auth-right { padding: 21px 18px 18px; }
          #root .auth-login-form {
            grid-template-columns: 1fr;
            grid-template-areas:
              "email"
              "password"
              "role"
              "action";
          }
        }
      `}</style>
      <style>{`
        /* Production readability with a restrained emergency-red navigation. */
        #root :is(.page-root, [class*="-root"]):not(.auth-root) :is(h1, h2, h3) {
          color: #202124 !important;
          font-family: "Outfit", "Segoe UI", sans-serif !important;
          font-weight: 600 !important;
          letter-spacing: -.02em !important;
        }
        #root :is(.page-root, [class*="-root"]):not(.auth-root) h1 { font-size: clamp(28px, 3vw, 42px) !important; }
        #root :is(.page-root, [class*="-root"]):not(.auth-root) h2 { font-size: clamp(21px, 2vw, 30px) !important; }
        #root :is(.page-root, [class*="-root"]):not(.auth-root) h3 { font-size: clamp(16px, 1.4vw, 21px) !important; }
        #root :is(.page-root, [class*="-root"]):not(.auth-root) :is([class*="-title"], [class*="-heading"]) {
          font-weight: 600 !important;
          letter-spacing: -.015em !important;
        }

        /* Horizontal header: controls remain transparent; red is the only hover cue. */
        #root .nf-nav-root {
          min-height: 68px;
          background: #0b0b0b !important;
          border-bottom-color: #252525 !important;
          color: #f5f5f5 !important;
          flex-wrap: nowrap !important;
        }
        #root .nf-nav-root :is(span, a, button) { color: #f5f5f5 !important; }
        #root .nf-brand,
        #root .nf-brand:hover { color: #e50914 !important; }
        #root .nf-search-inner,
        #root .nf-mobile-search-overlay {
          background: #151515 !important;
          border-color: #3b3b3b !important;
          border-radius: 0 !important;
        }
        #root .nf-search-input,
        #root .nf-search-input::placeholder { color: #f5f5f5 !important; }
        #root .nf-search-inner:focus-within {
          border-color: #e50914 !important;
          box-shadow: 0 0 0 1px rgba(229, 9, 20, .35) !important;
        }
        #root .nf-nav-root :is(button, a),
        #root .nf-nav-root :is(button, a):hover {
          background: transparent !important;
          border-color: transparent !important;
          color: #f5f5f5 !important;
        }
        #root .nf-nav-root :is(button, a):hover {
          color: #e50914 !important;
        }
        #root .nf-nav-root :is(button, a) :is(svg, path) {
          fill: none !important;
          stroke: currentColor !important;
        }
        #root .nf-search-btn,
        #root .nf-search-btn:hover,
        #root .nf-sd-details-btn,
        #root .nf-sd-details-btn:hover {
          background: #e50914 !important;
          border-color: #e50914 !important;
          border-radius: 0 !important;
          color: #ffffff !important;
        }
        #root .nf-search-btn:hover,
        #root .nf-sd-details-btn:hover { background: #b20710 !important; border-color: #b20710 !important; }
        #root :is(.nf-bell, .nf-mobile-search-btn, .nf-call-indicator) {
          background: transparent !important;
          border-color: #4b4b4b !important;
          border-radius: 0 !important;
          color: #f5f5f5 !important;
        }
        #root .nf-nav-root :is(.nf-bell, .nf-mobile-search-btn, .nf-call-indicator):hover {
          background: transparent !important;
          border-color: #e50914 !important;
          color: #e50914 !important;
        }
        #root :is(.nf-login-link, .nf-logout-link) { color: #f5f5f5 !important; }
        #root :is(.nf-login-link, .nf-logout-link):hover { color: #e50914 !important; }
        #root .nf-avatar { background: transparent !important; border-color: #f5f5f5 !important; color: #f5f5f5 !important; }
        #root .nf-avatar-wrap:hover .nf-avatar { border-color: #e50914 !important; color: #e50914 !important; }
        #root :is(.nf-badge, .nf-call-badge, .nf-role-badge-admin, .nf-role-badge-hospital, .nf-role-badge-driver) {
          background: #e50914 !important;
          border-color: #0b0b0b !important;
          color: #ffffff !important;
        }

        /* Auth uses a focused dark stage and square white card. */
        #root .auth-root {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 138px 24px 44px;
          background: radial-gradient(circle at 76% 20%, rgba(80, 12, 16, .42), transparent 34%), #050505 !important;
          color: #111111 !important;
        }
        #root .auth-brandbar {
          position: fixed !important;
          inset: 0 0 auto;
          height: 86px;
          padding: 0 clamp(24px, 11vw, 216px);
          justify-content: flex-start;
          background: rgba(5, 5, 5, .96) !important;
          border: 0 !important;
          border-bottom: 1px solid #292929 !important;
        }
        #root .auth-brand,
        #root .auth-brand:hover,
        #root .auth-brand span,
        #root .auth-brand-mark {
          background: transparent !important;
          color: #e50914 !important;
          border-color: #e50914 !important;
        }
        #root .auth-brand { font-size: 32px; letter-spacing: -.065em; }
        #root .auth-shell { width: min(700px, calc(100vw - 48px)); max-width: 700px; margin: 0 auto; }
        #root .auth-left { display: none !important; }
        #root .auth-right {
          width: 100%;
          padding: 42px 50px 34px;
          gap: 10px;
          background: #f4f4f4 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: 0 18px 50px rgba(0, 0, 0, .42) !important;
          color: #111111 !important;
        }
        #root .auth-right :is(h1, h2, h3, p, span, div, label, b, small),
        #root :is(.auth-step-title, .auth-step-title .hl, .auth-field label, .auth-pass-toggle, .auth-link, .auth-back, .auth-help-toggle, .auth-help-toggle span, .auth-help-learn) {
          color: #111111 !important;
        }
        #root .auth-step-title { font-size: 34px !important; line-height: 1.08; }
        #root .auth-step-title .hl { color: #e50914 !important; }
        #root .auth-step-sub { color: #4c4c4c !important; font-size: 15px; margin-bottom: 10px; }
        #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt) {
          min-height: 42px;
          border-color: #9b9b9b !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          color: #111111 !important;
        }
        #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt):hover {
          background: #ffffff !important;
          border-color: #e50914 !important;
          color: #e50914 !important;
        }
        #root :is(.auth-mode.on, .auth-role.on),
        #root .auth-form > .auth-btn[type="submit"],
        #root .auth-form > .auth-btn[type="submit"]:hover {
          background: #e50914 !important;
          border-color: #e50914 !important;
          color: #ffffff !important;
        }
        #root .auth-form > .auth-btn[type="submit"]:hover { background: #b20710 !important; border-color: #b20710 !important; }
        #root .auth-field input,
        #root .auth-otp input {
          height: 46px;
          border-color: #929292 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          color: #111111 !important;
        }
        #root .auth-field input:focus,
        #root .auth-otp input:focus {
          border-color: #e50914 !important;
          box-shadow: 0 0 0 2px rgba(229, 9, 20, .14) !important;
        }
        #root :is(.auth-note, .auth-legal, .auth-meta, .auth-resend, .auth-help-body) { color: #575757 !important; }
        #root :is(.auth-link, .auth-back, .auth-resend button, .auth-help-toggle, .auth-help-learn) { color: #b20710 !important; }

        @media (max-width: 640px) {
          #root .auth-root { padding: 110px 14px 28px; place-items: start center; }
          #root .auth-brandbar { height: 68px; padding: 0 20px; }
          #root .auth-brand { font-size: 27px; }
          #root .auth-shell { width: 100%; }
          #root .auth-right { padding: 28px 20px 24px; }
          #root .auth-step-title { font-size: 28px !important; }
        }
      `}</style>
      <style>{`
        /* Final white and soft-gray application system. */
        html,
        body,
        #root {
          background: #ffffff !important;
          color: #111111 !important;
        }
        #root :is(.page-root, [class$="-root"], [class*="-root "]):not(.auth-root) {
          background: #f0f0f0 !important;
          color: #111111 !important;
        }
        #root :is([class$="-card"], [class*="-card "], [class$="-panel"], [class*="-panel "], .card) {
          background: #ffffff !important;
          border-color: #dedede !important;
          box-shadow: none !important;
        }
        #root :is(button, a):focus-visible {
          outline: 2px solid #111111 !important;
          outline-offset: 2px;
        }

        /* Navigation remains quiet: gray hover, black active icon, no active fill. */
        html body #root .nf-nav-root.nf-nav-root,
        html body #root .lsb-root.lsb-root,
        html body #root .lsb-bottom {
          background: #ffffff !important;
          border-color: #dedede !important;
          color: #111111 !important;
        }
        html body #root .nf-nav-root :is(span, a, button),
        html body #root :is(.nf-brand, .nf-login-link, .nf-logout-link),
        html body #root :is(.lsb-logo, .lsb-item, .lsb-bottom-item) {
          color: #111111 !important;
        }
        html body #root .nf-brand,
        html body #root .nf-brand:hover { color: #111111 !important; }
        html body #root .nf-search-inner,
        html body #root .nf-mobile-search-overlay {
          background: #f0f0f0 !important;
          border-color: #dedede !important;
          border-radius: 0 !important;
        }
        html body #root .nf-search-input,
        html body #root .nf-search-input::placeholder { color: #111111 !important; }
        html body #root .nf-search-btn,
        html body #root .nf-search-btn:hover {
          background: #111111 !important;
          border-color: #111111 !important;
          border-radius: 0 !important;
          color: #ffffff !important;
        }
        html body #root .nf-nav-root :is(button, a),
        html body #root .nf-nav-root :is(button, a):active {
          background: transparent !important;
          border-color: transparent !important;
          color: #111111 !important;
        }
        html body #root .nf-nav-root :is(button, a):hover {
          background: #f0f0f0 !important;
          border-color: #f0f0f0 !important;
          color: #111111 !important;
        }
        html body #root .nf-nav-root :is(button, a) :is(svg, path) {
          fill: none !important;
          stroke: currentColor !important;
        }
        html body #root :is(.nf-bell, .nf-mobile-search-btn, .nf-call-indicator) {
          background: transparent !important;
          border-color: transparent !important;
          border-radius: 0 !important;
          color: #111111 !important;
        }
        html body #root :is(.nf-bell, .nf-mobile-search-btn, .nf-call-indicator):hover {
          background: #f0f0f0 !important;
          border-color: #f0f0f0 !important;
          color: #111111 !important;
        }
        html body #root .nf-avatar {
          background: transparent !important;
          border-color: #111111 !important;
          color: #111111 !important;
        }
        html body #root .nf-avatar-wrap:hover .nf-avatar { background: #f0f0f0 !important; border-color: #111111 !important; color: #111111 !important; }
        html body #root :is(.nf-badge, .nf-call-badge, .nf-role-badge-admin, .nf-role-badge-hospital, .nf-role-badge-driver) {
          background: #111111 !important;
          border-color: #ffffff !important;
          color: #ffffff !important;
        }
        html body #root .lsb-logo,
        html body #root .lsb-logo:hover {
          background: transparent !important;
          border-bottom-color: #dedede !important;
          color: #111111 !important;
        }
        html body #root .lsb-logo :is(svg, path),
        html body #root .lsb-item :is(svg, path),
        html body #root .lsb-bottom-item :is(svg, path) {
          fill: none !important;
          stroke: #111111 !important;
        }
        html body #root .lsb-item,
        html body #root .lsb-bottom-item {
          background: transparent !important;
          border-color: transparent !important;
          color: #111111 !important;
        }
        html body #root .lsb-item:hover,
        html body #root .lsb-bottom-item:hover {
          background: #f0f0f0 !important;
          border-color: #f0f0f0 !important;
          color: #111111 !important;
        }
        html body #root .lsb-item.active,
        html body #root .lsb-bottom-item.active {
          background: transparent !important;
          border-color: transparent !important;
          color: #111111 !important;
          box-shadow: none !important;
        }
        html body #root .lsb-item.active :is(svg, path),
        html body #root .lsb-bottom-item.active :is(svg, path) { stroke: #111111 !important; }
        html body #root :is(.lsb-dot, .lsb-dot-red, .lsb-bottom-dot) { background: #111111 !important; color: #ffffff !important; }
        html body #root .lsb-bottom-toggle { background: #f0f0f0 !important; border-color: #dedede !important; color: #111111 !important; }

        /* Neutral data cards retain hierarchy without the former red styling. */
        html body #root :is(.amb2-card, .h2-card) {
          background: #ffffff !important;
          border-color: #dedede !important;
          box-shadow: none !important;
        }
        html body #root :is(.amb2-card, .h2-card):hover {
          background: #ffffff !important;
          border-color: #bdbdbd !important;
          box-shadow: none !important;
        }
        html body #root :is(.amb2-top, .h2-top) { background: #f0f0f0 !important; }
        html body #root :is(.amb2-top, .h2-top)::after { background: linear-gradient(135deg, rgba(0, 0, 0, .10), transparent 68%) !important; }
        html body #root :is(.amb2-speed, .amb2-status, .h2-status) {
          background: #ffffff !important;
          border-color: #dedede !important;
          color: #111111 !important;
        }
        html body #root :is(.amb2-pill, .h2-pill, .amb2-ins, .h2-mini) {
          background: #f0f0f0 !important;
          border-color: #dedede !important;
          color: #111111 !important;
        }
        html body #root :is(.amb2-ins, .h2-mini) :is(b, span, .v, .l) { color: #111111 !important; }
        html body #root :is(.amb2-btn, .h2-btn, .amb2-btn.main, .h2-btn.main, .h2-btn.assign) {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root :is(.amb2-btn, .h2-btn):hover { background: #2d2d2d !important; border-color: #2d2d2d !important; color: #ffffff !important; }

        /* Login follows the same white and soft-gray system. */
        html body #root .auth-root {
          background: #f0f0f0 !important;
          color: #111111 !important;
        }
        html body #root .auth-brandbar {
          background: #ffffff !important;
          border-bottom-color: #dedede !important;
        }
        html body #root .auth-brand,
        html body #root .auth-brand:hover,
        html body #root .auth-brand :is(span, .auth-brand-mark) {
          background: transparent !important;
          border-color: #111111 !important;
          color: #111111 !important;
        }
        html body #root .auth-right {
          background: #ffffff !important;
          border: 1px solid #dedede !important;
          box-shadow: none !important;
        }
        html body #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt) {
          background: #ffffff !important;
          border-color: #dedede !important;
          color: #111111 !important;
        }
        html body #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt):hover {
          background: #f0f0f0 !important;
          border-color: #dedede !important;
          color: #111111 !important;
        }
        html body #root :is(.auth-mode.on, .auth-role.on),
        html body #root .auth-form > .auth-btn[type="submit"],
        html body #root .auth-form > .auth-btn[type="submit"]:hover {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
        }
        html body #root :is(.auth-field input, .auth-otp input) {
          background: #ffffff !important;
          border-color: #dedede !important;
          color: #111111 !important;
        }
        html body #root :is(.auth-field input, .auth-otp input):focus {
          border-color: #111111 !important;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, .08) !important;
        }
      `}</style>
      <style>{`
        /* Aarogya: a clear white surface with an emergency-red operational accent. */
        :root { --aarogya-red: #e31b2f; --aarogya-red-dark: #bd1426; --aarogya-red-soft: #fce7ea; }
        html body #root :is(.nf-nav-root, .lsb-root, .lsb-bottom) {
          background: #ffffff !important;
          border-color: #e2e4e8 !important;
        }
        html body #root .nf-brand,
        html body #root .nf-brand:hover { color: var(--aarogya-red) !important; }
        html body #root .nf-search-btn,
        html body #root .nf-search-btn:hover {
          background: var(--aarogya-red) !important;
          border-color: var(--aarogya-red) !important;
          color: #ffffff !important;
        }
        html body #root .nf-search-btn:active { background: var(--aarogya-red-dark) !important; }
        html body #root .nf-search-wrap { width: min(520px, 42vw); }
        html body #root .nf-search-inner {
          width: 100% !important;
          height: 40px;
          border-radius: 999px !important;
          background: #ffffff !important;
          border-color: #dde1e7 !important;
          box-shadow: 0 3px 10px rgba(20, 25, 35, .07);
        }
        html body #root .nf-search-inner:focus-within {
          border-color: var(--aarogya-red) !important;
          box-shadow: 0 0 0 3px rgba(227, 27, 47, .12) !important;
        }
        html body #root .nf-search-icon { color: #667085 !important; }
        html body #root .nf-search-input { font-size: 12px; }
        html body #root .nf-search-btn,
        html body #root .nf-search-btn:hover {
          width: 34px;
          min-width: 34px;
          padding: 0;
          border: 0 !important;
          background: transparent !important;
          color: #737b88 !important;
          font-size: 0;
        }
        html body #root .nf-search-btn::after { content: "..."; font-size: 16px; font-weight: 800; letter-spacing: 1px; }
        html body #root .nf-search-btn:hover { color: var(--aarogya-red) !important; }
        html body #root .uh-root .uh-hero {
          background-color: #080808 !important;
        }
        html body #root .uh-root .uh-hero :is(.uh-title, .uh-title span, .uh-sub, .uh-kicker) {
          color: #ffffff !important;
        }
        html body #root .uh-root .uh-hero .uh-title span { color: #ff5a69 !important; }
        html body #root .uh-root .uh-hero .uh-kicker { background: var(--aarogya-red) !important; }

        html body #root .ad-root { background: #f5f7fb !important; color: #17263a !important; }
        html body #root .ad-root :is(.ad-head h1, .ad-panel-head h2, .ad-stat-v, .ad-panel-head b, .ad-activity-main b, .ad-request b, .ad-ready b) { color: #17263a !important; }
        html body #root .ad-root :is(.ad-head p, .ad-stat-k, .ad-stat-sub, .ad-bar-wrap span, .ad-activity-main span, .ad-request span, .ad-ready span) { color: #657185 !important; }
        html body #root .ad-root :is(.ad-panel, .ad-stat) { background: #ffffff !important; border-color: #e1e7f0 !important; }
        html body #root .ad-root :is(.ad-alert, .ad-alert:hover) { background: var(--aarogya-red) !important; border-color: var(--aarogya-red) !important; color: #ffffff !important; }
        html body #root .ad-root .ad-alert:hover { background: var(--aarogya-red-dark) !important; border-color: var(--aarogya-red-dark) !important; }

        html body #root .hp-root.hp-theme-home { background: #f5f7fb !important; }
        html body #root .hp-root.hp-theme-home :is(.hp-command-panel, .hp-command-stat) { background: #ffffff !important; border-color: #e1e7f0 !important; }
        html body #root .hp-root.hp-theme-home :is(.hp-command-head h1, .hp-command-panel-head b, .hp-command-stat .v, .hp-command-row b) { color: #17263a !important; }
        html body #root .hp-root.hp-theme-home :is(.hp-command-head p, .hp-command-stat .k, .hp-command-stat .s, .hp-command-row span) { color: #68758a !important; }
        html body #root .hp-root.hp-theme-home :is(.hp-command-alert, .hp-command-alert:hover) { background: var(--aarogya-red) !important; border-color: var(--aarogya-red) !important; color: #ffffff !important; }
        html body #root .hp-root.hp-theme-home .hp-command-alert:hover { background: var(--aarogya-red-dark) !important; border-color: var(--aarogya-red-dark) !important; }
        html body #root :is(button, .primary, .pri, .main, .chat-btn, .chat-chip.on):hover {
          background-color: var(--aarogya-red-dark) !important;
          border-color: var(--aarogya-red-dark) !important;
          color: #ffffff !important;
        }
        html body #root :is(.nf-search-btn, .uh-btn.primary, .uh-card-cta, .uh-footer-btn):hover {
          background-color: var(--aarogya-red-dark) !important;
          border-color: var(--aarogya-red-dark) !important;
          color: #ffffff !important;
        }
        html body #root .nf-search-btn,
        html body #root .nf-search-btn:hover {
          background: transparent !important;
          border-color: transparent !important;
          color: #737b88 !important;
        }
        html body #root .nf-search-btn:hover { color: var(--aarogya-red) !important; }
        html body #root :is(.nf-bell, .nf-mobile-search-btn, .nf-call-indicator):hover,
        html body #root .nf-avatar-wrap:hover .nf-avatar {
          background: var(--aarogya-red-soft) !important;
          border-color: #f7c2ca !important;
          color: var(--aarogya-red) !important;
        }
        html body #root .lsb-root .lsb-item:hover,
        html body #root .lsb-bottom .lsb-bottom-item:hover {
          background: var(--aarogya-red-soft) !important;
          border-color: var(--aarogya-red-soft) !important;
          color: var(--aarogya-red) !important;
        }
        html body #root .lsb-root .lsb-item:hover :is(svg, path),
        html body #root .lsb-bottom .lsb-bottom-item:hover :is(svg, path) { stroke: var(--aarogya-red) !important; }
        html body #root .lsb-root .lsb-item.active,
        html body #root .lsb-bottom .lsb-bottom-item.active,
        html body #root .lsb-bottom .lsb-bottom-toggle {
          background: var(--aarogya-red) !important;
          border-color: var(--aarogya-red) !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root .lsb-root .lsb-item.active :is(svg, path),
        html body #root .lsb-bottom .lsb-bottom-item.active :is(svg, path) { stroke: #ffffff !important; }
        html body #root :is(.lsb-dot, .lsb-dot-red, .lsb-bottom-dot) { background: var(--aarogya-red) !important; }

        html body #root :is(.amb2-card, .h2-card) { border-color: #e0e3e6 !important; }
        html body #root :is(.amb2-card, .h2-card):hover { border-color: #e31b2f !important; box-shadow: 0 14px 32px rgba(227,27,47,.10) !important; }
        html body #root :is(.amb2-pill, .h2-pill, .amb2-ins, .h2-mini) {
          background: #fff4f5 !important;
          border-color: #f4c7ce !important;
          color: #7f1220 !important;
        }
        html body #root :is(.amb2-btn, .h2-btn, .amb2-btn.main, .h2-btn.main, .h2-btn.assign) {
          background: var(--aarogya-red) !important;
          border-color: var(--aarogya-red) !important;
          color: #ffffff !important;
        }
        html body #root :is(.amb2-btn, .h2-btn):hover {
          background: var(--aarogya-red-dark) !important;
          border-color: var(--aarogya-red-dark) !important;
        }
        html body #root :is(.rep-sum-card, .rep-chart-card, .req-card, .req-table-wrap, .ad-insights, .ad-insight) {
          border-color: #e0e3e6 !important;
        }
        html body #root :is(.rep-sum-card, .req-card):hover { border-color: var(--aarogya-red) !important; }
        html body #root :is(.primary, .pri, .main):not(.uh-btn):not(.ad-btn) {
          background: var(--aarogya-red) !important;
          border-color: var(--aarogya-red) !important;
          color: #ffffff !important;
        }

        /* Final Aarogya palette: white surfaces, medical green actions, and orange highlights. */
        :root {
          --aarogya-green: #126f1e;
          --aarogya-green-dark: #0d5717;
          --aarogya-orange: #f59a23;
          --aarogya-green-soft: rgba(18, 111, 30, .10);
          --aarogya-orange-soft: rgba(245, 154, 35, .14);
        }
        html body #root { background: #ffffff !important; color: #163028 !important; }
        html body #root :is(.page-root, [class$="-root"], [class*="-root "]):not(.uh-root) {
          background: #ffffff !important;
          color: #163028 !important;
        }
        html body #root :is([class$="-card"], [class*="-card "], [class$="-panel"], [class*="-panel "], .card) {
          background: #ffffff !important;
          border-color: rgba(18, 111, 30, .18) !important;
          box-shadow: none !important;
        }
        html body #root :is(.nf-brand, .nf-brand:hover) {
          color: var(--aarogya-green) !important;
          text-transform: none !important;
        }
        html body #root :is(.auth-brand, .auth-brand:hover, .signin-help-brand strong) {
          color: var(--aarogya-green) !important;
          text-transform: none !important;
        }
        html body #root .nf-search-wrap { width: min(620px, 48vw) !important; }
        html body #root .nf-search-inner,
        html body #root .nf-search-inner:focus-within {
          height: 42px !important;
          border: 1px solid rgba(18, 111, 30, .34) !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root .nf-search-inner:focus-within { border-color: var(--aarogya-green) !important; }
        html body #root .nf-search-input,
        html body #root .nf-search-input:focus {
          height: auto !important;
          border: 0 !important;
          outline: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: #163028 !important;
        }
        html body #root .nf-search-input::placeholder { color: #769083 !important; }
        html body #root .nf-search-btn,
        html body #root .nf-search-btn:hover {
          width: 42px !important;
          min-width: 42px !important;
          height: 100% !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 9px 9px 0 !important;
          background: transparent !important;
          color: var(--aarogya-green) !important;
          font-size: 0 !important;
        }
        html body #root .nf-search-btn::after { content: "..."; color: inherit; font-size: 16px; font-weight: 800; letter-spacing: 1px; }
        html body #root .nf-search-btn:hover { background: var(--aarogya-green-soft) !important; color: var(--aarogya-green) !important; }

        html body #root :is(button[type="submit"], .primary, .pri, .main, .auth-btn, .auth-mode.on, .auth-role.on, .amb2-btn, .h2-btn, .hp-btn.primary, .ad-alert, .uh-book-btn) {
          background: var(--aarogya-green) !important;
          border-color: var(--aarogya-green) !important;
          color: #ffffff !important;
        }
        html body #root :is(button[type="submit"], .primary, .pri, .main, .auth-btn, .auth-mode.on, .auth-role.on, .amb2-btn, .h2-btn, .hp-btn.primary, .ad-alert, .uh-book-btn):hover {
          background: var(--aarogya-green-dark) !important;
          border-color: var(--aarogya-green-dark) !important;
          color: #ffffff !important;
        }
        html body #root :is(.lsb-root .lsb-item.active, .lsb-bottom .lsb-bottom-item.active, .lsb-bottom .lsb-bottom-toggle) {
          background: var(--aarogya-green) !important;
          border-color: var(--aarogya-green) !important;
          color: #ffffff !important;
        }
        html body #root :is(.lsb-root .lsb-item:hover, .lsb-bottom .lsb-bottom-item:hover) {
          background: var(--aarogya-green-soft) !important;
          border-color: var(--aarogya-green-soft) !important;
          color: var(--aarogya-green) !important;
        }
        html body #root :is(.lsb-dot, .lsb-dot-red, .lsb-bottom-dot, .nf-badge, .nf-call-badge) {
          background: var(--aarogya-orange) !important;
          border-color: var(--aarogya-orange) !important;
          color: #163028 !important;
        }
        html body #root :is(.amb2-pill, .h2-pill, .amb2-ins, .h2-mini, .uh-data-chip.accent) {
          background: var(--aarogya-orange-soft) !important;
          border-color: rgba(245, 154, 35, .42) !important;
          color: #9b5808 !important;
        }
        html body #root :is(.amb2-card, .h2-card):hover {
          border-color: var(--aarogya-green) !important;
          box-shadow: 0 12px 25px rgba(18, 111, 30, .08) !important;
        }
        html body #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt) {
          background: #ffffff !important;
          border-color: rgba(18, 111, 30, .26) !important;
          color: #163028 !important;
        }
        html body #root :is(.auth-mode, .auth-role, .auth-google, .auth-btn.alt):hover {
          background: var(--aarogya-green-soft) !important;
          border-color: var(--aarogya-green) !important;
          color: var(--aarogya-green) !important;
        }
        html body #root :is(.auth-field input, .auth-otp input):focus {
          border-color: var(--aarogya-green) !important;
          box-shadow: 0 0 0 2px var(--aarogya-green-soft) !important;
        }

        /* Final palette enforcement: only white, Aarogya green, and orange appear in the interface. */
        html body #root,
        html body #root :is(.page-root, [class$="-root"], [class*="-root "]) {
          background: #ffffff !important;
          background-image: none !important;
          color: #111111 !important;
        }
        html body #root :is(h1, h2, h3, h4, h5, h6, p, label, span, small, b, strong, td, th, li) {
          color: #111111 !important;
        }
        html body #root :is(.primary, .pri, .main, .amb2-btn, .h2-btn, .hp-btn.primary, .ad-alert, .uh-book-btn) {
          background: #126f1e !important;
          border-color: #126f1e !important;
          box-shadow: none !important;
        }
        html body #root :is(.primary, .pri, .main, .amb2-btn, .h2-btn, .hp-btn.primary, .ad-alert, .uh-book-btn) :is(span, b, strong),
        html body #root :is(.primary, .pri, .main, .amb2-btn, .h2-btn, .hp-btn.primary, .ad-alert, .uh-book-btn) {
          color: #ffffff !important;
        }
        html body #root :is(.primary, .pri, .main, .amb2-btn, .h2-btn, .hp-btn.primary, .ad-alert, .uh-book-btn):hover {
          background: #126f1e !important;
          border-color: #126f1e !important;
          color: #ffffff !important;
          transform: none !important;
        }
        html body #root :is([class$="-card"], [class*="-card "], .card, [class$="-panel"], [class*="-panel "]):hover {
          background: #ffffff !important;
          border-color: rgba(18, 111, 30, .18) !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root :is(.lsb-root.lsb-root .lsb-item:hover, .lsb-root.lsb-root .lsb-item.active, .lsb-bottom .lsb-bottom-item:hover, .lsb-bottom .lsb-bottom-item.active, .lsb-bottom .lsb-bottom-toggle) {
          background: #126f1e !important;
          border-color: #126f1e !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root :is(.lsb-root.lsb-root .lsb-item:hover, .lsb-root.lsb-root .lsb-item.active, .lsb-bottom .lsb-bottom-item:hover, .lsb-bottom .lsb-bottom-item.active) :is(svg, path) {
          stroke: #ffffff !important;
          color: #ffffff !important;
        }
        html body #root :is(.lsb-dot, .lsb-dot-red, .lsb-bottom-dot, .nf-badge, .nf-call-badge) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        html body #root :is(.amb2-pill, .h2-pill, .amb2-ins, .h2-mini, .uh-data-chip.accent) {
          background: #fff3df !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        html body #root :is(.nf-nav-root.nf-nav-root, .nf-nav-root.nf-nav-root:hover) {
          background: #ffffff !important;
          border-color: rgba(18, 111, 30, .20) !important;
          color: #111111 !important;
        }
        html body #root .nf-nav-root.nf-nav-root .nf-brand,
        html body #root .nf-nav-root.nf-nav-root :is(.nf-username, .nf-login-link, .nf-logout-link) {
          color: #111111 !important;
          text-transform: none !important;
        }
        html body #root :is(.chat-panel, .chat-head, .chat-voice-row, .chat-list, .chat-ctrl) {
          background: #ffffff !important;
          border-color: rgba(18, 111, 30, .22) !important;
          color: #111111 !important;
          box-shadow: none !important;
        }
        html body #root :is(.chat-head, .chat-voice-row, .chat-ctrl) :is(span, b, strong, small) { color: #111111 !important; }
        html body #root :is(.chat-chip, .chat-chip.on, .chat-btn) {
          background: #126f1e !important;
          border-color: #126f1e !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root :is(.chat-chip, .chat-chip.on, .chat-btn) :is(span, svg, path) { color: #ffffff !important; stroke: #ffffff !important; }
        html body #root :is(.chat-msg.mine, .chat-msg.other) {
          background: #ffffff !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        html body #root,
        html body #root *,
        html body #root :is(button, input, select, textarea) {
          font-family: Roboto, "Segoe UI", sans-serif !important;
        }
        html body #root :is(.auth-mode.on, .auth-mode.on:hover) {
          background: #111111 !important;
          border-color: #111111 !important;
          color: #ffffff !important;
        }
        html body #root :is(.auth-role.on, .auth-role.on:hover) {
          background: #ffffff !important;
          border-color: #111111 !important;
          color: #111111 !important;
          box-shadow: inset 0 -3px 0 #111111 !important;
        }
        html body #root :is(.auth-google, .auth-google:hover) {
          background: #ffffff !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        html body #root :is(.auth-back, .auth-back:hover) {
          background: #ffffff !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        html body #root :is(.amb-modal .amb2-btn, .amb-modal .amb2-btn:hover, .uh-book-cta, .uh-book-cta:hover) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        /* Higher-specificity palette guard for legacy component styles mounted after this shell. */
        html body #root#root :is(.nf-brand, .nf-login-link, .nf-logout-link, .nf-search-btn, .nf-search-inner:focus-within, .nf-call-indicator.alert, .nf-user-notif-badge, .nf-profile-dp-preview, .ad-eyebrow, .hp-command-eyebrow, .ad-panel-head button, .hp-command-panel-head button) {
          color: #111111 !important;
          border-color: #f59a23 !important;
          box-shadow: none !important;
        }
        html body #root#root :is(.nf-search-btn, .ad-alert, .hp-command-alert, .ad-bar, .hp-command-meter-fill) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
          box-shadow: none !important;
        }
        html body #root#root :is(.lsb-root .lsb-item.active, .lsb-root .lsb-item:hover, .lsb-bottom-item.active, .lsb-bottom-item:hover, .lsb-bottom-toggle) {
          background: #126f1e !important;
          border-color: #126f1e !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        /* Login is neutral except for the selected yellow Sign In tab. */
        html body #root#root .auth-root :is(.auth-mode, .auth-role, .auth-google, .auth-back, .auth-pass-toggle) {
          background: #ffffff !important;
          border-color: #dedede !important;
          color: #111111 !important;
          box-shadow: none !important;
        }
        html body #root#root .auth-root :is(.auth-mode:hover, .auth-role:hover, .auth-google:hover, .auth-back:hover, .auth-pass-toggle:hover) {
          background: #ffffff !important;
          border-color: #111111 !important;
          color: #111111 !important;
          transform: none !important;
        }
        html body #root#root .auth-root :is(.auth-mode.on, .auth-mode.on:hover) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
        html body #root#root .auth-root .auth-role.on {
          background: #ffffff !important;
          border-color: #dedede !important;
          color: #111111 !important;
          box-shadow: none !important;
        }
        html body #root#root .auth-root :is(.auth-btn, .auth-btn.alt, .auth-btn:hover, .auth-btn.alt:hover) {
          background: #ffffff !important;
          border-color: #dedede !important;
          color: #111111 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root .auth-root :is(.auth-field input, .auth-otp input) { border-color: #dedede !important; }
        html body #root#root .auth-root :is(.auth-field input, .auth-otp input):focus { border-color: #111111 !important; box-shadow: none !important; }
        /* Dashboard panels keep labels and actions separated without green button blocks. */
        html body #root#root .ad-panel {
          border-color: rgba(245, 154, 35, .42) !important;
          box-shadow: none !important;
        }
        html body #root#root .ad-panel-head {
          min-height: 62px;
          padding: 16px 18px !important;
          gap: 16px;
        }
        html body #root#root .ad-panel-head button {
          padding: 7px 9px !important;
          border: 1px solid #126f1e !important;
          border-radius: 7px !important;
          background: #ffffff !important;
          color: #111111 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root .ad-panel-head button:hover {
          background: #126f1e !important;
          border-color: #126f1e !important;
          color: #ffffff !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html body #root#root :is(.ad-activity-row, .ad-request, .ad-ready) { gap: 12px !important; }
        /* Hospital team allocation palette and split bed/team view. */
        html body #root .team-allocation-page .team-btn.primary,
        html body #root .team-allocation-page .team-btn.primary:hover {
          background: #126f1e !important;
          border-color: #126f1e !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }
        html body #root .team-allocation-page .patient-banner {
          background: #126F1E !important;
        }
        html body #root .team-allocation-page .staff-role {
          background: #e5f7ed !important;
          color: #126f1e !important;
          border-color: #a9dfc7 !important;
        }
        html body #root .beds-team-pane,
        html body #root .beds-details-drawer {
          box-shadow: none !important;
        }
        html body #root .beds-team-back-button,
        html body #root .beds-team-back-button:hover {
          background: #f2b233 !important;
          border-color: #f2b233 !important;
          color: #173645 !important;
          box-shadow: none !important;
        }
        /* Staff portal stays intentionally white even though older shared
           page selectors apply the dark admin surface globally. */
        html body #root .staff-portal-root.staff-portal-root {
          background: #ffffff !important;
          color: #122118 !important;
        }
        html body #root .staff-portal-root.staff-portal-root :is(h1, h2, h3, p, span, div, article, section, aside) {
          color: inherit !important;
        }
        html body #root .staff-portal-root .staff-kicker,
        html body #root .staff-portal-root .staff-stat-value,
        html body #root .staff-portal-root .staff-panel-title,
        html body #root .staff-portal-root .staff-case-status { color: #126f1e !important; }
        html body #root .staff-portal-root .staff-stat-label { color: #6d7a70 !important; }
        html body #root .staff-portal-root .staff-stat.red .staff-stat-value { color: #c62828 !important; }
        html body #root .staff-portal-root .staff-stat.yellow .staff-stat-value { color: #b77900 !important; }
        html body #root .staff-portal-root .staff-tone.red { color: #a9131c !important; background: #ffe2e4 !important; }
        html body #root .staff-portal-root .staff-tone.yellow { color: #835800 !important; background: #fff1be !important; }
        html body #root .staff-portal-root .staff-tone.green { color: #126f1e !important; background: #dff4e2 !important; }
        html body #root .staff-portal-root .staff-chip { color: #126f1e !important; background: #e8f7e9 !important; }
        html body #root .staff-portal-root .staff-subtitle,
        html body #root .staff-portal-root .staff-panel-caption,
        html body #root .staff-portal-root .staff-identity-meta,
        html body #root .staff-portal-root .staff-case-meta,
        html body #root .staff-portal-root .staff-case-condition,
        html body #root .staff-portal-root .staff-case-bed,
        html body #root .staff-portal-root .staff-info-row span:first-child { color: #68756c !important; }
        html body #root .staff-portal-root .staff-title,
        html body #root .staff-portal-root .staff-identity-name,
        html body #root .staff-portal-root .staff-case-name,
        html body #root .staff-portal-root .staff-info h3,
        html body #root .staff-portal-root .staff-info-row span:last-child { color: #142019 !important; }
        html body #root .staff-portal-root .staff-panel,
        html body #root .staff-portal-root .staff-stat,
        html body #root .staff-portal-root .staff-case { background: #ffffff !important; border-color: #d4dfd6 !important; }
        html body #root .staff-portal-root .staff-case-list { background: #fbfdfb !important; }
        html body #root .staff-portal-root .staff-identity { background: #f5fbf6 !important; border-color: #c9e3ce !important; }
        html body #root .staff-portal-root .staff-action { background: #ffffff !important; color: #12351b !important; border-color: #c8d7cb !important; }
        html body #root .staff-portal-root .staff-action.primary { background: #126f1e !important; color: #ffffff !important; border-color: #126f1e !important; }
        html body #root .staff-portal-root .staff-empty { background: #fbfdfb !important; color: #69776c !important; }
        html body #root .staff-portal-root .staff-error { background: #fff5f5 !important; color: #a62028 !important; }
        html body #root .condition-photo-card,
        html body #root .condition-photo-card * { background-color: #ffffff !important; color: #142019 !important; border-color: #c9e0d0 !important; }
        html body #root .driver-photo-root,
        html body #root .staff-condition-root { background: #ffffff !important; color: #142019 !important; }
        /* Live consultation keeps its light clinical workspace above legacy global theme guards. */
        html body #root .live-consult-root.live-consult-root { background: #f4f7fa !important; color: #172235 !important; }
        html body #root .live-consult-root :is(h1, h2, h3, p, span, div, label, small) { color: inherit !important; }
        html body #root .live-consult-root .live-consult-panel { background: #ffffff !important; border: 1px solid #dce5eb !important; color: #172235 !important; border-radius: 10px !important; }
        html body #root .live-consult-root .live-consult-booking { background: #fbfdff !important; border: 1px solid #dae4eb !important; color: #172235 !important; }
        html body #root .live-consult-root .live-consult-booking.active { border-color: #087640 !important; }
        html body #root .live-consult-root .live-consult-stage { background: #0f172a !important; border: 0 !important; }
        html body #root .live-consult-root .live-consult-stage :is(h2, p, span) { color: inherit !important; }
        html body #root .live-consult-root .live-consult-stage-placeholder { color: #eef4ff !important; }
        html body #root .live-consult-root .live-consult-stage-placeholder p { color: #a9b9ce !important; }
        html body #root .live-consult-root .live-consult-avatar { background: #1f8b59 !important; color: #ffffff !important; }
        html body #root .live-consult-root .live-consult-stage-tag { background: rgba(18,29,48,.82) !important; color: #ffffff !important; }
        html body #root .live-consult-root .live-consult-stage-tag span { color: #ffffff !important; }
        html body #root .live-consult-root .live-consult-vitals { background: #ffffff !important; border: 1px solid #dce5eb !important; }
        html body #root .live-consult-root .live-consult-vital-label { color: #8190a3 !important; }
        html body #root .live-consult-root .live-consult-vital-value { color: #ed2a3a !important; }
        html body #root .live-consult-root .live-consult-vital:nth-child(2) .live-consult-vital-value { color: #078dcc !important; }
        html body #root .live-consult-root .live-consult-vital:nth-child(3) .live-consult-vital-value { color: #dc9900 !important; }
        html body #root .live-consult-root :is(.live-consult-btn, .live-consult-control, .live-consult-booking-open, .live-consult-note-button, .live-consult-image) { box-shadow: none !important; }
        html body #root .live-consult-root .live-consult-btn { background: #ffffff !important; color: #0e6a3d !important; border: 1px solid #bfd0dc !important; }
        html body #root .live-consult-root .live-consult-control { background: #e3f4fb !important; color: #078dcc !important; border: 0 !important; }
        html body #root .live-consult-root .live-consult-control.start,
        html body #root .live-consult-root .live-consult-booking-open,
        html body #root .live-consult-root .live-consult-note-button { background: #087640 !important; color: #ffffff !important; border-color: #087640 !important; }
        html body #root .live-consult-root .live-consult-control.end { background: #fa4047 !important; color: #ffffff !important; }
        html body #root .live-consult-root .live-consult-image { background: #ffffff !important; color: #607087 !important; border: 1px solid #dce5eb !important; }
        html body #root .live-consult-root .live-consult-image span { color: #607087 !important; }
        html body #root .live-consult-root :is(.live-consult-empty, .live-consult-note-saved) { background: #f4f8fb !important; color: #40556a !important; border-color: #c9d5df !important; }
        html body #root .live-consult-root .live-consult-notes textarea { background: #ffffff !important; color: #26364b !important; border-color: #d4dfe7 !important; }
        html body #root .live-consult-root .live-consult-preview-card { background: #ffffff !important; border: 1px solid #e3e3e3 !important; border-radius: 12px !important; }
        html body #root .live-consult-root .live-consult-preview-close { background: #ffffff !important; color: #111111 !important; border: 1px solid #dce5eb !important; }
        /* Photo/report cards retain their clinical card hierarchy and actionable green buttons. */
        html body #root .staff-condition-root .staff-condition-card { background: #ffffff !important; border: 1px solid #cfddd2 !important; border-left: 6px solid #23a455 !important; border-radius: 13px !important; box-shadow: 0 5px 18px rgba(31,82,48,.06) !important; }
        html body #root .staff-condition-root .staff-condition-card.red { border-left-color: #dc2634 !important; }
        html body #root .staff-condition-root .staff-condition-card.yellow { border-left-color: #e2ab12 !important; }
        html body #root .staff-condition-root .staff-condition-view,
        html body #root .staff-condition-root .staff-condition-view:hover { background: #126f1e !important; border: 0 !important; color: #ffffff !important; border-radius: 8px !important; box-shadow: 0 4px 10px rgba(18,111,30,.2) !important; }
        html body #root .staff-condition-root .staff-condition-view:disabled { background: #b7c9bb !important; color: #ffffff !important; box-shadow: none !important; }
        html body #root .staff-condition-root .staff-condition-tone.green { background: #ddf5e5 !important; color: #13713c !important; }
        html body #root .staff-condition-root .staff-condition-tone.red { background: #ffe2e4 !important; color: #ad1d2a !important; }
        html body #root .staff-condition-root .staff-condition-tone.yellow { background: #fff0bd !important; color: #805700 !important; }
        html body #root .driver-photo-root .driver-booking { background: #ffffff !important; border: 1px solid #d7e1e9 !important; border-radius: 14px !important; box-shadow: 0 4px 16px rgba(27,52,72,.04) !important; }
        html body #root .driver-photo-root .driver-booking.red { border-color: #ff8d8d !important; }
        html body #root .driver-photo-root .driver-booking.yellow { border-color: #ecc65a !important; }
        html body #root .driver-photo-root .driver-send,
        html body #root .driver-photo-root .driver-send:hover { background: #087640 !important; border: 0 !important; color: #ffffff !important; border-radius: 8px !important; }
        html body #root .driver-photo-root .driver-upload { background: #f7fafc !important; border: 1px dashed #a9baca !important; color: #243348 !important; }
        html body #root .driver-photo-root .driver-select { background: #ffffff !important; color: #243348 !important; border: 1px solid #cad7e2 !important; }
        html body #root .driver-photo-root .driver-photo-refresh { background: #ffffff !important; color: #14633e !important; border: 1px solid #bfd0df !important; }
        html body #root .driver-photo-root .driver-hub { background: #f9fcfe !important; border: 1px solid #c7d8e3 !important; }
        html body #root .driver-photo-root .driver-store,
        html body #root .driver-photo-root .driver-store:hover { background: #dff4e7 !important; color: #08763d !important; border: 1px solid #9fcfb0 !important; }
        html body #root .driver-photo-root .driver-existing { background: #f8fbfd !important; border-color: #d8e5ec !important; }
        html body #root .live-consult-root .live-consult-stage-placeholder h2 { color: #eef4ff !important; }
        html body #root .live-consult-root .live-consult-stage-placeholder p { color: #a9b9ce !important; }
      `}</style>
    </>
  );
};

export default App;
