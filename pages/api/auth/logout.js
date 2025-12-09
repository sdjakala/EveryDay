import cookie from "cookie";

const COOKIE_NAME = "swa_session";

export default function handler(req, res) {
  // Clear the session cookie
  const cookieStr = cookie.serialize(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 0, // expires immediately
  });
  res.setHeader("Set-Cookie", cookieStr);
  res.writeHead(302, { Location: "/" });
  res.end();
}
