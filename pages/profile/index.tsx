import React, { useEffect, useState } from "react";
import Link from "next/link";

type UserProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => {
        setUser(data.payload);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Failed to load profile");
        setLoading(false);
      });
  }, []);

  async function clearAllCaches() {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      
      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
      }
      
      alert('Cache cleared! Please reload the page.');
      window.location.reload();
    }
  }

  if (loading) {
    return (
        <div className="container">
          <p>Loading profile...</p>
        </div>
    );
  }

  if (error || !user) {
    return (
        <div className="container">
          <h1>Profile</h1>
          <p style={{ color: "salmon" }}>{error || "Could not load profile"}</p>
          <Link href="/api/auth/login">
            <button className="btn primary">Sign In</button>
          </Link>
        </div>
    );
  }

  return (
      <div className="container" style={{ padding: 20 }}>
        <h1>Profile</h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {user.picture && (
            <img
              src={user.picture}
              alt={user.name || user.email}
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          )}
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {user.name || "User"}
            </div>
            <div style={{ color: "var(--muted)" }}>{user.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link href="/profile/settings">
            <button className="btn secondary" style={{ width: "100%" }}>
              Settings & Module Order
            </button>
          </Link>

          <Link href="/api/auth/logout">
            <button className="btn secondary" style={{ width: "100%" }}>
              Logout
            </button>
          </Link>

          <button onClick={clearAllCaches}>
            Clear App Cache & Reload
          </button>
        </div>
      </div>
  );
}