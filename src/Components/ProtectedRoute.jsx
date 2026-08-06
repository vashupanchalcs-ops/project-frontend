import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";

function ProtectedRoute({ children, requireProfile = false }) {
  const { user, loading, activeProfile } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-white">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireProfile && !activeProfile) {
    return <Navigate to="/profiles" replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;
