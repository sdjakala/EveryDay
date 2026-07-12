import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Modal from "../../components/Modal";
import Icon from "../../components/Icon";
import {
  Plane, BedDouble, Target, Bus, Utensils, MapPin,
  Car, Footprints, Bike, Link as LinkIcon, Navigation,
  type LucideProps,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TripLink = { id: string; label: string; url: string };
type TripItemType = "flight" | "hotel" | "activity" | "transport" | "restaurant" | "other";
type TransportMode = "driving" | "transit" | "walking" | "bicycling";

type TripItem = {
  id: string;
  type: TripItemType;
  title: string;
  date: string;
  time?: string;
  endDate?: string;
  endTime?: string;
  address?: string;
  description?: string;
  links: TripLink[];
  confirmationCode?: string;
};

type Trip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  items: TripItem[];
  createdAt: string;
  updatedAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

type IconComponent = React.ComponentType<LucideProps>;

const TYPE_ICON: Record<TripItemType, IconComponent> = {
  flight: Plane,
  hotel: BedDouble,
  activity: Target,
  transport: Bus,
  restaurant: Utensils,
  other: MapPin,
};

const TYPE_LABELS: Record<TripItemType, string> = {
  flight: "Flight",
  hotel: "Hotel",
  activity: "Activity",
  transport: "Transport",
  restaurant: "Restaurant",
  other: "Other",
};

const MODE_ICON: Record<TransportMode, IconComponent> = {
  driving: Car,
  transit: Bus,
  walking: Footprints,
  bicycling: Bike,
};

function sortByDateTime(items: TripItem[]): TripItem[] {
  return [...items].sort((a, b) => {
    const da = `${a.date}T${a.time || "00:00"}`;
    const db = `${b.date}T${b.time || "00:00"}`;
    return da.localeCompare(db);
  });
}

function groupByDay(items: TripItem[]): { date: string; label: string; items: TripItem[] }[] {
  const map = new Map<string, TripItem[]>();
  for (const item of items) {
    const d = item.date || "unknown";
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(item);
  }
  return [...map.entries()].map(([date, items]) => ({
    date,
    label: date === "unknown" ? "No date" : new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric",
    }),
    items,
  }));
}

function formatTime(time?: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateShort(date?: string): string {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildMapsUrl(destination: string, origin: string | null, mode: TransportMode): string {
  const params = new URLSearchParams({ api: "1", destination, travelmode: mode });
  if (origin) params.set("origin", origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function openRoute(destination: string, origin: string | "geo", mode: TransportMode) {
  if (origin === "geo") {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const o = `${pos.coords.latitude},${pos.coords.longitude}`;
          window.open(buildMapsUrl(destination, o, mode), "_blank");
        },
        () => window.open(buildMapsUrl(destination, null, mode), "_blank")
      );
    } else {
      window.open(buildMapsUrl(destination, null, mode), "_blank");
    }
  } else {
    window.open(buildMapsUrl(destination, origin, mode), "_blank");
  }
}

function prevItemWithAddress(sorted: TripItem[], currentId: string): TripItem | null {
  const idx = sorted.findIndex((i) => i.id === currentId);
  for (let j = idx - 1; j >= 0; j--) {
    if (sorted[j].address?.trim()) return sorted[j];
  }
  return null;
}

// ─── Default form values ──────────────────────────────────────────────────────

const defaultItemForm = {
  type: "other" as TripItemType,
  title: "",
  date: "",
  time: "",
  endDate: "",
  endTime: "",
  address: "",
  description: "",
  confirmationCode: "",
  links: [] as TripLink[],
};

const defaultTripForm = { name: "", startDate: "", endDate: "", description: "" };

// ─── Input style ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#eef2f5",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--muted)",
  display: "block",
  marginBottom: 4,
  marginTop: 10,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TripPlannerModule() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TransportMode>("transit");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const [tripModal, setTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState(defaultTripForm);

  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  useEffect(() => { fetchTrips(); }, []);

  async function fetchTrips() {
    try {
      const res = await fetch("/api/trips");
      if (res.ok) {
        const data: Trip[] = await res.json();
        setTrips(data);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch trips", e);
    } finally {
      setLoading(false);
    }
  }

  async function persistTrip(trip: Trip) {
    try {
      await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip),
      });
    } catch (e) {
      console.error("Failed to persist trip", e);
    }
  }

  function openTripModal(trip?: Trip) {
    setEditingTrip(trip || null);
    setTripForm(trip
      ? { name: trip.name, startDate: trip.startDate, endDate: trip.endDate, description: trip.description || "" }
      : defaultTripForm
    );
    setTripModal(true);
  }

  async function saveTrip() {
    if (!tripForm.name.trim()) return;
    if (editingTrip) {
      const updated = { ...editingTrip, ...tripForm, name: tripForm.name.trim() };
      setTrips((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      setTripModal(false);
      await persistTrip(updated);
    } else {
      try {
        const res = await fetch("/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tripForm),
        });
        if (res.ok) {
          const created: Trip = await res.json();
          setTrips((prev) => [created, ...prev]);
          setSelectedId(created.id);
          setTripModal(false);
        }
      } catch (e) {
        console.error("Failed to create trip", e);
      }
    }
  }

  async function deleteTrip(id: string) {
    if (!confirm("Delete this trip and all its items?")) return;
    setTrips((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(trips.find((t) => t.id !== id)?.id ?? null);
    await fetch(`/api/trips/${id}`, { method: "DELETE" });
  }

  function openItemModal(item?: TripItem) {
    setEditingItem(item || null);
    setItemForm(item
      ? { type: item.type, title: item.title, date: item.date, time: item.time || "",
          endDate: item.endDate || "", endTime: item.endTime || "", address: item.address || "",
          description: item.description || "", confirmationCode: item.confirmationCode || "",
          links: item.links || [] }
      : defaultItemForm
    );
    setNewLinkLabel("");
    setNewLinkUrl("");
    setItemModal(true);
  }

  async function saveItem() {
    const trip = trips.find((t) => t.id === selectedId);
    if (!trip || !itemForm.title.trim()) return;

    const itemData: TripItem = {
      id: editingItem?.id || uid(),
      ...itemForm,
      title: itemForm.title.trim(),
    };

    const updatedItems = editingItem
      ? trip.items.map((i) => i.id === itemData.id ? itemData : i)
      : [...trip.items, itemData];

    const updatedTrip = { ...trip, items: updatedItems };
    setTrips((prev) => prev.map((t) => t.id === trip.id ? updatedTrip : t));
    setItemModal(false);
    await persistTrip(updatedTrip);
  }

  async function deleteItem(itemId: string) {
    const trip = trips.find((t) => t.id === selectedId);
    if (!trip) return;
    const updatedTrip = { ...trip, items: trip.items.filter((i) => i.id !== itemId) };
    setTrips((prev) => prev.map((t) => t.id === trip.id ? updatedTrip : t));
    await persistTrip(updatedTrip);
  }

  function addLink() {
    if (!newLinkUrl.trim()) return;
    const link: TripLink = { id: uid(), label: newLinkLabel.trim(), url: newLinkUrl.trim() };
    setItemForm((f) => ({ ...f, links: [...f.links, link] }));
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  function removeLink(linkId: string) {
    setItemForm((f) => ({ ...f, links: f.links.filter((l) => l.id !== linkId) }));
  }

  function toggleExpand(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading) return <div style={{ color: "var(--muted)", padding: 12 }}>Loading trips…</div>;

  const selectedTrip = trips.find((t) => t.id === selectedId) ?? null;
  const sorted = selectedTrip ? sortByDateTime(selectedTrip.items) : [];
  const days = groupByDay(sorted);

  return (
    <div style={{ width: "100%" }}>

      {/* Trip selector bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        {trips.length > 0 && (
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 160, width: "auto" }}
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <button className="workout-create-btn" onClick={() => openTripModal()}>
          <Icon name="plus" size={14} /> New Trip
        </button>
      </div>

      {trips.length === 0 && (
        <div style={{
          textAlign: "center", padding: "2rem 1rem", color: "var(--muted)",
          background: "rgba(255,255,255,0.02)", borderRadius: 12,
          border: "1px dashed rgba(255,255,255,0.08)",
        }}>
          No trips yet. Create one to get started.
        </div>
      )}

      {selectedTrip && (
        <>
          {/* Trip header */}
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 12,
            background: "linear-gradient(135deg, rgba(37,244,238,0.06), rgba(132,86,255,0.06))",
            border: "1px solid rgba(37,244,238,0.15)",
            display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>{selectedTrip.name}</div>
              {(selectedTrip.startDate || selectedTrip.endDate) && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {formatDateShort(selectedTrip.startDate)}
                  {selectedTrip.endDate && ` → ${formatDateShort(selectedTrip.endDate)}`}
                </div>
              )}
              {selectedTrip.description && (
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  {selectedTrip.description}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button className="cal-btn" onClick={() => openTripModal(selectedTrip)} style={{ fontSize: 12 }}>Edit</button>
              <button className="workout-action-btn danger" onClick={() => deleteTrip(selectedTrip.id)} title="Delete trip">×</button>
            </div>
          </div>

          {/* Transport mode toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 2 }}>Mode:</span>
            {(Object.entries(MODE_ICON) as [TransportMode, IconComponent][]).map(([m, ModeIcon]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={m}
                style={{
                  background: mode === m
                    ? "linear-gradient(90deg,var(--accent-start),var(--accent-end))"
                    : "rgba(255,255,255,0.05)",
                  border: "1px solid " + (mode === m ? "transparent" : "rgba(255,255,255,0.08)"),
                  borderRadius: 8, padding: "6px 8px", cursor: "pointer",
                  lineHeight: 0, color: mode === m ? "#071018" : "var(--muted)",
                  display: "flex", alignItems: "center",
                }}
              >
                <ModeIcon size={15} strokeWidth={1.75} />
              </button>
            ))}
          </div>

          {/* Timeline */}
          {days.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "1rem 0" }}>
              No items yet — add your first stop below.
            </div>
          ) : (
            days.map(({ date, label, items: dayItems }) => (
              <div key={date} style={{ marginBottom: 16 }}>
                {/* Day header */}
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--accent-start)", letterSpacing: "0.06em",
                  textTransform: "uppercase", padding: "4px 0 8px", borderBottom: "1px solid rgba(37,244,238,0.15)",
                  marginBottom: 8,
                }}>
                  {label}
                </div>

                {/* Items */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayItems.map((item) => {
                    const expanded = expandedItems.has(item.id);
                    const prev = prevItemWithAddress(sorted, item.id);
                    return (
                      <div key={item.id} style={{
                        borderRadius: 10,
                        background: "linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))",
                        border: "1px solid rgba(255,255,255,0.07)",
                        overflow: "hidden",
                      }}>
                        {/* Item header row — always visible */}
                        <div
                          onClick={() => toggleExpand(item.id)}
                          style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
                        >
                          {(() => { const TIcon = TYPE_ICON[item.type]; return <TIcon size={18} strokeWidth={1.75} style={{ flexShrink: 0, color: "var(--accent-start)", marginTop: 2 }} />; })()}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: "#fff", fontSize: 14 }}>{item.title}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              {TYPE_LABELS[item.type]}
                              {item.time && <> · {formatTime(item.time)}</>}
                              {item.endTime && <> → {formatTime(item.endTime)}</>}
                              {item.endDate && item.endDate !== item.date && <> → {formatDateShort(item.endDate)}</>}
                            </div>
                            {item.address && (
                              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, display: "flex", gap: 4, alignItems: "flex-start" }}>
                                <MapPin size={12} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span style={{ wordBreak: "break-word" }}>{item.address}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <button className="workout-action-btn" title="Edit" onClick={() => openItemModal(item)}>
                              <Icon name="edit" size={12} />
                            </button>
                            <button className="workout-action-btn danger" title="Delete" onClick={() => deleteItem(item.id)}>×</button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {expanded && (
                          <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                            {item.confirmationCode && (
                              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                                <span style={{ color: "rgba(255,255,255,0.5)", marginRight: 4 }}>Conf:</span>
                                <span style={{ fontFamily: "monospace", color: "#fff" }}>{item.confirmationCode}</span>
                              </div>
                            )}

                            {item.description && (
                              <div className="trip-markdown">
                                <ReactMarkdown>{item.description}</ReactMarkdown>
                              </div>
                            )}

                            {item.links.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                                {item.links.map((link) => (
                                  <a
                                    key={link.id}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "inline-flex", alignItems: "center", gap: 5,
                                      padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                                      background: "rgba(37,244,238,0.08)", border: "1px solid rgba(37,244,238,0.2)",
                                      color: "var(--accent-start)", textDecoration: "none",
                                    }}
                                  >
                                    <LinkIcon size={11} strokeWidth={1.75} /> {link.label || "Link"}
                                  </a>
                                ))}
                              </div>
                            )}

                            {item.address && (
                              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {(() => { const ModeIcon = MODE_ICON[mode]; return (
                                  <>
                                    <button
                                      onClick={() => openRoute(item.address!, "geo", mode)}
                                      style={{
                                        padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                                        background: "rgba(132,86,255,0.15)", border: "1px solid rgba(132,86,255,0.35)",
                                        color: "#c4b0ff", display: "flex", alignItems: "center", gap: 5,
                                      }}
                                    >
                                      <ModeIcon size={13} strokeWidth={1.75} />
                                      <Navigation size={12} strokeWidth={1.75} />
                                      From my location
                                    </button>
                                    {prev && (
                                      <button
                                        onClick={() => openRoute(item.address!, prev.address!, mode)}
                                        style={{
                                          padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                                          background: "rgba(37,244,238,0.08)", border: "1px solid rgba(37,244,238,0.2)",
                                          color: "var(--accent-start)", display: "flex", alignItems: "center", gap: 5,
                                        }}
                                      >
                                        <ModeIcon size={13} strokeWidth={1.75} />
                                        From {prev.title}
                                      </button>
                                    )}
                                  </>
                                ); })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <button
            className="workout-create-btn"
            onClick={() => openItemModal()}
            style={{ width: "100%", marginTop: 8 }}
          >
            <Icon name="plus" size={14} /> Add Item
          </button>
        </>
      )}

      {/* ── Trip Modal ─────────────────────────────────────────────────────── */}
      <Modal open={tripModal} onClose={() => setTripModal(false)}>
        <div style={{ padding: 4 }}>
          <h3 style={{ margin: "0 0 12px", color: "#fff" }}>
            {editingTrip ? "Edit Trip" : "New Trip"}
          </h3>

          <label style={labelStyle}>Trip name *</label>
          <input
            style={inputStyle}
            placeholder="e.g. Venice, Italy"
            value={tripForm.name}
            onChange={(e) => setTripForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && saveTrip()}
            autoFocus
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Start date</label>
              <input type="date" style={inputStyle} value={tripForm.startDate}
                onChange={(e) => setTripForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>End date</label>
              <input type="date" style={inputStyle} value={tripForm.endDate}
                onChange={(e) => setTripForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>

          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
            placeholder="Optional notes about the trip"
            value={tripForm.description}
            onChange={(e) => setTripForm((f) => ({ ...f, description: e.target.value }))}
          />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn secondary" onClick={() => setTripModal(false)}>Cancel</button>
            <button className="btn primary" onClick={saveTrip} disabled={!tripForm.name.trim()}>
              {editingTrip ? "Save" : "Create Trip"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Item Modal ─────────────────────────────────────────────────────── */}
      <Modal open={itemModal} onClose={() => setItemModal(false)}>
        <div style={{ padding: 4 }}>
          <h3 style={{ margin: "0 0 12px", color: "#fff" }}>
            {editingItem ? "Edit Item" : "Add Item"}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select
                style={{ ...inputStyle }}
                value={itemForm.type}
                onChange={(e) => setItemForm((f) => ({ ...f, type: e.target.value as TripItemType }))}
              >
                {(Object.keys(TYPE_LABELS) as TripItemType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Title *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Flight to Venice"
                value={itemForm.title}
                onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" style={inputStyle} value={itemForm.date}
                onChange={(e) => setItemForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <input type="time" style={inputStyle} value={itemForm.time}
                onChange={(e) => setItemForm((f) => ({ ...f, time: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>End date</label>
              <input type="date" style={inputStyle} value={itemForm.endDate}
                onChange={(e) => setItemForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>End time</label>
              <input type="time" style={inputStyle} value={itemForm.endTime}
                onChange={(e) => setItemForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          <label style={labelStyle}>Address / location</label>
          <input
            style={inputStyle}
            placeholder="e.g. Marco Polo Airport, Venice, Italy"
            value={itemForm.address}
            onChange={(e) => setItemForm((f) => ({ ...f, address: e.target.value }))}
          />

          <label style={labelStyle}>Confirmation code</label>
          <input
            style={inputStyle}
            placeholder="e.g. XYZ789"
            value={itemForm.confirmationCode}
            onChange={(e) => setItemForm((f) => ({ ...f, confirmationCode: e.target.value }))}
          />

          <label style={labelStyle}>Description / notes <span style={{ fontWeight: 400, opacity: 0.5 }}>(markdown supported)</span></label>
          <textarea
            style={{ ...inputStyle, minHeight: 140, resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
            placeholder={"# Heading\n\n- bullet point\n- another item\n\n**bold**, _italic_, [link text](https://...)"}
            value={itemForm.description}
            onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Links */}
          <label style={labelStyle}>Links (email confirmations, tickets, etc.)</label>
          {itemForm.links.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
              {itemForm.links.map((link) => (
                <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px",
                  background: "rgba(37,244,238,0.06)", borderRadius: 6, border: "1px solid rgba(37,244,238,0.15)" }}>
                  <span style={{ flex: 1, fontSize: 12, color: "var(--accent-start)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                    <LinkIcon size={11} strokeWidth={1.75} style={{ flexShrink: 0 }} /> {link.label || link.url}
                  </span>
                  <button
                    onClick={() => removeLink(link.id)}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              style={{ ...inputStyle, flex: "0 0 120px", width: "auto" }}
              placeholder="Label"
              value={newLinkLabel}
              onChange={(e) => setNewLinkLabel(e.target.value)}
            />
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="https://…"
              value={newLinkUrl}
              onChange={(e) => setNewLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLink()}
            />
            <button
              className="workout-action-btn"
              onClick={addLink}
              disabled={!newLinkUrl.trim()}
              style={{ flexShrink: 0 }}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn secondary" onClick={() => setItemModal(false)}>Cancel</button>
            <button className="btn primary" onClick={saveItem} disabled={!itemForm.title.trim()}>
              {editingItem ? "Save" : "Add Item"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
