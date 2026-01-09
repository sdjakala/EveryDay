import type { NextApiRequest, NextApiResponse } from "next";

const IPGEOLOCATION_API_KEY = process.env.IPGEOLOCATION_API_KEY || "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude required" });
    }

    if (!IPGEOLOCATION_API_KEY) {
      return res
        .status(500)
        .json({ error: "IPGeolocation API key not configured" });
    }

    // Call IPGeolocation Astronomy API
    const url = `https://api.ipgeolocation.io/v2/astronomy?apiKey=${IPGEOLOCATION_API_KEY}&lat=${latitude}&long=${longitude}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("IPGeolocation Astronomy API error:", errorText);
      throw new Error(`Astronomy API error: ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json(data);
  } catch (e: any) {
    console.error("Astronomy API error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}