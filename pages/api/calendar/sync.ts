import { NextApiRequest, NextApiResponse } from "next";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import cosmos from "../../../lib/storage/cosmos";

const SESSION_SECRET = process.env.SESSION_SECRET || "";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Helper to get user email from session
function getUserFromRequest(req: NextApiRequest): string | null {
  try {
    const raw = req.headers.cookie || "";
    const parsed = cookie.parse(raw);
    const token = parsed["swa_session"];
    if (!token) return null;

    const payload = jwt.verify(token, SESSION_SECRET) as any;
    return payload.email || null;
  } catch (e) {
    return null;
  }
}

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return null;
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (e) {
    console.error("Token refresh error:", e);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get user email from session
    const userEmail = getUserFromRequest(req);
    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get stored OAuth tokens
    const tokens = await cosmos.getUserTokens(userEmail);
    if (!tokens || !tokens.accessToken) {
      return res.status(404).json({
        error: "No Google Calendar access",
        message: "Please sign out and sign in again to grant calendar access",
      });
    }

    let accessToken = tokens.accessToken;

    // Check if token is expired and refresh if needed
    if (tokens.expiresAt && Date.now() >= tokens.expiresAt) {
      if (!tokens.refreshToken) {
        return res.status(401).json({
          error: "Token expired",
          message: "Please sign out and sign in again",
        });
      }

      const refreshed = await refreshAccessToken(tokens.refreshToken);
      if (!refreshed) {
        return res.status(401).json({
          error: "Token refresh failed",
          message: "Please sign out and sign in again",
        });
      }

      accessToken = refreshed.access_token;
      // Save the new access token
      await cosmos.saveUserTokens(
        userEmail,
        refreshed.access_token,
        tokens.refreshToken,
        refreshed.expires_in
      );
    }

    // Get query parameters for date range
    const { timeMin, timeMax, maxResults = "50" } = req.query;

    // Fetch calendar events from Google Calendar API
    const params = new URLSearchParams({
      maxResults: maxResults as string,
      singleEvents: "true",
      orderBy: "startTime",
    });

    if (timeMin) params.append("timeMin", timeMin as string);
    if (timeMax) params.append("timeMax", timeMax as string);

    // First, get list of all calendars to fetch events from
    let calendarMap: Record<string, { name: string; color: string }> = {};
    let calendarIds: string[] = ["primary"];
    try {
      const calendarListResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (calendarListResponse.ok) {
        const calendarListData = await calendarListResponse.json();
        // Get IDs of all calendars that are visible (not hidden)
        const visibleCals = (calendarListData.items || []).filter(
          (cal: any) => cal.accessRole !== "freeBusyReader"
        );
        calendarIds = visibleCals.map((cal: any) => cal.id);
        
        // Build map of calendar ID -> name and color
        visibleCals.forEach((cal: any) => {
          calendarMap[cal.id] = {
            name: cal.summary || cal.id,
            color: cal.backgroundColor || "#4285F4", // Google Calendar blue as default
          };
        });
        
        console.log("Found calendars:", calendarMap);
      }
    } catch (e) {
      console.warn("Failed to fetch calendar list, using primary only:", e);
    }

    // Fetch events from all calendars
    const allEvents: any[] = [];
    for (const calendarId of calendarIds) {
      try {
        const calendarResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          const itemsWithCal = (calendarData.items || []).map((item: any) => ({
            ...item,
            _calendarId: calendarId,
          }));
          allEvents.push(...itemsWithCal);
        }
      } catch (e) {
        console.warn(`Failed to fetch events from calendar ${calendarId}:`, e);
      }
    }

    // Transform Google Calendar events to our format
    const events = (allEvents || []).map((event: any) => ({
      id: event.id,
      title: event.summary || "(No title)",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location,
      description: event.description,
      htmlLink: event.htmlLink,
      calendarId: event._calendarId,
      calendarName: calendarMap[event._calendarId]?.name || event._calendarId,
      color: calendarMap[event._calendarId]?.color || "#4285F4",
    }));

    return res.status(200).json({ events });
  } catch (e: any) {
    console.error("Calendar sync error:", e);
    return res.status(500).json({
      error: e?.message || "Internal server error",
    });
  }
}