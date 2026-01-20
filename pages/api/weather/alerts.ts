import type { NextApiRequest, NextApiResponse } from "next";

// Note: Google Weather API doesn't provide alerts, so we'll use NWS (National Weather Service)
// which is free and provides detailed weather alerts for US locations

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

    // First, get the NWS grid point for this location
    const pointUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
    const pointResponse = await fetch(pointUrl, {
      headers: {
        'User-Agent': '(Weather Dashboard App, contact@example.com)',
        'Accept': 'application/geo+json'
      }
    });

    if (!pointResponse.ok) {
      // If NWS doesn't cover this location (outside US), return empty alerts
      if (pointResponse.status === 404) {
        return res.status(200).json({ alerts: [] });
      }
      throw new Error(`NWS API error: ${pointResponse.status}`);
    }

    const pointData = await pointResponse.json();
    
    // Get the county zone for alerts
    const county = pointData.properties.county;
    if (!county) {
      return res.status(200).json({ alerts: [] });
    }

    // Extract the zone ID from the county URL
    const zoneId = county.split('/').pop();

    // Get active alerts for this zone
    const alertsUrl = `https://api.weather.gov/alerts/active/zone/${zoneId}`;
    const alertsResponse = await fetch(alertsUrl, {
      headers: {
        'User-Agent': '(Weather Dashboard App, contact@example.com)',
        'Accept': 'application/geo+json'
      }
    });

    if (!alertsResponse.ok) {
      return res.status(200).json({ alerts: [] });
    }

    const alertsData = await alertsResponse.json();

    // Transform alerts to simpler format
    const alerts = (alertsData.features || []).map((feature: any) => ({
      event: feature.properties.event,
      severity: feature.properties.severity,
      headline: feature.properties.headline,
      description: feature.properties.description,
      instruction: feature.properties.instruction,
      onset: feature.properties.onset,
      expires: feature.properties.expires
    }));

    return res.status(200).json({ alerts });
  } catch (e: any) {
    console.error("Weather alerts API error:", e);
    // Return empty alerts on error rather than failing
    return res.status(200).json({ alerts: [] });
  }
}