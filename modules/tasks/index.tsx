import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type Task = { id: string; title: string; completed?: boolean };

function playCheckSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Create two oscillators for a rich thump sound
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);
    
    // Lower frequency for a thump/knock sound
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(150, now);
    osc1.frequency.exponentialRampToValueAtTime(50, now + 0.05);
    
    // Add a mid-range component for texture
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(280, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.04);
    
    // Quick attack and decay for a percussive thump
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.05);
    osc2.stop(now + 0.05);
  } catch (e) {
    // Silently fail if audio context not available
  }
}

export default function TasksModule() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    } finally {
      setLoading(false);
    }
  }

  async function addTask(e?: React.FormEvent) {
    e?.preventDefault();
    const title = text.trim();
    if (!title) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, completed: false }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks((s) => [created, ...s]);
        setText("");
      }
    } catch (e) {
      console.error("Failed to create task:", e);
    }
  }

  async function toggle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    playCheckSound();
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((s) => s.map((t) => (t.id === id ? updated : t)));
      }
    } catch (e) {
      console.error("Failed to toggle task:", e);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTasks((s) => s.filter((t) => t.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  }

  async function clearCompleted() {
    const completedIds = tasks.filter((t) => t.completed).map((t) => t.id);
    for (const id of completedIds) {
      await remove(id);
    }
  }

  function startEdit(t: Task) {
    setEditingId(t.id);
    setEditText(t.title);
  }

  async function saveEdit(id: string) {
    const v = editText.trim();
    if (!v) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: v }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((s) => s.map((t) => (t.id === id ? updated : t)));
        setEditingId(null);
        setEditText("");
      }
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading tasks...</p>
      </div>
    );
  }

  const visibleTasks = tasks.filter((t) =>
    showCompleted ? true : !t.completed
  );

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="module-card">
      {/* Create Task Form */}
      <form 
        onSubmit={addTask}
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <input
          className="task-input"
          placeholder="Create a task..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="task-add-btn">
          <Icon name="plus" /> Add
        </button>
      </form>      

      {/* Filter Buttons */}
      <div style={{ 
        display: "flex", 
        gap: "0.5rem", 
        marginBottom: "1rem",
        flexWrap: "wrap"
      }}>
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
        
        {showCompleted && completedCount > 0 && (
          <button
            className="toggle-btn"
            onClick={clearCompleted}
            title="Delete all completed tasks"
            style={{ backgroundColor: "var(--danger-color, #e74c3c)" }}
          >
            <span className="icon">
              <Icon name="trash" />
            </span>
            <span style={{ fontSize: 13 }}>Clear completed</span>
          </button>
        )}
      </div>     
      
      {/* Tasks List */}
      {visibleTasks.length === 0 ? (
        <div style={{ 
          textAlign: "center", 
          padding: "2rem 1rem",
          color: "var(--muted)",
          fontSize: "0.9rem"
        }}>
          {showCompleted 
            ? "No completed tasks yet" 
            : "No active tasks. Create one above!"}
        </div>
      ) : (
        <div className="tasks-list">
          {visibleTasks.map((t) => (
            <div className="task-item" key={t.id}>
              <button
                type="button"
                className="task-checkbox"
                onClick={() => toggle(t.id)}
                aria-label={t.completed ? "Mark as incomplete" : "Mark as complete"}
              >
                {t.completed ? <Icon name="check" size={14} /> : null}
              </button>

              {editingId === t.id ? (
                <input
                  className="task-edit-input"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => saveEdit(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(t.id);
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditText("");
                    }
                  }}
                  autoFocus
                />
              ) : (
                <div
                  className={`task-title ${t.completed ? "completed" : ""}`}
                  onClick={() => toggle(t.id)}
                  style={{ cursor: "pointer", flex: 1 }}
                >
                  {t.title}
                </div>
              )}

              <div className="task-actions">
                <button
                  className="task-action-btn"
                  onClick={() => editingId === t.id ? saveEdit(t.id) : startEdit(t)}
                  title={editingId === t.id ? "Save" : "Edit"}
                >
                  <Icon name="edit" />
                </button>
                <button 
                  className="task-action-btn" 
                  onClick={() => remove(t.id)}
                  title="Delete"
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {tasks.length - completedCount} active
            {completedCount > 0 && ` • ${completedCount} completed`}
          </div>
        </div>
      </div>
    </div>
    
  );
}