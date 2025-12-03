import React from "react";
import Icon from "./Icon";
import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
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
        <Link className="nav-btn" href="/profile/settings">
          <Icon name="user" />
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  );
}