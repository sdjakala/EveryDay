import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Modal from "../../components/Modal";
import Icon from "../../components/Icon";

type Set = {
  id: string;
  repNumber: number;
  completed: boolean;
  weight: number;
  reps: number;
  restSeconds: number;
  startTime?: number;
};

type Lift = {
  id: string;
  name: string;
  targetReps: number;
  targetWeight: number;
  restSeconds: number;
  sets: Set[];
};

type Workout = {
  id: string;
  title: string;
  lifts: Lift[];
  createdAt: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function playTimerBeep() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Play two beeps
    for (let i = 0; i < 2; i++) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.setValueAtTime(800, now + i * 0.2);
      gain.gain.setValueAtTime(0.3, now + i * 0.2);
      gain.gain.setValueAtTime(0, now + i * 0.2 + 0.1);
      
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.1);
    }
  } catch (e) {
    // Silently fail if audio context not available
  }
}

export default function WorkoutsModule() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkoutTitle, setNewWorkoutTitle] = useState("");
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [newLiftName, setNewLiftName] = useState("");
  const [newLiftSets, setNewLiftSets] = useState(3);
  const [newLiftReps, setNewLiftReps] = useState(10);
  const [newLiftWeight, setNewLiftWeight] = useState(135);
  const [newLiftRest, setNewLiftRest] = useState(60);
  const [expandedLiftId, setExpandedLiftId] = useState<string | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLiftName, setHistoryLiftName] = useState("");
  const [historyData, setHistoryData] = useState<{
    date: string;
    sets: { weight: number; reps: number }[];
  }[]>([]);
  const [historyLimit, setHistoryLimit] = useState<number | "all">(10);
  const [timerData, setTimerData] = useState<{
    workoutId: string;
    liftId: string;
    setId: string;
    secondsLeft: number;
  } | null>(null);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  // Timer effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!timerData || timerData.secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setTimerData((prev) => {
        if (!prev) return null;
        const newSeconds = prev.secondsLeft - 1;
        if (newSeconds === 0) {
          playTimerBeep();
          // When timer reaches zero, mark the set complete and clear the timer
          try {
            if (prev.workoutId) {
              // markSetComplete is stable via useCallback
              markSetComplete(prev.workoutId, prev.liftId, prev.setId);
            }
          } catch (e) {
            console.error("Error marking set complete:", e);
          }
          return null;
        }
        return { ...prev, secondsLeft: Math.max(0, newSeconds) };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerData]);

  async function fetchWorkouts() {
    try {
      const res = await fetch("/api/workouts");
      if (res.ok) {
        const data = await res.json();
        setWorkouts(data.workouts || []);
      }
    } catch (e) {
      console.error("Failed to fetch workouts:", e);
    } finally {
      setLoading(false);
    }
  }

  async function createWorkout() {
    const title = newWorkoutTitle.trim();
    if (!title) return;

    // Try to create the workout on the server first
    try {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (res.ok) {
        const created = await res.json();
        setWorkouts((prev) => [created, ...prev]);
        setNewWorkoutTitle("");
        setActiveWorkoutId(created.id);
        return;
      }

      console.error("Failed to create workout on server, falling back to local-only");
    } catch (e) {
      console.error("Error creating workout on server, falling back to local-only:", e);
    }

    // Fallback: create locally (offline/temporary)
    const workout: Workout = {
      id: uid(),
      title,
      lifts: [],
      createdAt: new Date().toISOString(),
    };

    setWorkouts((prev) => [workout, ...prev]);
    setNewWorkoutTitle("");
    setActiveWorkoutId(workout.id);
  }

  function addLift() {
    if (!activeWorkoutId || !newLiftName.trim()) return;

    const lift: Lift = {
      id: uid(),
      name: newLiftName.trim(),
      targetReps: newLiftReps,
      targetWeight: newLiftWeight,
      restSeconds: newLiftRest,
      sets: Array.from({ length: newLiftSets }, (_, i) => ({
        id: uid(),
        repNumber: i + 1,
        completed: false,
        weight: newLiftWeight,
        reps: newLiftReps,
        restSeconds: newLiftRest,
      })),
    };

    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === activeWorkoutId ? { ...w, lifts: [lift, ...w.lifts] } : w
      )
    );

    setNewLiftName("");
    setNewLiftSets(3);
    setNewLiftReps(10);
    setNewLiftWeight(135);
    setNewLiftRest(60);
  }

  function updateSetWeight(
    workoutId: string,
    liftId: string,
    setId: string,
    delta: number
  ) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              lifts: w.lifts.map((l) =>
                l.id === liftId
                  ? {
                      ...l,
                      sets: l.sets.map((s) =>
                        s.id === setId
                          ? { ...s, weight: Math.max(0, s.weight + delta) }
                          : s
                      ),
                    }
                  : l
              ),
            }
          : w
      )
    );
  }

  function updateSetReps(
    workoutId: string,
    liftId: string,
    setId: string,
    delta: number
  ) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              lifts: w.lifts.map((l) =>
                l.id === liftId
                  ? {
                      ...l,
                      sets: l.sets.map((s) =>
                        s.id === setId
                          ? { ...s, reps: Math.max(1, s.reps + delta) }
                          : s
                      ),
                    }
                  : l
              ),
            }
          : w
      )
    );
  }

  function updateSetRest(
    workoutId: string,
    liftId: string,
    setId: string,
    delta: number
  ) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              lifts: w.lifts.map((l) =>
                l.id === liftId
                  ? {
                      ...l,
                      sets: l.sets.map((s) =>
                        s.id === setId
                          ? { ...s, restSeconds: Math.max(0, s.restSeconds + delta) }
                          : s
                      ),
                    }
                  : l
              ),
            }
          : w
      )
    );
  }

  function toggleSetComplete(workoutId: string, liftId: string, setId: string) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              lifts: w.lifts.map((l) =>
                l.id === liftId
                  ? {
                      ...l,
                      sets: l.sets.map((s) =>
                        s.id === setId ? { ...s, completed: !s.completed } : s
                      ),
                    }
                  : l
              ),
            }
          : w
      )
    );
  }

  const markSetComplete = useCallback(
    (workoutId: string, liftId: string, setId: string) => {
      const updated = workouts.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              lifts: w.lifts.map((l) =>
                l.id === liftId
                  ? {
                      ...l,
                      sets: l.sets.map((s) => (s.id === setId ? { ...s, completed: true } : s)),
                    }
                  : l
              ),
            }
          : w
      );

      setWorkouts(updated);

      const workout = updated.find((w) => w.id === workoutId);
      if (workout) {
        // Persist change (fire-and-forget)
        persistWorkout(workout).catch(() => {});
      }
    },
    [workouts]
  );

  function startTimer(workoutId: string, liftId: string, setId: string, restSeconds: number) {
    setTimerData({ workoutId, liftId, setId, secondsLeft: restSeconds });
  }

  async function persistWorkout(workout: Workout) {
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifts: workout.lifts }),
      });
      if (!res.ok) {
        console.error("Failed to persist workout");
      }
    } catch (e) {
      console.error("Error persisting workout:", e);
    }
  }

  async function openHistoryForLift(liftName: string) {
    try {
      const params = new URLSearchParams();
      params.set("liftName", liftName);
      if (historyLimit !== "all") params.set("limit", String(historyLimit));
      const res = await fetch(`/api/workoutResults?${params.toString()}`);
      if (!res.ok) {
        setHistoryData([]);
        setHistoryLiftName(liftName);
        setHistoryOpen(true);
        return;
      }

      const results = await res.json();

      // Collect results that include this lift name
      const list: { date: string; sets: { weight: number; reps: number }[] }[] = [];
      for (const r of results) {
        if (!r.lifts) continue;
        const match = r.lifts.find((l: any) => l.name === liftName);
        if (match && match.sets && match.sets.length) {
          list.push({ date: r.completedAt || r.cachedAt || r.createdAt || "", sets: match.sets.map((s: any) => ({ weight: s.weight || 0, reps: s.reps || 0 })) });
        }
      }

      // sort by date ascending
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setHistoryData(list);
      setHistoryLiftName(liftName);
      setHistoryOpen(true);
    } catch (e) {
      console.error("Failed to fetch workout results:", e);
      setHistoryData([]);
      setHistoryLiftName(liftName);
      setHistoryOpen(true);
    }
  }

  function renderHistoryChart(data: { date: string; sets: { weight: number; reps: number }[] }[]) {
    if (!data || !data.length) return <div style={{ padding: 16 }}>No history for this lift.</div>;

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const xStep = 100;
    const width = Math.max(320, data.length * xStep + margin.left + margin.right);
    const height = 240;

    const allWeights = data.flatMap((d) => d.sets.map((s) => s.weight));
    const maxWeight = Math.max(...allWeights, 1);

    return (
      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={height}>
          {/* axis lines */}
          <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="rgba(255,255,255,0.08)" />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={height - margin.bottom} stroke="rgba(255,255,255,0.08)" />

          {/* points */}
          {data.map((d, i) => {
            const cx = margin.left + i * xStep + xStep / 2;
            return (
              <g key={i}>
                {/* date label */}
                <text x={cx} y={height - margin.bottom + 18} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  {new Date(d.date).toLocaleDateString()}
                </text>
                {d.sets.map((s, j) => {
                  const y = margin.top + (1 - s.weight / maxWeight) * (height - margin.top - margin.bottom);
                  const colors = ["#25f4ee", "#8456ff", "#4caf50", "#ffc107", "#ff6464"];
                  const color = colors[j % colors.length];
                  return (
                    <g key={j}>
                      <circle cx={cx} cy={y} r={6} fill={color} stroke="#071018" />
                      <text x={cx} y={y - 10} textAnchor="middle" fontSize={11} fill="#fff">
                        {s.weight}lb
                      </text>
                      <text x={cx} y={y + 18} textAnchor="middle" fontSize={10} fill="var(--muted)">
                        {s.reps} reps
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  async function deleteLift(workoutId: string, liftId: string) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, lifts: w.lifts.filter((l) => l.id !== liftId) }
          : w
      )
    );
    const workout = workouts.find((w) => w.id === workoutId);
    if (workout) {
      const updated = {
        ...workout,
        lifts: workout.lifts.filter((l) => l.id !== liftId),
      };
      await persistWorkout(updated);
    }
  }

  async function deleteSet(workoutId: string, liftId: string, setId: string) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              lifts: w.lifts.map((l) =>
                l.id === liftId
                  ? { ...l, sets: l.sets.filter((s) => s.id !== setId) }
                  : l
              ),
            }
          : w
      )
    );
    const workout = workouts.find((w) => w.id === workoutId);
    if (workout) {
      const updated = {
        ...workout,
        lifts: workout.lifts.map((l) =>
          l.id === liftId
            ? { ...l, sets: l.sets.filter((s) => s.id !== setId) }
            : l
        ),
      };
      await persistWorkout(updated);
    }
  }

  async function deleteWorkout(workoutId: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    if (activeWorkoutId === workoutId) {
      setActiveWorkoutId(null);
    }
    try {
      const res = await fetch(`/api/workouts/${workoutId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Failed to delete workout");
      }
    } catch (e) {
      console.error("Error deleting workout:", e);
    }
  }

  function isWorkoutComplete(workout: Workout): boolean {
    // Check if all lifts have at least one set, and all sets are completed
    if (workout.lifts.length === 0) return false;
    
    return workout.lifts.every((lift) =>
      lift.sets.length > 0 && lift.sets.every((set) => set.completed)
    );
  }

  async function submitWorkout(workout: Workout) {
    if (!isWorkoutComplete(workout)) {
      alert("Please complete all sets before submitting.");
      return;
    }

    try {
      const res = await fetch("/api/workoutResults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutId: workout.id,
          title: workout.title,
          lifts: workout.lifts.map((lift) => ({
            id: lift.id,
            name: lift.name,
            sets: lift.sets.map((set) => ({
              repNumber: set.repNumber,
              reps: set.reps,
              weight: set.weight,
              restSeconds: set.restSeconds,
            })),
          })),
        }),
      });

      if (res.ok) {
        // Remove the workout from the list after successful submission
        setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
        setActiveWorkoutId(null);
        // Redirect to home to view all saved workouts
        router.push("/");
      } else {
        console.error("Failed to submit workout");
        alert("Failed to submit workout. Please try again.");
      }
    } catch (e) {
      console.error("Error submitting workout:", e);
      alert("Error submitting workout.");
    }
  }

  if (loading) {
    return <div>Loading workouts...</div>;
  }

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16, width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: 8, width: "100%", boxSizing: "border-box" }}>
          <input
            type="text"
            placeholder="New workout..."
            value={newWorkoutTitle}
            onChange={(e) => setNewWorkoutTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createWorkout()}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
            }}
          />
          <button onClick={createWorkout} className="workout-create-btn">
            Create
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box" }}>
        {workouts.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            No workouts yet
          </div>
        ) : (
          workouts.map((w) => (
            <div key={w.id} style={{ marginBottom: 8, width: "100%", boxSizing: "border-box", overflow: "hidden",
              borderRadius: 6 }}>
              {/* Workout Header */}
              <div
                onClick={() => setActiveWorkoutId(activeWorkoutId === w.id ? null : w.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background:
                    activeWorkoutId === w.id
                      ? "rgba(37, 244, 238, 0.2)"
                      : "rgba(255,255,255,0.05)",
                  border:
                    activeWorkoutId === w.id
                      ? "1px solid rgba(37, 244, 238, 0.5)"
                      : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  color: "#fff",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 16 }}>{w.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {w.lifts.length} lifts
                  </div>
                </div>
                <span style={{ fontSize: 18, marginRight: 8 }}>
                  {activeWorkoutId === w.id ? "▼" : "▶"}
                </span>
                {editingWorkoutId === w.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      persistWorkout(w).then(() => {
                        setEditingWorkoutId(null);
                        fetchWorkouts();
                      });
                    }}
                    className="cal-btn"
                    title="Save workout"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWorkoutId(w.id);
                    }}
                    className="cal-btn"
                    title="Edit workout"
                  >
                    Edit
                  </button>
                )}
                {editingWorkoutId === w.id && (
                  <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkout(w.id);
                      }}
                      className="icon-btn"
                      title="Delete workout"
                      style={{ marginLeft: 8 }}
                    >
                      🗑
                    </button>
                )}
              </div>

              {/* Expanded Workout Content */}
              {activeWorkoutId === w.id && (
                <div style={{ marginTop: 12, paddingLeft: 16, width: "100%", boxSizing: "border-box" }}>
                  {/* Add Lift Form - Only show in edit mode */}
                  {editingWorkoutId === w.id && (
                    <div style={{ marginBottom: 16, padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: 6, width: "100%", boxSizing: "border-box" }}>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 500 }}>
                        Add Lift
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box" }}>
                        <input
                          type="text"
                          placeholder="Lift name (e.g., Bench Press)"
                          value={newLiftName}
                          onChange={(e) => setNewLiftName(e.target.value)}
                          style={{
                            padding: "8px 12px",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 4,
                            background: "rgba(255,255,255,0.05)",
                            color: "#fff",
                          }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 12, color: "var(--muted)" }}>
                              Sets: {newLiftSets}
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="20"
                              value={newLiftSets}
                              onChange={(e) => setNewLiftSets(parseInt(e.target.value))}
                              style={{ width: "100%" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 12, color: "var(--muted)" }}>
                              Reps: {newLiftReps}
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="30"
                              value={newLiftReps}
                              onChange={(e) => setNewLiftReps(parseInt(e.target.value))}
                              style={{ width: "100%" }}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: "var(--muted)" }}>
                            Weight: {newLiftWeight} lbs
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="500"
                            step="5"
                            value={newLiftWeight}
                            onChange={(e) => setNewLiftWeight(parseInt(e.target.value))}
                            style={{ width: "100%" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: "var(--muted)" }}>
                            Rest: {newLiftRest}s
                          </label>
                          <input
                            type="range"
                            min="15"
                            max="300"
                            step="15"
                            value={newLiftRest}
                            onChange={(e) => setNewLiftRest(parseInt(e.target.value))}
                            style={{ width: "100%" }}
                          />
                        </div>
                        <button
                          onClick={addLift}
                          className="workout-add-lift-btn"
                        >
                          Add Lift
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lifts List */}
                  {w.lifts.length === 0 ? (
                    <div style={{ color: "var(--muted)", fontSize: 14, padding: "8px 0" }}>
                      No lifts added yet
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box" }}>
                      {w.lifts.map((lift) => (
                        <div key={lift.id} style={{ width: "100%", boxSizing: "border-box" }}>
                          {/* Lift Header */}
                          <div
                            onClick={() => setExpandedLiftId(expandedLiftId === lift.id ? null : lift.id)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px 12px",
                              background:
                                expandedLiftId === lift.id
                                  ? "rgba(255,255,255,0.1)"
                                  : "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 4,
                              color: "#fff",
                              cursor: "pointer",
                              transition: "all 0.2s",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500 }}>{lift.name}</div>
                              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                {lift.sets.length} sets
                              </div>
                            </div>
                            <span style={{ fontSize: 14, marginRight: 8 }}>
                              {expandedLiftId === lift.id ? "▼" : "▶"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openHistoryForLift(lift.name);
                              }}
                              className="toggle-btn small"
                              title="View lift history"
                              style={{ marginRight: 8 }}
                            >
                              <Icon name="calendar" />
                              <span style={{ fontSize: 12, marginLeft: 6 }}>History</span>
                            </button>
                            {editingWorkoutId === w.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteLift(w.id, lift.id);
                                }}
                                style={{
                                  width: 24,
                                  height: 24,
                                  padding: 0,
                                  background: "rgba(255, 100, 100, 0.2)",
                                  border: "1px solid rgba(255, 100, 100, 0.5)",
                                  borderRadius: 3,
                                  color: "#ff6464",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                                title="Delete lift"
                              >
                                🗑
                              </button>
                            )}
                          </div>

                          {/* Expanded Lift Content - Sets */}
                          {expandedLiftId === lift.id && (
                            <div style={{ marginTop: 8, paddingLeft: 12, width: "100%", boxSizing: "border-box" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box" }}>
                                {lift.sets.map((set) => (
                                  <div
                                    key={set.id}
                                    style={{
                                      padding: "10px 12px",
                                      background: set.completed
                                        ? "rgba(37, 244, 238, 0.1)"
                                        : "rgba(255,255,255,0.02)",
                                      border: "1px solid rgba(255,255,255,0.08)",
                                      borderRadius: 4,
                                      textDecoration: set.completed
                                        ? "line-through"
                                        : "none",
                                      width: "100%",
                                      boxSizing: "border-box",
                                    }}
                                  >
                                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                                      <input
                                        type="checkbox"
                                        checked={set.completed}
                                        onChange={() =>
                                          toggleSetComplete(w.id, lift.id, set.id)
                                        }
                                        style={{ cursor: "pointer", width: 18, height: 18 }}
                                      />
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                                          Set {set.repNumber}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                                          {set.reps} reps @ {set.weight} lbs • {set.restSeconds}s rest
                                        </div>
                                      </div>
                                      {editingWorkoutId === w.id && (
                                        <button
                                          onClick={() =>
                                            deleteSet(w.id, lift.id, set.id)
                                          }
                                          style={{
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            background: "rgba(255, 100, 100, 0.2)",
                                            border: "1px solid rgba(255, 100, 100, 0.5)",
                                            borderRadius: 3,
                                            color: "#ff6464",
                                            cursor: "pointer",
                                            fontSize: 12,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                          title="Delete set"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </div>

                                    {/* Set Controls */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                                      <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "space-between" }}>
                                        <button
                                          onClick={() =>
                                            updateSetReps(w.id, lift.id, set.id, -1)
                                          }
                                          style={{
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            background: "rgba(255,255,255,0.1)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                            borderRadius: 3,
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                          title="Decrease reps"
                                        >
                                          −
                                        </button>
                                        <div style={{ textAlign: "center", flex: 1, fontSize: 12 }}>
                                          {set.reps}r
                                        </div>
                                        <button
                                          onClick={() =>
                                            updateSetReps(w.id, lift.id, set.id, 1)
                                          }
                                          style={{
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            background: "rgba(255,255,255,0.1)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                            borderRadius: 3,
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                          title="Increase reps"
                                        >
                                          +
                                        </button>
                                      </div>

                                      <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "space-between" }}>
                                        <button
                                          onClick={() =>
                                            updateSetWeight(
                                              w.id,
                                              lift.id,
                                              set.id,
                                              -2.5
                                            )
                                          }
                                          style={{
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            background: "rgba(255,255,255,0.1)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                            borderRadius: 3,
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                          title="Decrease weight"
                                        >
                                          −
                                        </button>
                                        <div style={{ textAlign: "center", flex: 1, fontSize: 12 }}>
                                          {set.weight}w
                                        </div>
                                        <button
                                          onClick={() =>
                                            updateSetWeight(
                                              w.id,
                                              lift.id,
                                              set.id,
                                              2.5
                                            )
                                          }
                                          style={{
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            background: "rgba(255,255,255,0.1)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                            borderRadius: 3,
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                          title="Increase weight"
                                        >
                                          +
                                        </button>
                                      </div>

                                      <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "space-between" }}>
                                        <button
                                          onClick={() =>
                                            updateSetRest(
                                              w.id,
                                              lift.id,
                                              set.id,
                                              -15
                                            )
                                          }
                                          style={{
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            background: "rgba(255,255,255,0.1)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                            borderRadius: 3,
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                          title="Decrease rest"
                                        >
                                          −
                                        </button>
                                        <div style={{ textAlign: "center", flex: 1, fontSize: 11 }}>
                                          {set.restSeconds}s
                                        </div>
                                        <button
                                          onClick={() =>
                                            updateSetRest(
                                              w.id,
                                              lift.id,
                                              set.id,
                                              15
                                            )
                                          }
                                          style={{
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            background: "rgba(255,255,255,0.1)",
                                            border: "1px solid rgba(255,255,255,0.2)",
                                            borderRadius: 3,
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                          title="Increase rest"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>

                                    {/* Timer or Start Button */}
                                    {timerData?.setId === set.id ? (
                                      <div style={{ padding: "8px 0" }}>
                                        <div
                                          style={{
                                            textAlign: "center",
                                            fontWeight: 600,
                                            fontSize: timerData.secondsLeft === 0 ? 20 : 16,
                                            color:
                                              timerData.secondsLeft === 0
                                                ? "#00ff00"
                                                : "rgba(37, 244, 238, 0.8)",
                                          }}
                                        >
                                          Rest: {timerData.secondsLeft}s
                                        </div>
                                      </div>
                                    ) : !set.completed ? (
                                      <button
                                        onClick={() =>
                                          startTimer(w.id, lift.id, set.id, set.restSeconds)
                                        }
                                        style={{
                                          width: "100%",
                                          padding: "8px",
                                          background: "rgba(37, 244, 238, 0.2)",
                                          border: "1px solid rgba(37, 244, 238, 0.5)",
                                          borderRadius: 4,
                                          color: "#fff",
                                          cursor: "pointer",
                                          fontSize: 13,
                                          fontWeight: 500,
                                        }}
                                      >
                                        Start Rest ({set.restSeconds}s)
                                      </button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button - Show when all sets are completed */}
              {activeWorkoutId === w.id && !editingWorkoutId && w.lifts.length > 0 && (
                <div style={{ marginTop: 16, paddingLeft: 16 }}>
                  <button
                    onClick={() => submitWorkout(w)}
                    disabled={!isWorkoutComplete(w)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      background: isWorkoutComplete(w)
                        ? "rgba(76, 175, 80, 0.3)"
                        : "rgba(76, 175, 80, 0.1)",
                      border: isWorkoutComplete(w)
                        ? "1px solid rgba(76, 175, 80, 0.6)"
                        : "1px solid rgba(76, 175, 80, 0.3)",
                      borderRadius: 6,
                      color: isWorkoutComplete(w) ? "#4caf50" : "rgba(76, 175, 80, 0.5)",
                      cursor: isWorkoutComplete(w) ? "pointer" : "not-allowed",
                      fontSize: 14,
                      fontWeight: 500,
                      transition: "all 0.2s",
                    }}
                  >
                    {isWorkoutComplete(w) ? "✓ Submit Workout" : "Complete all sets to submit"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {/* History Modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <div style={{ padding: 16, minWidth: 320, maxWidth: 800 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{historyLiftName} — History</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    className={`toggle-btn ${historyLimit === 5 ? "active" : ""} small`}
                    onClick={() => setHistoryLimit(5)}
                    title="Last 5"
                  >
                    5
                  </button>
                  <button
                    className={`toggle-btn ${historyLimit === 10 ? "active" : ""} small`}
                    onClick={() => setHistoryLimit(10)}
                    title="Last 10"
                  >
                    10
                  </button>
                  <button
                    className={`toggle-btn ${historyLimit === "all" ? "active" : ""} small`}
                    onClick={() => setHistoryLimit("all")}
                    title="All"
                  >
                    All
                  </button>
                </div>
                <button
                  className="cal-btn"
                  onClick={async () => {
                    // clear history for this lift
                    if (!confirm(`Clear history for ${historyLiftName}? This cannot be undone.`)) return;
                    try {
                      const params = new URLSearchParams();
                      params.set("liftName", historyLiftName);
                      const res = await fetch(`/api/workoutResults?${params.toString()}`, { method: "DELETE" });
                      if (res.ok) {
                        setHistoryData([]);
                        setHistoryOpen(false);
                      } else {
                        alert("Failed to clear history");
                      }
                    } catch (e) {
                      console.error(e);
                      alert("Failed to clear history");
                    }
                  }}
                >
                  Clear History
                </button>
                <button className="icon-btn" onClick={() => setHistoryOpen(false)} aria-label="Close history">✕</button>
              </div>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              Showing past workouts for this lift. Circles show weight (lb); text shows reps. Chart scrolls horizontally if there are many records.
            </div>
            {renderHistoryChart(historyData)}
        </div>
      </Modal>
    </div>
  );
}
