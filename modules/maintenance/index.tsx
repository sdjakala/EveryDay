import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";
import {
  Subject,
  MaintenanceTopic,
  SubjectType,
  DurationType,
  calculateMaintenanceStatus,
  MaintenanceStep,
} from "./types";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export default function MaintenanceModule() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<MaintenanceTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  
  // Editing states
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  
  // New item inputs
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectType, setNewSubjectType] = useState<SubjectType>("vehicle");
  const [newTopicName, setNewTopicName] = useState("");
  
  // Topic editing inputs
  const [newStepInput, setNewStepInput] = useState("");
  const [newToolInput, setNewToolInput] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepText, setEditStepText] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [subjectsRes, topicsRes] = await Promise.all([
        fetch("/api/maintenance/subjects"),
        fetch("/api/maintenance/topics"),
      ]);

      if (subjectsRes.ok && topicsRes.ok) {
        const subjectsData = await subjectsRes.json();
        const topicsData = await topicsRes.json();
        setSubjects(subjectsData);
        setTopics(topicsData);
        
        if (subjectsData.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(subjectsData[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load maintenance data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      const res = await fetch("/api/maintenance/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubjectName,
          type: newSubjectType,
        }),
      });

      if (res.ok) {
        const newSubject = await res.json();
        setSubjects([...subjects, newSubject]);
        setSelectedSubjectId(newSubject.id);
        setNewSubjectName("");
        setNewSubjectType("vehicle");
      }
    } catch (e) {
      console.error("Failed to create subject:", e);
    }
  }

  async function handleUpdateSubject(id: string, updates: Partial<Subject>) {
    try {
      const res = await fetch(`/api/maintenance/subjects?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = await res.json();
        setSubjects(subjects.map((s) => (s.id === id ? updated : s)));
      }
    } catch (e) {
      console.error("Failed to update subject:", e);
    }
  }

  async function handleDeleteSubject(id: string) {
    if (!confirm("Delete this subject and all its maintenance topics?")) return;

    try {
      const res = await fetch(`/api/maintenance/subjects?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSubjects(subjects.filter((s) => s.id !== id));
        setTopics(topics.filter((t) => t.subjectId !== id));
        if (selectedSubjectId === id) {
          setSelectedSubjectId(subjects.find((s) => s.id !== id)?.id || null);
        }
      }
    } catch (e) {
      console.error("Failed to delete subject:", e);
    }
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopicName.trim() || !selectedSubjectId) return;

    try {
      const res = await fetch("/api/maintenance/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          name: newTopicName,
          steps: [],
          tools: [],
        }),
      });

      if (res.ok) {
        const newTopic = await res.json();
        setTopics([...topics, newTopic]);
        setNewTopicName("");
        setEditingTopicId(newTopic.id);
      }
    } catch (e) {
      console.error("Failed to create topic:", e);
    }
  }

  async function handleUpdateTopic(id: string, updates: Partial<MaintenanceTopic>) {
    // Optimistic update - immediately update UI
    setTopics(topics.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    
    // Then persist to server
    try {
      const res = await fetch(`/api/maintenance/topics?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = await res.json();
        // Update with server response to ensure consistency
        setTopics(topics.map((t) => (t.id === id ? updated : t)));
      } else {
        // Revert on error by reloading data
        loadData();
      }
    } catch (e) {
      console.error("Failed to update topic:", e);
      // Revert on error by reloading data
      loadData();
    }
  }

  async function handleDeleteTopic(id: string) {
    if (!confirm("Delete this maintenance topic?")) return;

    try {
      const res = await fetch(`/api/maintenance/topics?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTopics(topics.filter((t) => t.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete topic:", e);
    }
  }

  function handleAddStep(topicId: string) {
    if (!newStepInput.trim()) return;
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;

    const newStep: MaintenanceStep = {
      id: uid(),
      order: (topic.steps?.length || 0) + 1,
      description: newStepInput,
      completed: false,
    };

    handleUpdateTopic(topicId, {
      steps: [...(topic.steps || []), newStep],
    });
    setNewStepInput("");
  }

  function handleUpdateStep(topicId: string, stepId: string, description: string) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const updated = topic.steps.map((s) =>
      s.id === stepId ? { ...s, description } : s
    );
    handleUpdateTopic(topicId, { steps: updated });
    setEditingStepId(null);
  }

  function handleDeleteStep(topicId: string, stepId: string) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const updated = topic.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    handleUpdateTopic(topicId, { steps: updated });
  }

  function moveStepUp(topicId: string, stepId: string) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const index = topic.steps.findIndex((s) => s.id === stepId);
    if (index <= 0) return;

    const newSteps = [...topic.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    const reordered = newSteps.map((s, i) => ({ ...s, order: i + 1 }));

    handleUpdateTopic(topicId, { steps: reordered });
  }

  function moveStepDown(topicId: string, stepId: string) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const index = topic.steps.findIndex((s) => s.id === stepId);
    if (index >= topic.steps.length - 1) return;

    const newSteps = [...topic.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    const reordered = newSteps.map((s, i) => ({ ...s, order: i + 1 }));

    handleUpdateTopic(topicId, { steps: reordered });
  }

  function handleAddTool(topicId: string) {
    if (!newToolInput.trim()) return;
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return;

    handleUpdateTopic(topicId, {
      tools: [...(topic.tools || []), newToolInput.trim()],
    });
    setNewToolInput("");
  }

  function handleDeleteTool(topicId: string, toolIndex: number) {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic || !topic.tools) return;

    const updated = topic.tools.filter((_, i) => i !== toolIndex);
    handleUpdateTopic(topicId, { tools: updated });
  }

  async function handleCompleteMaintenance(topic: MaintenanceTopic) {
    const subject = subjects.find((s) => s.id === topic.subjectId);
    if (!subject) return;

    const now = new Date().toISOString().split("T")[0];
    const payload: any = {
      action: "complete",
      id: topic.id,
      date: now,
    };

    if (subject.type === "vehicle" && subject.currentMileage) {
      payload.mileage = subject.currentMileage;
    }
    if ((subject.type === "boat" || subject.type === "equipment") && subject.currentHours) {
      payload.hours = subject.currentHours;
    }

    try {
      const res = await fetch("/api/maintenance/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setTopics(topics.map((t) => (t.id === updated.id ? updated : t)));
      }
    } catch (e) {
      console.error("Failed to complete maintenance:", e);
    }
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading maintenance data...</p>
      </div>
    );
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const subjectTopics = selectedSubject
    ? topics.filter((t) => t.subjectId === selectedSubject.id)
    : [];

  return (
    <div className="module-card">
      <style jsx>{`
        .maintenance-step {
          background: rgba(255, 255, 255, 0.02);
          padding: 8px;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .maintenance-step:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .subject-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .subject-tab {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
        }
        .subject-tab:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .subject-tab.active {
          background: linear-gradient(90deg, var(--accent-start), var(--accent-end));
          color: #000;
          border-color: transparent;
        }
        .topic-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .status-indicator {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .status-ok {
          background: rgba(40, 167, 69, 0.2);
          color: #28a745;
        }
        .status-warning {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }
        .status-overdue {
          background: rgba(220, 53, 69, 0.2);
          color: #dc3545;
        }
        .progress-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin: 8px 0;
        }
        .progress-fill {
          height: 100%;
          transition: width 0.3s;
        }
      `}</style>

      {/* Subject Selector Tabs */}
      <div className="subject-selector">
        {subjects.map((subject) => (
          <button
            key={subject.id}
            className={`subject-tab ${selectedSubjectId === subject.id ? "active" : ""}`}
            onClick={() => setSelectedSubjectId(subject.id)}
          >
            {subject.name}
            {subject.type === "vehicle" && subject.currentMileage && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                • {subject.currentMileage.toLocaleString()}mi
              </span>
            )}
          </button>
        ))}
        <button
          className="subject-tab"
          style={{ fontWeight: 600 }}
          onClick={() => {
            const name = prompt("Subject name (e.g., '2015 Honda Civic'):");
            if (!name) return;
            setNewSubjectName(name);
            handleCreateSubject(new Event("submit") as any);
          }}
        >
          + Add Subject
        </button>
      </div>

      {selectedSubject ? (
        <>
          {/* Subject Details */}
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 16 }}>{selectedSubject.name}</h3>
                <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "capitalize" }}>
                  {selectedSubject.type}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {selectedSubject.type === "vehicle" && (
                  <input
                    type="number"
                    placeholder="Mileage"
                    value={selectedSubject.currentMileage || ""}
                    onChange={(e) =>
                      handleUpdateSubject(selectedSubject.id, {
                        currentMileage: parseInt(e.target.value) || undefined,
                      })
                    }
                    style={{
                      width: 100,
                      padding: "6px 8px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      color: "white",
                      fontSize: 12,
                    }}
                  />
                )}
                {(selectedSubject.type === "boat" || selectedSubject.type === "equipment") && (
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Hours"
                    value={selectedSubject.currentHours || ""}
                    onChange={(e) =>
                      handleUpdateSubject(selectedSubject.id, {
                        currentHours: parseFloat(e.target.value) || undefined,
                      })
                    }
                    style={{
                      width: 100,
                      padding: "6px 8px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 4,
                      color: "white",
                      fontSize: 12,
                    }}
                  />
                )}
                <button
                  onClick={() => handleDeleteSubject(selectedSubject.id)}
                  className="task-action-btn"
                  style={{ padding: "6px 10px", fontSize: 12 }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Create Topic Form */}
          <form onSubmit={handleCreateTopic} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="task-input"
                placeholder="New maintenance topic (e.g., Oil Change)..."
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="task-add-btn">
                <Icon name="plus" /> Add Topic
              </button>
            </div>
          </form>

          {/* Topics List */}
          {subjectTopics.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontSize: 13 }}>
              No maintenance topics yet. Create one above!
            </div>
          ) : (
            subjectTopics.map((topic) => {
              const status = calculateMaintenanceStatus(topic, selectedSubject);
              const isEditing = editingTopicId === topic.id;

              return (
                <div key={topic.id} className="topic-card">
                  {/* Topic Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <strong style={{ fontSize: 14 }}>{topic.name}</strong>
                        <span className={`status-indicator status-${status.urgency}`}>
                          {status.statusText}
                        </span>
                      </div>
                      {topic.durationValue && (
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${status.percentRemaining}%`,
                              background:
                                status.urgency === "overdue"
                                  ? "#dc3545"
                                  : status.urgency === "warning"
                                  ? "#ffc107"
                                  : "#28a745",
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setEditingTopicId(isEditing ? null : topic.id)}
                        className="task-action-btn"
                        style={{ fontSize: 12 }}
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                      {!isEditing && (
                        <button
                          onClick={() => handleCompleteMaintenance(topic)}
                          className="task-action-btn"
                          style={{ fontSize: 12, background: "rgba(40,167,69,0.2)", color: "#28a745" }}
                        >
                          Complete
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="task-action-btn"
                        style={{ fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <>
                      {/* Interval Settings */}
                      <div style={{ marginBottom: 12, padding: 8, background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                        <div style={{ fontSize: 12, marginBottom: 6, color: "var(--muted)" }}>Maintenance Interval</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="number"
                            placeholder="Value"
                            value={topic.durationValue || ""}
                            onChange={(e) =>
                              handleUpdateTopic(topic.id, {
                                durationValue: parseFloat(e.target.value) || undefined,
                              })
                            }
                            style={{
                              flex: 1,
                              padding: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 4,
                              color: "white",
                              fontSize: 13,
                            }}
                          />
                          <select
                            value={topic.durationType || "months"}
                            onChange={(e) =>
                              handleUpdateTopic(topic.id, {
                                durationType: e.target.value as DurationType,
                              })
                            }
                            style={{
                              padding: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 4,
                              color: "white",
                              fontSize: 13,
                            }}
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="miles">Miles</option>
                            <option value="hours">Hours</option>
                          </select>
                        </div>
                      </div>

                      {/* Tools Section */}
                      <div style={{ marginBottom: 12 }}>
                        <strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Tools Required</strong>
                        {topic.tools && topic.tools.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                            {topic.tools.map((tool, i) => (
                              <div
                                key={i}
                                style={{
                                  padding: "4px 8px",
                                  background: "rgba(255,255,255,0.08)",
                                  borderRadius: 4,
                                  fontSize: 12,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {tool}
                                <button
                                  onClick={() => handleDeleteTool(topic.id, i)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "rgba(255,255,255,0.5)",
                                    cursor: "pointer",
                                    padding: 0,
                                    fontSize: 14,
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            placeholder="Add tool (e.g., wrench)"
                            value={newToolInput}
                            onChange={(e) => setNewToolInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTool(topic.id);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 4,
                              color: "white",
                              fontSize: 12,
                            }}
                          />
                          <button
                            onClick={() => handleAddTool(topic.id)}
                            style={{
                              padding: "6px 10px",
                              background: "#25f4ee",
                              color: "#000",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            Add Tool
                          </button>
                        </div>
                      </div>

                      {/* Steps Section */}
                      <div>
                        <strong style={{ fontSize: 12, display: "block", marginBottom: 6 }}>Steps</strong>
                        {topic.steps && topic.steps.length > 0 && (
                          <ol style={{ margin: "0 0 8px 0", paddingLeft: 20 }}>
                            {topic.steps.map((step) => {
                              const isEditingThisStep = editingStepId === step.id;
                              return (
                                <li key={step.id} className="maintenance-step" style={{ marginBottom: 6 }}>
                                  {isEditingThisStep ? (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      <input
                                        value={editStepText}
                                        onChange={(e) => setEditStepText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleUpdateStep(topic.id, step.id, editStepText);
                                          }
                                          if (e.key === "Escape") {
                                            setEditingStepId(null);
                                          }
                                        }}
                                        style={{
                                          flex: 1,
                                          padding: 6,
                                          background: "rgba(255,255,255,0.05)",
                                          border: "1px solid rgba(255,255,255,0.1)",
                                          borderRadius: 4,
                                          color: "white",
                                          fontSize: 12,
                                        }}
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleUpdateStep(topic.id, step.id, editStepText)}
                                        className="task-action-btn"
                                        style={{ fontSize: 11 }}
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingStepId(null)}
                                        className="task-action-btn"
                                        style={{ fontSize: 11 }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "start", gap: 8 }}>
                                      <span style={{ flex: 1, fontSize: 13 }}>{step.description}</span>
                                      <div style={{ display: "flex", gap: 4 }}>
                                        <button
                                          onClick={() => moveStepUp(topic.id, step.id)}
                                          className="task-action-btn"
                                          style={{ padding: "2px 6px", fontSize: 11 }}
                                        >
                                          ↑
                                        </button>
                                        <button
                                          onClick={() => moveStepDown(topic.id, step.id)}
                                          className="task-action-btn"
                                          style={{ padding: "2px 6px", fontSize: 11 }}
                                        >
                                          ↓
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingStepId(step.id);
                                            setEditStepText(step.description);
                                          }}
                                          className="task-action-btn"
                                          style={{ padding: "2px 6px", fontSize: 11 }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteStep(topic.id, step.id)}
                                          className="task-action-btn"
                                          style={{ padding: "2px 6px", fontSize: 11 }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            placeholder="Add step..."
                            value={newStepInput}
                            onChange={(e) => setNewStepInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddStep(topic.id);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 4,
                              color: "white",
                              fontSize: 12,
                            }}
                          />
                          <button
                            onClick={() => handleAddStep(topic.id)}
                            style={{
                              padding: "6px 10px",
                              background: "#25f4ee",
                              color: "#000",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            Add Step
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {!isEditing && (
                    <>
                      {/* Read-only view */}
                      {topic.tools && topic.tools.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <strong>Tools:</strong>{" "}
                          {topic.tools.join(", ")}
                        </div>
                      )}
                      {topic.steps && topic.steps.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong style={{ fontSize: 12 }}>Steps:</strong>
                          <ol style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: 13 }}>
                            {topic.steps.map((step) => (
                              <li key={step.id} style={{ marginTop: 4 }}>
                                {step.description}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {topic.lastCompletedDate && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                          Last completed: {new Date(topic.lastCompletedDate).toLocaleDateString()}
                          {topic.lastCompletedMileage && ` at ${topic.lastCompletedMileage.toLocaleString()} mi`}
                          {topic.lastCompletedHours && ` at ${topic.lastCompletedHours} hrs`}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
          <p style={{ marginBottom: 16 }}>No subjects yet</p>
          <form onSubmit={handleCreateSubject} style={{ display: "inline-block" }}>
            <input
              className="task-input"
              placeholder="Subject name (e.g., 2015 Honda Civic)"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              style={{ marginRight: 8 }}
            />
            <select
              value={newSubjectType}
              onChange={(e) => setNewSubjectType(e.target.value as SubjectType)}
              style={{
                padding: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "white",
                marginRight: 8,
              }}
            >
              <option value="vehicle">Vehicle</option>
              <option value="house">House</option>
              <option value="boat">Boat</option>
              <option value="equipment">Equipment</option>
              <option value="other">Other</option>
            </select>
            <button type="submit" className="task-add-btn">
              Create First Subject
            </button>
          </form>
        </div>
      )}
    </div>
  );
}