import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "";

function base64UrlEncode(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signState(obj) {
  const payload = Buffer.from(JSON.stringify(obj));
  const encoded = base64UrlEncode(payload);
  if (!SESSION_SECRET) return encoded; // unsigned fallback for dev
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest();
  const sigEnc = base64UrlEncode(sig);
  return `${encoded}.${sigEnc}`;
}

export default function handler(req, res) {
  const { redirectTo } = req.query;
  const stateObj = {
    nonce: crypto.randomBytes(8).toString("hex"),
    redirectTo: redirectTo || "/",
    iat: Date.now(),
  };
  const state = signState(stateObj);

  const baseUrl =
    process.env.BASE_URL ||
    `${req.headers["x-forwarded-proto"] || req.protocol || "https"}://${req.headers.host}`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${baseUrl}/api/auth/callback`,
    response_type: "code",
    scope:
      "openid email profile https://www.googleapis.com/auth/calendar.readonly",
    state,
    access_type: "offline",
    prompt: "consent", // Changed from "select_account" to always get refresh token
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.writeHead(302, { Location: url });
  res.end();
}
