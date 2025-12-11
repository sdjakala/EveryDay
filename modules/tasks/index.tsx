import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type Task = { id: string; title: string; completed?: boolean };

export default function TasksModule() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);

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
    return <div>Loading tasks...</div>;
  }

  return (
    <div>
      <div className="tasks-toolbar">
        <form className="create-task-form" onSubmit={addTask}>
          <input
            className="task-input"
            placeholder="Create a task..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="task-add-btn">
            Create
          </button>
        </form>
      </div>

      <div className="tasks-list">
        {tasks.map((t) => (
          <div className="task-item" key={t.id}>
            <div className="task-checkbox" onClick={() => toggle(t.id)}>
              {t.completed ? <Icon name="check" size={14} /> : null}
            </div>

            {editingId === t.id ? (
              <input
                className="task-edit-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => saveEdit(t.id)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit(t.id)}
              />
            ) : (
              <div className={`task-title ${t.completed ? "completed" : ""}`}>
                {t.title}
              </div>
            )}

            <div className="task-actions">
              <button
                className="task-action-btn"
                onClick={() =>
                  editingId === t.id ? saveEdit(t.id) : startEdit(t)
                }
              >
                <Icon name="edit" />{" "}
                <span style={{ marginLeft: 6 }}>
                  {editingId === t.id ? "Save" : "Edit"}
                </span>
              </button>
              <button className="task-action-btn" onClick={() => remove(t.id)}>
                <Icon name="trash" />{" "}
                <span style={{ marginLeft: 6 }}>Delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}