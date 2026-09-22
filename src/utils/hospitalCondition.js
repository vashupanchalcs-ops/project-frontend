const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

/**
 * Derive the admin-facing health colour from the same capacity counters that
 * the hospital portal displays. This keeps the list and detail views honest
 * when beds or staff change in the backend.
 */
export function getHospitalCondition(hospital = {}) {
  const totalBeds = numberValue(hospital.total_beds);
  const availableBeds = Math.min(numberValue(hospital.available_beds), totalBeds || numberValue(hospital.available_beds));
  const totalIcuBeds = numberValue(hospital.icu_beds);
  const availableIcuBeds = Math.min(numberValue(hospital.available_icu_beds), totalIcuBeds || numberValue(hospital.available_icu_beds));
  const totalStaff = numberValue(hospital.staff_total_count ?? ((numberValue(hospital.doctors_count) + numberValue(hospital.nurses_count))));
  const activeStaff = Math.min(numberValue(hospital.staff_active_count), totalStaff || numberValue(hospital.staff_active_count));

  const bedRatio = totalBeds > 0 ? availableBeds / totalBeds : 0;
  const icuRatio = totalIcuBeds > 0 ? availableIcuBeds / totalIcuBeds : 1;
  const staffRatio = totalStaff > 0 ? activeStaff / totalStaff : 0;
  const inactive = hospital.is_active === false || String(hospital.status || "").toLowerCase() === "closed";

  if (
    inactive ||
    totalBeds === 0 ||
    availableBeds === 0 ||
    (totalIcuBeds > 0 && availableIcuBeds === 0) ||
    (totalStaff > 0 && activeStaff === 0)
  ) {
    return {
      key: "red",
      label: "Red",
      description: "Immediate capacity or availability concern",
      totalBeds,
      availableBeds,
      totalIcuBeds,
      availableIcuBeds,
      totalStaff,
      activeStaff,
    };
  }

  if (
    bedRatio <= 0.25 ||
    (totalIcuBeds > 0 && icuRatio <= 0.25) ||
    totalStaff === 0 ||
    staffRatio < 0.6
  ) {
    return {
      key: "yellow",
      label: "Yellow",
      description: "Limited beds, ICU or staff availability",
      totalBeds,
      availableBeds,
      totalIcuBeds,
      availableIcuBeds,
      totalStaff,
      activeStaff,
    };
  }

  return {
    key: "green",
    label: "Green",
    description: "Beds, ICU and staff capacity available",
    totalBeds,
    availableBeds,
    totalIcuBeds,
    availableIcuBeds,
    totalStaff,
    activeStaff,
  };
}

export function formatHospitalDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
