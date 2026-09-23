import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./Layout.css";
import { ThemeProvider } from "./ThemeContext.jsx";
import { installFetchCache } from "./utils/fetchCache.js";

// Keep legacy API calls working in production while individual screens are
// migrated away from their old localhost URLs. Local Vite must stay connected
// to local Django so development OTPs print in the Django terminal.
const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
// Vercel can retain an old VITE_API_BASE_URL environment value. Production
// must use the same live Render service as every hospital page, otherwise the
// home dashboard and Bed Management read different databases.
const configuredApiBase = (
  import.meta.env.DEV
    ? (import.meta.env.VITE_API_BASE_URL || defaultApiBase)
    : defaultApiBase
).replace(/\/+$/, "");
const legacyApiOriginPattern = /^(?:https?:\/\/(?:127\.0\.0\.1|localhost):8000|https:\/\/(?:swiftrescue-backend|aarogya-backend)(?:-[a-z0-9]+)?\.onrender\.com)/;
const nativeFetch = window.fetch.bind(window);
const API_REQUEST_TIMEOUT_MS = 15000;
const apiOrigin = new URL(configuredApiBase).origin;
const apiGetInflight = new Map();

const responseFromSnapshot = (snapshot) => new Response(snapshot.body.slice(0), {
  status: snapshot.status,
  statusText: snapshot.statusText,
  headers: snapshot.headers,
});

window.fetch = (input, init = {}) => {
  let requestInput = input;
  if (typeof input === "string") {
    requestInput = input.replace(legacyApiOriginPattern, configuredApiBase);
  } else if (input instanceof Request) {
    const rewrittenUrl = input.url.replace(legacyApiOriginPattern, configuredApiBase);
    if (rewrittenUrl !== input.url) requestInput = new Request(rewrittenUrl, input);
  }

  const method = String(init?.method || (requestInput instanceof Request ? requestInput.method : "GET")).toUpperCase();
  let requestUrl = "";
  try { requestUrl = new URL(requestInput instanceof Request ? requestInput.url : requestInput, window.location.origin).href; } catch {}

  // A failed/slow Render request must not leave every polling component with
  // its own hanging connection. Share one GET per API URL and stop waiting
  // after 15 seconds so navigation remains responsive during cold starts.
  const isApiGet = method === "GET" && requestUrl.startsWith(`${apiOrigin}/api/`);
  if (!isApiGet) return nativeFetch(requestInput, init);

  const existing = apiGetInflight.get(requestUrl);
  if (existing) return existing.then(responseFromSnapshot);

  const controller = new AbortController();
  const sourceSignal = init?.signal || (requestInput instanceof Request ? requestInput.signal : null);
  const forwardAbort = () => controller.abort(sourceSignal?.reason);
  if (sourceSignal) {
    if (sourceSignal.aborted) forwardAbort();
    else sourceSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  const timeout = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  const request = nativeFetch(requestInput, { ...init, signal: controller.signal })
    .then(async (response) => ({
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      body: await response.arrayBuffer(),
    }))
    .finally(() => {
      window.clearTimeout(timeout);
      sourceSignal?.removeEventListener("abort", forwardAbort);
      apiGetInflight.delete(requestUrl);
    });

  apiGetInflight.set(requestUrl, request);
  return request.then(responseFromSnapshot);
};

// Activate global instant cache for fast navigation across all pages without time delay
installFetchCache();

// Staggered background warmup: one request every 3s to avoid overwhelming Render free tier
// (Render free tier has WEB_CONCURRENCY=1 + ASGI_THREADS=4 — parallel requests cause CancelledError)
try {
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const userEmail = localStorage.getItem("user");
  const staffId = localStorage.getItem("staff_id");
  const hospitalId = localStorage.getItem("hospital_id");

  // Only warmup if user is logged in
  if (role || userEmail) {
    const warmupEndpoints = [
      `${configuredApiBase}/api/ambulances/`,
      `${configuredApiBase}/api/hospitals/`,
    ];
    // Bookings endpoint — only for logged-in non-driver users
    if (role !== "driver") {
      warmupEndpoints.push(`${configuredApiBase}/api/bookings/`);
    } else if (userEmail) {
      const warmupAmbulanceId = localStorage.getItem("ambulance_id");
      const driverQuery = new URLSearchParams({ driver_email: userEmail });
      if (warmupAmbulanceId) driverQuery.set("ambulance_id", warmupAmbulanceId);
      warmupEndpoints.push(`${configuredApiBase}/api/bookings/driver-assigned/?${driverQuery.toString()}`);
    }
    if (staffId && userEmail) {
      warmupEndpoints.push(`${configuredApiBase}/api/staff/dashboard/?staff_id=${encodeURIComponent(staffId)}&email=${encodeURIComponent(userEmail)}`);
    }
    if (role === "driver" && userEmail) {
      warmupEndpoints.push(`${configuredApiBase}/api/driver/notifications/?email=${encodeURIComponent(userEmail)}`);
    }
    if (hospitalId) {
      warmupEndpoints.push(`${configuredApiBase}/api/hospitals/${hospitalId}/beds/`);
      warmupEndpoints.push(`${configuredApiBase}/api/hospitals/${hospitalId}/staff/`);
    }

    // Fire one request every 3 seconds — staggered so backend isn't overwhelmed
    warmupEndpoints.forEach((url, i) => {
      setTimeout(() => { window.fetch(url).catch(() => {}); }, i * 3000 + 2000);
    });

    // Keep-alive ping every 4 minutes to prevent Render free tier cold start (50s+ delay)
    // Render spins down after ~15 min of inactivity — this keeps it warm
    setInterval(() => {
      window.fetch(`${configuredApiBase}/api/ambulances/`).catch(() => {});
    }, 4 * 60 * 1000);
  }
} catch {}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
