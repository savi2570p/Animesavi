import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize theme from localStorage before render to prevent flash
const initTheme = () => {
  const root = document.documentElement;
  // Force dark mode always
  root.classList.add('dark');
  localStorage.setItem('theme', 'dark');
};

initTheme();

createRoot(document.getElementById("root")!).render(<App />);
