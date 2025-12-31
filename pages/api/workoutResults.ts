import type { NextApiRequest, NextApiResponse } from "next";
import storage from "../../lib/storage";
import type { WorkoutResult } from "../../lib/storage/cosmos";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const storageAdapter = storage(req);

  if (req.method === "POST") {
    // Save a completed workout result
    const { workoutId, title, lifts } = req.body;
    if (!workoutId || !title || !lifts) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const completedAt = new Date().toISOString();
    const result: Omit<WorkoutResult, "id"> = {
      workoutId,
      title,
      completedAt,
      lifts,
      userId: "",
    };
    try {
      const saved = await storageAdapter.createWorkoutResult(result);
      return res.status(201).json(saved);
    } catch (e) {
      return res.status(500).json({ error: "Failed to save workout result" });
    }
  } else if (req.method === "GET") {
    // Fetch past workout results with optional filtering by lift name and limit
    try {
      const liftName = typeof req.query.liftName === "string" ? req.query.liftName : undefined;
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
      let results = await storageAdapter.listWorkoutResults();
      if (liftName) {
        results = results.filter((r: any) => r.lifts && r.lifts.some((l: any) => l.name === liftName));
      }
      // sort by completedAt ascending
      results.sort((a: any, b: any) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
      if (limit && limit > 0) {
        results = results.slice(-limit);
      }
      return res.status(200).json(results);
    } catch (e) {
      return res.status(500).json({ error: "Failed to fetch workout results" });
    }
  } else {
    if (req.method === "DELETE") {
      // Clear history: if liftName provided, only delete results containing that lift
      try {
        const liftName = req.body?.liftName || (typeof req.query.liftName === "string" ? req.query.liftName : undefined);
        const removed = await storageAdapter.clearWorkoutResults(liftName);
        return res.status(200).json({ removed });
      } catch (e) {
        console.error("Failed to clear workout results:", e);
        return res.status(500).json({ error: "Failed to clear workout results" });
      }
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
