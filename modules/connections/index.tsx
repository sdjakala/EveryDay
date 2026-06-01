// modules/connections/index.tsx
import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type Connection = {
  id: string;
  requesterId: string;
  requesterName?: string;
  recipientId: string;
  recipientName?: string;
  status: "pending" | "accepted" | "declined";
  permissions: ("assign-tasks" | "view-tasks")[];
  createdAt: string;
  acceptedAt?: string;
  declinedAt?: string;
};

type User = {
  email: string;
  name?: string;
};

export default function ConnectionsModule() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "assign-tasks",
    "view-tasks",
  ]);
  const [showNewRequest, setShowNewRequest] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchConnections();
  }, []);

  async function fetchCurrentUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser({
          email: data.payload.email,
          name: data.payload.name,
        });
      }
    } catch (e) {
      console.error("Failed to fetch current user:", e);
    }
  }

  async function fetchConnections() {
    try {
      setLoading(true);
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (e) {
      console.error("Failed to fetch connections:", e);
    } finally {
      setLoading(false);
    }
  }

  async function sendConnectionRequest() {
    const email = recipientEmail.trim();
    if (!email) return;

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: email,
          recipientName: recipientName.trim() || undefined,
          permissions: selectedPermissions,
        }),
      });

      if (res.ok) {
        const newConnection = await res.json();
        setConnections((prev) => [newConnection, ...prev]);
        setRecipientEmail("");
        setRecipientName("");
        setShowNewRequest(false);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to send connection request");
      }
    } catch (e) {
      console.error("Failed to send connection request:", e);
      alert("Failed to send connection request");
    }
  }

  async function updateConnectionStatus(id: string, status: "accepted" | "declined") {
    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        const updated = await res.json();
        setConnections((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
      }
    } catch (e) {
      console.error("Failed to update connection:", e);
    }
  }

  async function deleteConnection(id: string) {
    if (!confirm("Are you sure you want to remove this connection?")) return;

    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete connection:", e);
    }
  }

  function togglePermission(perm: string) {
    setSelectedPermissions((prev) =>
      prev.includes(perm)
        ? prev.filter((p) => p !== perm)
        : [...prev, perm]
    );
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading connections...</p>
      </div>
    );
  }

  const pendingRequests = connections.filter(
    (c) => c.status === "pending" && c.recipientId === currentUser?.email
  );
  const sentRequests = connections.filter(
    (c) => c.status === "pending" && c.requesterId === currentUser?.email
  );
  const activeConnections = connections.filter((c) => c.status === "accepted");

  return (
    <div className="module-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>👥 Connections</h3>
        <button
          className="task-add-btn"
          onClick={() => setShowNewRequest(!showNewRequest)}
          style={{ padding: "6px 12px", fontSize: "0.9rem" }}
        >
          {showNewRequest ? "Cancel" : "+ New Request"}
        </button>
      </div>

      {showNewRequest && (
        <div style={{
          padding: "1rem",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: "8px",
          marginBottom: "1rem",
        }}>
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
            Send Connection Request
          </h4>
          <input
            type="email"
            placeholder="Email address"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "0.5rem",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "var(--card)",
              color: "#eef2f5",
            }}
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "0.75rem",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "var(--card)",
              color: "#eef2f5",
            }}
          />
          
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              Permissions:
            </p>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={selectedPermissions.includes("view-tasks")}
                onChange={() => togglePermission("view-tasks")}
                style={{ marginRight: "0.5rem" }}
              />
              View my tasks
            </label>
            <label style={{ display: "block", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={selectedPermissions.includes("assign-tasks")}
                onChange={() => togglePermission("assign-tasks")}
                style={{ marginRight: "0.5rem" }}
              />
              Assign tasks to me
            </label>
          </div>

          <button
            onClick={sendConnectionRequest}
            className="task-add-btn"
            style={{ width: "100%" }}
          >
            Send Request
          </button>
        </div>
      )}

      {/* Pending Requests (Received) */}
      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Pending Requests ({pendingRequests.length})
          </h4>
          {pendingRequests.map((conn) => (
            <div
              key={conn.id}
              style={{
                padding: "0.75rem",
                background: "rgba(37, 244, 238, 0.05)",
                border: "1px solid rgba(37, 244, 238, 0.2)",
                borderRadius: "6px",
                marginBottom: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {conn.requesterName || conn.requesterId}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {conn.requesterId}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    Permissions: {conn.permissions.join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => updateConnectionStatus(conn.id, "accepted")}
                    style={{
                      padding: "6px 12px",
                      background: "linear-gradient(90deg, var(--accent-start), var(--accent-end))",
                      color: "#071018",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => updateConnectionStatus(conn.id, "declined")}
                    style={{
                      padding: "6px 12px",
                      background: "transparent",
                      color: "var(--muted)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent Requests (Waiting) */}
      {sentRequests.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
            Sent Requests ({sentRequests.length})
          </h4>
          {sentRequests.map((conn) => (
            <div
              key={conn.id}
              style={{
                padding: "0.75rem",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: "6px",
                marginBottom: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 500 }}>
                    {conn.recipientName || conn.recipientId}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {conn.recipientId}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    Status: Waiting for response
                  </div>
                </div>
                <button
                  onClick={() => deleteConnection(conn.id)}
                  className="task-action-btn"
                  title="Cancel request"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Connections */}
      <div>
        <h4 style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
          Active Connections ({activeConnections.length})
        </h4>
        {activeConnections.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", fontStyle: "italic" }}>
            No active connections yet. Send a request to connect with someone!
          </p>
        ) : (
          activeConnections.map((conn) => {
            const isRequester = conn.requesterId === currentUser?.email;
            const otherUserEmail = isRequester ? conn.recipientId : conn.requesterId;
            const otherUserName = isRequester ? conn.recipientName : conn.requesterName;

            return (
              <div
                key={conn.id}
                style={{
                  padding: "0.75rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "6px",
                  marginBottom: "0.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {otherUserName || otherUserEmail}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      {otherUserEmail}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                      Permissions: {conn.permissions.join(", ")}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteConnection(conn.id)}
                    className="task-action-btn"
                    title="Remove connection"
                  >
                    <Icon name="trash-2" size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}