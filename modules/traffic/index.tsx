import dynamic from 'next/dynamic';
import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

// Lazy load map to avoid SSR issues
const TrafficMap = dynamic(() => import('../../components/TrafficMap'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      background: 'rgba(255,255,255,0.03)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--muted)'
    }}>
      Loading map...
    </div>
  ),
});

type SavedLocation = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
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
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  // Clear location errors when switching away from current location
  useEffect(() => {
    if (selectedOrigin !== "CURRENT_LOCATION") {
      setLocationError(null);
      setLoadingLocation(false);
    }
  }, [selectedOrigin]);

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

    if (selectedOrigin === selectedDestination) {
      setError("Origin and destination must be different");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let originAddress: string;
      let originName: string;

      // Handle current location
      if (selectedOrigin === "CURRENT_LOCATION") {
        if (!currentLocation) {
          setError("Please get your current location first");
          setLoading(false);
          return;
        }
        originAddress = `${currentLocation.lat},${currentLocation.lng}`;
        originName = "Current Location";
      } else {
        // Handle saved location
        const origin = locations.find((l) => l.id === selectedOrigin);
        if (!origin) {
          setError("Invalid origin");
          setLoading(false);
          return;
        }
        originAddress = origin.address;
        originName = origin.name;
      }

      // Get destination (this stays the same)
      const destination = locations.find((l) => l.id === selectedDestination);
      if (!destination) {
        setError("Invalid destination");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        origin: originAddress,
        destination: destination.address,
      });

      const res = await fetch(`/api/traffic/routes?${params.toString()}`);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch routes");
      }

      const data = await res.json();
      
      setRouteEstimate({
        origin: originName,
        destination: destination.name,
        routes: data.routes || [],
        timestamp: new Date().toISOString(),
      });

      // Auto-select the fastest route
      setSelectedRouteIndex(0);

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

  async function getCurrentLocation() {
    setLoadingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          // Reverse geocode to get address
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          const res = await fetch(geocodeUrl);
          const data = await res.json();

          let address = "Current Location";
          if (data.results && data.results[0]) {
            address = data.results[0].formatted_address;
          }

          setCurrentLocation({ lat, lng, address });
          setSelectedOrigin("CURRENT_LOCATION");
          setLoadingLocation(false);
        } catch (error) {
          console.error("Failed to reverse geocode:", error);
          // Still use location even if reverse geocode fails
          setCurrentLocation({ 
            lat, 
            lng, 
            address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` 
          });
          setSelectedOrigin("CURRENT_LOCATION");
          setLoadingLocation(false);
        }
      },
      (error) => {
        let errorMessage = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        setLocationError(errorMessage);
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
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

  function getTrafficLevel(route: Route): { level: string; color: string; emoji: string } {
    const delay = getTrafficDelay(route);
    
    if (delay < 3) return { level: 'Light', color: '#00bf63', emoji: '🟢' };
    if (delay < 8) return { level: 'Moderate', color: '#ffa500', emoji: '🟡' };
    if (delay < 15) return { level: 'Heavy', color: '#ff6b6b', emoji: '🔴' };
    return { level: 'Very Heavy', color: '#8b0000', emoji: '⚫' };
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
            <label style={{ 
              fontSize: "0.85rem", 
              color: "var(--muted)", 
              display: "block", 
              marginBottom: "0.25rem" 
            }}>
              From
            </label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                className="task-input"
                value={selectedOrigin}
                onChange={(e) => setSelectedOrigin(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Select origin</option>
                <option value="CURRENT_LOCATION">Current Location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              
              {selectedOrigin === "CURRENT_LOCATION" && (
                <button
                  onClick={getCurrentLocation}
                  disabled={loadingLocation}
                  className="icon-btn"
                  title="Get current location"
                  style={{
                    padding: "8px",
                    background: loadingLocation ? "var(--muted)" : "var(--primary)",
                    color: "#000",
                    borderRadius: "6px",
                  }}
                >
                  {loadingLocation ? "📡" : "📍"}
                </button>
              )}
            </div>
            
            {selectedOrigin === "CURRENT_LOCATION" && currentLocation && (
              <div style={{ 
                fontSize: "0.75rem", 
                color: "#00bf63", 
                marginTop: "0.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem"
              }}>
                ✓ {currentLocation.address}
              </div>
            )}
            
            {locationError && (
              <div style={{ 
                fontSize: "0.75rem", 
                color: "#ff6b6b", 
                marginTop: "0.25rem" 
              }}>
                {locationError}
              </div>
            )}
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

      {/* Map + Routes Layout */}
      {routeEstimate && (
        <div style={{ marginTop: '1rem' }}>
          {/* Route Info Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border)'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>
                {routeEstimate.origin} → {routeEstimate.destination}
              </h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                {formatTime(routeEstimate.timestamp)}
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {routeEstimate.routes.length} route{routeEstimate.routes.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* MAP - Full width on top */}
          <div style={{ 
            height: '400px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '1rem'
          }}>
            <TrafficMap
              origin={{
                ...locations.find(l => l.id === selectedOrigin)!,
              }}
              destination={{
                ...locations.find(l => l.id === selectedDestination)!,
              }}
              routes={routeEstimate.routes}
              selectedRouteIndex={selectedRouteIndex}
            />
          </div>

          {/* ROUTE CARDS - Below map */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem'
          }}>
            {routeEstimate.routes.map((route, index) => {
              const delay = getTrafficDelay(route);
              const traffic = getTrafficLevel(route);
              const hasDelay = delay > 5;
              const isSelected = selectedRouteIndex === index;

              // Create Google Maps URL for this specific route
              const origin = locations.find(l => l.id === selectedOrigin);
              const destination = locations.find(l => l.id === selectedDestination);
              
              const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                selectedOrigin === "CURRENT_LOCATION" && currentLocation
                  ? `${currentLocation.lat},${currentLocation.lng}`
                  : origin?.address || ''
              )}&destination=${encodeURIComponent(
                destination?.address || ''
              )}&travelmode=driving`;

              return (
                <div
                  key={index}
                  onClick={() => setSelectedRouteIndex(isSelected ? null : index)}
                  style={{
                    background: isSelected 
                      ? 'rgba(37, 244, 238, 0.1)' 
                      : 'rgba(255,255,255,0.02)',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: isSelected 
                      ? '2px solid #25f4ee' 
                      : index === 0 && selectedRouteIndex === null
                      ? '2px solid var(--primary)'
                      : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'start', 
                    marginBottom: '0.5rem' 
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: '600', 
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        {route.summary}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        {route.distance}
                      </div>
                    </div>
                    
                    {/* Google Maps Link - moved inside and to the right */}
                    {isSelected && (
                      
                        <a href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(66, 133, 244, 0.1)',
                          border: '1px solid rgba(66, 133, 244, 0.3)',
                          borderRadius: '6px',
                          color: '#4285f4',
                          textDecoration: 'none',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          marginLeft: '0.5rem'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(66, 133, 244, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(66, 133, 244, 0.1)';
                        }}
                      >                      
                        Navigate
                      </a>
                    )}
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    marginTop: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: hasDelay ? '#ff6b6b' : '#00bf63'
                    }}>
                      {route.durationInTraffic}
                    </div>
                    
                    {hasDelay ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.25rem 0.75rem',
                        background: 'rgba(255, 107, 107, 0.1)',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        color: '#ff6b6b'
                      }}>
                        ⚠️ +{delay} min delay
                      </div>
                    ) : (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.25rem 0.75rem',
                        background: 'rgba(0, 191, 99, 0.1)',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        color:  traffic.color
                      }}>
                        {traffic.level} traffic
                      </div>
                    )}
                  </div>

                  {hasDelay && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--muted)', 
                      marginTop: '0.5rem' 
                    }}>
                      Typical time: {route.duration}
                    </div>
                  )}
                  
                </div>
              );
            })}
          </div>
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
      <div style={{ paddingTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>       
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