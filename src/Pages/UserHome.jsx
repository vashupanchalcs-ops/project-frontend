import { Ambulance, ArrowRight, MapPin, X, Navigation, CheckCircle } from "lucide-react";
import AMBULANCE_IMAGE from "../assets/ambulance.jpg";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { readFetchCache } from "../utils/fetchCache";

const BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://swiftrescue-backend-shlb.onrender.com")).replace(/\/+$/, "");

export default function UserHome() {
  const navigate = useNavigate();
  const [ambulances, setAmbulances] = useState(() => readFetchCache(`${BASE}/api/ambulances/`) ?? []);
  const [hospitals, setHospitals] = useState(() => readFetchCache(`${BASE}/api/hospitals/`) ?? []);

  // Direct Booking Card Modal state
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationMode, setLocationMode] = useState("gps");
  const [locationPermission, setLocationPermission] = useState("prompt");
  const [confirmedPickup, setConfirmedPickup] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    pickup_address: "",
    patient_contact_number: localStorage.getItem("phone") || "",
    booking_for_other: false,
  });

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch(`${BASE}/api/ambulances/`).then((response) => (response.ok ? response.json() : [])),
      fetch(`${BASE}/api/hospitals/`).then((response) => (response.ok ? response.json() : [])),
    ]).then(([fleetResult, hospitalsResult]) => {
      if (!active) return;
      if (fleetResult.status === "fulfilled" && Array.isArray(fleetResult.value)) setAmbulances(fleetResult.value);
      if (hospitalsResult.status === "fulfilled" && Array.isArray(hospitalsResult.value)) setHospitals(hospitalsResult.value);
    });
    return () => { active = false; };
  }, []);

  const availableAmbulances = useMemo(
    () => ambulances.filter((item) => String(item.status || "").toLowerCase() === "available").length,
    [ambulances]
  );

  const requestPickupLocation = () => {
    if (!navigator.geolocation) {
      setLocationPermission("denied");
      setLocationMode("manual");
      setLocationMessage("GPS not supported on this device. Please enter address manually.");
      return;
    }
    setLocationPermission("requesting");
    setLocationMessage("Detecting your GPS location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2`);
          const data = await res.json().catch(() => ({}));
          const label = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setConfirmedPickup({ lat, lng, source: "gps", label });
          setLocationPermission("granted");
          setLocationMessage("Location confirmed via GPS.");
        } catch {
          setConfirmedPickup({ lat, lng, source: "gps", label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
          setLocationPermission("granted");
          setLocationMessage("Location confirmed.");
        }
      },
      (err) => {
        setLocationPermission("denied");
        setLocationMode("manual");
        setLocationMessage(err.code === 1 ? "Location permission denied. Enter your pickup address manually." : "GPS signal unavailable. Please enter address manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const confirmManualPickup = async () => {
    const q = form.pickup_address.trim();
    if (!q) {
      showToast("Please enter a pickup address", "err");
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", India")}&format=jsonv2&limit=1&countrycodes=in`);
      const data = await res.json().catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        setConfirmedPickup({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          source: "manual",
          label: item.display_name,
        });
        setLocationMessage("Address found and confirmed.");
      } else {
        setConfirmedPickup({ lat: 28.6139, lng: 77.2090, source: "manual", label: q });
        setLocationMessage("Address noted.");
      }
    } catch {
      setConfirmedPickup({ lat: 28.6139, lng: 77.2090, source: "manual", label: q });
    } finally {
      setGeocoding(false);
    }
  };

  const submitBooking = async () => {
    if (!form.patient_contact_number.trim()) {
      showToast("Contact number is required.", "err");
      return;
    }
    if (!confirmedPickup && !form.pickup_address.trim()) {
      showToast("Please provide or confirm pickup location.", "err");
      return;
    }

    setLoading(true);
    try {
      const user = localStorage.getItem("name") || "User";
      const email = localStorage.getItem("user") || "";
      const pickupCoords = confirmedPickup || { lat: 28.6139, lng: 77.2090 };
      const pickupLocation = confirmedPickup?.label || form.pickup_address.trim() || "Current location";

      const res = await fetch(`${BASE}/api/bookings/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambulance_id: 0,
          ambulance_number: "",
          driver: "",
          driver_contact: "",
          booked_by: user,
          booked_by_email: email,
          pickup_location: pickupLocation,
          pickup_latitude: pickupCoords.lat,
          pickup_longitude: pickupCoords.lng,
          patient_contact_number: form.patient_contact_number.trim(),
          status: "pending",
          destination: "",
        }),
      });

      if (res.ok) {
        const created = await res.json().catch(() => null);
        showToast("Booking submitted successfully! Live tracking active.", "ok");
        setShowModal(false);

        // Prepend immediately to my_bookings_cache so MyBookings displays without delay
        if (created?.id) {
          try {
            const existing = JSON.parse(sessionStorage.getItem("my_bookings_cache") || "[]");
            const newEntry = {
              ...created,
              id: created.id,
              status: created.status || "pending",
              booked_by: user,
              booked_by_email: email,
              pickup_location: pickupLocation,
              patient_contact_number: form.patient_contact_number.trim(),
              created_at: new Date().toISOString(),
            };
            sessionStorage.setItem("my_bookings_cache", JSON.stringify([newEntry, ...existing.filter(b => b.id !== created.id)]));
          } catch {}
        }

        window.dispatchEvent(new Event("new-booking"));
        navigate("/MyBookings", {
          state: {
            flashMsg: `Emergency booking #${created?.id || ""} is submitted. Live tracking is available.`,
            bookingId: created?.id,
            newBooking: created,
          },
        });
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Booking failed. Please try again.", "err");
      }
    } catch {
      showToast("Server error. Please try again.", "err");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="uh-root">
      <style>{`
        .uh-root {
          min-height: 100vh;
          padding: 64px 0 0 64px;
          background: #ffffff;
          color: #163028;
          font-family: "Outfit", "Segoe UI", sans-serif;
        }
        .uh-stage {
          box-sizing: border-box;
          min-height: calc(100vh - 64px);
          max-width: 1560px;
          margin: 0 auto;
          padding: clamp(38px, 7vh, 96px) clamp(28px, 5vw, 80px);
          display: grid;
          grid-template-columns: minmax(720px, 1.08fr) minmax(420px, .92fr);
          align-items: center;
          gap: clamp(30px, 6vw, 100px);
        }
        .uh-copy { min-width: 0; }
        .uh-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          color: #126f1e;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .11em;
          text-transform: uppercase;
        }
        .uh-kicker::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #f59a23; }
        .uh-title { max-width: 640px; margin: 0; color: #163028; font-size: clamp(42px, 5.2vw, 76px); font-weight: 750; letter-spacing: -.055em; line-height: 1.04; }
        .uh-title span { color: #126f1e; }
        .uh-sub { max-width: 550px; margin: 18px 0 0; color: #587066; font-size: clamp(15px, 1.5vw, 19px); line-height: 1.55; }
        .uh-data { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
        .uh-data-chip { display: inline-flex; align-items: center; gap: 7px; border: 1px solid #cde3d1; border-radius: 999px; padding: 7px 10px; background: #ffffff; color: #126f1e; font-size: 11px; font-weight: 700; }
        .uh-data-chip.accent { border-color: #f8d5a4; color: #a55b08; }
        .uh-booking-card { width: min(720px, 100%); display: grid; grid-template-columns: 1fr; align-items: center; margin-top: 28px; padding: 8px; border: 1px solid #cde3d1; border-radius: 14px; background: #ffffff; cursor: pointer; transition: border-color 0.2s; }
        .uh-booking-card:hover { border-color: #126f1e; }
        .uh-location { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; }
        .uh-location-icon { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border-radius: 50%; background: #e9f4eb; color: #126f1e; }
        .uh-location-icon.drop { background: #fff2df; color: #c97108; }
        .uh-location b { display: block; overflow: hidden; color: #2c493d; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .uh-location span { display: block; margin-top: 3px; color: #111111; font-size: 10px; line-height: 1.35; white-space: normal; }
        .uh-book-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 22px; border: 1px solid #f59a23; border-radius: 9px; background: #f59a23; color: #111111; font: 750 13px inherit; white-space: nowrap; cursor: pointer; }
        .uh-book-btn:hover { background: #e08b1c; border-color: #e08b1c; }
        .uh-book-cta { width: min(320px, 100%); margin-top: 12px; }
        .uh-visual { position: relative; min-height: clamp(320px, 34vw, 470px); overflow: hidden; border-radius: 42% 42% 12px 42%; background: #eaf1eb; }
        .uh-visual img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
        .uh-visual::after { content: ""; position: absolute; inset: 0; background: linear-gradient(120deg, rgba(18,111,30,.04), transparent 58%, rgba(245,154,35,.12)); pointer-events: none; }
        .uh-visual-label { position: absolute; right: 20px; bottom: 20px; z-index: 1; display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 9px 12px; background: rgba(255,255,255,.94); color: #126f1e; box-shadow: 0 7px 18px rgba(18,111,30,.14); font-size: 11px; font-weight: 800; }
        .uh-visual-label svg { color: #f59a23; }

        /* Direct Modal Styles */
        .uh-modal-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(10, 20, 15, 0.45);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
        .uh-modal-box {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #cde3d1;
          box-shadow: 0 24px 64px rgba(18, 111, 30, 0.12);
          width: min(540px, 100%);
          padding: 28px 26px;
          box-sizing: border-box;
          animation: uh-modal-in 0.22s ease-out;
        }
        @keyframes uh-modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .uh-modal-head {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px;
        }
        .uh-modal-head h3 { margin: 0; font-size: 22px; font-weight: 800; color: #163028; }
        .uh-modal-head p { margin: 4px 0 0; font-size: 13px; color: #587066; }
        .uh-close-btn { border: none; background: #f1f5f2; border-radius: 50%; width: 32px; height: 32px; display: grid; place-items: center; cursor: pointer; color: #333; }
        .uh-close-btn:hover { background: #e2e8e4; }
        .uh-field { margin-bottom: 16px; }
        .uh-field label { display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #163028; margin-bottom: 6px; }
        .uh-input {
          width: 100%; box-sizing: border-box;
          border: 1.5px solid #d4dfd7; border-radius: 10px;
          padding: 11px 14px; font-size: 14px; outline: none;
          color: #111111; background: #ffffff;
          transition: border-color 0.15s;
        }
        .uh-input:focus { border-color: #126f1e; }
        .uh-loc-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .uh-gps-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 14px; border-radius: 8px; border: 1px solid #f59a23;
          background: #f59a23; color: #111; font-weight: 750; font-size: 12px; cursor: pointer;
        }
        .uh-gps-btn:hover { background: #e08b1c; }
        .uh-loc-note { font-size: 12px; color: #126f1e; margin-top: 6px; display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .uh-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; }
        .uh-cancel-btn {
          padding: 10px 18px; border-radius: 9px; border: 1px solid #d4dfd7;
          background: #fff; color: #333; font-weight: 700; font-size: 13px; cursor: pointer;
        }
        .uh-submit-btn {
          padding: 10px 24px; border-radius: 9px; border: 1px solid #f59a23;
          background: #f59a23; color: #111; font-weight: 800; font-size: 13px; cursor: pointer;
        }
        .uh-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .uh-toast {
          position: fixed; top: 76px; right: 24px; z-index: 99999;
          padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 700;
          color: #fff; background: #126f1e; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .uh-toast.err { background: #dc2626; }

        @media (max-width: 960px) {
          .uh-stage { grid-template-columns: 1fr; padding: 48px 42px 72px; }
          .uh-visual { min-height: 320px; max-width: 700px; width: 100%; }
        }
        @media (max-width: 720px) {
          .uh-root { padding-left: 0; padding-bottom: 74px; }
          .uh-stage { min-height: calc(100vh - 64px); padding: 36px 16px 88px; gap: 34px; }
          .uh-title { font-size: clamp(38px, 12vw, 56px); }
          .uh-booking-card { padding: 8px; }
          .uh-book-cta { width: 100%; }
          .uh-visual { min-height: 250px; border-radius: 32% 32% 10px 32%; }
        }
      `}</style>

      {toast && <div className={`uh-toast ${toast.type}`}>{toast.msg}</div>}

      <section className="uh-stage" aria-label="Book an ambulance">
        <div className="uh-copy">
          <div className="uh-kicker">Aarogya emergency response</div>
          <h1 className="uh-title">Emergency care, <span>right when you need it.</span></h1>
          <p className="uh-sub">Book a verified ambulance and reach a ready hospital with a clear, real-time response flow.</p>
          <div className="uh-data" aria-label="Live availability">
            <span className="uh-data-chip"><Ambulance size={14} />{availableAmbulances} ambulance{availableAmbulances === 1 ? "" : "s"} ready</span>
            <span className="uh-data-chip accent">{hospitals.length} hospital partner{hospitals.length === 1 ? "" : "s"}</span>
          </div>
          <div className="uh-booking-card" onClick={() => setShowModal(true)}>
            <div className="uh-location">
              <span className="uh-location-icon"><MapPin size={17} /></span>
              <div>
                <b>{confirmedPickup?.label || "Pickup location"}</b>
                <span>{confirmedPickup ? "Location confirmed • Click to change" : "Click here to share pickup and book ambulance directly"}</span>
              </div>
            </div>
          </div>
          <button className="uh-book-btn uh-book-cta" onClick={() => setShowModal(true)}>
            Book Ambulance <ArrowRight size={16} />
          </button>
        </div>
        <div className="uh-visual" aria-hidden="true">
          <img src={AMBULANCE_IMAGE} alt="" />
          <span className="uh-visual-label"><Ambulance size={16} />24/7 emergency support</span>
        </div>
      </section>

      {/* Direct Booking Card Modal */}
      {showModal && (
        <div className="uh-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="uh-modal-box">
            <div className="uh-modal-head">
              <div>
                <h3>Book an ambulance</h3>
                <p>Share your pickup location and contact number.</p>
              </div>
              <button className="uh-close-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div className="uh-field">
              <div className="uh-loc-row">
                <span style={{ fontSize: 13, fontWeight: 700, color: "#163028" }}>Pickup Location</span>
                <button
                  type="button"
                  className="uh-gps-btn"
                  disabled={locationPermission === "requesting"}
                  onClick={requestPickupLocation}
                >
                  <Navigation size={13} />
                  {locationPermission === "requesting" ? "Detecting GPS..." : "Use current location"}
                </button>
              </div>

              <input
                className="uh-input"
                value={form.pickup_address}
                onChange={(e) => setForm(prev => ({ ...prev, pickup_address: e.target.value }))}
                placeholder="Or enter pickup address / landmark manually"
                onBlur={confirmManualPickup}
              />
              {confirmedPickup && (
                <div className="uh-loc-note">
                  <CheckCircle size={14} color="#126f1e" />
                  <span>{confirmedPickup.label.slice(0, 75)}...</span>
                </div>
              )}
              {locationMessage && !confirmedPickup && (
                <div style={{ fontSize: 12, color: "#a55b08", marginTop: 4 }}>{locationMessage}</div>
              )}
            </div>

            <div className="uh-field">
              <label>Contact Number</label>
              <input
                className="uh-input"
                type="tel"
                value={form.patient_contact_number}
                onChange={(e) => setForm(prev => ({ ...prev, patient_contact_number: e.target.value }))}
                placeholder="10-digit mobile number"
              />
            </div>

            <div className="uh-modal-actions">
              <button className="uh-cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="uh-submit-btn"
                disabled={loading || geocoding}
                onClick={submitBooking}
              >
                {loading ? "Submitting..." : geocoding ? "Resolving..." : "Submit Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
