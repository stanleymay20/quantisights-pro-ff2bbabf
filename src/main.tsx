import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { installGlobalErrorHandlers } from "@/lib/error-reporter";
import { initSentry } from "@/lib/sentry";
import "./i18n";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry FIRST for maximum error capture
initSentry();
installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
