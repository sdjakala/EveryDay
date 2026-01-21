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

    // Listen for new service worker waiting to activate
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Service worker changed, reload the page
      window.location.reload();
    });
  }
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    registerServiceWorker();
    checkForUpdates();
  }, []);

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}