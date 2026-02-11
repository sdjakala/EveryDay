import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const tasks = await storage.getTasks();
      return res.status(200).json({ tasks });
    }

    if (req.method === "POST") {
      const { title, completed, parentId } = req.body || {};
      if (!title) {
        return res.status(400).json({ error: "title required" });
      }
      const created = await storage.createTask({ title, completed, parentId });
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}