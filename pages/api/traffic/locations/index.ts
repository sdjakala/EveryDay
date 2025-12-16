import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const locations = await storage.getTrafficLocations();
      return res.status(200).json({ locations });
    }

    if (req.method === "POST") {
      const { name, address } = req.body || {};
      if (!name || !address) {
        return res.status(400).json({ error: "name and address required" });
      }
      const created = await storage.createTrafficLocation({ name, address });
      return res.status(201).json(created);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}