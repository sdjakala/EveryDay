import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const lists = await storage.getGroceryLists();
      return res.status(200).json({ lists });
    }

    if (req.method === "POST") {
      const { section, title } = req.body || {};
      if (!section || !title)
        return res.status(400).json({ error: "section and title required" });
      const created = await storage.addGroceryItem(section, title);
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}