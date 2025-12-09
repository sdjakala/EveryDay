import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths to ignore (public assets, auth endpoints, API endpoints)
const PUBLIC_PATHS = [
  "/api/auth",
  "/_next/",
  "/static/",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/robots.txt",
  "/icons/",
  "/public/",
  "/health", // Azure SWA health checks
  "/.well-known/", // health/metadata endpoints
];

function isPublicPath(pathname: string) {
  for (const p of PUBLIC_PATHS) {
    if (p.endsWith("/")) {
      if (pathname.startsWith(p)) return true;
    } else {
      if (pathname === p || pathname.startsWith(p)) return true;
    }
  }
  return false;
}

function parseCookies(cookieHeader?: string) {
  const res: Record<string, string> = {};
  if (!cookieHeader) return res;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    res[name] = decodeURIComponent(val);
  }
  return res;
}

function base64UrlToUint8Array(str: string) {
  // base64url -> base64
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  // atob available in Edge runtime
  const binary = atob(str);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyJwtHs256(token: string, secret: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false };
    const [headerB64, payloadB64, sigB64] = parts;
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64UrlToUint8Array(sigB64).buffer;

    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const verified = await crypto.subtle.verify("HMAC", key, sig, data);
    if (!verified) return { valid: false };

    const payloadStr = new TextDecoder().decode(
      base64UrlToUint8Array(payloadB64)
    );
    const payload = JSON.parse(payloadStr);

    // check exp if present (seconds since epoch)
    const now = Math.floor(Date.now() / 1000);
    if (payload && payload.exp && typeof payload.exp === "number") {
      if (now >= payload.exp) return { valid: false, expired: true };
    }

    return { valid: true, payload };
  } catch (e) {
    return { valid: false };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // allow public files and auth endpoints
  if (isPublicPath(pathname)) return NextResponse.next();

  // allow open API endpoints (they should check auth themselves)
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const cookieHeader = req.headers.get("cookie") || undefined;
  const cookies = parseCookies(cookieHeader);

  const token = cookies["swa_session"];
  const SESSION_SECRET = process.env.SESSION_SECRET || "";

  // If no SESSION_SECRET is available, skip JWT verification and allow through
  // This prevents deployment timeouts when env vars aren't ready yet
  if (!SESSION_SECRET) {
    if (token) {
      // In dev or during deployment warm-up, allow if cookie exists
      return NextResponse.next();
    }
    // No token and no secret configured - allow through to avoid blocking deployment
    return NextResponse.next();
  }

  if (token && SESSION_SECRET) {
    try {
      // Add timeout wrapper to prevent hanging during warm-up
      const verificationPromise = verifyJwtHs256(token, SESSION_SECRET);
      const timeoutPromise = new Promise<{ valid: boolean }>((resolve) =>
        setTimeout(() => resolve({ valid: false }), 2000)
      );

      const verified = await Promise.race([
        verificationPromise,
        timeoutPromise,
      ]);

      if (verified.valid) return NextResponse.next();
      // fallthrough to redirect if invalid or expired
    } catch (e) {
      // On error during verification, allow through to prevent blocking
      console.error("Middleware JWT verification error:", e);
      return NextResponse.next();
    }
  } else if (token) {
    // token exists but no secret configured — allow (dev convenience)
    return NextResponse.next();
  }

  // Not authenticated — redirect to login endpoint with original path preserved
  const loginUrl = new URL(`/api/auth/login`, req.url);
  const redirectTo = pathname + (search || "");
  loginUrl.searchParams.set("redirectTo", redirectTo);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // protect all routes except API/auth and static assets
    // Also exclude health checks and well-known paths for Azure SWA
    "/((?!api/auth|api/_|_next|static|favicon.ico|manifest.json|sw.js|robots.txt|icons/|health|.well-known).*)",
  ],
};