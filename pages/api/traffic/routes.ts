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
    const { origin, destination, departureTime, arrivalTime } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and destination required" });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res
        .status(500)
        .json({ error: "Google Maps API key not configured" });
    }

    // Build request parameters
    const params: Record<string, string> = {
      origin: origin as string,
      destination: destination as string,
      key: GOOGLE_MAPS_API_KEY,
      alternatives: "true", // Get up to 3 alternative routes
      mode: "driving",
      departure_time: "now"
    };
   
    // Call Google Maps Directions API
    const url = `https://maps.googleapis.com/maps/api/directions/json?${new URLSearchParams(params).toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK") {
      return res.status(400).json({
        error: `Google Maps API returned: ${data.status}`,
        message: data.error_message || "Failed to get directions",
      });
    }

    // Transform routes to our format
    const routes = data.routes.map((route: any) => {
      const leg = route.legs[0]; // We only have one leg (origin to destination)

      return {
        summary: route.summary || "Route",
        distance: leg.distance.text,
        duration: leg.duration.text,
        durationInTraffic: leg.duration_in_traffic?.text || leg.duration.text,
        polyline: route.overview_polyline.points,
      };
    });

    return res.status(200).json({ routes });
  } catch (e: any) {
    console.error("Traffic routes error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}