/* eslint-disable no-unused-vars */
import fs from "fs";
import path from "path";

type Ingredient = { id: string; title: string; section: string };
type Recipe = {
  id: string;
  title: string;
  link?: string;
  instructions?: string[];
  ingredients: Ingredient[];
  planned?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type Item = {
  id: string;
  title: string;
  done?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type Task = {
  id: string;
  title: string;
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const RECIPES_FILE = path.join(DATA_DIR, "backend_recipes.json");
const GROCERY_FILE = path.join(DATA_DIR, "backend_grocery.json");
const TASKS_FILE = path.join(DATA_DIR, "backend_tasks.json");
const CALENDAR_FILE = path.join(DATA_DIR, "backend_calendar.json");

function ensureDataDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Ignore directory creation errors
  }
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      return JSON.parse(raw) as T;
    }
  } catch (e) {
    /* ignore */
  }
  return fallback;
}

// Persist only in production or when explicitly enabled via BACKEND_PERSIST=1
const SHOULD_PERSIST =
  process.env.BACKEND_PERSIST === "1" || process.env.NODE_ENV === "production";
function writeJson(file: string, data: any) {
  if (!SHOULD_PERSIST) return;
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("writeJson error", e);
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

ensureDataDir();

let recipes: Recipe[] = readJson<Recipe[]>(RECIPES_FILE, []);
let grocery: Record<string, Item[]> = readJson<Record<string, Item[]>>(
  GROCERY_FILE,
  {}
);
let tasks: Task[] = readJson<Task[]>(TASKS_FILE, []);
let calendarEvents: CalendarEvent[] = readJson<CalendarEvent[]>(
  CALENDAR_FILE,
  []
);

function persist() {
  if (!SHOULD_PERSIST) return;
  writeJson(RECIPES_FILE, recipes);
  writeJson(GROCERY_FILE, grocery);
  writeJson(TASKS_FILE, tasks);
  writeJson(CALENDAR_FILE, calendarEvents);
}

const memoryAdapter = {
  // Recipes
  async listRecipes(_userId?: string) {
    // Memory adapter doesn't filter by user (shared storage for anonymous users)
    return recipes;
  },
  async getRecipe(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    return recipes.find((r) => r.id === id) || null;
  },
  async createRecipe(payload: Partial<Recipe>, _userId?: string) {
    const now = new Date().toISOString();
    // Preserve client-provided id when present so client and server stay in sync
    const rec: Recipe = {
      id: (payload.id as string) || uid(),
      title: payload.title || "Untitled",
      link: payload.link,
      instructions: payload.instructions || [],
      ingredients: payload.ingredients || [],
      planned: !!payload.planned,
      createdAt: now,
      updatedAt: now,
    };
    recipes = [rec, ...recipes];
    persist();
    return rec;
  },
  async updateRecipe(id: string, payload: Partial<Recipe>, _userId?: string) {
    // Memory adapter doesn't filter by user
    const now = new Date().toISOString();
    recipes = recipes.map((r) =>
      r.id === id ? { ...r, ...payload, updatedAt: now } : r
    );
    persist();
    return recipes.find((r) => r.id === id) || null;
  },
  async deleteRecipe(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    const prev = recipes.length;
    recipes = recipes.filter((r) => r.id !== id);
    persist();
    return prev !== recipes.length;
  },
  // push ingredients into grocery lists (by section)
  async pushIngredientsToGrocery(recipeId: string, _userId?: string) {
    const rec = recipes.find((r) => r.id === recipeId);
    if (!rec) throw new Error("not found");
    if (!rec.ingredients || !rec.ingredients.length) return 0;
    rec.ingredients.forEach((ing) => {
      const sec = ing.section || "Pantry";
      if (!grocery[sec]) grocery[sec] = [];
      grocery[sec].unshift({
        id: uid(),
        title: ing.title,
        done: false,
        createdAt: new Date().toISOString(),
      });
    });
    persist();
    return rec.ingredients.length;
  },

  // Grocery
  async getGroceryLists(_userId?: string) {
    // Memory adapter doesn't filter by user
    return grocery;
  },
  async addGroceryItem(section: string, title: string, _userId?: string) {
    const it: Item = {
      id: uid(),
      title,
      done: false,
      createdAt: new Date().toISOString(),
    };
    if (!grocery[section]) grocery[section] = [];
    grocery[section].unshift(it);
    persist();
    return it;
  },
  async updateGroceryItem(
    section: string,
    id: string,
    patch: Partial<Item>,
    _userId?: string
  ) {
    // Memory adapter doesn't filter by user
    if (!grocery[section]) return null;
    grocery[section] = grocery[section].map((it) =>
      it.id === id
        ? { ...it, ...patch, updatedAt: new Date().toISOString() }
        : it
    );
    persist();
    return grocery[section].find((it) => it.id === id) || null;
  },
  async deleteGroceryItem(section: string, id: string, _userId?: string) {
    if (!grocery[section]) return false;
    const before = grocery[section].length;
    grocery[section] = grocery[section].filter((it) => it.id !== id);
    persist();
    return before !== grocery[section].length;
  },

  // Tasks
  async getTasks(_userId?: string) {
    // Memory adapter doesn't filter by user (shared storage for anonymous users)
    return tasks;
  },
  async getTask(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    return tasks.find((t) => t.id === id) || null;
  },
  async createTask(payload: Partial<Task>, _userId?: string) {
    const now = new Date().toISOString();
    const task: Task = {
      id: uid(),
      title: payload.title || "Untitled Task",
      completed: payload.completed || false,
      createdAt: now,
      updatedAt: now,
    };
    tasks = [task, ...tasks];
    persist();
    return task;
  },
  async updateTask(id: string, payload: Partial<Task>, _userId?: string) {
    // Memory adapter doesn't filter by user
    const now = new Date().toISOString();
    tasks = tasks.map((t) =>
      t.id === id ? { ...t, ...payload, updatedAt: now } : t
    );
    persist();
    return tasks.find((t) => t.id === id) || null;
  },
  async deleteTask(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    const prev = tasks.length;
    tasks = tasks.filter((t) => t.id !== id);
    persist();
    return prev !== tasks.length;
  },

  // Calendar Events
  async getCalendarEvents(_userId?: string) {
    // Memory adapter doesn't filter by user (shared storage for anonymous users)
    return calendarEvents;
  },
  async getCalendarEvent(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    return calendarEvents.find((e) => e.id === id) || null;
  },
  async createCalendarEvent(payload: Partial<CalendarEvent>, _userId?: string) {
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      id: uid(),
      title: payload.title || "Untitled Event",
      start: payload.start || now,
      end: payload.end,
      location: payload.location,
      description: payload.description,
      createdAt: now,
      updatedAt: now,
    };
    calendarEvents = [event, ...calendarEvents];
    persist();
    return event;
  },
  async updateCalendarEvent(
    id: string,
    payload: Partial<CalendarEvent>,
    _userId?: string
  ) {
    // Memory adapter doesn't filter by user
    const now = new Date().toISOString();
    calendarEvents = calendarEvents.map((e) =>
      e.id === id ? { ...e, ...payload, updatedAt: now } : e
    );
    persist();
    return calendarEvents.find((e) => e.id === id) || null;
  },
  async deleteCalendarEvent(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    const prev = calendarEvents.length;
    calendarEvents = calendarEvents.filter((e) => e.id !== id);
    persist();
    return prev !== calendarEvents.length;
  },
};

export default memoryAdapter;