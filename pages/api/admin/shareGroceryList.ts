import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import cookie from "cookie";

// Admin endpoint to share a grocery list with users
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
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

    // Admin is verified, proceed with sharing
    const { section, userEmails } = req.body;

    if (!section || !Array.isArray(userEmails)) {
      return res
        .status(400)
        .json({ error: "section and userEmails[] required" });
    }

    // Get the grocery list section directly from Cosmos using CosmosClient
    const { CosmosClient } = require("@azure/cosmos");
    const endpoint = process.env.COSMOS_ENDPOINT || "";
    const key = process.env.COSMOS_KEY || "";
    const databaseId = process.env.COSMOS_DATABASE || "EveryDay";
    const groceryContainerId =
      process.env.COSMOS_CONTAINER_GROCERY || "Grocery";

    if (!endpoint || !key) {
      return res.status(500).json({ error: "Cosmos DB not configured" });
    }

    const client = new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(groceryContainerId);

    try {
      const { resource: sectionDoc } = await container
        .item(section, section)
        .read();

      if (!sectionDoc) {
        return res
          .status(404)
          .json({ error: "Grocery list section not found" });
      }

      // Update sharedWith array
      const currentShared = sectionDoc.sharedWith || [];
      const newShared = [...new Set([...currentShared, ...userEmails])];

      sectionDoc.sharedWith = newShared;

      await container.item(section, section).replace(sectionDoc);

      return res.status(200).json({
        success: true,
        section: sectionDoc,
        sharedWith: newShared,
      });
    } catch (e: any) {
      if (e.code === 404) {
        return res
          .status(404)
          .json({ error: "Grocery list section not found" });
      }
      throw e;
    }
  } catch (e: any) {
    console.error("Share grocery list error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}