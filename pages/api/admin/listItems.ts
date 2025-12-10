import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { CosmosClient } from "@azure/cosmos";

// Admin endpoint to list all items (recipes and grocery lists) for sharing
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check if user is admin
  try {
    const raw = req.headers.cookie || "";
    const parsed = cookie.parse(raw);
    const token = parsed["swa_session"];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const SESSION_SECRET = process.env.SESSION_SECRET || "";
    if (!SESSION_SECRET) {
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const payload = jwt.verify(token, SESSION_SECRET) as any;
    const email = payload.email;

    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim());
    if (!ADMIN_EMAILS.includes(email)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin access required" });
    }

    // Admin is verified, fetch all recipes and grocery lists
    const endpoint = process.env.COSMOS_ENDPOINT || "";
    const key = process.env.COSMOS_KEY || "";
    const databaseId = process.env.COSMOS_DATABASE || "EveryDay";
    const recipesContainerId =
      process.env.COSMOS_CONTAINER_RECIPES || "Recipes";
    const groceryContainerId =
      process.env.COSMOS_CONTAINER_GROCERY || "Grocery";

    if (!endpoint || !key) {
      return res.status(500).json({ error: "Cosmos DB not configured" });
    }

    const client = new CosmosClient({ endpoint, key });
    const recipesContainer = client
      .database(databaseId)
      .container(recipesContainerId);
    const groceryContainer = client
      .database(databaseId)
      .container(groceryContainerId);

    // Fetch all recipes
    const recipesResult = await recipesContainer.items
      .query("SELECT * FROM c ORDER BY c.createdAt DESC")
      .fetchAll();

    // Fetch all grocery lists
    const groceryResult = await groceryContainer.items
      .query("SELECT * FROM c")
      .fetchAll();

    return res.status(200).json({
      recipes: recipesResult.resources,
      groceryLists: groceryResult.resources,
    });
  } catch (e: any) {
    console.error("List items error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}