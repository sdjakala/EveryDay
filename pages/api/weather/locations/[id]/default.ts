import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;

    if (typeof id !== "string") {
      return res.status(400).json({ error: "Invalid location ID" });
    }

    const storage = getStorageAdapter(req);
    const success = await storage.setDefaultWeatherLocation(id);

    if (!success) {
      return res.status(404).json({ error: "Location not found" });
    }

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error("Error setting default location:", e);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}