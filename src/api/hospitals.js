import { apiGet, apiPatch } from "./client";

export const listHospitals = (options) => apiGet("/api/hospitals/", options);
export const getHospital = (id, options) => apiGet(`/api/hospitals/${id}/`, options);
export const updateHospital = (id, payload, options) => apiPatch(`/api/hospitals/${id}/`, payload, options);
export const getHospitalStaff = (hospitalId, options) => apiGet(`/api/hospitals/${hospitalId}/staff/`, options);
export const assignHospitalStaff = (bookingId, payload, options) => apiPatch(`/api/bookings/${bookingId}/`, { assign_doctors: payload }, options);
