import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import cosmos from "../../../lib/storage/cosmos";

// Admin endpoint to share a recipe with users
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
    const { recipeId, userEmails } = req.body;

    if (!recipeId || !Array.isArray(userEmails)) {
      return res
        .status(400)
        .json({ error: "recipeId and userEmails[] required" });
    }

    // Get the recipe (as admin, no userId filter)
    const recipe = await cosmos.getRecipe(recipeId);
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Update sharedWith array
    const currentShared = recipe.sharedWith || [];
    const newShared = [...new Set([...currentShared, ...userEmails])];

    const updated = await cosmos.updateRecipe(recipeId, {
      sharedWith: newShared,
    });

    return res.status(200).json({
      success: true,
      recipe: updated,
      sharedWith: newShared,
    });
  } catch (e: any) {
    console.error("Share recipe error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}