import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { installGlobalErrorHandlers } from "@/lib/error-reporter";
import "./i18n";
import App from "./App.tsx";
import "./index.css";

installGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
