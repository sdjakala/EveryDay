import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const storage = getStorageAdapter(req);
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID" });
  }

  if (req.method === "GET") {
    try {
      const source = await storage.getNewsSource(id);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      return res.status(200).json(source);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    try {
      const updates = req.body;
      const source = await storage.updateNewsSource(id, updates);
      if (!source) {
        return res.status(404).json({ error: "Source not found" });
      }
      return res.status(200).json(source);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const deleted = await storage.deleteNewsSource(id);
      if (!deleted) {
        return res.status(404).json({ error: "Source not found" });
      }
      return res.status(204).end();
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
  res.status(405).json({ error: `Method ${req.method} not allowed` });
}