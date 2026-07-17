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
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { lat, lng, mode, landmark, prompts } = req.body as {
    lat: number;
    lng: number;
    mode: "nearby" | "spot" | "detail";
    landmark?: string;
    prompts?: { nearby?: string; spot?: string; detail?: string };
  };

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
      const defaultPrompt = `I am standing at {location}. Give me a rich blend of historical context and current-day information about this exact location and its immediate surroundings. Cover what happened here historically, who lived or worked here, when things were built and why they matter — then bring it to the present with what exists here today, what visitors can see or do, any current cultural or practical significance, and useful visitor tips. Weave past and present together naturally in engaging flowing paragraphs. Be specific and vivid.`;
      const prompt = (prompts?.spot || defaultPrompt).replace("{location}", locationDesc);
      const text = await callGroq(prompt, 1200);
      return res.json({ text, location: locationName });
    }

    if (mode === "detail" && landmark) {
      const defaultPrompt = `I am near {location} and I want to learn about "{landmark}". Give me a rich mix of historical background and current-day facts about this landmark. Cover its origins and founding, key historical events, notable people associated with it, and its architectural or cultural significance — then bring it up to date with what the site is like today, whether it is open to visitors, what you can see there now, current admission or access details if known, and why it still matters. Weave history and present day together in engaging flowing paragraphs. Be thorough and vivid.`;
      const prompt = (prompts?.detail || defaultPrompt)
        .replace("{location}", locationDesc)
        .replace("{landmark}", landmark as string);
      const text = await callGroq(prompt, 1600);
      return res.json({ text, location: locationName });
    }

    // Nearby landmarks — return structured JSON for clickable cards
    const defaultPrompt = `I am currently at {location}. Return a JSON array of the 8 most significant landmarks within approximately 1 kilometer of my location, ranked from most to least important. Each object must have exactly these fields:\n- "name": the landmark name\n- "distance": estimated walking direction and distance (e.g. "~400m north")\n- "summary": 2-3 sentences blending historical background with current-day relevance — what it was, what it is today, and why it still matters\n\nRespond with ONLY the raw JSON array, no markdown fences, no explanation.`;
    const prompt = (prompts?.nearby || defaultPrompt).replace("{location}", locationDesc);
    const raw = await callGroq(prompt, 900);

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(502).json({ error: "Could not parse landmark list from AI response" });
    const items = JSON.parse(jsonMatch[0]);
    return res.json({ items, location: locationName });
  } catch (e: any) {
    return res.status(502).json({ error: e.message || "Request failed" });
  }
}
