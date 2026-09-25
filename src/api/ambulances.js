import { apiGet, apiPatch, apiPost } from "./client";

export const listAmbulances = (options) => apiGet("/api/ambulances/", options);
export const getAmbulance = (id, options) => apiGet(`/api/ambulances/${id}/`, options);
export const updateAmbulance = (id, payload, options) => apiPatch(`/api/ambulances/${id}/`, payload, options);
export const sendDriverLocation = (payload, options) => apiPost("/api/driver/ping/", payload, options);
