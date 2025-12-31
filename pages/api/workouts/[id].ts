import type { NextApiRequest, NextApiResponse } from "next";
import storage from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { id } = req.query;
    console.log("[Workout Dynamic Route] Received request:", {
      method: req.method,
      id,
      path: req.url,
    });
    
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Invalid workout ID" });
    }

    const adapter = storage(req);

    if (req.method === "GET") {
      const workout = await adapter.getWorkout(id);
      if (!workout) {
        return res.status(404).json({ error: "Workout not found" });
      }
      return res.status(200).json(workout);
    }

    if (req.method === "PATCH") {
      console.log("[Workout Dynamic Route] PATCH request:", { id, body: req.body });
      const workout = await adapter.updateWorkout(id, req.body);
      console.log("[Workout Dynamic Route] Update result:", workout);
      if (!workout) {
        console.error("[Workout Dynamic Route] Workout not found after update");
        return res.status(404).json({ error: "Workout not found" });
      }
      return res.status(200).json(workout);
    }

    if (req.method === "DELETE") {
      const deleted = await adapter.deleteWorkout(id);
      if (!deleted) {
        return res.status(404).json({ error: "Workout not found" });
      }
      return res.status(204).send("");
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error("Workout API error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
