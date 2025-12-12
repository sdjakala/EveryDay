/* eslint-disable no-unused-vars */
// Cosmos DB adapter
// To use: set `STORAGE_ADAPTER=cosmos` and configure the following env vars:
// - COSMOS_ENDPOINT
// - COSMOS_KEY
// - COSMOS_DATABASE
// - COSMOS_CONTAINER_RECIPES
// - COSMOS_CONTAINER_GROCERY

import { CosmosClient } from "@azure/cosmos";

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
  userId?: string; // Owner of the recipe
  sharedWith?: string[]; // Array of userIds this recipe is shared with
};
type Item = {
  id: string;
  title: string;
  done?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type GrocerySection = {
  id: string;
  section: string;
  items: Item[];
  userId?: string; // Owner of the grocery list
  sharedWith?: string[]; // Array of userIds this list is shared with
};
type Task = {
  id: string;
  title: string;
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  userId?: string; // Owner of the task
  sharedWith?: string[]; // Array of userIds this task is shared with
};
type UserTokens = {
  id: string; // userId (email)
  userId: string; // userId (email) - for partition key
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // timestamp when access token expires
  createdAt?: string;
  updatedAt?: string;
};
type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO datetime
  end?: string; // ISO datetime
  location?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string; // Owner of the event
  sharedWith?: string[]; // Array of userIds this event is shared with
};
type NewsFeedSource = {
  id: string;
  name: string; // Friendly name for the source
  url: string; // URL to scrape
  active?: boolean; // Whether to fetch from this source
  createdAt?: string;
  updatedAt?: string;
  userId?: string; // Owner of the news source
  sharedWith?: string[]; // Array of userIds this source is shared with
};
type NewsArticleCache = {
  id: string; // unique article ID
  sourceId: string; // which source this came from
  title: string;
  url: string;
  source: string; // source domain name
  published?: string;
  cachedAt: string; // when it was cached
  ttl?: number; // Cosmos DB TTL in seconds (auto-delete)
};

const endpoint = process.env.COSMOS_ENDPOINT || "";
const key = process.env.COSMOS_KEY || "";
const databaseId = process.env.COSMOS_DATABASE || "EveryDay";
const recipesContainerId = process.env.COSMOS_CONTAINER_RECIPES || "Recipes";
const groceryContainerId = process.env.COSMOS_CONTAINER_GROCERY || "Grocery";
const tasksContainerId = process.env.COSMOS_CONTAINER_TASKS || "Tasks";
const tokensContainerId = process.env.COSMOS_CONTAINER_TOKENS || "Tokens";
const calendarContainerId = process.env.COSMOS_CONTAINER_CALENDAR || "Calendar";
const newsSourcesContainerId =
  process.env.COSMOS_CONTAINER_NEWS_SOURCES || "NewsSources";
const newsArticlesCacheContainerId =
  process.env.COSMOS_CONTAINER_NEWS_CACHE || "NewsArticlesCache";

let client: CosmosClient | null = null;

function getClient() {
  if (!client) {
    if (!endpoint || !key) {
      throw new Error(
        "Cosmos DB not configured. Set COSMOS_ENDPOINT and COSMOS_KEY."
      );
    }
    client = new CosmosClient({ endpoint, key });
  }
  return client;
}

// Helper to build access filter for queries (user owns it OR it's shared with them)
function buildAccessFilter(_userId: string): string {
  return `(c.userId = @userId OR ARRAY_CONTAINS(c.sharedWith, @userId))`;
}

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

const cosmosAdapter = {
  // Recipes
  async listRecipes(userId?: string): Promise<Recipe[]> {
    const client = getClient();
    const container = client.database(databaseId).container(recipesContainerId);

    if (!userId) {
      // No userId means fetch all (for admin or unauthenticated)
      const { resources } = await container.items
        .query("SELECT * FROM c ORDER BY c.createdAt DESC")
        .fetchAll();
      return resources as Recipe[];
    }

    // Fetch recipes owned by or shared with the user
    const query = {
      query: `SELECT * FROM c WHERE ${buildAccessFilter(userId)} ORDER BY c.createdAt DESC`,
      parameters: [{ name: "@userId", value: userId }],
    };
    const { resources } = await container.items.query(query).fetchAll();
    return resources as Recipe[];
  },

  async getRecipe(id: string, userId?: string): Promise<Recipe | null> {
    const client = getClient();
    const container = client.database(databaseId).container(recipesContainerId);
    try {
      const { resource } = await container.item(id, id).read<Recipe>();
      if (!resource) return null;

      // Check access: if userId provided, verify user owns it or it's shared with them
      if (
        userId &&
        resource.userId !== userId &&
        !resource.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      return resource || null;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async createRecipe(
    payload: Partial<Recipe>,
    userId?: string
  ): Promise<Recipe> {
    const client = getClient();
    const container = client.database(databaseId).container(recipesContainerId);
    const now = new Date().toISOString();
    const rec: Recipe = {
      id: payload.id || uid(),
      title: payload.title || "Untitled",
      link: payload.link,
      instructions: payload.instructions || [],
      ingredients: payload.ingredients || [],
      planned: !!payload.planned,
      createdAt: now,
      updatedAt: now,
      userId: userId || payload.userId, // Set owner
      sharedWith: payload.sharedWith || [], // Initialize empty shared list
    };
    const { resource } = await container.items.create(rec);
    return resource as Recipe;
  },

  async updateRecipe(
    id: string,
    payload: Partial<Recipe>,
    userId?: string
  ): Promise<Recipe | null> {
    const client = getClient();
    const container = client.database(databaseId).container(recipesContainerId);
    try {
      const { resource: existing } = await container
        .item(id, id)
        .read<Recipe>();
      if (!existing) return null;

      // Check access: user must own it or have it shared with them
      if (
        userId &&
        existing.userId !== userId &&
        !existing.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      const updated: Recipe = {
        ...existing,
        ...payload,
        id, // preserve id
        userId: existing.userId, // preserve owner
        updatedAt: new Date().toISOString(),
      };
      const { resource } = await container.item(id, id).replace(updated);
      return resource as Recipe;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async deleteRecipe(id: string, userId?: string): Promise<boolean> {
    const client = getClient();
    const container = client.database(databaseId).container(recipesContainerId);
    try {
      // Check access before deleting
      if (userId) {
        const { resource: existing } = await container
          .item(id, id)
          .read<Recipe>();
        if (!existing) return false;
        if (existing.userId !== userId) {
          return false; // Only owner can delete
        }
      }

      await container.item(id, id).delete();
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  },

  async pushIngredientsToGrocery(
    recipeId: string,
    userId?: string
  ): Promise<number> {
    const rec = await this.getRecipe(recipeId, userId);
    if (!rec) throw new Error("Recipe not found");
    if (!rec.ingredients || !rec.ingredients.length) return 0;

    const client = getClient();
    const container = client.database(databaseId).container(groceryContainerId);

    // Group ingredients by section
    const bySec: Record<string, Ingredient[]> = {};
    rec.ingredients.forEach((ing) => {
      const sec = ing.section || "Pantry";
      if (!bySec[sec]) bySec[sec] = [];
      bySec[sec].push(ing);
    });

    // For each section, fetch or create the section doc and add items
    for (const [section, ings] of Object.entries(bySec)) {
      let sectionDoc: GrocerySection | null = null;
      try {
        const { resource } = await container
          .item(section, section)
          .read<GrocerySection>();
        sectionDoc = resource || null;

        // Check access
        if (
          sectionDoc &&
          userId &&
          sectionDoc.userId !== userId &&
          !sectionDoc.sharedWith?.includes(userId)
        ) {
          continue; // Skip this section if user doesn't have access
        }
      } catch (e: any) {
        if (e.code !== 404) throw e;
      }

      if (!sectionDoc) {
        sectionDoc = {
          id: section,
          section,
          items: [],
          userId: userId, // Set owner
          sharedWith: [], // Initialize empty shared list
        };
      }

      // Add new items to the beginning
      const newItems: Item[] = ings.map((ing) => ({
        id: uid(),
        title: ing.title,
        done: false,
        createdAt: new Date().toISOString(),
      }));

      sectionDoc.items = [...newItems, ...sectionDoc.items];

      // Upsert the section doc
      await container.items.upsert(sectionDoc);
    }

    return rec.ingredients.length;
  },

  // Grocery
  async getGroceryLists(userId?: string): Promise<Record<string, Item[]>> {
    const client = getClient();
    const container = client.database(databaseId).container(groceryContainerId);

    let resources: GrocerySection[];

    if (!userId) {
      // No userId means fetch all (for admin or unauthenticated)
      const result = await container.items.query("SELECT * FROM c").fetchAll();
      resources = result.resources as GrocerySection[];
    } else {
      // Fetch lists owned by or shared with the user
      const query = {
        query: `SELECT * FROM c WHERE ${buildAccessFilter(userId)}`,
        parameters: [{ name: "@userId", value: userId }],
      };
      const result = await container.items.query(query).fetchAll();
      resources = result.resources as GrocerySection[];
    }

    const resultMap: Record<string, Item[]> = {};
    resources.forEach((sec) => {
      resultMap[sec.section] = sec.items || [];
    });
    return resultMap;
  },

  async addGroceryItem(
    section: string,
    title: string,
    userId?: string
  ): Promise<Item> {
    const client = getClient();
    const container = client.database(databaseId).container(groceryContainerId);

    let sectionDoc: GrocerySection | null = null;
    try {
      const { resource } = await container
        .item(section, section)
        .read<GrocerySection>();
      sectionDoc = resource || null;

      // Check access
      if (
        sectionDoc &&
        userId &&
        sectionDoc.userId !== userId &&
        !sectionDoc.sharedWith?.includes(userId)
      ) {
        throw new Error("Access denied");
      }
    } catch (e: any) {
      if (e.code !== 404) throw e;
    }

    if (!sectionDoc) {
      sectionDoc = {
        id: section,
        section,
        items: [],
        userId: userId, // Set owner
        sharedWith: [], // Initialize empty shared list
      };
    }

    const newItem: Item = {
      id: uid(),
      title,
      done: false,
      createdAt: new Date().toISOString(),
    };

    sectionDoc.items = [newItem, ...sectionDoc.items];
    await container.items.upsert(sectionDoc);

    return newItem;
  },

  async updateGroceryItem(
    section: string,
    id: string,
    patch: Partial<Item>,
    userId?: string
  ): Promise<Item | null> {
    const client = getClient();
    const container = client.database(databaseId).container(groceryContainerId);

    try {
      const { resource: sectionDoc } = await container
        .item(section, section)
        .read<GrocerySection>();
      if (!sectionDoc) return null;

      // Check access
      if (
        userId &&
        sectionDoc.userId !== userId &&
        !sectionDoc.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      sectionDoc.items = sectionDoc.items.map((it) =>
        it.id === id
          ? { ...it, ...patch, updatedAt: new Date().toISOString() }
          : it
      );

      await container.item(section, section).replace(sectionDoc);
      return sectionDoc.items.find((it) => it.id === id) || null;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async deleteGroceryItem(
    section: string,
    id: string,
    userId?: string
  ): Promise<boolean> {
    const client = getClient();
    const container = client.database(databaseId).container(groceryContainerId);

    try {
      const { resource: sectionDoc } = await container
        .item(section, section)
        .read<GrocerySection>();
      if (!sectionDoc) return false;

      // Check access
      if (
        userId &&
        sectionDoc.userId !== userId &&
        !sectionDoc.sharedWith?.includes(userId)
      ) {
        return false; // User doesn't have access
      }

      const before = sectionDoc.items.length;
      sectionDoc.items = sectionDoc.items.filter((it) => it.id !== id);

      if (before === sectionDoc.items.length) return false;

      await container.item(section, section).replace(sectionDoc);
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  },

  // Tasks
  async getTasks(userId?: string): Promise<Task[]> {
    const client = getClient();
    const container = client.database(databaseId).container(tasksContainerId);

    if (!userId) {
      // No userId means fetch all (for admin or unauthenticated)
      const { resources } = await container.items
        .query("SELECT * FROM c ORDER BY c.createdAt DESC")
        .fetchAll();
      return resources as Task[];
    }

    // Fetch tasks owned by or shared with the user
    const query = {
      query: `SELECT * FROM c WHERE ${buildAccessFilter(userId)} ORDER BY c.createdAt DESC`,
      parameters: [{ name: "@userId", value: userId }],
    };
    const { resources } = await container.items.query(query).fetchAll();
    return resources as Task[];
  },

  async getTask(id: string, userId?: string): Promise<Task | null> {
    const client = getClient();
    const container = client.database(databaseId).container(tasksContainerId);
    try {
      const { resource } = await container.item(id, id).read<Task>();
      if (!resource) return null;

      // Check access: if userId provided, verify user owns it or it's shared with them
      if (
        userId &&
        resource.userId !== userId &&
        !resource.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      return resource;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async createTask(payload: Partial<Task>, userId?: string): Promise<Task> {
    const client = getClient();
    const container = client.database(databaseId).container(tasksContainerId);

    const newTask: Task = {
      id: uid(),
      title: payload.title || "Untitled Task",
      completed: payload.completed || false,
      createdAt: new Date().toISOString(),
      userId: userId, // Set owner
      sharedWith: [], // Initialize empty shared list
    };

    const { resource } = await container.items.create(newTask);
    return resource as Task;
  },

  async updateTask(
    id: string,
    payload: Partial<Task>,
    userId?: string
  ): Promise<Task | null> {
    const client = getClient();
    const container = client.database(databaseId).container(tasksContainerId);

    try {
      const { resource: existing } = await container.item(id, id).read<Task>();
      if (!existing) return null;

      // Check access
      if (
        userId &&
        existing.userId !== userId &&
        !existing.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      const updated: Task = {
        ...existing,
        ...payload,
        id: existing.id, // Preserve id
        userId: existing.userId, // Preserve owner
        updatedAt: new Date().toISOString(),
      };

      const { resource } = await container.item(id, id).replace(updated);
      return resource as Task;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async deleteTask(id: string, userId?: string): Promise<boolean> {
    const client = getClient();
    const container = client.database(databaseId).container(tasksContainerId);

    try {
      const { resource: existing } = await container.item(id, id).read<Task>();
      if (!existing) return false;

      // Check access
      if (
        userId &&
        existing.userId !== userId &&
        !existing.sharedWith?.includes(userId)
      ) {
        return false; // User doesn't have access
      }

      await container.item(id, id).delete();
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  },

  // User Tokens (OAuth)
  async saveUserTokens(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<void> {
    const client = getClient();
    const container = client.database(databaseId).container(tokensContainerId);

    const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
    const tokens: UserTokens = {
      id: userId,
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      updatedAt: new Date().toISOString(),
    };

    await container.items.upsert(tokens);
  },

  async getUserTokens(userId: string): Promise<UserTokens | null> {
    const client = getClient();
    const container = client.database(databaseId).container(tokensContainerId);

    try {
      const { resource } = await container
        .item(userId, userId)
        .read<UserTokens>();
      return resource || null;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async deleteUserTokens(userId: string): Promise<boolean> {
    const client = getClient();
    const container = client.database(databaseId).container(tokensContainerId);

    try {
      await container.item(userId, userId).delete();
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  },

  // Calendar Events (custom user events)
  async getCalendarEvents(userId?: string): Promise<CalendarEvent[]> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(calendarContainerId);

    if (!userId) {
      // No userId means fetch all (for admin or unauthenticated)
      const { resources } = await container.items
        .query("SELECT * FROM c ORDER BY c.start ASC")
        .fetchAll();
      return resources as CalendarEvent[];
    }

    // Fetch events owned by or shared with the user
    const query = {
      query: `SELECT * FROM c WHERE ${buildAccessFilter(userId)} ORDER BY c.start ASC`,
      parameters: [{ name: "@userId", value: userId }],
    };
    const { resources } = await container.items.query(query).fetchAll();
    return resources as CalendarEvent[];
  },

  async getCalendarEvent(
    id: string,
    userId?: string
  ): Promise<CalendarEvent | null> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(calendarContainerId);
    try {
      const { resource } = await container.item(id, id).read<CalendarEvent>();
      if (!resource) return null;

      // Check access: if userId provided, verify user owns it or it's shared with them
      if (
        userId &&
        resource.userId !== userId &&
        !resource.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      return resource;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async createCalendarEvent(
    payload: Partial<CalendarEvent>,
    userId?: string
  ): Promise<CalendarEvent> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(calendarContainerId);

    const newEvent: CalendarEvent = {
      id: uid(),
      title: payload.title || "Untitled Event",
      start: payload.start || new Date().toISOString(),
      end: payload.end,
      location: payload.location,
      description: payload.description,
      createdAt: new Date().toISOString(),
      userId: userId, // Set owner
      sharedWith: [], // Initialize empty shared list
    };

    const { resource } = await container.items.create(newEvent);
    return resource as CalendarEvent;
  },

  async updateCalendarEvent(
    id: string,
    payload: Partial<CalendarEvent>,
    userId?: string
  ): Promise<CalendarEvent | null> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(calendarContainerId);

    try {
      const { resource: existing } = await container
        .item(id, id)
        .read<CalendarEvent>();
      if (!existing) return null;

      // Check access
      if (
        userId &&
        existing.userId !== userId &&
        !existing.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      const updated: CalendarEvent = {
        ...existing,
        ...payload,
        id: existing.id, // Preserve id
        userId: existing.userId, // Preserve owner
        updatedAt: new Date().toISOString(),
      };

      const { resource } = await container.item(id, id).replace(updated);
      return resource as CalendarEvent;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async deleteCalendarEvent(id: string, userId?: string): Promise<boolean> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(calendarContainerId);

    try {
      const { resource: existing } = await container
        .item(id, id)
        .read<CalendarEvent>();
      if (!existing) return false;

      // Check access
      if (
        userId &&
        existing.userId !== userId &&
        !existing.sharedWith?.includes(userId)
      ) {
        return false; // User doesn't have access
      }

      await container.item(id, id).delete();
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  },

  // News Sources
  async getNewsSources(userId?: string): Promise<NewsFeedSource[]> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsSourcesContainerId);

    const query = userId
      ? {
          query:
            "SELECT * FROM c WHERE c.userId = @userId OR ARRAY_CONTAINS(c.sharedWith, @userId)",
          parameters: [{ name: "@userId", value: userId }],
        }
      : "SELECT * FROM c";

    const { resources } = await container.items.query(query).fetchAll();
    return resources as NewsFeedSource[];
  },

  async getNewsSource(
    id: string,
    userId?: string
  ): Promise<NewsFeedSource | null> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsSourcesContainerId);

    try {
      const { resource } = await container.item(id, id).read<NewsFeedSource>();
      if (!resource) return null;

      // Check access
      if (
        userId &&
        resource.userId !== userId &&
        !resource.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      return resource;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async createNewsSource(
    source: Omit<NewsFeedSource, "id" | "createdAt" | "updatedAt">,
    userId?: string
  ): Promise<NewsFeedSource> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsSourcesContainerId);

    const newSource: NewsFeedSource = {
      ...source,
      id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      active: source.active !== false, // default to true
      userId: userId || source.userId, // Set owner
      sharedWith: source.sharedWith || [], // Initialize shared list
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { resource } = await container.items.create(newSource);
    return resource as NewsFeedSource;
  },

  async updateNewsSource(
    id: string,
    updates: Partial<Omit<NewsFeedSource, "id" | "createdAt">>,
    userId?: string
  ): Promise<NewsFeedSource | null> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsSourcesContainerId);

    try {
      const { resource: existing } = await container
        .item(id, id)
        .read<NewsFeedSource>();
      if (!existing) return null;

      // Check access
      if (
        userId &&
        existing.userId !== userId &&
        !existing.sharedWith?.includes(userId)
      ) {
        return null; // User doesn't have access
      }

      const updated = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };

      const { resource } = await container.item(id, id).replace(updated);
      return resource as NewsFeedSource;
    } catch (e: any) {
      if (e.code === 404) return null;
      throw e;
    }
  },

  async deleteNewsSource(id: string, userId?: string): Promise<boolean> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsSourcesContainerId);

    try {
      const { resource: existing } = await container
        .item(id, id)
        .read<NewsFeedSource>();
      if (!existing) return false;

      // Check access
      if (
        userId &&
        existing.userId !== userId &&
        !existing.sharedWith?.includes(userId)
      ) {
        return false; // User doesn't have access
      }

      await container.item(id, id).delete();
      return true;
    } catch (e: any) {
      if (e.code === 404) return false;
      throw e;
    }
  },

  // News Article Cache
  async getCachedArticles(
    sourceId?: string,
    maxAgeMinutes: number = 60
  ): Promise<NewsArticleCache[]> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsArticlesCacheContainerId);

    try {
      const cutoffTime = new Date(
        Date.now() - maxAgeMinutes * 60 * 1000
      ).toISOString();

      let query;
      if (sourceId) {
        query = {
          query:
            "SELECT * FROM c WHERE c.sourceId = @sourceId AND c.cachedAt > @cutoff ORDER BY c.cachedAt DESC",
          parameters: [
            { name: "@sourceId", value: sourceId },
            { name: "@cutoff", value: cutoffTime },
          ],
        };
      } else {
        query = {
          query:
            "SELECT * FROM c WHERE c.cachedAt > @cutoff ORDER BY c.cachedAt DESC",
          parameters: [{ name: "@cutoff", value: cutoffTime }],
        };
      }

      const { resources } = await container.items.query(query).fetchAll();
      return resources as NewsArticleCache[];
    } catch (e: any) {
      console.error("Error fetching cached articles:", e);
      return [];
    }
  },

  async cacheArticles(
    articles: Omit<NewsArticleCache, "id" | "cachedAt" | "ttl">[],
    ttlSeconds: number = 3600
  ): Promise<void> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsArticlesCacheContainerId);

    const cachedAt = new Date().toISOString();

    // Batch upsert articles
    const promises = articles.map((article) => {
      const cached: NewsArticleCache = {
        ...article,
        id: `${article.sourceId}-${Buffer.from(article.url).toString("base64url")}`,
        cachedAt,
        ttl: ttlSeconds, // Cosmos will auto-delete after this many seconds
      };
      return container.items.upsert(cached);
    });

    await Promise.all(promises);
  },

  async clearArticleCache(sourceId?: string): Promise<number> {
    const client = getClient();
    const container = client
      .database(databaseId)
      .container(newsArticlesCacheContainerId);

    try {
      let query;
      if (sourceId) {
        query = {
          query: "SELECT c.id FROM c WHERE c.sourceId = @sourceId",
          parameters: [{ name: "@sourceId", value: sourceId }],
        };
      } else {
        query = "SELECT c.id FROM c";
      }

      const { resources } = await container.items.query(query).fetchAll();

      // Delete each item
      const deletePromises = resources.map((item) =>
        container.item(item.id, item.id).delete()
      );
      await Promise.all(deletePromises);

      return resources.length;
    } catch (e: any) {
      console.error("Error clearing article cache:", e);
      return 0;
    }
  },
};

export default cosmosAdapter;