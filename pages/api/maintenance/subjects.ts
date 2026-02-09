import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const storage = getStorageAdapter(req);

  try {
    // GET - List all subjects (with nested topics)
    if (req.method === "GET") {
      const subjects = await storage.getSubjects();
      return res.status(200).json(subjects);
    }

    // POST - Create a new subject
    if (req.method === "POST") {
      const { name, type, currentMileage, currentHours } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: "Name and type are required" });
      }

      const subject = await storage.createSubject({
        name,
        type,
        currentMileage,
        currentHours,
      });

      return res.status(201).json(subject);
    }

    // PUT - Update a subject
    if (req.method === "PUT") {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Subject ID is required" });
      }

      const { name, type, currentMileage, currentHours } = req.body;

      // Filter out undefined values and validate required fields
      const updates: any = {};
      
      // Name is required - don't allow empty strings
      if (name !== undefined) {
        if (typeof name === 'string' && name.trim() === '') {
          return res.status(400).json({ error: "Subject name cannot be empty" });
        }
        updates.name = name;
      }
      
      // Type should not be empty if provided
      if (type !== undefined) {
        if (typeof type === 'string' && type.trim() === '') {
          return res.status(400).json({ error: "Subject type cannot be empty" });
        }
        updates.type = type;
      }
      
      if (currentMileage !== undefined) updates.currentMileage = currentMileage;
      if (currentHours !== undefined) updates.currentHours = currentHours;

      const updated = await storage.updateSubject(id, updates);

      if (!updated) {
        return res.status(404).json({ error: "Subject not found" });
      }

      return res.status(200).json(updated);
    }

    // DELETE - Delete a subject (and all nested topics)
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Subject ID is required" });
      }

      const deleted = await storage.deleteSubject(id);

      if (!deleted) {
        return res.status(404).json({ error: "Subject not found" });
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Subjects API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}