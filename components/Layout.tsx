import React, { useEffect, useState } from "react";
import Icon from "./Icon";
import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Wake Lock API to keep screen awake in fullscreen mode
  useEffect(() => {
    let currentWakeLock: any = null;

    const requestWakeLock = async () => {
      if (isFullscreen && "wakeLock" in navigator) {
        try {
          currentWakeLock = await (navigator as any).wakeLock.request("screen");
          console.log("Wake Lock activated");

          currentWakeLock.addEventListener("release", () => {
            console.log("Wake Lock released");
          });
        } catch (err) {
          console.error("Wake Lock error:", err);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (currentWakeLock) {
        try {
          await currentWakeLock.release();
          currentWakeLock = null;
        } catch (err) {
          console.error("Wake Lock release error:", err);
        }
      }
    };

    if (isFullscreen) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-request wake lock when page becomes visible again (handles tab switching)
    const handleVisibilityChange = () => {
      if (isFullscreen && document.visibilityState === "visible" && !currentWakeLock) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      releaseWakeLock();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">EveryDay</div>
        <div className="top-actions">
          <button
            className="icon-btn"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <Icon name={isFullscreen ? "minimize" : "maximize"} />
          </button>
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