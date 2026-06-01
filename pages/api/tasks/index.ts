import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);

    if (req.method === "GET") {
      const tasks = await storage.getTasks();
      return res.status(200).json(tasks);
    }

    if (req.method === "POST") {
      const { title, completed, parentId, assignedTo, assignedBy } = req.body;

      if (!title) {
        return res.status(400).json({ error: "title is required" });
      }

      // If assigning to someone else, verify permission
      if (assignedTo && assignedBy) {
        const canAssign = await storage.canAssignTask(assignedBy, assignedTo);
        if (!canAssign) {
          return res.status(403).json({ 
            error: "You don't have permission to assign tasks to this user. Please send them a connection request first." 
          });
        }
      }

      const task = await storage.createTask({
        title,
        completed: completed || false,
        parentId,
        assignedTo,
        assignedBy,
      });

      return res.status(201).json(task);
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (e: any) {
    console.error("Task API error:", e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}