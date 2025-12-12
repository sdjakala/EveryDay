import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const storage = getStorageAdapter(req);

  if (req.method === "GET") {
    try {
      const sources = await storage.getNewsSources();
      return res.status(200).json({ sources });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST") {
    try {
      const { name, url, active } = req.body;
      if (!name || !url) {
        return res.status(400).json({ error: "Name and URL are required" });
      }

      const source = await storage.createNewsSource({ name, url, active });
      return res.status(201).json(source);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).json({ error: `Method ${req.method} not allowed` });
}