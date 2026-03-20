import { UserPlus, ChevronsRight, Mail, ArrowLeft, Truck, Shield, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ADMIN_EMAILS = ["vashupanchal.cs@gmail.com"];

const RoleCard = ({ icon: Icon, title, desc, color, selected, onClick }) => (
  <button type="button" onClick={onClick} style={{
    flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer",
    border: `1.5px solid ${selected ? color : "rgba(255,255,255,0.08)"}`,
    background: selected ? `${color}18` : "rgba(255,255,255,0.02)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    transition: "all 0.2s", fontFamily: "inherit", minWidth: 0,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: selected ? `${color}22` : "rgba(255,255,255,0.05)",
      border: `1px solid ${selected ? color + "55" : "rgba(255,255,255,0.08)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: selected ? color : "rgba(255,255,255,0.3)", flexShrink: 0,
      transition: "all 0.2s",
    }}>
      <Icon size={14} />
    </div>
    <div style={{ fontSize: 11, fontWeight: 700, color: selected ? color : "rgba(255,255,255,0.5)", letterSpacing: "0.3px" }}>
      {title}
    </div>
    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", textAlign: "center", lineHeight: 1.4 }}>
      {desc}
    </div>
  </button>
);

const Login = () => {
  const navigate = useNavigate();
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

  const roleColor = { user: "#3d8bff", driver: "#f7c948", admin: "#E50914" };
  const rc = roleColor[role];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lg-root {
          min-height: 100vh;
          display: flex;
          background: #0a0a0a;
          font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Ambient glow background */
        .lg-glow {
          position: fixed;
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(229,9,20,0.08) 0%, transparent 70%);
          top: -200px; right: -200px;
          pointer-events: none; z-index: 0;
        }
        .lg-glow2 {
          position: fixed;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(61,139,255,0.05) 0%, transparent 70%);
          bottom: -100px; left: -100px;
          pointer-events: none; z-index: 0;
        }

        /* Left cinematic panel */
        .lg-left {
          width: 55%;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 48px;
        }
        .lg-left-bg {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a0505 40%, #0a0a0a 100%);
        }
        .lg-left-grid {
          position: absolute; inset: 0;
          background-image: 
            linear-gradient(rgba(229,9,20,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(229,9,20,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .lg-left-content { position: relative; z-index: 1; }
        .lg-brand {
          font-family: 'Bebas Neue', cursive;
          font-size: 52px;
          color: #E50914;
          letter-spacing: 3px;
          line-height: 1;
          margin-bottom: 16px;
        }
        .lg-tagline {
          font-size: 16px;
          color: rgba(255,255,255,0.5);
          line-height: 1.6;
          max-width: 380px;
          margin-bottom: 40px;
        }
        .lg-stats {
          display: flex;
          gap: 32px;
        }
        .lg-stat-num {
          font-family: 'Bebas Neue', cursive;
          font-size: 36px;
          color: #fff;
          letter-spacing: 2px;
        }
        .lg-stat-lbl {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-top: 2px;
        }

        /* Ambulance visual */
        .lg-amb-visual {
          position: absolute;
          top: 60px; right: -40px;
          width: 380px;
          opacity: 0.12;
          filter: grayscale(1);
          pointer-events: none;
        }

        /* Right form panel */
        .lg-right {
          width: 45%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 48px;
          position: relative;
          z-index: 1;
          border-left: 1px solid rgba(255,255,255,0.05);
        }
        .lg-card {
          width: 100%;
          max-width: 400px;
        }

        /* Step indicator */
        .lg-step-badge { font-size: 11px; color: rgba(255,255,255,0.25); margin-bottom: 6px; }
        .lg-step-badge span { color: rgba(255,255,255,0.6); font-weight: 600; }
        .lg-step-bar { display: flex; gap: 4px; margin-bottom: 24px; }
        .lg-pip { height: 2px; flex: 1; border-radius: 2px; background: rgba(255,255,255,0.08); transition: background 0.3s; }
        .lg-pip.active { background: #E50914; }
        .lg-pip.done { background: rgba(229,9,20,0.4); }

        /* Icon wrap */
        .lg-icon-wrap {
          width: 44px; height: 44px; border-radius: 12px;
          background: rgba(229,9,20,0.1); border: 1px solid rgba(229,9,20,0.2);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }

        .lg-title { font-size: 24px; font-weight: 700; color: #fff; margin-bottom: 4px; letter-spacing: -0.5px; }
        .lg-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin-bottom: 24px; line-height: 1.5; }
        .lg-subtitle strong { color: rgba(255,255,255,0.65); font-weight: 600; }

        .lg-form { display: flex; flex-direction: column; gap: 12px; }
        .lg-role-row { display: flex; gap: 8px; margin-bottom: 4px; }

        .lg-field { display: flex; flex-direction: column; gap: 5px; }
        .lg-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 1px; text-transform: uppercase; }
        .lg-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 11px 14px;
          font-size: 14px; color: #fff;
          font-family: inherit; outline: none; width: 100%;
          transition: border-color 0.2s, background 0.2s;
        }
        .lg-input::placeholder { color: rgba(255,255,255,0.15); }
        .lg-input:focus { border-color: rgba(229,9,20,0.4); background: rgba(229,9,20,0.03); }

        .lg-phone-row { display: flex; gap: 8px; }
        .lg-prefix {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; padding: 11px 14px; font-size: 13px;
          color: rgba(255,255,255,0.4); width: 60px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .lg-otp-info {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px; padding: 10px 12px; font-size: 12px;
          color: rgba(255,255,255,0.35); display: flex; align-items: flex-start; gap: 8px;
        }

        .lg-btn {
          padding: 12px; border-radius: 8px; border: none;
          font-size: 13px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: all 0.2s; width: 100%;
          letter-spacing: 0.3px;
        }
        .lg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .lg-btn-red { background: #E50914; color: #fff; }
        .lg-btn-red:hover:not(:disabled) { background: #f40612; transform: translateY(-1px); }
        .lg-btn-ghost {
          background: transparent; color: rgba(255,255,255,0.35);
          border: 1px solid rgba(255,255,255,0.08); font-weight: 600;
        }
        .lg-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6); }

        .lg-back {
          background: none; border: none; color: rgba(255,255,255,0.25);
          font-size: 11px; font-family: inherit; cursor: pointer;
          display: flex; align-items: center; gap: 4px; padding: 0;
          transition: color 0.15s;
        }
        .lg-back:hover { color: rgba(255,255,255,0.5); }

        .lg-verified {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600; color: #00d4aa;
          background: rgba(0,212,170,0.08); border: 1px solid rgba(0,212,170,0.2);
          border-radius: 20px; padding: 4px 10px;
        }

        /* Ambulance picker */
        .lg-amb-list { display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
        .lg-amb-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.02); cursor: pointer;
          transition: all 0.15s;
        }
        .lg-amb-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); }
        .lg-amb-item.sel { background: rgba(247,201,72,0.07); border-color: rgba(247,201,72,0.35); }

        .lg-footer { text-align: center; margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.2); }

        @media (max-width: 900px) {
          .lg-left { display: none; }
          .lg-right { width: 100%; border-left: none; padding: 24px 20px; }
          .lg-root { background: #0a0a0a; }
        }
        @media (max-width: 480px) {
          .lg-right { padding: 20px 16px; align-items: flex-start; padding-top: 40px; }
        }
      `}</style>

      <div className="lg-root">
        <div className="lg-glow" />
        <div className="lg-glow2" />

        {/* Left Panel */}
        <div className="lg-left">
          <div className="lg-left-bg" />
          <div className="lg-left-grid" />
          <img
            src="https://nnccalcutta.in/wp-content/uploads/2022/04/166-1665783_2048x1536-ambulance-wallpapers-data-id-377442-high-quality-768x576.jpg"
            alt="" className="lg-amb-visual"
          />
          <div className="lg-left-content">
            <div className="lg-brand">SwiftRescue</div>
            <div className="lg-tagline">
              Emergency response management platform.<br />
              Every second counts — we make sure help arrives faster.
            </div>
            <div className="lg-stats">
              <div>
                <div className="lg-stat-num">24/7</div>
                <div className="lg-stat-lbl">Live Dispatch</div>
              </div>
              <div>
                <div className="lg-stat-num">&lt;8m</div>
                <div className="lg-stat-lbl">Avg Response</div>
              </div>
              <div>
                <div className="lg-stat-num">99%</div>
                <div className="lg-stat-lbl">Uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form */}
        <div className="lg-right">
          <div className="lg-card">
            <div className="lg-step-badge">Step <span>{step}</span> of <span>{totalSteps}</span></div>
            <div className="lg-step-bar">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`lg-pip ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`} />
              ))}
            </div>

            {step === 1 && (
              <>
                <div className="lg-icon-wrap" style={{ background: `${rc}12`, borderColor: `${rc}30` }}>
                  <UserPlus size={18} color={rc} />
                </div>
                <div className="lg-title">Welcome back</div>
                <div className="lg-subtitle">Choose your role and sign in to continue</div>

                <form onSubmit={sendEmailOtp} className="lg-form">
                  <div>
                    <div className="lg-label" style={{ marginBottom: 8 }}>I am a</div>
                    <div className="lg-role-row">
                      <RoleCard icon={User}   title="User"   desc="Book ambulances"  color="#3d8bff" selected={role === "user"}   onClick={() => setRole("user")} />
                      <RoleCard icon={Truck}  title="Driver" desc="Navigate routes"   color="#f7c948" selected={role === "driver"} onClick={() => setRole("driver")} />
                      <RoleCard icon={Shield} title="Admin"  desc="Manage fleet"      color="#E50914" selected={role === "admin"}  onClick={() => setRole("admin")} />
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
                        <input className="lg-input" type="tel" required value={phone}
                          onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210" maxLength={10} style={{ flex: 1 }} />
                      </div>
                    </div>
                  )}
                  <button className="lg-btn lg-btn-red" disabled={loading} style={{ marginTop: 4 }}>
                    {loading ? "Sending OTP..." : "Continue →"}
                  </button>
                </form>
              </>
            )}

            {step === 2 && (
              <>
                <div className="lg-icon-wrap">
                  <Mail size={18} color="#E50914" />
                </div>
                <div className="lg-title">Verify Email</div>
                <div className="lg-subtitle">We sent a 6-digit code to <strong>{email}</strong></div>
                <form onSubmit={verifyEmailOtp} className="lg-form">
                  <div className="lg-otp-info">
                    <ChevronsRight size={12} style={{ flexShrink: 0, color: "#E50914", marginTop: 1 }} />
                    <span>Check your inbox — OTP sent to <strong style={{ color: "rgba(255,255,255,0.6)" }}>{email}</strong></span>
                  </div>
                  <div className="lg-field">
                    <label className="lg-label">6-Digit OTP</label>
                    <input className="lg-input" type="text" required value={emailOtp}
                      onChange={e => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••" maxLength={6} autoFocus
                      style={{ fontSize: 22, letterSpacing: 8, textAlign: "center" }} />
                  </div>
                  <button className="lg-btn lg-btn-red" disabled={loading || emailOtp.length !== 6}>
                    {loading ? "Verifying..." : role === "driver" ? "Verify → Select Ambulance" : "Verify & Login →"}
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
                <div className="lg-icon-wrap" style={{ background: "rgba(247,201,72,0.1)", borderColor: "rgba(247,201,72,0.25)" }}>
                  <Truck size={18} color="#f7c948" />
                </div>
                <div className="lg-title">Select Ambulance</div>
                <div className="lg-subtitle">Choose your assigned vehicle to begin tracking</div>
                <div className="lg-verified" style={{ marginBottom: 14 }}>✓ Email verified · +91 {phone}</div>
                {ambLoading ? (
                  <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Loading ambulances...</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div className="lg-amb-list">
                      {ambulances.map(a => {
                        const sc = { available: "#00d4aa", en_route: "#f7c948", busy: "#ff4d5a", offline: "#555" };
                        return (
                          <div key={a.id} className={`lg-amb-item ${selectedAmb?.id === a.id ? "sel" : ""}`} onClick={() => setSelectedAmb(a)}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(229,9,20,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🚑</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{a.ambulance_number}</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{a.location || "—"}</div>
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: sc[a.status] || "#555", background: `${sc[a.status] || "#555"}20`, border: `1px solid ${sc[a.status] || "#555"}44`, textTransform: "uppercase", flexShrink: 0 }}>
                              {a.status?.replace("_", " ")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <button className="lg-btn lg-btn-red" disabled={!selectedAmb} onClick={confirmAmbulance} style={{ marginTop: 4 }}>
                      {selectedAmb ? `Start — ${selectedAmb.ambulance_number} →` : "Select an ambulance first"}
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
