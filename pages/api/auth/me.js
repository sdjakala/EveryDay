import cookie from "cookie";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "swa_session";

export default function handler(req, res) {
  try {
    const raw = req.headers.cookie || "";
    const parsed = cookie.parse(raw || "");
    const token = parsed[COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: "No session" });
      return;
    }
    const payload = jwt.verify(token, process.env.SESSION_SECRET || "");
    const email = (payload && payload.email) || "";

    // Check if user is admin
    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = admins.includes(String(email).toLowerCase());

    res.status(200).json({ ok: true, payload, isAdmin });
  } catch (e) {
    res.status(401).json({ error: "Invalid session" });
  }
}
