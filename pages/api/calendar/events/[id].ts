import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);
    const { id } = req.query as { id: string };
    if (!id) {
      return res.status(400).json({ error: "missing id" });
    }

    if (req.method === "GET") {
      const event = await storage.getCalendarEvent(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      return res.status(200).json(event);
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const updated = await storage.updateCalendarEvent(id, req.body || {});
      if (!updated) {
        return res.status(404).json({ error: "Event not found" });
      }
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const ok = await storage.deleteCalendarEvent(id);
      return res.status(ok ? 200 : 404).json({ deleted: ok });
    }

    res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}
