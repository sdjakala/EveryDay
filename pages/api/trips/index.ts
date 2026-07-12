import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const storage = getStorageAdapter(req);

  if (req.method === "GET") {
    const trips = await storage.listTrips();
    return res.status(200).json(trips);
  }

  if (req.method === "POST") {
    const { name, startDate, endDate, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const trip = await storage.createTrip({ name: name.trim(), startDate, endDate, description });
    return res.status(201).json(trip);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
