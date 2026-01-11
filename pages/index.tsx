import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Icon from "../components/Icon";

type ModuleMeta = {
  name: string;
  description: string;
  enabled: boolean;
  minRank: number;
};
type User = { id: string; name: string; rank: number };

async function fetchModules() {
  const res = await fetch("/api/modules");
  return res.json();
}

export default function Dashboard() {
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinned, setPinned] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    // Fetch logged-in user info
    fetch("/api/auth/me")
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error("Not authenticated");
      })
      .then((data) => {
        if (data.payload) {
          setIsAuthenticated(true);
          setUser({
            id: data.payload.sub || "1",
            name: data.payload.name || data.payload.email || "User",
            rank: 1,
          });
        }
      })
      .catch((e) => {
        console.warn("User not authenticated:", e);
        setIsAuthenticated(false);
        setUser(null);
      });

    // fetch modules then apply saved order (if any)
    fetchModules()
      .then((data: ModuleMeta[]) => {
        try {
          const raw = localStorage.getItem("moduleOrder");
          if (raw) {
            const order: string[] = JSON.parse(raw);
            const ordered = order
              .map((name) => data.find((d) => d.name === name))
              .filter(Boolean) as ModuleMeta[];
            const remaining = data.filter((d) => !order.includes(d.name));
            setModules([...ordered, ...remaining]);
            return;
          }
        } catch (e) {
          console.warn("Failed to parse module order", e);
        }
        setModules(data);
      })
      .catch(console.error);

    // read pinned module from localStorage
    try {
      const p = localStorage.getItem("pinnedModule");
      if (p) setPinned(p);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
  }, []);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    name: string
  ) => {
    try {
      const tg = e.target as HTMLElement;
      if (
        tg &&
        tg.closest &&
        tg.closest("button, a, input, select, textarea, label")
      ) {
        return;
      }
    } catch (err) {
      // ignore traversal errors
    }

    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setDragging(name);
      try {
        document.body.style.touchAction = "none";
      } catch (err) {
        // ignore
      }
    }, 350);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }

    const p = e as unknown as PointerEvent;
    const el = document.elementFromPoint(
      p.clientX,
      p.clientY
    ) as HTMLElement | null;
    if (!el) return;
    const card =
      el.closest && (el.closest(".module-card") as HTMLElement | null);
    const name = card?.dataset?.modulename || null;
    if (name && name !== dragOver) setDragOver(name);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!dragging) return;

    const srcName = dragging;
    const tgtName = dragOver || dragging;
    if (srcName && tgtName && srcName !== tgtName) {
      const srcIdx = modules.findIndex((m) => m.name === srcName);
      const tgtIdx = modules.findIndex((m) => m.name === tgtName);
      if (srcIdx !== -1 && tgtIdx !== -1) {
        const next = [...modules];
        const [moved] = next.splice(srcIdx, 1);
        next.splice(tgtIdx, 0, moved);
        setModules(next);
        try {
          localStorage.setItem(
            "moduleOrder",
            JSON.stringify(next.map((m) => m.name))
          );
        } catch (err) {
          // ignore
        }
      }
    }

    setDragging(null);
    setDragOver(null);
    try {
      document.body.style.touchAction = "";
    } catch (err) {
      // ignore
    }
  };

  // Modules allowed for unauthenticated users
  const allowedForGuests = ["tasks", "calendar", "grocery", "recipes"];

  return (
    <div className="container">
      <h1>Dashboard</h1>
      {!isAuthenticated ? (
        <div style={{ 
          background: "rgba(255,255,255,0.02)", 
          padding: "1.5rem", 
          borderRadius: "12px",
          marginBottom: "1.5rem",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          <p style={{ marginBottom: "1rem", fontSize: "1rem" }}>
            Welcome! You`&apos;`re using the app in <strong>guest mode</strong>.
          </p>
          <p style={{ marginBottom: "1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
            Your data is saved locally on this device only. Sign in to sync across devices and unlock all features.
          </p>
          <Link href="/api/auth/login">
            <button className="btn primary" style={{ marginTop: "0.5rem" }}>
              Sign In
            </button>
          </Link>
        </div>
      ) : (
        <p>Welcome, {user?.name}</p>
      )}

      {pinned
        ? modules
            .filter((m) => m.name === pinned)
            .map((mod) => {
              if (!mod || !mod.enabled) return null;
              
              // Check if module is allowed for unauthenticated users
              if (!isAuthenticated && !allowedForGuests.includes(mod.name)) {
                return null;
              }
              
              if (user && user.rank < mod.minRank) return null;
              
              const Component = dynamic(
                () =>
                  import(`../modules/${mod.name}/index`).then((m) => m.default),
                {
                  ssr: false,
                  loading: () => (
                    <div className="module-card">Loading {mod.name}...</div>
                  ),
                }
              );
              return (
                <div
                  key={mod.name}
                  className="module-card"
                  style={{ minHeight: "70vh" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <h3>{mod.name}</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="icon-btn"
                        title="Unpin"
                        onClick={() => {
                          localStorage.removeItem("pinnedModule");
                          setPinned(null);
                        }}
                      >
                        <Icon name="unpin" />
                      </button>
                    </div>
                  </div>
                  <p>{mod.description}</p>
                  <Component />
                </div>
              );
            })
        : modules.map((mod) => {
            if (!mod.enabled) return null;
            
            // Check if module is allowed for unauthenticated users
            if (!isAuthenticated && !allowedForGuests.includes(mod.name)) {
              return null;
            }
            
            if (user && user.rank < mod.minRank) return null;

            const Component = dynamic(
              () =>
                import(`../modules/${mod.name}/index`).then((m) => m.default),
              {
                ssr: false,
                loading: () => (
                  <div className="module-card">Loading {mod.name}...</div>
                ),
              }
            );

            const isDragging = dragging === mod.name;
            const over = dragOver === mod.name;
            return (
              <div
                key={mod.name}
                className={`module-card${isDragging ? " dragging" : ""}`}
                data-modulename={mod.name}
                onPointerDown={(e) => handlePointerDown(e, mod.name)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  border: over ? "2px dashed var(--accent)" : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3>{mod.name}</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="icon-btn"
                      title={`Pin ${mod.name}`}
                      onClick={() => {
                        try {
                          localStorage.setItem("pinnedModule", mod.name);
                          setPinned(mod.name);
                        } catch (e) {
                          // Ignore localStorage errors
                        }
                      }}
                    >
                      <Icon name="pin" />
                    </button>
                  </div>
                </div>
                <p>{mod.description}</p>
                <Component />
              </div>
            );
          })}
    </div>
  );
}