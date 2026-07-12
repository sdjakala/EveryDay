import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Navigation } from "lucide-react";

export type TripMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: string;
};

type Props = {
  items: TripMarker[];
  highlightedId: string | null;
  onMarkerClick?: (id: string) => void;
  mapStyle?: string;
  focusIds?: string[] | null;
};

const TYPE_COLORS: Record<string, string> = {
  flight:     "#7c6bff",
  hotel:      "#ff7eb3",
  activity:   "#ffb347",
  transport:  "#4da9ff",
  restaurant: "#ff6b6b",
  other:      "#a0aab4",
};

const EXTRUSION_LAYER_ID = "trip-3d-buildings";

export default function TripMap({
  items,
  highlightedId,
  onMarkerClick,
  mapStyle = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  focusIds,
}: Props) {
  const wrapperRef    = useRef<HTMLDivElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const markersRef    = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const clickPopupRef    = useRef<maplibregl.Popup | null>(null);
  const prevFocusIdsRef  = useRef<string[] | null | undefined>(undefined);
  const [locating, setLocating]   = useState(false);
  const [locError, setLocError]   = useState<string | null>(null);
  const [is3D, setIs3D]           = useState(false);

  // ── Initialise map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [12.3, 45.4],
      zoom: 3,
      pitch: 0,
      maxPitch: 60,
      attributionControl: false,
    });

    // Zoom +/− and compass (compass doubles as pitch-reset on click)
    mapRef.current.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      "top-right"
    );

    // Full-screen — fullscreen the wrapper so overlay buttons survive
    if (wrapperRef.current) {
      mapRef.current.addControl(
        new maplibregl.FullscreenControl({ container: wrapperRef.current }),
        "top-left"
      );
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Swap basemap style ────────────────────────────────────────────────────
  // setStyle() wipes custom layers, so reset 3D state and re-apply after load
  useEffect(() => {
    if (!mapRef.current) return;
    setIs3D(false);
    mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    mapRef.current.setStyle(mapStyle);
  }, [mapStyle]);

  // ── Rebuild markers on data / highlight change ────────────────────────────
  useEffect(() => {
    const build = () => {
      if (!mapRef.current) return;

      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();

      const bounds = new maplibregl.LngLatBounds();
      let hasPoints = false;

      items.forEach((item) => {
        const hl    = item.id === highlightedId;
        const color = TYPE_COLORS[item.type] ?? TYPE_COLORS.other;
        const size  = hl ? 26 : 20;

        const el = document.createElement("div");
        el.style.cssText = `width:${size}px; height:${size}px; cursor:pointer;`;

        const inner = document.createElement("div");
        if (hl) {
          inner.style.cssText = `
            width:100%; height:100%;
            background:#25f4ee;
            border:3px solid #fff;
            border-radius:50%;
            box-shadow:0 0 0 4px rgba(37,244,238,0.3),0 0 20px rgba(37,244,238,0.8),0 2px 8px rgba(0,0,0,0.6);
            transition:transform 0.15s;
          `;
        } else {
          inner.style.cssText = `
            width:100%; height:100%;
            background:${color};
            border:2.5px solid rgba(255,255,255,0.9);
            border-radius:50%;
            box-shadow:0 2px 8px rgba(0,0,0,0.55),0 0 6px ${color}66;
            transition:transform 0.15s;
          `;
          el.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.3)"; });
          el.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)"; });
        }
        el.appendChild(inner);

        if (onMarkerClick) {
          el.addEventListener("click", (e) => { e.stopPropagation(); onMarkerClick(item.id); });
        }

        const popup = new maplibregl.Popup({
          offset: 16, closeButton: false, closeOnClick: false, className: "trip-map-popup",
        }).setHTML(`<span style="color:#fff;font-size:12px;font-weight:600;white-space:nowrap">${item.title}</span>`);

        el.addEventListener("mouseenter", () => popup.addTo(mapRef.current!));
        el.addEventListener("mouseleave", () => popup.remove());

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([item.lng, item.lat])
          .addTo(mapRef.current!);

        markersRef.current.set(item.id, { marker, el });
        bounds.extend([item.lng, item.lat]);
        hasPoints = true;
      });

      if (hasPoints && !highlightedId) {
        mapRef.current.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 800 });
      }
    };

    if (mapRef.current?.isStyleLoaded()) build();
    else mapRef.current?.once("load", build);
  }, [items, highlightedId, onMarkerClick]);

  // ── Fly to highlighted item ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !highlightedId) return;
    const item = items.find((i) => i.id === highlightedId);
    if (!item) return;
    const fly = () => mapRef.current?.flyTo({ center: [item.lng, item.lat], zoom: 14, duration: 700 });
    if (mapRef.current.isStyleLoaded()) fly();
    else mapRef.current.once("load", fly);
  }, [highlightedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zoom to focused day ───────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevFocusIdsRef.current;
    prevFocusIdsRef.current = focusIds;

    if (!mapRef.current) return;
    if (prev === undefined) return; // skip initial mount

    // Determine which items to fit
    const toFit =
      focusIds && focusIds.length > 0
        ? items.filter((i) => focusIds.includes(i.id))
        : items; // focusIds cleared → reset to all

    if (toFit.length === 0) return;

    const fit = () => {
      if (toFit.length === 1) {
        mapRef.current?.flyTo({ center: [toFit[0].lng, toFit[0].lat], zoom: 14, duration: 700 });
      } else {
        const b = new maplibregl.LngLatBounds();
        toFit.forEach((i) => b.extend([i.lng, i.lat]));
        mapRef.current?.fitBounds(b, { padding: 70, maxZoom: 14, duration: 700 });
      }
    };

    if (mapRef.current.isStyleLoaded()) fit();
    else mapRef.current.once("load", fit);
  }, [focusIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click popup (shows when item is highlighted) ──────────────────────────
  useEffect(() => {
    clickPopupRef.current?.remove();
    clickPopupRef.current = null;

    if (!highlightedId || !mapRef.current) return;
    const item = items.find((i) => i.id === highlightedId);
    if (!item) return;

    const color = TYPE_COLORS[item.type] ?? TYPE_COLORS.other;
    const label = item.type.charAt(0).toUpperCase() + item.type.slice(1);

    const show = () => {
      clickPopupRef.current?.remove();
      clickPopupRef.current = new maplibregl.Popup({
        offset: 18,
        closeButton: true,
        closeOnClick: false,
        className: "trip-map-popup trip-map-click-popup",
        maxWidth: "260px",
      })
        .setHTML(
          `<div style="display:flex;flex-direction:column;gap:4px;padding:2px 4px 2px 0">` +
          `<span style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.07em">${label}</span>` +
          `<span style="font-size:13px;font-weight:600;color:#eef2f5;line-height:1.3">${item.title}</span>` +
          `</div>`
        )
        .setLngLat([item.lng, item.lat])
        .addTo(mapRef.current!);
    };

    if (mapRef.current.isStyleLoaded()) show();
    else mapRef.current.once("load", show);
  }, [highlightedId, items]);

  // ── 3D toggle ─────────────────────────────────────────────────────────────
  function toggle3D() {
    const map = mapRef.current;
    if (!map) return;

    const next = !is3D;
    setIs3D(next);

    if (next) {
      map.easeTo({ pitch: 50, duration: 600 });
      tryAdd3DBuildings(map);
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      try {
        if (map.getLayer(EXTRUSION_LAYER_ID)) map.removeLayer(EXTRUSION_LAYER_ID);
      } catch (_) {}
    }
  }

  // ── Locate me ─────────────────────────────────────────────────────────────
  function locateMe() {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported by this browser");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        userMarkerRef.current?.remove();
        const el = document.createElement("div");
        el.className = "trip-user-loc-marker";
        userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([coords.longitude, coords.latitude])
          .addTo(map);
        map.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13, duration: 700 });
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === 1 ? "Location permission denied — enable it in browser settings" :
          err.code === 2 ? "Location unavailable" :
          "Location request timed out"
        );
        setTimeout(() => setLocError(null), 4000);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapperRef}
      style={{ position: "relative", width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", background: "#0a0a0a" }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Bottom-left overlay buttons */}
      <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 6, zIndex: 5 }}>
        <button
          onClick={locateMe}
          disabled={locating}
          title="Show my location"
          style={overlayBtn(locating)}
        >
          <Navigation size={13} strokeWidth={1.75} />
          {locating ? "Locating…" : "My location"}
        </button>

        <button
          onClick={toggle3D}
          title={is3D ? "Switch to 2D" : "Switch to 3D"}
          style={overlayBtn(false, is3D)}
        >
          {is3D ? "2D" : "3D"}
        </button>
      </div>

      {locError && (
        <div style={{
          position: "absolute", bottom: 52, left: 12, right: 12,
          background: "rgba(220,60,60,0.88)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,100,100,0.4)", borderRadius: 8,
          padding: "8px 12px", fontSize: 12, color: "#fff",
          zIndex: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}>
          {locError}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function overlayBtn(disabled: boolean, active = false): React.CSSProperties {
  return {
    background: active
      ? "linear-gradient(90deg,var(--accent-start),var(--accent-end))"
      : "rgba(10,14,20,0.85)",
    border: "1px solid " + (active ? "transparent" : "rgba(255,255,255,0.15)"),
    borderRadius: 8,
    padding: "7px 10px",
    cursor: disabled ? "wait" : "pointer",
    color: active ? "#071018" : disabled ? "var(--muted)" : "#eef2f5",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    backdropFilter: "blur(6px)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    opacity: disabled ? 0.6 : 1,
    transition: "opacity 0.15s",
  };
}

function tryAdd3DBuildings(map: maplibregl.Map) {
  try {
    if (map.getLayer(EXTRUSION_LAYER_ID)) return; // already added

    const style   = map.getStyle();
    const layers: any[] = style.layers || [];

    // Find any fill layer that belongs to a building source-layer
    const buildingFill = layers.find(
      (l) => l.type === "fill" && (
        (l["source-layer"] && l["source-layer"].toLowerCase().includes("building")) ||
        l.id.toLowerCase().includes("building")
      )
    );

    if (!buildingFill) {
      console.info("TripMap: no building layer found in style — 3D buildings unavailable");
      return;
    }

    // Insert the extrusion layer just above the building fill layer
    map.addLayer(
      {
        id: EXTRUSION_LAYER_ID,
        type: "fill-extrusion",
        source: buildingFill.source,
        "source-layer": buildingFill["source-layer"],
        minzoom: 13,
        paint: {
          "fill-extrusion-color": [
            "interpolate", ["linear"],
            ["coalesce", ["get", "render_height"], ["get", "height"], 0],
            0,   "#1a2035",
            20,  "#1e2d4a",
            50,  "#1f3460",
            100, "#16295c",
          ],
          "fill-extrusion-height": [
            "coalesce", ["get", "render_height"], ["get", "height"], 5,
          ],
          "fill-extrusion-base": [
            "coalesce", ["get", "render_min_height"], ["get", "min_height"], 0,
          ],
          "fill-extrusion-opacity": 0.8,
        },
      },
      // insert before the first symbol (label) layer so labels stay on top
      layers.find((l) => l.type === "symbol")?.id
    );
  } catch (e) {
    console.warn("TripMap: could not add 3D buildings", e);
  }
}
