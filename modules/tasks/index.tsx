import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type Task = { 
  id: string; 
  title: string; 
  completed?: boolean;
  parentId?: string;
  subtasks?: Task[];
  createdAt?: string;
  updatedAt?: string;
};

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
        const allTasks = data.tasks || [];
        
        // Organize tasks into parent/subtask structure
        const parentTasks = allTasks.filter((t: Task) => !t.parentId);
        const subtasksByParent = allTasks
          .filter((t: Task) => t.parentId)
          .reduce((acc: Record<string, Task[]>, task: Task) => {
            if (!acc[task.parentId!]) {
              acc[task.parentId!] = [];
            }
            acc[task.parentId!].push(task);
            return acc;
          }, {});
        
        // Attach subtasks to their parents
        const organizedTasks = parentTasks.map((parent: Task) => ({
          ...parent,
          subtasks: subtasksByParent[parent.id] || [],
        }));
        
        setTasks(organizedTasks);
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

  async function addSubtask(parentId: string) {
    const title = text.trim();
    if (!title) return;
    
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, completed: false, parentId }),
      });
      if (res.ok) {
        const created = await res.json();
        // Update the parent task's subtasks array
        setTasks((prevTasks) => prevTasks.map((t) => {
          if (t.id === parentId) {
            return {
              ...t,
              subtasks: [...(t.subtasks || []), created],
            };
          }
          return t;
        }));
        setText("");
      }
    } catch (e) {
      console.error("Failed to create subtask:", e);
    }
  }

  async function toggle(id: string, parentId?: string) {
    // Find the task
    let task: Task | undefined;
    if (parentId) {
      const parent = tasks.find((t) => t.id === parentId);
      task = parent?.subtasks?.find((st) => st.id === id);
    } else {
      task = tasks.find((t) => t.id === id);
    }
    
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
        
        if (parentId) {
          // Update subtask
          setTasks((s) => s.map((t) => {
            if (t.id === parentId) {
              return {
                ...t,
                subtasks: (t.subtasks || []).map((st) =>
                  st.id === id ? updated : st
                ),
              };
            }
            return t;
          }));
        } else {
          // Update parent task (and cascade to subtasks if marking as complete)
          setTasks((s) => s.map((t) => {
            if (t.id === id) {
              // If marking parent as complete, also mark all subtasks as complete
              if (updated.completed && t.subtasks && t.subtasks.length > 0) {
                return {
                  ...updated,
                  subtasks: t.subtasks.map((st) => ({ ...st, completed: true })),
                };
              }
              return { ...t, ...updated };
            }
            return t;
          }));
        }
      }
    } catch (e) {
      console.error("Failed to toggle task:", e);
    }
  }

  async function remove(id: string, parentId?: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (parentId) {
          // Remove subtask
          setTasks((s) => s.map((t) => {
            if (t.id === parentId) {
              return {
                ...t,
                subtasks: (t.subtasks || []).filter((st) => st.id !== id),
              };
            }
            return t;
          }));
        } else {
          // Remove parent task
          setTasks((s) => s.filter((t) => t.id !== id));
        }
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

  function startEdit(t: Task, parentId?: string) {
    setEditingId(parentId ? `${parentId}-${t.id}` : t.id);
    setEditText(t.title);
  }

  async function saveEdit(id: string, parentId?: string) {
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
        
        if (parentId) {
          // Update subtask
          setTasks((s) => s.map((t) => {
            if (t.id === parentId) {
              return {
                ...t,
                subtasks: (t.subtasks || []).map((st) =>
                  st.id === id ? updated : st
                ),
              };
            }
            return t;
          }));
        } else {
          // Update parent task
          setTasks((s) => s.map((t) => (t.id === id ? { ...t, ...updated } : t)));
        }
        
        setEditingId(null);
        setEditText("");
      }
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  }

  function handleTaskClick(task: Task) {
    // If there's text in the input, add it as a subtask
    if (text.trim()) {
      addSubtask(task.id);
    }
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading tasks...</p>
      </div>
    );
  }

  // Filter to only show parent tasks (tasks without parentId)
  const parentTasks = tasks.filter((t) => !t.parentId);
  const visibleTasks = parentTasks.filter((t) =>
    showCompleted ? true : !t.completed
  );

  const completedCount = parentTasks.filter(t => t.completed).length;

  // Helper to render a task item
  const renderTask = (t: Task, parentId?: string, isSubtask = false) => {
    const editKey = parentId ? `${parentId}-${t.id}` : t.id;
    const isEditing = editingId === editKey;

    return (
      <div 
        className={`task-item ${isSubtask ? 'subtask' : ''}`} 
        key={t.id}
        style={isSubtask ? { marginLeft: '2rem' } : {}}
      >
        <button
          type="button"
          className="task-checkbox"
          onClick={() => toggle(t.id, parentId)}
          aria-label={t.completed ? "Mark as incomplete" : "Mark as complete"}
        >
          {t.completed ? <Icon name="check" size={14} /> : null}
        </button>

        {isEditing ? (
          <input
            className="task-edit-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEdit(t.id, parentId)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(t.id, parentId);
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
            onClick={() => !isSubtask && text.trim() ? handleTaskClick(t) : toggle(t.id, parentId)}
            style={{ 
              cursor: "pointer", 
              flex: 1,
              background: !isSubtask && text.trim() ? "rgba(37, 244, 238, 0.1)" : "transparent",
              borderRadius: !isSubtask && text.trim() ? "4px" : "0",
              padding: !isSubtask && text.trim() ? "4px 8px" : "0",
              transition: "all 0.2s"
            }}
            title={!isSubtask && text.trim() ? "Click to add subtask" : ""}
          >
            {t.title}
          </div>
        )}

        <div className="task-actions">
          <button
            className="task-action-btn"
            onClick={() => isEditing ? saveEdit(t.id, parentId) : startEdit(t, parentId)}
            title={isEditing ? "Save" : "Edit"}
          >
            <Icon name="edit" />
          </button>
          <button 
            className="task-action-btn" 
            onClick={() => remove(t.id, parentId)}
            title="Delete"
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
    );
  };

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

      {text.trim() && (
        <div style={{
          padding: "0.5rem",
          marginBottom: "1rem",
          background: "rgba(37, 244, 238, 0.1)",
          borderRadius: "6px",
          fontSize: "0.85rem",
          color: "var(--muted)"
        }}>
          💡 Tip: Click a task below to add "{text}" as a subtask, or click Add to create a parent task
        </div>
      )}      

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
            <React.Fragment key={t.id}>
              {renderTask(t)}
              {/* Render subtasks */}
              {t.subtasks && t.subtasks.length > 0 && (
                <>
                  {t.subtasks
                    .filter((st) => showCompleted ? true : !st.completed)
                    .map((st) => renderTask(st, t.id, true))}
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {parentTasks.length - completedCount} active
            {completedCount > 0 && ` • ${completedCount} completed`}
          </div>
        </div>
      </div>

      <style jsx>{`
        .subtask {
          margin-left: 2rem;
          border-left: 2px solid rgba(255, 255, 255, 0.1);
          padding-left: 0.5rem;
        }
      `}</style>
    </div>
  );
}