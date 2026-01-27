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

// Sparkline component for showing lift history
function Sparkline({ data, width = 60, height = 20 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length === 0) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero
  
  // Create SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  // Determine trend (comparing first half to second half)
  const midPoint = Math.floor(data.length / 2);
  const firstHalfAvg = data.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint;
  const secondHalfAvg = data.slice(midPoint).reduce((a, b) => a + b, 0) / (data.length - midPoint);
  const isUpward = secondHalfAvg > firstHalfAvg;
  const color = isUpward ? '#00bf63' : '#ff6b6b'; // Green for upward, red for downward
  
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Add dots at each point */}
      {data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="1.5"
            fill={color}
            opacity="0.6"
          />
        );
      })}
    </svg>
  );
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
  const [liftHistoryData, setLiftHistoryData] = useState<Record<string, number[]>>({});

  useEffect(() => {
    fetchWorkouts();
    fetchAllLiftHistory();
  }, []);

  async function fetchAllLiftHistory() {
    try {
      const res = await fetch("/api/workoutResults");
      if (res.ok) {
        const data = await res.json();
        
        // Group by lift name and calculate total weight per session
        const historyByLift: Record<string, number[]> = {};
        
        data.forEach((result: any) => {
          result.lifts.forEach((lift: any) => {
            if (!historyByLift[lift.name]) {
              historyByLift[lift.name] = [];
            }
            // Calculate total weight for this lift session (sum of weight * reps for all sets)
            const totalWeight = lift.sets.reduce((sum: number, set: any) => {
              return sum + (set.weight * set.reps);
            }, 0);
            historyByLift[lift.name].push(totalWeight);
          });
        });
        
        // Keep only the last 10 sessions for each lift
        Object.keys(historyByLift).forEach(liftName => {
          historyByLift[liftName] = historyByLift[liftName].slice(-10);
        });
        
        setLiftHistoryData(historyByLift);
      }
    } catch (e) {
      console.error("Failed to fetch lift history:", e);
    }
  }

  // Timer effect
  useEffect(() => {
    if (!timerData || timerData.secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setTimerData((prev) => {
        if (!prev) return null;
        const newSeconds = prev.secondsLeft - 1;
        if (newSeconds === 0) {
          playTimerBeep();
          try {
            if (prev.workoutId) {
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

      console.error("Failed to create workout on server");
    } catch (e) {
      console.error("Error creating workout:", e);
    }

    // Fallback: create locally
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

  function updateSetWeight(workoutId: string, liftId: string, setId: string, delta: number) {
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
                        s.id === setId ? { ...s, weight: Math.max(0, s.weight + delta) } : s
                      ),
                    }
                  : l
              ),
            }
          : w
      )
    );
  }

  function updateSetReps(workoutId: string, liftId: string, setId: string, delta: number) {
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
                        s.id === setId ? { ...s, reps: Math.max(1, s.reps + delta) } : s
                      ),
                    }
                  : l
              ),
            }
          : w
      )
    );
  }

  function updateSetRest(workoutId: string, liftId: string, setId: string, delta: number) {
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
                        s.id === setId ? { ...s, restSeconds: Math.max(0, s.restSeconds + delta) } : s
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
    },
    [workouts]
  );

  function startTimer(workoutId: string, liftId: string, setId: string, seconds: number) {
    setTimerData({ workoutId, liftId, setId, secondsLeft: seconds });
  }

  async function persistWorkout(workout: Workout) {
    try {
      const res = await fetch(`/api/workouts/${workout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workout),
      });
      if (!res.ok) {
        console.error("Failed to persist workout");
      }
    } catch (e) {
      console.error("Error persisting workout:", e);
    }
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
    // Add confirmation dialog
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${workout.title}"?\n\nThis action cannot be undone.`
    );
    
    if (!confirmDelete) {
      return;
    }
    
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

  async function moveLiftUp(workoutId: string, liftId: string) {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const liftIndex = workout.lifts.findIndex((l) => l.id === liftId);
    if (liftIndex <= 0) return;

    const newLifts = [...workout.lifts];
    [newLifts[liftIndex - 1], newLifts[liftIndex]] = [newLifts[liftIndex], newLifts[liftIndex - 1]];

    setWorkouts((prev) =>
      prev.map((w) => (w.id === workoutId ? { ...w, lifts: newLifts } : w))
    );

    const updated = { ...workout, lifts: newLifts };
    await persistWorkout(updated);
  }

  async function moveLiftDown(workoutId: string, liftId: string) {
    const workout = workouts.find((w) => w.id === workoutId);
    if (!workout) return;

    const liftIndex = workout.lifts.findIndex((l) => l.id === liftId);
    if (liftIndex === -1 || liftIndex >= workout.lifts.length - 1) return;
    
    const newLifts = [...workout.lifts];
    [newLifts[liftIndex + 1], newLifts[liftIndex]] = [newLifts[liftIndex], newLifts[liftIndex + 1]];

    setWorkouts((prev) =>
      prev.map((w) => (w.id === workoutId ? { ...w, lifts: newLifts } : w))
    );

    const updated = { ...workout, lifts: newLifts };
    await persistWorkout(updated);
  }

  function isWorkoutComplete(workout: Workout): boolean {
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
        setWorkouts((prev) => 
          prev.map((w) =>
            w.id === workout.id
              ? {
                ...w,
                lifts: w.lifts.map((lift) => ({
                  ...lift,
                  sets: lift.sets.map((set) => ({ 
                    ...set, 
                    completed: false
                  })),
                })),
              }
              : w
            )
        );        
        
        const updatedWorkout = {
          ...workout,
          lifts: workout.lifts.map((lift) => ({
            ...lift,
            sets: lift.sets.map((set) => ({
              ...set,
              completed: false,
            })),
          })),
        };
        await persistWorkout(updatedWorkout);

        setActiveWorkoutId(null);
        
        // Refresh lift history data to update sparklines
        await fetchAllLiftHistory();
        
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

  async function openHistory(liftName: string) {
    setHistoryLiftName(liftName);
    setHistoryOpen(true);
    try {
      const limit = historyLimit === "all" ? undefined : historyLimit;
      const params = new URLSearchParams({ liftName });
      if (limit) params.append("limit", String(limit));
      const res = await fetch(`/api/workoutResults?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const grouped: Record<string, { weight: number; reps: number }[]> = {};
        data.forEach((r: any) => {
          const lift = r.lifts.find((l: any) => l.name === liftName);
          if (!lift) return;
          const date = new Date(r.completedAt).toLocaleDateString();
          if (!grouped[date]) grouped[date] = [];
          lift.sets.forEach((s: any) => {
            grouped[date].push({ weight: s.weight, reps: s.reps });
          });
        });
        const arr = Object.keys(grouped).map((date) => ({
          date,
          sets: grouped[date],
        }));
        setHistoryData(arr);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

  if (loading) {
    return <div>Loading workouts...</div>;
  }

  const setColors = ["#25f4ee", "#8456ff", "#ffa500", "#ff6b6b", "#00bf63"];

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      {/* Create Workout Input */}
      <div style={{ marginBottom: 16, marginTop: 5, width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: 8, width: "100%", boxSizing: "border-box" }}>
          <input
            type="text"
            placeholder="New workout..."
            value={newWorkoutTitle}
            onChange={(e) => setNewWorkoutTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createWorkout()}
            className="workout-input"
          />
          <button onClick={createWorkout} className="workout-create-btn">
            Create
          </button>
        </div>
      </div>

      {/* Workouts List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", boxSizing: "border-box" }}>
        {workouts.length === 0 ? (
          <div className="workout-empty-state">
            No workouts yet. Create one above to get started!
          </div>
        ) : (
          workouts.map((w) => (
            <div key={w.id} className="workout-card">
              {/* Workout Header */}
              <div
                onClick={() => setActiveWorkoutId(activeWorkoutId === w.id ? null : w.id)}
                className={`workout-card-header ${activeWorkoutId === w.id ? 'active' : ''}`}
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
                    <div className="lift-form">
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, fontWeight: 500 }}>
                        Add Lift
                      </div>
                      <div className="lift-form-grid">
                        <input
                          type="text"
                          placeholder="Lift name"
                          value={newLiftName}
                          onChange={(e) => setNewLiftName(e.target.value)}
                          className="workout-input"
                        />
                        <input
                          type="number"
                          placeholder="Sets"
                          value={newLiftSets}
                          onChange={(e) => setNewLiftSets(Number(e.target.value))}
                          className="lift-input-number"
                        />
                        <input
                          type="number"
                          placeholder="Reps"
                          value={newLiftReps}
                          onChange={(e) => setNewLiftReps(Number(e.target.value))}
                          className="lift-input-number"
                        />
                        <input
                          type="number"
                          placeholder="Weight"
                          value={newLiftWeight}
                          onChange={(e) => setNewLiftWeight(Number(e.target.value))}
                          className="lift-input-number"
                        />
                        <input
                          type="number"
                          placeholder="Rest (s)"
                          value={newLiftRest}
                          onChange={(e) => setNewLiftRest(Number(e.target.value))}
                          className="lift-input-number"
                        />
                      </div>
                      <button onClick={addLift} className="workout-create-btn" style={{ width: "100%" }}>
                        Add Lift
                      </button>
                    </div>
                  )}

                  {/* Lifts List */}
                  {w.lifts.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      {w.lifts.map((lift) => (
                        <div key={lift.id} className="lift-card">
                          <div
                            className="lift-card-header"
                            onClick={() => setExpandedLiftId(expandedLiftId === lift.id ? null : lift.id)}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{lift.name}</div>
                                {liftHistoryData[lift.name] && liftHistoryData[lift.name].length > 0 && (
                                  <div style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: 4,
                                    padding: "2px 6px",
                                    background: "rgba(255,255,255,0.05)",
                                    borderRadius: 4,
                                    border: "1px solid rgba(255,255,255,0.1)"
                                  }}>
                                    <Sparkline data={liftHistoryData[lift.name]} width={50} height={16} />
                                    <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 500 }}>
                                      {liftHistoryData[lift.name].length}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                {lift.sets.length} sets • {lift.targetReps} reps @ {lift.targetWeight} lbs
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                              {editingWorkoutId === w.id && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveLiftUp(w.id, lift.id);
                                    }}
                                    disabled={w.lifts.indexOf(lift) === 0}
                                    className="workout-action-btn"
                                    title="Move Up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveLiftDown(w.id, lift.id);
                                    }}
                                    disabled={w.lifts.indexOf(lift) === w.lifts.length - 1}
                                    className="workout-action-btn"
                                    title="Move Down"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteLift(w.id, lift.id);
                                    }}
                                    className="workout-action-btn danger"
                                    title="Delete lift"
                                  >
                                    ×
                                  </button>
                                </>
                              )}
                              {!editingWorkoutId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openHistory(lift.name);
                                  }}
                                  className="cal-btn"
                                  title="View history"
                                  style={{ fontSize: 11, padding: "4px 8px" }}
                                >
                                  History
                                </button>
                              )}
                              <span style={{ fontSize: 14 }}>
                                {expandedLiftId === lift.id ? "▼" : "▶"}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Sets */}
                          {expandedLiftId === lift.id && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {lift.sets.map((set) => {
                                  const isTimerActive =
                                    timerData?.workoutId === w.id &&
                                    timerData?.liftId === lift.id &&
                                    timerData?.setId === set.id;
                                  return (
                                    <div key={set.id} className={`set-card ${set.completed ? 'completed' : ''}`}>
                                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                                        <input
                                          type="checkbox"
                                          checked={set.completed}
                                          onChange={() => toggleSetComplete(w.id, lift.id, set.id)}
                                          className="set-checkbox"
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
                                            onClick={() => deleteSet(w.id, lift.id, set.id)}
                                            className="workout-action-btn danger"
                                            title="Delete set"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>

                                      {/* Set Controls - Always show when not editing workout */}
                                      {!editingWorkoutId && (
                                        <>
                                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                                            <div>
                                              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                                                Weight
                                              </div>
                                              <div style={{ display: "flex", gap: 4 }}>
                                                <button
                                                  onClick={() => updateSetWeight(w.id, lift.id, set.id, -2.5)}
                                                  className="workout-action-btn"
                                                  style={{ flex: 1 }}
                                                >
                                                  -2.5
                                                </button>
                                                <button
                                                  onClick={() => updateSetWeight(w.id, lift.id, set.id, 2.5)}
                                                  className="workout-action-btn"
                                                  style={{ flex: 1 }}
                                                >
                                                  +2.5
                                                </button>
                                              </div>
                                            </div>
                                            <div>
                                              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                                                Reps
                                              </div>
                                              <div style={{ display: "flex", gap: 4 }}>
                                                <button
                                                  onClick={() => updateSetReps(w.id, lift.id, set.id, -1)}
                                                  className="workout-action-btn"
                                                  style={{ flex: 1 }}
                                                >
                                                  -1
                                                </button>
                                                <button
                                                  onClick={() => updateSetReps(w.id, lift.id, set.id, 1)}
                                                  className="workout-action-btn"
                                                  style={{ flex: 1 }}
                                                >
                                                  +1
                                                </button>
                                              </div>
                                            </div>
                                            <div>
                                              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                                                Rest
                                              </div>
                                              <div style={{ display: "flex", gap: 4 }}>
                                                <button
                                                  onClick={() => updateSetRest(w.id, lift.id, set.id, -10)}
                                                  className="workout-action-btn"
                                                  style={{ flex: 1 }}
                                                >
                                                  -10
                                                </button>
                                                <button
                                                  onClick={() => updateSetRest(w.id, lift.id, set.id, 10)}
                                                  className="workout-action-btn"
                                                  style={{ flex: 1 }}
                                                >
                                                  +10
                                                </button>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Timer */}
                                          {isTimerActive ? (
                                            <div className={`timer-display ${timerData.secondsLeft === 0 ? 'complete' : ''}`}>
                                              Rest: {timerData.secondsLeft}s
                                            </div>
                                          ) : !set.completed ? (
                                            <button
                                              onClick={() => startTimer(w.id, lift.id, set.id, set.restSeconds)}
                                              className="timer-button"
                                            >
                                              Start Rest ({set.restSeconds}s)
                                            </button>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
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
                    className="workout-submit-btn"
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
                  if (!confirm(`Clear history for ${historyLiftName}?`)) return;
                  try {
                    const res = await fetch("/api/workoutResults", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ liftName: historyLiftName }),
                    });
                    if (res.ok) {
                      setHistoryData([]);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                title="Clear history"
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Sets</th>
                </tr>
              </thead>
              <tbody>
                {historyData.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "12px", verticalAlign: "top" }}>
                      {new Date(d.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        {d.sets.map((s, j) => {
                          const color = setColors[j % setColors.length];
                          return (
                            <div
                              key={j}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 8px",
                                background: `${color}15`,
                                border: `1px solid ${color}40`,
                                borderRadius: 4,
                                fontSize: 11,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span style={{ color: color, fontWeight: 700, fontSize: 10 }}>
                                {j + 1}
                              </span>
                              <span style={{ color: color, fontWeight: 600 }}>{s.weight} lbs</span>
                              <span style={{ color: "var(--muted)", fontSize: 11 }}> x {s.reps}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}