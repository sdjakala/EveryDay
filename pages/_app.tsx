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

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    registerServiceWorker();
    checkForUpdates();

    // When connectivity is restored, tell the SW to replay queued mutations.
    // This is the fallback for Safari which doesn't support the Background Sync API.
    function notifySWOnline() {
      navigator.serviceWorker?.controller?.postMessage({ type: "ONLINE" });
    }
    window.addEventListener("online", notifySWOnline);
    return () => window.removeEventListener("online", notifySWOnline);
  }, []);

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}