import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const storage = getStorageAdapter(req);

  if (req.method === "GET") {
    // Get cache stats
    try {
      const { sourceId, maxAge } = req.query;
      const maxAgeMinutes = maxAge ? parseInt(maxAge as string) : 60;

      const cached = await storage.getCachedArticles(
        sourceId as string | undefined,
        maxAgeMinutes
      );

      return res.status(200).json({
        count: cached.length,
        articles: cached,
        maxAgeMinutes,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "DELETE") {
    // Clear cache
    try {
      const { sourceId } = req.query;
      const cleared = await storage.clearArticleCache(
        sourceId as string | undefined
      );

      return res.status(200).json({
        message: `Cleared ${cleared} cached articles`,
        cleared,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  res.status(405).json({ error: `Method ${req.method} not allowed` });
}