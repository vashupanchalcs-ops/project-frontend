// Signup.jsx — redirects to Login page signup step
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();
  useEffect(function() {
    navigate("/Login?signup=1", { replace: true });
  }, []);
  return null;
}
