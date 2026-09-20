import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./Layout.css";
import { ThemeProvider } from "./ThemeContext.jsx";

// Keep legacy API calls working in production while individual screens are
// migrated away from their old localhost URLs. Local Vite must stay connected
// to local Django so development OTPs print in the Django terminal.
const defaultApiBase = import.meta.env.DEV
  ? "http://127.0.0.1:8000"
  : "https://swiftrescue-backend-shlb.onrender.com";
const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/+$/, "");
const legacyApiOriginPattern = /^(?:https?:\/\/(?:127\.0\.0\.1|localhost):8000|https:\/\/(?:swiftrescue-backend|aarogya-backend)(?:-[a-z0-9]+)?\.onrender\.com)/;
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  if (typeof input === "string") {
    input = input.replace(legacyApiOriginPattern, configuredApiBase);
  } else if (input instanceof Request) {
    const rewrittenUrl = input.url.replace(legacyApiOriginPattern, configuredApiBase);
    if (rewrittenUrl !== input.url) input = new Request(rewrittenUrl, input);
  }
  return nativeFetch(input, init);
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
