import React, { useEffect, useState } from "react";

type ModuleMeta = {
  name: string;
  description: string;
  enabled: boolean;
  minRank: number;
};

export default function ProfileSettings() {
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/modules")
      .then((r) => r.json())
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
          /* ignore */
        }
        setModules(data);
      })
      .catch(() => setModules([]));
  }, []);

  function moveUp(i: number) {
    if (i <= 0) return;
    const next = [...modules];
    const [m] = next.splice(i, 1);
    next.splice(i - 1, 0, m);
    setModules(next);
  }
  function moveDown(i: number) {
    if (i >= modules.length - 1) return;
    const next = [...modules];
    const [m] = next.splice(i, 1);
    next.splice(i + 1, 0, m);
    setModules(next);
  }
  function save() {
    try {
      localStorage.setItem(
        "moduleOrder",
        JSON.stringify(modules.map((m) => m.name))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      // failed to save, show a console error
      console.error("Failed to save module order", e);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Profile Settings</h2>
      <h3>Module order</h3>
      <p>
        Your module order is stored in your browser. Reordering here only
        affects your view.
      </p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {modules.map((m, i) => (
          <li
            key={m.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              opacity: m.enabled ? 1 : 0.5,
            }}
          >
            <div style={{ flex: 1 }}>
              {m.name} - {m.description}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button
                className="btn small secondary"
                onClick={() => moveUp(i)}
                disabled={i === 0}
              >
                ▲
              </button>
              <button
                className="btn small secondary"
                onClick={() => moveDown(i)}
                disabled={i === modules.length - 1}
              >
                ▼
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={save}>
          Save Order
        </button>
        {saved && (
          <span style={{ color: "var(--accent-start)", marginLeft: 8 }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}