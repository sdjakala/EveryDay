import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const storage = getStorageAdapter(req);
  const { id } = req.query;
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid ID" });

  if (req.method === "GET") {
    const trip = await storage.getTrip(id);
    if (!trip) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(trip);
  }

  if (req.method === "PATCH") {
    const updated = await storage.updateTrip(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    const deleted = await storage.deleteTrip(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
  return res.status(405).json({ error: "Method not allowed" });
}
