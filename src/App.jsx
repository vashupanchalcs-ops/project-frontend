import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import Homepage              from "./Pages/Homepage";
import Reports               from "./Pages/Reports";
import Requests              from "./Pages/Request";
import Leftsidebar           from "./Components/Leftsidebar";
import Topnavbar             from "./Components/Topnavbar";
import Ambulances            from "./Pages/Ambulances";
import Hospitals             from "./Pages/Hospitals";
import Login                 from "./Pages/Login";
import Signup                from "./Pages/Signup";
import BookingDetails        from "./Pages/BookingDetails";
import DriverView            from "./Pages/DriverView";
import DriverDashboard       from "./Pages/DriverDashboard";
import DriverChangeRequests  from "./Pages/DriverChangeRequests";
import LiveMap               from "./Pages/LiveMap";
import Directions            from "./Pages/Directions";   // ← Directions (live tracking)
import UserLiveTracking      from "./Components/UserLiveTracking";
import MyBookings            from "./Pages/MyBookings";
import SettingsPage          from "./Pages/Settings";

// ── Route guards ──────────────────────────────────────────────────────────
const AdminRoute = ({ element }) => {
  const role = localStorage.getItem("role");
  return role === "admin" ? element : <Navigate to="/Ambulances" replace />;
};

const ProtectedRoute = ({ element }) => {
  const user = localStorage.getItem("user");
  return user ? element : <Navigate to="/Login" replace />;
};

const DriverAwareRoute = ({ driverElement, defaultElement }) => {
  const role = localStorage.getItem("role");
  if (role === "driver") return <ProtectedRoute element={driverElement} />;
  return <ProtectedRoute element={defaultElement} />;
};

const App = () => {
  const { pathname } = useLocation();
  const routeShellRef = useRef(null);
  const p    = pathname.toLowerCase();
  const role = localStorage.getItem("role");

  const isAuth       = p === "/login" || p === "/signup";
  const isMapView    = p === "/directions";
  const isUser       = role !== "admin" && role !== "driver" && !!localStorage.getItem("user");

  useEffect(() => {
    if (!routeShellRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        routeShellRef.current,
        { autoAlpha: 0, y: 26, filter: "blur(10px)", scale: 0.995 },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", scale: 1, duration: 0.82, ease: "power3.out" }
      );
      gsap.fromTo(
        "[data-k72='reveal']",
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.74, stagger: 0.07, delay: 0.08, ease: "power3.out" }
      );
    }, routeShellRef);
    return () => ctx.revert();
  }, [pathname]);

  useEffect(() => {
    const onMove = (e) => {
      document.documentElement.style.setProperty("--sr-mx", `${e.clientX}px`);
      document.documentElement.style.setProperty("--sr-my", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <>
      {!isAuth && !isMapView && <Leftsidebar />}
      {!isAuth && !isMapView && <Topnavbar />}
      {!isAuth && !isMapView && isUser && <UserLiveTracking />}
      <div ref={routeShellRef}>
      <Routes>
        {/* Public */}
        <Route path="/Login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Homepage — driver sees DriverDashboard */}
        <Route path="/" element={
          <DriverAwareRoute
            driverElement={<DriverDashboard />}
            defaultElement={<Homepage />}
          />
        } />

        {/* Driver */}
        <Route path="/DriverDashboard" element={<ProtectedRoute element={<DriverDashboard />} />} />
        <Route path="/driver/:id"      element={<ProtectedRoute element={<DriverView />} />} />
        <Route path="/DriverView"      element={<ProtectedRoute element={<DriverView />} />} />

        {/* Shared */}
        <Route path="/Ambulances" element={<ProtectedRoute element={<Ambulances />} />} />
        <Route path="/Hospitals"  element={<ProtectedRoute element={<Hospitals />} />} />
        <Route path="/MyBookings" element={<ProtectedRoute element={<MyBookings />} />} />
        <Route path="/settings" element={<ProtectedRoute element={<SettingsPage />} />} />

        {/* /directions — Live tracking map (user clicks "Live Track" in MyBookings) */}
        <Route path="/directions" element={<ProtectedRoute element={<Directions />} />} />

        {/* Admin only */}
        <Route path="/Reports"              element={<AdminRoute element={<Reports />} />} />
        <Route path="/Requests"             element={<AdminRoute element={<Requests />} />} />
        <Route path="/bookings"             element={<AdminRoute element={<BookingDetails />} />} />
        <Route path="/LiveMap"              element={<AdminRoute element={<LiveMap />} />} />
        <Route path="/DriverChangeRequests" element={<AdminRoute element={<DriverChangeRequests />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </>
  );
};

export default App;
