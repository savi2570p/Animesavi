import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import { installIframeSandboxGuard } from "./lib/iframeSandboxGuard";
import { initPerfTier } from "./lib/performance/deviceTier";
import { supabase } from './integrations/supabase/client';
import { installMatureContentFilter } from './lib/matureContentFilter';

installMatureContentFilter(supabase);


// Initialize theme from localStorage before render to prevent flash
const initTheme = () => {
  const root = document.documentElement;
  // Force dark mode always
  root.classList.add('dark');
  localStorage.setItem('theme', 'dark');
};

initTheme();

// Resolve the device performance tier before first paint so CSS can drop
// expensive effects on low-end hardware without a visual flash.
initPerfTier();

// Long-task / layout-shift warnings while developing. Stripped from prod.
if (import.meta.env.DEV) {
  void import("./lib/performance/monitor").then(({ installPerfMonitor }) =>
    installPerfMonitor()
  );
}

// Globally strip any `sandbox` attribute from every iframe (now and future).
installIframeSandboxGuard();

// Eagerly register the icon-cache-purge service worker so the newest favicon /
// apple-touch-icon assets are fetched right after deploy. Guarded against
// Lovable preview iframes & preview hosts per PWA rules.
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const isPreviewHost =
  host.includes('id-preview--') || host.includes('lovableproject.com');

if (!isInIframe && !isPreviewHost && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/push-sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // Force an update check on every load so a new SW activates ASAP.
        try { reg.update(); } catch {}
      })
      .catch(() => { /* ignore */ });
  });

  // When the new SW takes control, drop any stale in-memory icon URLs by
  // forcing the favicon link to re-resolve.
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e?.data?.type === 'ICON_CACHE_PURGED') {
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="shortcut icon"]'
      ).forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const bust = `${href.split('?')[0]}?v=4&_=${Date.now()}`;
        link.setAttribute('href', bust);
      });
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Application root is missing');
createRoot(rootElement).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

