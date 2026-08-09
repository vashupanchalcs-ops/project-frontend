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
import HospitalCaseReportView from "./Pages/HospitalCaseReportView";
import DriverInsuranceForm   from "./Pages/DriverInsuranceForm";
import HospitalInsuranceView from "./Pages/HospitalInsuranceView";


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
      targets.forEach((card, index) => {
        gsap.fromTo(
          card,
          {
            y: 36,
            opacity: 0.65
          },
          {
            y: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              start: "top 92%",
              end: "top 56%",
              scrub: 0.9,
              invalidateOnRefresh: true
            },
            delay: Math.min(index * 0.012, 0.18)
          }
        );
      });
    });

    return () => ctx.revert();
  }, [pathname]);
  
  const isAuth = p === "/login" || p === "/signup" || p === "/login/help";
  const isMapView = p === "/directions";

  // Background polling for confirmed booking (user only)
  const isUser = role !== "admin" && role !== "driver" && role !== "hospital" && !!localStorage.getItem("user");
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

        {/* Shared */}
        <Route path="/Ambulances" element={<ProtectedRoute element={<Ambulances />} />} />
        <Route path="/Hospitals" element={<ProtectedRoute element={<Hospitals />} />} />
        <Route path="/MyBookings" element={<ProtectedRoute element={<MyBookings />} />} />
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
