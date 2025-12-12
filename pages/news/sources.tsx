import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type NewsSource = {
  id: string;
  name: string;
  url: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export default function NewsSources() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    try {
      setLoading(true);
      const res = await fetch("/api/news/sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch (e) {
      console.error("Failed to fetch sources:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) return;

    try {
      if (editingId) {
        // Update existing
        const res = await fetch(`/api/news/sources/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, url: formUrl }),
        });
        if (res.ok) {
          await fetchSources();
          setFormName("");
          setFormUrl("");
          setEditingId(null);
        }
      } else {
        // Create new
        const res = await fetch("/api/news/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, url: formUrl, active: true }),
        });
        if (res.ok) {
          await fetchSources();
          setFormName("");
          setFormUrl("");
        }
      }
    } catch (e) {
      console.error("Failed to save source:", e);
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/news/sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) {
        await fetchSources();
      }
    } catch (e) {
      console.error("Failed to toggle source:", e);
    }
  }

  async function deleteSource(id: string) {
    if (!confirm("Delete this news source?")) return;
    try {
      const res = await fetch(`/api/news/sources/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchSources();
      }
    } catch (e) {
      console.error("Failed to delete source:", e);
    }
  }

  function editSource(source: NewsSource) {
    setEditingId(source.id);
    setFormName(source.name);
    setFormUrl(source.url);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormName("");
    setFormUrl("");
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading news sources...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "2rem" }}>Manage News Sources</h1>

      <div
        className="module-card"
        style={{ marginBottom: "2rem", padding: "1.5rem" }}
      >
        <h2 style={{ marginBottom: "1rem" }}>
          {editingId ? "Edit Source" : "Add New Source"}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Source Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Minnesota News"
              style={{ width: "100%", padding: "0.5rem" }}
              required
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              URL
            </label>
            <input
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://bringmethenews.com/minnesota-news"
              style={{ width: "100%", padding: "0.5rem" }}
              required
            />
            <small
              style={{ color: "#666", display: "block", marginTop: "0.25rem" }}
            >
              Enter the full URL of the news page you want to scrape
            </small>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn primary">
              {editingId ? "Update Source" : "Add Source"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn secondary"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="module-card" style={{ padding: "1.5rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>
          Active Sources ({sources.length})
        </h2>

        {sources.length === 0 ? (
          <p style={{ color: "#666" }}>
            No news sources configured yet. Add one above to get started.
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {sources.map((source) => (
              <div
                key={source.id}
                style={{
                  padding: "1rem",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: source.active === false ? 0.5 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: "0.25rem" }}>{source.name}</h3>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0066cc", fontSize: "0.9rem" }}
                  >
                    {source.url}
                  </a>
                  <div
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.85rem",
                      color: "#666",
                    }}
                  >
                    Status:{" "}
                    {source.active !== false ? "✅ Active" : "⏸️ Paused"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn secondary"
                    onClick={() =>
                      toggleActive(source.id, source.active !== false)
                    }
                    title={source.active !== false ? "Pause" : "Activate"}
                  >
                    {source.active !== false ? "⏸️" : "▶️"}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => editSource(source)}
                    title="Edit"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => deleteSource(source.id)}
                    title="Delete"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}