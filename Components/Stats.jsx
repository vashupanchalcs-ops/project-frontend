import Activevehicles from "../assets/Stats/Activevehicles";
import Fuelefficiency from "../assets/Stats/Fuelefficiency";
import Successrate from "../assets/Stats/Succcessrate";
import Totalcases from "../assets/Stats/Totalcases";

const cards = [
  { component: <Activevehicles />, accent: "#E50914" },
  { component: <Successrate />,   accent: "#E50914" },
  { component: <Totalcases />,    accent: "#E50914" },
  { component: <Fuelefficiency />, accent: "#E50914" },
];

const Stats = () => {
  return (
    <>
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 10px;
          height: 100%;
          width: 100%;
          padding: 10px;
          box-sizing: border-box;
        }
        .stats-card {
          background: var(--sr-stat-bg, #1a1a1a);
          border: 1px solid var(--sr-border, rgba(255,255,255,0.08));
          border-radius: 16px;
          padding: 20px 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s, transform 0.2s, background 0.3s;
          min-height: 0;
        }
        .stats-card:hover {
          border-color: rgba(229,9,20,0.4);
          transform: scale(1.02);
        }
        .stats-card-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: #E50914;
          border-radius: 16px 16px 0 0;
        }

        /* ── Stat card inner styles ── */
        .stats-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .stats-card-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--sr-text-sub);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .stats-card-icon {
          color: var(--sr-icon, rgba(255,255,255,0.4));
          display: flex;
          align-items: center;
        }
        .stats-card-value {
          font-size: 32px;
          font-weight: 800;
          color: var(--sr-text);
          line-height: 1;
          letter-spacing: -1px;
        }
        .stats-card-sub {
          font-size: 10px;
          color: var(--sr-text-muted);
          margin-top: 4px;
        }

        /* ── Responsive sizing ── */
        @media (max-width: 1279px) {
          .stats-card { padding: 16px 18px; }
          .stats-card-value { font-size: 26px; }
        }
        @media (max-width: 1023px) {
          .stats-card { padding: 14px 16px; border-radius: 12px; }
          .stats-card-value { font-size: 24px; }
        }
        @media (max-width: 767px) {
          .stats-grid { gap: 8px; padding: 8px; }
          .stats-card { padding: 12px 14px; border-radius: 12px; }
          .stats-card:hover { transform: none; }
          .stats-card-value { font-size: 22px; }
        }
      `}</style>

      <div className="stats-grid">
        {cards.map((c, i) => (
          <div key={i} className="stats-card">
            <div className="stats-card-bar" />
            {c.component}
          </div>
        ))}
      </div>
    </>
  );
};

export default Stats;
