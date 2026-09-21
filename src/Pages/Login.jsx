import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

const ADMIN_EMAIL = "vashupanchal.cs@gmail.com";
// In Vite development, send OTPs to the local Django server. It prints the
// code in that terminal; deployed builds continue to use the Render backend.
const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
const IS_PROD = import.meta.env.PROD;
const DB_KEY = "sr_users_db";
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ||
  import.meta.env.VITE_GOOGLE_SIGNIN_CLIENT_ID ||
  (typeof window !== "undefined" ? window.localStorage.getItem("sr_google_client_id") || "" : "") ||
  "1054368593444-swiftrescue.apps.googleusercontent.com";

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
    signal: AbortSignal.timeout(90000),
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
  const [showHelp, setShowHelp] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "user",
    phone: "",
    contractId: "",
    hospitalId: "",
    staffId: "",
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
    if (pickedRole === "staff") return "staff";
    return pickedRole === "driver" ? "driver" : "user";
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
        // Render's free instance may need time to wake up after inactivity.
        signal: AbortSignal.timeout(90000),
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
    if (userRecord.role === "staff") {
      if (userRecord.staff_id) localStorage.setItem("staff_id", String(userRecord.staff_id));
      if (userRecord.staff_role) localStorage.setItem("staff_role", String(userRecord.staff_role));
      if (userRecord.hospital_id) localStorage.setItem("hospital_id", String(userRecord.hospital_id));
      if (userRecord.hospital_name) localStorage.setItem("hospital_name", String(userRecord.hospital_name));
    }
    // Sync ALL roles to backend database (UserProfile model)
    fetch(`${BASE}/api/auth/sync-user/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:               userRecord.email,
        name:                userRecord.name || userRecord.displayName || "",
        role:                userRecord.role || "user",
        phone:               userRecord.phone || "",
        ambulance_id:        userRecord.ambulance_id || null,
        ambulance_number:    userRecord.ambulance_number || "",
        contract_id:         userRecord.contract_id || "",
        registration_number: userRecord.registration_number || "",
        hospital_id:         userRecord.hospital_id || null,
        hospital_name:       userRecord.hospital_name || "",
        staff_id:            userRecord.staff_id || "",
        staff_role:          userRecord.staff_role || "",
      }),
    }).catch(() => {});

    if (userRecord.role === "driver") navigate("/driver-dashboard", { replace: true });
    else if (userRecord.role === "hospital") navigate("/hospital/home", { replace: true });
    else if (userRecord.role === "staff") navigate("/staff/home", { replace: true });
    else navigate("/", { replace: true });
  };

  const loginWithPassword = async (e) => {
    if (e) e.preventDefault();
    clearMsgs();

    const email = form.email.trim().toLowerCase();
    const existing = getUser(email);
    if (form.role === "staff") {
      if (!isValidEmail(email) || !form.staffId.trim() || !form.registrationNumber.trim() || !form.password) {
        return setErr("Email, Staff ID, Registration No. and password are required.");
      }
      setBusy(true);
      try {
        const resp = await fetch(`${BASE}/api/auth/staff-login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            staff_id: form.staffId.trim(),
            registration_number: form.registrationNumber.trim(),
            password: form.password,
          }),
          signal: AbortSignal.timeout(90000),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.valid) return setErr(data.error || "Staff details do not match hospital records.");
        try {
          const otpData = await sendBackendOtp(email);
          setOtpPurpose("staff_login");
          setOtp(["", "", "", "", "", ""]);
          setTimer(60);
          setStep("otp");
          setInfo(otpData?.dev_otp
            ? `Gmail SMTP is not configured locally. Use this development OTP: ${otpData.dev_otp}`
            : `OTP sent to the registered Gmail address ${email}.`);
        } catch (otpError) {
          setErr(otpError.message || "We could not send the staff login OTP to Gmail.");
        }
      } catch {
        setErr("Staff login failed due to a network error. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }
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
        setErr(otpError.message || "The OTP email could not be sent. Check the backend email configuration.");
        return;
      }
    }

    const code = makeLocalOtp(email);
    setBusy(false);
    setOtpPurpose("reset");
    setOtp(["", "", "", "", "", ""]);
    setTimer(60);
    setStep("otp");

    setInfo("A local development OTP was generated. Check the developer console for the OTP.");
    console.log(`[SwiftRescue RESET OTP] ${email} -> ${code}`);
  };

  const signupWithGoogle = async () => {
    clearMsgs();
    if (form.role === "staff") {
      setErr("Hospital staff accounts are created by the hospital portal. Use Sign In with your issued credentials.");
      return;
    }
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

    if (form.role === "staff" && ["staff_login", "staff_signup"].includes(otpPurpose)) {
      setBusy(true);
      try {
        const otpData = await sendBackendOtp(form.email.trim().toLowerCase());
        setOtp(["", "", "", "", "", ""]);
        setTimer(60);
        setInfo(otpData?.dev_otp
          ? "Gmail SMTP is not configured in this local backend. Use the development OTP from the backend console."
          : `A new OTP was sent to ${form.email.trim().toLowerCase()}.`);
      } catch (otpError) {
        setErr(otpError.message || "We could not resend the staff Gmail OTP.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (form.role === "staff") {
      const email = form.email.trim().toLowerCase();
      if (!isValidEmail(email) || !form.staffId.trim() || !form.registrationNumber.trim()) {
        return setErr("Email, Staff ID and Registration No. are required.");
      }
      if (!form.password || form.password.length < 6) {
        return setErr("Password must be at least 6 characters.");
      }
      if (form.password !== form.confirmPassword) {
        return setErr("Password and confirm password do not match.");
      }

      setBusy(true);
      try {
        const identityResp = await fetch(`${BASE}/api/auth/staff-signup/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            staff_id: form.staffId.trim(),
            registration_number: form.registrationNumber.trim(),
            password: form.password,
            verify_only: true,
          }),
          signal: AbortSignal.timeout(90000),
        });
        const identity = await identityResp.json().catch(() => ({}));
        if (!identityResp.ok || !identity.valid) {
          return setErr(identity.error || "Staff details do not match hospital records.");
        }

        const otpData = await sendBackendOtp(email);
        setOtpPurpose("staff_signup");
        setOtp(["", "", "", "", "", ""]);
        setTimer(60);
        setStep("otp");
        setInfo(otpData?.dev_otp
          ? `Gmail SMTP is not configured locally. Use this development OTP: ${otpData.dev_otp}`
          : `OTP sent to the registered Gmail address ${email}.`);
      } catch (error) {
        setErr(error.message || "We could not send the staff signup OTP to Gmail.");
      } finally {
        setBusy(false);
      }
      return;
    }

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
        return setErr(error?.message || "The contract details could not be verified. Please try again.");
      }
    }
    setBusy(true);

    try {
      const otpData = await sendBackendOtp(email);
      setBusy(false);
      setOtpPurpose("signup");
      setOtp(["", "", "", "", "", ""]);
      setTimer(60);
      setStep("otp");
      setInfo(otpData?.dev_otp
        ? `Gmail SMTP is not configured locally. Use this development OTP: ${otpData.dev_otp}`
        : `OTP has been sent to ${email}.`);
      return;
    } catch (otpError) {
      if (IS_PROD) {
        setBusy(false);
        setErr(otpError.message || "The OTP email could not be sent. Check the backend email configuration.");
        return;
      }
    }

    const code = makeLocalOtp(email);
    setBusy(false);
    setOtpPurpose("signup");

    setOtp(["", "", "", "", "", ""]);
    setTimer(60);
    setStep("otp");

    setInfo("A local development OTP was generated. Check the developer console for the OTP.");
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

    if (!verified && !["staff_login", "staff_signup"].includes(otpPurpose)) {
      verified = verifyLocalOtp(email, entered);
    }

    if (!verified) return setErr("OTP is invalid or expired.");

    if (otpPurpose === "staff_signup") {
      setBusy(true);
      try {
        const resp = await fetch(`${BASE}/api/auth/staff-signup/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            staff_id: form.staffId.trim(),
            registration_number: form.registrationNumber.trim(),
            password: form.password,
          }),
          signal: AbortSignal.timeout(90000),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.valid) return setErr(data.error || "Staff signup could not be completed.");
        completeLogin({
          ...(data.staff || {}),
          ...data,
          email: data.email || email,
          name: data.name || form.name.trim(),
          role: "staff",
          staff_role: data.staff_role || data.staff?.role || "support",
          hospital_id: data.hospital_id || data.hospital?.id || "",
          hospital_name: data.hospital_name || data.hospital?.name || "",
        });
      } catch {
        setErr("Staff signup failed after OTP verification. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (otpPurpose === "staff_login") {
      setBusy(true);
      try {
        const resp = await fetch(`${BASE}/api/auth/staff-login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            staff_id: form.staffId.trim(),
            registration_number: form.registrationNumber.trim(),
            password: form.password,
          }),
          signal: AbortSignal.timeout(90000),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.valid) return setErr(data.error || "Staff credentials are no longer valid.");
        completeLogin({
          ...(data.staff || {}),
          ...data,
          email: data.email || email,
          name: data.name || form.name.trim(),
          role: "staff",
          staff_role: data.staff_role || data.staff?.role || "support",
          hospital_id: data.hospital_id || data.hospital?.id || "",
          hospital_name: data.hospital_name || data.hospital?.name || "",
        });
      } catch {
        setErr("Staff login failed after OTP verification. Please try again.");
      } finally {
        setBusy(false);
      }
      return;
    }

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
          background: radial-gradient(circle at 50% 15%, rgba(125,18,24,.55), transparent 38%), linear-gradient(145deg, #220709 0%, #430d12 42%, #170304 100%);
          display: grid;
          place-items: center;
          padding: 24px;
          font-family: 'Outfit', sans-serif;
          color: #fff;
        }

        .auth-shell {
          width: min(560px, 100%);
          background: rgba(12,5,6,.38);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 8px;
          box-shadow: 0 24px 70px rgba(0,0,0,.32);
        }

        .auth-left {
          display: none;
        }

        .auth-right {
          background: rgba(18,8,9,.78);
          border: none;
          padding: 34px 42px 30px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .auth-step-title {
          margin: 6px 0 2px;
          font-size: 40px;
          font-family: 'Outfit', sans-serif;
          line-height: 1.1;
          text-align: center;
          font-weight: 700;
        }

        .auth-step-title .hl {
          color: #ffffff;
        }

          .auth-step-sub {
          margin: 0 0 2px;
          text-align: center;
          color: #c7b8b9;
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
          border: 1px solid #5b4446;
          border-radius: 3px;
          background: rgba(255,255,255,.05);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }

        .auth-mode.on {
          background: #ffffff;
          border-color: #ffffff;
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
          color: #c7b8b9;
          font-weight: 500;
        }

        .auth-field input {
          height: 38px;
          border: 1px solid #5b4446;
          border-radius: 3px;
          background: rgba(255,255,255,.06);
          padding: 0 10px;
          font-size: 16px;
          color: #fff;
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
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #cccccc;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }
        .auth-pass-toggle:hover {
          color: #ffffff;
        }

        .auth-field input:focus {
          border-color: #bfbfbf;
        }

        .auth-roles {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .auth-role {
          height: 38px;
          border: 1px solid #5b4446;
          border-radius: 3px;
          background: rgba(255,255,255,.05);
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }

        .auth-role.on {
          background: #ffffff;
          border-color: #ffffff;
        }

        .auth-note {
          margin-top: 1px;
          font-size: 12px;
          color: #bba9aa;
        }

        .auth-btn {
          margin-top: 2px;
          height: 40px;
          border-radius: 4px;
          border: 1px solid #ffffff;
          background: #ffffff;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
        }

        .auth-google {
          height: 40px;
          border-radius: 4px;
          border: 1px solid #5b4446;
          background: rgba(255,255,255,.06);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          width: 100%;
        }

        .auth-btn.alt {
          background: rgba(255,255,255,.06);
          color: #fff;
          border-color: #5b4446;
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

        .auth-help {
          margin-top: 22px;
          border-top: 1px solid rgba(255,255,255,.14);
          padding-top: 15px;
        }
        .auth-help-toggle {
          border: 0;
          background: transparent;
          color: #fff;
          font: 600 15px 'Outfit', sans-serif;
          cursor: pointer;
          padding: 0;
        }
        .auth-help-toggle span { color: #ffffff; margin-left: 7px; }
        .auth-help-body { margin-top: 11px; color: #bba9aa; font-size: 12px; line-height: 1.65; }

        @media (max-width: 640px) {
          .auth-root {
            padding: 68px 10px 16px !important;
          }
          .auth-shell {
            width: 100% !important;
            max-width: 100% !important;
          }
          .auth-right {
            padding: 16px 16px 14px !important;
            gap: 6px !important;
          }
          .auth-step-title {
            font-size: 22px !important;
          }
          .auth-step-sub {
            font-size: 12px !important;
          }
          .auth-field input {
            height: 36px !important;
            font-size: 14px !important;
          }
          .auth-btn, .auth-google {
            height: 36px !important;
            font-size: 14px !important;
          }
          .auth-otp input {
            width: 40px;
            height: 44px;
          }
        }

        /* Sign-in presentation: compact, high-contrast monochrome theme. */
        body:has(.auth-root)::before { display: none; }

        .auth-root {
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 76px 14px 20px;
          overflow-x: hidden;
          background: #ffffff;
          box-sizing: border-box;
        }

        .auth-root,
        .auth-root * { font-family: 'Outfit', sans-serif !important; }

        .auth-root::before,
        .auth-root::after { display: none; }

        .auth-brandbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          margin: 0;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #000000;
          background: #000000;
          backdrop-filter: blur(8px);
          z-index: 13000;
        }

        .auth-brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 2px 0;
          border: 0;
          background: transparent;
          color: #ffffff;
          font: 900 24px/1 'Outfit', sans-serif;
          letter-spacing: -0.085em;
          cursor: pointer;
        }

        .auth-brand-mark {
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          border: 2px solid currentColor;
          border-radius: 50%;
          font-size: 18px;
          line-height: 1;
          letter-spacing: 0;
        }

        .auth-shell {
          width: min(600px, 96vw);
          max-width: 600px;
          margin: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 0;
          box-shadow: none;
        }

        .auth-left {
          display: none;
        }

        .auth-right {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 20px 24px 18px;
          border: 1px solid #000000;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
          box-sizing: border-box;
        }

        .auth-step-title {
          margin: 0;
          color: #000000;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.035em;
          text-align: left;
        }

        .auth-step-title .hl { color: #000000; }

        .auth-step-sub {
          margin: 0 0 2px;
          color: rgba(0, 0, 0, 0.72);
          font-size: 13px;
          line-height: 1.3;
          text-align: left;
        }

        .auth-modes { margin-bottom: 2px; }

        .auth-mode,
        .auth-role {
          height: 34px;
          border-color: #000000;
          border-radius: 5px;
          background: #ffffff;
          color: #000000;
          font-size: 14px;
          transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
        }

        .auth-mode:hover,
        .auth-role:hover,
        .auth-google:hover { transform: translateY(-1px); border-color: #000000; }

        .auth-mode.on,
        .auth-role.on {
          background: #000000;
          border-color: #000000;
          color: #ffffff;
          font-weight: 700;
        }

        .auth-form { gap: 6px; }
        .auth-field { gap: 2px; }
        .auth-field label { color: #000000; font-size: 11px; font-weight: 600; }
        .auth-field input {
          height: 38px;
          border: 1px solid #000000;
          border-radius: 5px;
          background: #ffffff;
          color: #000000;
          font-size: 14px;
          padding: 0 10px;
        }
        .auth-field input::placeholder { color: rgba(0, 0, 0, 0.5); }
        .auth-field input:focus { border-color: #000000; box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.12); }

        .auth-btn,
        .auth-google {
          height: 38px;
          border-radius: 5px;
          font-size: 14px;
          font-weight: 700;
          transition: transform 160ms ease, filter 160ms ease, background 160ms ease;
        }
        .auth-btn, .auth-google { border-color: #000000; background: #000000; color: #ffffff; }
        .auth-btn:not(:disabled):hover { background: #ffffff; border-color: #000000; color: #000000; transform: translateY(-1px); }
        .auth-btn.alt { background: #ffffff; border-color: #000000; color: #000000; }
        .auth-google { border-color: #000000; background: #000000; color: #ffffff; }

        .auth-note,
        .auth-legal,
        .auth-meta,
        .auth-resend { color: rgba(0, 0, 0, 0.72); }
        .auth-meta { margin-top: 4px; }
        .auth-legal { margin-top: 6px; }
        .auth-resend button,
        .auth-back,
        .auth-link { color: #000000 !important; background: transparent !important; border-color: transparent !important; }

        .auth-otp { justify-content: flex-start; }
        .auth-otp input { border-color: #000000; background: #ffffff; color: #000000; }

        .auth-help {
          margin-top: 7px;
          border-top: 0;
          padding-top: 0;
        }
        .auth-help-toggle { font-size: 17px; color: #000000 !important; background: transparent !important; border-color: transparent !important; }
        .auth-help-toggle span { color: #000000; }
        .auth-help-body {
          max-width: 450px;
          margin-top: 8px;
          color: rgba(0, 0, 0, 0.72);
          font-size: 14px;
          line-height: 1.6;
        }
        .auth-help-learn {
          margin-top: 10px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #000000;
          font: 700 14px 'Outfit', sans-serif;
          text-decoration: underline;
          cursor: pointer;
        }

        @media (max-width: 760px) {
          .auth-root { padding: 0 14px 32px; }
          .auth-brandbar { height: 76px; margin: 0 -14px; padding: 0 18px; }
          .auth-brand { font-size: 30px; }
          .auth-brand-mark { width: 23px; height: 23px; font-size: 17px; }
          .auth-shell { width: min(640px, 100%); margin: 30px auto 0; }
          .auth-right { padding: 20px 19px; }
          .auth-step-sub { font-size: 16px; }
          .auth-otp { gap: 6px; }
          .auth-otp input { width: min(44px, 13vw); height: 50px; }
        }

        /* Final YiCare sign-in treatment: a focused white form with emergency-red actions. */
        .auth-root {
          min-height: 100vh;
          padding: 104px 24px 36px;
          display: grid;
          place-items: center;
          background: #ffffff !important;
          color: #191919 !important;
        }
        .auth-brandbar {
          position: fixed;
          height: 82px;
          justify-content: flex-start;
          padding: 0 clamp(24px, 11vw, 216px);
          background: #ffffff !important;
          border-bottom: 1px solid #dedede;
          box-shadow: none;
        }
        .auth-brand {
          color: #e50914 !important;
          font-size: 32px;
          letter-spacing: -0.065em;
        }
        .auth-brand-mark {
          width: 28px;
          height: 28px;
          border-color: #e50914;
        }
        .auth-shell {
          width: min(540px, 100%);
          max-width: 540px;
          margin: 0 auto;
        }
        .auth-right {
          padding: 30px 34px 28px;
          gap: 10px;
          background: #ffffff !important;
          border: 1px solid #dedede;
          border-top: 4px solid #e50914;
          border-radius: 8px;
          box-shadow: 0 12px 32px rgba(25, 25, 25, 0.08);
        }
        .auth-step-title,
        .auth-step-title .hl { color: #191919 !important; }
        .auth-step-title .hl { color: #e50914 !important; }
        .auth-step-title { font-size: 32px; }
        .auth-step-sub,
        .auth-note,
        .auth-legal,
        .auth-meta,
        .auth-resend,
        .auth-help-body { color: #666666 !important; }
        .auth-field label { color: #c8102e !important; font-weight: 700; }
        .auth-field input {
          height: 46px;
          border: 1px solid #bdbdbd !important;
          border-radius: 4px;
          color: #191919 !important;
          background: #ffffff !important;
        }
        .auth-field input:focus {
          border-color: #e50914 !important;
          box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.12) !important;
        }
        .auth-mode,
        .auth-role,
        .auth-btn.alt,
        .auth-google {
          color: #c8102e !important;
          border: 1px solid #e50914 !important;
          background: #ffffff !important;
        }
        .auth-mode.on,
        .auth-role.on,
        .auth-btn {
          background: #e50914 !important;
          border-color: #e50914 !important;
          color: #ffffff !important;
        }
        .auth-btn:not(:disabled):hover,
        .auth-mode:hover,
        .auth-role:hover,
        .auth-google:hover,
        .auth-btn.alt:hover {
          background: #b20710 !important;
          border-color: #b20710 !important;
          color: #ffffff !important;
          transform: none;
        }
        .auth-pass-toggle { color: #c8102e !important; }
        .auth-otp input {
          border: 1px solid #bdbdbd !important;
          border-radius: 4px;
          background: #ffffff !important;
          color: #191919 !important;
        }
        .auth-otp input:focus { border-color: #e50914 !important; }
        .auth-msg.err {
          color: #b20710 !important;
          background: #fff1f2 !important;
          border-color: #f2aeb4 !important;
        }
        .auth-msg.ok {
          color: #191919 !important;
          background: #ffffff !important;
          border-color: #dedede !important;
        }
        .auth-resend button,
        .auth-back,
        .auth-link,
        .auth-help-toggle,
        .auth-help-toggle span,
        .auth-help-learn { color: #c8102e !important; }
        .auth-help { border-top: 1px solid #ededed; padding-top: 14px; }

        @media (max-width: 760px) {
          .auth-root { padding: 96px 14px 28px; align-items: start; }
          .auth-brandbar { height: 68px; padding: 0 18px; }
          .auth-brand { font-size: 26px; }
          .auth-right { padding: 24px 18px; }
          .auth-step-title { font-size: 28px; }
          .auth-roles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        /* Keep the YiCare mark visible against the dark authentication header. */
        #root .auth-root button.auth-brand,
        #root .auth-root button.auth-brand:hover,
        #root .auth-root button.auth-brand > span,
        #root .auth-root button.auth-brand > .auth-brand-mark {
          color: #e50914 !important;
          border-color: #e50914 !important;
          background: transparent !important;
        }
        html body #root .auth-root button.auth-brand,
        html body #root .auth-root button.auth-brand:hover,
        html body #root .auth-root button.auth-brand > span,
        html body #root .auth-root button.auth-brand > .auth-brand-mark {
          color: #111111 !important;
          border-color: #111111 !important;
          background: transparent !important;
        }

        /* Only the selected Sign In tab is yellow; every other login control stays neutral. */
        .auth-root { font-family: Roboto, sans-serif !important; background: #ffffff !important; }
        .auth-right { border-top-color: #dedede !important; box-shadow: none !important; }
        .auth-step-title .hl { color: #111111 !important; }
        .auth-field label, .auth-pass-toggle { color: #111111 !important; }
        .auth-field input:focus, .auth-otp input:focus { border-color: #111111 !important; box-shadow: none !important; }
        .auth-mode { background: #ffffff !important; border-color: #dedede !important; color: #111111 !important; }
        .auth-mode.on, .auth-mode.on:hover { background: #f59a23 !important; border-color: #f59a23 !important; color: #111111 !important; }
        .auth-mode:hover { background: #ffffff !important; border-color: #111111 !important; color: #111111 !important; }
        .auth-role, .auth-role.on, .auth-role:hover { background: #ffffff !important; border-color: #dedede !important; color: #111111 !important; }
        .auth-role.on { box-shadow: none !important; }
        .auth-btn, .auth-btn.alt, .auth-btn.alt:hover { background: #ffffff !important; border-color: #dedede !important; color: #111111 !important; }
        .auth-google, .auth-google:hover { background: #ffffff !important; border-color: #dedede !important; color: #111111 !important; transform: none !important; }
        .auth-msg.err { color: #111111 !important; background: #ffffff !important; border-color: #dedede !important; }
        .auth-pass-toggle { background: #ffffff !important; border-color: #dedede !important; color: #111111 !important; }
        .auth-back { display: block !important; width: 100% !important; padding: 10px !important; border: 1px solid #dedede !important; background: #ffffff !important; color: #111111 !important; }
        .auth-resend button, .auth-link, .auth-help-toggle, .auth-help-toggle span, .auth-help-learn { color: #111111 !important; }

        /* Keep the brand green; selected sign-in and role choices use yellow only. */
        html body #root#root .auth-root button.auth-brand,
        html body #root#root .auth-root button.auth-brand:hover,
        html body #root#root .auth-root button.auth-brand > span,
        html body #root#root .auth-root button.auth-brand > .auth-brand-mark {
          color: #126f1e !important;
          border-color: #126f1e !important;
          background: transparent !important;
        }
        html body #root#root .auth-root .auth-role.on,
        html body #root#root .auth-root .auth-role.on:hover,
        html body #root#root .auth-root .auth-btn:not(.alt) {
          background: #f59a23 !important;
          border-color: #f59a23 !important;
          color: #111111 !important;
        }
      `}</style>

      <div className="auth-root">
        <header className="auth-brandbar">
          <button type="button" className="auth-brand" onClick={() => navigate("/")} aria-label="Go to Aarogya home">
            <span className="auth-brand-mark">+</span>
            <span>Aarogya</span>
          </button>
        </header>
        <div className="auth-shell">
          <aside className="auth-left">
            <div className="auth-star">*</div>
            <div className="auth-left-copy">
              <p>Hey, Hello!</p>
              <h2>OTP based secure access to Aarogya workspace</h2>
            </div>
          </aside>

          <section className="auth-right">
            {step === "details" && (
              <>
                <h2 className="auth-step-title">Sign <span className="hl">in</span></h2>
                <p className="auth-step-sub">
                  {isResetMode
                    ? "Reset your password with OTP verification"
                    : authMode === "signup"
                      ? "Create your account with OTP + password"
                      : "Sign in with your email and password"}
                </p>

                <div className="auth-modes">
                  <button type="button" className={`auth-mode ${authMode === "login" && !isResetMode ? "on" : ""}`} onClick={() => { clearMsgs(); setIsResetMode(false); setAuthMode("login"); }}>
                    Sign In
                  </button>
                  <button type="button" className={`auth-mode ${authMode === "signup" && !isResetMode ? "on" : ""}`} onClick={() => { clearMsgs(); setIsResetMode(false); setAuthMode("signup"); }}>
                    Sign Up
                  </button>
                </div>

                {err ? <div className="auth-msg err">{err}</div> : null}
                {info ? <div className="auth-msg ok">{info}</div> : null}

                <form className={`auth-form ${authMode === "login" && !isResetMode ? "auth-login-form" : ""}`} onSubmit={isResetMode ? sendResetOtp : (authMode === "signup" ? sendOtp : loginWithPassword)}>
                  {authMode === "signup" && !isResetMode && form.role !== "staff" && (
                    <div className="auth-field">
                      <label>Full Name</label>
                      <input name="name" value={form.name} onChange={onChange} placeholder="Enter your full name" />
                    </div>
                  )}

                  <div className="auth-field auth-email-field">
                    <label>Email Address</label>
                    <input name="email" type="email" value={form.email} onChange={onChange} placeholder="you@example.com" required />
                  </div>

                  <div className="auth-field auth-role-field">
                    <label>Choose Role</label>
                    <div className="auth-roles">
                      <button type="button" className={`auth-role ${form.role === "user" ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, role: "user" }))}>User</button>
                      <button type="button" className={`auth-role ${form.role === "driver" ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, role: "driver" }))}>Driver</button>
                      <button type="button" className={`auth-role ${form.role === "hospital" ? "on" : ""}`} onClick={() => setForm((f) => ({ ...f, role: "hospital" }))}>Hospital</button>
                      <button type="button" className={`auth-role ${form.role === "staff" ? "on" : ""}`} onClick={() => { clearMsgs(); setForm((f) => ({ ...f, role: "staff" })); }}>Hospital Staff</button>
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

                  {form.role === "staff" && !isResetMode && (
                    <>
                      <div className="auth-field">
                        <label>Staff ID</label>
                        <input name="staffId" value={form.staffId} onChange={onChange} placeholder="e.g. AIIMS-DR-0001" required />
                      </div>
                      <div className="auth-field">
                        <label>Staff Registration Number</label>
                        <input name="registrationNumber" value={form.registrationNumber} onChange={onChange} placeholder="e.g. AIIMS-DR-REG-0001" required />
                      </div>
                    </>
                  )}

                  <div className="auth-field auth-password-field">
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
                        {passwordVisible.password ? <EyeOff size={18} /> : <Eye size={18} />}
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
                          {passwordVisible.confirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="auth-note">
                    Active role: <b>{rolePreview.toUpperCase()}</b>
                    {rolePreview === "admin" ? ` (Admin email detected)` : ""}
                    {rolePreview === "staff" ? " · Use credentials issued by your hospital" : ""}
                  </div>

                  <button className="auth-btn" type="submit" disabled={busy}>
                    {busy
                      ? (isResetMode ? "Sending reset OTP..." : (authMode === "signup" ? "Sending OTP..." : "Logging in..."))
                      : (isResetMode ? "Send Reset OTP" : (authMode === "signup" ? "Send OTP" : "Sign In"))}
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
                  By continuing, you agree to Aarogya terms, conditions, and privacy policy.
                </div>
                <div className="auth-help">
                  <button type="button" className="auth-help-toggle" onClick={() => setShowHelp((v) => !v)}>
                    Get Help <span>{showHelp ? "⌃" : "⌄"}</span>
                  </button>
                  {showHelp && (
                    <div className="auth-help-body">
                      Use your registered email and password to sign in. For OTP or hospital access issues, contact the support team: <b>support@aarogya.in</b>.
                      <button type="button" className="auth-help-learn" onClick={() => navigate("/login/help")}>Learn about sign-in</button>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === "otp" && (
              <>
                <h2 className="auth-step-title">Verify <span className="hl">OTP</span></h2>
                <p className="auth-step-sub">
                  {["staff_login", "staff_signup"].includes(otpPurpose) ? "Gmail OTP sent to " : "6-digit code sent to "}<b>{form.email}</b>
                </p>

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
