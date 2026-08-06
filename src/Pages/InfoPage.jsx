import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

const PAGE_DATA = {
  about: {
    title: "About SwiftRescue",
    subtitle: "Emergency response network built for real-time city coordination",
    blocks: [
      {
        h: "Who We Are",
        p: "SwiftRescue is a dispatch-first emergency platform that connects users, ambulances, hospitals, and control teams in one operational command flow.",
      },
      {
        h: "What We Solve",
        p: "We reduce response delays by combining live tracking, booking workflow, hospital readiness, and dispatch approvals in one connected system.",
      },
      {
        h: "Core Promise",
        p: "Faster response. Better routing. Transparent status updates from booking request to hospital handover.",
      },
    ],
  },
  support: {
    title: "Support",
    subtitle: "Rapid support channels for dispatch, driver, and hospital teams",
    blocks: [
      { h: "24x7 Support Desk", p: "For urgent workflow issues, contact operations immediately." },
      { h: "Email", p: "support@swiftrescue.in" },
      { h: "Emergency Hotline", p: "+91 99998 70751" },
      { h: "SLA", p: "Critical operational tickets are prioritized with fast-response escalation." },
    ],
  },
  help: {
    title: "Help Center",
    subtitle: "Quick answers for users, drivers, hospitals, and admin teams",
    blocks: [
      { h: "How to Book", p: "Open Ambulances page, choose available unit, confirm pickup, and submit." },
      { h: "Live Tracking", p: "Track ambulance movement and route updates from your panel." },
      { h: "Hospital Workflow", p: "Hospital can approve/reject intake, then admin dispatch continues." },
      { h: "Driver Workflow", p: "Driver accepts dispatch, navigates route, submits report, and completes task." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    subtitle: "How SwiftRescue handles operational and emergency data",
    blocks: [
      { h: "Data Collected", p: "Booking details, route telemetry, hospital response status, and operational logs." },
      { h: "Usage", p: "Data is used only for emergency coordination, dispatch efficiency, and audit traceability." },
      { h: "Retention", p: "Critical records are retained for compliance and operational review windows." },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    subtitle: "Platform usage terms for emergency response stakeholders",
    blocks: [
      { h: "Authorized Access", p: "Only verified panel users should access workflow actions." },
      { h: "Operational Integrity", p: "False bookings and misuse are restricted under service policy." },
      { h: "Service Scope", p: "Dispatch and routing depend on availability, traffic, and hospital readiness." },
    ],
  },
  contact: {
    title: "Contact Us",
    subtitle: "Reach SwiftRescue command and integration teams",
    blocks: [
      { h: "Control Room", p: "ops@swiftrescue.in" },
      { h: "Hospital Integration", p: "hospitals@swiftrescue.in" },
      { h: "Business Partnerships", p: "partners@swiftrescue.in" },
      { h: "Phone", p: "+91 99998 70751" },
    ],
  },
};

export default function InfoPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const data = useMemo(() => PAGE_DATA[section] || PAGE_DATA.about, [section]);

  return (
    <>
      <style>{`
        .ip-root{
          min-height:100vh;
          padding:64px 0 0 64px;
          background:var(--sr-bg,#f7f7f2);
          color:var(--sr-text,#111);
        }
        .ip-wrap{
          max-width:1260px;
          margin:0 auto;
          padding:26px 22px 86px;
        }
        .ip-hero{
          border:1px solid rgba(20,20,20,0.12);
          border-radius:24px;
          background:linear-gradient(150deg,#fff 0%,#fbfce8 100%);
          padding:24px;
        }
        .ip-kicker{
          font-size:11px;
          font-weight:800;
          letter-spacing:1px;
          text-transform:uppercase;
          color:#8c9600;
        }
        .ip-title{
          margin:6px 0 8px;
          font-size:clamp(30px,5vw,64px);
          line-height:0.95;
          letter-spacing:-1px;
          font-family:Georgia,"Times New Roman",serif;
        }
        .ip-sub{
          margin:0;
          font-size:15px;
          line-height:1.65;
          color:rgba(17,17,17,0.75);
          max-width:820px;
        }
        .ip-grid{
          margin-top:16px;
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }
        .ip-card{
          border:1px solid rgba(20,20,20,0.12);
          border-radius:18px;
          background:#fff;
          padding:16px;
          transition:transform .16s,border-color .16s,box-shadow .16s;
        }
        .ip-card:hover{
          transform:translateY(-2px);
          border-color:rgba(214,232,0,.9);
          box-shadow:0 12px 26px rgba(214,232,0,.22);
        }
        .ip-card h3{
          margin:0 0 6px;
          font-size:20px;
          line-height:1.2;
          font-family:Georgia,"Times New Roman",serif;
        }
        .ip-card p{
          margin:0;
          font-size:14px;
          line-height:1.6;
          color:rgba(17,17,17,.72);
        }
        .ip-actions{
          margin-top:16px;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }
        .ip-btn{
          border:1px solid rgba(20,20,20,.14);
          border-radius:10px;
          background:#fff;
          color:#111;
          font-size:12px;
          font-weight:800;
          padding:10px 14px;
          cursor:pointer;
          font-family:inherit;
        }
        .ip-btn.main{
          background:#d6e800;
          border-color:#d6e800;
        }
        @media(max-width:767px){
          .ip-root{padding-left:0;padding-bottom:84px;}
          .ip-wrap{padding:14px 12px 98px;}
          .ip-grid{grid-template-columns:1fr;}
        }
      `}</style>
      <div className="ip-root">
        <div className="ip-wrap">
          <section className="ip-hero">
            <div className="ip-kicker">SwiftRescue Information</div>
            <h1 className="ip-title">{data.title}</h1>
            <p className="ip-sub">{data.subtitle}</p>
          </section>

          <section className="ip-grid">
            {data.blocks.map((b, idx) => (
              <article key={`${b.h}-${idx}`} className="ip-card">
                <h3>{b.h}</h3>
                <p>{b.p}</p>
              </article>
            ))}
          </section>

          <div className="ip-actions">
            <button className="ip-btn main" onClick={() => navigate("/")}>Back To Home</button>
            <button className="ip-btn" onClick={() => navigate("/info/help")}>Help Center</button>
            <button className="ip-btn" onClick={() => navigate("/info/support")}>Support</button>
          </div>
        </div>
      </div>
    </>
  );
}

