import type { NextApiRequest, NextApiResponse } from "next";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("Groq error:", err);
    throw new Error("Groq API request failed");
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { lat, lng, mode, landmark } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  if (!GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY not configured in environment" });

  // Reverse-geocode to a human-readable location name
  let locationName = "";
  try {
    const geoResp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const geoData = await geoResp.json();
    if (geoData.results?.[0]) locationName = geoData.results[0].formatted_address;
  } catch {
    // Non-fatal
  }

  const locationDesc = locationName || `coordinates ${lat}, ${lng}`;

  try {
    if (mode === "spot") {
      const text = await callGroq(
        `I am standing at ${locationDesc}. Tell me the history of this exact location and its immediate surroundings. What events happened here? Who lived, worked, or fought here? What was built here and when? Why does this place matter historically? Write in engaging flowing paragraphs, not bullet points. Be specific and vivid.`,
        1200
      );
      return res.json({ text, location: locationName });
    }

    if (mode === "detail" && landmark) {
      const text = await callGroq(
        `I am near ${locationDesc} and I want to learn about "${landmark}". Give me a rich, detailed history of this specific landmark. Cover its origins and founding, key historical events that took place there, notable people associated with it, architectural or cultural significance, and its importance today. Write in engaging flowing paragraphs. Be thorough and vivid.`,
        1600
      );
      return res.json({ text, location: locationName });
    }

    // Default: nearby landmarks — return structured JSON for clickable cards
    const raw = await callGroq(
      `I am currently at ${locationDesc}. Return a JSON array of the 8 most historically and culturally significant landmarks within approximately 1 kilometer of my location, ranked from most to least historically important. Each object must have exactly these fields:
- "name": the landmark name
- "distance": estimated walking direction and distance (e.g. "~400m north")
- "summary": 2-3 sentences of compelling historical context

Respond with ONLY the raw JSON array, no markdown fences, no explanation.`,
      900
    );

    // Extract JSON array even if the model wraps it in backticks
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(502).json({ error: "Could not parse landmark list from AI response" });
    const items = JSON.parse(jsonMatch[0]);
    return res.json({ items, location: locationName });
  } catch (e: any) {
    return res.status(502).json({ error: e.message || "Request failed" });
  }
}
