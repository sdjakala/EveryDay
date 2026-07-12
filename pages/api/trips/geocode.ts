import type { NextApiRequest, NextApiResponse } from "next";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address } = req.body;
  if (!address?.trim()) return res.status(400).json({ error: "Address required" });
  if (!GOOGLE_MAPS_API_KEY) return res.status(500).json({ error: "Maps API key not configured" });

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.results?.length) {
      return res.status(400).json({ error: "Could not geocode address" });
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;
    const components: any[] = result.address_components || [];

    const city =
      components.find((c) => c.types.includes("locality"))?.long_name ||
      components.find((c) => c.types.includes("administrative_area_level_3"))?.long_name ||
      components.find((c) => c.types.includes("administrative_area_level_2"))?.long_name ||
      "";
    const country = components.find((c) => c.types.includes("country"))?.long_name || "";

    return res.status(200).json({ lat, lng, city, country, formattedAddress: result.formatted_address });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
}
