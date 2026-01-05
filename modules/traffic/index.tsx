import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type Route = {
  summary: string;
  distance: string;
  duration: string;
  durationInTraffic: string;
  polyline: string;
};

type RouteEstimate = {
  origin: string;
  destination: string;
  routes: Route[];
  timestamp: string;
};

type SavedLocation = {
  id: string;
  name: string;
  address: string;
};

type FavoriteRoute = {
  id: string;
  name: string;
  originId: string;
  originAddress: string;
  destinationId: string;
  destinationAddress: string;
  departureTime?: string;
  arrivalTime?: string;
  notifyOnTraffic?: boolean;
  baselineDuration?: number;
};

type TrafficAlert = {
  id: string;
  routeId: string;
  routeName: string;
  normalDuration: string;
  currentDuration: string;
  delay: string;
  routeSummary: string;
  timestamp: string;
  dismissed?: boolean;
};

export default function TrafficModule() {
  const [activeTab, setActiveTab] = useState<"routes" | "favorites" | "alerts">(
    "routes"
  );
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [trafficAlerts, setTrafficAlerts] = useState<TrafficAlert[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<string>("");
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const [departureTime, setDepartureTime] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [useArrivalTime, setUseArrivalTime] = useState(false);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocationManager, setShowLocationManager] = useState(false);

  useEffect(() => {
    fetchLocations();
    fetchFavoriteRoutes();
    fetchTrafficAlerts();
  }, []);

  async function fetchLocations() {
    try {
      const res = await fetch("/api/traffic/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
        if (data.locations.length >= 2) {
          setSelectedOrigin(data.locations[0].id);
          setSelectedDestination(data.locations[1].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch locations:", e);
    }
  }

  async function fetchFavoriteRoutes() {
    try {
      const res = await fetch("/api/traffic/favorites");
      if (res.ok) {
        const data = await res.json();
        setFavoriteRoutes(data.routes || []);
      }
    } catch (e) {
      console.error("Failed to fetch favorite routes:", e);
    }
  }

  async function fetchTrafficAlerts() {
    try {
      const res = await fetch("/api/traffic/alerts");
      if (res.ok) {
        const data = await res.json();
        setTrafficAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error("Failed to fetch traffic alerts:", e);
    }
  }

  async function fetchRoutes() {
    if (!selectedOrigin || !selectedDestination) {
      setError("Please select both origin and destination");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const origin = locations.find((l) => l.id === selectedOrigin);
      const destination = locations.find((l) => l.id === selectedDestination);

      if (!origin || !destination) {
        setError("Invalid origin or destination");
        return;
      }

      const params = new URLSearchParams({
        origin: origin.address,
        destination: destination.address,
        departureTime: useArrivalTime ? "" : departureTime,
        arrivalTime: useArrivalTime ? departureTime : "",
      });

      const res = await fetch(`/api/traffic/routes?${params.toString()}`);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch routes");
      }

      const data = await res.json();
      setRouteEstimate({
        origin: origin.name,
        destination: destination.name,
        routes: data.routes || [],
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error("Failed to fetch routes:", e);
      setError(e.message || "Failed to fetch routes");
    } finally {
      setLoading(false);
    }
  }

  async function addLocation(name: string, address: string) {
    try {
      const res = await fetch("/api/traffic/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address }),
      });

      if (res.ok) {
        await fetchLocations();
      }
    } catch (e) {
      console.error("Failed to add location:", e);
    }
  }

  async function deleteLocation(id: string) {
    try {
      const res = await fetch(`/api/traffic/locations/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchLocations();
        if (selectedOrigin === id) setSelectedOrigin("");
        if (selectedDestination === id) setSelectedDestination("");
      }
    } catch (e) {
      console.error("Failed to delete location:", e);
    }
  }

  async function saveFavoriteRoute(name: string, notifyOnTraffic: boolean) {
    if (!selectedOrigin || !selectedDestination) {
      setError("Please select both origin and destination");
      return;
    }

    const origin = locations.find((l) => l.id === selectedOrigin);
    const destination = locations.find((l) => l.id === selectedDestination);

    if (!origin || !destination) return;

    try {
      const payload = {
        name,
        originId: origin.id,
        originAddress: origin.address,
        destinationId: destination.id,
        destinationAddress: destination.address,
        departureTime: useArrivalTime ? undefined : departureTime.slice(11, 16),
        arrivalTime: useArrivalTime ? departureTime.slice(11, 16) : undefined,
        notifyOnTraffic,
      };

      const res = await fetch("/api/traffic/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchFavoriteRoutes();
      }
    } catch (e) {
      console.error("Failed to save favorite route:", e);
    }
  }

  async function loadFavoriteRoute(route: FavoriteRoute) {
    setSelectedOrigin(route.originId);
    setSelectedDestination(route.destinationId);

    if (route.departureTime) {
      const now = new Date();
      const [hours, minutes] = route.departureTime.split(":");
      now.setHours(parseInt(hours), parseInt(minutes));
      setDepartureTime(now.toISOString().slice(0, 16));
      setUseArrivalTime(false);
    } else if (route.arrivalTime) {
      const now = new Date();
      const [hours, minutes] = route.arrivalTime.split(":");
      now.setHours(parseInt(hours), parseInt(minutes));
      setDepartureTime(now.toISOString().slice(0, 16));
      setUseArrivalTime(true);
    }

    setActiveTab("routes");
    setTimeout(() => fetchRoutes(), 100);
  }

  async function deleteFavoriteRoute(id: string) {
    try {
      const res = await fetch(`/api/traffic/favorites/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchFavoriteRoutes();
      }
    } catch (e) {
      console.error("Failed to delete favorite route:", e);
    }
  }

  async function toggleNotifications(routeId: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/traffic/favorites/${routeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyOnTraffic: enabled }),
      });

      if (res.ok) {
        await fetchFavoriteRoutes();
      }
    } catch (e) {
      console.error("Failed to toggle notifications:", e);
    }
  }

  async function checkTrafficForRoute(routeId: string) {
    try {
      const res = await fetch("/api/traffic/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.alertCreated) {
          await fetchTrafficAlerts();
        }
        alert(data.message || "Traffic check complete");
      }
    } catch (e) {
      console.error("Failed to check traffic:", e);
    }
  }

  async function dismissAlert(id: string) {
    try {
      const res = await fetch(`/api/traffic/alerts/${id}`, {
        method: "PUT",
      });

      if (res.ok) {
        await fetchTrafficAlerts();
      }
    } catch (e) {
      console.error("Failed to dismiss alert:", e);
    }
  }

  async function clearAllAlerts() {
    try {
      const res = await fetch("/api/traffic/alerts", {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchTrafficAlerts();
      }
    } catch (e) {
      console.error("Failed to clear alerts:", e);
    }
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="module-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3>🚗 Traffic & Routes</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {trafficAlerts.length > 0 && (
            <span
              style={{
                background: "#ff6b6b",
                color: "white",
                padding: "0.25rem 0.5rem",
                borderRadius: "12px",
                fontSize: "0.8rem",
                fontWeight: "bold",
              }}
            >
              {trafficAlerts.length}
            </span>
          )}
          <button className="cal-btn" onClick={fetchRoutes} disabled={loading}>
            <Icon name="refresh" /> {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setActiveTab("routes")}
          style={{
            padding: "0.5rem 1rem",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "routes" ? "2px solid var(--primary)" : "none",
            color: activeTab === "routes" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "routes" ? "600" : "normal",
            cursor: "pointer",
          }}
        >
          Routes
        </button>
        <button
          onClick={() => setActiveTab("favorites")}
          style={{
            padding: "0.5rem 1rem",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "favorites" ? "2px solid var(--primary)" : "none",
            color:
              activeTab === "favorites" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "favorites" ? "600" : "normal",
            cursor: "pointer",
          }}
        >
          Favorites ({favoriteRoutes.length})
        </button>
        <button
          onClick={() => setActiveTab("alerts")}
          style={{
            padding: "0.5rem 1rem",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "alerts" ? "2px solid var(--primary)" : "none",
            color: activeTab === "alerts" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "alerts" ? "600" : "normal",
            cursor: "pointer",
          }}
        >
          Alerts {trafficAlerts.length > 0 && `(${trafficAlerts.length})`}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem",
            background: "rgba(255, 100, 100, 0.1)",
            color: "#ff6b6b",
            borderRadius: "8px",
            marginTop: "0.5rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Routes Tab */}
      {activeTab === "routes" && (
        <div style={{ marginTop: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                From
              </label>
              <select
                className="traffic-select"
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">Select origin</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                To
              </label>
              <select
                className="traffic-select"
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">Select destination</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                fontSize: "0.85rem",
                color: "var(--muted)",
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              {useArrivalTime ? "Arrival Time" : "Departure Time"}
            </label>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <input
                type="datetime-local"
                className="task-input"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="task-action-btn"
                onClick={() => setUseArrivalTime(!useArrivalTime)}
                title={
                  useArrivalTime
                    ? "Switch to departure time"
                    : "Switch to arrival time"
                }
              >
                {useArrivalTime ? "🎯" : "🚀"}
              </button>
            </div>
          </div>

          <button
            className="task-add-btn"
            onClick={fetchRoutes}
            disabled={loading || !selectedOrigin || !selectedDestination}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            {loading ? "Loading..." : "Get Routes"}
          </button>

          {routeEstimate && (
            <div style={{ marginTop: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <h4 style={{ margin: 0, fontSize: "0.95rem" }}>
                  {routeEstimate.origin} → {routeEstimate.destination}
                </h4>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {formatTime(routeEstimate.timestamp)}
                </span>
              </div>

              {routeEstimate.routes.map((route, index) => {
                const trafficDelay = route.durationInTraffic !== route.duration;
                return (
                  <div
                    key={index}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      padding: "1rem",
                      borderRadius: "8px",
                      marginBottom: "0.75rem",
                      border:
                        index === 0
                          ? "2px solid var(--accent-start)"
                          : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: "600",
                            fontSize: "0.9rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Route {index + 1} {index === 0 && "(Fastest)"}
                        </div>
                        <div
                          style={{ fontSize: "0.85rem", color: "var(--muted)" }}
                        >
                          via {route.summary}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "1rem",
                        marginTop: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                        >
                          Distance
                        </div>
                        <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                          {route.distance}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                        >
                          Duration
                        </div>
                        <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                          {route.duration}
                        </div>
                      </div>
                      {trafficDelay && (
                        <div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--muted)",
                            }}
                          >
                            In Traffic
                          </div>
                          <div
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: "600",
                              color: "#ff6b6b",
                            }}
                          >
                            {route.durationInTraffic}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible Saved Locations Section */}
          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "8px",
            }}
          >
            <div
              onClick={() => setShowLocationManager(!showLocationManager)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                padding: "0.5rem 0",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "0.95rem" }}>
                Manage Locations ({locations.length})
              </h4>
              <span style={{ fontSize: "18px" }}>
                {showLocationManager ? "▼" : "▶"}
              </span>
            </div>

            {showLocationManager && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginTop: "0.75rem",
                  }}
                >
                  {locations.map((loc) => (
                    <div
                      key={loc.id}
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        padding: "0.75rem",
                        borderRadius: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                          {loc.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            marginTop: "0.15rem",
                          }}
                        >
                          {loc.address}
                        </div>
                      </div>
                      <button
                        className="task-action-btn"
                        onClick={() => deleteLocation(loc.id)}
                        title="Delete"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  ))}
                </div>
                <LocationForm onAdd={addLocation} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === "favorites" && (
        <FavoritesTab
          favoriteRoutes={favoriteRoutes}
          locations={locations}
          onLoadRoute={loadFavoriteRoute}
          onDeleteRoute={deleteFavoriteRoute}
          onToggleNotifications={toggleNotifications}
          onCheckTraffic={checkTrafficForRoute}
          onSaveRoute={saveFavoriteRoute}
        />
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <AlertsTab
          alerts={trafficAlerts}
          onDismiss={dismissAlert}
          onClearAll={clearAllAlerts}
        />
      )}
    </div>
  );
}

// Favorites Tab Component
function FavoritesTab({
  favoriteRoutes,
  locations,
  onLoadRoute,
  onDeleteRoute,
  onToggleNotifications,
  onCheckTraffic,
  onSaveRoute,
}: {
  favoriteRoutes: FavoriteRoute[];
  locations: SavedLocation[];
  onLoadRoute: (route: FavoriteRoute) => void;
  onDeleteRoute: (id: string) => void;
  onToggleNotifications: (id: string, enabled: boolean) => void;
  onCheckTraffic: (id: string) => void;
  onSaveRoute: (name: string, notify: boolean) => void;
}) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (routeName.trim()) {
      onSaveRoute(routeName.trim(), notifyEnabled);
      setRouteName("");
      setNotifyEnabled(true);
      setShowSaveForm(false);
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <button
        className="task-add-btn"
        onClick={() => setShowSaveForm(!showSaveForm)}
        style={{ marginBottom: "1rem" }}
      >
        <Icon name="plus" /> Save Current Route as Favorite
      </button>

      {showSaveForm && (
        <form
          onSubmit={handleSave}
          style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <input
            className="task-input"
            placeholder="Route name (e.g., Morning Commute)"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            autoFocus
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.75rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
            />
            <span style={{ fontSize: "0.9rem" }}>
              Notify me when traffic is unusual
            </span>
          </label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <button type="submit" className="task-add-btn">
              Save
            </button>
            <button
              type="button"
              className="task-action-btn"
              onClick={() => setShowSaveForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {favoriteRoutes.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          No favorite routes saved yet. Set up a route and save it as a
          favorite!
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {favoriteRoutes.map((route) => {
            const origin = locations.find((l) => l.id === route.originId);
            const destination = locations.find(
              (l) => l.id === route.destinationId
            );

            return (
              <div
                key={route.id}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "1rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {route.name}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      {origin?.name || route.originAddress} →{" "}
                      {destination?.name || route.destinationAddress}
                    </div>
                    {route.departureTime && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--muted)",
                          marginTop: "0.25rem",
                        }}
                      >
                        🚀 Depart: {route.departureTime}
                      </div>
                    )}
                    {route.arrivalTime && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--muted)",
                          marginTop: "0.25rem",
                        }}
                      >
                        🎯 Arrive: {route.arrivalTime}
                      </div>
                    )}
                  </div>
                  <button
                    className="task-action-btn"
                    onClick={() => onDeleteRoute(route.id)}
                    title="Delete"
                  >
                    <Icon name="trash" />
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginTop: "0.75rem",
                  }}
                >
                  <button
                    className="cal-btn"
                    onClick={() => onLoadRoute(route)}
                    style={{ fontSize: "0.85rem" }}
                  >
                    <Icon name="map" /> Load Route
                  </button>
                  {route.notifyOnTraffic && (
                    <button
                      className="cal-btn"
                      onClick={() => onCheckTraffic(route.id)}
                      style={{ fontSize: "0.85rem" }}
                    >
                      <Icon name="refresh" /> Check Traffic
                    </button>
                  )}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      padding: "0.5rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={route.notifyOnTraffic}
                      onChange={(e) =>
                        onToggleNotifications(route.id, e.target.checked)
                      }
                    />
                    <span>🔔 Notifications</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Alerts Tab Component
function AlertsTab({
  alerts,
  onDismiss,
  onClearAll,
}: {
  alerts: TrafficAlert[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}) {
  if (alerts.length === 0) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--muted)",
          marginTop: "1rem",
        }}
      >
        No traffic alerts. We'll notify you when traffic on your favorite routes
        is unusual.
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h4 style={{ margin: 0, fontSize: "0.95rem" }}>
          Active Alerts ({alerts.length})
        </h4>
        <button
          className="task-action-btn"
          onClick={onClearAll}
          title="Clear all alerts"
        >
          Clear All
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {alerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              background: "rgba(255, 100, 100, 0.1)",
              border: "1px solid rgba(255, 100, 100, 0.3)",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: "600",
                    fontSize: "1rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  🚨 {alert.routeName}
                </div>
                <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                  <strong style={{ color: "#ff6b6b" }}>{alert.delay}</strong>{" "}
                  than usual
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  Normal: {alert.normalDuration} • Current:{" "}
                  {alert.currentDuration}
                </div>
                {alert.routeSummary && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      marginTop: "0.25rem",
                    }}
                  >
                    via {alert.routeSummary}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    marginTop: "0.5rem",
                  }}
                >
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
              <button
                className="task-action-btn"
                onClick={() => onDismiss(alert.id)}
                title="Dismiss"
              >
                <Icon name="check" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Location Form Component
function LocationForm({
  onAdd,
}: {
  onAdd: (name: string, address: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() && address.trim()) {
      onAdd(name.trim(), address.trim());
      setName("");
      setAddress("");
      setIsOpen(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        className="task-add-btn"
        onClick={() => setIsOpen(true)}
        style={{ marginTop: "0.75rem", width: "100%" }}
      >
        <Icon name="plus" /> Add Location
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "0.75rem" }}>
      <input
        className="task-input"
        placeholder="Location name (e.g., Home, School, Work)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        className="task-input"
        placeholder="Full address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        style={{ marginTop: "0.5rem" }}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="submit" className="task-add-btn">
          Add
        </button>
        <button
          type="button"
          className="task-action-btn"
          onClick={() => {
            setIsOpen(false);
            setName("");
            setAddress("");
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}