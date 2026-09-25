const defaultBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultBase).replace(/\/+$/, "");
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, endpoint = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.endpoint = endpoint;
  }
}

function emit(name, detail) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

function parseBody(response) {
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) return response.json().catch(() => ({}));
  return response.text().then((text) => (text ? { detail: text } : {}));
}

export async function apiRequest(endpoint, {
  method = "GET",
  body,
  headers = {},
  signal,
  timeoutMs = API_TIMEOUT_MS,
  credentials = "include",
  cache = "no-store",
} = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) forwardAbort();
    else signal.addEventListener("abort", forwardAbort, { once: true });
  }

  const requestHeaders = { Accept: "application/json", ...headers };
  const hasBody = body !== undefined && body !== null;
  if (hasBody && !(body instanceof FormData)) requestHeaders["Content-Type"] = "application/json";

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: hasBody && !(body instanceof FormData) ? JSON.stringify(body) : body,
      credentials,
      cache,
      signal: controller.signal,
    });
    const data = await parseBody(response);
    if (!response.ok) {
      const message = data?.error || data?.detail || `Request failed (${response.status})`;
      const error = new ApiError(message, { status: response.status, data, endpoint });
      if (response.status === 401) emit("aarogya:session-expired", error);
      if (response.status === 403) emit("aarogya:permission-denied", error);
      if (response.status === 404) emit("aarogya:resource-missing", error);
      if (response.status === 409) emit("aarogya:conflict", error);
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError("The server took too long to respond.", { endpoint });
    }
    if (error instanceof ApiError) throw error;
    emit("aarogya:network-error", error);
    throw new ApiError("Network error. Check your connection and try again.", { endpoint });
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

export const apiGet = (endpoint, options) => apiRequest(endpoint, { ...options, method: "GET" });
export const apiPost = (endpoint, body, options) => apiRequest(endpoint, { ...options, method: "POST", body });
export const apiPatch = (endpoint, body, options) => apiRequest(endpoint, { ...options, method: "PATCH", body });
export const apiDelete = (endpoint, options) => apiRequest(endpoint, { ...options, method: "DELETE" });
