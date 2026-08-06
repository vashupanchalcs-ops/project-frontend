export const BILLING_RATES = {
  baseFare: 500,
  includedKm: 3,
  perKm: 65,
  emergencyDispatchFee: 250,
  serviceFee: 150,
  gstRate: 0.05,
  fallbackDistanceKm: 8,
};

export const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

export const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const numeric = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const parseKm = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).replace(",", "").match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const km = Number(match[0]);
  return Number.isFinite(km) && km > 0 ? km : null;
};

export const haversineKm = (a, b) => {
  if (!a || !b) return null;
  const aLat = numeric(a.lat);
  const aLng = numeric(a.lng);
  const bLat = numeric(b.lat);
  const bLng = numeric(b.lng);
  if ([aLat, aLng, bLat, bLng].some((x) => x === null)) return null;
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const coord = (lat, lng) => {
  const nLat = numeric(lat);
  const nLng = numeric(lng);
  if (nLat === null || nLng === null) return null;
  return { lat: nLat, lng: nLng };
};

export const estimateCaseDistanceKm = ({ booking, ambulance, hospital, route }) => {
  const routeKm =
    parseKm(route?.distance_km) ||
    parseKm(route?.distance) ||
    parseKm(route?.distance_text) ||
    parseKm(route?.best_route?.distance_text) ||
    parseKm(route?.best_route?.distance);
  if (routeKm) return { km: routeKm, source: "Actual route distance" };

  const pickup = coord(booking?.pickup_latitude, booking?.pickup_longitude);
  const amb = coord(ambulance?.latitude, ambulance?.longitude);
  const hosp = coord(hospital?.latitude, hospital?.longitude);

  const leg1 = amb && pickup ? haversineKm(amb, pickup) : 0;
  const leg2 = pickup && hosp ? haversineKm(pickup, hosp) : null;
  if (leg2 !== null) {
    return {
      km: Number(((leg1 + leg2) * 1.22).toFixed(1)),
      source: amb ? "GPS estimate: ambulance to pickup to hospital" : "GPS estimate: pickup to hospital",
    };
  }

  return {
    km: BILLING_RATES.fallbackDistanceKm,
    source: "Default estimate because route distance is unavailable",
  };
};

export const calculateBookingBill = ({ booking, ambulance, hospital, route } = {}) => {
  const distance = estimateCaseDistanceKm({ booking, ambulance, hospital, route });
  const distanceKm = Math.max(0, Number(distance.km || 0));
  const extraKm = Math.max(0, distanceKm - BILLING_RATES.includedKm);
  const distanceCharge = Math.round(extraKm * BILLING_RATES.perKm);
  const subtotal =
    BILLING_RATES.baseFare +
    distanceCharge +
    BILLING_RATES.emergencyDispatchFee +
    BILLING_RATES.serviceFee;
  const gst = Math.round(subtotal * BILLING_RATES.gstRate);
  const total = subtotal + gst;

  return {
    distanceKm,
    distanceSource: distance.source,
    extraKm,
    baseFare: BILLING_RATES.baseFare,
    distanceCharge,
    emergencyDispatchFee: BILLING_RATES.emergencyDispatchFee,
    serviceFee: BILLING_RATES.serviceFee,
    gst,
    subtotal,
    total,
    formula: `Base ${formatMoney(BILLING_RATES.baseFare)} for first ${BILLING_RATES.includedKm} km + ${formatMoney(BILLING_RATES.perKm)}/km after that + emergency dispatch + service fee + 5% GST`,
  };
};
