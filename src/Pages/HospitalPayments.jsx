import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, CreditCard, MoreHorizontal, RefreshCw, Search, SlidersHorizontal, Star } from "lucide-react";

const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const BASE = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
const PAGE_SIZE = 10;

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const formatShortDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const initials = (name) =>
  String(name || "Patient")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";

const calculateHospitalBill = (booking) => {
  const admittedRaw = booking?.hospital_responded_at || booking?.hospital_assigned_at || booking?.created_at;
  const admittedAt = admittedRaw ? new Date(admittedRaw) : null;
  const validAdmit = admittedAt && !Number.isNaN(admittedAt.getTime());
  const daysAdmitted = validAdmit
    ? Math.max(1, Math.ceil((Date.now() - admittedAt.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  const baseCharge = 2800;
  const dailyRate = 4200;
  const dailyCare = dailyRate * daysAdmitted;
  const isCritical = String(booking?.patient_condition || booking?.pre_diagnosis_note || "")
    .toLowerCase()
    .includes("critical");
  const icuCharge = isCritical || booking?.icu_required ? 8500 : 0;
  const ambulanceCharge = booking?.ambulance_number ? 1800 : 0;
  return {
    total: baseCharge + dailyCare + icuCharge + ambulanceCharge,
    daysAdmitted,
  };
};

const paymentStatus = (booking) => {
  const raw = String(booking?.payment_status || booking?.invoice_status || "").toLowerCase();
  if (["paid", "settled", "completed"].includes(raw) || booking?.status === "completed") return "Paid";
  if (["cancelled", "canceled", "void"].includes(raw) || booking?.status === "cancelled") return "Cancelled";
  return "Due";
};

export default function HospitalPayments() {
  const navigate = useNavigate();
  const [hospital, setHospital] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const loadPayments = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      let hospitalId = Number(localStorage.getItem("hospital_id") || 0);
      if (!hospitalId) {
        const email = (localStorage.getItem("user") || "").trim().toLowerCase();
        if (email) {
          const byEmail = await fetch(`${BASE}/api/hospitals/by-email/?email=${encodeURIComponent(email)}`);
          if (byEmail.ok) hospitalId = Number((await byEmail.json())?.id || 0);
        }
      }
      if (!hospitalId) throw new Error("Hospital profile not configured for this account");

      localStorage.setItem("hospital_id", String(hospitalId));
      const response = await fetch(`${BASE}/api/hospitals/${hospitalId}/dashboard/?_=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Payment records could not be loaded");
      const data = await response.json();
      setHospital(data?.hospital || null);
      setBookings(Array.isArray(data?.queue) ? data.queue : []);
      setLastSyncedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (requestError) {
      setError(requestError?.message || "Payment records could not be loaded");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const invoices = useMemo(() => bookings.map((booking) => {
    const bill = calculateHospitalBill(booking);
    const status = paymentStatus(booking);
    const total = Number(booking?.total_amount ?? booking?.current_bill ?? bill.total);
    const amountDue = Number(booking?.amount_due ?? (status === "Paid" ? 0 : total));
    const customer = booking?.patient_name || booking?.booked_by || "Unknown patient";
    return {
      ...booking,
      invoiceNumber: `INV-${String(booking.booking_id || "").padStart(6, "0")}`,
      customer,
      status,
      total,
      amountDue,
      date: booking?.created_at || booking?.hospital_assigned_at,
      daysAdmitted: bill.daysAdmitted,
    };
  }), [bookings]);

  const filteredInvoices = useMemo(() => {
    const term = query.trim().toLowerCase();
    const cutoff = dateFilter === "30" ? Date.now() - 30 * 24 * 60 * 60 * 1000 : 0;
    return invoices.filter((invoice) => {
      const searchable = [invoice.invoiceNumber, invoice.customer, invoice.booked_by, invoice.booking_id, invoice.pickup_location].join(" ").toLowerCase();
      const date = invoice.date ? new Date(invoice.date).getTime() : 0;
      return (!term || searchable.includes(term)) &&
        (statusFilter === "all" || invoice.status.toLowerCase() === statusFilter) &&
        (!cutoff || !date || date >= cutoff);
    });
  }, [dateFilter, invoices, query, statusFilter]);

  useEffect(() => { setPage(1); }, [dateFilter, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const visibleInvoices = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilterCount = Number(statusFilter !== "all") + Number(dateFilter !== "all") + Number(Boolean(query.trim()));

  return (
    <main className="hospital-payments-page">
      <style>{`
        .hospital-payments-page{min-height:100vh;padding:64px 0 0 64px;background:#f7f8f6;color:#111827;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box}
        .hospital-payments-page *{box-sizing:border-box}
        .payments-wrap{width:100%;padding:20px 24px 76px}
        .payments-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #cbd5c9;border-radius:14px;background:#fff;padding:12px 16px;margin-bottom:16px}
        .payments-toolbar-title{font-size:14px;font-weight:850;color:#111827}.payments-toolbar-meta{display:flex;align-items:center;gap:14px;color:#64748b;font-size:12px}.payments-refresh{border:0;border-radius:8px;background:#f59e0b;color:#111827;padding:10px 16px;font-weight:850;cursor:pointer}.payments-refresh:disabled{opacity:.65;cursor:wait}
        .payments-panel{border:1px solid #b9d7bf;border-radius:16px;background:#fff;overflow:hidden}.payments-panel-head{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid #cfe0d1;padding:18px 20px}.payments-panel-head h1{margin:0;font-size:22px;letter-spacing:-.03em}.payments-panel-head p{margin:5px 0 0;color:#64748b;font-size:13px}.payments-count{border:1px solid #f59e0b;border-radius:8px;background:#fff4df;min-width:110px;padding:10px 14px;text-align:center;color:#111827}.payments-count b{display:block;font-size:22px;line-height:1}.payments-count span{display:block;margin-top:5px;font-size:10px;font-weight:850;text-transform:uppercase}
        .payments-controls{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid #edf1ed;flex-wrap:wrap}.payments-filter-button{display:inline-flex;align-items:center;gap:7px;border:1px solid #dce5dd;border-radius:9px;background:#fff;padding:9px 12px;font-weight:800;color:#334155}.payments-filter-count{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#2563eb;color:#fff;font-size:11px}.payments-select-wrap{position:relative}.payments-select{appearance:none;border:1px solid #dce5dd;border-radius:9px;background:#fff;color:#334155;padding:9px 32px 9px 11px;font:inherit;font-size:12px;font-weight:750}.payments-select-wrap svg{position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:#64748b}.payments-search{display:flex;align-items:center;gap:8px;margin-left:auto;width:min(270px,100%);border:1px solid #dce5dd;border-radius:9px;padding:8px 10px;color:#64748b}.payments-search input{width:100%;border:0;outline:0;background:transparent;font:inherit;font-size:12px;color:#111827}
        .payments-table-wrap{overflow-x:auto}.payments-table{width:100%;min-width:900px;border-collapse:collapse;font-size:13px}.payments-table th{height:42px;padding:0 12px;text-align:left;background:#fafcfb;color:#64748b;border-bottom:1px solid #e6eee7;font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}.payments-table td{height:58px;padding:9px 12px;border-bottom:1px solid #eef2ef;vertical-align:middle;color:#334155}.payments-table tbody tr:hover{background:#fbfefb}.payments-table th:first-child,.payments-table td:first-child{width:42px;padding-left:20px;padding-right:4px}.payments-table th:last-child,.payments-table td:last-child{width:52px;padding-right:20px;text-align:right}.payments-star{border:0;background:transparent;color:#cbd5e1;padding:4px;cursor:pointer}.payments-star:hover{color:#f59e0b}.payments-number{font-weight:850;color:#1f2937}.payments-status{display:inline-flex;align-items:center;border-radius:6px;padding:5px 9px;font-size:11px;font-weight:850}.payments-status.paid{background:#e6f7ef;color:#14804a}.payments-status.due{background:#fff4df;color:#a16207}.payments-status.cancelled{background:#f1f5f9;color:#64748b}.payments-customer{display:flex;align-items:center;gap:9px;min-width:160px}.payments-avatar{display:grid;place-items:center;flex:0 0 auto;width:28px;height:28px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:900}.payments-customer-name{font-weight:750;color:#1f2937}.payments-customer-detail{margin-top:2px;color:#94a3b8;font-size:10px;white-space:nowrap}.payments-money{font-weight:750;color:#334155;white-space:nowrap}.payments-due{color:#a16207}.payments-actions{border:0;background:transparent;color:#64748b;padding:6px;cursor:pointer}.payments-actions:hover{color:#111827}.payments-empty{padding:54px 20px;text-align:center;color:#64748b}.payments-error{margin:16px 20px 0;border:1px solid #fecaca;border-radius:9px;background:#fff1f2;color:#b91c1c;padding:11px 13px;font-size:12px;font-weight:700}.payments-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;color:#64748b;font-size:12px}.payments-pagination{display:flex;align-items:center;gap:9px}.payments-page-button{border:1px solid #dce5dd;border-radius:7px;background:#fff;color:#334155;padding:6px 10px;cursor:pointer}.payments-page-button:disabled{opacity:.45;cursor:not-allowed}.payments-page-number{font-weight:800;color:#334155}
        @media(max-width:720px){.hospital-payments-page{padding-left:64px}.payments-wrap{padding:14px 10px 76px}.payments-toolbar{align-items:flex-start;flex-direction:column}.payments-toolbar-meta{width:100%;justify-content:space-between}.payments-panel-head{align-items:flex-start;flex-direction:column}.payments-count{align-self:stretch}.payments-search{margin-left:0;flex:1 1 100%;width:100%}.payments-footer{align-items:flex-start;flex-direction:column}}
      `}</style>

      <div className="payments-wrap">
        <div className="payments-toolbar">
          <div className="payments-toolbar-title">Hospital Payments</div>
          <div className="payments-toolbar-meta">
            <span>{lastSyncedAt ? `Last sync: ${lastSyncedAt}` : "Live case billing"}</span>
            <button className="payments-refresh" type="button" onClick={() => loadPayments({ silent: true })} disabled={loading || refreshing}>
              <RefreshCw size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <section className="payments-panel">
          <div className="payments-panel-head">
            <div>
              <h1>Invoices &amp; payments</h1>
              <p>{hospital?.name || "Hospital"} · Billing records generated from admitted and assigned cases.</p>
            </div>
            <div className="payments-count"><b>{filteredInvoices.length}</b><span>Invoices shown</span></div>
          </div>

          <div className="payments-controls">
            <span className="payments-filter-button"><SlidersHorizontal size={14} /> Filter <span className="payments-filter-count">{activeFilterCount}</span></span>
            <div className="payments-select-wrap">
              <select className="payments-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter payment status">
                <option value="all">All statuses</option><option value="paid">Paid</option><option value="due">Due</option><option value="cancelled">Cancelled</option>
              </select><ChevronDown size={14} />
            </div>
            <div className="payments-select-wrap">
              <select className="payments-select" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter payment date">
                <option value="all">All dates</option><option value="30">Last 30 days</option>
              </select><ChevronDown size={14} />
            </div>
            <label className="payments-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or customer" /></label>
          </div>

          {error && <div className="payments-error">{error}</div>}
          <div className="payments-table-wrap">
            <table className="payments-table">
              <thead><tr><th aria-label="Favourite" /><th>Number</th><th>Status</th><th>Date</th><th>Customer</th><th>Total</th><th>Amount due</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan="8" className="payments-empty">Loading payment records…</td></tr> : visibleInvoices.length === 0 ? <tr><td colSpan="8" className="payments-empty">No payment records match the selected filters.</td></tr> : visibleInvoices.map((invoice) => (
                  <tr key={invoice.booking_id}>
                    <td><button className="payments-star" type="button" aria-label={`Mark ${invoice.invoiceNumber} as favourite`}><Star size={16} /></button></td>
                    <td><span className="payments-number">{invoice.invoiceNumber}</span><div className="payments-customer-detail">Booking #{invoice.booking_id}</div></td>
                    <td><span className={`payments-status ${invoice.status.toLowerCase()}`}>{invoice.status}</span></td>
                    <td>{formatShortDate(invoice.date)}</td>
                    <td><div className="payments-customer"><span className="payments-avatar">{initials(invoice.customer)}</span><span><span className="payments-customer-name">{invoice.customer}</span><span className="payments-customer-detail">{invoice.patient_contact_number || invoice.booked_by_email || `${invoice.daysAdmitted} day${invoice.daysAdmitted === 1 ? "" : "s"} admitted`}</span></span></div></td>
                    <td className="payments-money">{formatMoney(invoice.total)}</td>
                    <td className={`payments-money ${invoice.amountDue > 0 ? "payments-due" : ""}`}>{formatMoney(invoice.amountDue)}</td>
                    <td><button className="payments-actions" type="button" onClick={() => navigate(`/hospital/cases/${invoice.booking_id}`)} title="Open case"><MoreHorizontal size={18} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="payments-footer">
            <span>Showing {filteredInvoices.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length} results</span>
            <div className="payments-pagination"><button className="payments-page-button" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Previous</button><span className="payments-page-number">Page {page} of {pageCount}</span><button className="payments-page-button" type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page >= pageCount}>Next</button></div>
          </div>
        </section>
      </div>
    </main>
  );
}
