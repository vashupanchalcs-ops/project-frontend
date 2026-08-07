import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./Layout.css";
import { ThemeProvider } from "./ThemeContext.jsx";
import { loadGoogleMapsScript } from "./utils/googleMaps";

loadGoogleMapsScript().catch(() => {});

// Keep legacy API calls working in production while individual screens are
// migrated away from their old localhost URLs. Vercel injects the backend
// origin through VITE_API_BASE_URL; local development keeps using Django on
// port 8000.
const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || "https://swiftrescue-backend.onrender.com").replace(/\/+$/, "");
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  if (typeof input === "string") {
    input = input.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):8000/, configuredApiBase);
  } else if (input instanceof Request) {
    const rewrittenUrl = input.url.replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):8000/, configuredApiBase);
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
