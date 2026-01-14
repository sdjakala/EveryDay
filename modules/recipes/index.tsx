// modules/recipes/index.tsx
import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

const uid = () => Math.random().toString(36).slice(2, 11);

type Ingredient = {
  id: string;
  name: string;
  amount?: string;
  unit?: string;
  checked: boolean;
};

type StepTimer = {
  id: string;
  duration: number;
  remaining: number;
  isRunning: boolean;
  isPaused: boolean;
};

type Recipe = {
  id: string;
  title: string;
  link?: string;
  instructions?: string[];
  ingredients: Ingredient[];
  planned?: boolean;
  stepTimers?: Record<number, StepTimer>;
};

async function apiLoadRecipes(): Promise<Recipe[]> {
  try {
    const res = await fetch("/api/recipes");
    if (!res.ok) return [];
    const data = await res.json();
    console.log("Raw API response:", data);
    
    let recipes = Array.isArray(data) ? data : (data.recipes || []);
    
    // Ensure backward compatibility
    return recipes.map((r: any) => ({
      ...r,
      ingredients: r.ingredients || [],
      stepTimers: r.stepTimers || {},
    }));
  } catch (e) {
    console.error("Failed to load recipes:", e);
    return [];
  }
}

async function apiSaveRecipes(recipes: Recipe[]) {
  // This function is no longer used - we use individual update/delete calls instead
  console.warn("apiSaveRecipes called - this should not happen");
}

async function apiUpdateRecipe(id: string, updates: Partial<Recipe>) {
  try {
    const res = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update recipe");
    return await res.json();
  } catch (e) {
    console.error("Failed to update recipe:", e);
    throw e;
  }
}

async function apiDeleteRecipe(id: string) {
  try {
    const res = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete recipe");
  } catch (e) {
    console.error("Failed to delete recipe:", e);
    throw e;
  }
}

async function apiCreateRecipe(recipe: Recipe) {
  try {
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    });
    if (!res.ok) throw new Error("Failed to create recipe");
    return await res.json();
  } catch (e) {
    console.error("Failed to create recipe:", e);
    throw e;
  }
}

async function apiPushIngredients(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/recipes/${encodeURIComponent(id)}/push`, {
      method: "POST",
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Timer Component
function StepTimerComponent({
  recipe,
  stepIndex,
  onUpdate,
}: {
  recipe: Recipe;
  stepIndex: number;
  onUpdate: (id: string, updates: Partial<Recipe>) => void;
}) {
  const timer = recipe.stepTimers?.[stepIndex];
  const [showTimerForm, setShowTimerForm] = useState(false);
  const [timerDuration, setTimerDuration] = useState({ minutes: 0, seconds: 0 });
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalId]);

  function playTimerBeep() {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      for (let i = 0; i < 3; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.setValueAtTime(800, now + i * 0.3);
        gain.gain.setValueAtTime(0.3, now + i * 0.3);
        gain.gain.setValueAtTime(0, now + i * 0.3 + 0.2);

        osc.start(now + i * 0.3);
        osc.stop(now + i * 0.3 + 0.2);
      }
    } catch (e) {
      // Silently fail
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function startTimer() {
    if (!timer || timer.isRunning) return;
    if (intervalId) clearInterval(intervalId);

    onUpdate(recipe.id, {
      stepTimers: {
        ...recipe.stepTimers,
        [stepIndex]: { ...timer, isRunning: true, isPaused: false },
      },
    });

    const interval = setInterval(() => {
      onUpdate(recipe.id, {
        stepTimers: ((r: Recipe) => {
          const t = r.stepTimers?.[stepIndex];
          if (!t || !t.isRunning) {
            clearInterval(interval);
            return r.stepTimers || {};
          }
          const newRemaining = t.remaining - 1;
          if (newRemaining <= 0) {
            playTimerBeep();
            clearInterval(interval);
            return { ...r.stepTimers, [stepIndex]: { ...t, remaining: 0, isRunning: false, isPaused: false } };
          }
          return { ...r.stepTimers, [stepIndex]: { ...t, remaining: newRemaining } };
        })(recipe),
      });
    }, 1000);

    setIntervalId(interval);
  }

  function pauseTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    if (!timer) return;
    onUpdate(recipe.id, {
      stepTimers: { ...recipe.stepTimers, [stepIndex]: { ...timer, isRunning: false, isPaused: true } },
    });
  }

  function resetTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    if (!timer) return;
    onUpdate(recipe.id, {
      stepTimers: { ...recipe.stepTimers, [stepIndex]: { ...timer, remaining: timer.duration, isRunning: false, isPaused: false } },
    });
  }

  function addTimer() {
    const totalSeconds = timerDuration.minutes * 60 + timerDuration.seconds;
    if (totalSeconds <= 0) return;

    const newTimer: StepTimer = {
      id: uid(),
      duration: totalSeconds,
      remaining: totalSeconds,
      isRunning: false,
      isPaused: false,
    };

    onUpdate(recipe.id, { stepTimers: { ...recipe.stepTimers, [stepIndex]: newTimer } });
    setShowTimerForm(false);
    setTimerDuration({ minutes: 0, seconds: 0 });
  }

  function deleteTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    const newTimers = { ...recipe.stepTimers };
    delete newTimers[stepIndex];
    onUpdate(recipe.id, { stepTimers: newTimers });
  }

  function editTimer() {
    setShowTimerForm(true);
    if (timer) {
      setTimerDuration({ minutes: Math.floor(timer.duration / 60), seconds: timer.duration % 60 });
    }
  }

  if (!timer) {
    return (
      <div style={{ marginTop: "8px" }} onClick={(e) => e.stopPropagation()}>
        {showTimerForm ? (
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
            <input type="number" placeholder="min" value={timerDuration.minutes || ""} onChange={(e) => setTimerDuration({ ...timerDuration, minutes: parseInt(e.target.value) || 0 })} style={{ width: "50px", padding: "4px 8px", fontSize: "0.85rem", height: "28px" }} onClick={(e) => e.stopPropagation()} />
            <span style={{ fontSize: "0.85rem" }}>:</span>
            <input type="number" placeholder="sec" value={timerDuration.seconds || ""} onChange={(e) => setTimerDuration({ ...timerDuration, seconds: parseInt(e.target.value) || 0 })} style={{ width: "50px", padding: "4px 8px", fontSize: "0.85rem", height: "28px" }} onClick={(e) => e.stopPropagation()} />
            <button onClick={addTimer} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>Add</button>
            <button onClick={() => setShowTimerForm(false)} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowTimerForm(true)} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>+ Timer</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: "8px", padding: "8px", background: "rgba(37, 244, 238, 0.1)", borderRadius: "6px", border: "1px solid rgba(37, 244, 238, 0.3)" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: "600", color: timer.remaining === 0 ? "#4caf50" : "#25f4ee" }}>
          ⏱️ {formatTime(timer.remaining)}{timer.remaining === 0 && " ✓"}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {!timer.isRunning && timer.remaining > 0 && <button onClick={startTimer} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>▶️</button>}
          {timer.isRunning && <button onClick={pauseTimer} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>⏸️</button>}
          {(timer.isPaused || timer.remaining === 0) && <button onClick={resetTimer} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>🔄</button>}
          {showTimerForm ? (
            <>
              <input type="number" placeholder="m" value={timerDuration.minutes || ""} onChange={(e) => setTimerDuration({ ...timerDuration, minutes: parseInt(e.target.value) || 0 })} style={{ width: "40px", padding: "4px", fontSize: "0.85rem", height: "28px" }} onClick={(e) => e.stopPropagation()} />
              <input type="number" placeholder="s" value={timerDuration.seconds || ""} onChange={(e) => setTimerDuration({ ...timerDuration, seconds: parseInt(e.target.value) || 0 })} style={{ width: "40px", padding: "4px", fontSize: "0.85rem", height: "28px" }} onClick={(e) => e.stopPropagation()} />
              <button onClick={addTimer} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>✓</button>
              <button onClick={() => setShowTimerForm(false)} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}>✕</button>
            </>
          ) : (
            <>
              <button onClick={editTimer} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}><Icon name="edit" /></button>
              <button onClick={deleteTimer} className="task-action-btn" style={{ padding: "4px 8px", fontSize: "0.85rem", height: "28px" }}><Icon name="trash" /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RecipesModule() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [newIngredient, setNewIngredient] = useState({ name: "", section: "Pantry", count: "", unit: "" });
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editingIngredientTitle, setEditingIngredientTitle] = useState("");
  const [editingIngredientSection, setEditingIngredientSection] = useState("Pantry");
  const [editingIngredientCount, setEditingIngredientCount] = useState("");
  const [editingIngredientUnit, setEditingIngredientUnit] = useState("");
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepText, setEditingStepText] = useState("");
  const [newStepText, setNewStepText] = useState("");
  const [showPlanned, setShowPlanned] = useState(false);
  const [highlightedSteps, setHighlightedSteps] = useState<Record<string, Set<number>>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRecipeTitle, setCreateRecipeTitle] = useState("");
  const [createRecipeLink, setCreateRecipeLink] = useState("");
  const [createRecipeSteps, setCreateRecipeSteps] = useState<string[]>([]);
  const [createStepInput, setCreateStepInput] = useState("");
  const [showMenuForRecipe, setShowMenuForRecipe] = useState<string | null>(null);

  const SECTIONS = ["Produce", "Meat", "Dairy", "Frozen", "Bakery", "Pantry", "Other"];
  const UNITS = ["", "cup", "cups", "tbsp", "tsp", "oz", "lb", "g", "kg", "ml", "L", "qt", "pt", "gal", "pinch", "dash", "clove", "cloves", "piece", "pieces", "whole"];

  useEffect(() => {
    apiLoadRecipes().then((loaded) => {
      console.log("Loaded recipes count:", loaded.length);
      setRecipes(loaded);
    });
  }, []);

  function handleUpdateRecipe(id: string, updates: Partial<Recipe>) {
    // Optimistically update UI
    setRecipes(recipes.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    
    // Persist to server
    apiUpdateRecipe(id, updates).catch((e) => {
      console.error("Failed to update recipe:", e);
      // Could revert here, but for now just log
    });
  }

  function handleDeleteRecipe(id: string) {
    // Optimistically update UI
    setRecipes(recipes.filter((r) => r.id !== id));
    
    // Persist to server
    apiDeleteRecipe(id).catch((e) => {
      console.error("Failed to delete recipe:", e);
      alert("Failed to delete recipe. Please try again.");
    });
  }

  function handleAddIngredient(recipeId: string) {
    if (!newIngredient.name.trim()) return;
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const ingredient: Ingredient = {
      id: uid(),
      title: newIngredient.name,
      section: newIngredient.section,
      count: newIngredient.count ? parseFloat(newIngredient.count) : undefined,
      unit: newIngredient.unit || undefined,
    };
    handleUpdateRecipe(recipeId, { ingredients: [...recipe.ingredients, ingredient] });
    setNewIngredient({ name: "", section: "Pantry", count: "", unit: "" });
  }

  function handleUpdateIngredient(recipeId: string, ingredientId: string, title: string, section: string, count?: number, unit?: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const updated = recipe.ingredients.map((ing) => (ing.id === ingredientId ? { ...ing, title, section, count, unit } : ing));
    handleUpdateRecipe(recipeId, { ingredients: updated });
    setEditingIngredientId(null);
  }

  function handleDeleteIngredient(recipeId: string, ingredientId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    const updated = recipe.ingredients.filter((ing) => ing.id !== ingredientId);
    handleUpdateRecipe(recipeId, { ingredients: updated });
  }

  function toggleStepHighlight(recipeId: string, stepIndex: number) {
    setHighlightedSteps((prev) => {
      const current = prev[recipeId] || new Set();
      const updated = new Set(current);
      if (updated.has(stepIndex)) {
        updated.delete(stepIndex);
      } else {
        updated.add(stepIndex);
      }
      return { ...prev, [recipeId]: updated };
    });
  }

  function moveStepUp(recipeId: string, stepIndex: number) {
    if (stepIndex <= 0) return;
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe || !recipe.instructions) return;
    
    const newInstructions = [...recipe.instructions];
    [newInstructions[stepIndex - 1], newInstructions[stepIndex]] = [newInstructions[stepIndex], newInstructions[stepIndex - 1]];
    
    handleUpdateRecipe(recipeId, { instructions: newInstructions });
  }

  function moveStepDown(recipeId: string, stepIndex: number) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe || !recipe.instructions || stepIndex >= recipe.instructions.length - 1) return;
    
    const newInstructions = [...recipe.instructions];
    [newInstructions[stepIndex], newInstructions[stepIndex + 1]] = [newInstructions[stepIndex + 1], newInstructions[stepIndex]];
    
    handleUpdateRecipe(recipeId, { instructions: newInstructions });
  }

  function deleteStep(recipeId: string, stepIndex: number) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe || !recipe.instructions) return;
    
    const newInstructions = recipe.instructions.filter((_, i) => i !== stepIndex);
    handleUpdateRecipe(recipeId, { instructions: newInstructions });
  }

  function updateStepText(recipeId: string, stepIndex: number, newText: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe || !recipe.instructions) return;
    
    const newInstructions = recipe.instructions.map((step, i) => i === stepIndex ? newText : step);
    handleUpdateRecipe(recipeId, { instructions: newInstructions });
    setEditingStepId(null);
    setEditingStepText("");
  }

  function addNewStep(recipeId: string) {
    if (!newStepText.trim()) return;
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    
    const newInstructions = [...(recipe.instructions || []), newStepText.trim()];
    handleUpdateRecipe(recipeId, { instructions: newInstructions });
    setNewStepText("");
  }

  function handleCreateRecipe() {
    if (!createRecipeTitle.trim()) {
      alert("Please enter a recipe title");
      return;
    }

    const recipe: Recipe = {
      id: uid(),
      title: createRecipeTitle.trim(),
      link: createRecipeLink.trim() || undefined,
      instructions: createRecipeSteps.length > 0 ? createRecipeSteps : undefined,
      ingredients: [],
      planned: false,
      stepTimers: {},
    };

    apiCreateRecipe(recipe).then(() => {
      setRecipes([recipe, ...recipes]);
      setShowCreateModal(false);
      setCreateRecipeTitle("");
      setCreateRecipeLink("");
      setCreateRecipeSteps([]);
      setCreateStepInput("");
    }).catch((e) => {
      console.error("Failed to create recipe:", e);
      alert("Failed to save recipe. Please try again.");
    });
  }

  function addCreateStep() {
    if (!createStepInput.trim()) return;
    setCreateRecipeSteps([...createRecipeSteps, createStepInput.trim()]);
    setCreateStepInput("");
  }

  function removeCreateStep(index: number) {
    setCreateRecipeSteps(createRecipeSteps.filter((_, i) => i !== index));
  }

  function moveCreateStepUp(index: number) {
    if (index <= 0) return;
    const newSteps = [...createRecipeSteps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setCreateRecipeSteps(newSteps);
  }

  function moveCreateStepDown(index: number) {
    if (index >= createRecipeSteps.length - 1) return;
    const newSteps = [...createRecipeSteps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setCreateRecipeSteps(newSteps);
  }

  function pushIngredientsToGrocery(recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    
    apiPushIngredients(recipeId).then((ok) => {
      if (ok) {
        try {
          window.dispatchEvent(new CustomEvent("grocery-updated"));
        } catch (e) {
          console.warn("grocery dispatch failed", e);
        }
        alert(`Added ${recipe.ingredients.length} ingredient${recipe.ingredients.length === 1 ? "" : "s"} to Grocery`);
      } else {
        alert("Failed to add ingredients to grocery");
      }
    });
  }

  function scheduleRecipeOnCalendar(recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const today = new Date();
    today.setHours(18, 0, 0, 0);

    const eventData = {
      title: recipe.title,
      date: today.toISOString().slice(0, 10),
      time: "18:00",
    };

    window.dispatchEvent(
      new CustomEvent("schedule-recipe-event", {
        detail: eventData,
      })
    );
  }

  const displayedRecipes = showPlanned ? recipes.filter((r) => r.planned) : recipes;

  return (
    <div style={{ padding: 20 }}>
      {/* HEADER WITH BUTTONS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>        
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "8px 16px",
              background: "#25f4ee",
              color: "#000",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Create Recipe
          </button>
          <button
            onClick={() => setShowPlanned(!showPlanned)}
            style={{
              padding: "8px 16px",
              background: showPlanned ? "#25f4ee" : "transparent",
              color: showPlanned ? "#000" : "#25f4ee",
              border: "1px solid #25f4ee",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {showPlanned ? "Show All" : "Show Planned"}
          </button>
        </div>
      </div>      

      {/* CREATE RECIPE MODAL */}
      {showCreateModal && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 999,
            }}
            onClick={() => setShowCreateModal(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--card)",
              padding: 24,
              borderRadius: 12,
              maxWidth: 600,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              zIndex: 1000,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Create Recipe</h3>
            
            <input
              type="text"
              placeholder="Recipe title"
              value={createRecipeTitle}
              onChange={(e) => setCreateRecipeTitle(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                marginBottom: 12,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 4,
                color: "white",
                fontSize: 14,
              }}
            />

            <input
              type="text"
              placeholder="Recipe link (optional)"
              value={createRecipeLink}
              onChange={(e) => setCreateRecipeLink(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                marginBottom: 12,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 4,
                color: "white",
                fontSize: 14,
              }}
            />

            <div style={{ marginBottom: 12 }}>
              <strong style={{ fontSize: 14, display: "block", marginBottom: 8 }}>Instructions</strong>
              
              {createRecipeSteps.length > 0 && (
                <ol style={{ margin: "0 0 12px 0", paddingLeft: 20 }}>
                  {createRecipeSteps.map((step, i) => (
                    <li key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "start", gap: 8 }}>
                        <span style={{ flex: 1 }}>{step}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => moveCreateStepUp(i)}
                            className="task-action-btn"
                            style={{ padding: "2px 6px", fontSize: 11 }}
                            disabled={i === 0}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveCreateStepDown(i)}
                            className="task-action-btn"
                            style={{ padding: "2px 6px", fontSize: 11 }}
                            disabled={i === createRecipeSteps.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeCreateStep(i)}
                            className="task-action-btn"
                            style={{ padding: "2px 6px", fontSize: 11 }}
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Enter instruction step..."
                  value={createStepInput}
                  onChange={(e) => setCreateStepInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCreateStep()}
                  style={{
                    flex: 1,
                    padding: 8,
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 4,
                    color: "white",
                    fontSize: 14,
                  }}
                />
                <button
                  onClick={addCreateStep}
                  style={{
                    padding: "8px 16px",
                    background: "#25f4ee",
                    color: "#000",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Add Step
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={handleCreateRecipe}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "#25f4ee",
                  color: "#000",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Create Recipe
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateRecipeTitle("");
                  setCreateRecipeLink("");
                  setCreateRecipeSteps([]);
                  setCreateStepInput("");
                }}
                style={{
                  padding: "10px 16px",
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* RECIPE LIST */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {displayedRecipes.map((r) => (
          <div key={r.id} style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8, border: r.planned ? "2px solid #25f4ee" : "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpandedRecipeId(expandedRecipeId === r.id ? null : r.id)}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{r.title}</h3>
                {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ color: "#25f4ee", fontSize: 12 }} onClick={(e) => e.stopPropagation()}>View</a>}
              </div>
              <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                {expandedRecipeId === r.id && (
                  <button 
                    onClick={() => setEditingRecipeId(editingRecipeId === r.id ? null : r.id)} 
                    className="task-action-btn" 
                    style={{ padding: "4px 8px" }}
                  >
                    <Icon name={editingRecipeId === r.id ? "x" : "edit"} />
                  </button>
                )}
                <div style={{ position: "relative" }}>
                  <button 
                    onClick={() => setShowMenuForRecipe(showMenuForRecipe === r.id ? null : r.id)}
                    className="task-action-btn" 
                    style={{ padding: "4px 8px" }}
                  >
                    <Icon name="heart" />
                  </button>
                  
                  {showMenuForRecipe === r.id && (
                    <>
                      <div
                        style={{
                          position: "fixed",
                          inset: 0,
                          zIndex: 10,
                        }}
                        onClick={() => setShowMenuForRecipe(null)}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          right: 0,
                          marginTop: 4,
                          background: "var(--card)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          padding: 8,
                          minWidth: 200,
                          zIndex: 20,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            handleUpdateRecipe(r.id, { planned: !r.planned });
                            setShowMenuForRecipe(null);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            textAlign: "left",
                            cursor: "pointer",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <Icon name="heart" size={16} />
                          <span>{r.planned ? "Remove from planned" : "Mark as planned"}</span>
                        </button>
                        <button
                          onClick={() => {
                            scheduleRecipeOnCalendar(r.id);
                            setShowMenuForRecipe(null);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            background: "transparent",
                            border: "none",
                            color: "#fff",
                            textAlign: "left",
                            cursor: "pointer",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 4,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <Icon name="calendar" size={16} />
                          <span>Schedule on calendar</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => handleDeleteRecipe(r.id)} className="task-action-btn" style={{ padding: "4px 8px" }}><Icon name="trash" /></button>
              </div>
            </div>

            {expandedRecipeId === r.id && (
              <div style={{ marginTop: 12 }}>
                {r.ingredients && r.ingredients.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 12 }}>Ingredients</strong>
                    <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                      {[...r.ingredients].sort((a: any, b: any) => a.section.localeCompare(b.section)).map((ing: any) => (
                        <div key={ing.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 8px", background: "rgba(0,0,0,0.2)", borderRadius: 4, minWidth: 0 }}>
                          {editingIngredientId === ing.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                              <input
                                type="text"
                                value={editingIngredientTitle}
                                onChange={(e) => setEditingIngredientTitle(e.target.value)}
                                placeholder="Ingredient name"
                                style={{ width: "100%", padding: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                              />
                              <div style={{ display: "flex", gap: 4 }}>
                                <input
                                  type="number"
                                  step="any"
                                  value={editingIngredientCount}
                                  onChange={(e) => setEditingIngredientCount(e.target.value)}
                                  placeholder="Qty"
                                  style={{ width: "50px", padding: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                                />
                                <select
                                  value={editingIngredientUnit}
                                  onChange={(e) => setEditingIngredientUnit(e.target.value)}
                                  style={{ flex: 1, padding: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                                >
                                  {UNITS.map((u) => (
                                    <option key={u || "none"} value={u}>{u || "(none)"}</option>
                                  ))}
                                </select>
                              </div>
                              <select
                                value={editingIngredientSection}
                                onChange={(e) => setEditingIngredientSection(e.target.value)}
                                style={{ width: "100%", padding: 4, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                              >
                                {SECTIONS.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  onClick={() => handleUpdateIngredient(r.id, ing.id, editingIngredientTitle, editingIngredientSection, editingIngredientCount ? parseFloat(editingIngredientCount) : undefined, editingIngredientUnit || undefined)}
                                  className="task-action-btn"
                                  style={{ flex: 1, padding: "4px 8px", fontSize: 11 }}
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingIngredientId(null)}
                                  className="task-action-btn"
                                  style={{ flex: 1, padding: "4px 8px", fontSize: 11 }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: "#ccc", wordBreak: "break-word" }}>
                                  {ing.count && <span style={{ fontWeight: "600" }}>{ing.count} </span>}
                                  {ing.unit && <span>{ing.unit} </span>}
                                  {ing.title}
                                </div>
                                <div style={{ fontSize: 10, color: "#888" }}>{ing.section}</div>
                              </div>
                              {editingRecipeId === r.id && (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button
                                    onClick={() => {
                                      setEditingIngredientId(ing.id);
                                      setEditingIngredientTitle(ing.title);
                                      setEditingIngredientSection(ing.section);
                                      setEditingIngredientCount(ing.count ? String(ing.count) : "");
                                      setEditingIngredientUnit(ing.unit || "");
                                    }}
                                    className="task-action-btn"
                                    style={{ padding: "4px 6px", fontSize: 11, flexShrink: 0 }}
                                  >
                                    <Icon name="edit" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteIngredient(r.id, ing.id)}
                                    className="task-action-btn"
                                    style={{ padding: "4px 6px", fontSize: 11, flexShrink: 0 }}
                                  >
                                    <Icon name="trash" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => pushIngredientsToGrocery(r.id)}
                      style={{
                        marginTop: 12,
                        padding: "8px 16px",
                        background: "#25f4ee",
                        color: "#000",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 14,
                        width: "100%",
                      }}
                    >
                      Add ingredients to Grocery
                    </button>
                  </div>
                )}

                {editingRecipeId === r.id && (
                  <div style={{ marginBottom: 12, padding: 10, background: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
                    <strong style={{ fontSize: 12 }}>Add Ingredient</strong>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                      <input
                        type="text"
                        placeholder="Ingredient name"
                        value={newIngredient.name}
                        onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                        style={{ width: "100%", padding: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number"
                          step="any"
                          placeholder="Quantity"
                          value={newIngredient.count}
                          onChange={(e) => setNewIngredient({ ...newIngredient, count: e.target.value })}
                          style={{ width: "80px", padding: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                        />
                        <select
                          value={newIngredient.unit}
                          onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                          style={{ flex: 1, padding: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                        >
                          {UNITS.map((u) => (
                            <option key={u || "none"} value={u}>{u || "(none)"}</option>
                          ))}
                        </select>
                        <select
                          value={newIngredient.section}
                          onChange={(e) => setNewIngredient({ ...newIngredient, section: e.target.value })}
                          style={{ padding: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "white", fontSize: 12 }}
                        >
                          {SECTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => handleAddIngredient(r.id)} style={{ padding: "6px 10px", background: "#25f4ee", color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Add Ingredient</button>
                    </div>
                  </div>
                )}

                {r.instructions && Array.isArray(r.instructions) && (
                  <div>
                    <strong style={{ fontSize: 12 }}>Instructions</strong>
                    <ol style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 13 }}>
                      {r.instructions.map((step, i) => {
                        const isHighlighted = highlightedSteps[r.id]?.has(i);
                        const isEditingThisStep = editingStepId === `${r.id}-${i}`;
                        return (
                          <li 
                            key={i} 
                            onClick={() => !editingRecipeId && toggleStepHighlight(r.id, i)} 
                            className={isHighlighted ? "recipe-step highlighted" : "recipe-step"} 
                            style={{ marginTop: 6, cursor: editingRecipeId ? "default" : "pointer", padding: "6px", borderRadius: "6px", transition: "all 0.2s ease" }}
                          >
                            {isEditingThisStep ? (
                              <div>
                                <textarea
                                  value={editingStepText}
                                  onChange={(e) => setEditingStepText(e.target.value)}
                                  style={{ 
                                    width: "100%", 
                                    minHeight: "90px",
                                    padding: 6, 
                                    background: "rgba(255,255,255,0.1)", 
                                    border: "1px solid rgba(255,255,255,0.2)", 
                                    borderRadius: 4, 
                                    color: "white", 
                                    fontSize: 13,
                                    fontFamily: "inherit",
                                    resize: "vertical"
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateStepText(r.id, i, editingStepText);
                                    }}
                                    className="task-action-btn"
                                    style={{ padding: "4px 8px", fontSize: 11 }}
                                  >
                                    ✓ Save
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingStepId(null);
                                      setEditingStepText("");
                                    }}
                                    className="task-action-btn"
                                    style={{ padding: "4px 8px", fontSize: 11 }}
                                  >
                                    ✕ Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>{step}</div>
                                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                                  <StepTimerComponent recipe={r} stepIndex={i} onUpdate={handleUpdateRecipe} />
                                  {editingRecipeId === r.id && (
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingStepId(`${r.id}-${i}`);
                                          setEditingStepText(step);
                                        }}
                                        className="task-action-btn"
                                        style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                                      >
                                        <Icon name="edit" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveStepUp(r.id, i);
                                        }}
                                        className="task-action-btn"
                                        style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                                        disabled={i === 0}
                                      >
                                        ↑
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          moveStepDown(r.id, i);
                                        }}
                                        className="task-action-btn"
                                        style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                                        disabled={i === r.instructions!.length - 1}
                                      >
                                        ↓
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteStep(r.id, i);
                                        }}
                                        className="task-action-btn"
                                        style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                                      >
                                        <Icon name="trash" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                    
                    {editingRecipeId === r.id && (
                      <div style={{ marginTop: 12, padding: 10, background: "rgba(0,0,0,0.2)", borderRadius: 6 }}>
                        <strong style={{ fontSize: 12 }}>Add Step</strong>
                        <textarea
                          value={newStepText}
                          onChange={(e) => setNewStepText(e.target.value)}
                          placeholder="Enter new instruction step..."
                          style={{ 
                            width: "100%", 
                            minHeight: "90px",
                            padding: 6, 
                            marginTop: 6,
                            background: "rgba(255,255,255,0.1)", 
                            border: "1px solid rgba(255,255,255,0.2)", 
                            borderRadius: 4, 
                            color: "white", 
                            fontSize: 13,
                            fontFamily: "inherit",
                            resize: "vertical"
                          }}
                        />
                        <button 
                          onClick={() => addNewStep(r.id)} 
                          style={{ 
                            padding: "6px 10px", 
                            marginTop: 6,
                            background: "#25f4ee", 
                            color: "#000", 
                            border: "none", 
                            borderRadius: 4, 
                            cursor: "pointer", 
                            fontSize: 12 
                          }}
                        >
                          Add Step
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .recipe-step { background: rgba(255, 255, 255, 0.02); }
        .recipe-step:hover { background: rgba(255, 255, 255, 0.05); }
        .recipe-step.highlighted { background: rgba(37, 244, 238, 0.15); border-left: 3px solid #25f4ee; padding-left: 9px; }
        .task-action-btn { padding: 4px 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); borderRadius: 4px; color: white; cursor: pointer; fontSize: 13px; transition: all 0.2s; }
        .task-action-btn:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}