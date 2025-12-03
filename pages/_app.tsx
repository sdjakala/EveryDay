import React, { useEffect } from "react";
import type { AppProps } from "next/app";
import "../styles/globals.css";
import Layout from "../components/Layout";

function registerServiceWorker() {
  // Disabled during development to avoid Fast Refresh loops and SW caching issues.
  // Enable in production by checking: process.env.NODE_ENV === 'production'
  // eslint-disable-next-line no-constant-condition
  if (false && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(`/sw.js?t=${Date.now()}`)
      .then(() => console.log("Service Worker registered"))
      .catch((err) => console.warn("SW registration failed", err));
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