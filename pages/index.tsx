import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
  const [user] = useState<User>({ id: "1", name: "Demo User", rank: 1 });
  const [pinned, setPinned] = useState<string | null>(null);
  const [touchDragging, setTouchDragging] = useState<string | null>(null);
  const [touchOver, setTouchOver] = useState<string | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [touchCandidate, setTouchCandidate] = useState<string | null>(null);

  useEffect(() => {
    // fetch modules then apply saved order (if any)
    fetchModules()
      .then((data: ModuleMeta[]) => {
        try {
          const raw = localStorage.getItem("moduleOrder");
          if (raw) {
            const order: string[] = JSON.parse(raw);
            // build ordered list: ordered names first, then any new modules
            const ordered = order
              .map((name) => data.find((d) => d.name === name))
              .filter(Boolean) as ModuleMeta[];
            const remaining = data.filter((d) => !order.includes(d.name));
            setModules([...ordered, ...remaining]);
            return;
          }
        } catch (e) {
          // fall back to natural order on parse error
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

  // Drag-and-drop handlers for reordering modules
  const onDragStart = (e: React.DragEvent<HTMLDivElement>, name: string) => {
    try {
      e.dataTransfer.setData("text/plain", name);
      e.dataTransfer.effectAllowed = "move";
    } catch (err) {
      // Ignore dataTransfer errors
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "move";
    } catch (err) {
      // Ignore dropEffect errors
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>, targetName: string) => {
    e.preventDefault();
    try {
      const srcName = e.dataTransfer.getData("text/plain");
      if (!srcName || srcName === targetName) return;
      const srcIdx = modules.findIndex((m) => m.name === srcName);
      const tgtIdx = modules.findIndex((m) => m.name === targetName);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const next = [...modules];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, moved);
      setModules(next);
      // persist order
      try {
        localStorage.setItem(
          "moduleOrder",
          JSON.stringify(next.map((m) => m.name))
        );
      } catch (err) {
        // Ignore localStorage errors
      }
    } catch (err) {
      // Ignore drop errors
    }
  };

  // Touch handlers for mobile reordering
  // Touch handling with movement threshold to avoid accidental taps causing drag
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>, name: string) => {
    // ignore if the touch started on an interactive control (button/input/link)
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
      // Ignore element traversal errors
    }

    const t = e.touches && e.touches[0];
    if (!t) return;
    setTouchStartPos({ x: t.clientX, y: t.clientY });
    setTouchCandidate(name);
    setTouchOver(name);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const start = touchStartPos;
    if (start && touchCandidate && !touchDragging) {
      const dx = Math.abs(t.clientX - start.x);
      const dy = Math.abs(t.clientY - start.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      // only start drag if finger moved more than threshold (px)
      if (dist > 8) {
        setTouchDragging(touchCandidate);
        try {
          document.body.style.touchAction = "none";
        } catch (err) {
          // Ignore touchAction errors
        }
      }
    }

    if (!touchDragging) return;
    const el = document.elementFromPoint(
      t.clientX,
      t.clientY
    ) as HTMLElement | null;
    if (!el) return;
    const card =
      el.closest && (el.closest(".module-card") as HTMLElement | null);
    const name = card?.dataset?.modulename || null;
    if (name && name !== touchOver) setTouchOver(name);
  };

  const onTouchEnd = () => {
    // if drag never started, treat as a tap -> reset
    if (!touchDragging) {
      setTouchStartPos(null);
      setTouchCandidate(null);
      setTouchOver(null);
      return;
    }
    const srcName = touchDragging;
    const tgtName = touchOver || touchDragging;
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
          // Ignore localStorage errors
        }
      }
    }
    // cleanup
    setTouchStartPos(null);
    setTouchCandidate(null);
    setTouchDragging(null);
    setTouchOver(null);
    try {
      document.body.style.touchAction = "";
    } catch (err) {
      // Ignore touchAction errors
    }
    try {
      document
        .querySelectorAll(".module-card.dragging")
        .forEach((el) => el.classList.remove("dragging"));
    } catch (err) {
      // Ignore DOM query errors
    }
  };

  return (
    <div className="container">
      <h1>Dashboard</h1>
      <p>
        Welcome, {user.name} — rank {user.rank}
      </p>

      {pinned
        ? // if pinned, only show that module
          modules
            .filter((m) => m.name === pinned)
            .map((mod) => {
              if (!mod || !mod.enabled || user.rank < mod.minRank) return null;
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
            if (!mod.enabled || user.rank < mod.minRank) return null;

            // Dynamic import mapping
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

            const isOver = touchOver === mod.name;
            return (
              <div
                key={mod.name}
                className={`module-card${touchDragging === mod.name ? " dragging" : ""}`}
                data-modulename={mod.name}
                draggable
                onDragStart={(e) => onDragStart(e, mod.name)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, mod.name)}
                onTouchStart={(e) => onTouchStart(e, mod.name)}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                  cursor: "grab",
                  border: isOver ? "2px dashed var(--accent)" : undefined,
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