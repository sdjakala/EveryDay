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

    if (req.method === "PUT" || req.method === "PATCH") {
      // Dismiss the alert
      const dismissed = await storage.dismissTrafficAlert(id);
      if (!dismissed) {
        return res.status(404).json({ error: "Alert not found" });
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["PUT", "PATCH"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}