import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const alerts = await storage.getTrafficAlerts();
      return res.status(200).json({ alerts });
    }

    if (req.method === "POST") {
      const {
        routeId,
        routeName,
        normalDuration,
        currentDuration,
        delay,
        routeSummary,
      } = req.body || {};

      if (
        !routeId ||
        !routeName ||
        !normalDuration ||
        !currentDuration ||
        !delay
      ) {
        return res.status(400).json({
          error:
            "routeId, routeName, normalDuration, currentDuration, and delay required",
        });
      }

      const created = await storage.createTrafficAlert({
        routeId,
        routeName,
        normalDuration,
        currentDuration,
        delay,
        routeSummary: routeSummary || "",
      });
      return res.status(201).json(created);
    }

    if (req.method === "DELETE") {
      // Clear all alerts
      const count = await storage.clearTrafficAlerts();
      return res.status(200).json({ cleared: count });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}