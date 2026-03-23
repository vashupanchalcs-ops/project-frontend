import { ChevronsRight, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Signup = () => {
  const navigate  = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    const res  = await fetch("http://127.0.0.1:8000/api/signup/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.status === "success") { alert("Account created successfully"); navigate("/login"); }
    else alert(data.message);
  };

  return (
    <>
      <style>{`
        .signup-root {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          background: #111;
          padding: 20px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          box-sizing: border-box;
        }
        .signup-card {
          background: #1a1a1a;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px;
          display: flex;
          width: 100%; max-width: 820px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        }
        /* Left decorative panel */
        .signup-left {
          background: linear-gradient(135deg, #E50914 0%, #1a1a2e 100%);
          padding: 40px 32px;
          display: flex; flex-direction: column; justify-content: space-between;
          width: 45%; flex-shrink: 0;
        }
        .signup-left-icon { color: #fff; opacity: 0.9; }
        .signup-left-text h2 { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        .signup-left-text p  { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.6; }
        /* Right form panel */
        .signup-right {
          flex: 1; padding: 40px 36px;
          display: flex; flex-direction: column; justify-content: center;
          background: #1a1a1a;
        }
        .signup-icon-wrap {
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(229,9,20,0.12); border: 1px solid rgba(229,9,20,0.28);
          display: flex; align-items: center; justify-content: center; margin-bottom: 16px;
        }
        .signup-title    { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .signup-subtitle { font-size: 13px; color: rgba(255,255,255,0.38); margin-bottom: 24px; }
        .signup-form { display: flex; flex-direction: column; gap: 14px; }
        .signup-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 5px; display: block; }
        .signup-input {
          width: 100%; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
          padding: 12px 14px; font-size: 14px; color: #fff;
          font-family: inherit; outline: none;
          transition: border-color 0.2s; box-sizing: border-box;
        }
        .signup-input::placeholder { color: rgba(255,255,255,0.18); }
        .signup-input:focus { border-color: rgba(229,9,20,0.5); background: rgba(229,9,20,0.03); }
        .signup-btn {
          width: 100%; padding: 13px; border-radius: 8px; border: none;
          background: #E50914; color: #fff;
          font-size: 13px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: background 0.15s; margin-top: 4px;
        }
        .signup-btn:hover { background: #f40612; }
        .signup-footer { text-align: center; font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 16px; }
        .signup-footer a { color: #E50914; font-weight: 600; text-decoration: none; }
        .signup-footer a:hover { text-decoration: underline; }

        @media (max-width: 600px) {
          .signup-left   { display: none; }
          .signup-card   { max-width: 420px; }
          .signup-right  { padding: 32px 24px; }
        }
      `}</style>

      <div className="signup-root">
        <div className="signup-card">
          {/* Left */}
          <div className="signup-left">
            <div className="signup-left-icon"><ChevronsRight size={36} /></div>
            <div className="signup-left-text">
              <h2>Join us today</h2>
              <p>Create your account and start using SwiftRescue emergency response system.</p>
            </div>
          </div>

          {/* Right */}
          <div className="signup-right">
            <div className="signup-icon-wrap"><UserPlus size={20} color="#E50914" /></div>
            <div className="signup-title">Create an account</div>
            <div className="signup-subtitle">Sign up to access your personal dashboard</div>

            <form className="signup-form" onSubmit={handleSignup}>
              <div>
                <label className="signup-label">Username</label>
                <input className="signup-input" type="text" required placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="signup-label">Password</label>
                <input className="signup-input" type="password" required placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
              <button type="submit" className="signup-btn">Sign Up →</button>
            </form>

            <div className="signup-footer">
              Already have an account? <Link to="/login">Login</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Signup;
