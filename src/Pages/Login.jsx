import { UserPlus, ChevronsRight, Mail, ArrowLeft, Truck, Shield, User } from "lucide-react";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";

const ADMIN_EMAILS = ["vashupanchal.cs@gmail.com"];

const RoleCard = ({ icon: Icon, title, desc, color, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`lg-role-card ${selected ? "on" : ""}`}
    style={{ "--role-c": color }}
  >
    <div className="lg-role-icon"><Icon size={15} /></div>
    <div className="lg-role-title">{title}</div>
    <div className="lg-role-desc">{desc}</div>
  </button>
);

const Login = () => {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [role, setRole] = useState("user");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [ambulances, setAmbulances] = useState([]);
  const [selectedAmb, setSelectedAmb] = useState(null);
  const [ambLoading, setAmbLoading] = useState(false);

  const totalSteps = role === "driver" ? 3 : 2;

  useEffect(() => {
    if (role !== "driver") return;
    setAmbLoading(true);
    fetch("http://127.0.0.1:8000/api/ambulances/")
      .then(r => r.json())
      .then(data => { setAmbulances(data); setAmbLoading(false); })
      .catch(() => setAmbLoading(false));
  }, [role]);

  const sendEmailOtp = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!name.trim()) { alert("Naam daalo pehle!"); return; }
    if (!email.trim()) { alert("Email daalo pehle!"); return; }
    if (role === "driver" && phone.length !== 10) { alert("10-digit phone number daalo"); return; }
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/send-otp/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.status === "otp_sent") setStep(2);
      else alert(data.message || "OTP send nahi hua");
    } catch (err) { alert(`Server se connect nahi: ${err.message}`); }
    setLoading(false);
  };

  const verifyEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailOtp.trim() || emailOtp.length !== 6) { alert("6-digit OTP daalo"); return; }
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/verify-otp/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: emailOtp.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (data.status === "success") {
        const finalRole = ADMIN_EMAILS.includes(data.email) ? "admin" : role;
        localStorage.setItem("user", data.email);
        localStorage.setItem("name", name);
        localStorage.setItem("role", finalRole);
        if (finalRole === "driver") { localStorage.setItem("phone", phone); setStep(3); }
        else navigate("/");
      } else alert(data.message || "Invalid OTP");
    } catch (err) { alert("Server error: " + err.message); }
    setLoading(false);
  };

  const confirmAmbulance = async () => {
    if (!selectedAmb) return;
    localStorage.setItem("ambulance_id", String(selectedAmb.id));
    localStorage.setItem("ambulance_number", selectedAmb.ambulance_number);
    try {
      await fetch(`http://127.0.0.1:8000/api/ambulances/${selectedAmb.id}/`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver: name, driver_contact: phone, driver_email: email }),
      });
    } catch {}
    navigate("/");
  };

  const roleColor = { user: "#4ea8ff", driver: "#d7b56d", admin: "#ff6b2b" };
  const rc = roleColor[role];

  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".lg-noise", { autoAlpha: 0, duration: 0.7, ease: "power2.out" });
      gsap.from(".lg-orb", { scale: 0.84, autoAlpha: 0, stagger: 0.08, duration: 1.05, ease: "power3.out" });
      gsap.from(".lg-shell", { y: 32, autoAlpha: 0, duration: 0.9, ease: "power3.out" });
      gsap.from(".lg-shell > *", { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.06, delay: 0.18, ease: "power2.out" });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!rootRef.current) return;
    gsap.fromTo(
      ".lg-title, .lg-subtitle, .lg-form, .lg-verified",
      { y: 16, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.52, stagger: 0.05, ease: "power2.out" }
    );
  }, [step, role]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap');
        * { box-sizing: border-box; }

        .lg-root {
          height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px 16px;
          background:
            radial-gradient(circle at 14% 10%, rgba(255,90,80,0.2), transparent 34%),
            radial-gradient(circle at 86% 8%, rgba(78,168,255,0.12), transparent 34%),
            linear-gradient(125deg, #120f16 0%, #141c2b 46%, #111826 100%);
          position: relative;
          overflow: hidden;
          font-family: 'Manrope', sans-serif;
        }

        .lg-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 30px 30px;
          mix-blend-mode: soft-light;
          opacity: 0.38;
        }

        .lg-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(44px);
        }
        .lg-orb.a { width: 360px; height: 360px; top: -130px; right: -100px; background: rgba(255,107,43,0.22); }
        .lg-orb.b { width: 300px; height: 300px; bottom: -120px; left: -80px; background: rgba(78,168,255,0.16); }

        .lg-shell {
          width: min(100%, 960px);
          background: rgba(7, 11, 18, 0.9);
          border: 1px solid rgba(220, 236, 255, 0.14);
          box-shadow: 0 28px 72px rgba(0,0,0,0.52);
          backdrop-filter: blur(14px);
          border-radius: 24px;
          max-height: calc(100vh - 48px);
          overflow: hidden;
          scrollbar-width: none;
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(260px, 1fr) minmax(360px, 1.15fr);
        }
        .lg-shell::-webkit-scrollbar { display: none; }

        .lg-side {
          position: relative;
          min-height: 100%;
          padding: 26px 22px;
          background:
            radial-gradient(circle at 35% 20%, rgba(185,105,255,0.64) 0%, rgba(103,56,255,0.38) 34%, transparent 64%),
            linear-gradient(180deg, #0d0f17 0%, #111726 100%);
          border-right: 1px solid rgba(220, 236, 255, 0.12);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .lg-side::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 26px 26px;
          mix-blend-mode: soft-light;
          opacity: 0.36;
        }
        .lg-side-top, .lg-side-bottom { position: relative; z-index: 1; }
        .lg-side-brand {
          color: #efe4d4;
          font-family: 'Fraunces', serif;
          font-size: 20px;
          margin-bottom: 14px;
        }
        .lg-side-kicker {
          color: rgba(239,228,212,0.66);
          font-size: 11px;
          letter-spacing: 1.2px;
          text-transform: uppercase;
        }
        .lg-side-title {
          margin-top: 22px;
          font-family: 'Fraunces', serif;
          font-size: 36px;
          color: #fff;
          line-height: 1.05;
          letter-spacing: -0.6px;
        }
        .lg-side-title em {
          display: block;
          color: #c899ff;
          font-style: normal;
        }
        .lg-side-sub {
          margin-top: 12px;
          font-size: 13px;
          line-height: 1.65;
          color: rgba(235,245,255,0.7);
          max-width: 30ch;
        }
        .lg-side-steps { margin-top: 22px; display: flex; flex-direction: column; gap: 9px; }
        .lg-side-step {
          border: 1px solid rgba(235,245,255,0.14);
          background: rgba(8, 14, 24, 0.54);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 12px;
          color: rgba(235,245,255,0.7);
        }
        .lg-side-step.on {
          background: rgba(255,255,255,0.88);
          color: #111826;
          border-color: rgba(255,255,255,0.95);
          font-weight: 700;
        }
        .lg-side-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 16px;
        }
        .lg-side-stat {
          border: 1px solid rgba(235,245,255,0.16);
          background: rgba(8,14,24,0.5);
          border-radius: 10px;
          padding: 10px 8px;
          text-align: center;
        }
        .lg-side-stat-val { font-size: 22px; font-weight: 800; color: #fff; line-height: 1; }
        .lg-side-stat-lbl {
          margin-top: 4px;
          font-size: 9px;
          letter-spacing: 1.1px;
          color: rgba(235,245,255,0.62);
          text-transform: uppercase;
        }

        .lg-panel {
          padding: 28px;
          overflow-y: auto;
          max-height: calc(100vh - 48px);
          scrollbar-width: none;
        }
        .lg-panel::-webkit-scrollbar { display: none; }

        .lg-brand {
          font-family: 'Fraunces', serif;
          color: #f1e6d2;
          font-size: 23px;
          letter-spacing: 0.4px;
          margin-bottom: 3px;
        }
        .lg-brand-sub {
          font-size: 11px;
          color: rgba(241,230,210,0.56);
          text-transform: uppercase;
          letter-spacing: 1.3px;
          margin-bottom: 16px;
        }

        .lg-step-badge { font-size: 11px; color: rgba(241,230,210,0.56); margin-bottom: 6px; }
        .lg-step-badge span { color: rgba(241,230,210,0.9); font-weight: 600; }
        .lg-step-bar { display: flex; gap: 4px; margin-bottom: 22px; }
        .lg-pip { height: 3px; flex: 1; background: rgba(241,230,210,0.12); transition: background .25s; border-radius: 999px; }
        .lg-pip.active { background: #ff6b2b; }
        .lg-pip.done { background: rgba(255,107,43,0.45); }

        .lg-icon-wrap {
          width: 44px; height: 44px;
          background: rgba(255,92,82,0.18);
          border: 1px solid rgba(255,92,82,0.4);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 12px;
          border-radius: 12px;
        }

        .lg-title {
          font-family: 'Fraunces', serif;
          font-size: 42px;
          color: #f7f1e5;
          margin-bottom: 6px;
          line-height: 1;
          letter-spacing: -0.6px;
        }
        .lg-subtitle {
          font-size: 14px;
          color: rgba(235,245,255,0.66);
          margin-bottom: 22px;
        }
        .lg-subtitle strong { color: rgba(241,230,210,0.95); }

        .lg-form { display: flex; flex-direction: column; gap: 12px; }
        .lg-role-row { display: flex; gap: 8px; margin-bottom: 4px; }

        .lg-role-card {
          flex: 1;
          border: 1px solid rgba(235,245,255,0.14);
          background: rgba(255,255,255,0.02);
          padding: 12px 8px;
          cursor: pointer;
          color: rgba(235,245,255,0.58);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          border-radius: 14px;
          transition: all .16s;
        }
        .lg-role-card.on {
          border-color: color-mix(in srgb, var(--role-c) 70%, #d8e8ff 30%);
          background: color-mix(in srgb, var(--role-c) 16%, transparent);
          box-shadow: 0 12px 24px color-mix(in srgb, var(--role-c) 22%, transparent);
          color: #fff;
        }
        .lg-role-icon {
          width: 34px;
          height: 34px;
          border: 1px solid rgba(235,245,255,0.18);
          display: grid;
          place-items: center;
          border-radius: 999px;
        }
        .lg-role-card.on .lg-role-icon {
          border-color: color-mix(in srgb, var(--role-c) 65%, #d8e8ff 35%);
          color: var(--role-c);
          background: color-mix(in srgb, var(--role-c) 18%, transparent);
        }
        .lg-role-title { font-size: 11px; font-weight: 700; letter-spacing: 0.2px; }
        .lg-role-desc { font-size: 9px; color: rgba(235,245,255,0.4); text-align: center; line-height: 1.4; }

        .lg-field { display: flex; flex-direction: column; gap: 6px; }
        .lg-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.1px;
          text-transform: uppercase;
          color: rgba(241,230,210,0.66);
        }
        .lg-input {
          background: rgba(214, 230, 255, 0.05);
          border: 1px solid rgba(214, 230, 255, 0.2);
          padding: 12px 13px;
          font-size: 14px;
          color: #edf5ff;
          outline: none;
          width: 100%;
          border-radius: 12px;
          transition: border-color .2s, background .2s, box-shadow .2s;
        }
        .lg-input::placeholder { color: rgba(214,230,255,0.24); }
        .lg-input:focus {
          border-color: rgba(255,107,43,0.52);
          background: rgba(255,107,43,0.06);
          box-shadow: 0 0 0 3px rgba(255,107,43,0.16);
        }

        .lg-phone-row { display: flex; gap: 8px; }
        .lg-prefix {
          width: 62px;
          background: rgba(214,230,255,0.05);
          border: 1px solid rgba(214,230,255,0.18);
          display: grid;
          place-items: center;
          color: rgba(235,245,255,0.56);
          font-size: 13px;
          border-radius: 12px;
        }

        .lg-otp-info {
          background: rgba(214,230,255,0.04);
          border: 1px solid rgba(214,230,255,0.14);
          padding: 10px 12px;
          font-size: 12px;
          color: rgba(235,245,255,0.62);
          display: flex;
          align-items: flex-start;
          gap: 8px;
          border-radius: 12px;
        }

        .lg-btn {
          border: none;
          cursor: pointer;
          width: 100%;
          padding: 12px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2px;
          font-family: inherit;
          border-radius: 12px;
          transition: all .18s;
        }
        .lg-btn:disabled { opacity: 0.42; cursor: not-allowed; }
        .lg-btn-red {
          background: linear-gradient(135deg, #ff4d4d 0%, #ff6b2b 58%, #ff8a3d 100%);
          color: #fff;
          box-shadow: 0 12px 24px rgba(255,88,76,0.28);
        }
        .lg-btn-red:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px); }
        .lg-btn-ghost {
          background: transparent;
          color: rgba(235,245,255,0.66);
          border: 1px solid rgba(214,230,255,0.2);
        }
        .lg-btn-ghost:hover:not(:disabled) {
          background: rgba(214,230,255,0.06);
          color: #fff;
        }

        .lg-back {
          background: none;
          border: none;
          color: rgba(235,245,255,0.54);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-size: 11px;
          padding: 0;
        }
        .lg-back:hover { color: rgba(235,245,255,0.88); }

        .lg-verified {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #53ddb2;
          background: rgba(83,221,178,0.08);
          border: 1px solid rgba(83,221,178,0.28);
          padding: 4px 10px;
          margin-bottom: 14px;
          border-radius: 999px;
        }

        .lg-amb-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 240px;
          overflow-y: auto;
        }
        .lg-amb-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(214,230,255,0.17);
          background: rgba(214,230,255,0.03);
          cursor: pointer;
          border-radius: 12px;
          transition: all .16s;
        }
        .lg-amb-item:hover {
          background: rgba(214,230,255,0.07);
          border-color: rgba(214,230,255,0.3);
        }
        .lg-amb-item.sel {
          background: rgba(215,181,109,0.12);
          border-color: rgba(215,181,109,0.45);
        }

        .lg-footer {
          text-align: center;
          margin-top: 14px;
          font-size: 11px;
          color: rgba(241,230,210,0.52);
        }

        @media (max-width: 860px) {
          .lg-shell {
            grid-template-columns: 1fr;
            width: min(100%, 560px);
          }
          .lg-side { display: none; }
          .lg-panel { max-height: calc(100vh - 48px); padding: 20px 16px; }
        }

        @media (max-width: 640px) {
          .lg-root { padding: 18px 10px; }
          .lg-panel { padding: 18px 14px; }
          .lg-title { font-size: 34px; }
          .lg-role-row { gap: 6px; }
        }
      `}</style>

      <div className="lg-root" ref={rootRef}>
        <div className="lg-noise" />
        <div className="lg-orb a" data-k72="reveal" />
        <div className="lg-orb b" data-k72="reveal" />

        <div className="lg-shell" data-k72="reveal">
          <div className="lg-side">
            <div className="lg-side-top">
              <div className="lg-side-brand">OnlySwift</div>
              <div className="lg-side-kicker">Premium Emergency Access</div>
              <div className="lg-side-title">Get started <em>with us</em></div>
              <div className="lg-side-sub">
                Secure login with role-based access, OTP verification, and driver vehicle assignment in one flow.
              </div>
              <div className="lg-side-steps">
                <div className={`lg-side-step ${step >= 1 ? "on" : ""}`}>Sign up / sign in account</div>
                <div className={`lg-side-step ${step >= 2 ? "on" : ""}`}>Verify email with OTP</div>
                {role === "driver" && <div className={`lg-side-step ${step >= 3 ? "on" : ""}`}>Select your ambulance</div>}
              </div>
            </div>
            <div className="lg-side-bottom">
              <div className="lg-side-stats">
                <div className="lg-side-stat">
                  <div className="lg-side-stat-val">24/7</div>
                  <div className="lg-side-stat-lbl">Dispatch</div>
                </div>
                <div className="lg-side-stat">
                  <div className="lg-side-stat-val">&lt;8m</div>
                  <div className="lg-side-stat-lbl">Response</div>
                </div>
                <div className="lg-side-stat">
                  <div className="lg-side-stat-val">99%</div>
                  <div className="lg-side-stat-lbl">Uptime</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg-panel">
            <div className="lg-brand">SwiftRescue</div>
            <div className="lg-brand-sub">Emergency Response Platform</div>

            <div className="lg-step-badge">Step <span>{step}</span> of <span>{totalSteps}</span></div>
            <div className="lg-step-bar">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`lg-pip ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`} />
              ))}
            </div>

          {step === 1 && (
            <>
              <div className="lg-icon-wrap" style={{ background: `${rc}16`, borderColor: `${rc}44` }}>
                <UserPlus size={18} color={rc} />
              </div>
              <div className="lg-title">Welcome back</div>
              <div className="lg-subtitle">Choose your role and sign in to continue</div>

              <form onSubmit={sendEmailOtp} className="lg-form">
                <div>
                  <div className="lg-label" style={{ marginBottom: 8 }}>I am a</div>
                  <div className="lg-role-row">
                    <RoleCard icon={User} title="User" desc="Book ambulances" color="#4ea8ff" selected={role === "user"} onClick={() => setRole("user")} />
                    <RoleCard icon={Truck} title="Driver" desc="Navigate routes" color="#d7b56d" selected={role === "driver"} onClick={() => setRole("driver")} />
                    <RoleCard icon={Shield} title="Admin" desc="Manage fleet" color="#ff6b2b" selected={role === "admin"} onClick={() => setRole("admin")} />
                  </div>
                </div>

                <div className="lg-field">
                  <label className="lg-label">Full Name</label>
                  <input className="lg-input" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Rahul Sharma" />
                </div>
                <div className="lg-field">
                  <label className="lg-label">Email Address</label>
                  <input className="lg-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                {role === "driver" && (
                  <div className="lg-field">
                    <label className="lg-label">Phone Number</label>
                    <div className="lg-phone-row">
                      <div className="lg-prefix">+91</div>
                      <input
                        className="lg-input"
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="9876543210"
                        maxLength={10}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                )}

                <button className="lg-btn lg-btn-red" disabled={loading} style={{ marginTop: 4 }}>
                  {loading ? "Sending OTP..." : "Continue ->"}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="lg-icon-wrap">
                <Mail size={18} color="#ff6b2b" />
              </div>
              <div className="lg-title">Verify Email</div>
              <div className="lg-subtitle">We sent a 6-digit code to <strong>{email}</strong></div>
              <form onSubmit={verifyEmailOtp} className="lg-form">
                <div className="lg-otp-info">
                  <ChevronsRight size={12} style={{ flexShrink: 0, color: "#ff6b2b", marginTop: 1 }} />
                  <span>Check your inbox. OTP sent to <strong style={{ color: "rgba(241,230,210,0.95)" }}>{email}</strong></span>
                </div>
                <div className="lg-field">
                  <label className="lg-label">6-Digit OTP</label>
                  <input
                    className="lg-input"
                    type="text"
                    required
                    value={emailOtp}
                    onChange={e => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    maxLength={6}
                    autoFocus
                    style={{ fontSize: 22, letterSpacing: 8, textAlign: "center" }}
                  />
                </div>
                <button className="lg-btn lg-btn-red" disabled={loading || emailOtp.length !== 6}>
                  {loading ? "Verifying..." : role === "driver" ? "Verify -> Select Ambulance" : "Verify & Login ->"}
                </button>
                <button type="button" className="lg-btn lg-btn-ghost" onClick={sendEmailOtp} disabled={loading}>
                  Resend OTP
                </button>
                <button type="button" className="lg-back" onClick={() => setStep(1)}>
                  <ArrowLeft size={12} /> Go back
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <div className="lg-icon-wrap" style={{ background: "rgba(215,181,109,0.14)", borderColor: "rgba(215,181,109,0.34)" }}>
                <Truck size={18} color="#d7b56d" />
              </div>
              <div className="lg-title">Select Ambulance</div>
              <div className="lg-subtitle">Choose your assigned vehicle to begin tracking</div>
              <div className="lg-verified">✓ Email verified · +91 {phone}</div>
              {ambLoading ? (
                <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "rgba(235,245,255,0.5)" }}>Loading ambulances...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="lg-amb-list">
                    {ambulances.map(a => {
                      const sc = { available: "#53ddb2", en_route: "#d7b56d", busy: "#ff6b6b", offline: "#9aa5b4" };
                      return (
                        <div key={a.id} className={`lg-amb-item ${selectedAmb?.id === a.id ? "sel" : ""}`} onClick={() => setSelectedAmb(a)}>
                          <div style={{ width: 32, height: 32, background: "rgba(255,107,43,0.13)", display: "grid", placeItems: "center", fontSize: 14, flexShrink: 0 }}>🚑</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#edf5ff" }}>{a.ambulance_number}</div>
                            <div style={{ fontSize: 10, color: "rgba(235,245,255,0.48)", marginTop: 1 }}>{a.location || "—"}</div>
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", color: sc[a.status] || "#9aa5b4", background: `${sc[a.status] || "#9aa5b4"}22`, border: `1px solid ${sc[a.status] || "#9aa5b4"}55`, textTransform: "uppercase", flexShrink: 0 }}>
                            {a.status?.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button className="lg-btn lg-btn-red" disabled={!selectedAmb} onClick={confirmAmbulance} style={{ marginTop: 4 }}>
                    {selectedAmb ? `Start - ${selectedAmb.ambulance_number} ->` : "Select an ambulance first"}
                  </button>
                  <button type="button" className="lg-back" style={{ justifyContent: "center" }} onClick={() => setStep(2)}>
                    <ArrowLeft size={12} /> Back
                  </button>
                </div>
              )}
            </>
          )}

            <div className="lg-footer">© {new Date().getFullYear()} SwiftRescue · Emergency Response System</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
