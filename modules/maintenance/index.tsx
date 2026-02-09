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

// Calculate overall status for a subject based on all its topics
function calculateSubjectStatus(subject: Subject) {
  if (!subject.topics || subject.topics.length === 0) {
    return { urgency: "ok", text: "No topics", count: 0 };
  }

  let overdueCount = 0;
  let warningCount = 0;
  let okCount = 0;

  subject.topics.forEach((topic) => {
    const status = calculateMaintenanceStatus(topic, subject);
    if (status.urgency === "overdue") overdueCount++;
    else if (status.urgency === "warning") warningCount++;
    else okCount++;
  });

  if (overdueCount > 0) {
    return { urgency: "overdue", text: `${overdueCount} overdue`, count: overdueCount };
  }
  if (warningCount > 0) {
    return { urgency: "warning", text: `${warningCount} due soon`, count: warningCount };
  }
  return { urgency: "ok", text: "All current", count: okCount };
}

export default function MaintenanceModule() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Expansion states
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<Set<string>>(new Set());
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());
  
  // Editing states
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  
  // New item inputs
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectType, setNewSubjectType] = useState<SubjectType>("vehicle");
  const [newTopicSubjectId, setNewTopicSubjectId] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState("");
  
  // Subject editing inputs
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectMileage, setEditSubjectMileage] = useState<number | "">("");
  const [editSubjectHours, setEditSubjectHours] = useState<number | "">("");
  
  // Topic editing inputs
  const [newStepInput, setNewStepInput] = useState("");
  const [newToolInput, setNewToolInput] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepText, setEditStepText] = useState("");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      const subjectsRes = await fetch("/api/maintenance/subjects");

      if (subjectsRes.ok) {
        const subjectsData = await subjectsRes.json();
        setSubjects(subjectsData);
      }
    } catch (e) {
      console.error("Failed to load maintenance data:", e);
    } finally {
      setLoading(false);
    }
  }

  function toggleSubject(subjectId: string) {
    setExpandedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  }

  function toggleTopic(topicId: string) {
    setExpandedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }

  function startAddingTopic(subjectId: string) {
    setNewTopicSubjectId(subjectId);
    // Ensure subject is expanded
    setExpandedSubjectIds((prev) => new Set(prev).add(subjectId));
  }

  function cancelAddingTopic() {
    setNewTopicSubjectId(null);
    setNewTopicName("");
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
        setNewSubjectName("");
        setNewSubjectType("vehicle");
        // Auto-expand new subject
        setExpandedSubjectIds((prev) => new Set(prev).add(newSubject.id));
      }
    } catch (e) {
      console.error("Failed to create subject:", e);
    }
  }

  function startEditingSubject(subject: Subject) {
    setEditingSubjectId(subject.id);
    setEditSubjectName(subject.name);
    setEditSubjectMileage(subject.currentMileage || "");
    setEditSubjectHours(subject.currentHours || "");
  }

  function cancelEditingSubject() {
    setEditingSubjectId(null);
    setEditSubjectName("");
    setEditSubjectMileage("");
    setEditSubjectHours("");
  }

  function startEditingTopic(topicId: string) {
    setEditingTopicId(topicId);
    // Ensure topic is expanded when editing
    setExpandedTopicIds((prev) => new Set(prev).add(topicId));
  }

  function stopEditingTopic() {
    setEditingTopicId(null);
  }

  async function saveSubjectEdits(id: string) {
    const subject = subjects.find((s) => s.id === id);
    if (!subject) return;

    if (!editSubjectName.trim()) {
      alert("Subject name is required");
      return;
    }

    const updates: Partial<Subject> = {};
    
    if (editSubjectName.trim() !== subject.name && editSubjectName.trim() !== "") {
      updates.name = editSubjectName.trim();
    }
    
    if (editSubjectMileage !== (subject.currentMileage || "")) {
      updates.currentMileage = editSubjectMileage === "" ? undefined : Number(editSubjectMileage);
    }
    
    if (editSubjectHours !== (subject.currentHours || "")) {
      updates.currentHours = editSubjectHours === "" ? undefined : Number(editSubjectHours);
    }

    if (Object.keys(updates).length === 0) {
      cancelEditingSubject();
      return;
    }

    try {
      const res = await fetch(`/api/maintenance/subjects?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = await res.json();
        setSubjects(subjects.map((s) => (s.id === id ? updated : s)));
        cancelEditingSubject();
      } else {
        alert("Failed to update subject");
      }
    } catch (e) {
      console.error("Failed to update subject:", e);
      alert("Failed to update subject");
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
      }
    } catch (e) {
      console.error("Failed to delete subject:", e);
    }
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopicName.trim() || !newTopicSubjectId) return;

    try {
      const res = await fetch("/api/maintenance/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: newTopicSubjectId,
          name: newTopicName,
          steps: [],
          tools: [],
        }),
      });

      if (res.ok) {
        const newTopic = await res.json();
        
        setSubjects(subjects.map((s) => {
          if (s.id === newTopicSubjectId) {
            return {
              ...s,
              topics: [newTopic, ...(s.topics || [])],
            };
          }
          return s;
        }));
        
        setNewTopicName("");
        setNewTopicSubjectId(null);
        // Auto-expand and edit new topic
        setExpandedTopicIds((prev) => new Set(prev).add(newTopic.id));
        setEditingTopicId(newTopic.id);
      }
    } catch (e) {
      console.error("Failed to create topic:", e);
    }
  }

  async function handleUpdateTopic(
    subjectId: string,
    topicId: string,
    updates: Partial<MaintenanceTopic>
  ) {
    const subject = subjects.find((s) => s.id === subjectId);
    const currentTopic = subject?.topics?.find((t) => t.id === topicId);
    if (!currentTopic) return;

    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<MaintenanceTopic>;

    const optimisticTopic = { ...currentTopic, ...cleanUpdates };

    setSubjects(subjects.map((s) => {
      if (s.id === subjectId) {
        return {
          ...s,
          topics: (s.topics || []).map((t) =>
            t.id === topicId ? optimisticTopic : t
          ),
        };
      }
      return s;
    }));
    
    try {
      const res = await fetch(
        `/api/maintenance/topics?subjectId=${subjectId}&topicId=${topicId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanUpdates),
        }
      );

      if (res.ok) {
        const serverResponse = await res.json();
        const finalTopic = { ...currentTopic, ...serverResponse };
        
        setSubjects(subjects.map((s) => {
          if (s.id === subjectId) {
            return {
              ...s,
              topics: (s.topics || []).map((t) =>
                t.id === topicId ? finalTopic : t
              ),
            };
          }
          return s;
        }));
      } else {
        setSubjects(subjects);
        alert("Failed to save changes.");
      }
    } catch (e) {
      console.error("Failed to update topic:", e);
      setSubjects(subjects);
      alert("Failed to save changes.");
    }
  }

  async function handleDeleteTopic(subjectId: string, topicId: string) {
    if (!confirm("Delete this maintenance topic?")) return;

    try {
      const res = await fetch(
        `/api/maintenance/topics?subjectId=${subjectId}&topicId=${topicId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        setSubjects(subjects.map((s) => {
          if (s.id === subjectId) {
            return {
              ...s,
              topics: (s.topics || []).filter((t) => t.id !== topicId),
            };
          }
          return s;
        }));
      }
    } catch (e) {
      console.error("Failed to delete topic:", e);
    }
  }

  function handleAddStep(subjectId: string, topicId: string) {
    if (!newStepInput.trim()) return;

    const subject = subjects.find((s) => s.id === subjectId);
    const topic = subject?.topics?.find((t) => t.id === topicId);
    if (!topic) return;

    const newStep: MaintenanceStep = {
      id: uid(),
      order: (topic.steps?.length || 0) + 1,
      description: newStepInput,
      completed: false,
    };

    handleUpdateTopic(subjectId, topicId, {
      steps: [...(topic.steps || []), newStep],
    });
    setNewStepInput("");
  }

  function handleUpdateStep(subjectId: string, topicId: string, stepId: string, description: string) {
    const subject = subjects.find((s) => s.id === subjectId);
    const topic = subject?.topics?.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const updated = topic.steps.map((s) =>
      s.id === stepId ? { ...s, description } : s
    );
    handleUpdateTopic(subjectId, topicId, { steps: updated });
    setEditingStepId(null);
  }

  function handleDeleteStep(subjectId: string, topicId: string, stepId: string) {
    const subject = subjects.find((s) => s.id === subjectId);
    const topic = subject?.topics?.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const updated = topic.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    handleUpdateTopic(subjectId, topicId, { steps: updated });
  }

  function moveStepUp(subjectId: string, topicId: string, stepId: string) {
    const subject = subjects.find((s) => s.id === subjectId);
    const topic = subject?.topics?.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const index = topic.steps.findIndex((s) => s.id === stepId);
    if (index <= 0) return;

    const newSteps = [...topic.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    const reordered = newSteps.map((s, i) => ({ ...s, order: i + 1 }));

    handleUpdateTopic(subjectId, topicId, { steps: reordered });
  }

  function moveStepDown(subjectId: string, topicId: string, stepId: string) {
    const subject = subjects.find((s) => s.id === subjectId);
    const topic = subject?.topics?.find((t) => t.id === topicId);
    if (!topic || !topic.steps) return;

    const index = topic.steps.findIndex((s) => s.id === stepId);
    if (index >= topic.steps.length - 1) return;

    const newSteps = [...topic.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    const reordered = newSteps.map((s, i) => ({ ...s, order: i + 1 }));

    handleUpdateTopic(subjectId, topicId, { steps: reordered });
  }

  function handleAddTool(subjectId: string, topicId: string) {
    if (!newToolInput.trim()) return;

    const subject = subjects.find((s) => s.id === subjectId);
    const topic = subject?.topics?.find((t) => t.id === topicId);
    if (!topic) return;

    handleUpdateTopic(subjectId, topicId, {
      tools: [...(topic.tools || []), newToolInput.trim()],
    });
    setNewToolInput("");
  }

  function handleDeleteTool(subjectId: string, topicId: string, toolIndex: number) {
    const subject = subjects.find((s) => s.id === subjectId);
    const topic = subject?.topics?.find((t) => t.id === topicId);
    if (!topic || !topic.tools) return;

    const updated = topic.tools.filter((_, i) => i !== toolIndex);
    handleUpdateTopic(subjectId, topicId, { tools: updated });
  }

  async function handleCompleteMaintenance(subject: Subject, topic: MaintenanceTopic) {
    const now = new Date().toISOString().split("T")[0];
    const payload: any = {
      action: "complete",
      subjectId: subject.id,
      topicId: topic.id,
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
        
        setSubjects(subjects.map((s) => {
          if (s.id === subject.id) {
            return {
              ...s,
              topics: (s.topics || []).map((t) =>
                t.id === topic.id ? updated : t
              ),
            };
          }
          return s;
        }));
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

  return (
    <div className="module-card">
      <style jsx>{`
        .subject-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          margin-bottom: 12px;
          overflow: hidden;
        }
        
        .subject-header {
          padding: 12px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        
        .subject-header:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        
        .subject-header-content {
          flex: 1;
          min-width: 0;
        }
        
        .subject-name {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .subject-meta {
          font-size: 12px;
          color: var(--muted);
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        
        .expand-icon {
          transition: transform 0.2s;
          font-size: 18px;
          color: var(--muted);
        }
        
        .expand-icon.expanded {
          transform: rotate(90deg);
        }
        
        .subject-content {
          padding: 0 12px 12px 12px;
        }
        
        .topic-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          margin-bottom: 8px;
          margin-left: 16px;
        }
        
        .topic-header:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        
        .status-indicator {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
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
          height: 5px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 6px;
        }
        
        .progress-fill {
          height: 100%;
          transition: width 0.3s;
        }
        
        .topic-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        
        .topic-content {
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .maintenance-step {
          background: rgba(255, 255, 255, 0.02);
          padding: 8px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        
        .maintenance-step:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .add-form {
          display: flex;
          gap: 8px;
          flex-wrap: nowrap;
          align-items: stretch;
        }
        
        .add-input {
          flex: 1 1 180px;
          min-width: 0;
          max-width: 100%;
        }
        
        .add-select {
          flex: 0 0 auto;
          min-width: 90px;
          max-width: 120px;
        }
        
        @media (max-width: 768px) {
          .add-input {
            flex: 1 1 150px;
          }
        }
        
        @media (max-width: 640px) {
          .add-input {
            flex: 1 1 80px;
            min-width: 80px;
          }
          
          .add-select {
            flex: 0 0 80px;
            max-width: 80px;
          }
          
          .topic-actions {
            width: 100%;
            justify-content: stretch !important;
          }
          
          .topic-actions button {
            flex: 1;
            font-size: 10px !important;
            padding: 6px 4px !important;
          }
          
          .subject-meta {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          
          .topic-card {
            margin-left: 8px;
          }
        }
        
        @media (max-width: 480px) {
          .add-form {
            gap: 4px;
          }
          
          .add-input {
            font-size: 13px;
          }
        }
      `}</style>

      {/* Add New Subject Form */}
      <form 
        onSubmit={handleCreateSubject} 
        className="add-form" 
        style={{ 
          marginBottom: 16,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box"
        }}
      >
        <input
          className="task-input add-input"
          placeholder="Subject name..."
          value={newSubjectName}
          onChange={(e) => setNewSubjectName(e.target.value)}
          style={{ 
            flex: "1 1 0", 
            minWidth: 0
          }}
        />
        <select
          className="add-select"
          value={newSubjectType}
          onChange={(e) => setNewSubjectType(e.target.value as SubjectType)}
          style={{
            padding: "8px 10px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "white",
            fontSize: 13,
            flexShrink: 0,
            minWidth: 90,
            maxWidth: 120,
          }}
        >
          <option value="vehicle">Vehicle</option>
          <option value="house">House</option>
          <option value="boat">Boat</option>
          <option value="equipment">Equipment</option>
          <option value="other">Other</option>
        </select>
        <button 
          type="submit" 
          className="task-add-btn" 
          style={{ 
            flexShrink: 0, 
            whiteSpace: "nowrap",
            padding: "8px 10px",
            fontSize: 13
          }}
        >
          <Icon name="plus" />
        </button>
      </form>

      {/* Subjects List */}
      {subjects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)", fontSize: 13 }}>
          No subjects yet. Create one above to start tracking maintenance!
        </div>
      ) : (
        subjects.map((subject) => {
          const isExpanded = expandedSubjectIds.has(subject.id);
          const isEditing = editingSubjectId === subject.id;
          const subjectStatus = calculateSubjectStatus(subject);
          const subjectTopics = subject.topics || [];

          return (
            <div key={subject.id} className="subject-card">
              {/* Subject Header */}
              <div 
                className="subject-header"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  toggleSubject(subject.id);
                }}
              >
                <div className="subject-header-content">
                  <div className="subject-name">{subject.name}</div>
                  <div className="subject-meta">                    
                    {subject.currentMileage && (
                      <span>{subject.currentMileage.toLocaleString()} miles</span>
                    )}
                    {subject.currentHours && (
                      <span>{subject.currentHours} hours</span>
                    )}
                    {!isExpanded && (
                      <span className={`status-indicator status-${subjectStatus.urgency}`}>
                        {subjectStatus.text}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingSubject(subject);
                      }}
                      className="task-action-btn"
                      style={{ fontSize: 11, padding: "4px 8px" }}
                    >
                      <Icon name="edit" />
                    </button>
                  )}
                  <div className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
                    ▸
                  </div>
                </div>
              </div>

              {/* Subject Content - Expanded */}
              {isExpanded && (
                <div className="subject-content">
                  {/* Subject Edit Mode */}
                  {isEditing && (
                    <div style={{ 
                      marginBottom: 16, 
                      padding: 12, 
                      background: "rgba(255,255,255,0.02)", 
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.1)"
                    }}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                          Subject Name
                        </label>
                        <input
                          type="text"
                          value={editSubjectName}
                          onChange={(e) => setEditSubjectName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 4,
                            color: "white",
                            fontSize: 13,
                          }}
                        />
                      </div>
                      
                      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        {subject.type === "vehicle" && (
                          <div style={{ flex: "1 1 120px" }}>
                            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                              Current Mileage
                            </label>
                            <input
                              type="number"
                              value={editSubjectMileage}
                              onChange={(e) => setEditSubjectMileage(e.target.value === "" ? "" : parseInt(e.target.value))}
                              style={{
                                width: "100%",
                                padding: "6px 8px",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 4,
                                color: "white",
                                fontSize: 12,
                              }}
                            />
                          </div>
                        )}
                        {(subject.type === "boat" || subject.type === "equipment") && (
                          <div style={{ flex: "1 1 120px" }}>
                            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                              Current Hours
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={editSubjectHours}
                              onChange={(e) => setEditSubjectHours(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              style={{
                                width: "100%",
                                padding: "6px 8px",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 4,
                                color: "white",
                                fontSize: 12,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => saveSubjectEdits(subject.id)}
                          className="task-action-btn"
                          style={{ fontSize: 11, padding: "6px 10px", background: "rgba(40, 167, 69, 0.2)", flex: "1 1 auto", minWidth: "70px" }}
                        >
                          <Icon name="check" /> Save
                        </button>
                        <button
                          onClick={cancelEditingSubject}
                          className="task-action-btn"
                          style={{ fontSize: 11, padding: "6px 10px", flex: "1 1 auto", minWidth: "70px" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteSubject(subject.id)}
                          className="task-action-btn"
                          style={{ fontSize: 11, padding: "6px 10px", flex: "1 1 auto", minWidth: "70px" }}
                        >
                          <Icon name="trash" /> Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Add Topic Form */}
                  {newTopicSubjectId === subject.id ? (
                    <form 
                      onSubmit={handleCreateTopic} 
                      style={{ 
                        marginBottom: 12, 
                        display: "flex", 
                        gap: 6, 
                        flexWrap: "wrap",
                        width: "100%",
                        maxWidth: "100%",
                        boxSizing: "border-box"
                      }}
                    >
                      <input
                        className="task-input"
                        placeholder="Topic name..."
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        autoFocus
                        style={{ 
                          flex: "1 1 120px", 
                          minWidth: 0,
                          maxWidth: "100%"
                        }}
                      />
                      <div style={{ 
                        display: "flex", 
                        gap: 6, 
                        flexWrap: "wrap",
                        flex: "0 0 auto"
                      }}>
                        <button 
                          type="submit" 
                          className="task-add-btn" 
                          style={{ 
                            fontSize: 11, 
                            padding: "6px 8px", 
                            flexShrink: 0, 
                            whiteSpace: "nowrap" 
                          }}
                        >
                          <Icon name="check" />
                        </button>
                        <button 
                          type="button"
                          onClick={cancelAddingTopic}
                          className="task-action-btn" 
                          style={{ 
                            fontSize: 11, 
                            padding: "6px 8px", 
                            flexShrink: 0,
                            whiteSpace: "nowrap"
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      onClick={() => startAddingTopic(subject.id)}
                      style={{
                        marginBottom: 6,
                        marginTop: 6,
                        padding: "8px 12px 8px 12px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px dashed rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--muted)",
                        textAlign: "center",
                        transition: "all 0.2s",
                        marginLeft: 16,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                      }}
                    >
                      <Icon name="plus" /> Add Maintenance Topic
                    </div>
                  )}

                  {/* Topics List */}
                  {subjectTopics.length === 0 ? (
                    <div style={{ 
                      textAlign: "center", 
                      padding: "1rem", 
                      color: "var(--muted)", 
                      fontSize: 12,
                      marginLeft: 16,
                      background: "rgba(255,255,255,0.01)",
                      borderRadius: 6
                    }}>
                      No maintenance topics yet
                    </div>
                  ) : (
                    subjectTopics.map((topic) => {
                      const status = calculateMaintenanceStatus(topic, subject);
                      const isTopicExpanded = expandedTopicIds.has(topic.id);
                      const isTopicEditing = editingTopicId === topic.id;
                      const showDoneButton = isTopicEditing || status.urgency === "warning" || status.urgency === "overdue";

                      return (
                        <div key={topic.id} className="topic-card">
                          {/* Topic Header */}
                          <div
                            className="topic-header"
                            style={{ 
                              padding: "10px 12px",
                              cursor: "pointer",
                              transition: "background 0.2s"
                            }}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button')) return;
                              toggleTopic(topic.id);
                            }}
                          >
                            {/* Topic Title and Progress - Full Width */}
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ 
                                display: "flex", 
                                justifyContent: "space-between", 
                                alignItems: "center",
                                marginBottom: 6,
                                gap: 8
                              }}>
                                <div style={{ 
                                  fontSize: 14, 
                                  fontWeight: 500,
                                  flex: 1
                                }}>
                                  {topic.name}
                                </div>
                                <span className={`status-indicator status-${status.urgency}`}>
                                  {status.statusText}
                                </span>
                              </div>
                              
                              {/* Progress Bar - Full Width */}
                              {topic.durationValue && (
                                <div>
                                  <div className="progress-bar" style={{ marginBottom: 4 }}>
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
                                  <div style={{ 
                                    fontSize: 10, 
                                    color: "var(--muted)",
                                    display: "flex",
                                    justifyContent: "space-between"
                                  }}>
                                    <span>
                                      {status.urgency === "overdue" 
                                        ? "Overdue" 
                                        : status.urgency === "warning" 
                                        ? "Due soon" 
                                        : topic.lastCompletedDate || ""}
                                    </span>
                                    <span>{Math.round(status.percentRemaining)}%</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Topic Actions - Below Title */}
                            <div 
                              className="topic-actions" 
                              onClick={(e) => e.stopPropagation()}
                              style={{ justifyContent: "flex-end" }}
                            >
                              {isTopicEditing ? (
                                <>
                                  <button
                                    onClick={() => stopEditingTopic()}
                                    className="task-action-btn"
                                    style={{ fontSize: 10, padding: "4px 8px" }}
                                  >
                                    Done Editing
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTopic(subject.id, topic.id)}
                                    className="task-action-btn"
                                    style={{ fontSize: 10, padding: "4px 8px" }}
                                  >
                                    <Icon name="trash" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {isTopicExpanded && (
                                    <button
                                      onClick={() => startEditingTopic(topic.id)}
                                      className="task-action-btn"
                                      style={{ fontSize: 10, padding: "4px 8px" }}
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {showDoneButton && (
                                    <button
                                      onClick={() => handleCompleteMaintenance(subject, topic)}
                                      className="task-action-btn"
                                      style={{ fontSize: 10, padding: "4px 8px", background: "rgba(40, 167, 69, 0.2)" }}
                                    >
                                      <Icon name="check" /> Complete
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Topic Content - Expanded */}
                          {isTopicExpanded && (
                            <div className="topic-content">
                              {isTopicEditing ? (
                                // EDIT MODE
                                <div>
                                  {/* Last Completed */}
                                  <div style={{ marginBottom: 12, padding: 8, background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
                                    <label style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, display: "block", fontWeight: 600 }}>
                                      Last Completed
                                    </label>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      <div style={{ flex: "1 1 120px" }}>
                                        <input
                                          type="date"
                                          value={topic.lastCompletedDate || ""}
                                          onChange={(e) =>
                                            handleUpdateTopic(subject.id, topic.id, {
                                              lastCompletedDate: e.target.value || undefined,
                                            })
                                          }
                                          style={{
                                            width: "100%",
                                            padding: "4px 6px",
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: 4,
                                            color: "white",
                                            fontSize: 11,
                                          }}
                                        />
                                      </div>
                                      {subject.type === "vehicle" && (
                                        <div style={{ flex: "1 1 100px" }}>
                                          <input
                                            type="number"
                                            placeholder="Mileage"
                                            value={topic.lastCompletedMileage || ""}
                                            onChange={(e) =>
                                              handleUpdateTopic(subject.id, topic.id, {
                                                lastCompletedMileage: e.target.value ? parseInt(e.target.value) : undefined,
                                              })
                                            }
                                            style={{
                                              width: "100%",
                                              padding: "4px 6px",
                                              background: "rgba(255,255,255,0.05)",
                                              border: "1px solid rgba(255,255,255,0.1)",
                                              borderRadius: 4,
                                              color: "white",
                                              fontSize: 11,
                                            }}
                                          />
                                        </div>
                                      )}
                                      {(subject.type === "boat" || subject.type === "equipment") && (
                                        <div style={{ flex: "1 1 100px" }}>
                                          <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Hours"
                                            value={topic.lastCompletedHours || ""}
                                            onChange={(e) =>
                                              handleUpdateTopic(subject.id, topic.id, {
                                                lastCompletedHours: e.target.value ? parseFloat(e.target.value) : undefined,
                                              })
                                            }
                                            style={{
                                              width: "100%",
                                              padding: "4px 6px",
                                              background: "rgba(255,255,255,0.05)",
                                              border: "1px solid rgba(255,255,255,0.1)",
                                              borderRadius: 4,
                                              color: "white",
                                              fontSize: 11,
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Interval */}
                                  <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, display: "block" }}>
                                      Maintenance Interval
                                    </label>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <input
                                        type="number"
                                        placeholder="Value"
                                        value={topic.durationValue || ""}
                                        onChange={(e) =>
                                          handleUpdateTopic(subject.id, topic.id, {
                                            durationValue: e.target.value ? parseInt(e.target.value) : undefined,
                                          })
                                        }
                                        style={{
                                          width: 80,
                                          padding: "4px 6px",
                                          background: "rgba(255,255,255,0.05)",
                                          border: "1px solid rgba(255,255,255,0.1)",
                                          borderRadius: 4,
                                          color: "white",
                                          fontSize: 11,
                                        }}
                                      />
                                      <select
                                        value={topic.durationType || "days"}
                                        onChange={(e) =>
                                          handleUpdateTopic(subject.id, topic.id, {
                                            durationType: e.target.value as DurationType,
                                          })
                                        }
                                        style={{
                                          padding: "4px 8px",
                                          background: "rgba(255,255,255,0.05)",
                                          border: "1px solid rgba(255,255,255,0.1)",
                                          borderRadius: 4,
                                          color: "white",
                                          fontSize: 11,
                                        }}
                                      >
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                        <option value="miles">Miles</option>
                                        <option value="hours">Hours</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Steps */}
                                  <div style={{ marginBottom: 12 }}>
                                    <label style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, display: "block" }}>
                                      Steps
                                    </label>
                                    {topic.steps && topic.steps.length > 0 && (
                                      <div style={{ marginBottom: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                        {topic.steps.map((step) => (
                                          <div key={step.id} className="maintenance-step">
                                            {editingStepId === step.id ? (
                                              <div style={{ display: "flex", gap: 4 }}>
                                                <input
                                                  type="text"
                                                  value={editStepText}
                                                  onChange={(e) => setEditStepText(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                      handleUpdateStep(subject.id, topic.id, step.id, editStepText);
                                                    } else if (e.key === "Escape") {
                                                      setEditingStepId(null);
                                                    }
                                                  }}
                                                  autoFocus
                                                  style={{
                                                    flex: 1,
                                                    padding: "4px 6px",
                                                    background: "rgba(255,255,255,0.05)",
                                                    border: "1px solid rgba(255,255,255,0.1)",
                                                    borderRadius: 4,
                                                    color: "white",
                                                    fontSize: 11,
                                                  }}
                                                />
                                                <button
                                                  onClick={() => handleUpdateStep(subject.id, topic.id, step.id, editStepText)}
                                                  className="task-action-btn"
                                                  style={{ fontSize: 10, padding: "4px 6px" }}
                                                >
                                                  Save
                                                </button>
                                              </div>
                                            ) : (
                                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <span style={{ fontSize: 11 }}>
                                                  {step.order}. {step.description}
                                                </span>
                                                <div style={{ display: "flex", gap: 2 }}>
                                                  <button
                                                    onClick={() => moveStepUp(subject.id, topic.id, step.id)}
                                                    className="task-action-btn"
                                                    style={{ fontSize: 10, padding: "2px 4px" }}
                                                  >
                                                    ↑
                                                  </button>
                                                  <button
                                                    onClick={() => moveStepDown(subject.id, topic.id, step.id)}
                                                    className="task-action-btn"
                                                    style={{ fontSize: 10, padding: "2px 4px" }}
                                                  >
                                                    ↓
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setEditingStepId(step.id);
                                                      setEditStepText(step.description);
                                                    }}
                                                    className="task-action-btn"
                                                    style={{ fontSize: 10, padding: "2px 4px" }}
                                                  >
                                                    Edit
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteStep(subject.id, topic.id, step.id)}
                                                    className="task-action-btn"
                                                    style={{ fontSize: 10, padding: "2px 4px" }}
                                                  >
                                                    <Icon name="trash" />
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <input
                                        type="text"
                                        placeholder="Add step..."
                                        value={newStepInput}
                                        onChange={(e) => setNewStepInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleAddStep(subject.id, topic.id);
                                          }
                                        }}
                                        style={{
                                          flex: 1,
                                          padding: "4px 6px",
                                          background: "rgba(255,255,255,0.05)",
                                          border: "1px solid rgba(255,255,255,0.1)",
                                          borderRadius: 4,
                                          color: "white",
                                          fontSize: 11,
                                        }}
                                      />
                                      <button
                                        onClick={() => handleAddStep(subject.id, topic.id)}
                                        className="task-action-btn"
                                        style={{ fontSize: 10, padding: "4px 6px" }}
                                      >
                                        <Icon name="plus" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Tools */}
                                  <div>
                                    <label style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, display: "block" }}>
                                      Tools
                                    </label>
                                    {topic.tools && topic.tools.length > 0 && (
                                      <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {topic.tools.map((tool, idx) => (
                                          <div
                                            key={idx}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                              padding: "3px 6px",
                                              background: "rgba(255,255,255,0.05)",
                                              borderRadius: 10,
                                              fontSize: 11,
                                            }}
                                          >
                                            <span>{tool}</span>
                                            <button
                                              onClick={() => handleDeleteTool(subject.id, topic.id, idx)}
                                              style={{
                                                background: "none",
                                                border: "none",
                                                color: "var(--muted)",
                                                cursor: "pointer",
                                                padding: 0,
                                                fontSize: 11,
                                              }}
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <input
                                        type="text"
                                        placeholder="Add tool..."
                                        value={newToolInput}
                                        onChange={(e) => setNewToolInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleAddTool(subject.id, topic.id);
                                          }
                                        }}
                                        style={{
                                          flex: 1,
                                          padding: "4px 6px",
                                          background: "rgba(255,255,255,0.05)",
                                          border: "1px solid rgba(255,255,255,0.1)",
                                          borderRadius: 4,
                                          color: "white",
                                          fontSize: 11,
                                        }}
                                      />
                                      <button
                                        onClick={() => handleAddTool(subject.id, topic.id)}
                                        className="task-action-btn"
                                        style={{ fontSize: 10, padding: "4px 6px" }}
                                      >
                                        <Icon name="plus" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                // VIEW MODE
                                <div style={{ fontSize: 12 }}>
                                  {(topic.lastCompletedDate || topic.lastCompletedMileage || topic.lastCompletedHours) && (
                                    <div style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>
                                        Last Completed
                                      </div>
                                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                        {topic.lastCompletedDate && (
                                          <span>{new Date(topic.lastCompletedDate).toLocaleDateString()}</span>
                                        )}
                                        {topic.lastCompletedMileage && (
                                          <span>{topic.lastCompletedMileage.toLocaleString()} mi</span>
                                        )}
                                        {topic.lastCompletedHours && (
                                          <span>{topic.lastCompletedHours} hrs</span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {topic.durationValue && (
                                    <div style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>
                                        Interval
                                      </div>
                                      <div>Every {topic.durationValue} {topic.durationType}</div>
                                    </div>
                                  )}

                                  {topic.steps && topic.steps.length > 0 && (
                                    <div style={{ marginBottom: 10 }}>
                                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>
                                        Steps
                                      </div>
                                      {topic.steps.map((step) => (
                                        <div key={step.id} style={{ paddingLeft: 6, marginBottom: 2 }}>
                                          {step.order}. {step.description}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {topic.tools && topic.tools.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>
                                        Tools
                                      </div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {topic.tools.map((tool, idx) => (
                                          <div
                                            key={idx}
                                            style={{
                                              padding: "3px 8px",
                                              background: "rgba(255,255,255,0.05)",
                                              borderRadius: 10,
                                              fontSize: 11,
                                            }}
                                          >
                                            {tool}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {!topic.lastCompletedDate && !topic.durationValue && (!topic.steps || topic.steps.length === 0) && (!topic.tools || topic.tools.length === 0) && (
                                    <div style={{ textAlign: "center", padding: "0.5rem", color: "var(--muted)", fontSize: 11 }}>
                                      No details. Click &quot;Edit&quot; to add.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}