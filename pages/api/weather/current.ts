import type { NextApiRequest, NextApiResponse } from "next";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

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

    if (!GOOGLE_MAPS_API_KEY) {
      return res
        .status(500)
        .json({ error: "Google Maps API key not configured" });
    }

    // Call Google Weather API - Current Conditions endpoint
    const url = `https://weather.googleapis.com/v1/currentConditions:lookup?&key=${GOOGLE_MAPS_API_KEY}` +
                `&location.latitude=${latitude}&location.longitude=${longitude}&unitsSystem=IMPERIAL`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Weather API error:", errorText);
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json(data);
  } catch (e: any) {
    console.error("Weather API error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}