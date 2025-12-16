import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const routes = await storage.getFavoriteRoutes();
      return res.status(200).json({ routes });
    }

    if (req.method === "POST") {
      const {
        name,
        originId,
        originAddress,
        destinationId,
        destinationAddress,
        departureTime,
        arrivalTime,
        notifyOnTraffic,
        baselineDuration,
      } = req.body || {};

      if (
        !name ||
        !originId ||
        !originAddress ||
        !destinationId ||
        !destinationAddress
      ) {
        return res.status(400).json({
          error:
            "name, originId, originAddress, destinationId, and destinationAddress required",
        });
      }

      const created = await storage.createFavoriteRoute({
        name,
        originId,
        originAddress,
        destinationId,
        destinationAddress,
        departureTime,
        arrivalTime,
        notifyOnTraffic,
        baselineDuration,
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