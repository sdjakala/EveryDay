import React, { useEffect, useState, useCallback } from "react";

type ModuleMeta = {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  minRank: number;
};

export default function ProfileSettings() {
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/modules")
      .then((r) => r.json())
      .then((data: ModuleMeta[]) => {
        const enabled = data.filter((d) => d.enabled);

        try {
          const raw = localStorage.getItem("moduleOrder");
          if (raw) {
            const order: string[] = JSON.parse(raw);
            const ordered = order
              .map((name) => enabled.find((d) => d.name === name))
              .filter(Boolean) as ModuleMeta[];
            const remaining = enabled.filter((d) => !order.includes(d.name));
            setModules([...ordered, ...remaining]);
          } else {
            setModules(enabled);
          }
        } catch {
          setModules(enabled);
        }

        try {
          const rawHidden = localStorage.getItem("hiddenModules");
          if (rawHidden) setHidden(new Set(JSON.parse(rawHidden)));
        } catch {
          /* ignore */
        }
      })
      .catch(() => setModules([]));
  }, []);

  const persist = useCallback(
    (nextModules: ModuleMeta[], nextHidden: Set<string>) => {
      try {
        localStorage.setItem(
          "moduleOrder",
          JSON.stringify(nextModules.map((m) => m.name))
        );
        localStorage.setItem(
          "hiddenModules",
          JSON.stringify([...nextHidden])
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        console.error("Failed to save module settings", e);
      }
    },
    []
  );

  function toggleHidden(name: string) {
    const next = new Set(hidden);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setHidden(next);
    persist(modules, next);
  }

  function moveUp(i: number) {
    if (i <= 0) return;
    const next = [...modules];
    const [m] = next.splice(i, 1);
    next.splice(i - 1, 0, m);
    setModules(next);
    persist(next, hidden);
  }

  function moveDown(i: number) {
    if (i >= modules.length - 1) return;
    const next = [...modules];
    const [m] = next.splice(i, 1);
    next.splice(i + 1, 0, m);
    setModules(next);
    persist(next, hidden);
  }

  return (
    <div style={{ padding: "20px 0" }}>
      <h2 style={{ margin: "0 0 4px 0", color: "#fff" }}>Module Settings</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0 0 20px 0" }}>
        Toggle modules on or off and drag to reorder. Settings are saved to this browser only.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {modules.map((m, i) => {
          const isHidden = hidden.has(m.name);
          return (
            <div key={m.name} className={`module-settings-row${isHidden ? " hidden" : ""}`}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>
                  {m.title || m.name}
                </div>
                {m.description && (
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: 2 }}>
                    {m.description}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                <button
                  className="btn small secondary"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  style={{ padding: "2px 7px", minWidth: 28, height: 22, fontSize: "0.7rem" }}
                >
                  ▲
                </button>
                <button
                  className="btn small secondary"
                  onClick={() => moveDown(i)}
                  disabled={i === modules.length - 1}
                  style={{ padding: "2px 7px", minWidth: 28, height: 22, fontSize: "0.7rem" }}
                >
                  ▼
                </button>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(m.name)}
                />
                <span className="slider" />
              </label>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, height: 20 }}>
        {saved && (
          <span style={{ color: "var(--accent-start)", fontSize: "0.875rem" }}>
            ✓ Saved
          </span>
        )}
      </div>
    </div>
  );
}
