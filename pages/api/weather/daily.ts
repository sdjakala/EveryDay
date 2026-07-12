import type { NextApiRequest, NextApiResponse } from "next";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { latitude, longitude } = req.query;
  if (!latitude || !longitude) return res.status(400).json({ error: "Coordinates required" });
  if (!GOOGLE_MAPS_API_KEY) return res.status(500).json({ error: "API key not configured" });

  try {
    const url =
      `https://weather.googleapis.com/v1/forecast/days:lookup?key=${GOOGLE_MAPS_API_KEY}` +
      `&location.latitude=${latitude}&location.longitude=${longitude}&unitsSystem=IMPERIAL&pageSize=10`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Weather API ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    const forecast = (data.forecastDays || []).map((day: any) => ({
      date: day.interval?.startTime?.slice(0, 10) || "",
      high: day.maxTemperature?.degrees ?? null,
      low: day.minTemperature?.degrees ?? null,
      condition: day.daytimeForecast?.weatherCondition?.description?.text || "",
      precipProbability: day.daytimeForecast?.precipitation?.probability?.percent || 0,
      icon: day.daytimeForecast?.weatherCondition?.iconBaseUri
        ? `${day.daytimeForecast.weatherCondition.iconBaseUri}.svg`
        : "",
    }));

    return res.status(200).json({ forecast });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}
