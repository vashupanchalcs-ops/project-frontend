import { apiGet, apiPatch, apiPost } from "./client";

export const listBookings = (options) => apiGet("/api/bookings/", options);
export const getBooking = (id, options) => apiGet(`/api/bookings/${id}/`, options);
export const createBooking = (payload, options) => apiPost("/api/bookings/", payload, options);
export const updateBooking = (id, payload, options) => apiPatch(`/api/bookings/${id}/`, payload, options);
export const getAssignedDriverBookings = (query, options) => apiGet(`/api/bookings/driver-assigned/?${new URLSearchParams(query)}`, options);
