import type { NextApiRequest, NextApiResponse } from "next";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

async function callGroq(prompt: string): Promise<string> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      temperature: 0.2,
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

  const { text, language } = req.body as { text: string; language: string };
  if (!text?.trim()) return res.status(400).json({ error: "text is required" });
  if (!language?.trim()) return res.status(400).json({ error: "language is required" });
  if (!GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY not configured in environment" });

  const prompt = `Translate the following text to ${language}. Return a JSON object with exactly two fields:
- "translation": the translated text
- "phonetic": a phonetic spelling that shows an English speaker how to pronounce the translation (use simple English syllables and stress marks like ALL-CAPS for stressed syllables)

Respond with ONLY the raw JSON object, no markdown fences, no explanation.

Text to translate:\n${text.trim()}`;

  try {
    const raw = await callGroq(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse translation response");
    const parsed = JSON.parse(jsonMatch[0]);
    return res.json({
      translation: (parsed.translation || "").trim(),
      phonetic: (parsed.phonetic || "").trim(),
      language,
    });
  } catch (e: any) {
    return res.status(502).json({ error: e.message || "Translation failed" });
  }
}
