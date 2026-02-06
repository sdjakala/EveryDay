import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  // Simple health check that returns immediately
  res.status(200).json({ status: "ok" });
}
