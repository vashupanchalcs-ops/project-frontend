import { useState } from "react";
import { useNavigate } from "react-router-dom";

const helpSections = [
  {
    title: "Sign in with your email and password",
    body: "Open the YiCare sign-in screen, choose your role, enter the email address and password used when your account was created, then select Log In.",
  },
  {
    title: "Use a one-time password (OTP)",
    body: "When you create an account or reset your password, YiCare sends a six-digit OTP to your registered email address. Enter it before the timer expires.",
  },
  {
    title: "Sign in as a driver or hospital",
    body: "Drivers enter their ambulance ID and registration number. Hospitals enter their hospital ID and registration number. These details confirm access to the right dashboard.",
  },
];

export default function SignInHelp() {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState(0);

  return (
    <div className="signin-help-root">
      <style>{`
        .signin-help-root {
          min-height: 100svh;
          background: #ffffff;
          color: #000000;
          font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
        }
        .signin-help-header {
          min-height: 84px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 clamp(20px, 8vw, 170px);
          background: #000000;
          color: #fff;
          border-top: 0;
        }
        .signin-help-brand {
          display: inline-flex;
          align-items: center;
          gap: 15px;
          color: #fff;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.035em;
        }
        .signin-help-brand strong { color: #ffffff; font-size: 30px; letter-spacing: -0.08em; }
        .signin-help-brand span { height: 31px; width: 1px; background: rgba(255,255,255,.45); }
        .signin-help-login {
          border: 1px solid rgba(255,255,255,.65);
          border-radius: 4px;
          background: transparent;
          color: #fff;
          padding: 11px 20px;
          font: 700 15px inherit;
          cursor: pointer;
        }
        .signin-help-main { max-width: 1490px; margin: 0 auto; padding: 44px clamp(20px, 8vw, 170px) 0; }
        .signin-help-back {
          border: 0;
          padding: 0;
          background: transparent;
          color: #151111;
          font: 500 16px inherit;
          cursor: pointer;
        }
        .signin-help-title { max-width: 800px; margin: 54px 0 36px; font-size: clamp(38px, 5vw, 66px); line-height: .98; letter-spacing: -0.055em; }
        .signin-help-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(290px, 400px); gap: clamp(34px, 8vw, 100px); align-items: start; }
        .signin-help-lead { margin: 0 0 28px; font-size: 20px; line-height: 1.55; }
        .signin-help-section { border-bottom: 1px solid #000000; }
        .signin-help-section button { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 15px; border: 0; padding: 18px 0; background: transparent; color: #000000; text-align: left; font: 800 18px inherit; cursor: pointer; }
        .signin-help-section button span { color: #000000; font-size: 24px; }
        .signin-help-section p { max-width: 760px; margin: -2px 0 21px; font-size: 17px; line-height: 1.6; color: rgba(0,0,0,0.72); }
        .signin-help-card { border: 1px solid #000000; border-top: 7px solid #000000; padding: 24px; background: #fff; box-shadow: none; }
        .signin-help-card h2 { margin: 0 0 14px; font-size: 24px; letter-spacing: -0.03em; }
        .signin-help-card button { display: block; border: 0; border-bottom: 1px solid #000000; padding: 14px 0; background: transparent; color: #000000; text-align: left; font: 600 16px inherit; text-decoration: underline; cursor: pointer; }
        .signin-help-card button:last-child { border-bottom: 0; }
        .signin-help-footer { margin-top: 82px; padding: 42px clamp(20px, 8vw, 170px) 56px; background: #000000; color: #fff; }
        .signin-help-footer h2 { margin: 0 0 15px; font-size: 28px; }
        .signin-help-contact { border: 0; border-radius: 4px; padding: 13px 28px; background: #fff; color: #111; font: 800 16px inherit; cursor: pointer; }
        @media (max-width: 760px) {
          .signin-help-header { min-height: 70px; padding: 0 18px; }
          .signin-help-brand { font-size: 16px; gap: 9px; }
          .signin-help-brand strong { font-size: 22px; }
          .signin-help-brand span { height: 24px; }
          .signin-help-login { padding: 9px 12px; font-size: 13px; }
          .signin-help-main { padding: 30px 20px 0; }
          .signin-help-title { margin: 42px 0 26px; }
          .signin-help-grid { grid-template-columns: 1fr; }
          .signin-help-footer { margin-top: 52px; padding: 35px 20px 44px; }
        }
      `}</style>

      <header className="signin-help-header">
        <div className="signin-help-brand"><strong>YICARE</strong><span /><b>Help Center</b></div>
        <button className="signin-help-login" type="button" onClick={() => navigate("/Login")}>Sign In</button>
      </header>

      <main className="signin-help-main">
        <button className="signin-help-back" type="button" onClick={() => navigate("/Login")}>← Back to sign in</button>
        <h1 className="signin-help-title">How to sign in to YiCare</h1>
        <div className="signin-help-grid">
          <section>
            <p className="signin-help-lead">Use the account email and password you registered with. Keep your role details ready if you are signing in as a driver or hospital.</p>
            {helpSections.map((section, index) => (
              <article className="signin-help-section" key={section.title}>
                <button type="button" onClick={() => setOpenSection((current) => current === index ? -1 : index)}>
                  {section.title}<span>{openSection === index ? "−" : "+"}</span>
                </button>
                {openSection === index && <p>{section.body}</p>}
              </article>
            ))}
          </section>
          <aside className="signin-help-card">
            <h2>Related help</h2>
            <button type="button" onClick={() => navigate("/Login")}>Reset a forgotten password</button>
            <button type="button" onClick={() => navigate("/Login")}>Why am I not receiving an OTP?</button>
            <button type="button" onClick={() => navigate("/Login")}>Driver and hospital access details</button>
          </aside>
        </div>
      </main>

      <footer className="signin-help-footer">
        <h2>Need more help?</h2>
        <button className="signin-help-contact" type="button" onClick={() => window.location.href = "mailto:support@yicare.in"}>Contact support</button>
      </footer>
    </div>
  );
}
