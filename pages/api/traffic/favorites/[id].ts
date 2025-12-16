import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid ID" });
    }

    if (req.method === "GET") {
      const route = await storage.getFavoriteRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      return res.status(200).json(route);
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const updated = await storage.updateFavoriteRoute(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Route not found" });
      }
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const deleted = await storage.deleteFavoriteRoute(id);
      if (!deleted) {
        return res.status(404).json({ error: "Route not found" });
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}