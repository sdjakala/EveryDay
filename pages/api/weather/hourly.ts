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

    // Call Google Weather API - Hourly Forecast endpoint (correct URL)
    // Note: unitsSystem parameter may not always be respected; API sometimes returns metric
    const url = `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${GOOGLE_MAPS_API_KEY}` +
                `&location.latitude=${latitude}&location.longitude=${longitude}&unitsSystem=IMPERIAL&pageSize=24`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Weather API error:", errorText);
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform the data to a simpler format
    // The actual response uses 'forecastHours' not 'hourlyForecasts'
    const forecast = (data.forecastHours || []).map((hour: any) => ({
      time: hour.interval.startTime,
      temperature: hour.temperature,
      condition: hour.weatherCondition?.description?.text || "Unknown",
      precipProbability: hour.precipitation?.probability?.percent || 0,
      windSpeed: hour.wind?.speed?.value || 0,
      windDirection: hour.wind?.direction?.degrees || 0,
      humidity: hour.relativeHumidity || 0,
      icon: hour.weatherCondition?.iconBaseUri ? `${hour.weatherCondition.iconBaseUri}.svg` : ""
    }));

    return res.status(200).json({ forecast });
  } catch (e: any) {
    console.error("Hourly forecast API error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}