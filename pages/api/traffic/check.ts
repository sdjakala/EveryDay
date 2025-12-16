import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

// Threshold: if traffic is more than 30% longer than baseline, create an alert
const TRAFFIC_THRESHOLD = 0.3;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const storage = getStorageAdapter(req);
    const { routeId } = req.body;

    if (!routeId) {
      return res.status(400).json({ error: "routeId required" });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res
        .status(500)
        .json({ error: "Google Maps API key not configured" });
    }

    // Get the favorite route
    const route = await storage.getFavoriteRoute(routeId);
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    if (!route.notifyOnTraffic) {
      return res.status(200).json({
        message: "Notifications disabled for this route",
        alertCreated: false,
      });
    }

    // Build request parameters
    const params: Record<string, string> = {
      origin: route.originAddress,
      destination: route.destinationAddress,
      key: GOOGLE_MAPS_API_KEY,
      mode: "driving",
      departure_time: "now", // Always check current traffic
    };

    // Call Google Maps Directions API
    const url = `https://maps.googleapis.com/maps/api/directions/json?${new URLSearchParams(params).toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      return res.status(400).json({
        error: `Google Maps API returned: ${data.status}`,
        message: data.error_message || "Failed to get directions",
      });
    }

    // Get the first (best) route
    const bestRoute = data.routes[0];
    const leg = bestRoute.legs[0];

    const currentDurationSeconds =
      leg.duration_in_traffic?.value || leg.duration.value;
    const normalDurationSeconds = leg.duration.value;

    // Check if we have a baseline, otherwise set it
    if (!route.baselineDuration) {
      await storage.updateFavoriteRoute(routeId, {
        baselineDuration: normalDurationSeconds,
      });
      return res.status(200).json({
        message: "Baseline duration set",
        baselineDuration: normalDurationSeconds,
        alertCreated: false,
      });
    }

    // Calculate delay percentage
    const delaySeconds = currentDurationSeconds - route.baselineDuration;
    const delayPercentage = delaySeconds / route.baselineDuration;

    // Only create alert if traffic is significantly worse
    if (delayPercentage > TRAFFIC_THRESHOLD) {
      const delayMinutes = Math.round(delaySeconds / 60);

      // Create traffic alert
      const alert = await storage.createTrafficAlert({
        routeId: route.id,
        routeName: route.name,
        normalDuration: formatDuration(route.baselineDuration),
        currentDuration: formatDuration(currentDurationSeconds),
        delay: `${delayMinutes} mins longer`,
        routeSummary: bestRoute.summary || "Main route",
      });

      return res.status(200).json({
        alert,
        alertCreated: true,
        currentDuration: currentDurationSeconds,
        baselineDuration: route.baselineDuration,
        delaySeconds,
      });
    }

    return res.status(200).json({
      message: "Traffic is normal",
      alertCreated: false,
      currentDuration: currentDurationSeconds,
      baselineDuration: route.baselineDuration,
      delaySeconds,
    });
  } catch (e: any) {
    console.error("Check traffic error:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal server error" });
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} mins`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hr ${remainingMinutes} mins`;
}