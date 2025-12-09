import React, { useEffect, useState } from "react";
import Icon from "./Icon";
import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("Not authenticated");
        return r.json();
      })
      .then((data) => {
        setIsAdmin(data.isAdmin || false);
      })
      .catch(() => {
        setIsAdmin(false);
      });
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">EveryDay</div>
        <div className="top-actions">
          <button className="icon-btn" aria-label="Search">
            <Icon name="search" />
          </button>
          <button className="icon-btn" aria-label="Settings">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <main className="main">{children}</main>

      <nav className="bottom-nav">
        <Link className="nav-btn" href="/">
          <Icon name="home" />
          <span>Home</span>
        </Link>
        <Link className="nav-btn" href="/news">
          <Icon name="bell" />
          <span>Feed</span>
        </Link>
        <Link className="nav-btn" href="/discover">
          <Icon name="discover" />
          <span>Discover</span>
        </Link>
        <Link className="nav-btn" href="/profile">
          <Icon name="user" />
          <span>Profile</span>
        </Link>
        {isAdmin && (
          <Link className="nav-btn" href="/admin/requests">
            <Icon name="settings" />
            <span>Admin</span>
          </Link>
        )}
      </nav>
    </div>
  );
}