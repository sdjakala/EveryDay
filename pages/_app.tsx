import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import 'maplibre-gl/dist/maplibre-gl.css';
import "../styles/globals.css";
import Layout from "../components/Layout";

function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Register immediately — never rely on the 'load' event listener, because when
  // the page is served instantly from SW cache the 'load' event can fire before
  // useEffect runs, causing the listener to be added too late and the SW to never
  // re-register after a session where it was unregistered.
  navigator.serviceWorker
    .register('/sw.js')
    .then((reg) => console.log('[SW] registered, scope:', reg.scope))
    .catch((err) => console.error('[SW] registration failed:', err));
}

function checkForUpdates() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      // Check for updates every 5 minutes
      setInterval(() => {
        registration.update();
      }, 5 * 60 * 1000);
      
      // Check immediately on page load
      registration.update();
    });

    // Reload once when a new service worker takes over — guard prevents the
    // skipWaiting() + controllerchange cycle from reloading in an infinite loop.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
}

// Tell the active SW to cache every /_next/static/ URL the page has loaded.
// This ensures dynamic chunks (lazily-imported modules) get into the cache
// the first time the user visits that part of the app while online.
function reportLoadedResourcesToSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (!reg.active || !navigator.onLine) return;
    const urls = performance
      .getEntriesByType("resource")
      .map((e) => (e as PerformanceResourceTiming).name)
      .filter((n) => n.includes("/_next/static/"));
    if (urls.length) reg.active.postMessage({ type: "CACHE_URLS", urls });
  });
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    registerServiceWorker();
    checkForUpdates();

    // Warm the SW cache immediately, then again after 3 s so any lazily-loaded
    // chunks (e.g. the trips module) are also captured once React finishes rendering.
    reportLoadedResourcesToSW();
    const warmTimer = setTimeout(reportLoadedResourcesToSW, 3000);

    // When connectivity is restored, tell the SW to replay queued mutations
    // (fallback for Safari which doesn't support Background Sync) and re-warm
    // the cache in case new chunks loaded while we were online.
    function notifySWOnline() {
      navigator.serviceWorker?.controller?.postMessage({ type: "ONLINE" });
      reportLoadedResourcesToSW();
    }
    window.addEventListener("online", notifySWOnline);
    return () => {
      clearTimeout(warmTimer);
      window.removeEventListener("online", notifySWOnline);
    };
  }, []);

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}