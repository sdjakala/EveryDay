// pages/api/connections/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const connections = await storage.listConnections();
      return res.status(200).json(connections);
    }

    if (req.method === "POST") {
      const { recipientId, recipientName, permissions } = req.body;

      if (!recipientId) {
        return res.status(400).json({ error: "recipientId is required" });
      }

      // Create the connection request
      const connection = await storage.createConnection({
        recipientId,
        recipientName,
        permissions: permissions || ['assign-tasks', 'view-tasks'],
      });

      return res.status(201).json(connection);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error("Connection API error:", e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}