import type { NextApiRequest, NextApiResponse } from "next";
import storage from "../../lib/storage";

type Workout = {
  id: string;
  title: string;
  lifts: any[];
  createdAt: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const adapter = storage(req);

    if (req.method === "GET") {
      const workouts = await adapter.getWorkouts();
      return res.status(200).json({ workouts });
    }

    if (req.method === "POST") {
      const { title } = req.body;
      if (!title) return res.status(400).json({ error: "Title required" });

      const workout: Workout = {
        id: Math.random().toString(36).slice(2, 9),
        title,
        lifts: [],
        createdAt: new Date().toISOString(),
      };

      await adapter.addWorkout(workout);
      return res.status(201).json(workout);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Workout API error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
