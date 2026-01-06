import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { city, state } = req.body;

    if (!city || !state) {
      return res.status(400).json({ error: "City and state are required" });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res
        .status(500)
        .json({ error: "Google Maps API key not configured" });
    }

    const storage = getStorageAdapter(req);

    // Call Google Geocoding API
    const address = `${city}, ${state}, USA`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return res.status(400).json({
        error: `Could not find location: ${city}, ${state}`,
        status: data.status,
      });
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // Save to database
    const saved = await storage.createWeatherLocation({
      city: city.trim(),
      state: state.trim().toUpperCase(),
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
    });

    return res.status(201).json(saved);
  } catch (e: any) {
    console.error("Geocoding error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}