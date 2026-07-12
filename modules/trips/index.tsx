import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import Modal from "../../components/Modal";
import Icon from "../../components/Icon";
import {
  Plane, BedDouble, Target, Bus, Utensils, MapPin,
  Car, Footprints, Bike, Link as LinkIcon, Navigation, ChevronDown, ZoomIn,
  type LucideProps,
} from "lucide-react";

const TripMap = dynamic(() => import("../../components/TripMap"), { ssr: false });

const MAP_STYLES = [
  { id: "dark",    label: "Dark",    url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
  { id: "streets", label: "Streets", url: "https://tiles.openfreemap.org/styles/liberty" },
  { id: "light",   label: "Light",   url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
];

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
  lat?: number;
  lng?: number;
  geocodedCity?: string;
  geocodedCountry?: string;
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

type DailyDay = {
  date: string;
  high: number | null;
  low: number | null;
  condition: string;
  precipProbability: number;
  icon: string;
};

type CityWeather = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  currentTemp: number | null;
  currentCondition: string;
  currentIcon: string;
  daily: DailyDay[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

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
    label: date === "unknown" ? "No date"
      : new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
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

function formatMapDate(date: string): string {
  if (!date) return "Undated";
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
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
        (pos) => { const o = `${pos.coords.latitude},${pos.coords.longitude}`; window.open(buildMapsUrl(destination, o, mode), "_blank"); },
        () => window.open(buildMapsUrl(destination, null, mode), "_blank")
      );
    } else {
      window.open(buildMapsUrl(destination, null, mode), "_blank");
    }
  } else {
    window.open(buildMapsUrl(destination, origin, mode), "_blank");
  }
}



function extractUniqueCities(items: TripItem[]): { key: string; city: string; country: string; lat: number; lng: number }[] {
  const seen = new Map<string, { city: string; country: string; lat: number; lng: number }>();
  for (const item of items) {
    if (item.geocodedCity && item.lat != null && item.lng != null) {
      const key = `${item.geocodedCity}::${item.geocodedCountry || ""}`.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { city: item.geocodedCity, country: item.geocodedCountry || "", lat: item.lat, lng: item.lng });
      }
    }
  }
  return [...seen.entries()].map(([key, v]) => ({ key, ...v }));
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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

type Tab = "itinerary" | "map" | "weather";

export default function TripPlannerModule() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("itinerary");
  const [mode, setMode] = useState<TransportMode>("transit");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const [focusDate, setFocusDate] = useState<string | null>(null);

  const [tripModal, setTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState(defaultTripForm);

  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  const [cityWeather, setCityWeather] = useState<CityWeather[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFetchedFor, setWeatherFetchedFor] = useState<string | null>(null);

  useEffect(() => { fetchTrips(); }, []);

  // Fetch weather when switching to weather tab
  useEffect(() => {
    if (tab !== "weather") return;
    const trip = trips.find((t) => t.id === selectedId);
    if (!trip) return;
    if (weatherFetchedFor === trip.id) return;
    fetchCityWeather(trip);
  }, [tab, selectedId, trips]);

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

  async function fetchCityWeather(trip: Trip) {
    const cities = extractUniqueCities(trip.items);
    if (cities.length === 0) {
      setCityWeather([]);
      setWeatherFetchedFor(trip.id);
      return;
    }
    setWeatherLoading(true);
    try {
      const results = await Promise.all(
        cities.map(async (c) => {
          const [currentRes, dailyRes] = await Promise.all([
            fetch(`/api/weather/current?latitude=${c.lat}&longitude=${c.lng}`),
            fetch(`/api/weather/daily?latitude=${c.lat}&longitude=${c.lng}`),
          ]);
          const currentData = currentRes.ok ? await currentRes.json() : null;
          const dailyData = dailyRes.ok ? await dailyRes.json() : null;
          const cw: CityWeather = {
            city: c.city,
            country: c.country,
            lat: c.lat,
            lng: c.lng,
            currentTemp: currentData?.temperature?.degrees ?? null,
            currentCondition: currentData?.weatherCondition?.description?.text || "",
            currentIcon: currentData?.weatherCondition?.iconBaseUri
              ? `${currentData.weatherCondition.iconBaseUri}.svg` : "",
            daily: dailyData?.forecast || [],
          };
          return cw;
        })
      );
      setCityWeather(results);
      setWeatherFetchedFor(trip.id);
    } catch (e) {
      console.error("Failed to fetch city weather", e);
    } finally {
      setWeatherLoading(false);
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

    let geoData: { lat?: number; lng?: number; geocodedCity?: string; geocodedCountry?: string } = {};

    // Geocode if address changed, is new, or exists but has no coordinates yet
    const addressChanged = itemForm.address.trim() !== (editingItem?.address || "").trim();
    const missingCoords = itemForm.address.trim() && editingItem?.lat == null;
    if (itemForm.address.trim() && (addressChanged || missingCoords)) {
      setGeocoding(true);
      try {
        const res = await fetch("/api/trips/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: itemForm.address.trim() }),
        });
        if (res.ok) {
          const geo = await res.json();
          geoData = { lat: geo.lat, lng: geo.lng, geocodedCity: geo.city, geocodedCountry: geo.country };
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      } finally {
        setGeocoding(false);
      }
    } else if (!itemForm.address.trim()) {
      // Address was cleared — remove geocode data
      geoData = { lat: undefined, lng: undefined, geocodedCity: undefined, geocodedCountry: undefined };
    } else if (editingItem) {
      // Address unchanged — preserve existing geocode
      geoData = { lat: editingItem.lat, lng: editingItem.lng, geocodedCity: editingItem.geocodedCity, geocodedCountry: editingItem.geocodedCountry };
    }

    const itemData: TripItem = {
      id: editingItem?.id || uid(),
      ...itemForm,
      ...geoData,
      title: itemForm.title.trim(),
    };

    const updatedItems = editingItem
      ? trip.items.map((i) => i.id === itemData.id ? itemData : i)
      : [...trip.items, itemData];

    const updatedTrip = { ...trip, items: updatedItems };
    setTrips((prev) => prev.map((t) => t.id === trip.id ? updatedTrip : t));
    setWeatherFetchedFor(null); // invalidate weather cache
    setItemModal(false);
    await persistTrip(updatedTrip);
  }

  async function deleteItem(itemId: string) {
    const trip = trips.find((t) => t.id === selectedId);
    if (!trip) return;
    const updatedTrip = { ...trip, items: trip.items.filter((i) => i.id !== itemId) };
    setTrips((prev) => prev.map((t) => t.id === trip.id ? updatedTrip : t));
    setWeatherFetchedFor(null);
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

  function handleItemClick(item: TripItem) {
    toggleExpand(item.id);
    if (item.lat != null) setHighlightedItemId(item.id);
  }

  const handleMarkerClick = useCallback((id: string) => {
    setHighlightedItemId(id);
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  function selectTrip(id: string) {
    setSelectedId(id);
    setWeatherFetchedFor(null);
    setCityWeather([]);
    setHighlightedItemId(null);
  }

  if (loading) return <div style={{ color: "var(--muted)", padding: 12 }}>Loading trips…</div>;

  const selectedTrip = trips.find((t) => t.id === selectedId) ?? null;
  const sorted = selectedTrip ? sortByDateTime(selectedTrip.items) : [];
  const days = groupByDay(sorted);
  const mapMarkers = sorted.filter((i) => i.lat != null && i.lng != null).map((i) => ({
    id: i.id, lat: i.lat!, lng: i.lng!, title: i.title, type: i.type,
  }));

  // Date-grouped items for map tab list
  const itemsByDate = sorted.reduce<Map<string, TripItem[]>>((acc, item) => {
    const key = item.date || "";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(item);
    return acc;
  }, new Map());

  // IDs of geocoded items on the focused day (null = no focus = fit all)
  const focusIds = focusDate
    ? sorted.filter((i) => i.date === focusDate && i.lat != null).map((i) => i.id)
    : null;

  return (
    <div style={{ width: "100%" }}>

      {/* ── Compact header bar ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        {trips.length > 0 && (
          <select
            value={selectedId || ""}
            onChange={(e) => selectTrip(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 140, width: "auto", fontSize: 13, padding: "6px 8px" }}
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {selectedTrip && (
          <>
            <button className="cal-btn" onClick={() => openTripModal(selectedTrip)} style={{ fontSize: 12, padding: "5px 10px" }}>Edit</button>
            <button className="workout-action-btn danger" onClick={() => deleteTrip(selectedTrip.id)} title="Delete trip">×</button>
          </>
        )}
        <button className="workout-create-btn" onClick={() => openTripModal()} style={{ fontSize: 12, padding: "5px 10px" }}>
          <Icon name="plus" size={13} /> New
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
          {/* Trip date/description strip */}
          {(selectedTrip.startDate || selectedTrip.description) && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {selectedTrip.startDate && (
                <span>{formatDateShort(selectedTrip.startDate)}{selectedTrip.endDate && ` → ${formatDateShort(selectedTrip.endDate)}`}</span>
              )}
              {selectedTrip.description && <span style={{ opacity: 0.7 }}>{selectedTrip.description}</span>}
            </div>
          )}

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {(["itinerary", "map", "weather"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", textTransform: "capitalize",
                  background: tab === t
                    ? "linear-gradient(90deg,var(--accent-start),var(--accent-end))"
                    : "rgba(255,255,255,0.05)",
                  border: "1px solid " + (tab === t ? "transparent" : "rgba(255,255,255,0.08)"),
                  color: tab === t ? "#071018" : "var(--muted)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── Itinerary tab ─────────────────────────────────────────────── */}
          {tab === "itinerary" && (
            <>
              <ModeToggle mode={mode} setMode={setMode} />

              <div style={{ maxHeight: 520, overflowY: "auto", paddingRight: 2 }}>
                {days.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "1.5rem 0" }}>
                    No items yet — add your first stop below.
                  </div>
                ) : (
                  days.map(({ date, label, items: dayItems }) => (
                    <div key={date} style={{ marginBottom: 16 }}>
                      <DayHeader label={label} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {dayItems.map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            expanded={expandedItems.has(item.id)}
                            highlighted={highlightedItemId === item.id}
                            sorted={sorted}
                            mode={mode}
                            onToggle={() => handleItemClick(item)}
                            onEdit={() => openItemModal(item)}
                            onDelete={() => deleteItem(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className="workout-create-btn" onClick={() => openItemModal()} style={{ width: "100%", marginTop: 8 }}>
                <Icon name="plus" size={14} /> Add Item
              </button>
            </>
          )}

          {/* ── Map tab ───────────────────────────────────────────────────── */}
          {tab === "map" && (
            <>
              {/* Map style picker */}
              <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 2 }}>Style:</span>
                {MAP_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setMapStyle(s.url)}
                    style={{
                      padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: mapStyle === s.url ? "linear-gradient(90deg,var(--accent-start),var(--accent-end))" : "rgba(255,255,255,0.05)",
                      border: "1px solid " + (mapStyle === s.url ? "transparent" : "rgba(255,255,255,0.08)"),
                      color: mapStyle === s.url ? "#071018" : "var(--muted)",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {mapMarkers.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>
                  No geocoded locations yet — add addresses to your itinerary items.
                </div>
              ) : (
                <div style={{ height: 320, marginBottom: 12, borderRadius: 12, overflow: "hidden" }}>
                  <TripMap items={mapMarkers} highlightedId={highlightedItemId} onMarkerClick={handleMarkerClick} mapStyle={mapStyle} focusIds={focusIds} />
                </div>
              )}

              <ModeToggle mode={mode} setMode={setMode} compact />

              <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, paddingRight: 2 }}>
                {Array.from(itemsByDate.entries()).map(([date, dateItems]) => {
                  const geocodedIds = dateItems.filter((i) => i.lat != null).map((i) => i.id);
                  const isFocused = focusDate === date;
                  const canFocus = geocodedIds.length > 0;
                  return (
                    <React.Fragment key={date}>
                      {/* Date header */}
                      <div
                        onClick={() => canFocus && setFocusDate(isFocused ? null : date)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "6px 6px 5px",
                          marginTop: 4,
                          borderBottom: "1px solid " + (isFocused ? "rgba(37,244,238,0.25)" : "rgba(255,255,255,0.07)"),
                          cursor: canFocus ? "pointer" : "default",
                        }}
                      >
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: isFocused ? "var(--accent-start)" : "rgba(255,255,255,0.35)",
                        }}>
                          {formatMapDate(date)}
                        </span>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>
                          {dateItems.length} item{dateItems.length !== 1 ? "s" : ""}
                        </span>
                        {canFocus && (
                          <ZoomIn size={11} strokeWidth={2} style={{
                            color: isFocused ? "var(--accent-start)" : "rgba(255,255,255,0.18)",
                            flexShrink: 0,
                          }} />
                        )}
                      </div>

                      {/* Items for this date */}
                      {dateItems.map((item) => {
                        const TIcon = TYPE_ICON[item.type];
                        const isHighlighted = highlightedItemId === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setHighlightedItemId((prev) => prev === item.id ? null : item.id)}
                            style={{
                              display: "flex", gap: 8, alignItems: "center", padding: "8px 10px",
                              borderRadius: 8, cursor: "pointer",
                              background: isHighlighted ? "rgba(37,244,238,0.08)" : "rgba(255,255,255,0.03)",
                              border: "1px solid " + (isHighlighted ? "rgba(37,244,238,0.3)" : "rgba(255,255,255,0.06)"),
                              transition: "all 0.15s",
                            }}
                          >
                            <TIcon size={14} strokeWidth={1.75} style={{ flexShrink: 0, color: isHighlighted ? "var(--accent-start)" : "var(--muted)" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isHighlighted ? "#fff" : "#eef2f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.title}
                              </div>
                              {item.address && (
                                <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.address}
                                </div>
                              )}
                            </div>
                            {item.lat == null && (
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>no coords</span>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>

              <button className="workout-create-btn" onClick={() => openItemModal()} style={{ width: "100%", marginTop: 8 }}>
                <Icon name="plus" size={14} /> Add Item
              </button>
            </>
          )}

          {/* ── Weather tab ───────────────────────────────────────────────── */}
          {tab === "weather" && (
            <div>
              {weatherLoading && (
                <div style={{ color: "var(--muted)", fontSize: 13, padding: "1rem 0" }}>Fetching weather…</div>
              )}
              {!weatherLoading && cityWeather.length === 0 && (
                <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "2rem 0" }}>
                  No cities found. Add addresses to itinerary items to see weather.
                </div>
              )}
              {!weatherLoading && cityWeather.map((cw) => {
                const tripDates = new Set(
                  (selectedTrip?.items ?? [])
                    .filter((i) => i.geocodedCity?.toLowerCase() === cw.city.toLowerCase())
                    .map((i) => i.date)
                    .filter(Boolean)
                );
                return (
                  <CityWeatherCard
                    key={`${cw.city}-${cw.country}`}
                    cw={cw}
                    tripDates={tripDates}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Trip Modal ─────────────────────────────────────────────────────── */}
      <Modal open={tripModal} onClose={() => setTripModal(false)}>
        <div style={{ padding: 4 }}>
          <h3 style={{ margin: "0 0 12px", color: "#fff" }}>{editingTrip ? "Edit Trip" : "New Trip"}</h3>

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
            placeholder="Optional notes"
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
          <h3 style={{ margin: "0 0 12px", color: "#fff" }}>{editingItem ? "Edit Item" : "Add Item"}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={{ ...inputStyle }} value={itemForm.type}
                onChange={(e) => setItemForm((f) => ({ ...f, type: e.target.value as TripItemType }))}>
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

          <label style={labelStyle}>
            Address / location
            <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 6 }}>— geocoded for map & weather</span>
          </label>
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

          <label style={labelStyle}>
            Description / notes
            <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 6 }}>(markdown supported)</span>
          </label>
          <textarea
            style={{ ...inputStyle, minHeight: 140, resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
            placeholder={"# Heading\n\n- bullet point\n\n**bold**, _italic_, [link text](https://...)"}
            value={itemForm.description}
            onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
          />

          <label style={labelStyle}>Links</label>
          {itemForm.links.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
              {itemForm.links.map((link) => (
                <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px",
                  background: "rgba(37,244,238,0.06)", borderRadius: 6, border: "1px solid rgba(37,244,238,0.15)" }}>
                  <span style={{ flex: 1, fontSize: 12, color: "var(--accent-start)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                    <LinkIcon size={11} strokeWidth={1.75} style={{ flexShrink: 0 }} /> {link.label || link.url}
                  </span>
                  <button onClick={() => removeLink(link.id)}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}>×</button>
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
            <button className="workout-action-btn" onClick={addLink} disabled={!newLinkUrl.trim()} style={{ flexShrink: 0 }}>
              <Icon name="plus" size={14} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button className="btn secondary" onClick={() => setItemModal(false)}>Cancel</button>
            <button className="btn primary" onClick={saveItem} disabled={!itemForm.title.trim() || geocoding}>
              {geocoding ? "Geocoding…" : editingItem ? "Save" : "Add Item"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "var(--accent-start)", letterSpacing: "0.06em",
      textTransform: "uppercase", padding: "4px 0 8px",
      borderBottom: "1px solid rgba(37,244,238,0.15)", marginBottom: 8,
    }}>
      {label}
    </div>
  );
}

function ModeToggle({ mode, setMode, compact }: { mode: TransportMode; setMode: (m: TransportMode) => void; compact?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: compact ? 8 : 14, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 2 }}>Mode:</span>
      {(Object.entries(MODE_ICON) as [TransportMode, React.ComponentType<LucideProps>][]).map(([m, ModeIcon]) => (
        <button key={m} onClick={() => setMode(m)} title={m} style={{
          background: mode === m ? "linear-gradient(90deg,var(--accent-start),var(--accent-end))" : "rgba(255,255,255,0.05)",
          border: "1px solid " + (mode === m ? "transparent" : "rgba(255,255,255,0.08)"),
          borderRadius: 8, padding: "5px 7px", cursor: "pointer", lineHeight: 0,
          color: mode === m ? "#071018" : "var(--muted)", display: "flex", alignItems: "center",
        }}>
          <ModeIcon size={14} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
}

type ItemCardProps = {
  item: TripItem;
  expanded: boolean;
  highlighted: boolean;
  sorted: TripItem[];
  mode: TransportMode;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function ItemCard({ item, expanded, highlighted, sorted, mode, onToggle, onEdit, onDelete }: ItemCardProps) {
  const TIcon = TYPE_ICON[item.type];
  const [pickerOpen, setPickerOpen] = useState(false);
  const otherItemsWithAddress = sorted.filter((i) => i.id !== item.id && !!i.address?.trim());

  return (
    <div style={{
      borderRadius: 10,
      background: highlighted
        ? "linear-gradient(180deg,rgba(37,244,238,0.06),rgba(37,244,238,0.02))"
        : "linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))",
      border: "1px solid " + (highlighted ? "rgba(37,244,238,0.25)" : "rgba(255,255,255,0.07)"),
      overflow: "hidden",
      transition: "border-color 0.2s, background 0.2s",
    }}>
      {/* Header row */}
      <div onClick={onToggle} style={{ padding: "10px 12px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <TIcon size={17} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2, color: highlighted ? "var(--accent-start)" : "rgba(255,255,255,0.5)" }} />
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
              <MapPin size={11} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ wordBreak: "break-word" }}>{item.address}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button className="workout-action-btn" title="Edit" onClick={onEdit}><Icon name="edit" size={12} /></button>
          <button className="workout-action-btn danger" title="Delete" onClick={onDelete}>×</button>
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
              <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>
                {item.description}
              </ReactMarkdown>
            </div>
          )}

          {item.links.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {item.links.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: "rgba(37,244,238,0.08)", border: "1px solid rgba(37,244,238,0.2)",
                  color: "var(--accent-start)", textDecoration: "none",
                }}>
                  <LinkIcon size={11} strokeWidth={1.75} /> {link.label || "Link"}
                </a>
              ))}
            </div>
          )}

          {item.address && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
              {(() => {
                const ModeIcon = MODE_ICON[mode];
                return (
                  <>
                    {/* Route from GPS */}
                    <button onClick={() => openRoute(item.address!, "geo", mode)} style={{
                      padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                      background: "rgba(132,86,255,0.15)", border: "1px solid rgba(132,86,255,0.35)",
                      color: "#c4b0ff", display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <ModeIcon size={13} strokeWidth={1.75} />
                      <Navigation size={12} strokeWidth={1.75} />
                      From my location
                    </button>

                    {/* Route from another itinerary item — picker */}
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setPickerOpen((p) => !p)}
                        style={{
                          padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                          background: pickerOpen ? "rgba(37,244,238,0.15)" : "rgba(37,244,238,0.08)",
                          border: "1px solid rgba(37,244,238,0.2)",
                          color: "var(--accent-start)", display: "flex", alignItems: "center", gap: 5,
                        }}
                      >
                        <ModeIcon size={13} strokeWidth={1.75} />
                        From item
                        <ChevronDown size={12} strokeWidth={2} style={{
                          transform: pickerOpen ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                        }} />
                      </button>

                      {pickerOpen && (
                        <div style={{
                          position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                          background: "rgba(10,14,20,0.97)", backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                          zIndex: 30, minWidth: 220, maxHeight: 220, overflowY: "auto",
                          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                        }}>
                          {otherItemsWithAddress.length === 0 ? (
                            <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>
                              No other items with addresses
                            </div>
                          ) : (
                            otherItemsWithAddress.map((other) => {
                              const OtherIcon = TYPE_ICON[other.type];
                              return (
                                <button
                                  key={other.id}
                                  onClick={() => {
                                    openRoute(item.address!, other.address!, mode);
                                    setPickerOpen(false);
                                  }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 9,
                                    width: "100%", textAlign: "left", padding: "9px 14px",
                                    background: "transparent", border: "none",
                                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                                    cursor: "pointer", color: "#eef2f5", fontSize: 12,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(37,244,238,0.07)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <OtherIcon size={13} strokeWidth={1.75} style={{ flexShrink: 0, color: "rgba(255,255,255,0.45)" }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {other.title}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CityWeatherCard({ cw, tripDates }: { cw: CityWeather; tripDates: Set<string> }) {
  return (
    <div style={{
      marginBottom: 14, borderRadius: 12, overflow: "hidden",
      background: "linear-gradient(135deg,rgba(37,244,238,0.05),rgba(132,86,255,0.05))",
      border: "1px solid rgba(37,244,238,0.12)",
    }}>
      {/* City header */}
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{cw.city}</div>
          {cw.country && <div style={{ fontSize: 11, color: "var(--muted)" }}>{cw.country}</div>}
        </div>
        {cw.currentTemp != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{Math.round(cw.currentTemp)}°</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{cw.currentCondition}</div>
          </div>
        )}
      </div>

      {/* Forecast strip — horizontally scrollable */}
      {cw.daily.length > 0 && (
        <div style={{ display: "flex", overflowX: "auto", padding: "10px 8px", gap: 4 }}
             className="trip-weather-scroll"
        >
          {cw.daily.map((day) => {
            const hasEvent = tripDates.has(day.date);
            return (
              <div
                key={day.date}
                style={{
                  textAlign: "center", borderRadius: 8, padding: "6px 4px",
                  flexShrink: 0, width: 62,
                  background: hasEvent ? "rgba(37,244,238,0.1)" : "transparent",
                  border: hasEvent ? "1px solid rgba(37,244,238,0.35)" : "1px solid transparent",
                  position: "relative",
                }}
              >
                {(() => {
                  const d = new Date(day.date + "T12:00:00");
                  return (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, lineHeight: 1.2,
                        color: hasEvent ? "var(--accent-start)" : "var(--muted)",
                        letterSpacing: hasEvent ? "0.03em" : undefined,
                      }}>
                        {d.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div style={{ fontSize: 9, color: hasEvent ? "rgba(37,244,238,0.65)" : "rgba(255,255,255,0.25)", lineHeight: 1.2 }}>
                        {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  );
                })()}
                {day.icon && (
                  <img src={day.icon} alt={day.condition} style={{ width: 28, height: 28, margin: "0 auto 2px", display: "block" }} />
                )}
                <div style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>
                  {day.high != null ? `${Math.round(day.high)}°` : "–"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  {day.low != null ? `${Math.round(day.low)}°` : "–"}
                </div>
                {day.precipProbability > 0 && (
                  <div style={{ fontSize: 10, color: "rgba(37,244,238,0.7)", marginTop: 2 }}>{day.precipProbability}%</div>
                )}
                {hasEvent && (
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "var(--accent-start)",
                    margin: "4px auto 0",
                    boxShadow: "0 0 6px rgba(37,244,238,0.8)",
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
