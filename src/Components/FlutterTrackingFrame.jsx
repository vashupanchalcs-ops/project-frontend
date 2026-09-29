import { useMemo, useState } from "react";
import { API_BASE_URL } from "../api/client";

const normalizeMapUrl = (raw) => {
  const url = String(raw || "").trim();
  if (!url) return "/map/index.html";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url.replace(/\/+$/, "");
  }
  const clean = url.replace(/\/+$/, "");
  return clean.endsWith(".html") ? clean : `${clean}/index.html`;
};

const defaultUrl = normalizeMapUrl(import.meta.env.VITE_FLUTTER_TRACKING_URL || "/map/index.html");

const storageValue = (key) => {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

/**
 * Shared Flutter/Web Map surface for every Aarogya role.
 * The map layer owns the Google Maps rendering engine; React supplies identity
 * and booking context through URL parameters.
 */
export default function FlutterTrackingFrame({
  role = storageValue("role") || "user",
  bookingId = 0,
  ambulanceId = null,
  mapOnly = false,
  title = "Aarogya Live Map",
  className = "",
}) {
  const [useFallback, setUseFallback] = useState(false);

  const identity = useMemo(() => ({
    role: String(role || "user").toLowerCase(),
    email: storageValue("user"),
    ambulanceId: storageValue("ambulance_id"),
    hospitalId: storageValue("hospital_id"),
    staffId: storageValue("staff_id"),
  }), [role]);

  const activeUrl = useFallback ? "/map/index.html" : defaultUrl;

  const src = useMemo(() => {
    // When the map is served via Vite (same origin), use the window origin so
    // API + WS calls flow through the Vite dev-server proxy → no CORS issues.
    // In production (different origins), fall back to the real Django URL.
    const mapOrigin = (typeof window !== "undefined" ? window.location.origin : "") || API_BASE_URL;
    const query = new URLSearchParams({
      role: identity.role,
      email: identity.email,
      token: identity.email,          // WS auth fallback in DEBUG mode
      hospital_id: identity.hospitalId,
      staff_id: identity.staffId,
      api_base_url: mapOrigin,
      carto_key: import.meta.env.VITE_CARTO_API_KEY || "cb1_421q_1_ea7e33a0b4b2db4a0c993441",
      maps_key: import.meta.env.VITE_GOOGLE_MAPS_KEY || "AIzaSyDFELdWEMtpHkwOUsfN123las2n98r17to",
    });
    if (mapOnly) {
      query.set("map_only", "1");
    }
    const resolvedAmbId = ambulanceId !== null && ambulanceId !== undefined ? ambulanceId : identity.ambulanceId;
    if (resolvedAmbId) {
      query.set("ambulance_id", String(resolvedAmbId));
    }
    const numericBookingId = Number(bookingId || 0);
    if (numericBookingId > 0 && !mapOnly) query.set("booking_id", String(numericBookingId));
    
    const base = normalizeMapUrl(activeUrl);
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}${query.toString()}`;
  }, [activeUrl, bookingId, ambulanceId, mapOnly, identity]);

  return (
    <section className={`flutter-tracking-frame ${className}`} aria-label={title}>
      {src ? (
        <iframe
          key={src}
          title={title}
          src={src}
          className="flutter-tracking-frame__iframe"
          allow="geolocation; fullscreen"
          allowFullScreen
          onError={() => {
            if (!useFallback && activeUrl !== "/map/index.html") {
              setUseFallback(true);
            }
          }}
        />
      ) : (
        <div className="flutter-tracking-frame__missing">
          <div className="flutter-tracking-frame__icon">🗺️</div>
          <h3>Aarogya Map Engine Initializing</h3>
          <p>Connecting to live tracking layer...</p>
        </div>
      )}
      <style>{`
        .flutter-tracking-frame { position: relative; width: 100%; height: 100%; min-height: 420px; overflow: hidden; background: #f8fafc; }
        .flutter-tracking-frame__iframe { display: block; width: 100%; height: 100%; min-height: 420px; border: 0; background: #f8fafc; }
        .flutter-tracking-frame__missing { min-height: 420px; height: 100%; display: grid; place-items: center; align-content: center; gap: 8px; padding: 24px; text-align: center; color: #1e293b; background: #f8fafc; }
        .flutter-tracking-frame__missing h3 { margin: 0; font-size: 18px; color: #0f172a; }
        .flutter-tracking-frame__missing p { max-width: 420px; margin: 0; color: #64748b; font-size: 13px; line-height: 1.5; }
        .flutter-tracking-frame__icon { font-size: 38px; }
      `}</style>
    </section>
  );
}
