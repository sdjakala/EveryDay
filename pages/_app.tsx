import React, { useEffect } from "react";
import type { AppProps } from "next/app";
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

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}