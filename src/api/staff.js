import { apiGet, apiPost } from "./client";

export const staffLogin = (payload, options) => apiPost("/api/auth/staff-login/", payload, options);
export const getStaffDashboard = (query, options) => apiGet(`/api/staff/dashboard/?${new URLSearchParams(query)}`, options);
export const getStaffNotifications = (query, options) => apiGet(`/api/staff/notifications/?${new URLSearchParams(query)}`, options);
