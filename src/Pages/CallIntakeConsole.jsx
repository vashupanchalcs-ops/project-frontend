import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const BASE = "http://127.0.0.1:8000";

const initialForm = {
  caller_name: "",
  caller_email: "",
  city: "",
  district: "",
  landmark: "",
  from_number: "",
  confirm_digit: "2",
};

export default function CallIntakeConsole() {
  const navigate = useNavigate();
  const [hotline, setHotline] = useState("8882128534");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/bookings/voice/hotline/`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.hotline_number) setHotline(String(d.hotline_number));
      })
      .catch(() => {});
  }, []);

  const onChange = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatusMsg("");
    const email = String(form.caller_email || "").trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!form.caller_name || !form.city || !form.district || !form.landmark || !form.from_number || !email) {
      setError("Please fill all fields (including Gmail) before confirm.");
      return;
    }
    if (!emailOk) {
      setError("Please enter a valid Gmail/email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/bookings/voice/direct-booking/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Call intake failed.");

      if (data.status === "cancelled") {
        setStatusMsg("Caller pressed 1. Request cancelled.");
        setSubmitting(false);
        return;
      }
      navigate("/Requests", {
        state: {
          flashMsg: `Voice booking #${data.booking_id} created from hotline ${hotline}.`,
        },
      });
    } catch (err) {
      setError(err.message || "Unable to process request.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        .ci-root{
          min-height:100vh;
          padding:64px 0 0 64px;
          background:var(--sr-bg,#f7f7f2);
          color:#111;
          font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
        }
        .ci-wrap{
          max-width:1100px;
          margin:0 auto;
          padding:22px 18px 86px;
          display:grid;
          gap:14px;
        }
        .ci-hero{
          border:1px solid rgba(20,20,20,0.12);
          border-radius:22px;
          padding:18px;
          background:linear-gradient(145deg,#fff 0%,#f8fbe0 100%);
        }
        .ci-pill{
          display:inline-flex;
          border:1px solid rgba(214,232,0,0.9);
          background:#d6e800;
          color:#111;
          border-radius:999px;
          padding:5px 12px;
          font-size:10px;
          font-weight:800;
          letter-spacing:1px;
          text-transform:uppercase;
        }
        .ci-title{
          margin:10px 0 6px;
          font-size:clamp(34px,6vw,64px);
          line-height:.92;
          letter-spacing:-1px;
          font-family:Georgia,"Times New Roman",serif;
        }
        .ci-sub{
          margin:0;
          font-size:14px;
          color:rgba(17,17,17,0.72);
          line-height:1.6;
        }
        .ci-hotline{
          margin-top:10px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          border:1px solid rgba(20,20,20,0.15);
          background:#fff;
          padding:8px 12px;
          border-radius:10px;
          font-size:13px;
          font-weight:700;
        }
        .ci-card{
          border:1px solid rgba(20,20,20,0.12);
          border-radius:18px;
          background:#fff;
          padding:16px;
        }
        .ci-grid{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }
        .ci-field{
          display:grid;
          gap:5px;
        }
        .ci-field label{
          font-size:11px;
          font-weight:800;
          text-transform:uppercase;
          letter-spacing:.8px;
          color:rgba(17,17,17,0.62);
        }
        .ci-input{
          border:1px solid rgba(20,20,20,0.14);
          border-radius:10px;
          background:#fffef8;
          color:#111;
          font-size:14px;
          padding:10px 12px;
          outline:none;
          font-family:inherit;
        }
        .ci-input:focus{
          border-color:rgba(214,232,0,0.95);
          box-shadow:0 0 0 2px rgba(214,232,0,0.25);
        }
        .ci-confirm{
          margin-top:10px;
          border:1px solid rgba(20,20,20,0.12);
          border-radius:12px;
          padding:10px;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          background:#fbfce8;
        }
        .ci-radio{
          display:inline-flex;
          align-items:center;
          gap:7px;
          border:1px solid rgba(20,20,20,0.15);
          background:#fff;
          border-radius:999px;
          padding:7px 10px;
          font-size:12px;
          font-weight:700;
          cursor:pointer;
        }
        .ci-actions{
          margin-top:12px;
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }
        .ci-btn{
          border:1px solid rgba(20,20,20,0.15);
          border-radius:10px;
          background:#fff;
          color:#111;
          padding:10px 14px;
          font-size:12px;
          font-weight:800;
          cursor:pointer;
          font-family:inherit;
        }
        .ci-btn.main{
          background:#d6e800;
          border-color:#d6e800;
        }
        .ci-err{
          margin-top:8px;
          border:1px solid rgba(176,0,32,0.26);
          background:#fff3f6;
          color:#b00020;
          border-radius:10px;
          font-size:12px;
          font-weight:700;
          padding:8px 10px;
        }
        .ci-ok{
          margin-top:8px;
          border:1px solid rgba(22,163,74,0.3);
          background:#effdf4;
          color:#166534;
          border-radius:10px;
          font-size:12px;
          font-weight:700;
          padding:8px 10px;
        }
        @media(max-width:767px){
          .ci-root{padding-left:0;padding-bottom:80px;}
          .ci-wrap{padding:14px 10px 96px;}
          .ci-grid{grid-template-columns:1fr;}
        }
      `}</style>

      <div className="ci-root">
        <div className="ci-wrap">
          <section className="ci-hero">
            <span className="ci-pill">Voice Booking Console</span>
            <h1 className="ci-title">Call Intake</h1>
            <p className="ci-sub">
              Incoming call details yahan capture karo. Confirm digit <strong>2</strong> se booking create hogi
              aur same admin booking workflow me push ho jayegi.
            </p>
            <div className="ci-hotline">Hotline Number: {hotline}</div>
          </section>

          <form className="ci-card" onSubmit={onSubmit}>
            <div className="ci-grid">
              <div className="ci-field">
                <label>Patient Name</label>
                <input className="ci-input" value={form.caller_name} onChange={(e) => onChange("caller_name", e.target.value)} placeholder="e.g. Ravi" />
              </div>
              <div className="ci-field">
                <label>Incoming Caller Number</label>
                <input className="ci-input" value={form.from_number} onChange={(e) => onChange("from_number", e.target.value)} placeholder="e.g. 8882128534" />
              </div>
              <div className="ci-field">
                <label>Caller Gmail</label>
                <input className="ci-input" value={form.caller_email} onChange={(e) => onChange("caller_email", e.target.value)} placeholder="e.g. ravi@gmail.com" />
              </div>
              <div className="ci-field">
                <label>City</label>
                <input className="ci-input" value={form.city} onChange={(e) => onChange("city", e.target.value)} placeholder="e.g. Loni" />
              </div>
              <div className="ci-field">
                <label>District</label>
                <input className="ci-input" value={form.district} onChange={(e) => onChange("district", e.target.value)} placeholder="e.g. Ghaziabad" />
              </div>
              <div className="ci-field" style={{ gridColumn: "1 / -1" }}>
                <label>Landmark</label>
                <input className="ci-input" value={form.landmark} onChange={(e) => onChange("landmark", e.target.value)} placeholder="e.g. Banthla Chowk" />
              </div>
            </div>

            <div className="ci-confirm">
              <label className="ci-radio">
                <input type="radio" name="confirm_digit" value="2" checked={form.confirm_digit === "2"} onChange={(e) => onChange("confirm_digit", e.target.value)} />
                Caller pressed 2 (Confirm Booking)
              </label>
              <label className="ci-radio">
                <input type="radio" name="confirm_digit" value="1" checked={form.confirm_digit === "1"} onChange={(e) => onChange("confirm_digit", e.target.value)} />
                Caller pressed 1 (Cancel Booking)
              </label>
            </div>

            <div className="ci-actions">
              <button className="ci-btn main" type="submit" disabled={submitting}>
                {submitting ? "Processing..." : "Submit Call Response"}
              </button>
              <button className="ci-btn" type="button" onClick={() => setForm(initialForm)}>
                Reset Form
              </button>
              <button className="ci-btn" type="button" onClick={() => navigate("/Requests")}>
                Open Booking Requests
              </button>
            </div>

            {error ? <div className="ci-err">{error}</div> : null}
            {statusMsg ? <div className="ci-ok">{statusMsg}</div> : null}
          </form>
        </div>
      </div>
    </>
  );
}
