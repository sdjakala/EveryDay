import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import Modal from "../../components/Modal";
import Icon from "../../components/Icon";
import {
  Plane, BedDouble, Target, Bus, Utensils, MapPin,
  Car, Footprints, Bike, Link as LinkIcon, Navigation, ChevronDown, ZoomIn, Expand, X, Phone,
  Mic, MicOff, Languages,
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
  directions?: string;
  links: TripLink[];
  confirmationCode?: string;
  phone?: string;
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



// Returns distance in km between two lat/lng points (Haversine approximation)
function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractUniqueCities(items: TripItem[]): { key: string; city: string; country: string; lat: number; lng: number }[] {
  const seen: { city: string; country: string; lat: number; lng: number }[] = [];
  for (const item of items) {
    if (item.geocodedCity && item.lat != null && item.lng != null) {
      // Treat cities within 20 km as the same location (handles Roma vs Rome etc.)
      const nearby = seen.find((s) => kmBetween(s.lat, s.lng, item.lat!, item.lng!) < 20);
      if (!nearby) {
        seen.push({ city: item.geocodedCity, country: item.geocodedCountry || "", lat: item.lat, lng: item.lng });
      }
    }
  }
  return seen.map((v) => ({ key: `${v.city}::${v.country}`.toLowerCase(), ...v }));
}

// ─── Discover default prompts ─────────────────────────────────────────────────

const DEFAULT_PROMPTS = {
  nearby: `I am currently at {location}. Return a JSON array of the 8 most significant landmarks within approximately 1 kilometer of my location, ranked from most to least important. Each object must have exactly these fields:\n- "name": the landmark name\n- "distance": estimated walking direction and distance (e.g. "~400m north")\n- "summary": 2-3 sentences blending historical background with current-day relevance — what it was, what it is today, and why it still matters\n\nRespond with ONLY the raw JSON array, no markdown fences, no explanation.`,
  spot: `I am standing at {location}. Give me a rich blend of historical context and current-day information about this exact location and its immediate surroundings. Cover what happened here historically, who lived or worked here, when things were built and why they matter — then bring it to the present with what exists here today, what visitors can see or do, any current cultural or practical significance, and useful visitor tips. Weave past and present together naturally in engaging flowing paragraphs. Be specific and vivid.`,
  detail: `I am near {location} and I want to learn about "{landmark}". Give me a rich mix of historical background and current-day facts about this landmark. Cover its origins and founding, key historical events, notable people associated with it, and its architectural or cultural significance — then bring it up to date with what the site is like today, whether it is open to visitors, what you can see there now, current admission or access details if known, and why it still matters. Weave history and present day together in engaging flowing paragraphs. Be thorough and vivid.`,
};

// ─── Default form values ──────────────────────────────────────────────────────

const defaultItemForm = {
  type: "other" as TripItemType,
  title: "",
  date: "",
  time: "",
  endDate: "",
  endTime: "",
  address: "",
  city: "",
  description: "",
  directions: "",
  confirmationCode: "",
  phone: "",
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

type Tab = "itinerary" | "map" | "weather" | "discover" | "translate";

export default function TripPlannerModule() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("itinerary");
  const [mode, setMode] = useState<TransportMode>("transit");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [mapZoomToId, setMapZoomToId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [focusCity, setFocusCity] = useState<string | null>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [tripModal, setTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripForm, setTripForm] = useState(defaultTripForm);

  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [detailItem, setDetailItem] = useState<TripItem | null>(null);

  const [cityWeather, setCityWeather] = useState<CityWeather[]>([]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFetchedFor, setWeatherFetchedFor] = useState<string | null>(null);

  const [discoverText, setDiscoverText] = useState("");
  const [discoverItems, setDiscoverItems] = useState<{ name: string; distance: string; summary: string }[]>([]);
  const [discoverLocation, setDiscoverLocation] = useState("");
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState("");
  const [discoverCoords, setDiscoverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<string | null>(null);
  const [landmarkDetail, setLandmarkDetail] = useState("");
  const [landmarkDetailLoading, setLandmarkDetailLoading] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [customPrompts, setCustomPrompts] = useState(() => {
    try {
      const saved = localStorage.getItem("discover_prompts");
      return saved ? { ...DEFAULT_PROMPTS, ...JSON.parse(saved) } : { ...DEFAULT_PROMPTS };
    } catch { return { ...DEFAULT_PROMPTS }; }
  });

  const [translateText, setTranslateText] = useState("");
  const [translateResult, setTranslateResult] = useState("");
  const [translatePhonetic, setTranslatePhonetic] = useState("");
  const [translateLanguage, setTranslateLanguage] = useState("Italian");
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  // Ref on the sticky map+filter block; measured bottom drives the items list height.
  const rootRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const [listTop, setListTop] = useState(434);

  useEffect(() => { fetchTrips(); }, []);

  // Lock body scroll on the map tab so the page cannot scroll at all —
  // only the items list scrolls internally.
  // Also toggle a class on the .module-card parent to hide its title/description.
  useEffect(() => {
    const card = rootRef.current?.closest(".module-card") as HTMLElement | null;
    card?.classList.add("header-hidden");
    if (tab !== "map") {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      card?.classList.remove("header-hidden");
    };
  }, [tab]);

  // Measure the sticky map panel bottom after every render so the items list
  // height fills exactly the remaining viewport. No dep array means it always
  // re-measures after city filter pills appear (they load after trip data).
  // The functional setState comparison prevents infinite re-render loops.
  useEffect(() => {
    if (tab !== "map" || !mapPanelRef.current) return;
    const el = mapPanelRef.current;
    const id = requestAnimationFrame(() => {
      const bottom = Math.round(el.getBoundingClientRect().bottom);
      setListTop(prev => (prev === bottom ? prev : bottom));
    });
    return () => cancelAnimationFrame(id);
  });

  // Track online/offline state and SW messages
  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline()  { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    function handleSWMessage(e: MessageEvent) {
      if (e.data?.type === "PENDING_COUNT") setPendingSync(e.data.count);
      if (e.data?.type === "TRIPS_SYNCED") {
        setPendingSync(0);
        setJustSynced(true);
        fetchTrips(); // refresh with authoritative server data
        setTimeout(() => setJustSynced(false), 3000);
      }
    }
    navigator.serviceWorker?.addEventListener("message", handleSWMessage);

    // Ask SW for current pending count on mount
    navigator.serviceWorker?.controller?.postMessage({ type: "GET_PENDING_COUNT" });

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleSWMessage);
    };
  }, []);

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

  async function fetchDiscover(mode: "nearby" | "spot") {
    if (!navigator.geolocation) {
      setDiscoverError("Geolocation is not supported by your browser.");
      return;
    }
    setDiscoverLoading(true);
    setDiscoverError("");
    setDiscoverText("");
    setDiscoverItems([]);
    setDiscoverLocation("");
    setSelectedLandmark(null);
    setLandmarkDetail("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          setDiscoverCoords({ lat: latitude, lng: longitude });
          const resp = await fetch("/api/trips/discover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: latitude, lng: longitude, mode, prompts: customPrompts }),
          });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || "Request failed");
          setDiscoverLocation(data.location || "");
          if (mode === "nearby") {
            setDiscoverItems(data.items || []);
          } else {
            setDiscoverText(data.text || "");
          }
        } catch (e: any) {
          setDiscoverError(e.message || "Failed to fetch discover data.");
        } finally {
          setDiscoverLoading(false);
        }
      },
      (err) => {
        setDiscoverError("Could not get your location: " + err.message);
        setDiscoverLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function fetchLandmarkDetail(name: string) {
    if (!discoverCoords) return;
    setSelectedLandmark(name);
    setLandmarkDetail("");
    setLandmarkDetailLoading(true);
    try {
      const { lat, lng } = discoverCoords;
      const resp = await fetch("/api/trips/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, mode: "detail", landmark: name, prompts: customPrompts }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Request failed");
      setLandmarkDetail(data.text || "");
    } catch (e: any) {
      setLandmarkDetail("Failed to load details: " + e.message);
    } finally {
      setLandmarkDetailLoading(false);
    }
  }

  async function doTranslate() {
    if (!translateText.trim()) return;
    setTranslateLoading(true);
    setTranslateError("");
    setTranslateResult("");
    setTranslatePhonetic("");
    try {
      const resp = await fetch("/api/trips/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: translateText.trim(), language: translateLanguage }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Translation failed");
      setTranslateResult(data.translation || "");
      setTranslatePhonetic(data.phonetic || "");
    } catch (e: any) {
      setTranslateError(e.message || "Translation failed");
    } finally {
      setTranslateLoading(false);
    }
  }

  function startRecording() {
    setTranslateError("");
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setTranslateError("Speech recognition is not supported in this browser. Please type your text instead.");
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let started = false;

    recognition.onresult = (event: any) => {
      const transcript = (Array.from(event.results) as any[])
        .map((r) => r[0].transcript)
        .join("");
      setTranslateText(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (e: any) => {
      setIsRecording(false);
      const friendly: Record<string, string> = {
        "not-allowed":          "Microphone access denied. Please allow microphone permission in your browser settings and try again.",
        "network":              "Speech recognition needs Google's servers and couldn't reach them. Check your connection or type your text instead.",
        "no-speech":            "No speech detected. Please try again.",
        "audio-capture":        "Could not access the microphone. Check that it is connected and not in use by another app.",
        "service-not-available":"Speech recognition service is unavailable. Please type your text instead.",
      };
      // "aborted" that fires before the user manually stops = the browser silently
      // refused to start (common on iOS / when permission was previously denied).
      const isFailedStart = e.error === "aborted" && !started;
      if (isFailedStart) {
        setTranslateError("Microphone could not start. Check that microphone permission is allowed for this site.");
      } else if (e.error !== "aborted") {
        setTranslateError(friendly[e.error] ?? ("Microphone error: " + e.error));
      }
    };

    try {
      recognition.start();
      started = true;
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (e: any) {
      setTranslateError("Could not start microphone: " + (e.message || e));
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setIsRecording(false);
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
    setItemModal(true);
  }

  function handleSaveItem(itemData: TripItem) {
    const trip = trips.find((t) => t.id === selectedId);
    if (!trip) return;
    const updatedItems = editingItem
      ? trip.items.map((i) => i.id === itemData.id ? itemData : i)
      : [...trip.items, itemData];
    const updatedTrip = { ...trip, items: updatedItems };
    setTrips((prev) => prev.map((t) => t.id === trip.id ? updatedTrip : t));
    setWeatherFetchedFor(null);
    setItemModal(false);
    persistTrip(updatedTrip);
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Delete this item?")) return;
    const trip = trips.find((t) => t.id === selectedId);
    if (!trip) return;
    const updatedTrip = { ...trip, items: trip.items.filter((i) => i.id !== itemId) };
    setTrips((prev) => prev.map((t) => t.id === trip.id ? updatedTrip : t));
    setWeatherFetchedFor(null);
    await persistTrip(updatedTrip);
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
    setMapZoomToId(null);
    setFocusDate(null);
    setFocusCity(null);
    setEditMode(false);
  }

  // ── Derived data (all hooks before any early return) ─────────────────────────
  const selectedTrip = trips.find((t) => t.id === selectedId) ?? null;

  const sorted = useMemo(
    () => selectedTrip ? sortByDateTime(selectedTrip.items) : [],
    [selectedTrip]
  );

  const days = useMemo(() => groupByDay(sorted), [sorted]);

  const mapMarkers = useMemo(
    () => sorted.filter((i) => i.lat != null && i.lng != null).map((i) => ({
      id: i.id, lat: i.lat!, lng: i.lng!, title: i.title, type: i.type,
    })),
    [sorted]
  );

  const uniqueMapCities = useMemo(() => Array.from(
    sorted
      .filter((i) => i.geocodedCity)
      .reduce<Map<string, { city: string; count: number }>>((acc, i) => {
        const key = i.geocodedCity!.toLowerCase();
        const existing = acc.get(key);
        if (existing) existing.count++;
        else acc.set(key, { city: i.geocodedCity!, count: 1 });
        return acc;
      }, new Map())
      .values()
  ), [sorted]);

  const mapTabItems = useMemo(
    () => focusCity
      ? sorted.filter((i) => i.geocodedCity?.toLowerCase() === focusCity.toLowerCase())
      : sorted,
    [sorted, focusCity]
  );

  const itemsByDate = useMemo(
    () => mapTabItems.reduce<Map<string, TripItem[]>>((acc, item) => {
      const key = item.date || "";
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(item);
      return acc;
    }, new Map()),
    [mapTabItems]
  );

  // Stable reference — only changes when filter values or trip items change,
  // preventing TripMap's focusIds effect from firing on every render.
  const focusIds = useMemo(() => {
    if (!focusDate && !focusCity) return null;
    return sorted.filter((i) => {
      const dateMatch = !focusDate || i.date === focusDate;
      const cityMatch = !focusCity || i.geocodedCity?.toLowerCase() === focusCity.toLowerCase();
      return i.lat != null && dateMatch && cityMatch;
    }).map((i) => i.id);
  }, [focusDate, focusCity, sorted]);

  if (loading) return <div style={{ color: "var(--muted)", padding: 12 }}>Loading trips…</div>;

  return (
    <div ref={rootRef} style={{ width: "100%" }}>

      {/* ── Offline / sync status banner ───────────────────────────────────── */}
      {(!isOnline || pendingSync > 0 || justSynced) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderRadius: 8, marginBottom: 10, fontSize: 12,
          background: justSynced
            ? "rgba(37,244,238,0.08)"
            : (!isOnline ? "rgba(255,180,0,0.08)" : "rgba(132,86,255,0.08)"),
          border: `1px solid ${justSynced ? "rgba(37,244,238,0.25)" : (!isOnline ? "rgba(255,180,0,0.25)" : "rgba(132,86,255,0.25)")}`,
          color: justSynced ? "var(--accent-start)" : (!isOnline ? "#ffb400" : "#c4b0ff"),
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "currentColor" }} />
          {justSynced && "Changes synced"}
          {!justSynced && !isOnline && pendingSync === 0 && "Offline — showing cached data"}
          {!justSynced && !isOnline && pendingSync > 0 && `Offline — ${pendingSync} change${pendingSync > 1 ? "s" : ""} will sync when reconnected`}
          {!justSynced && isOnline  && pendingSync > 0 && "Syncing changes…"}
        </div>
      )}

      {/* ── Collapsible header ─────────────────────────────────────────────── */}
      {!headerCollapsed && (
        <>
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
                {editMode && (
                  <button className="workout-action-btn danger" onClick={() => deleteTrip(selectedTrip.id)} title="Delete trip">×</button>
                )}
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

          {selectedTrip && (selectedTrip.startDate || selectedTrip.description) && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {selectedTrip.startDate && (
                <span>{formatDateShort(selectedTrip.startDate)}{selectedTrip.endDate && ` → ${formatDateShort(selectedTrip.endDate)}`}</span>
              )}
              {selectedTrip.description && <span style={{ opacity: 0.7 }}>{selectedTrip.description}</span>}
            </div>
          )}
        </>
      )}

      {selectedTrip && (
        <>
          {/* ── Tabs — sticky below the global topbar ─────────────────────── */}
          <div style={{
            position: "sticky", top: 48, zIndex: 10,
            margin: "0 -12px", padding: "8px 12px 10px",
            background: "rgba(15,15,16,0.92)", backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", gap: 4, alignItems: "center",
          }}>
            {(["itinerary", "map", "weather", "discover", "translate"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); if (t === "map") setHeaderCollapsed(true); }}
                style={{
                  padding: "5px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", textTransform: "capitalize",
                  background: tab === t
                    ? "linear-gradient(90deg,var(--accent-start),var(--accent-end) 80%,#5c2fd4)"
                    : "rgba(255,255,255,0.05)",
                  border: "none",
                  boxShadow: tab === t ? "none" : "inset 0 0 0 1px rgba(255,255,255,0.08)",
                  color: tab === t ? "#071018" : "var(--muted)",
                }}
              >
                {t}
              </button>
            ))}

            {/* Collapse / expand header toggle */}
            <button
              onClick={() => setHeaderCollapsed((c) => !c)}
              title={headerCollapsed ? "Show trip selector" : "Hide trip selector"}
              style={{
                marginLeft: "auto", background: "none", border: "none",
                color: "var(--muted)", cursor: "pointer", padding: "4px 6px",
                display: "flex", alignItems: "center", borderRadius: 6,
                transition: "color 0.15s",
              }}
            >
              <ChevronDown
                size={14}
                strokeWidth={2}
                style={{ transform: headerCollapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
              />
            </button>
          </div>

          {/* ── Itinerary tab ─────────────────────────────────────────────── */}
          {tab === "itinerary" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <ModeToggle mode={mode} setMode={setMode} />
                <button
                  onClick={() => setEditMode((e) => !e)}
                  style={{
                    fontSize: 12, padding: "5px 10px", borderRadius: 8,
                    border: "none",
                    background: editMode
                      ? "linear-gradient(90deg,var(--accent-start),var(--accent-end) 80%,#5c2fd4)"
                      : "rgba(255,255,255,0.07)",
                    color: editMode ? "#071018" : "var(--muted)",
                    fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {editMode ? "Done" : "Edit"}
                </button>
              </div>

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
                            editMode={editMode}
                            onToggle={() => handleItemClick(item)}
                            onEdit={() => openItemModal(item)}
                            onDelete={() => deleteItem(item.id)}
                            onFullscreen={() => setDetailItem(item)}
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
              {/* Single sticky block: style picker + map + city filter.
                  A ref measures its rendered bottom edge; the items list uses
                  that measurement so it fills exactly the remaining viewport. */}
              <div
                ref={mapPanelRef}
                style={{
                  position: "sticky", top: 94, zIndex: 9,
                  margin: "0 -12px",
                  background: "rgba(15,15,16,0.97)", backdropFilter: "blur(10px)",
                }}
              >
                {/* Style picker */}
                <div style={{ padding: "8px 12px 0" }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 2 }}>Style:</span>
                    {MAP_STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setMapStyle(s.url)}
                        style={{
                          padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: mapStyle === s.url ? "linear-gradient(90deg,var(--accent-start),var(--accent-end) 80%,#5c2fd4)" : "rgba(255,255,255,0.05)",
                          border: "none",
                          boxShadow: mapStyle === s.url ? "none" : "inset 0 0 0 1px rgba(255,255,255,0.08)",
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
                    <div style={{ height: 300, borderRadius: 12, overflow: "hidden" }}>
                      <TripMap items={mapMarkers} highlightedId={highlightedItemId} onMarkerClick={handleMarkerClick} mapStyle={mapStyle} focusIds={focusIds} zoomToId={mapZoomToId} />
                    </div>
                  )}
                </div>

                {/* City filter pills — part of the sticky block so height is measured together */}
                {uniqueMapCities.length > 1 && (
                  <div style={{
                    padding: "6px 12px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <div style={{
                      display: "flex", gap: 5,
                      overflowX: "auto", WebkitOverflowScrolling: "touch" as any,
                      scrollbarWidth: "none",
                    }}>
                      <button
                        onClick={() => { setFocusCity(null); setFocusDate(null); }}
                        style={{
                          flexShrink: 0,
                          padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: !focusCity ? "linear-gradient(90deg,var(--accent-start),var(--accent-end) 80%,#5c2fd4)" : "rgba(255,255,255,0.05)",
                          border: "none",
                          boxShadow: !focusCity ? "none" : "inset 0 0 0 1px rgba(255,255,255,0.1)",
                          color: !focusCity ? "#071018" : "var(--muted)",
                        }}
                      >
                        All
                      </button>
                      {uniqueMapCities.map(({ city, count }) => {
                        const active = focusCity?.toLowerCase() === city.toLowerCase();
                        return (
                          <button
                            key={city}
                            onClick={() => { setFocusCity(active ? null : city); setFocusDate(null); }}
                            style={{
                              flexShrink: 0,
                              padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                              background: active ? "linear-gradient(90deg,var(--accent-start),var(--accent-end) 80%,#5c2fd4)" : "rgba(255,255,255,0.05)",
                              border: "none",
                              boxShadow: active ? "none" : "inset 0 0 0 1px rgba(255,255,255,0.1)",
                              color: active ? "#071018" : "var(--muted)",
                            }}
                          >
                            {city}
                            <span style={{ opacity: 0.65, marginLeft: 4 }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable items — body scroll is locked on the map tab so this
                  div is the only thing that scrolls. Height fills the remaining
                  viewport below the measured map+filter panel. */}
              <div style={{
                height: `calc(100dvh - ${listTop}px - 64px)`,
                overflowY: "auto", WebkitOverflowScrolling: "touch" as any,
                margin: "0 -12px",
                padding: "8px 12px 36px",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {Array.from(itemsByDate.entries()).map(([date, dateItems]) => {
                    const geocodedIds = dateItems.filter((i) => i.lat != null).map((i) => i.id);
                    const isFocused = focusDate === date;
                    const canFocus = geocodedIds.length > 0;
                    return (
                      <React.Fragment key={date}>
                        <div
                          onClick={() => canFocus && setFocusDate(isFocused ? null : date)}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 6px 5px", marginTop: 4,
                            borderBottom: "1px solid " + (isFocused ? "rgba(37,244,238,0.25)" : "rgba(255,255,255,0.07)"),
                            cursor: canFocus ? "pointer" : "default",
                          }}
                        >
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                            color: isFocused ? "var(--accent-start)" : "rgba(255,255,255,0.35)",
                          }}>
                            {formatMapDate(date)}
                          </span>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginLeft: "auto" }}>
                            {dateItems.length} item{dateItems.length !== 1 ? "s" : ""}
                          </span>
                          {canFocus && (
                            <ZoomIn size={11} strokeWidth={2} style={{
                              color: isFocused ? "var(--accent-start)" : "rgba(255,255,255,0.18)", flexShrink: 0,
                            }} />
                          )}
                        </div>

                        {dateItems.map((item) => {
                          const TIcon = TYPE_ICON[item.type];
                          const isHighlighted = highlightedItemId === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                const next = highlightedItemId === item.id ? null : item.id;
                                setHighlightedItemId(next);
                                setMapZoomToId(next);
                              }}
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
              </div>
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
              {!weatherLoading && cityWeather.length > 0 && (
                <WeatherGrid cityWeather={cityWeather} tripItems={selectedTrip?.items ?? []} />
              )}
            </div>
          )}

          {/* ── Discover tab ──────────────────────────────────────────────── */}
          {tab === "translate" && (
            <div style={{ paddingTop: 12 }}>

              {/* Language selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Languages size={14} strokeWidth={1.75} style={{ color: "var(--muted)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>Translate to</span>
                <select
                  value={translateLanguage}
                  onChange={(e) => { setTranslateLanguage(e.target.value); setTranslateResult(""); setTranslatePhonetic(""); }}
                  style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "6px 8px" }}
                >
                  {["Italian", "Spanish", "French", "German", "Portuguese", "Japanese", "Mandarin Chinese", "Greek", "Arabic", "Dutch"].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Text input + mic button */}
              <div style={{ position: "relative", marginBottom: 10 }}>
                <textarea
                  value={translateText}
                  onChange={(e) => setTranslateText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) doTranslate(); }}
                  placeholder="Type what you want to translate, or tap the mic to speak…"
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", minHeight: 90, paddingRight: 48, lineHeight: 1.55 }}
                />
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  onContextMenu={(e) => e.preventDefault()}
                  title={isRecording ? "Stop recording" : "Speak"}
                  style={{
                    position: "absolute", right: 8, top: 8,
                    width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isRecording ? "rgba(255,107,107,0.18)" : "rgba(132,86,255,0.15)",
                    color: isRecording ? "#ff6b6b" : "#8456ff",
                    transition: "background 0.15s, color 0.15s",
                    WebkitUserSelect: "none", userSelect: "none",
                    touchAction: "manipulation",
                  }}
                >
                  {isRecording ? <MicOff size={15} strokeWidth={1.75} /> : <Mic size={15} strokeWidth={1.75} />}
                </button>
                {isRecording && (
                  <div style={{
                    position: "absolute", right: 50, top: 14,
                    fontSize: 11, color: "#ff6b6b", display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff6b6b", display: "inline-block", animation: "pulse 1s ease-in-out infinite" }} />
                    Listening…
                  </div>
                )}
              </div>

              {/* Translate + Clear buttons */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {translateText && (
                  <button
                    onClick={() => { setTranslateText(""); setTranslateResult(""); setTranslatePhonetic(""); setTranslateError(""); }}
                    style={{
                      padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", color: "var(--muted)",
                      flexShrink: 0,
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={doTranslate}
                  disabled={!translateText.trim() || translateLoading}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: "none",
                    cursor: translateText.trim() && !translateLoading ? "pointer" : "default",
                    background: translateText.trim() && !translateLoading
                      ? "linear-gradient(90deg,var(--accent-start),var(--accent-end) 80%,#5c2fd4)"
                      : "rgba(255,255,255,0.05)",
                    color: translateText.trim() && !translateLoading ? "#071018" : "var(--muted)",
                    transition: "background 0.15s",
                  }}
                >
                  {translateLoading ? "Translating…" : `Translate to ${translateLanguage}`}
                </button>
              </div>

              {/* Error */}
              {translateError && (
                <div style={{ fontSize: 12, color: "#ff6b6b", padding: "10px 14px", borderRadius: 8, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", marginBottom: 12 }}>
                  {translateError}
                </div>
              )}

              {/* Loading spinner */}
              {translateLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: 13, padding: "1rem 0" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(132,86,255,0.3)", borderTopColor: "#8456ff", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                  Translating…
                </div>
              )}

              {/* Result cards */}
              {translateResult && !translateLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>English</div>
                    <div style={{ fontSize: 14, color: "#eef2f5", lineHeight: 1.6 }}>{translateText}</div>
                  </div>
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: "linear-gradient(135deg,rgba(132,86,255,0.12),rgba(132,86,255,0.06))", border: "1px solid rgba(132,86,255,0.3)" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#8456ff", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{translateLanguage}</div>
                    <div style={{ fontSize: 14, color: "#eef2f5", lineHeight: 1.6 }}>{translateResult}</div>
                    {translatePhonetic && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(132,86,255,0.2)" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Pronunciation</div>
                        <div style={{ fontSize: 13, color: "#c4b0ff", lineHeight: 1.6, fontStyle: "italic" }}>{translatePhonetic}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!translateResult && !translateLoading && !translateError && (
                <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "2rem 1rem", lineHeight: 1.6 }}>
                  Speak or type a phrase and translate it on the spot.
                </div>
              )}
            </div>
          )}

          {tab === "discover" && (
            <div style={{ paddingTop: 12 }}>

              {/* Detail view */}
              {selectedLandmark && (
                <div>
                  <button
                    onClick={() => { setSelectedLandmark(null); setLandmarkDetail(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: "none", border: "none", color: "var(--muted)",
                      cursor: "pointer", fontSize: 12, padding: "0 0 12px", marginBottom: 4,
                    }}
                  >
                    <ChevronDown size={14} strokeWidth={2} style={{ transform: "rotate(90deg)" }} />
                    Back to landmarks
                  </button>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 4 }}>
                    {selectedLandmark}
                  </div>
                  {discoverLocation && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                      <MapPin size={11} strokeWidth={1.75} /> {discoverLocation}
                    </div>
                  )}
                  {landmarkDetailLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: 13, padding: "1rem 0" }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(132,86,255,0.3)", borderTopColor: "#8456ff", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                      Loading history…
                    </div>
                  )}
                  {landmarkDetail && !landmarkDetailLoading && (
                    <div className="trip-markdown">
                      <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>
                        {landmarkDetail}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* List view */}
              {!selectedLandmark && (
                <>
                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button
                      onClick={() => fetchDiscover("nearby")}
                      disabled={discoverLoading}
                      style={{
                        flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                        cursor: discoverLoading ? "default" : "pointer",
                        background: "linear-gradient(135deg,rgba(132,86,255,0.2),rgba(132,86,255,0.1))",
                        border: "1px solid rgba(132,86,255,0.35)",
                        color: discoverLoading ? "var(--muted)" : "#c4b0ff",
                        display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 5,
                      }}
                    >
                      <MapPin size={18} strokeWidth={1.5} />
                      Nearby Landmarks
                      <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>Ranked by importance</span>
                    </button>
                    <button
                      onClick={() => fetchDiscover("spot")}
                      disabled={discoverLoading}
                      style={{
                        flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                        cursor: discoverLoading ? "default" : "pointer",
                        background: "linear-gradient(135deg,rgba(37,244,238,0.12),rgba(37,244,238,0.06))",
                        border: "1px solid rgba(37,244,238,0.25)",
                        color: discoverLoading ? "var(--muted)" : "var(--accent-start)",
                        display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 5,
                      }}
                    >
                      <Target size={18} strokeWidth={1.5} />
                      Where Am I?
                      <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>History of this spot</span>
                    </button>
                  </div>

                  {/* Prompt editor */}
                  <div style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => setPromptsOpen(o => !o)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 11, color: "var(--muted)", padding: "2px 0",
                      }}
                    >
                      <ChevronDown size={12} strokeWidth={2} style={{ transform: promptsOpen ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                      Customize prompts
                    </button>
                    {promptsOpen && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                        {(["nearby", "spot", "detail"] as const).map((key) => (
                          <div key={key}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                              {key === "nearby" ? "Nearby Landmarks" : key === "spot" ? "Where Am I?" : "Detail View"}
                              {key !== "detail" && <span style={{ fontWeight: 400, opacity: 0.6 }}> — use {"{location}"} for your location</span>}
                              {key === "detail" && <span style={{ fontWeight: 400, opacity: 0.6 }}> — use {"{location}"} and {"{landmark}"}</span>}
                            </div>
                            <textarea
                              value={customPrompts[key]}
                              onChange={(e) => {
                                const updated = { ...customPrompts, [key]: e.target.value };
                                setCustomPrompts(updated);
                                try { localStorage.setItem("discover_prompts", JSON.stringify(updated)); } catch {}
                              }}
                              style={{
                                ...inputStyle,
                                minHeight: 90, resize: "vertical",
                                fontFamily: "monospace", fontSize: 11, lineHeight: 1.5,
                              }}
                            />
                            <button
                              onClick={() => {
                                const updated = { ...customPrompts, [key]: DEFAULT_PROMPTS[key] };
                                setCustomPrompts(updated);
                                try { localStorage.setItem("discover_prompts", JSON.stringify(updated)); } catch {}
                              }}
                              style={{ fontSize: 10, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 0", marginTop: 2 }}
                            >
                              Reset to default
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Loading */}
                  {discoverLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: 13, padding: "1rem 0" }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(132,86,255,0.3)", borderTopColor: "#8456ff", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
                      Getting your location and fetching history…
                    </div>
                  )}

                  {/* Error */}
                  {discoverError && !discoverLoading && (
                    <div style={{ fontSize: 12, color: "#ff6b6b", padding: "10px 14px", borderRadius: 8, background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)" }}>
                      {discoverError}
                    </div>
                  )}

                  {/* Location label */}
                  {(discoverItems.length > 0 || discoverText) && discoverLocation && !discoverLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                      <MapPin size={11} strokeWidth={1.75} /> {discoverLocation}
                    </div>
                  )}

                  {/* Nearby landmark cards */}
                  {discoverItems.length > 0 && !discoverLoading && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {discoverItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => fetchLandmarkDetail(item.name)}
                          style={{
                            width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 10,
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                            cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(132,86,255,0.08)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{item.name}</span>
                            <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0, paddingTop: 2 }}>{item.distance}</span>
                          </div>
                          <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{item.summary}</span>
                          <span style={{ fontSize: 11, color: "#8456ff", marginTop: 2 }}>Tap for full history →</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Spot mode text result */}
                  {discoverText && !discoverLoading && (
                    <div className="trip-markdown">
                      <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>
                        {discoverText}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Empty state */}
                  {!discoverItems.length && !discoverText && !discoverLoading && !discoverError && (
                    <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "2rem 1rem", lineHeight: 1.6 }}>
                      Tap a button above to discover the history around you.
                    </div>
                  )}
                </>
              )}
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
      <ItemFormModal
        open={itemModal}
        editingItem={editingItem}
        onClose={() => setItemModal(false)}
        onSave={handleSaveItem}
      />

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          sorted={sorted}
          mode={mode}
          onClose={() => setDetailItem(null)}
          onEdit={() => { setDetailItem(null); openItemModal(detailItem); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── ItemFormModal ─────────────────────────────────────────────────────────────
// Owns all form state so keystrokes never re-render the parent module.

type ItemFormModalProps = {
  open: boolean;
  editingItem: TripItem | null;
  onClose: () => void;
  onSave: (item: TripItem) => void;
};

function ItemFormModal({ open, editingItem, onClose, onSave }: ItemFormModalProps) {
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // Initialise / reset form whenever the modal opens or the target item changes
  useEffect(() => {
    if (!open) return;
    setItemForm(
      editingItem
        ? { type: editingItem.type, title: editingItem.title, date: editingItem.date,
            time: editingItem.time || "", endDate: editingItem.endDate || "",
            endTime: editingItem.endTime || "", address: editingItem.address || "",
            city: editingItem.geocodedCity || "",
            description: editingItem.description || "",
            directions: editingItem.directions || "",
            confirmationCode: editingItem.confirmationCode || "",
            phone: editingItem.phone || "",
            links: editingItem.links || [] }
        : defaultItemForm
    );
    setNewLinkLabel("");
    setNewLinkUrl("");
  }, [open, editingItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleSave() {
    if (!itemForm.title.trim()) return;

    let geoData: { lat?: number; lng?: number; geocodedCity?: string; geocodedCountry?: string } = {};
    const addressChanged = itemForm.address.trim() !== (editingItem?.address || "").trim();
    const missingCoords = !!itemForm.address.trim() && editingItem?.lat == null;

    if (itemForm.address.trim() && (addressChanged || missingCoords) && navigator.onLine) {
      setGeocoding(true);
      try {
        const res = await fetch("/api/trips/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: itemForm.address.trim() }),
        });
        if (res.ok) {
          const geo = await res.json();
          // Use geocoded city only if the user hasn't set one manually
          const resolvedCity = itemForm.city.trim() || geo.city;
          geoData = { lat: geo.lat, lng: geo.lng, geocodedCity: resolvedCity, geocodedCountry: geo.country };
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      } finally {
        setGeocoding(false);
      }
    } else if (!itemForm.address.trim()) {
      geoData = { lat: undefined, lng: undefined, geocodedCity: itemForm.city.trim() || undefined, geocodedCountry: undefined };
    } else if (editingItem) {
      geoData = { lat: editingItem.lat, lng: editingItem.lng, geocodedCity: itemForm.city.trim() || editingItem.geocodedCity, geocodedCountry: editingItem.geocodedCountry };
    }

    onSave({
      id: editingItem?.id || uid(),
      ...itemForm,
      ...geoData,
      title: itemForm.title.trim(),
    });
  }

  return (
    <Modal open={open} onClose={onClose}>
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
        <input style={inputStyle} placeholder="e.g. Marco Polo Airport, Venice, Italy"
          value={itemForm.address}
          onChange={(e) => setItemForm((f) => ({ ...f, address: e.target.value }))} />

        <label style={labelStyle}>
          City
          <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 6 }}>— auto-filled from address, or set manually</span>
        </label>
        <input style={inputStyle} placeholder="e.g. Rome"
          value={itemForm.city}
          onChange={(e) => setItemForm((f) => ({ ...f, city: e.target.value }))} />

        <label style={labelStyle}>Confirmation code</label>
        <input style={inputStyle} placeholder="e.g. XYZ789"
          value={itemForm.confirmationCode}
          onChange={(e) => setItemForm((f) => ({ ...f, confirmationCode: e.target.value }))} />

        <label style={labelStyle}>Phone number</label>
        <input style={inputStyle} placeholder="e.g. +39 06 1234 5678" type="tel"
          value={itemForm.phone}
          onChange={(e) => setItemForm((f) => ({ ...f, phone: e.target.value }))} />

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

        <label style={labelStyle}>
          Directions
          <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 6 }}>(markdown supported)</span>
        </label>
        <textarea
          style={{ ...inputStyle, minHeight: 120, resize: "vertical", fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}
          placeholder={"Step-by-step directions, transit notes, etc.\n\n- Take vaporetto line 1 from Piazzale Roma\n- Exit at San Marco"}
          value={itemForm.directions}
          onChange={(e) => setItemForm((f) => ({ ...f, directions: e.target.value }))}
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
          <input style={{ ...inputStyle, flex: "0 0 120px", width: "auto" }}
            placeholder="Label" value={newLinkLabel}
            onChange={(e) => setNewLinkLabel(e.target.value)} />
          <input style={{ ...inputStyle, flex: 1 }}
            placeholder="https://…" value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLink()} />
          <button className="workout-action-btn" onClick={addLink} disabled={!newLinkUrl.trim()} style={{ flexShrink: 0 }}>
            <Icon name="plus" size={14} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={!itemForm.title.trim() || geocoding}>
            {geocoding ? "Geocoding…" : editingItem ? "Save" : "Add Item"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

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
          background: mode === m ? "linear-gradient(90deg,var(--accent-start),var(--accent-end) 80%,#5c2fd4)" : "rgba(255,255,255,0.05)",
          border: "none",
          boxShadow: mode === m ? "none" : "inset 0 0 0 1px rgba(255,255,255,0.08)",
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
  editMode: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFullscreen: () => void;
};

function ItemCard({ item, expanded, highlighted, sorted, mode, editMode, onToggle, onEdit, onDelete, onFullscreen }: ItemCardProps) {
  const TIcon = TYPE_ICON[item.type];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const [inlineTab, setInlineTab] = useState<"notes" | "directions">("notes");
  const otherItemsWithAddress = sorted.filter((i) => i.id !== item.id && !!i.address?.trim());
  const hasBoth = !!(item.description && item.directions);

  function togglePicker() {
    if (!pickerOpen && pickerBtnRef.current) {
      const rect = pickerBtnRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 248 - 8);
      setPickerPos(
        rect.top > 150
          ? { bottom: window.innerHeight - rect.top + 4, left }
          : { top: rect.bottom + 4, left }
      );
    }
    setPickerOpen((p) => !p);
  }

  useEffect(() => {
    if (!pickerOpen || !pickerBtnRef.current) return;
    function reposition() {
      if (!pickerBtnRef.current) return;
      const rect = pickerBtnRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 248 - 8);
      setPickerPos(
        rect.top > 150
          ? { bottom: window.innerHeight - rect.top + 4, left }
          : { top: rect.bottom + 4, left }
      );
    }
    window.addEventListener("scroll", reposition, true);
    return () => window.removeEventListener("scroll", reposition, true);
  }, [pickerOpen]);

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
          <button className="workout-action-btn" title="View full details" onClick={onFullscreen}><Expand size={12} strokeWidth={1.75} /></button>
          <button className="workout-action-btn" title="Edit" onClick={onEdit}><Icon name="edit" size={12} /></button>
          {editMode && <button className="workout-action-btn danger" title="Delete" onClick={onDelete}>×</button>}
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

          {item.phone && (
            <div style={{ marginTop: 8 }}>
              <a href={`tel:${item.phone.replace(/\s/g, "")}`} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: "rgba(37,244,238,0.08)", border: "1px solid rgba(37,244,238,0.2)",
                color: "var(--accent-start)", textDecoration: "none",
              }}>
                <Phone size={11} strokeWidth={1.75} /> {item.phone}
              </a>
            </div>
          )}

          {(item.description || item.directions) && (
            <div>
              {hasBoth && (
                <div style={{ display: "flex", gap: 4, marginTop: 8, marginBottom: 6 }}>
                  {(["notes", "directions"] as const).map((t) => (
                    <button key={t} onClick={() => setInlineTab(t)} style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                      border: "none",
                      background: inlineTab === t ? "rgba(37,244,238,0.15)" : "rgba(255,255,255,0.05)",
                      color: inlineTab === t ? "var(--accent-start)" : "var(--muted)",
                      fontWeight: inlineTab === t ? 700 : 400,
                    }}>
                      {t === "notes" ? "Notes" : "Directions"}
                    </button>
                  ))}
                </div>
              )}
              <div className="trip-markdown">
                <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>
                  {hasBoth
                    ? (inlineTab === "notes" ? item.description! : item.directions!)
                    : (item.description || item.directions)!}
                </ReactMarkdown>
              </div>
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
                    <div>
                      <button
                        ref={pickerBtnRef}
                        onClick={togglePicker}
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

                      {pickerOpen && pickerPos && createPortal(
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setPickerOpen(false)} />
                          <div style={{
                            position: "fixed", ...pickerPos,
                            width: 248,
                            background: "rgba(10,14,20,0.97)", backdropFilter: "blur(8px)",
                            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                            zIndex: 9999, maxHeight: 220, overflowY: "auto",
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
                                    onClick={() => { openRoute(item.address!, other.address!, mode); setPickerOpen(false); }}
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
                        </>,
                        document.body
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

function WeatherGrid({ cityWeather, tripItems }: { cityWeather: CityWeather[]; tripItems: TripItem[] }) {
  const allDates = Array.from(
    new Set(cityWeather.flatMap((cw) => cw.daily.map((d) => d.date)))
  ).sort();

  const forecastByCity = new Map(
    cityWeather.map((cw) => [cw.city.toLowerCase(), new Map(cw.daily.map((d) => [d.date, d]))])
  );
  const tripDatesByCity = new Map(
    cityWeather.map((cw) => [
      cw.city.toLowerCase(),
      new Set(
        tripItems
          .filter((i) => i.geocodedCity?.toLowerCase() === cw.city.toLowerCase())
          .map((i) => i.date)
          .filter(Boolean) as string[]
      ),
    ])
  );

  const CITY_COL = 110;
  const DAY_COL  = 62;
  // Fixed row heights keep the two panels aligned without JS measurement
  const HDR_H    = 32;
  const ROW_H    = 90;
  const ROW_GAP  = 6;

  const rowBorder = "1px solid rgba(37,244,238,0.13)";
  const rowBg     = "rgba(255,255,255,0.025)";

  return (
    <div style={{ display: "flex", paddingTop: 12 }} className="trip-weather-scroll">

      {/* ── Left: city label column (outside scroll, always visible) ────── */}
      <div style={{
        flexShrink: 0, width: CITY_COL,
        display: "flex", flexDirection: "column", gap: ROW_GAP,
      }}>
        {/* Spacer matching the date-header row height */}
        <div style={{ height: HDR_H, flexShrink: 0 }} />

        {cityWeather.map((cw) => (
          <div key={cw.city} style={{
            height: ROW_H, flexShrink: 0, boxSizing: "border-box",
            background: "#0d1b26",
            border: rowBorder, borderRight: "none",
            padding: "8px 10px",
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {cw.city}
            </div>
            {cw.currentTemp != null && (
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--accent-start)", lineHeight: 1.1, marginTop: 2 }}>
                {Math.round(cw.currentTemp)}°
                <span style={{ fontSize: 10, fontWeight: 400, color: "var(--muted)", marginLeft: 4 }}>now</span>
              </div>
            )}
            {cw.currentCondition && (
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {cw.currentCondition}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Right: horizontally scrollable day columns ───────────────────── */}
      <div style={{ flex: 1, minWidth: 0, overflowX: "auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${allDates.length}, ${DAY_COL}px)`,
          rowGap: ROW_GAP,
        }}>

          {/* Date headers */}
          {allDates.map((date) => {
            const d = new Date(date + "T12:00:00");
            return (
              <div key={date} style={{
                height: HDR_H, boxSizing: "border-box",
                textAlign: "center", paddingBottom: 4,
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em" }}>
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
            );
          })}

          {/* City day cells */}
          {cityWeather.map((cw) => {
            const key    = cw.city.toLowerCase();
            const fcMap  = forecastByCity.get(key)!;
            const tDates = tripDatesByCity.get(key)!;
            const n      = allDates.length;
            return allDates.map((date, i) => {
              const day      = fcMap.get(date);
              const hasEvent = tDates.has(date);
              const isLast   = i === n - 1;
              return (
                <div key={`${cw.city}-${date}`} style={{
                  height: ROW_H, boxSizing: "border-box",
                  textAlign: "center", padding: "6px 2px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: hasEvent ? "rgba(37,244,238,0.07)" : rowBg,
                  borderTop: rowBorder, borderBottom: rowBorder,
                  borderRight: isLast ? rowBorder : "none",
                  borderLeft: "1px solid rgba(255,255,255,0.05)",
                }}>
                  {day ? (
                    <>
                      {day.icon && (
                        <img src={day.icon} alt={day.condition}
                          style={{ width: 28, height: 28, marginBottom: 2 }} />
                      )}
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
                        {day.high != null ? `${Math.round(day.high)}°` : "–"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        {day.low != null ? `${Math.round(day.low)}°` : "–"}
                      </div>
                      {day.precipProbability > 0 && (
                        <div style={{ fontSize: 9, color: "rgba(37,244,238,0.7)", marginTop: 1 }}>
                          {day.precipProbability}%
                        </div>
                      )}
                      {hasEvent && (
                        <div style={{
                          width: 4, height: 4, borderRadius: "50%",
                          background: "var(--accent-start)",
                          marginTop: 3,
                          boxShadow: "0 0 5px rgba(37,244,238,0.8)",
                        }} />
                      )}
                    </>
                  ) : (
                    <div style={{ color: "rgba(255,255,255,0.1)", fontSize: 18 }}>·</div>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Item Detail Modal ────────────────────────────────────────────────────────

type ItemDetailModalProps = {
  item: TripItem;
  sorted: TripItem[];
  mode: TransportMode;
  onClose: () => void;
  onEdit: () => void;
};

function ItemDetailModal({ item, sorted, mode, onClose, onEdit }: ItemDetailModalProps) {
  const TIcon = TYPE_ICON[item.type];
  const ModeIcon = MODE_ICON[mode];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const [detailTab, setDetailTab] = useState<"notes" | "directions">("notes");
  const otherItemsWithAddress = sorted.filter((i) => i.id !== item.id && !!i.address?.trim());
  const hasBoth = !!(item.description && item.directions);

  function togglePicker() {
    if (!pickerOpen && pickerBtnRef.current) {
      const rect = pickerBtnRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 260 - 8);
      setPickerPos(
        rect.top > 150
          ? { bottom: window.innerHeight - rect.top + 4, left }
          : { top: rect.bottom + 4, left }
      );
    }
    setPickerOpen((p) => !p);
  }

  useEffect(() => {
    if (!pickerOpen || !pickerBtnRef.current) return;
    function reposition() {
      if (!pickerBtnRef.current) return;
      const rect = pickerBtnRef.current.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 260 - 8);
      setPickerPos(
        rect.top > 150
          ? { bottom: window.innerHeight - rect.top + 4, left }
          : { top: rect.bottom + 4, left }
      );
    }
    window.addEventListener("scroll", reposition, true);
    return () => window.removeEventListener("scroll", reposition, true);
  }, [pickerOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 80,
        background: "rgba(2,6,12,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px 16px env(safe-area-inset-bottom, 16px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 660,
          maxHeight: "calc(100dvh - 32px)", overflowY: "auto",
          WebkitOverflowScrolling: "touch" as any,
          background: "var(--card)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Sticky header bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky", top: 0, background: "var(--card)", zIndex: 2,
          borderRadius: "16px 16px 0 0",
        }}>
          <TIcon size={18} strokeWidth={1.75} style={{ flexShrink: 0, color: "var(--accent-start)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-start)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {TYPE_LABELS[item.type]}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {formatDateShort(item.date)}
              {item.time && <> · {formatTime(item.time)}</>}
              {item.endTime && <> → {formatTime(item.endTime)}</>}
              {item.endDate && item.endDate !== item.date && <> → {formatDateShort(item.endDate)}</>}
            </div>
          </div>
          <button onClick={onEdit} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 10px", cursor: "pointer",
            color: "var(--muted)", display: "flex", alignItems: "center", gap: 5, fontSize: 12,
          }}>
            <Icon name="edit" size={13} /> Edit
          </button>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)", padding: 4, lineHeight: 0, borderRadius: 6,
          }}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 20px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Title */}
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
            {item.title}
          </div>

          {/* Address */}
          {item.address && (
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <MapPin size={14} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2, color: "var(--muted)" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>{item.address}</span>
            </div>
          )}

          {/* Confirmation code */}
          {item.confirmationCode && (
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "10px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Confirmation
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 15, color: "#fff", letterSpacing: "0.04em" }}>
                {item.confirmationCode}
              </div>
            </div>
          )}

          {item.phone && (
            <a href={`tel:${item.phone.replace(/\s/g, "")}`} style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: "rgba(37,244,238,0.08)", border: "1px solid rgba(37,244,238,0.2)",
              color: "var(--accent-start)", textDecoration: "none",
            }}>
              <Phone size={14} strokeWidth={1.75} /> {item.phone}
            </a>
          )}

          {/* Notes / Directions */}
          {(item.description || item.directions) && (
            <div>
              {hasBoth ? (
                <div style={{ display: "flex", gap: 6, marginBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
                  {(["notes", "directions"] as const).map((t) => (
                    <button key={t} onClick={() => setDetailTab(t)} style={{
                      fontSize: 12, padding: "6px 14px", borderRadius: "8px 8px 0 0",
                      cursor: "pointer", border: "none",
                      background: detailTab === t ? "rgba(37,244,238,0.1)" : "transparent",
                      color: detailTab === t ? "var(--accent-start)" : "var(--muted)",
                      fontWeight: detailTab === t ? 700 : 400,
                      borderBottom: detailTab === t ? "2px solid var(--accent-start)" : "2px solid transparent",
                      marginBottom: -1,
                    }}>
                      {t === "notes" ? "Notes" : "Directions"}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  {item.description ? "Notes" : "Directions"}
                </div>
              )}
              <div className="trip-markdown trip-markdown-detail">
                <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>
                  {hasBoth
                    ? (detailTab === "notes" ? item.description! : item.directions!)
                    : (item.description || item.directions)!}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Links */}
          {item.links.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Links
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {item.links.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                    background: "rgba(37,244,238,0.08)", border: "1px solid rgba(37,244,238,0.2)",
                    color: "var(--accent-start)", textDecoration: "none",
                  }}>
                    <LinkIcon size={12} strokeWidth={1.75} /> {link.label || "Link"}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Directions */}
          {item.address && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Directions
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <button onClick={() => openRoute(item.address!, "geo", mode)} style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                  background: "rgba(132,86,255,0.15)", border: "1px solid rgba(132,86,255,0.35)",
                  color: "#c4b0ff", display: "flex", alignItems: "center", gap: 6,
                }}>
                  <ModeIcon size={14} strokeWidth={1.75} />
                  <Navigation size={13} strokeWidth={1.75} />
                  From my location
                </button>
                <div>
                  <button ref={pickerBtnRef} onClick={togglePicker} style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    background: pickerOpen ? "rgba(37,244,238,0.15)" : "rgba(37,244,238,0.08)",
                    border: "1px solid rgba(37,244,238,0.2)",
                    color: "var(--accent-start)", display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <ModeIcon size={14} strokeWidth={1.75} />
                    From item
                    <ChevronDown size={13} strokeWidth={2} style={{ transform: pickerOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                  </button>
                  {pickerOpen && pickerPos && createPortal(
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setPickerOpen(false)} />
                      <div style={{
                        position: "fixed", ...pickerPos,
                        width: 260,
                        background: "rgba(10,14,20,0.97)", backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
                        zIndex: 9999, maxHeight: 240, overflowY: "auto",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                      }}>
                        {otherItemsWithAddress.length === 0 ? (
                          <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>No other items with addresses</div>
                        ) : otherItemsWithAddress.map((other) => {
                          const OtherIcon = TYPE_ICON[other.type];
                          return (
                            <button key={other.id} onClick={() => { openRoute(item.address!, other.address!, mode); setPickerOpen(false); }}
                              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "9px 14px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", color: "#eef2f5", fontSize: 13 }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(37,244,238,0.07)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <OtherIcon size={13} strokeWidth={1.75} style={{ flexShrink: 0, color: "rgba(255,255,255,0.45)" }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{other.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
