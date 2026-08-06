import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function LoginPage() {
  const { login, signup, user, activeProfile } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      navigate(activeProfile ? "/browse" : "/profiles", { replace: true });
    }
  }, [user, activeProfile, navigate]);

  const redirectPath = location.state?.from?.pathname || "/browse";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignup) {
        await signup(email, password);
        navigate("/profiles", { replace: true });
      } else {
        await login(email, password);
        navigate(redirectPath, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="soft-panel w-full max-w-md rounded-3xl p-7 shadow-2xl">
        <p className="title-font text-4xl text-red-500">SwiftFlix</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{isSignup ? "Create account" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-white/60">Email login, profile selection, and movie sync.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-white outline-none"
            placeholder="Email"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-white outline-none"
            placeholder="Password"
          />

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-red-500 font-semibold text-white transition hover:bg-red-400 disabled:opacity-70"
          >
            {loading ? "Please wait..." : isSignup ? "Sign Up" : "Login"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignup((prev) => !prev)}
          className="mt-4 text-sm text-white/80"
        >
          {isSignup ? "Already have an account? Login" : "New here? Create account"}
        </button>

        <p className="mt-6 text-xs text-white/45">
          Movie data by{" "}
          <Link to="https://www.themoviedb.org" className="text-white">
            TMDB
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
