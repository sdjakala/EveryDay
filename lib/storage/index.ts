import memory from "./memory";
import cosmos from "./cosmos";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import type { IncomingMessage } from "http";

const adapterName = process.env.STORAGE_ADAPTER || "memory";

const adapters: Record<string, any> = {
  memory,
  cosmos,
};

// Helper to extract userId from authenticated request
function getUserIdFromRequest(req?: IncomingMessage): string | undefined {
  if (!req) return undefined;
  try {
    const raw = req.headers.cookie || "";
    const parsed = cookie.parse(raw);
    const token = parsed["swa_session"];
    if (!token) return undefined;

    const SESSION_SECRET = process.env.SESSION_SECRET || "";
    if (!SESSION_SECRET) return undefined;

    const payload = jwt.verify(token, SESSION_SECRET) as any;
    // Use email as userId (or sub if preferred)
    return payload.email || payload.sub;
  } catch (e) {
    return undefined;
  }
}

// Helper to check if user is authenticated from request
function isAuthenticated(req?: IncomingMessage): boolean {
  return !!getUserIdFromRequest(req);
}

// Dynamic adapter selector based on authentication
function getAdapter(req?: IncomingMessage) {
  // If STORAGE_ADAPTER is explicitly set to cosmos, check authentication
  if (adapterName === "cosmos") {
    // Use cosmos only for authenticated users
    if (isAuthenticated(req)) {
      return cosmos;
    }
    // Fall back to memory for unauthenticated users
    return memory;
  }

  // Otherwise use the configured adapter (or default memory)
  return adapters[adapterName] || memory;
}

// Wrapper that injects userId into all adapter methods
function wrapAdapterWithUserId(adapter: any, userId?: string) {
  return {
    listRecipes: () => adapter.listRecipes(userId),
    getRecipe: (id: string) => adapter.getRecipe(id, userId),
    createRecipe: (payload: any) => adapter.createRecipe(payload, userId),
    updateRecipe: (id: string, payload: any) =>
      adapter.updateRecipe(id, payload, userId),
    deleteRecipe: (id: string) => adapter.deleteRecipe(id, userId),
    pushIngredientsToGrocery: (recipeId: string) =>
      adapter.pushIngredientsToGrocery(recipeId, userId),
    getGroceryLists: () => adapter.getGroceryLists(userId),
    addGroceryItem: (section: string, title: string) =>
      adapter.addGroceryItem(section, title, userId),
    updateGroceryItem: (section: string, id: string, patch: any) =>
      adapter.updateGroceryItem(section, id, patch, userId),
    deleteGroceryItem: (section: string, id: string) =>
      adapter.deleteGroceryItem(section, id, userId),
    getTasks: () => adapter.getTasks(userId),
    getTask: (id: string) => adapter.getTask(id, userId),
    createTask: (payload: any) => adapter.createTask(payload, userId),
    updateTask: (id: string, payload: any) =>
      adapter.updateTask(id, payload, userId),
    deleteTask: (id: string) => adapter.deleteTask(id, userId),
    getCalendarEvents: () => adapter.getCalendarEvents(userId),
    getCalendarEvent: (id: string) => adapter.getCalendarEvent(id, userId),
    createCalendarEvent: (payload: any) =>
      adapter.createCalendarEvent(payload, userId),
    updateCalendarEvent: (id: string, payload: any) =>
      adapter.updateCalendarEvent(id, payload, userId),
    deleteCalendarEvent: (id: string) =>
      adapter.deleteCalendarEvent(id, userId),
    getNewsSources: () => adapter.getNewsSources(userId),
    getNewsSource: (id: string) => adapter.getNewsSource(id, userId),
    createNewsSource: (payload: any) =>
      adapter.createNewsSource(payload, userId),
    updateNewsSource: (id: string, payload: any) =>
      adapter.updateNewsSource(id, payload, userId),
    deleteNewsSource: (id: string) => adapter.deleteNewsSource(id, userId),
    getCachedArticles: (sourceId?: string, maxAgeMinutes?: number) =>
      adapter.getCachedArticles(sourceId, maxAgeMinutes),
    cacheArticles: (articles: any[], ttlSeconds?: number) =>
      adapter.cacheArticles(articles, ttlSeconds),
    clearArticleCache: (sourceId?: string) =>
      adapter.clearArticleCache(sourceId),
  };
}

// Export a function that returns the appropriate adapter with userId injected
export default function getStorageAdapter(req?: IncomingMessage) {
  const adapter = getAdapter(req);
  const userId = getUserIdFromRequest(req);
  return wrapAdapterWithUserId(adapter, userId);
}