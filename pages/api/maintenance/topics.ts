import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const storage = getStorageAdapter(req);

  try {
    // GET - List topics (optionally filtered by subjectId)
    if (req.method === "GET") {
      const { subjectId } = req.query;
      const topics = await storage.getTopics(
        subjectId ? String(subjectId) : undefined
      );
      return res.status(200).json(topics);
    }

    // POST - Create a new topic or complete maintenance
    if (req.method === "POST") {
      const { action } = req.body;

      // Handle completion action
      if (action === "complete") {
        const { id, date, mileage, hours, notes } = req.body;

        if (!id || !date) {
          return res.status(400).json({ error: "ID and date are required" });
        }

        const updated = await storage.completeTopicMaintenance(id, {
          date,
          mileage,
          hours,
          notes,
        });

        if (!updated) {
          return res.status(404).json({ error: "Topic not found" });
        }

        return res.status(200).json(updated);
      }

      // Create new topic
      const {
        subjectId,
        name,
        steps,
        tools,
        durationValue,
        durationType,
        scheduledDate,
        notes,
      } = req.body;

      if (!subjectId || !name) {
        return res.status(400).json({ error: "Subject ID and name are required" });
      }

      const topic = await storage.createTopic({
        subjectId,
        name,
        steps: steps || [],
        tools: tools || [],
        durationValue,
        durationType,
        scheduledDate,
        notes,
      });

      return res.status(201).json(topic);
    }

    // PUT - Update a topic
    if (req.method === "PUT") {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Topic ID is required" });
      }

      const {
        name,
        steps,
        tools,
        durationValue,
        durationType,
        scheduledDate,
        notes,
        lastCompletedDate,
        lastCompletedMileage,
        lastCompletedHours,
      } = req.body;

      const updated = await storage.updateTopic(id, {
        name,
        steps,
        tools,
        durationValue,
        durationType,
        scheduledDate,
        notes,
        lastCompletedDate,
        lastCompletedMileage,
        lastCompletedHours,
      });

      if (!updated) {
        return res.status(404).json({ error: "Topic not found" });
      }

      return res.status(200).json(updated);
    }

    // DELETE - Delete a topic
    if (req.method === "DELETE") {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Topic ID is required" });
      }

      const deleted = await storage.deleteTopic(id);

      if (!deleted) {
        return res.status(404).json({ error: "Topic not found" });
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Topics API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}