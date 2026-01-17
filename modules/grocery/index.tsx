import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";

type Item = { id: string; title: string; done?: boolean };

const DEFAULT_SECTIONS = [
  "Produce",
  "Meat",
  "Dairy",
  "Frozen",
  "Bakery",
  "Pantry",
  "Other",
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function playCheckSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    // Click/check mark sound: quick descending pitch like a pen click
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.setValueAtTime(0, now + 0.12);
    
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    // Silently fail if audio context not available
  }
}

export default function GroceryModule() {
  const [sections] = useState<string[]>(DEFAULT_SECTIONS);
  const [lists, setLists] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);

  // Load grocery lists from API on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/grocery");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setLists(data.lists || data);
          // Cache in localStorage for offline access
          try {
            localStorage.setItem(
              "groceryLists",
              JSON.stringify(data.lists || data)
            );
          } catch (e) {}
        }
      } catch (e) {
        console.error("Failed to fetch grocery lists:", e);
        // Fallback to localStorage if API fails
        try {
          const raw = localStorage.getItem("groceryLists");
          if (raw) {
            setLists(JSON.parse(raw));
          } else {
            const initial: Record<string, Item[]> = {};
            DEFAULT_SECTIONS.forEach((s) => (initial[s] = []));
            setLists(initial);
          }
        } catch (localErr) {
          const initial: Record<string, Item[]> = {};
          DEFAULT_SECTIONS.forEach((s) => (initial[s] = []));
          setLists(initial);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function apiGetGrocery() {
    try {
      const res = await fetch("/api/grocery");
      if (res.ok) {
        const json = await res.json();
        return json && (json.lists || json);
      }
    } catch (e) {}
    return null;
  }
  async function apiAddGroceryItem(section: string, item: Item) {
    try {
      await fetch("/api/grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, title: item.title }),
      });
    } catch (e) {}
  }
  async function apiUpdateGroceryItem(
    section: string,
    id: string,
    payload: Partial<Item>
  ) {
    try {
      await fetch(
        `/api/grocery/${encodeURIComponent(id)}?section=${encodeURIComponent(section)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
    } catch (e) {}
  }
  async function apiDeleteGroceryItem(section: string, id: string) {
    try {
      await fetch(
        `/api/grocery/${encodeURIComponent(id)}?section=${encodeURIComponent(section)}`,
        { method: "DELETE" }
      );
    } catch (e) {}
  }

  const [newText, setNewText] = useState("");
  const [newSection, setNewSection] = useState(DEFAULT_SECTIONS[0]);
  const [editing, setEditing] = useState<{
    id: string;
    section: string;
  } | null>(null);
  const [editText, setEditText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("groceryLists", JSON.stringify(lists));
    } catch (e) {}
  }, [lists]);

  // Listen for external updates to grocery lists (e.g. pushed from Recipes module)
  useEffect(() => {
    function handleUpdate() {
      // try server first, fall back to localStorage
      (async () => {
        const srv = await apiGetGrocery();
        if (srv) return setLists(srv);
        try {
          const raw = localStorage.getItem("groceryLists");
          if (raw) setLists(JSON.parse(raw));
        } catch (e) {
          /* ignore */
        }
      })();
    }
    window.addEventListener("grocery-updated", handleUpdate);
    return () => window.removeEventListener("grocery-updated", handleUpdate);
  }, []);

  function addItem(section?: string) {
    const sec = section || newSection;
    const title = (section ? newText : newText).trim();
    if (!title) return;
    const it: Item = { id: uid(), title, done: false };
    setLists((s) => ({ ...s, [sec]: [it, ...(s[sec] || [])] }));
    setNewText("");
    // best-effort: persist to server and re-sync
    apiAddGroceryItem(sec, it)
      .then(() =>
        apiGetGrocery()
          .then((d) => d && setLists(d))
          .catch(() => {})
      )
      .catch(() => {});
  }

  function toggleDone(section: string, id: string) {
    playCheckSound();
    setLists((s) => ({
      ...s,
      [section]: s[section].map((it) =>
        it.id === id ? { ...it, done: !it.done } : it
      ),
    }));
    // best-effort: persist change to server
    const newVal = !(lists[section] || []).find((it) => it.id === id)?.done;
    apiUpdateGroceryItem(section, id, { done: newVal }).catch(() => {});
  }

  function remove(section: string, id: string) {
    setLists((s) => ({
      ...s,
      [section]: s[section].filter((it) => it.id !== id),
    }));
    apiDeleteGroceryItem(section, id).catch(() => {});
  }

  function startEdit(section: string, it: Item) {
    setEditing({ id: it.id, section });
    setEditText(it.title);
  }

  function saveEdit() {
    if (!editing) return;
    setLists((s) => ({
      ...s,
      [editing.section]: s[editing.section].map((it) =>
        it.id === editing.id ? { ...it, title: editText } : it
      ),
    }));
    setEditing(null);
    setEditText("");
    apiUpdateGroceryItem(editing.section, editing.id, {
      title: editText,
    }).catch(() => {});
  }

  function clearCompleted() {
    setLists((s) => {
      const updated = { ...s };
      Object.keys(updated).forEach((section) => {
        updated[section] = updated[section].filter((it) => !it.done);
      });
      return updated;
    });
    // best-effort: persist changes to server
    Object.keys(lists).forEach((section) => {
      lists[section]
        .filter((it) => it.done)
        .forEach((it) => {
          apiDeleteGroceryItem(section, it.id).catch(() => {});
        });
    });
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading grocery lists...</p>
      </div>
    );
  }

  return (
    <div className="module-card">
      

      <div className="grocery-add" style={{ marginTop: 12 }}>
        <input
          className="task-input"
          placeholder="Add grocery item..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem(newSection)}
        />
        <select
          className="grocery-select"
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
        >
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="task-add-btn" onClick={() => addItem(newSection)}>
          <Icon name="plus" /> <span style={{ marginLeft: 6 }}>Add</span>
        </button>
        <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >        
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {showCompleted &&
            Object.values(lists).some((items) =>
              items.some((it) => it.done)
            ) && (
              <button
                className="toggle-btn"
                onClick={clearCompleted}
                title="Delete all completed items"
                style={{ backgroundColor: "var(--danger-color, #e74c3c)" }}
              >
                <span className="icon">
                  <Icon name="trash" />
                </span>
                <span style={{ fontSize: 13 }}>Clear completed</span>
              </button>
            )}
          <button
            className={`toggle-btn ${showCompleted ? "active" : ""}`}
            title={showCompleted ? "Showing completed" : "Show completed"}
            aria-pressed={showCompleted}
            onClick={() => setShowCompleted((s) => !s)}
          >
            <span className="icon">
              <Icon name="check" />
            </span>
            <span style={{ fontSize: 13 }}>
              {showCompleted ? "Completed" : "Show completed"}
            </span>
          </button>
        </div>
      </div>
      </div>

      <div className="grocery-sections" style={{ marginTop: 14 }}>
        {/* derive sections from the lists keys so server-provided keys are honored */}
        {(() => {
          const keys = Array.from(
            new Set([...sections, ...Object.keys(lists)])
          );
          const sectionsToShow = keys.filter(
            (section) =>
              (lists[section] || []).length > 0 &&
              (showCompleted || (lists[section] || []).some((it) => !it.done))
          );
          if (sectionsToShow.length === 0)
            return (
              <div style={{ color: "var(--muted)", padding: 10 }}>
                No items yet — add something above.
              </div>
            );
          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                gap: 12,
              }}
            >
              {sectionsToShow.map((section) => {
                const all = lists[section] || [];
                const visible = all.filter((it) =>
                  showCompleted ? true : !it.done
                );
                return (
                  <section className="grocery-section" key={section}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <strong style={{ color: "#fff" }}>{section}</strong>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        {visible.length}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {visible.map((it) => (
                        <div
                          key={it.id}
                          className="task-item"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <button
                            type="button"
                            className="task-checkbox"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleDone(section, it.id);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                            onPointerDown={(e: any) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            aria-pressed={it.done ? "true" : "false"}
                            style={{ touchAction: "manipulation" }}
                          >
                            {it.done ? <Icon name="check" size={14} /> : null}
                          </button>
                          {editing && editing.id === it.id ? (
                            <input
                              className="task-edit-input"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            />
                          ) : (
                            <div
                              className={`task-title ${it.done ? "completed" : ""}`}
                              style={{ flex: 1, cursor: "pointer" }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleDone(section, it.id);
                              }}
                            >
                              {it.title}
                            </div>
                          )}
                          <div className="task-actions">
                            <button
                              type="button"
                              className="task-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(section, it);
                              }}
                              onTouchStart={(e) => e.stopPropagation()}
                              onPointerDown={(e: any) => e.preventDefault()}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              type="button"
                              className="task-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                remove(section, it.id);
                              }}
                              onTouchStart={(e) => e.stopPropagation()}
                              onPointerDown={(e: any) => e.preventDefault()}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}