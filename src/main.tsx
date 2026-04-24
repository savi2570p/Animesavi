import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installIframeSandboxGuard } from "./lib/iframeSandboxGuard";

// Initialize theme from localStorage before render to prevent flash
const initTheme = () => {
  const root = document.documentElement;
  // Force dark mode always
  root.classList.add('dark');
  localStorage.setItem('theme', 'dark');
};

initTheme();

// Globally strip any `sandbox` attribute from every iframe (now and future).
installIframeSandboxGuard();

createRoot(document.getElementById("root")!).render(<App />);
