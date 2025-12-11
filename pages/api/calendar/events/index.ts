import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const events = await storage.getCalendarEvents();
      return res.status(200).json({ events });
    }

    if (req.method === "POST") {
      const { title, start, end, location, description } = req.body || {};
      if (!title || !start) {
        return res.status(400).json({ error: "title and start required" });
      }
      const created = await storage.createCalendarEvent({
        title,
        start,
        end,
        location,
        description,
      });
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}