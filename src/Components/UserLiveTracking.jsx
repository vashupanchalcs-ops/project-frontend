/**
 * UserLiveTracking.jsx
 * Background polling only; it does not render a floating card or UI.
 * Confirmed bookings appear in the My Bookings page card.
 */
import { useEffect } from "react";

const BASE = "http://127.0.0.1:8000";

export default function UserLiveTracking() {
  const email = localStorage.getItem("user") || "";
  const name  = localStorage.getItem("name") || "";
  const role  = localStorage.getItem("role");

  useEffect(() => {
    if (role === "admin" || role === "driver") return;

    const poll = async () => {
      try {
        const res  = await fetch(`${BASE}/api/bookings/`);
        const data = await res.json();
        const confirmed = data.find(b =>
          (b.booked_by_email === email || b.user_email === email || b.booked_by === name) &&
          b.status === "confirmed" &&
          b.sent_to_driver
        );
        if (confirmed) {
          localStorage.setItem("active_confirmed_booking", JSON.stringify(confirmed));
        } else {
          localStorage.removeItem("active_confirmed_booking");
        }
      } catch {}
    };

    poll();
    const t = setInterval(poll, 8000);
    return () => clearInterval(t);
  }, [email, name, role]);

  return null;
}
