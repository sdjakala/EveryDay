import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import 'maplibre-gl/dist/maplibre-gl.css';
import "../styles/globals.css";
import Layout from "../components/Layout";

function registerServiceWorker() {
  // Register the service worker for PWA functionality
  if(typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }
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

    // Warm the SW cache with every /_next/ resource loaded this session.
    // Delay slightly so dynamic imports have time to settle.
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