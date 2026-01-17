import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type SavedLocation = {
  id: string;
  name: string;
  address: string;
};

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

export default function TrafficModule() {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<string>("");
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocationManager, setShowLocationManager] = useState(false);

  useEffect(() => {
    fetchLocations();
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

  function swapLocations() {
    const temp = selectedOrigin;
    setSelectedOrigin(selectedDestination);
    setSelectedDestination(temp);
  }

  function getTrafficDelay(route: Route): number {
    const normalMinutes = parseInt(route.duration.split(" ")[0]);
    const trafficMinutes = parseInt(route.durationInTraffic.split(" ")[0]);
    return trafficMinutes - normalMinutes;
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="module-card">            

      {/* Route Selection */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "0.5rem", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
              From
            </label>
            <select
              className="task-input"
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Select origin</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={swapLocations}
            className="icon-btn"
            style={{ marginBottom: "2px" }}
            title="Swap locations"
          >
            ⇄
          </button>

          <div>
            <label style={{ fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
              To
            </label>
            <select
              className="task-input"
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Select destination</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="task-add-btn"
          onClick={fetchRoutes}
          disabled={loading || !selectedOrigin || !selectedDestination}
          style={{ width: "100%", marginTop: "0.75rem" }}
        >
          {loading ? "Loading..." : "Get Routes"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: "0.75rem",
          background: "rgba(255, 100, 100, 0.1)",
          color: "#ff6b6b",
          borderRadius: "8px",
          marginBottom: "1rem",
          fontSize: "0.9rem",
        }}>
          {error}
        </div>
      )}

      {/* Routes Display */}
      {routeEstimate && (
        <div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid var(--border)"
          }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem" }}>
              {routeEstimate.origin} → {routeEstimate.destination}
            </h4>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              {formatTime(routeEstimate.timestamp)}
            </span>
          </div>

          {routeEstimate.routes.map((route, index) => {
            const delay = getTrafficDelay(route);
            const hasDelay = delay > 5;

            return (
              <div
                key={index}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "1rem",
                  borderRadius: "8px",
                  marginBottom: "0.75rem",
                  border: index === 0 ? "2px solid var(--primary)" : "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                  <div>
                    <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                      {route.summary}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                      {route.distance}
                    </div>
                  </div>
                  {index === 0 && (
                    <span style={{
                      padding: "0.25rem 0.5rem",
                      background: "var(--primary)",
                      color: "#67f724ff",
                      fontSize: "0.7rem",
                      borderRadius: "4px",
                      fontWeight: "600"
                    }}>
                      FASTEST
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem" }}>
                  <div style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    color: hasDelay ? "#ff6b6b" : "#00bf63"
                  }}>
                    {route.durationInTraffic}
                  </div>
                  
                  {hasDelay ? (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.25rem 0.75rem",
                      background: "rgba(255, 107, 107, 0.1)",
                      borderRadius: "12px",
                      fontSize: "0.85rem",
                      color: "#ff6b6b"
                    }}>
                      ⚠️ +{delay} min delay
                    </div>
                  ) : (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.25rem 0.75rem",
                      background: "rgba(0, 191, 99, 0.1)",
                      borderRadius: "12px",
                      fontSize: "0.85rem",
                      color: "#00bf63"
                    }}>
                      Normal traffic
                    </div>
                  )}
                </div>

                {hasDelay && (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                    Typical time: {route.duration}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!routeEstimate && !loading && locations.length >= 2 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
          Select locations and click &quot;Get Routes&quot; to see traffic info
        </div>
      )}

      {locations.length < 2 && !showLocationManager && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
          Add at least 2 locations to get started
          <button
            className="task-add-btn"
            onClick={() => setShowLocationManager(true)}
            style={{ marginTop: "1rem" }}
          >
            <Icon name="plus" /> Add Locations
          </button>
        </div>
      )}
      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>       
        <button 
          className="cal-btn" 
          onClick={() => setShowLocationManager(!showLocationManager)}
        >
          <Icon name="settings" /> Locations
        </button>
      </div>
      {/* Location Manager */}
      {showLocationManager && (
        <div style={{ 
          background: "rgba(255,255,255,0.02)", 
          padding: "1rem", 
          borderRadius: "8px",
          marginBottom: "1rem"
        }}>
          <h4 style={{ marginTop: 0, fontSize: "0.95rem" }}>Manage Locations</h4>
          
          <LocationForm onAdd={addLocation} />
          
          {locations.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              {locations.map(loc => (
                <div key={loc.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "6px",
                  marginBottom: "0.5rem"
                }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{loc.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{loc.address}</div>
                  </div>
                  <button
                    className="task-action-btn"
                    onClick={() => deleteLocation(loc.id)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

  );
}

// Location Form Component
function LocationForm({ onAdd }: { onAdd: (name: string, address: string) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() && address.trim()) {
      onAdd(name.trim(), address.trim());
      setName("");
      setAddress("");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <input
        className="task-input"
        placeholder="Location name (e.g., Home, Work)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="task-input"
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        required
      />
      <button type="submit" className="task-add-btn">
        <Icon name="plus" /> Add Location
      </button>
    </form>
  );
}