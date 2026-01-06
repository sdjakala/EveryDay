import React, { useState, useEffect } from "react";
import Icon from "../../components/Icon";

type SavedLocation = {
  id: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  createdAt?: string;
};

type WeatherData = {
  currentTime: string;
  timeZone: {
    id: string;
  };
  isDaytime: boolean;
  weatherCondition: {
    iconBaseUri: string;
    description: {
      text: string;
      languageCode: string;
    };
    type: string;
  };
  temperature: {
    degrees: number;
    unit: string;
  };
  feelsLikeTemperature: {
    degrees: number;
    unit: string;
  };
  dewPoint: {
    degrees: number;
    unit: string;
  };
  heatIndex: {
    degrees: number;
    unit: string;
  };
  windChill: {
    degrees: number;
    unit: string;
  };
  relativeHumidity: number;
  uvIndex: number;
  precipitation: {
    probability: {
      percent: number;
      type: string;
    };
    snowQpf: {
      quantity: number;
      unit: string;
    };
    qpf: {
      quantity: number;
      unit: string;
    };
  };
  thunderstormProbability: number;
  airPressure: {
    meanSeaLevelMillibars: number;
  };
  wind: {
    direction: {
      degrees: number;
      cardinal: string;
    };
    speed: {
      value: number;
      unit: string;
    };
    gust: {
      value: number;
      unit: string;
    };
  };
  visibility: {
    distance: number;
    unit: string;
  };
  cloudCover: number;
  currentConditionsHistory: {
    temperatureChange: {
      degrees: number;
      unit: string;
    };
    maxTemperature: {
      degrees: number;
      unit: string;
    };
    minTemperature: {
      degrees: number;
      unit: string;
    };
    snowQpf: {
      quantity: number;
      unit: string;
    };
    qpf: {
      quantity: number;
      unit: string;
    };
  };
};

export default function WeatherModule() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("current");
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    fetchSavedLocations();
  }, []);

  useEffect(() => {
    // Only fetch weather if a location is selected and it's not the initial "current" without permission
    if (selectedLocationId && selectedLocationId !== "current") {
      fetchWeatherForLocation();
    }
  }, [selectedLocationId]);

  async function fetchSavedLocations() {
    try {
      const res = await fetch("/api/weather/locations");
      if (res.ok) {
        const data = await res.json();
        setSavedLocations(data.locations || []);
      }
    } catch (e) {
      console.error("Failed to fetch saved locations:", e);
    }
  }

  async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported by your browser");
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (err) => {
          setError("Unable to retrieve your location");
          console.error("Geolocation error:", err);
          resolve(null);
        }
      );
    });
  }

  async function fetchWeatherForLocation() {
    try {
      setLoading(true);
      setError(null);

      let latitude: number;
      let longitude: number;

      if (selectedLocationId === "current") {
        const coords = await getCurrentLocation();
        if (!coords) {
          setLoading(false);
          return;
        }
        latitude = coords.latitude;
        longitude = coords.longitude;
      } else {
        const location = savedLocations.find((loc) => loc.id === selectedLocationId);
        if (!location) {
          setError("Location not found");
          setLoading(false);
          return;
        }
        latitude = location.latitude;
        longitude = location.longitude;
      }

      const res = await fetch(
        `/api/weather/current?latitude=${latitude}&longitude=${longitude}`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch weather");
      }

      const data = await res.json();
      setWeather(data);
    } catch (e: any) {
      console.error("Failed to fetch weather:", e);
      setError(e.message || "Failed to load weather data");
    } finally {
      setLoading(false);
    }
  }

  async function geocodeAndSaveLocation(e: React.FormEvent) {
    e.preventDefault();
    
    const city = newCity.trim();
    const state = newState.trim();
    
    if (!city || !state) {
      setError("Please enter both city and state");
      return;
    }

    try {
      setGeocoding(true);
      setError(null);

      const res = await fetch("/api/weather/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, state }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to geocode location");
      }

      const data = await res.json();
      
      await fetchSavedLocations();
      setNewCity("");
      setNewState("");
      setShowLocationManager(false);
      
      // Auto-select the newly added location
      setSelectedLocationId(data.id);
    } catch (e: any) {
      console.error("Failed to geocode location:", e);
      setError(e.message || "Failed to save location");
    } finally {
      setGeocoding(false);
    }
  }

  async function deleteLocation(id: string) {
    if (!confirm("Delete this location?")) return;

    try {
      const res = await fetch(`/api/weather/locations/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchSavedLocations();
        if (selectedLocationId === id) {
          setSelectedLocationId("current");
        }
      }
    } catch (e) {
      console.error("Failed to delete location:", e);
    }
  }

  function formatTemperature(temp: { degrees: number; unit: string }) {
    return `${Math.round(temp.degrees)}°${temp.unit === "FAHRENHEIT" ? "F" : "C"}`;
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getLocationName(): string {
    if (selectedLocationId === "current") {
      return "Current Location";
    }
    const location = savedLocations.find((loc) => loc.id === selectedLocationId);
    return location ? `${location.city}, ${location.state}` : "Unknown Location";
  }

  return (
    <div className="module-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3>🌤️ Weather</h3>
        <button
          className="cal-btn"
          onClick={fetchWeatherForLocation}
          title="Refresh weather"
          disabled={loading}
        >
          <Icon name="refresh" />
        </button>
      </div>

      {/* Location Selector */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            fontSize: "0.85rem",
            color: "var(--muted)",
            display: "block",
            marginBottom: "0.5rem",
          }}
        >
          Location
        </label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            className="traffic-select"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="current">📍 Current Location</option>
            {savedLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.city}, {loc.state}
              </option>
            ))}
          </select>
          <button
            className="cal-btn"
            onClick={() => setShowLocationManager(!showLocationManager)}
            title="Manage locations"
          >
            <Icon name="settings" />
          </button>
        </div>
      </div>

      {/* Location Manager */}
      {showLocationManager && (
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
            Add Location
          </h4>
          <form onSubmit={geocodeAndSaveLocation}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <input
                className="task-input"
                placeholder="City"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                className="task-input"
                placeholder="State (e.g., MN)"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                style={{ width: "120px" }}
              />
            </div>
            <button
              type="submit"
              className="task-add-btn"
              disabled={geocoding}
              style={{ width: "100%" }}
            >
              {geocoding ? "Adding..." : "Add Location"}
            </button>
          </form>

          {savedLocations.length > 0 && (
            <>
              <h4 style={{ margin: "1rem 0 0.75rem 0", fontSize: "0.95rem" }}>
                Saved Locations ({savedLocations.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {savedLocations.map((loc) => (
                  <div
                    key={loc.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: "6px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                        {loc.city}, {loc.state}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                        {loc.formattedAddress}
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
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: "0.75rem",
            background: "rgba(255, 100, 100, 0.1)",
            color: "#ff6b6b",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          <p>Loading weather data...</p>
        </div>
      )}

      {/* No weather data state */}
      {!loading && !weather && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          <p>Select a location and click refresh to view weather</p>
        </div>
      )}

      {/* Weather data display */}
      {!loading && weather && (
        <>
          {/* Location badge */}
          <div
            style={{
              fontSize: "0.9rem",
              color: "var(--muted)",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>📍</span>
            <span>{getLocationName()}</span>
          </div>

          {/* Main weather display */}
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              alignItems: "center",
              padding: "1.5rem",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "12px",
              marginBottom: "1rem",
            }}
          >
            <img
              src={`${weather.weatherCondition.iconBaseUri}.svg`}
              alt={weather.weatherCondition.description.text}
              style={{ width: 80, height: 80 }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "3rem", fontWeight: "700", lineHeight: 1 }}>
                {formatTemperature(weather.temperature)}
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  color: "var(--muted)",
                  marginTop: "0.25rem",
                }}
              >
                {weather.weatherCondition.description.text}
              </div>
              <div style={{ fontSize: "0.9rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                Feels like {formatTemperature(weather.feelsLikeTemperature)}
              </div>
            </div>
            <div style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.85rem" }}>
              <div>{weather.isDaytime ? "☀️ Day" : "🌙 Night"}</div>
              <div style={{ marginTop: "0.25rem" }}>
                {formatTime(weather.currentTime)}
              </div>
              <div style={{ marginTop: "0.25rem" }}>{weather.timeZone.id}</div>
            </div>
          </div>

          {/* Temperature Details */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
              Temperature Details
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Heat Index
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {formatTemperature(weather.heatIndex)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Wind Chill
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {formatTemperature(weather.windChill)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Dew Point
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {formatTemperature(weather.dewPoint)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Humidity
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.relativeHumidity}%
                </div>
              </div>
            </div>
          </div>

          {/* Today's Range */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
              Today's Temperature Range
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  High
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {formatTemperature(
                    weather.currentConditionsHistory.maxTemperature
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Low</div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {formatTemperature(
                    weather.currentConditionsHistory.minTemperature
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Change
                </div>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color:
                      weather.currentConditionsHistory.temperatureChange.degrees > 0
                        ? "#ff6b6b"
                        : weather.currentConditionsHistory.temperatureChange
                              .degrees < 0
                          ? "#4dabf7"
                          : "inherit",
                  }}
                >
                  {weather.currentConditionsHistory.temperatureChange.degrees > 0
                    ? "+"
                    : ""}
                  {formatTemperature(
                    weather.currentConditionsHistory.temperatureChange
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Wind & Pressure */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
              Wind & Pressure
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Wind Speed
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.wind.speed.value} mph
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Wind Gust
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.wind.gust.value} mph
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Direction
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.wind.direction.cardinal} ({weather.wind.direction.degrees}°)
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Pressure
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.airPressure.meanSeaLevelMillibars.toFixed(1)} mb
                </div>
              </div>
            </div>
          </div>

          {/* Precipitation & Visibility */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
              Precipitation & Visibility
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Precip. Chance
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.precipitation.probability.percent}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Thunder Chance
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.thunderstormProbability}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Visibility
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.visibility.distance} mi
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Cloud Cover
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                  {weather.cloudCover}%
                </div>
              </div>
            </div>
          </div>

          {/* UV Index */}
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
              borderRadius: "8px",
            }}
          >
            <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>
              UV Index
            </h4>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: "700" }}>
                {weather.uvIndex}
              </div>
              <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                {weather.uvIndex === 0 && "Minimal"}
                {weather.uvIndex >= 1 && weather.uvIndex <= 2 && "Low"}
                {weather.uvIndex >= 3 && weather.uvIndex <= 5 && "Moderate"}
                {weather.uvIndex >= 6 && weather.uvIndex <= 7 && "High"}
                {weather.uvIndex >= 8 && weather.uvIndex <= 10 && "Very High"}
                {weather.uvIndex >= 11 && "Extreme"}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}