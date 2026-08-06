import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ADMIN_EMAIL = "vashupanchal.cs@gmail.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const IS_PROD = import.meta.env.PROD;
const DB_KEY = "sr_users_db";
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
  import.meta.env.VITE_GOOGLE_SIGNIN_CLIENT_ID ||
  (typeof window !== "undefined" ? window.localStorage.getItem("sr_google_client_id") || "" : "");

const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || "{}");
  } catch {
    return {};
  }
};
const saveUsers = (u) => localStorage.setItem(DB_KEY, JSON.stringify(u));
const getUser = (email) => getUsers()[email.trim().toLowerCase()] || null;
const saveUser = (u) => {
  const db = getUsers();
  db[u.email] = u;
  saveUsers(db);
};

const localOtpStore = {};
const makeLocalOtp = (email) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  localOtpStore[email] = { code, exp: Date.now() + 5 * 60 * 1000 };
  return code;
};
const verifyLocalOtp = (email, otp) => {
  const entry = localOtpStore[email];
  if (!entry || Date.now() > entry.exp) return false;
  if (entry.code === String(otp).trim()) {
    delete localOtpStore[email];
    return true;
  }
  return false;
};

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);
const normalizePhone = (v) => String(v || "").replace(/\D/g, "").slice(-10);

const sendBackendOtp = async (email) => {
  const resp = await fetch(`${BASE}/api/send-otp/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.status !== "otp_sent") {
    throw new Error(data.message || "OTP email service failed.");
  }
  return data;
};

const applySession = ({ email, name, role, phone }) => {
  localStorage.setItem("user", email);
  localStorage.setItem("name", name || email.split("@")[0]);
  localStorage.setItem("role", role);
  if (phone) localStorage.setItem("phone", phone);
};

export default function Login() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const signupMode = useMemo(() => new URLSearchParams(search).get("signup") === "1", [search]);
  const [authMode, setAuthMode] = useState(signupMode ? "signup" : "login");
  const [isResetMode, setIsResetMode] = useState(false);

  const [step, setStep] = useState("details");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [timer, setTimer] = useState(0);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "user",
    phone: "",
    contractId: "",
    hospitalId: "",
    registrationNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [otpPurpose, setOtpPurpose] = useState("signup");
  const [passwordVisible, setPasswordVisible] = useState({
    password: false,
    confirmPassword: false,
  });

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (timer <= 0) return;
    const t = setTimeout(() => setTimer((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [timer]);

  useEffect(() => {
    setAuthMode(signupMode ? "signup" : "login");
    setIsResetMode(false);
  }, [signupMode]);

  useEffect(() => {
    if (window.google?.accounts?.oauth2) return;
    const existing = document.getElementById("sr-google-sdk");
    if (existing) return;
    const s = document.createElement("script");
    s.id = "sr-google-sdk";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  const clearMsgs = () => {
    setErr("");
    setInfo("");
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setForm((f) => ({ ...f, phone: normalizePhone(value) }));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  };

  const resolvedRole = (email, pickedRole) => {
    if (email === ADMIN_EMAIL.toLowerCase()) return "admin";
    if (pickedRole === "hospital") return "hospital";
    return pickedRole === "driver" ? "driver" : "user";
  };

  const validateHospitalAccess = async (email) => {
    try {
      const resp = await fetch(`${BASE}/api/hospitals/by-email/?email=${encodeURIComponent(email)}`, {
        signal: AbortSignal.timeout(5000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  };

  const requiresContractAccess = (role) => role === "driver" || role === "hospital";

  const validateContractAccess = async ({ role, email, contractId, hospitalId, registrationNumber }) => {
    const payload = {
      role,
      email,
      contract_id: String(contractId || "").trim(),
      hospital_id: String(hospitalId || "").trim(),
      registration_number: String(registrationNumber || "").trim(),
    };
    const resp = await fetch(`${BASE}/api/auth/contract-validate/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(7000),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.valid) {
      return { ok: false, error: data?.error || "Contract details do not match backend records." };
    }
    return { ok: true, data };
  };

  const completeLogin = (userRecord) => {
    saveUser(userRecord);
    applySession(userRecord);
    if (userRecord.contract_id) localStorage.setItem("contract_id", String(userRecord.contract_id));
    if (userRecord.registration_number) localStorage.setItem("registration_number", String(userRecord.registration_number));
    if (userRecord.role === "driver" && userRecord.ambulance_id) {
      localStorage.setItem("ambulance_id", String(userRecord.ambulance_id));
      localStorage.setItem("ambulance_number", String(userRecord.ambulance_number || ""));
    }
    if (userRecord.role === "hospital" && userRecord.hospital_id) {
      localStorage.setItem("hospital_id", String(userRecord.hospital_id));
    }
    if (userRecord.role === "driver") navigate("/driver-dashboard", { replace: true });
    else if (userRecord.role === "hospital") navigate("/hospital/home", { replace: true });
    else navigate("/", { replace: true });
  };

  const loginWithPassword = async (e) => {
    if (e) e.preventDefault();
    clearMsgs();

    const email = form.email.trim().toLowerCase();
    const existing = getUser(email);
    // The role selected on the login form must be resolved before validating
    // contract access. Older locally cached accounts were often saved as
    // `user`, which otherwise made a valid driver login fall back to user UI.
    // Admin remains email-controlled and an existing hospital/driver account
    // keeps its protected role when the form is left on the default User tab.
    // Treat filled ambulance credentials as an explicit driver intent too.
    // This also handles sessions where the role toggle was reset to User.
    const selectedRole = form.role === "user" && (form.contractId.trim() || form.registrationNumber.trim())
      ? "driver"
      : resolvedRole(email, form.role);
    const role = selectedRole !== "user"
      ? selectedRole
      : (existing?.role || selectedRole);

    if (!isValidEmail(email)) return setErr("A valid email is required.");
    if (!form.password) return setErr("Password is required.");
    if (!existing) return setErr("Account not found. Please sign up first.");
    if (existing.password !== form.password) return setErr("Incorrect password.");

    const phone = normalizePhone(form.phone || existing.phone || "");
    if (role === "driver" && phone.length !== 10) {
      return setErr("A 10-digit contact number is required for driver login.");
    }
    if (requiresContractAccess(role)) {
      if (role === "hospital" && (!form.hospitalId.trim() || !form.registrationNumber.trim())) {
        return setErr("Hospital ID and Registration Number are required.");
      }
      if (role === "driver" && (!form.contractId.trim() || !form.registrationNumber.trim())) {
        return setErr("Ambulance ID and Registration Number are required.");
      }
      const checked = await validateContractAccess({
        role,
        email,
        contractId: role === "driver" ? form.contractId : "",
        hospitalId: role === "hospital" ? form.hospitalId : "",
        registrationNumber: form.registrationNumber,
      });
      if (!checked.ok) return setErr(checked.error);
      return completeLogin({
        ...existing,
        // Contract validation proves the role for this login. Do not reuse a
        // stale locally cached `user` role from an older account record.
        role,
        phone: phone || existing.phone || "",
        contract_id: checked.data.contract_id,
        registration_number: checked.data.registration_number,
        ambulance_id: checked.data.ambulance_id,
        ambulance_number: checked.data.ambulance_number,
        hospital_id: checked.data.hospital_id,
      });
    }
    if (role === "hospital") {
      const allowed = await validateHospitalAccess(email);
      if (!allowed) return setErr("Hospital profile not found for this email. Contact admin.");
    }

    completeLogin({
      ...existing,
      role,
      phone: phone || existing.phone || "",
    });
  };

  const sendResetOtp = async (e) => {
    if (e) e.preventDefault();
    clearMsgs();

    const email = form.email.trim().toLowerCase();

    if (!isValidEmail(email)) return setErr("A valid email is required.");
    if (!form.password || form.password.length < 6) {
      return setErr("Password must be at least 6 characters.");
    }
    if (form.password !== form.confirmPassword) {
      return setErr("Password and confirm password do not match.");
    }

    const existing = getUser(email);
    if (!existing) {
      return setErr("Account not found. Please sign up first.");
    }
    const accountRole = existing?.role || resolvedRole(email, form.role);
    if (form.role !== accountRole) {
      setForm((f) => ({ ...f, role: accountRole }));
    }
    if (requiresContractAccess(accountRole)) {
      if (accountRole === "hospital" && (!form.hospitalId.trim() || !form.registrationNumber.trim())) {
        return setErr("Hospital ID and Registration Number are required for password reset.");
      }
      if (accountRole === "driver" && (!form.contractId.trim() || !form.registrationNumber.trim())) {
        return setErr("Ambulance ID and Registration Number are required for password reset.");
      }
      const checked = await validateContractAccess({
        role: accountRole,
        email,
        contractId: accountRole === "driver" ? form.contractId : "",
        hospitalId: accountRole === "hospital" ? form.hospitalId : "",
        registrationNumber: form.registrationNumber,
      });
      if (!checked.ok) return setErr(checked.error);
    }

    setBusy(true);

    try {
      await sendBackendOtp(email);
      setBusy(false);
      setOtpPurpose("reset");
      setOtp(["", "", "", "", "", ""]);
      setTimer(60);
      setStep("otp");
      setInfo(`Password reset OTP has been sent to ${email}.`);
      return;
    } catch (otpError) {
      if (IS_PROD) {
        setBusy(false);
        setErr(otpError.message || "OTP email send nahi ho paya. Backend email config check karo.");
        return;
      }
    }

    const code = makeLocalOtp(email);
    setBusy(false);
    setOtpPurpose("reset");
    setOtp(["", "", "", "", "", ""]);
    setTimer(60);
    setStep("otp");

    setInfo("Local dev OTP generated. Developer console me OTP check karo.");
    console.log(`[SwiftRescue RESET OTP] ${email} -> ${code}`);
  };

  const signupWithGoogle = async () => {
    clearMsgs();
    const role = resolvedRole(form.email.trim().toLowerCase(), form.role);
    const localPhone = normalizePhone(form.phone);

    if (role === "driver" && localPhone.length !== 10) {
      setErr("A 10-digit contact number is required for driver role.");
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      setInfo(
        "Google sign-in is unavailable. Set VITE_GOOGLE_CLIENT_ID (or VITE_GOOGLE_OAUTH_CLIENT_ID) and restart Vite."
      );
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      setErr("Google SDK is not loaded yet. Please wait and try again.");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (tokenResponse) => {
        try {
          if (tokenResponse?.error || !tokenResponse?.access_token) {
            setErr("Google authentication failed.");
            return;
          }
          const userResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          if (!userResp.ok) {
            setErr("Unable to fetch Google profile.");
            return;
          }
          const profile = await userResp.json();
          const email = String(profile.email || "").trim().toLowerCase();
          if (!email) {
            setErr("Google account does not include a valid email.");
            return;
          }

          const existing = getUser(email);
          const derivedRole = resolvedRole(email, form.role);
          const targetRole = derivedRole !== "user"
            ? derivedRole
            : (existing?.role || derivedRole);
          if (targetRole === "hospital") {
            const allowed = await validateHospitalAccess(email);
            if (!allowed) {
              setErr("Hospital profile not found for this email. Contact admin.");
              return;
            }
          }
          let contractMeta = {};
          if (requiresContractAccess(targetRole)) {
            if (targetRole === "hospital" && (!form.hospitalId.trim() || !form.registrationNumber.trim())) {
              setErr("Hospital ID and Registration Number are required.");
              return;
            }
            if (targetRole === "driver" && (!form.contractId.trim() || !form.registrationNumber.trim())) {
              setErr("Ambulance ID and Registration Number are required.");
              return;
            }
            const checked = await validateContractAccess({
              role: targetRole,
              email,
              contractId: targetRole === "driver" ? form.contractId : "",
              hospitalId: targetRole === "hospital" ? form.hospitalId : "",
              registrationNumber: form.registrationNumber,
            });
            if (!checked.ok) {
              setErr(checked.error);
              return;
            }
            contractMeta = checked.data;
          }
          const merged = {
            email,
            name: (profile.name || form.name || existing?.name || email.split("@")[0]).trim(),
            role: targetRole,
            phone: existing?.phone || localPhone || "",
            password: existing?.password || "",
            auth_provider: "google",
            google_sub: profile.sub || "",
            contract_id: contractMeta.contract_id || existing?.contract_id || "",
            registration_number: contractMeta.registration_number || existing?.registration_number || "",
            ambulance_id: contractMeta.ambulance_id || existing?.ambulance_id || "",
            ambulance_number: contractMeta.ambulance_number || existing?.ambulance_number || "",
            hospital_id: contractMeta.hospital_id || existing?.hospital_id || "",
          };

          if (merged.role === "driver" && normalizePhone(merged.phone).length !== 10) {
            setErr("Driver account requires a 10-digit contact number.");
            return;
          }
          if (!existing && authMode === "signup") {
            setInfo("Google account created successfully.");
          } else if (existing) {
            setInfo("Logged in with Google successfully.");
          }
          completeLogin(merged);
        } catch {
          setErr("Google signup failed due to a network error.");
        }
      },
    });
    client.requestAccessToken();
  };

  const sendOtp = async (e) => {
    if (e) e.preventDefault();
    clearMsgs();

    const email = form.email.trim().toLowerCase();
    const phone = normalizePhone(form.phone);

    if (!form.name.trim()) return setErr("Full name is required.");
    if (!isValidEmail(email)) return setErr("A valid email is required.");
    if (!form.password || form.password.length < 6) {
      return setErr("Password must be at least 6 characters.");
    }
    if (form.password !== form.confirmPassword) {
      return setErr("Password and confirm password do not match.");
    }

    if (getUser(email)) {
      return setErr("Account already exists. Please use Login mode.");
    }

    const role = resolvedRole(email, form.role);
    if (role === "driver" && phone.length !== 10) {
      return setErr("A 10-digit contact number is required for driver role.");
    }
    if (requiresContractAccess(role)) {
      if (role === "hospital" && (!form.hospitalId.trim() || !form.registrationNumber.trim())) {
        return setErr("Hospital ID and Registration Number are required.");
      }
      if (role === "driver" && (!form.contractId.trim() || !form.registrationNumber.trim())) {
        return setErr("Ambulance ID and Registration Number are required.");
      }
      try {
        const checked = await validateContractAccess({
          role,
          email,
          contractId: role === "driver" ? form.contractId : "",
          hospitalId: role === "hospital" ? form.hospitalId : "",
          registrationNumber: form.registrationNumber,
        });
        if (!checked.ok) return setErr(checked.error);
      } catch (error) {
        return setErr(error?.message || "Backend se contract details verify nahi ho paayi. Please try again.");
      }
    }
    if (role === "hospital") {
      try {
        const allowed = await validateHospitalAccess(email);
        if (!allowed) return setErr("Hospital profile not found for this email. Contact admin.");
      } catch (error) {
        return setErr(error?.message || "Hospital details verify nahi ho paayi. Please try again.");
      }
    }

    setBusy(true);

    try {
      await sendBackendOtp(email);
      setBusy(false);
      setOtpPurpose("signup");
      setOtp(["", "", "", "", "", ""]);
      setTimer(60);
      setStep("otp");
      setInfo(`OTP has been sent to ${email}.`);
      return;
    } catch (otpError) {
      if (IS_PROD) {
        setBusy(false);
        setErr(otpError.message || "OTP email send nahi ho paya. Backend email config check karo.");
        return;
      }
    }

    const code = makeLocalOtp(email);
    setBusy(false);
    setOtpPurpose("signup");

    setOtp(["", "", "", "", "", ""]);
    setTimer(60);
    setStep("otp");

    setInfo("Local dev OTP generated. Developer console me OTP check karo.");
    console.log(`[SwiftRescue OTP] ${email} -> ${code}`);
  };

  const verifyOtp = async (e) => {
    if (e) e.preventDefault();
    clearMsgs();

    const email = form.email.trim().toLowerCase();
    const entered = otp.join("");

    if (entered.length !== 6) return setErr("Please enter a 6-digit OTP.");

    let verified = false;

    try {
      const resp = await fetch(`${BASE}/api/verify-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: entered }),
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json();
        verified = data.status === "success";
      }
    } catch {
      verified = false;
    }

    if (!verified) {
      verified = verifyLocalOtp(email, entered);
    }

    if (!verified) return setErr("OTP is invalid or expired.");

    if (otpPurpose === "reset") {
      const existing = getUser(email);
      if (!existing) return setErr("Account not found. Please sign up first.");
      const accountRole = existing?.role || resolvedRole(email, form.role);
      if (form.role !== accountRole) {
        setForm((f) => ({ ...f, role: accountRole }));
      }
      let resetContractMeta = {};
      if (requiresContractAccess(accountRole)) {
        if (accountRole === "hospital" && (!form.hospitalId.trim() || !form.registrationNumber.trim())) {
          return setErr("Hospital ID and Registration Number are required for password reset.");
        }
        if (accountRole === "driver" && (!form.contractId.trim() || !form.registrationNumber.trim())) {
          return setErr("Ambulance ID and Registration Number are required for password reset.");
        }
        const checked = await validateContractAccess({
          role: accountRole,
          email,
          contractId: accountRole === "driver" ? form.contractId : "",
          hospitalId: accountRole === "hospital" ? form.hospitalId : "",
          registrationNumber: form.registrationNumber,
        });
        if (!checked.ok) return setErr(checked.error);
        resetContractMeta = checked.data || {};
      }
      const updatedUser = {
        ...existing,
        role: accountRole,
        contract_id: resetContractMeta.contract_id || existing?.contract_id || "",
        registration_number: resetContractMeta.registration_number || existing?.registration_number || "",
        ambulance_id: resetContractMeta.ambulance_id || existing?.ambulance_id || "",
        ambulance_number: resetContractMeta.ambulance_number || existing?.ambulance_number || "",
        hospital_id: resetContractMeta.hospital_id || existing?.hospital_id || "",
        password: form.password,
      };
      completeLogin(updatedUser);
      return;
    }

    const role = resolvedRole(email, form.role);
    const phone = normalizePhone(form.phone);
    if (role === "hospital") {
      const allowed = await validateHospitalAccess(email);
      if (!allowed) return setErr("Hospital profile not found for this email. Contact admin.");
    }
    const existing = getUser(email);
    let contractMeta = {};
    if (requiresContractAccess(role)) {
      const checked = await validateContractAccess({
        role,
        email,
        contractId: role === "driver" ? form.contractId : "",
        hospitalId: role === "hospital" ? form.hospitalId : "",
        registrationNumber: form.registrationNumber,
      });
      if (!checked.ok) return setErr(checked.error);
      contractMeta = checked.data || {};
    }

    const userRecord = {
      email,
      name: form.name.trim() || existing?.name || email.split("@")[0],
      role,
      phone: role === "driver" ? (phone || existing?.phone || "") : (existing?.phone || phone || ""),
      password: form.password || existing?.password || "",
      auth_provider: existing?.auth_provider || "password",
      contract_id: contractMeta.contract_id || existing?.contract_id || "",
      registration_number: contractMeta.registration_number || existing?.registration_number || "",
      ambulance_id: contractMeta.ambulance_id || existing?.ambulance_id || "",
      ambulance_number: contractMeta.ambulance_number || existing?.ambulance_number || "",
      hospital_id: contractMeta.hospital_id || existing?.hospital_id || "",
    };

    if (role === "driver" && userRecord.phone.length !== 10) {
      return setErr("A valid 10-digit contact number is required for driver login.");
    }

    completeLogin(userRecord);
  };

  const otpInput = (idx, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) otpRefs[idx + 1].current?.focus();
  };

  const otpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) otpRefs[idx - 1].current?.focus();
    if (e.key === "Enter") verifyOtp();
  };

  const otpPaste = (e) => {
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (txt.length === 6) {
      setOtp(txt.split(""));
      otpRefs[5].current?.focus();
    }
    e.preventDefault();
  };

  const rolePreview = resolvedRole(form.email.trim().toLowerCase(), form.role);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');

        .auth-root {
          min-height: 100vh;
          background: #f5f5f5;
          display: grid;
          place-items: center;
          padding: 24px;
          font-family: 'Outfit', sans-serif;
          color: #111;
        }

        .auth-shell {
          width: min(420px, 100%);
          background: transparent;
          border: none;
          box-shadow: none;
        }

        .auth-left {
          display: none;
        }

        .auth-right {
          background: transparent;
          border: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .auth-step-title {
          margin: 6px 0 2px;
          font-size: 62px;
          font-family: "Playfair Display", serif;
          line-height: 0.94;
          text-align: center;
          font-weight: 700;
        }

        .auth-step-title .hl {
          background: #d6e800;
          border-radius: 10px;
          padding: 0 8px;
          display: inline-block;
        }

          .auth-step-sub {
          margin: 0 0 2px;
          text-align: center;
          color: #575757;
          font-size: 14px;
          font-weight: 500;
        }

        .auth-modes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }

        .auth-mode {
          height: 38px;
          border: 1px solid #d8d8d8;
          border-radius: 3px;
          background: #fff;
          color: #111;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }

        .auth-mode.on {
          background: #d6e800;
          border-color: #c6d600;
        }

        .auth-msg {
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 4px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
        }

        .auth-msg.err {
          color: #b91c1c;
          border: 1px solid rgba(185, 28, 28, 0.25);
          background: rgba(239, 68, 68, 0.08);
        }

        .auth-msg.ok {
          color: #065f46;
          border: 1px solid rgba(5, 150, 105, 0.22);
          background: rgba(16, 185, 129, 0.08);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .auth-field label {
          font-size: 11px;
          color: #6b6b6b;
          font-weight: 500;
        }

        .auth-field input {
          height: 38px;
          border: 1px solid #d8d8d8;
          border-radius: 3px;
          background: #fff;
          padding: 0 10px;
          font-size: 16px;
          color: #111;
          outline: none;
        }

        .auth-password-wrap {
          position: relative;
        }

        .auth-password-wrap input {
          width: 100%;
          padding-right: 42px;
        }

        .auth-pass-toggle {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          border: 1px solid #d8d8d8;
          width: 30px;
          height: 26px;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .auth-field input:focus {
          border-color: #bfbfbf;
        }

        .auth-roles {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }

        .auth-role {
          height: 38px;
          border: 1px solid #d8d8d8;
          border-radius: 3px;
          background: #fff;
          color: #111;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }

        .auth-role.on {
          background: #d6e800;
          border-color: #c6d600;
        }

        .auth-note {
          margin-top: 1px;
          font-size: 12px;
          color: #666;
        }

        .auth-btn {
          margin-top: 2px;
          height: 40px;
          border-radius: 4px;
          border: 1px solid #d8d8d8;
          background: #fff;
          color: #111;
          font-size: 16px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
        }

        .auth-google {
          height: 40px;
          border-radius: 4px;
          border: 1px solid #d8d8d8;
          background: #fff;
          color: #111;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          width: 100%;
        }

        .auth-btn.alt {
          background: #fff;
          color: #111;
          border-color: #d8d8d8;
        }

        .auth-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .auth-otp {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin: 6px 0 4px;
        }

        .auth-otp input {
          width: 48px;
          height: 52px;
          border: 1px solid #d8d8d8;
          border-radius: 6px;
          text-align: center;
          font-size: 26px;
          font-weight: 700;
          outline: none;
        }

        .auth-resend {
          text-align: center;
          font-size: 12px;
          color: #616161;
          margin-top: 8px;
        }

        .auth-resend button,
        .auth-back,
        .auth-link {
          border: none;
          background: none;
          color: #7a7a7a;
          font-size: 12px;
          text-decoration: underline;
          cursor: pointer;
          font-family: inherit;
        }

        .auth-back {
          margin-top: 8px;
          text-align: center;
        }

        .auth-meta {
          margin-top: 8px;
          text-align: center;
          color: #7a7a7a;
          font-size: 12px;
        }

        .auth-legal {
          margin-top: 10px;
          text-align: center;
          color: #9a9a9a;
          font-size: 10px;
          line-height: 1.4;
        }

        @media (max-width: 640px) {
          .auth-root {
            padding: 12px;
          }
          .auth-shell {
            width: 100%;
            max-width: 420px;
          }
          .auth-step-title {
            font-size: clamp(46px, 14vw, 62px);
          }
          .auth-otp input {
            width: 44px;
            height: 48px;
          }
        }
      `}</style>

      <div className="auth-root">
        <div className="auth-shell">
          <aside className="auth-left">
            <div className="auth-star">*</div>
            <div className="auth-left-copy">
              <p>Hey, Hello!</p>
              <h2>OTP based secure access to YiCare workspace</h2>
            </div>
          </aside>

          <section className="auth-right">
            {step === "details" && (
              <>
                <h2 className="auth-step-title">Log <span className="hl">in</span></h2>
                <p className="auth-step-sub">
                  {isResetMode
                    ? "Reset your password with OTP verification"
                    : authMode === "signup"
                      ? "Create your account with OTP + password"
                      : "Sign in with your email and password"}
                </p>

                <div className="auth-modes">
                  <button type="button" className={`auth-mode ${authMode === "login" && !isResetMode ? "on" : ""}`} onClick={() => { clearMsgs(); setIsResetMode(false); setAuthMode("login"); }}>
                    Login
                  </button>
                  <button type="button" className={`auth-mode ${authMode === "signup" && !isResetMode ? "on" : ""}`} onClick={() => { clearMsgs(); setIsResetMode(false); setAuthMode("signup"); }}>
                    Sign Up
                  </button>
                </div>

                {err ? <div className="auth-msg err">{err}</div> : null}
                {info ? <div className="auth-msg ok">{info}</div> : null}

                <form className="auth-form" onSubmit={isResetMode ? sendResetOtp : (authMode === "signup" ? sendOtp : loginWithPassword)}>
                  <div className="auth-field">
                    <label>Full Name</label>
                    <input name="name" value={form.name} onChange={onChange} placeholder="Enter your full name" required={authMode === "signup" && !isResetMode} />
                  </div>

                  <div className="auth-field">
                    <label>Email Address</label>
                    <input name="email" type="email" value={form.email} onChange={onChange} placeholder="you@example.com" required />
                  </div>

                  <div className="auth-field">
                    <label>Choose Role</label>
                    <div className="auth-roles">
                      <button type="button" className={`auth-role ${form.role === "user" ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, role: "user" }))}>User</button>
                      <button type="button" className={`auth-role ${form.role === "driver" ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, role: "driver" }))}>Driver</button>
                      <button type="button" className={`auth-role ${form.role === "hospital" ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, role: "hospital" }))}>Hospital</button>
                    </div>
                  </div>

                  {form.role === "driver" && !isResetMode && (
                    <div className="auth-field">
                      <label>Driver Contact (Required)</label>
                      <input name="phone" value={form.phone} onChange={onChange} placeholder="10-digit mobile number" maxLength={10} required />
                    </div>
                  )}

                  {(form.role === "driver" || form.role === "hospital") && (
                    <>
                      {form.role === "driver" && (
                        <div className="auth-field">
                          <label>Ambulance ID</label>
                          <input
                            name="contractId"
                            value={form.contractId}
                            onChange={onChange}
                            placeholder="Enter ambulance contract ID (e.g. AMB-ID-0001)"
                            required
                          />
                        </div>
                      )}
                      {form.role === "hospital" && (
                        <div className="auth-field">
                          <label>Hospital ID</label>
                          <input
                            name="hospitalId"
                            value={form.hospitalId}
                            onChange={onChange}
                            placeholder="Enter hospital contract ID (e.g. HOSP-ID-0001)"
                            required
                          />
                        </div>
                      )}
                      <div className="auth-field">
                        <label>{form.role === "driver" ? "Ambulance Registration Number" : "Hospital Registration Number"}</label>
                        <input
                          name="registrationNumber"
                          value={form.registrationNumber}
                          onChange={onChange}
                          placeholder="Enter registration number"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="auth-field">
                    <label>Password</label>
                    <div className="auth-password-wrap">
                      <input
                        name="password"
                        type={passwordVisible.password ? "text" : "password"}
                        value={form.password}
                        onChange={onChange}
                        placeholder="Enter password"
                        required
                      />
                      <button
                        type="button"
                        className="auth-pass-toggle"
                        onClick={() => setPasswordVisible((s) => ({ ...s, password: !s.password }))}
                        aria-label={passwordVisible.password ? "Hide password" : "Show password"}
                        title={passwordVisible.password ? "Hide password" : "Show password"}
                      >
                        {passwordVisible.password ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>

                  {(authMode === "signup" || isResetMode) && (
                    <div className="auth-field">
                      <label>Confirm Password</label>
                      <div className="auth-password-wrap">
                        <input
                          name="confirmPassword"
                          type={passwordVisible.confirmPassword ? "text" : "password"}
                          value={form.confirmPassword}
                          onChange={onChange}
                          placeholder="Re-enter password"
                          required
                        />
                        <button
                          type="button"
                          className="auth-pass-toggle"
                          onClick={() => setPasswordVisible((s) => ({ ...s, confirmPassword: !s.confirmPassword }))}
                          aria-label={passwordVisible.confirmPassword ? "Hide confirm password" : "Show confirm password"}
                          title={passwordVisible.confirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {passwordVisible.confirmPassword ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="auth-note">
                    Active role: <b>{rolePreview.toUpperCase()}</b>
                    {rolePreview === "admin" ? ` (Admin email detected)` : ""}
                  </div>

                  <button className="auth-btn" type="submit" disabled={busy}>
                    {busy
                      ? (isResetMode ? "Sending reset OTP..." : (authMode === "signup" ? "Sending OTP..." : "Logging in..."))
                      : (isResetMode ? "Send Reset OTP" : (authMode === "signup" ? "Send OTP" : "Log In"))}
                  </button>
                </form>
                {!isResetMode && (
                  <div style={{ marginTop: 8 }}>
                    <button className="auth-google" type="button" onClick={signupWithGoogle}>
                      {authMode === "signup" ? "Continue with Google (Create Account)" : "Continue with Google"}
                    </button>
                  </div>
                )}
                <div className="auth-meta">
                  <button
                    className="auth-link"
                    type="button"
                    onClick={() => {
                      clearMsgs();
                      setIsResetMode(true);
                      setAuthMode("login");
                      setInfo("Enter your email, new password, and verify OTP to reset password.");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="auth-legal">
                  By continuing, you agree to YiCare terms, conditions, and privacy policy.
                </div>
              </>
            )}

            {step === "otp" && (
              <>
                <h2 className="auth-step-title">Verify <span className="hl">OTP</span></h2>
                <p className="auth-step-sub">6-digit code sent to <b>{form.email}</b></p>

                {err ? <div className="auth-msg err">{err}</div> : null}
                {info ? <div className="auth-msg ok">{info}</div> : null}

                <div className="auth-otp" onPaste={otpPaste}>
                  {otp.map((v, i) => (
                    <input
                      key={i}
                      ref={otpRefs[i]}
                      inputMode="numeric"
                      maxLength={1}
                      value={v}
                      onChange={(e) => otpInput(i, e.target.value)}
                      onKeyDown={(e) => otpKeyDown(i, e)}
                    />
                  ))}
                </div>

                <button className="auth-btn alt" onClick={verifyOtp} disabled={busy || otp.join("").length !== 6}>
                  {busy ? "Verifying..." : "Verify & Continue"}
                </button>

                <div className="auth-resend">
                  {timer > 0 ? (
                    <span>Resend OTP in <b>{timer}s</b></span>
                  ) : (
                    <button onClick={sendOtp} disabled={busy}>Resend OTP</button>
                  )}
                </div>

                <button className="auth-back" onClick={() => { setStep("details"); clearMsgs(); }}>
                  Edit details
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
