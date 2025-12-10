import { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../../lib/storage";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const storage = getStorageAdapter(req);
    const { id } = req.query as { id: string };
    if (req.method !== "POST") {
      res.setHeader("Allow", ["POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    if (!id) return res.status(400).json({ error: "missing id" });
    try {
      const count = await storage.pushIngredientsToGrocery(id);
      return res.status(200).json({ added: count });
    } catch (err: any) {
      // Map not-found errors from storage to 404 so clients get a useful response
      if (
        err &&
        (err.message === "not found" || /not\s*found/i.test(err.message))
      ) {
        return res.status(404).json({ error: "not found" });
      }
      throw err;
    }
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "server error" });
  }
}