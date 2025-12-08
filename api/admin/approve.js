import { approve } from "../auth/allowlist";
import cookie from "cookie";
import jwt from "jsonwebtoken";

function isAdminFromSession(req) {
  try {
    const raw = req.headers.cookie;
    if (!raw) return false;
    const parsed = cookie.parse(raw || "");
    const token = parsed.swa_session;
    if (!token) return false;
    const payload = jwt.verify(token, process.env.SESSION_SECRET || "");
    const payloadAny = /** @type {any} */ (payload);
    const email = (payloadAny && payloadAny.email) || "";
    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return admins.includes(String(email).toLowerCase());
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET;
  const key = req.headers["x-admin-secret"] || req.query.secret;
  const sessionOk = isAdminFromSession(req);
  if (!(secret && key === secret) && !sessionOk) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { email } = req.body || req.query;
  if (!email) {
    res.status(400).json({ error: "Missing email" });
    return;
  }
  await approve(email);
  res.status(200).json({ ok: true });
}
