import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const storage = getStorageAdapter(req);

  try {
    // POST - Create a new topic within a subject OR complete maintenance
    if (req.method === "POST") {
      const { action, subjectId } = req.body;

      // Handle completion action
      if (action === "complete") {
        const { topicId, date, mileage, hours, notes } = req.body;

        if (!subjectId || !topicId || !date) {
          return res.status(400).json({ 
            error: "Subject ID, topic ID, and date are required" 
          });
        }

        const updated = await storage.completeTopicMaintenance(
          subjectId,
          topicId,
          { date, mileage, hours, notes }
        );

        if (!updated) {
          return res.status(404).json({ error: "Topic not found" });
        }

        return res.status(200).json(updated);
      }

      // Create new topic
      const {
        name,
        steps,
        tools,
        durationValue,
        durationType,
        scheduledDate,
        notes,
      } = req.body;

      if (!subjectId || !name) {
        return res.status(400).json({ 
          error: "Subject ID and name are required" 
        });
      }

      const topic = await storage.createTopic(subjectId, {
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
      const { subjectId, topicId } = req.query;
      
      if (!subjectId || typeof subjectId !== "string") {
        return res.status(400).json({ error: "Subject ID is required" });
      }
      
      if (!topicId || typeof topicId !== "string") {
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

      // Filter out undefined values to avoid overwriting existing data
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (steps !== undefined) updates.steps = steps;
      if (tools !== undefined) updates.tools = tools;
      if (durationValue !== undefined) updates.durationValue = durationValue;
      if (durationType !== undefined) updates.durationType = durationType;
      if (scheduledDate !== undefined) updates.scheduledDate = scheduledDate;
      if (notes !== undefined) updates.notes = notes;
      if (lastCompletedDate !== undefined) updates.lastCompletedDate = lastCompletedDate;
      if (lastCompletedMileage !== undefined) updates.lastCompletedMileage = lastCompletedMileage;
      if (lastCompletedHours !== undefined) updates.lastCompletedHours = lastCompletedHours;

      const updated = await storage.updateTopic(subjectId, topicId, updates);

      if (!updated) {
        return res.status(404).json({ error: "Topic not found" });
      }

      return res.status(200).json(updated);
    }

    // DELETE - Delete a topic
    if (req.method === "DELETE") {
      const { subjectId, topicId } = req.query;
      
      if (!subjectId || typeof subjectId !== "string") {
        return res.status(400).json({ error: "Subject ID is required" });
      }
      
      if (!topicId || typeof topicId !== "string") {
        return res.status(400).json({ error: "Topic ID is required" });
      }

      const deleted = await storage.deleteTopic(subjectId, topicId);

      if (!deleted) {
        return res.status(404).json({ error: "Topic not found" });
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["POST", "PUT", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Topics API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}