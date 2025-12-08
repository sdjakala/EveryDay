// Using global fetch (Node 18+ runtime)
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import cookie from "cookie";
import { checkAllowlist, createAccessRequest } from "./allowlist";
import crypto from "crypto";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const BASE_URL = process.env.BASE_URL || ""; // e.g. https://<your-app>.azurestaticapps.net
const COOKIE_NAME = "swa_session";

const oauth2Client = new OAuth2Client(CLIENT_ID);

function base64UrlDecode(str) {
  // Convert base64url to base64
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '='
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function verifySignedState(signed) {
  // Accept either unsigned (legacy base64 JSON) or signed 'payload.sig'
  if (!signed) return null;
  const parts = signed.split(".");
  if (parts.length === 1) {
    // unsigned legacy state
    try {
      const payload = JSON.parse(base64UrlDecode(parts[0]).toString("utf8"));
      return { payload, verified: false };
    } catch (e) {
      return null;
    }
  }
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!SESSION_SECRET) {
    // If no session secret, fall back to unsigned parse for dev convenience
    try {
      const payload = JSON.parse(base64UrlDecode(encoded).toString("utf8"));
      return { payload, verified: false };
    } catch (e) {
      return null;
    }
  }
  try {
    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(encoded)
      .digest();
    const sigBuf = base64UrlDecode(sig);
    // Use timing-safe compare
    if (expected.length !== sigBuf.length) return null;
    if (!crypto.timingSafeEqual(expected, sigBuf)) return null;
    const payload = JSON.parse(base64UrlDecode(encoded).toString("utf8"));
    return { payload, verified: true };
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { code, state } = req.query;
    if (!code) {
      res.status(400).send("Missing code");
      return;
    }

    // Exchange code for tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: `${BASE_URL}/api/auth/callback`,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      console.error("Token exchange failed", txt);
      res.status(500).send("Token exchange failed");
      return;
    }
    const tokenJson = await tokenResp.json();
    const { id_token } = tokenJson;
    if (!id_token) {
      res.status(500).send("No id_token returned");
      return;
    }

    // Verify the ID token with Google
    const ticket = await oauth2Client.verifyIdToken({
      idToken: id_token,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload(); // contains email, name, picture, sub

    // OPTIONAL: check allowlist or auto-register
    const email = payload.email;
    const allowed = await checkAllowlist(email);
    if (!allowed) {
      await createAccessRequest(payload);
      res.writeHead(302, { Location: "/access-requested" });
      res.end();
      return;
    }

    // Create session token (signed JWT)
    const sessionPayload = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      iss: "everyday-app",
    };
    const token = jwt.sign(sessionPayload, SESSION_SECRET, { expiresIn: "7d" });

    // Toggle secure flag for local dev (browsers will reject secure cookies on http://localhost)
    const isLocal =
      (BASE_URL && BASE_URL.startsWith("http://localhost")) ||
      process.env.NODE_ENV !== "production";
    const cookieStr = cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: "Lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // decode and verify state to get redirect and enforce nonce/age
    let redirectTo = "/";
    if (state) {
      const verified = verifySignedState(state);
      if (!verified) {
        console.warn("Invalid state signature");
        res.status(400).send("Invalid state");
        return;
      }
      const { payload } = verified;
      // enforce max age (10 minutes)
      const now = Date.now();
      const maxAgeMs = 10 * 60 * 1000;
      if (
        !payload.iat ||
        typeof payload.iat !== "number" ||
        now - payload.iat > maxAgeMs
      ) {
        console.warn("State expired or missing iat");
        res.status(400).send("Invalid or expired state");
        return;
      }
      redirectTo = payload.redirectTo || "/";
    }

    res.setHeader("Set-Cookie", cookieStr);
    res.writeHead(302, { Location: redirectTo });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Authentication failed");
  }
}
