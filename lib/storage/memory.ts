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
type Workout = {
  id: string;
  title: string;
  lifts: any[];
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
type NewsFeedSource = {
  id: string;
  name: string;
  url: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type NewsArticleCache = {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  source: string;
  published?: string;
  cachedAt: string;
};
type TrafficLocation = {
  id: string;
  name: string;
  address: string;
  createdAt?: string;
  updatedAt?: string;
};
type FavoriteRoute = {
  id: string;
  name: string;
  originId: string;
  originAddress: string;
  destinationId: string;
  destinationAddress: string;
  departureTime?: string;
  arrivalTime?: string;
  notifyOnTraffic?: boolean;
  baselineDuration?: number;
  createdAt?: string;
  updatedAt?: string;
};
type TrafficAlert = {
  id: string;
  routeId: string;
  routeName: string;
  normalDuration: string;
  currentDuration: string;
  delay: string;
  routeSummary: string;
  timestamp: string;
  dismissed?: boolean;
};
type WeatherLocation = {
  id: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  createdAt?: string;
  updatedAt?: string;
  isDefault?: boolean;
};

const DATA_DIR = path.join(process.cwd(), "data");
const RECIPES_FILE = path.join(DATA_DIR, "backend_recipes.json");
const GROCERY_FILE = path.join(DATA_DIR, "backend_grocery.json");
const TASKS_FILE = path.join(DATA_DIR, "backend_tasks.json");
const CALENDAR_FILE = path.join(DATA_DIR, "backend_calendar.json");
const NEWS_SOURCES_FILE = path.join(DATA_DIR, "backend_news_sources.json");
const NEWS_CACHE_FILE = path.join(DATA_DIR, "backend_news_cache.json");
const WORKOUT_RESULTS_FILE = path.join(DATA_DIR, "backend_workout_results.json");
const TRAFFIC_LOCATIONS_FILE = path.join(
  DATA_DIR,
  "backend_traffic_locations.json"
);
const FAVORITE_ROUTES_FILE = path.join(
  DATA_DIR,
  "backend_favorite_routes.json"
);
const TRAFFIC_ALERTS_FILE = path.join(DATA_DIR, "backend_traffic_alerts.json");
const WEATHER_LOCATIONS_FILE = path.join(
  DATA_DIR,
  "backend_weather_locations.json"
);

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
let workouts: Workout[] = [];
let calendarEvents: CalendarEvent[] = readJson<CalendarEvent[]>(
  CALENDAR_FILE,
  []
);
let newsSources: NewsFeedSource[] = readJson<NewsFeedSource[]>(
  NEWS_SOURCES_FILE,
  []
);
let newsArticlesCache: NewsArticleCache[] = readJson<NewsArticleCache[]>(
  NEWS_CACHE_FILE,
  []
);
let workoutResults: any[] = readJson<any[]>(WORKOUT_RESULTS_FILE, []);
let weatherLocations: WeatherLocation[] = readJson<WeatherLocation[]>(
  WEATHER_LOCATIONS_FILE,
  []
);

function persist() {
  if (!SHOULD_PERSIST) return;
  writeJson(RECIPES_FILE, recipes);
  writeJson(GROCERY_FILE, grocery);
  writeJson(TASKS_FILE, tasks);
  writeJson(CALENDAR_FILE, calendarEvents);
  writeJson(NEWS_SOURCES_FILE, newsSources);
  writeJson(NEWS_CACHE_FILE, newsArticlesCache);
  writeJson(WORKOUT_RESULTS_FILE, workoutResults);
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

  // Workouts
  async getWorkouts(_userId?: string) {
    return workouts;
  },
  async getWorkout(id: string, _userId?: string) {
    return workouts.find((w) => w.id === id) || null;
  },
  async addWorkout(payload: Partial<Workout>, _userId?: string) {
    const now = new Date().toISOString();
    const workout: Workout = {
      id: payload.id || uid(),
      title: payload.title || "Untitled Workout",
      lifts: payload.lifts || [],
      createdAt: now,
      updatedAt: now,
    };
    workouts = [workout, ...workouts];
    return workout;
  },
  async updateWorkout(id: string, payload: Partial<Workout>, _userId?: string) {
    const now = new Date().toISOString();
    workouts = workouts.map((w) =>
      w.id === id ? { ...w, ...payload, updatedAt: now } : w
    );
    return workouts.find((w) => w.id === id) || null;
  },
  async deleteWorkout(id: string, _userId?: string) {
    const prev = workouts.length;
    workouts = workouts.filter((w) => w.id !== id);
    return prev !== workouts.length;
  },

  // Workout Results
  async createWorkoutResult(payload: any, _userId?: string) {
    const now = new Date().toISOString();
    const r = {
      id: payload.id || uid(),
      ...payload,
      completedAt: payload.completedAt || now,
    };
    workoutResults = [r, ...workoutResults];
    persist();
    return r;
  },

  async listWorkoutResults(_userId?: string) {
    return workoutResults;
  },

  async deleteWorkoutResult(id: string, _userId?: string) {
    const before = workoutResults.length;
    workoutResults = workoutResults.filter((r) => r.id !== id);
    persist();
    return before !== workoutResults.length;
  },

  async clearWorkoutResults(liftName?: string, _userId?: string) {
    if (!liftName) {
      const count = workoutResults.length;
      workoutResults = [];
      persist();
      return count;
    }
    const before = workoutResults.length;
    workoutResults = workoutResults.filter((r) => {
      if (!r.lifts) return true;
      return !r.lifts.some((l: any) => l.name === liftName);
    });
    const removed = before - workoutResults.length;
    persist();
    return removed;
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

  // News Sources
  async getNewsSources(_userId?: string) {
    // Memory adapter doesn't filter by user
    return newsSources;
  },
  async getNewsSource(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    return newsSources.find((s) => s.id === id) || null;
  },
  async createNewsSource(
    payload: Omit<NewsFeedSource, "id" | "createdAt" | "updatedAt">,
    _userId?: string
  ) {
    const now = new Date().toISOString();
    const source: NewsFeedSource = {
      id: uid(),
      name: payload.name,
      url: payload.url,
      active: payload.active !== false,
      createdAt: now,
      updatedAt: now,
    };
    newsSources = [source, ...newsSources];
    persist();
    return source;
  },
  async updateNewsSource(
    id: string,
    payload: Partial<NewsFeedSource>,
    _userId?: string
  ) {
    // Memory adapter doesn't filter by user
    const now = new Date().toISOString();
    newsSources = newsSources.map((s) =>
      s.id === id ? { ...s, ...payload, updatedAt: now } : s
    );
    persist();
    return newsSources.find((s) => s.id === id) || null;
  },
  async deleteNewsSource(id: string, _userId?: string) {
    // Memory adapter doesn't filter by user
    const prev = newsSources.length;
    newsSources = newsSources.filter((s) => s.id !== id);
    persist();
    return prev !== newsSources.length;
  },

  // News Article Cache
  async getCachedArticles(
    sourceId?: string,
    maxAgeMinutes: number = 60
  ): Promise<NewsArticleCache[]> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    let filtered = newsArticlesCache.filter(
      (a) => new Date(a.cachedAt) > cutoffTime
    );

    if (sourceId) {
      filtered = filtered.filter((a) => a.sourceId === sourceId);
    }

    return filtered;
  },

  async cacheArticles(
    articles: Omit<NewsArticleCache, "id" | "cachedAt">[],
    _ttlSeconds?: number
  ): Promise<void> {
    const cachedAt = new Date().toISOString();

    const newArticles = articles.map((article) => ({
      ...article,
      id: `${article.sourceId}-${Buffer.from(article.url).toString("base64url")}`,
      cachedAt,
    }));

    // Remove duplicates by URL
    const existingUrls = new Set(newsArticlesCache.map((a) => a.url));
    const toAdd = newArticles.filter((a) => !existingUrls.has(a.url));

    newsArticlesCache = [...toAdd, ...newsArticlesCache];

    // Keep only last 500 articles to avoid memory bloat
    if (newsArticlesCache.length > 500) {
      newsArticlesCache = newsArticlesCache.slice(0, 500);
    }

    persist();
  },

  async clearArticleCache(sourceId?: string): Promise<number> {
    const prev = newsArticlesCache.length;

    if (sourceId) {
      newsArticlesCache = newsArticlesCache.filter(
        (a) => a.sourceId !== sourceId
      );
    } else {
      newsArticlesCache = [];
    }

    persist();
    return prev - newsArticlesCache.length;
  },

  // Traffic Locations
  async getTrafficLocations(): Promise<TrafficLocation[]> {
    const locations = readJson<TrafficLocation[]>(TRAFFIC_LOCATIONS_FILE, []);
    return locations;
  },

  async getTrafficLocation(id: string): Promise<TrafficLocation | null> {
    const locations = readJson<TrafficLocation[]>(TRAFFIC_LOCATIONS_FILE, []);
    return locations.find((loc) => loc.id === id) || null;
  },

  async createTrafficLocation(payload: {
    name: string;
    address: string;
  }): Promise<TrafficLocation> {
    const locations = readJson<TrafficLocation[]>(TRAFFIC_LOCATIONS_FILE, []);
    const now = new Date().toISOString();
    const location: TrafficLocation = {
      id: uid(),
      name: payload.name,
      address: payload.address,
      createdAt: now,
      updatedAt: now,
    };
    locations.push(location);
    writeJson(TRAFFIC_LOCATIONS_FILE, locations);
    return location;
  },

  async deleteTrafficLocation(id: string): Promise<boolean> {
    const locations = readJson<TrafficLocation[]>(TRAFFIC_LOCATIONS_FILE, []);
    const filtered = locations.filter((loc) => loc.id !== id);
    if (filtered.length === locations.length) {
      return false; // Not found
    }
    writeJson(TRAFFIC_LOCATIONS_FILE, filtered);
    return true;
  },

  // Favorite Routes
  async getFavoriteRoutes(): Promise<FavoriteRoute[]> {
    const routes = readJson<FavoriteRoute[]>(FAVORITE_ROUTES_FILE, []);
    return routes;
  },

  async getFavoriteRoute(id: string): Promise<FavoriteRoute | null> {
    const routes = readJson<FavoriteRoute[]>(FAVORITE_ROUTES_FILE, []);
    return routes.find((r) => r.id === id) || null;
  },

  async createFavoriteRoute(
    payload: Partial<FavoriteRoute>
  ): Promise<FavoriteRoute> {
    const routes = readJson<FavoriteRoute[]>(FAVORITE_ROUTES_FILE, []);
    const now = new Date().toISOString();
    const route: FavoriteRoute = {
      id: uid(),
      name: payload.name || "Untitled Route",
      originId: payload.originId!,
      originAddress: payload.originAddress!,
      destinationId: payload.destinationId!,
      destinationAddress: payload.destinationAddress!,
      departureTime: payload.departureTime,
      arrivalTime: payload.arrivalTime,
      notifyOnTraffic: payload.notifyOnTraffic || false,
      baselineDuration: payload.baselineDuration,
      createdAt: now,
      updatedAt: now,
    };
    routes.push(route);
    writeJson(FAVORITE_ROUTES_FILE, routes);
    return route;
  },

  async updateFavoriteRoute(
    id: string,
    payload: Partial<FavoriteRoute>
  ): Promise<FavoriteRoute | null> {
    const routes = readJson<FavoriteRoute[]>(FAVORITE_ROUTES_FILE, []);
    const index = routes.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const updated = {
      ...routes[index],
      ...payload,
      id: routes[index].id,
      updatedAt: new Date().toISOString(),
    };
    routes[index] = updated;
    writeJson(FAVORITE_ROUTES_FILE, routes);
    return updated;
  },

  async deleteFavoriteRoute(id: string): Promise<boolean> {
    const routes = readJson<FavoriteRoute[]>(FAVORITE_ROUTES_FILE, []);
    const filtered = routes.filter((r) => r.id !== id);
    if (filtered.length === routes.length) {
      return false;
    }
    writeJson(FAVORITE_ROUTES_FILE, filtered);
    return true;
  },

  // Traffic Alerts
  async getTrafficAlerts(): Promise<TrafficAlert[]> {
    const alerts = readJson<TrafficAlert[]>(TRAFFIC_ALERTS_FILE, []);
    return alerts.filter((a) => !a.dismissed);
  },

  async createTrafficAlert(
    payload: Omit<TrafficAlert, "id" | "timestamp">
  ): Promise<TrafficAlert> {
    const alerts = readJson<TrafficAlert[]>(TRAFFIC_ALERTS_FILE, []);
    const now = new Date().toISOString();
    const alert: TrafficAlert = {
      id: uid(),
      routeId: payload.routeId,
      routeName: payload.routeName,
      normalDuration: payload.normalDuration,
      currentDuration: payload.currentDuration,
      delay: payload.delay,
      routeSummary: payload.routeSummary,
      timestamp: now,
      dismissed: false,
    };
    alerts.unshift(alert); // Add to beginning
    writeJson(TRAFFIC_ALERTS_FILE, alerts);
    return alert;
  },

  async dismissTrafficAlert(id: string): Promise<boolean> {
    const alerts = readJson<TrafficAlert[]>(TRAFFIC_ALERTS_FILE, []);
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return false;

    alert.dismissed = true;
    writeJson(TRAFFIC_ALERTS_FILE, alerts);
    return true;
  },

  async clearTrafficAlerts(): Promise<number> {
    const alerts = readJson<TrafficAlert[]>(TRAFFIC_ALERTS_FILE, []);
    const count = alerts.length;
    writeJson(TRAFFIC_ALERTS_FILE, []);
    return count;
  },

  // Weather Locations
  async getWeatherLocations(_userId?: string): Promise<WeatherLocation[]> {
    return weatherLocations;
  },

  async getWeatherLocation(id: string, _userId?: string): Promise<WeatherLocation | null> {
    return weatherLocations.find((loc) => loc.id === id) || null;
  },

  async createWeatherLocation(
    payload: Omit<WeatherLocation, "id" | "createdAt" | "updatedAt">,
    _userId?: string
  ): Promise<WeatherLocation> {
    const now = new Date().toISOString();
    const location: WeatherLocation = {
      id: uid(),
      city: payload.city,
      state: payload.state,
      latitude: payload.latitude,
      longitude: payload.longitude,
      formattedAddress: payload.formattedAddress,
      createdAt: now,
      updatedAt: now,
    };
    weatherLocations = [location, ...weatherLocations];
    writeJson(WEATHER_LOCATIONS_FILE, weatherLocations);
    return location;
  },

  async deleteWeatherLocation(id: string, _userId?: string): Promise<boolean> {
    const prev = weatherLocations.length;
    weatherLocations = weatherLocations.filter((loc) => loc.id !== id);
    writeJson(WEATHER_LOCATIONS_FILE, weatherLocations);
    return prev !== weatherLocations.length;
  },

  async setDefaultWeatherLocation(id: string, _userId?: string): Promise<boolean> {
    // First, clear any existing defaults
    weatherLocations = weatherLocations.map(loc => ({
      ...loc,
      isDefault: false
    }));
    
    // Set the new default
    const location = weatherLocations.find(loc => loc.id === id);
    if (!location) return false;
    
    location.isDefault = true;
    location.updatedAt = new Date().toISOString();
    
    writeJson(WEATHER_LOCATIONS_FILE, weatherLocations);
    return true;
  },

};

export default memoryAdapter;