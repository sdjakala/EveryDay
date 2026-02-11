import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);
    const { id } = req.query as { id: string };
    if (!id) {
      return res.status(400).json({ error: "missing id" });
    }

    if (req.method === "GET") {
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      return res.status(200).json(task);
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const updated = await storage.updateTask(id, req.body || {});
      if (!updated) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // If marking a parent task as complete, also complete all subtasks
      if (req.body?.completed === true && !updated.parentId) {
        const allTasks = await storage.getTasks();
        const subtasks = allTasks.filter((t: any) => t.parentId === id);
        
        // Mark all subtasks as complete
        for (const subtask of subtasks) {
          if (!subtask.completed) {
            await storage.updateTask(subtask.id, { completed: true });
          }
        }
      }
      
      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      // Delete all subtasks first
      const allTasks = await storage.getTasks();
      const subtasks = allTasks.filter((t: any) => t.parentId === id);
      for (const subtask of subtasks) {
        await storage.deleteTask(subtask.id);
      }
      
      // Then delete the parent task
      const ok = await storage.deleteTask(id);
      return res.status(ok ? 200 : 404).json({ deleted: ok });
    }

    res.setHeader("Allow", ["GET", "PUT", "PATCH", "DELETE"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}