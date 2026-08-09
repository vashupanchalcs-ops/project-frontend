import { Bell, Search, X, Camera, PhoneCall } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.jsx';

const EMPTY_SEARCH_RESULTS = {
  pages: [],
  ambulances: [],
  hospitals: [],
  bookings: [],
  staff: [],
};

const PANEL_PAGES = {
  admin: [
    { label: "Home", path: "/" },
    { label: "Ambulances", path: "/Ambulances", keywords: "fleet vehicles drivers" },
    { label: "Hospitals", path: "/Hospitals", keywords: "partners network beds" },
    { label: "Hospital Response", path: "/HospitalResponses", keywords: "approval ready reject" },
    { label: "Hospital Details", path: "/HospitalPartnerDetails", keywords: "staff resources" },
    { label: "Analytics", path: "/Analytics", keywords: "charts metrics reports" },
    { label: "Requests", path: "/Requests", keywords: "bookings emergency queue" },
    { label: "Call Intake", path: "/CallIntakeConsole", keywords: "voice hotline phone booking ivr" },
    { label: "Driver Requests", path: "/DriverChangeRequests", keywords: "change assign" },
    { label: "AI Chat Control", path: "/AdminChatControl", keywords: "assistant chat" },
    { label: "Driver View", path: "/DriverView", keywords: "tracking map live" },
    { label: "Live Map", path: "/LiveMap", keywords: "route tracking location" },
  ],
  hospital: [
    { label: "Hospital Home", path: "/hospital/home", keywords: "overview services beds" },
    { label: "Hospital Response", path: "/hospital/responses", keywords: "approve reject ready cases" },
    { label: "Case Reports", path: "/hospital/reports", keywords: "reports handover files" },
    { label: "View Case Report", path: "/hospital/reports", keywords: "view report transcript modified report" },
    { label: "Live Map", path: "/hospital/live-track", keywords: "ambulance tracking route" },
    { label: "Resources & Beds", path: "/hospital/resources", keywords: "icu ventilator capacity" },
    { label: "Doctors & Staff", path: "/hospital/staff", keywords: "team doctors nurses" },
  ],
  driver: [
    { label: "Driver Home", path: "/", keywords: "dashboard" },
    { label: "My Bookings", path: "/driver-dashboard?tab=bookings", keywords: "assigned requests" },
    { label: "My Ambulance", path: "/driver-dashboard?tab=ambulance", keywords: "vehicle status battery" },
    { label: "Change Request", path: "/driver-dashboard?tab=change-request", keywords: "ambulance change" },
    { label: "Request Chat", path: "/DriverRequestChat", keywords: "chat support admin" },
    { label: "Voice Reports", path: "/driver/voice-reports", keywords: "mic speech transcript report hospital" },
    { label: "Ambulances", path: "/Ambulances", keywords: "fleet list" },
    { label: "Hospitals", path: "/Hospitals", keywords: "hospital destination" },
    { label: "Live Track", path: "/driver-dashboard?tab=map", keywords: "map route tracking" },
  ],
  user: [
    { label: "Home", path: "/" },
    { label: "Ambulances", path: "/Ambulances", keywords: "availability nearby" },
    { label: "Hospitals", path: "/Hospitals", keywords: "specialization beds" },
    { label: "My Bookings", path: "/MyBookings", keywords: "requests status" },
    { label: "AI Assistant", path: "/UserChatbot", keywords: "chat help" },
    { label: "Live Track", path: "/LiveTracking", keywords: "map booking route" },
  ],
};

const Topnavbar = () => {
  const { theme, setTheme, themes } = useTheme();
  const [search, setSearch]                     = useState('');
  const [searchResults, setSearchResults]       = useState(EMPTY_SEARCH_RESULTS);
  const [showSearchDrop, setShowSearchDrop]     = useState(false);
  const [searchLoading, setSearchLoading]       = useState(false);
  const [unread, setUnread]                     = useState(0);
  const [notifications, setNotifs]              = useState([]);
  const [callAlert, setCallAlert]               = useState({ is_active_call: false, active_count: 0 });
  const [showDrop, setShowDrop]                 = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu]   = useState(false);

  const user     = localStorage.getItem("name");
  const email    = localStorage.getItem("user") || "guest";
  const role     = localStorage.getItem("role");
  const ambId    = parseInt(localStorage.getItem("ambulance_id") || "0");
  const ambIdStr = localStorage.getItem("ambulance_id") || "0";

  const dpKey = `sr-profile-pic-${email}`;
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem(dpKey) || null);

  useEffect(() => { setProfilePic(localStorage.getItem(dpKey) || null); }, [dpKey]);

  // Mobile search overlay open hone pe body class toggle
  useEffect(() => {
    if (showMobileSearch) document.body.classList.add('sr-search-open');
    else document.body.classList.remove('sr-search-open');
    return () => document.body.classList.remove('sr-search-open');
  }, [showMobileSearch]);

  // Screen size badalne par stale mobile overlay ko auto close karo (manual refresh ki need nahi).
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setShowMobileSearch(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const dropRef      = useRef(null);
  const searchRef    = useRef(null);
  const profileRef   = useRef(null);
  const fileInputRef = useRef(null);
  const navigate     = useNavigate();

  // ── USER notifications: apni bookings fetch karo ──
  const fetchUserNotifications = () => {
    if (role !== "user" && role !== null && role !== "") return;
    // role "user" ya logged-in non-admin non-driver
    const userEmail = email;
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(data => {
        // Sirf is user ki bookings
        const mine = data
          .filter(b => b.booked_by_email === userEmail || b.user_email === userEmail || b.booked_by === user)
          .sort((a, b) => b.id - a.id)
          .slice(0, 8);

        const notifs = mine.flatMap((b) => {
          const list = [{
            id:        `bk-${b.id}`,
            type:      "booking",
            bookingId: b.id,
            status:    b.status,
            title:     b.status === "confirmed"
                         ? `✅ Booking #${b.id} Confirmed!`
                         : b.status === "cancelled" || b.status === "rejected"
                         ? `❌ Booking #${b.id} Rejected`
                         : b.status === "completed"
                         ? `🏁 Booking #${b.id} Completed`
                         : `⏳ Booking #${b.id} Pending`,
            message:   `Ambulance: ${b.ambulance_number || "—"} · Pickup: ${b.pickup_location || "—"}`,
            timestamp: b.created_at || new Date().toISOString(),
            read:      false,
          }];
          if (b.assigned_hospital_name) {
            list.push({
              id: `ha-${b.id}`,
              type: "hospital_assigned",
              bookingId: b.id,
              status: "hospital_assigned",
              title: `🏥 Hospital Assigned for Booking #${b.id}`,
              message: `${b.assigned_hospital_name} assigned. Address: ${b.assigned_hospital_address || "-"}`,
              timestamp: b.hospital_assigned_at || b.created_at || new Date().toISOString(),
              read: false,
            });
          }
          if (b.reassigned_due_to_unavailability) {
            list.push({
              id: `ra-${b.id}`,
              type: "ambulance_reassigned",
              bookingId: b.id,
              status: "ambulance_reassigned",
              title: `🚑 New Ambulance Assigned (#${b.id})`,
              message: `Driver unavailability ki wajah se new ambulance assign hui: ${b.ambulance_number || "-"}`,
              timestamp: b.reassigned_at || b.created_at || new Date().toISOString(),
              read: false,
            });
          }
          if (b.hospital_response === "ready" || b.hospital_response === "not_ready") {
            const isReady = b.hospital_response === "ready";
            list.push({
              id: `hr-${b.id}`,
              type: "hospital_response",
              bookingId: b.id,
              status: b.hospital_response,
              title: isReady ? `✅ Hospital Ready for Booking #${b.id}` : `⚠️ Hospital Not Ready (#${b.id})`,
              message: `${b.assigned_hospital_name || "Hospital"} · ${b.hospital_response_note || "No note"}`,
              timestamp: b.hospital_responded_at || b.created_at || new Date().toISOString(),
              read: false,
            });
          }
          return list;
        }).slice(0, 12);

        setNotifs(notifs);
        // Unread = confirmed ya rejected jo user ne abhi nahi dekha
        const notifKey = `user_notif_read_${userEmail}`;
        const readIds  = JSON.parse(localStorage.getItem(notifKey) || "[]");
        setUnread(
          notifs.filter((n) => {
            if (readIds.includes(n.id)) return false;
            return (
              n.status === "confirmed" ||
              n.status === "cancelled" ||
              n.status === "rejected" ||
              n.status === "ambulance_reassigned" ||
              n.status === "hospital_assigned" ||
              n.status === "ready" ||
              n.status === "not_ready"
            );
          }).length
        );
      })
      .catch(() => {});
  };

  // ── DRIVER notifications ──
  const fetchDriverNotifications = () => {
    if (role !== "driver") return;
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(data => {
        const mine = data.filter(b =>
          (b.ambulance_id === ambId || String(b.ambulance_id) === ambIdStr) &&
          (b.sent_to_driver || b.driver_task_completed || b.status === "completed")
        ).slice(0, 8);
        const notifKey = `dr_notif_${email}`;
        const stored   = JSON.parse(localStorage.getItem(notifKey) || "[]");
        const allNotifs = [
          ...stored.slice(0, 3),
          ...mine.map(b => ({
            id: b.id, type: "booking", bookingId: b.id,
            title:   `🚑 Booking #${b.id} — ${b.status}`,
            message: `${b.booked_by} · ${b.pickup_location}`,
            timestamp: b.created_at || new Date().toISOString(),
            read: b.status === "completed", status: b.status,
          })),
        ].slice(0, 8);
        setNotifs(allNotifs);
        setUnread(allNotifs.filter(n => !n.read).length);
      })
      .catch(() => {
        const notifKey = `dr_notif_${email}`;
        const stored   = JSON.parse(localStorage.getItem(notifKey) || "[]");
        setNotifs(stored.slice(0, 8));
        setUnread(stored.filter(n => !n.read).length);
      });
  };

  // ── ADMIN notifications ──
  const fetchAdminNotifications = () => {
    if (role !== "admin") return;
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then(r => r.json())
      .then(data => {
        setNotifs(data.slice(0, 8));
        setUnread(data.filter(b => !b.is_read).length);
      })
      .catch(() => {});
  };

  const fetchHospitalNotifications = () => {
    if (role !== "hospital") return;
    const hospitalEmail = (email || "").toLowerCase();
    fetch("http://127.0.0.1:8000/api/bookings/")
      .then((r) => r.json())
      .then((data) => {
        const mine = (Array.isArray(data) ? data : [])
          .filter((b) => String(b.assigned_hospital_email || "").toLowerCase() === hospitalEmail)
          .sort((a, b) => b.id - a.id)
          .slice(0, 12)
          .map((b) => ({
            id: `h-${b.id}`,
            type: "hospital_case",
            status: b.hospital_response || b.status,
            title: `Incoming Case #${b.id}`,
            message: `${b.booked_by || "Patient"} • ${b.pickup_location || "-"}`,
            timestamp: b.created_at || new Date().toISOString(),
            read: false,
          }));
        setNotifs(mine);
        const notifKey = `hospital_notif_read_${hospitalEmail}`;
        const readIds = JSON.parse(localStorage.getItem(notifKey) || "[]");
        setUnread(mine.filter((n) => !readIds.includes(n.id)).length);
      })
      .catch(() => {});
  };

  const fetchUnread = () => {
    if (role === "driver")      fetchDriverNotifications();
    else if (role === "admin")  fetchAdminNotifications();
    else if (role === "hospital") fetchHospitalNotifications();
    else                        fetchUserNotifications();
  };

  const fetchCallAlert = () => {
    if (role !== "admin") return;
    fetch("http://127.0.0.1:8000/api/bookings/voice/call-alert/")
      .then((r) => r.json())
      .then((d) =>
        setCallAlert({
          is_active_call: Boolean(d?.is_active_call),
          active_count: Number(d?.active_count || 0),
        })
      )
      .catch(() => setCallAlert({ is_active_call: false, active_count: 0 }));
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 8000);
    window.addEventListener("new-booking", fetchUnread);
    return () => { clearInterval(interval); window.removeEventListener("new-booking", fetchUnread); };
  }, [role, ambId]);

  useEffect(() => {
    if (role !== "admin") return;
    fetchCallAlert();
    const timer = setInterval(fetchCallAlert, 5000);
    return () => clearInterval(timer);
  }, [role]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current    && !dropRef.current.contains(e.target))    setShowDrop(false);
      if (searchRef.current  && !searchRef.current.contains(e.target))  setShowSearchDrop(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfilePic(ev.target.result);
      localStorage.setItem(dpKey, ev.target.result);
      setShowProfileMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePic = () => {
    setProfilePic(null);
    localStorage.removeItem(dpKey);
    setShowProfileMenu(false);
  };

  const doSearch = async () => {
    const q = search.trim().toLowerCase();
    if (!q) return;
    setSearchLoading(true);
    setShowSearchDrop(true);
    const roleKey = role === "admin" || role === "hospital" || role === "driver" ? role : "user";
    const match = (...vals) => vals.some((v) => String(v || "").toLowerCase().includes(q));
    const pageResults = (PANEL_PAGES[roleKey] || []).filter((p) => match(p.label, p.path, p.keywords || "")).slice(0, 8);
    const next = { ...EMPTY_SEARCH_RESULTS, pages: pageResults };

    try {
      if (roleKey === "admin") {
        const [ambRes, hospRes, bookingRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/ambulances/"),
          fetch("http://127.0.0.1:8000/api/hospitals/"),
          fetch("http://127.0.0.1:8000/api/bookings/"),
        ]);
        const [ambData, hospData, bookingData] = await Promise.all([ambRes.json(), hospRes.json(), bookingRes.json()]);
        next.ambulances = (Array.isArray(ambData) ? ambData : []).filter((a) => match(a.ambulance_number, a.driver, a.location, a.model, a.status)).slice(0, 6);
        next.hospitals = (Array.isArray(hospData) ? hospData : []).filter((h) => match(h.name, h.address, h.specializations, h.status, h.hospital_type)).slice(0, 6);
        next.bookings = (Array.isArray(bookingData) ? bookingData : []).filter((b) => match(`#${b.id}`, b.booked_by, b.booked_by_email, b.pickup_location, b.destination, b.status, b.ambulance_number, b.assigned_hospital_name)).slice(0, 6);
      } else if (roleKey === "driver") {
        const [ambRes, bookingRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/ambulances/"),
          fetch("http://127.0.0.1:8000/api/bookings/"),
        ]);
        const [ambData, bookingData] = await Promise.all([ambRes.json(), bookingRes.json()]);
        next.ambulances = (Array.isArray(ambData) ? ambData : [])
          .filter((a) => Number(a.id || 0) === Number(ambId || 0) || String(a.driver_email || "").toLowerCase() === String(email || "").toLowerCase())
          .filter((a) => match(a.ambulance_number, a.driver, a.location, a.model, a.status))
          .slice(0, 3);
        next.bookings = (Array.isArray(bookingData) ? bookingData : [])
          .filter((b) => Number(b.ambulance_id || 0) === Number(ambId || 0) || String(b.driver_email || "").toLowerCase() === String(email || "").toLowerCase())
          .filter((b) => match(`#${b.id}`, b.booked_by, b.pickup_location, b.destination, b.status, b.ambulance_number))
          .slice(0, 6);
      } else if (roleKey === "hospital") {
        const byEmailRes = await fetch(`http://127.0.0.1:8000/api/hospitals/by-email/?email=${encodeURIComponent(email)}`);
        if (byEmailRes.ok) {
          const hospitalData = await byEmailRes.json();
          const dashRes = await fetch(`http://127.0.0.1:8000/api/hospitals/${hospitalData.id}/dashboard/`);
          const dashboard = dashRes.ok ? await dashRes.json() : null;
          const queue = Array.isArray(dashboard?.queue) ? dashboard.queue : [];
          const staff = Array.isArray(dashboard?.staff) ? dashboard.staff : [];
          next.hospitals = [hospitalData].filter((h) => match(h.name, h.address, h.specializations, h.status));
          next.bookings = queue.filter((b) => match(`#${b.booking_id}`, b.patient_name, b.pickup_location, b.destination, b.ambulance_number, b.hospital_response, b.hospital_response_note)).slice(0, 6);
          next.staff = staff.filter((s) => match(s.full_name, s.role, s.specialization, s.contact_number, s.email)).slice(0, 6);
        }
      } else {
        const [ambRes, hospRes, bookingRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/ambulances/"),
          fetch("http://127.0.0.1:8000/api/hospitals/"),
          fetch("http://127.0.0.1:8000/api/bookings/"),
        ]);
        const [ambData, hospData, bookingData] = await Promise.all([ambRes.json(), hospRes.json(), bookingRes.json()]);
        next.ambulances = (Array.isArray(ambData) ? ambData : []).filter((a) => match(a.ambulance_number, a.driver, a.location, a.status)).slice(0, 5);
        next.hospitals = (Array.isArray(hospData) ? hospData : []).filter((h) => match(h.name, h.address, h.specializations, h.status)).slice(0, 5);
        next.bookings = (Array.isArray(bookingData) ? bookingData : [])
          .filter((b) => String(b.booked_by_email || "").toLowerCase() === String(email || "").toLowerCase() || String(b.user_email || "").toLowerCase() === String(email || "").toLowerCase() || String(b.booked_by || "").toLowerCase() === String(user || "").toLowerCase())
          .filter((b) => match(`#${b.id}`, b.pickup_location, b.destination, b.status, b.ambulance_number, b.assigned_hospital_name))
          .slice(0, 6);
      }
      setSearchResults(next);
    } catch {
      setSearchResults(next);
    }
    setSearchLoading(false);
  };

  const handleKeyDown      = (e) => { if (e.key==='Enter') doSearch(); if (e.key==='Escape') { setShowSearchDrop(false); setShowMobileSearch(false); } };
  const handleSearchChange = (e) => { setSearch(e.target.value); if (!e.target.value.trim()) { setShowSearchDrop(false); setSearchResults({ ...EMPTY_SEARCH_RESULTS }); } };
  const goTo = (path) => { navigate(path); setShowSearchDrop(false); setShowMobileSearch(false); setSearch(''); };

  const openNotifs = () => {
    setShowDrop(d => !d);
    if (!showDrop) {
      if (role === "admin") {
        fetch("http://127.0.0.1:8000/api/bookings/mark-read/", { method:"POST" }).then(() => setUnread(0)).catch(()=>{});
      } else if (role === "driver") {
        const notifKey = `dr_notif_${email}`;
        const stored   = JSON.parse(localStorage.getItem(notifKey) || "[]");
        localStorage.setItem(notifKey, JSON.stringify(stored.map(n => ({ ...n, read: true }))));
        setUnread(0);
      } else if (role === "hospital") {
        const notifKey = `hospital_notif_read_${(email || "").toLowerCase()}`;
        const allIds = notifications.map((n) => n.id);
        localStorage.setItem(notifKey, JSON.stringify(allIds));
        setUnread(0);
      } else {
        // User: mark all as read in localStorage
        const notifKey = `user_notif_read_${email}`;
        const allIds   = notifications.map(n => n.id);
        localStorage.setItem(notifKey, JSON.stringify(allIds));
        setUnread(0);
      }
    }
  };

  const logoutUser = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("name");
    localStorage.removeItem("role");
    // Keep hospital_id and saved hospital data so the next login restores the
    // same Django-backed hospital profile instead of showing an empty form.
    window.location.reload();
  };

  const totalResults = Object.values(searchResults).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  const handleNotifClick = (n) => {
    setShowDrop(false);
    if (role === "driver") navigate("/");
    else if (role === "admin") navigate("/Requests");
    else if (role === "hospital") navigate("/hospital/queue");
    else navigate("/MyBookings");
  };

  // Status ke hisaab se color
  const getStatusStyle = (status) => {
    if (status === "confirmed")  return { bg:"rgba(0,212,170,0.12)",  color:"#00d4aa", border:"rgba(0,212,170,0.3)"  };
    if (status === "cancelled" || status === "rejected")
                                 return { bg:"rgba(229,9,20,0.12)",   color:"#ff4d5a", border:"rgba(229,9,20,0.3)"   };
    if (status === "completed")  return { bg:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)", border:"rgba(255,255,255,0.15)" };
    return                              { bg:"rgba(247,201,72,0.12)", color:"#f7c948", border:"rgba(247,201,72,0.3)"  }; // pending
  };

  const SearchDropdown = () => (
    <div className="nf-search-drop">
      {searchLoading ? (
        <div className="nf-sd-loading">🔍 Searching...</div>
      ) : totalResults === 0 ? (
        <div className="nf-sd-empty">
          No results for <strong>"{search}"</strong><br/>
          <span style={{fontSize:11}}>Only your panel access data is searchable.</span>
        </div>
      ) : (
        <>
          {searchResults.pages.length > 0 && (
            <>
              <div className="nf-sd-section">📌 Panel Pages</div>
              {searchResults.pages.map((p) => (
                <div key={p.path} className="nf-sd-item">
                  <div className="nf-sd-icon">📄</div>
                  <div className="nf-sd-info">
                    <div className="nf-sd-name">{p.label}</div>
                    <div className="nf-sd-sub">{p.path}</div>
                  </div>
                  <div className="nf-sd-right">
                    <button className="nf-sd-details-btn" onClick={() => goTo(p.path)}>Open →</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {searchResults.ambulances.length > 0 && (
            <>
              <div className="nf-sd-section">🚑 Ambulances</div>
              {searchResults.ambulances.map((a) => (
                <div key={a.id} className="nf-sd-item">
                  <div className="nf-sd-icon nf-sd-icon-amb">🚑</div>
                  <div className="nf-sd-info">
                    <div className="nf-sd-name">{a.ambulance_number}</div>
                    <div className="nf-sd-sub">{a.driver} · {a.location||"—"}</div>
                  </div>
                  <div className="nf-sd-right">
                    <span className={`nf-sd-badge nf-sd-badge-${a.status}`}>{a.status?.replace("_"," ")}</span>
                    <button className="nf-sd-details-btn" onClick={() => goTo("/Ambulances")}>Check Details →</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {searchResults.hospitals.length > 0 && (
            <>
              <div className="nf-sd-section">🏥 Hospitals</div>
              {searchResults.hospitals.map((h) => (
                <div key={h.id} className="nf-sd-item">
                  <div className="nf-sd-icon nf-sd-icon-hosp">🏥</div>
                  <div className="nf-sd-info">
                    <div className="nf-sd-name">{h.name}</div>
                    <div className="nf-sd-sub">{h.address} · Beds: {h.available_beds??'—'}</div>
                  </div>
                  <div className="nf-sd-right">
                    <span className={`nf-sd-badge nf-sd-badge-${h.status}`}>{h.status}</span>
                    <button className="nf-sd-details-btn" onClick={() => goTo("/Hospitals")}>Check Details →</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {searchResults.bookings.length > 0 && (
            <>
              <div className="nf-sd-section">📋 Cases / Bookings</div>
              {searchResults.bookings.map((b) => (
                <div key={`bk-${b.id || b.booking_id}`} className="nf-sd-item">
                  <div className="nf-sd-icon">🩺</div>
                  <div className="nf-sd-info">
                    <div className="nf-sd-name">Booking #{b.id || b.booking_id}</div>
                    <div className="nf-sd-sub">{b.booked_by || b.patient_name || "-"} · {b.pickup_location || "-"}</div>
                  </div>
                  <div className="nf-sd-right">
                    <span className={`nf-sd-badge nf-sd-badge-${(b.status || b.hospital_response || "pending").replace(" ", "_")}`}>
                      {(b.status || b.hospital_response || "pending").replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
          {searchResults.staff.length > 0 && (
            <>
              <div className="nf-sd-section">👨‍⚕️ Staff</div>
              {searchResults.staff.map((s) => (
                <div key={`st-${s.id}`} className="nf-sd-item">
                  <div className="nf-sd-icon">👤</div>
                  <div className="nf-sd-info">
                    <div className="nf-sd-name">{s.full_name}</div>
                    <div className="nf-sd-sub">{s.role} · {s.specialization || "General"}</div>
                  </div>
                  <div className="nf-sd-right">
                    <button className="nf-sd-details-btn" onClick={() => goTo("/hospital/staff")}>Open Staff →</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .nf-nav-root {
          position: fixed; top: 0; left: 0; right: 0; z-index: 12000; height: 64px;
          background: #000000 !important;
          border-bottom: 1px solid #1f1f1f !important;
          display: flex; align-items: center; padding: 0 12px 0 64px; gap: 12px;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          transition: background 0.3s, border-color 0.3s;
          box-sizing: border-box;
          overflow: visible;
        }
        .nf-brand { font-size: 18px; font-weight: 900; color: var(--sr-accent); letter-spacing: 2px; text-transform: uppercase; white-space: nowrap; flex-shrink: 0; margin-left: 8px; }
        .nf-search-wrap { position: relative; flex-shrink: 0; }
        .nf-search-inner { display: flex; align-items: center; background: var(--sr-nav-input-bg, rgba(255,255,255,0.06)); border: 1px solid var(--sr-nav-input-border, rgba(255,255,255,0.12)); border-radius: 4px; height: 36px; width: 300px; overflow: hidden; transition: border-color 0.2s, background 0.2s; }
        .nf-search-inner:focus-within { border-color: rgba(255,51,71,0.82); box-shadow: 0 0 0 2px rgba(229,9,20,0.24); }
        .nf-search-icon { padding: 0 10px; display: flex; align-items: center; flex-shrink: 0; }
        .nf-search-input { flex: 1; background: transparent; border: none; outline: none; color: var(--sr-nav-text, #fff); font-size: 13px; font-family: inherit; min-width: 0; }
        .nf-search-input::placeholder { color: var(--sr-nav-text-muted, rgba(255,255,255,0.25)); }
        .nf-search-btn { height: 100%; padding: 0 14px; background: var(--sr-accent, #e50914); border: none; border-left: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s; flex-shrink: 0; }
        .nf-search-btn:hover { background: #ff3347; }
        .nf-mobile-search-btn { display: none; width: 34px; height: 34px; border-radius: 4px; background: var(--sr-nav-input-bg); border: 1px solid var(--sr-nav-input-border); color: var(--sr-nav-text-sub); align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }

        /* Mobile search overlay — top layer */
        .nf-mobile-search-overlay {
          display: none; position: fixed; top: 64px; left: 0; right: 0;
          background: var(--sr-nav-bg); border-bottom: 1px solid var(--sr-nav-border);
          padding: 10px 16px; z-index: 12010; gap: 8px; align-items: center;
          box-sizing: border-box;
        }
        .nf-mobile-search-overlay.open { display: flex; }
        .nf-mobile-search-overlay .nf-search-inner { width: 100%; flex: 1; min-width: 0; }

        /* Pages ko push karo jab search overlay open ho */
        body.sr-search-open .hosp-root,
        body.sr-search-open .amb-root,
        body.sr-search-open [class*="-root"] {
          padding-top: 121px !important; /* 64px nav + 57px overlay */
        }

        .nf-search-drop { position: absolute; top: 42px; left: 0; width: min(410px, 95vw); background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 14px; box-shadow: 0 8px 22px rgba(0,0,0,0.2); z-index: 12020; overflow: hidden; }
        .nf-mobile-search-drop { position: fixed; top: 131px; left: 8px; right: 8px; background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 14px; box-shadow: 0 8px 22px rgba(0,0,0,0.2); z-index: 12020; max-height: 60vh; overflow-y: auto; }
        .nf-sd-section { padding: 10px 16px 4px; font-size: 10px; font-weight: 800; color: var(--sr-accent); letter-spacing: 1px; text-transform: uppercase; }
        .nf-sd-item { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-bottom: 1px solid var(--sr-border); transition: background 0.15s; }
        .nf-sd-item:hover { background: var(--sr-hover); }
        .nf-sd-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .nf-sd-icon-amb  { background: rgba(229,9,20,0.12); }
        .nf-sd-icon-hosp { background: rgba(33,150,243,0.12); }
        .nf-sd-info { flex: 1; min-width: 0; }
        .nf-sd-name { font-size: 13px; font-weight: 600; color: var(--sr-text, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nf-sd-sub  { font-size: 11px; color: var(--sr-text-sub); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nf-sd-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
        .nf-sd-badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 800; white-space: nowrap; text-transform: uppercase; }
        .nf-sd-badge-available { background: rgba(0,212,170,0.15); color: #00d4aa; }
        .nf-sd-badge-en_route  { background: rgba(247,201,72,0.15); color: #f7c948; }
        .nf-sd-badge-busy      { background: rgba(229,9,20,0.15);   color: #ff4d5a; }
        .nf-sd-badge-offline   { background: rgba(255,255,255,0.08); color: rgba(200,200,200,0.6); }
        .nf-sd-badge-active    { background: rgba(0,212,170,0.15); color: #00d4aa; }
        .nf-sd-badge-full      { background: rgba(247,201,72,0.15); color: #f7c948; }
        .nf-sd-badge-critical  { background: rgba(229,9,20,0.15);   color: #ff4d5a; }
        .nf-sd-badge-closed    { background: rgba(255,255,255,0.08); color: rgba(200,200,200,0.6); }
        .nf-sd-details-btn { font-size: 10px; font-weight: 700; background: var(--sr-accent, #e50914); color: #fff; border: none; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-family: inherit; white-space: nowrap; }
        .nf-sd-details-btn:hover { background: #ff3347; }
        .nf-sd-viewall { display: flex; align-items: center; justify-content: space-between; padding: 9px 16px; border-top: 1px solid var(--sr-border); background: var(--sr-hover); }
        .nf-sd-viewall-text { font-size: 11px; color: var(--sr-text-sub); }
        .nf-sd-viewall-btn  { font-size: 11px; font-weight: 700; color: var(--sr-accent); background: none; border: none; cursor: pointer; font-family: inherit; }
        .nf-sd-empty   { padding: 20px 16px; text-align: center; font-size: 12px; color: var(--sr-text-sub); line-height: 1.6; }
        .nf-sd-loading { padding: 18px; text-align: center; font-size: 12px; color: var(--sr-text-sub); }
        .nf-spacer { flex: 1; }
        .nf-call-wrap { position: relative; flex-shrink: 0; margin-right: 6px; }
        .nf-call-indicator { width: 36px; height: 36px; border-radius: 4px; border: 1px solid transparent; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.2s; }
        .nf-call-indicator.ok { background: rgba(22,163,74,0.16); border-color: rgba(22,163,74,0.4); color: #16a34a; }
        .nf-call-indicator.alert { background: rgba(220,38,38,0.16); border-color: rgba(220,38,38,0.5); color: #ef4444; animation: nfCallPulse 1s ease-in-out infinite; }
        .nf-call-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 9px; font-weight: 800; border-radius: 100px; min-width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid var(--sr-nav-bg, #141414); }
        @keyframes nfCallPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .nf-theme-dots { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .nf-dot { width: 18px; height: 18px; border-radius: 50%; cursor: pointer; transition: transform 0.2s, border-color 0.2s; border: 2px solid transparent; flex-shrink: 0; outline: none; }
        .nf-dot:hover { transform: scale(1.15); }
        .nf-bell-wrap { position: relative; flex-shrink: 0; }
        .nf-bell { width: 36px; height: 36px; border-radius: 4px; background: var(--sr-nav-input-bg); border: 1px solid var(--sr-nav-input-border); color: var(--sr-nav-text-sub); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
        .nf-bell:hover { color: var(--sr-nav-text, #fff); }
        .nf-badge { position: absolute; top: -5px; right: -5px; background: var(--sr-accent); color: #fff; font-size: 9px; font-weight: 800; border-radius: 100px; min-width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; padding: 0 4px; border: 2px solid var(--sr-nav-bg, #141414); }
        .nf-drop { position: absolute; top: 44px; right: 0; width: 340px; background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 14px; box-shadow: 0 10px 24px rgba(0,0,0,0.22); z-index: 12030; overflow: hidden; }
        .nf-drop-header { padding: 14px 16px; border-bottom: 1px solid var(--sr-border); display: flex; justify-content: space-between; align-items: center; }
        .nf-drop-title { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); }
        .nf-drop-count { font-size: 10px; color: var(--sr-text-sub); }
        .nf-drop-list  { max-height: 340px; overflow-y: auto; }

        /* ── User booking notification card ── */
        .nf-user-notif { padding: 12px 16px; border-bottom: 1px solid var(--sr-border); cursor: pointer; transition: background 0.15s; display: flex; flex-direction: column; gap: 6px; }
        .nf-user-notif:hover { background: var(--sr-hover); }
        .nf-user-notif-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .nf-user-notif-title { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); line-height: 1.3; }
        .nf-user-notif-time { font-size: 10px; color: var(--sr-text-muted); white-space: nowrap; flex-shrink: 0; }
        .nf-user-notif-msg { font-size: 11px; color: var(--sr-text-sub); line-height: 1.4; }
        .nf-user-notif-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 800; padding: 3px 10px; border-radius: 100px; border: 1px solid; text-transform: uppercase; letter-spacing: 0.5px; align-self: flex-start; }

        .nf-drop-item  { padding: 12px 16px; border-bottom: 1px solid var(--sr-border); cursor: pointer; transition: background 0.15s; display: flex; flex-direction: column; gap: 3px; }
        .nf-drop-item:hover { background: var(--sr-hover); }
        .nf-drop-item-top { display: flex; justify-content: space-between; align-items: center; }
        .nf-drop-amb    { font-size: 12px; font-weight: 700; color: var(--sr-text, #fff); }
        .nf-drop-time   { font-size: 10px; color: var(--sr-text-muted); }
        .nf-drop-loc    { font-size: 11px; color: var(--sr-text-sub); }
        .nf-drop-user   { font-size: 10px; color: #00d4aa; }
        .nf-drop-status { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 100px; background: rgba(229,9,20,0.15); color: #ff4d5a; border: 1px solid rgba(229,9,20,0.3); align-self: flex-start; text-transform: uppercase; letter-spacing: 0.5px; }
        .nf-drop-status-confirmed { background: rgba(0,212,170,0.15); color: #00d4aa; border-color: rgba(0,212,170,0.3); }
        .nf-drop-empty  { padding: 32px 24px; text-align: center; font-size: 12px; color: var(--sr-text-sub); }
        .nf-drop-empty-icon { font-size: 32px; margin-bottom: 8px; }
        .nf-drop-footer { padding: 10px 16px; border-top: 1px solid var(--sr-border); text-align: center; }
        .nf-drop-footer-btn { font-size: 11px; font-weight: 600; color: var(--sr-accent); background: none; border: none; cursor: pointer; font-family: inherit; }
        .nf-drop-footer-btn:hover { text-decoration: underline; }
        .nf-user { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .nf-username { font-size: 13px; font-weight: 500; color: var(--sr-nav-text-sub, rgba(255,255,255,0.5)); white-space: nowrap; }
        .nf-role-badge { font-size: 9px; font-weight: 800; border-radius: 6px; padding: 2px 8px; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; border: 1px solid; }
        .nf-role-badge-admin { background: #d90416; color: #fff; border-color: #d90416; }
        .nf-role-badge-hospital { background: rgba(37,99,235,0.16); color: #2563eb; border-color: rgba(37,99,235,0.38); }
        .nf-role-badge-driver { background: rgba(22,163,74,0.16); color: #16a34a; border-color: rgba(22,163,74,0.38); }
        .nf-avatar-wrap { position: relative; flex-shrink: 0; cursor: pointer; }
        .nf-avatar { width: 34px; height: 34px; border-radius: 50%; background: #2a2a2a; border: 2px solid var(--sr-accent); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; }
        .nf-avatar-wrap:hover .nf-avatar { box-shadow: 0 0 0 3px rgba(229,9,20,0.25); }
        .nf-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .nf-avatar-overlay { position: absolute; inset: 0; border-radius: 50%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
        .nf-avatar-wrap:hover .nf-avatar-overlay { opacity: 1; }
        .nf-profile-drop { position: absolute; top: 42px; right: 0; min-width: 200px; background: var(--sr-surface, #1a1a1a); border: 1px solid var(--sr-border); border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.2); z-index: 12040; overflow: hidden; padding: 6px 0; }
        .nf-profile-head { padding: 12px 14px 10px; border-bottom: 1px solid var(--sr-border); margin-bottom: 4px; }
        .nf-profile-email { font-size: 10px; color: var(--sr-text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
        .nf-profile-name { font-size: 13px; font-weight: 700; color: var(--sr-text, #fff); }
        .nf-profile-role { font-size: 10px; font-weight: 600; color: var(--sr-accent); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
        .nf-profile-dp-preview { width: 48px; height: 48px; border-radius: 50%; background: #2a2a2a; border: 2px solid var(--sr-accent); overflow: hidden; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #fff; }
        .nf-profile-dp-preview img { width: 100%; height: 100%; object-fit: cover; }
        .nf-profile-item { display: flex; align-items: center; gap: 9px; padding: 8px 14px; font-size: 12px; font-weight: 500; color: var(--sr-text-sub); cursor: pointer; transition: background 0.15s, color 0.15s; }
        .nf-profile-item:hover { background: var(--sr-hover); color: var(--sr-text, #fff); }
        .nf-profile-item.danger { color: #ff4d5a; }
        .nf-profile-item.danger:hover { background: rgba(229,9,20,0.1); }
        .nf-login-link { font-size: 13px; font-weight: 600; color: var(--sr-nav-text-sub); text-decoration: none; white-space: nowrap; }
        .nf-login-link:hover { color: var(--sr-nav-text, #fff); }

        @media (max-width: 1023px) {
          .nf-nav-root { padding: 0 12px 0 64px; gap: 10px; }
          .nf-search-inner { width: clamp(180px, 34vw, 300px); }
          .nf-username { display: none; }
          .nf-role-badge { display: none; }
          .nf-theme-dots { gap: 6px; }
          .nf-dot { width: 15px; height: 15px; }
        }

        @media (max-width: 767px) {
          .nf-nav-root { padding: 0 10px; gap: 6px; }
          .nf-brand { font-size: 14px; letter-spacing: 1px; margin-left: 0; }
          .nf-search-wrap { display: none; }
          .nf-mobile-search-btn { display: none; }
          .nf-mobile-search-overlay { display: none !important; }
          .nf-username { display: block; font-size: 11px; max-width: 55px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .nf-role-badge { display: none; }
          .nf-theme-dots { display: flex; gap: 4px; }
          .nf-dot { width: 12px; height: 12px; }
          .nf-drop {
            position: fixed;
            top: 66px;
            left: 8px;
            right: 8px;
            width: auto;
            max-height: calc(100vh - 140px);
            border-radius: 12px;
          }
          .nf-drop-header {
            position: sticky;
            top: 0;
            z-index: 2;
            background: var(--sr-surface, #1a1a1a);
          }
          .nf-drop-list {
            max-height: calc(100vh - 220px);
            overflow-y: auto;
          }
          .nf-drop-footer {
            position: sticky;
            bottom: 0;
            background: var(--sr-surface, #1a1a1a);
          }
          .nf-user-notif-title,
          .nf-drop-amb {
            white-space: normal;
            word-break: break-word;
          }
          .nf-user-notif-top {
            align-items: flex-start;
          }
          .nf-call-indicator { width: 32px; height: 32px; }
          .nf-bell { width: 32px; height: 32px; }
          .nf-mobile-search-btn { width: 32px; height: 32px; }
          .nf-mobile-search-overlay { padding: 8px 10px; }
          .nf-mobile-search-overlay .nf-search-btn { min-width: 54px; padding: 0 10px; font-size: 11px; }
          .nf-mobile-search-overlay .nf-search-input { font-size: 12px; }
        }

        @media (max-width: 480px) {
          .nf-brand { font-size: 12px; letter-spacing: 0.5px; margin-left: 0; }
          .nf-username { display: block; font-size: 10px; max-width: 45px; }
          .nf-theme-dots { display: flex; gap: 3px; }
          .nf-dot { width: 10px; height: 10px; }
          .nf-nav-root { gap: 4px; padding: 0 8px; }
          .nf-call-indicator { width: 30px; height: 30px; }
          .nf-bell { width: 30px; height: 30px; }
          .nf-mobile-search-btn { width: 30px; height: 30px; }
          .nf-avatar { width: 30px; height: 30px; font-size: 12px; }
          .nf-mobile-search-overlay { padding: 8px; }
          .nf-mobile-search-overlay .nf-search-icon { padding: 0 8px; }
          .nf-mobile-search-overlay .nf-search-btn { min-width: 50px; padding: 0 8px; font-size: 10px; }
        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleProfilePicChange} />

      <div className="nf-nav-root">
        <span className="nf-brand">YiCare</span>

        {/* Desktop Search */}
        <div className="nf-search-wrap" ref={searchRef}>
          <div className="nf-search-inner">
            <div className="nf-search-icon">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--sr-nav-text-muted,rgba(255,255,255,0.25))" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <input className="nf-search-input" value={search} onChange={handleSearchChange} onKeyDown={handleKeyDown} placeholder="Search ambulances, hospitals..." />
            <button className="nf-search-btn" onClick={doSearch}>Search</button>
          </div>
          {showSearchDrop && <SearchDropdown />}
        </div>

        <button className="nf-mobile-search-btn" onClick={() => setShowMobileSearch(s => !s)}>
          {showMobileSearch ? <X size={15}/> : <Search size={15}/>}
        </button>

        <div className="nf-spacer" />

        {Object.keys(themes).length > 1 ? (
          <div className="nf-theme-dots">
            {Object.entries(themes).map(([key, t]) => (
              <button key={key} className="nf-dot" title={key} onClick={() => setTheme(key)}
                style={{ background: t.dot, borderColor: theme===key ? '#ff6675' : t.dotBorder, transform: theme===key ? 'scale(1.3)' : 'scale(1)' }} />
            ))}
          </div>
        ) : null}

        {role === "admin" && (
          <div className="nf-call-wrap" title={callAlert.is_active_call ? "Incoming call in progress" : "No active incoming call"}>
            <div className={`nf-call-indicator ${callAlert.is_active_call ? "alert" : "ok"}`}>
              <PhoneCall size={15} />
            </div>
            {callAlert.active_count > 0 && (
              <span className="nf-call-badge">{callAlert.active_count > 9 ? "9+" : callAlert.active_count}</span>
            )}
          </div>
        )}

        <div className="nf-bell-wrap" ref={dropRef}>
          <button className="nf-bell" onClick={openNotifs}><Bell size={15}/></button>
          {unread > 0 && <span className="nf-badge">{unread > 9 ? "9+" : unread}</span>}
          {showDrop && (
            <div className="nf-drop">
              <div className="nf-drop-header">
                <span className="nf-drop-title">
                  {role === "driver" ? "🔔 Meri Notifications"
                   : role === "admin" ? "🔔 Notifications"
                   : role === "hospital" ? "🏥 Hospital Alerts"
                   : "🔔 Meri Bookings"}
                </span>
                <span className="nf-drop-count">{notifications.length} items</span>
              </div>
              <div className="nf-drop-list">
                {notifications.length === 0 ? (
                    <div className="nf-drop-empty">
                      <div className="nf-drop-empty-icon">🔔</div>
                      {role === "admin" || role === "driver" || role === "hospital" ? "Koi notification nahi" : "Abhi koi booking nahi"}
                    </div>
                ) : role !== "admin" && role !== "driver" && role !== "hospital" ? (
                  // ── USER: Booking status cards ──
                  notifications.map((n, i) => {
                    const ss = getStatusStyle(n.status);
                    return (
                      <div key={i} className="nf-user-notif" onClick={() => handleNotifClick(n)}>
                        <div className="nf-user-notif-top">
                          <div className="nf-user-notif-title">{n.title}</div>
                          <div className="nf-user-notif-time">
                            {n.timestamp ? new Date(n.timestamp).toLocaleString("en-IN", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) : ""}
                          </div>
                        </div>
                        <div className="nf-user-notif-msg">{n.message}</div>
                        <span className="nf-user-notif-badge" style={{ background: ss.bg, color: ss.color, borderColor: ss.border }}>
                          {n.status === "confirmed"  ? "✅ Confirmed"
                           : n.status === "cancelled" || n.status === "rejected" ? " Rejected"
                           : n.status === "completed" ? " Completed"
                           : n.status === "ambulance_reassigned" ? "New Ambulance Assigned"
                           : n.status === "hospital_assigned" ? "Hospital Assigned"
                           : n.status === "ready" ? "Hospital Ready"
                           : n.status === "not_ready" ? "Not Ready"
                           : "Pending"}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  // ── ADMIN / DRIVER: original cards ──
                  notifications.map((n, i) => (
                    <div key={i} className="nf-drop-item" onClick={() => handleNotifClick(n)}>
                      <div className="nf-drop-item-top">
                        <span className="nf-drop-amb">
                          {role === "driver"
                            ? (n.title || `${n.ambulance_number || "Notification"}`)
                            : ` ${n.ambulance_number}`}
                        </span>
                        <span className="nf-drop-time">{n.created_at || (n.timestamp ? new Date(n.timestamp).toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"}) : "")}</span>
                      </div>
                      {role === "driver"
                        ? <div className="nf-drop-loc">{n.message || n.pickup_location}</div>
                        : <>
                            <div className="nf-drop-loc"> {n.pickup_location}</div>
                            <div className="nf-drop-user">{n.booked_by}</div>
                          </>
                      }
                      <span className={`nf-drop-status ${n.status==="confirmed"?"nf-drop-status-confirmed":""}`}>
                        {n.status || n.type}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="nf-drop-footer">
                <button className="nf-drop-footer-btn"
                  onClick={() => { setShowDrop(false); navigate(role==="driver" ? "/" : role==="admin" ? "/Requests" : role==="hospital" ? "/hospital/queue" : "/Ambulances"); }}>
                  {role === "driver" ? " View Dashboard →"
                   : role === "admin" ? "View All Bookings →"
                   : role === "hospital" ? "Open Emergency Queue →"
                   : "View My Bookings →"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="nf-user">
          {user ? (
            <>
              <span className="nf-username">{user}</span>
              {role === "admin" && <span className="nf-role-badge nf-role-badge-admin">Admin</span>}
              {role === "hospital" && <span className="nf-role-badge nf-role-badge-hospital">Hospital</span>}
              {role === "driver" && <span className="nf-role-badge nf-role-badge-driver">Driver</span>}
              <div className="nf-avatar-wrap" ref={profileRef} onClick={() => setShowProfileMenu(m => !m)}>
                <div className="nf-avatar">
                  {profilePic ? <img src={profilePic} alt="profile"/> : <span>{user[0]?.toUpperCase()}</span>}
                </div>
                <div className="nf-avatar-overlay"><Camera size={12} color="#fff"/></div>
                {showProfileMenu && (
                  <div className="nf-profile-drop" onClick={e => e.stopPropagation()}>
                    <div className="nf-profile-head" style={{ textAlign:"center" }}>
                      <div className="nf-profile-dp-preview">
                        {profilePic ? <img src={profilePic} alt="dp"/> : <span>{user[0]?.toUpperCase()}</span>}
                      </div>
                      <div className="nf-profile-name">{user}</div>
                      <div className="nf-profile-email">{email}</div>
                      {role && <div className="nf-profile-role">{role}</div>}
                    </div>
                    <div className="nf-profile-item" onClick={() => fileInputRef.current?.click()}>
                      <Camera size={13}/>{profilePic ? "Change Photo" : "Upload Photo"}
                    </div>
                    {profilePic && (
                      <div className="nf-profile-item danger" onClick={removeProfilePic}>
                        <X size={13}/>Remove Photo
                      </div>
                    )}
                    <div className="nf-profile-item danger" onClick={logoutUser}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Logout
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="nf-avatar"><span>U</span></div>
              <Link to="/login" className="nf-login-link">Login</Link>
            </>
          )}
        </div>
      </div>

      <div className={`nf-mobile-search-overlay ${showMobileSearch ? 'open' : ''}`}>
        <div className="nf-search-inner" style={{flex:1}}>
          <div className="nf-search-icon">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="var(--sr-nav-text-muted,rgba(255,255,255,0.25))" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input className="nf-search-input" value={search} onChange={handleSearchChange} onKeyDown={handleKeyDown} placeholder="Search..." autoFocus/>
          <button className="nf-search-btn" onClick={doSearch}>Go</button>
        </div>
        {showSearchDrop && totalResults > 0 && (
          <div className="nf-mobile-search-drop"><SearchDropdown/></div>
        )}
      </div>
    </>
  );
};

export default Topnavbar;
