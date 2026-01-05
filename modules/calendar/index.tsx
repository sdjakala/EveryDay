import React, { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import Modal from "../../components/Modal";

type EventItem = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string; // ISO
  location?: string;
  description?: string;
  source?: "google" | "custom"; // Track event source
  calendarId?: string; // Track which calendar this came from
  calendarName?: string; // Human-readable calendar name
  color?: string; // Hex color code for the calendar
};

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseISO(iso: string): Date {
  // Parse ISO string handling all formats:
  // - Date-only: YYYY-MM-DD (all-day event)
  // - DateTime UTC: YYYY-MM-DDTHH:mm:ssZ
  // - DateTime with timezone: YYYY-MM-DDTHH:mm:ss±HH:mm
  
  const parts = iso.split("T");
  const dateParts = parts[0].split("-");
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);
  
  if (parts.length === 1) {
    // Date-only string (all-day event), create at midnight local time
    return new Date(year, month, day, 0, 0, 0, 0);
  }
  
  // Has time component - use native Date parsing which handles timezone offsets
  return new Date(iso);
}

function eventOccursOnDay(event: EventItem, day: Date): boolean {
  const startDate = parseISO(event.start);
  
  if (!event.end) {
    // Single day event - check if on same day
    return isSameDay(startDate, day);
  }
  
  // Multi-day event: check if day falls between start and end
  const endDate = parseISO(event.end);
  
  // For all-day multi-day events (date-only strings), end is exclusive
  // For timed multi-day events, we still treat end as exclusive (end of that day)
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  
  // Event occurs on this day if:
  // - event starts on or before day end AND
  // - event ends after day start
  return startDate <= dayEnd && endDate > dayStart;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarModule() {
  const [view, setView] = useState<"day" | "week">("day");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Modal state for viewing/editing event details
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [formTime, setFormTime] = useState(() =>
    new Date().toTimeString().slice(0, 5)
  );
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);

  // Fetch both Google Calendar events and custom events
  React.useEffect(() => {
    fetchAllEvents();
  }, []);

  React.useEffect(() => {
    function handleScheduleRecipe(event: any) {
      const { title, date, time } = event.detail;
      
      // Pre-fill the form
      setFormTitle(title);
      setFormDate(date);
      setFormTime(time);
      setEditingEvent(null);
      
      // Open the modal
      setModalOpen(true);
    }

    window.addEventListener("schedule-recipe-event", handleScheduleRecipe);
    
    return () => {
      window.removeEventListener("schedule-recipe-event", handleScheduleRecipe);
    };
  }, []);

  async function fetchAllEvents() {
    try {
      setLoading(true);
      setSyncError(null);

      // Calculate time range for fetching (6 months: 3 months back, 3 months ahead)
      const now = new Date();
      const timeMinDate = new Date(now);
      timeMinDate.setMonth(timeMinDate.getMonth() - 3);
      timeMinDate.setDate(1);
      timeMinDate.setHours(0, 0, 0, 0);

      const timeMaxDate = new Date(now);
      timeMaxDate.setMonth(timeMaxDate.getMonth() + 4);
      timeMaxDate.setDate(0);
      timeMaxDate.setHours(23, 59, 59, 999);

      const timeMin = timeMinDate.toISOString();
      const timeMax = timeMaxDate.toISOString();      

      // Fetch Google Calendar events
      let googleEvents: EventItem[] = [];
      try {
        const googleRes = await fetch(
          `/api/calendar/sync?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=500`
        );

        if (googleRes.ok) {
          const data = await googleRes.json();
          googleEvents = (data.events || []).map((e: any) => ({
            ...e,
            source: "google" as const,
          }));
        } else if (googleRes.status === 404) {
          // No calendar access - not an error, just skip Google events
          console.log("Google Calendar not connected");
        }
      } catch (e) {
        console.warn("Failed to fetch Google Calendar events:", e);
      }

      // Fetch custom events from Cosmos DB
      let customEvents: EventItem[] = [];
      try {
        const customRes = await fetch("/api/calendar/events");
        if (customRes.ok) {
          const data = await customRes.json();
          customEvents = (data.events || []).map((e: any) => ({
            ...e,
            source: "custom" as const,
          }));
        }
      } catch (e) {
        console.error("Failed to fetch custom events:", e);
      }

      // Merge and sort events by start time
      const allEvents = [...googleEvents, ...customEvents].sort((a, b) =>
        a.start.localeCompare(b.start)
      );

      console.log(
        "Loaded events:",
        allEvents.map((e) => ({
          title: e.title,
          start: e.start,
          end: e.end,
        }))
      );

      setEvents(allEvents);
    } catch (e) {
      console.error("Failed to fetch calendar:", e);
      setSyncError("Failed to load calendar events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingEvent(null);
    setFormTitle("");
    setFormLocation("");
    setFormDescription("");
    setFormDate(cursor.toISOString().slice(0, 10));
    setFormTime("09:00");
    setModalOpen(true);
  }

  function viewEvent(ev: EventItem) {
    if (ev.source === "google") {
      // Google events are read-only, just show details
      setEditingEvent(ev);
      setModalOpen(true);
    } else {
      // Custom events can be edited
      const d = new Date(ev.start);
      setEditingEvent(ev);
      setFormTitle(ev.title || "");
      setFormLocation(ev.location || "");
      setFormDescription(ev.description || "");
      setFormDate(d.toISOString().slice(0, 10));
      setFormTime(d.toTimeString().slice(0, 5));
      setModalOpen(true);
    }
  }

  async function saveEvent() {
    const iso = new Date(formDate + "T" + formTime + ":00").toISOString();
    try {
      if (editingEvent && editingEvent.source === "custom") {
        // Update existing custom event
        const res = await fetch(`/api/calendar/events/${editingEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle,
            start: iso,
            location: formLocation,
            description: formDescription,
          }),
        });
        if (res.ok) {
          await fetchAllEvents();
        }
      } else {
        // Create new custom event
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle,
            start: iso,
            location: formLocation,
            description: formDescription,
          }),
        });
        if (res.ok) {
          await fetchAllEvents();
        }
      }
      setModalOpen(false);
    } catch (e) {
      console.error("Failed to save event:", e);
    }
  }

  async function deleteEvent(id: string) {
    try {
      const res = await fetch(`/api/calendar/events/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAllEvents();
      }
      setModalOpen(false);
    } catch (e) {
      console.error("Failed to delete event:", e);
    }
  }

  function gotoToday() {
    setCursor(new Date());
  }

  function prev() {
    setCursor((c) => (view === "day" ? addDays(c, -1) : addDays(c, -7)));
  }

  function next() {
    setCursor((c) => (view === "day" ? addDays(c, 1) : addDays(c, 7)));
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="module-card">
      {syncError && (
        <div
          style={{
            padding: "1rem",
            background: "#fff3cd",
            color: "#856404",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          <strong>⚠️ {syncError}</strong>
        </div>
      )}
      <div className="calendar-toolbar">
        <div className="left">
          <button className="cal-btn" onClick={prev}>
            <Icon name="chev-left" />
          </button>
          <button className="cal-btn" onClick={gotoToday}>
            <Icon name="calendar" />{" "}
            <span style={{ marginLeft: 8 }}>Today</span>
          </button>
          <button className="cal-btn" onClick={next}>
            <Icon name="chev-right" />
          </button>
        </div>

        <div className="center">
          <strong>
            {view === "day"
              ? fmtDate(cursor)
              : `${fmtDate(weekStart)} — ${fmtDate(addDays(weekStart, 6))}`}
          </strong>
        </div>

        <div className="right">
          <button
            className="cal-btn"
            onClick={openAdd}
            title="Add custom event"
          >
            <Icon name="plus" /> Add Event
          </button>
          <button
            className="cal-btn"
            onClick={fetchAllEvents}
            title="Refresh calendar"
          >
            <Icon name="refresh" /> Refresh
          </button>
          <button
            className={`cal-btn ${view === "day" ? "active" : ""}`}
            onClick={() => setView("day")}
          >
            Day
          </button>
          <button
            className={`cal-btn ${view === "week" ? "active" : ""}`}
            onClick={() => setView("week")}
          >
            Week
          </button>
        </div>
      </div>

      {view === "day" ? (
        <div className="calendar-day">
          {events.filter((ev) => eventOccursOnDay(ev, cursor))
            .length === 0 ? (
            <div className="empty">No events for this day.</div>
          ) : (
            <ul className="day-list">
              {events
                .filter((ev) => eventOccursOnDay(ev, cursor))
                .map((ev) => (
                  <li
                    key={ev.id}
                    className="calendar-event"
                    onClick={() => viewEvent(ev)}
                    style={{
                      borderLeftColor: ev.color || "#4285F4",
                      borderLeftWidth: 4,
                      borderLeftStyle: "solid",
                      backgroundColor: ev.color
                        ? `${ev.color}15`
                        : "#4285F415",
                    }}
                  >
                    <div className="time">{fmtTime(ev.start)}</div>
                    <div className="ev-body">
                      <div className="ev-title">{ev.title}</div>
                      {ev.calendarName && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            marginTop: 2,
                          }}
                        >
                          {ev.calendarName}
                        </div>
                      )}
                      {ev.location && (
                        <div className="ev-loc">{ev.location}</div>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="calendar-week">
          <div className="week-grid">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = addDays(weekStart, i);
              const dayEvents = events.filter((ev) =>
                eventOccursOnDay(ev, day)
              );
              return (
                <div className="weekday-col" key={i}>
                  <div
                    className={`weekday-header ${isSameDay(day, new Date()) ? "today" : ""}`}
                  >
                    <div className="wk-name">
                      {day.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                    <div className="wk-date">{day.getDate()}</div>
                  </div>

                  <div className="weekday-body">
                    {dayEvents.length === 0 ? (
                      <div className="no-ev">—</div>
                    ) : (
                      dayEvents.map((ev) => (
                        <div
                          className="week-event"
                          key={ev.id}
                          onClick={() => viewEvent(ev)}
                          style={{
                            backgroundColor: ev.color
                              ? `${ev.color}20`
                              : "#4285F420",
                            borderLeftColor: ev.color || "#4285F4",
                            borderLeftWidth: 3,
                          }}
                        >
                          <div className="we-time">{fmtTime(ev.start)}</div>
                          <div className="we-title">{ev.title}</div>
                          {ev.calendarName && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--muted)",
                                marginTop: 2,
                              }}
                            >
                              {ev.calendarName}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        {editingEvent && editingEvent.source === "google" ? (
          <>
            <h3>{editingEvent.title}</h3>
            <div style={{ marginBottom: "1rem" }}>
              <strong>When:</strong>{" "}
              {new Date(editingEvent.start).toLocaleString()}
              {editingEvent.end &&
                ` - ${new Date(editingEvent.end).toLocaleString()}`}
            </div>
            {editingEvent.location && (
              <div style={{ marginBottom: "1rem" }}>
                <strong>Where:</strong> {editingEvent.location}
              </div>
            )}
            {editingEvent.description && (
              <div style={{ marginBottom: "1rem" }}>
                <strong>Description:</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {editingEvent.description}
                </p>
              </div>
            )}
            {(editingEvent as any).htmlLink && (
              <div style={{ marginBottom: "1rem" }}>
                <a
                  href={(editingEvent as any).htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Calendar →
                </a>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn primary"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>{editingEvent ? "Edit Event" : "Create Event"}</h3>
            <div>
              <label>Title</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                type="text"
              />
            </div>
            <div className="form-row">
              <div style={{ flex: 1 }}>
                <label>Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>
              <div style={{ width: 120 }}>
                <label>Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label>Location</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
              />
            </div>
            <div>
              <label>Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              {editingEvent && (
                <button
                  className="btn secondary"
                  onClick={() => deleteEvent(editingEvent.id)}
                >
                  Delete
                </button>
              )}
              <button className="btn primary" onClick={saveEvent}>
                {editingEvent ? "Save" : "Create"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}