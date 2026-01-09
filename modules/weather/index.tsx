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

type AstronomyData = {
  location: {
    latitude: string;
    longitude: string;
    country_name: string;
    state_prov: string;
    city: string;
    locality: string;
    elevation: string;
  };
  astronomy: {
    date: string;
    current_time: string;
    mid_night: string;
    night_end: string;
    morning: {
      astronomical_twilight_begin: string;
      astronomical_twilight_end: string;
      nautical_twilight_begin: string;
      nautical_twilight_end: string;
      civil_twilight_begin: string;
      civil_twilight_end: string;
      blue_hour_begin: string;
      blue_hour_end: string;
      golden_hour_begin: string;
      golden_hour_end: string;
    };
    sunrise: string;
    sunset: string;
    evening: {
      golden_hour_begin: string;
      golden_hour_end: string;
      blue_hour_begin: string;
      blue_hour_end: string;
      civil_twilight_begin: string;
      civil_twilight_end: string;
      nautical_twilight_begin: string;
      nautical_twilight_end: string;
      astronomical_twilight_begin: string;
      astronomical_twilight_end: string;
    };
    night_begin: string;
    sun_status: string;
    solar_noon: string;
    day_length: string;
    sun_altitude: number;
    sun_distance: number;
    sun_azimuth: number;
    moon_phase: string;
    moonrise: string;
    moonset: string;
    moon_status: string;
    moon_altitude: number;
    moon_distance: number;
    moon_azimuth: number;
    moon_parallactic_angle: number;
    moon_illumination_percentage: string;
    moon_angle: number;
  };
};

export default function WeatherModule() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [astronomy, setAstronomy] = useState<AstronomyData | null>(null);
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

      // Fetch both weather and astronomy data in parallel
      const [weatherRes, astronomyRes] = await Promise.all([
        fetch(`/api/weather/current?latitude=${latitude}&longitude=${longitude}`),
        fetch(`/api/weather/astronomy?latitude=${latitude}&longitude=${longitude}`)
      ]);

      if (!weatherRes.ok) {
        const errorData = await weatherRes.json();
        throw new Error(errorData.error || "Failed to fetch weather");
      }

      const weatherData = await weatherRes.json();
      setWeather(weatherData);

      // Astronomy data is optional - don't fail if it's unavailable
      if (astronomyRes.ok) {
        const astronomyData = await astronomyRes.json();
        setAstronomy(astronomyData);
      } else {
        console.warn("Failed to fetch astronomy data");
        setAstronomy(null);
      }
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

  function to12Hour(time24: string) {
    const [hourStr, minute] = time24.split(":");
    let hour = parseInt(hourStr, 10);

    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12; // converts 0 → 12, 13 → 1, etc.

    return `${hour}:${minute} ${ampm}`;
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
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
            <p>Loading weather data...</p>
          </div>
          {selectedLocationId === "current" && (
            <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              <p>If prompted, please allow location access.</p>
              <p style={{ marginTop: "0.5rem" }}>
                On mobile, check your browser settings if the prompt doesn't appear.
              </p>
            </div>
          )}
        </div>
      )}

      {/* No weather data state */}
      {!loading && !weather && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          <p style={{ marginBottom: "1rem" }}>
            {selectedLocationId === "current" 
              ? "Click refresh to get weather for your current location"
              : "Click refresh to view weather"}
          </p>
          {selectedLocationId === "current" && (
            <div style={{ 
              fontSize: "0.85rem", 
              padding: "1rem", 
              background: "rgba(255,255,255,0.02)", 
              borderRadius: "8px",
              marginTop: "1rem"
            }}>
              <p style={{ marginBottom: "0.5rem", fontWeight: "600" }}>
                📱 Location Access Required
              </p>
              <p style={{ marginBottom: "0.5rem" }}>
                This app needs access to your device location to show local weather.
              </p>
              <p style={{ fontSize: "0.8rem", marginTop: "0.75rem" }}>
                <strong>On Mobile:</strong> If the permission prompt doesn't appear, you may need to enable location access in your browser settings:
              </p>
              <ul style={{ textAlign: "left", fontSize: "0.8rem", marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                <li>Safari (iOS): Settings → Safari → Location → Allow</li>
                <li>Chrome (Android): Settings → Site Settings → Location → Allow</li>
              </ul>
            </div>
          )}
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
              flexWrap: "wrap",
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
              marginBottom: "1rem",
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

          {/* Astronomy Data */}
          {astronomy && (
            <>
              {/* Sun Information */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "1rem",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
                  ☀️ Sun Information
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
                      Sunrise
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.sunrise)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Sunset
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.sunset)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Day Length
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {astronomy.astronomy.day_length}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Solar Noon
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.solar_noon)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Altitude
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {astronomy.astronomy.sun_altitude.toFixed(2)}°
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Azimuth
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {astronomy.astronomy.sun_azimuth.toFixed(2)}°
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Distance
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {(astronomy.astronomy.sun_distance / 1000000).toFixed(2)}M km
                    </div>
                  </div>
                </div>
              </div>

              {/* Golden Hour & Blue Hour */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "1rem",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
                  🌅 Golden & Blue Hours
                </h4>
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                    Morning
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Golden Hour
                      </div>
                      <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                        {to12Hour(astronomy.astronomy.morning.golden_hour_begin)} - {to12Hour(astronomy.astronomy.morning.golden_hour_end)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Blue Hour
                      </div>
                      <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                        {to12Hour(astronomy.astronomy.morning.blue_hour_begin)} - {to12Hour(astronomy.astronomy.morning.blue_hour_end)}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.5rem" }}>
                    Evening
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Golden Hour
                      </div>
                      <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                        {to12Hour(astronomy.astronomy.evening.golden_hour_begin)} - {to12Hour(astronomy.astronomy.evening.golden_hour_end)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Blue Hour
                      </div>
                      <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                        {to12Hour(astronomy.astronomy.evening.blue_hour_begin)} - {to12Hour(astronomy.astronomy.evening.blue_hour_end)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Twilight Periods */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "1rem",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
                  🌆 Twilight Periods
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Civil (Morning)
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.morning.civil_twilight_begin)} - {to12Hour(astronomy.astronomy.morning.civil_twilight_end)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Civil (Evening)
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.evening.civil_twilight_begin)} - {to12Hour(astronomy.astronomy.evening.civil_twilight_end)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Nautical (Morning)
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.morning.nautical_twilight_begin)} - {to12Hour(astronomy.astronomy.morning.nautical_twilight_end)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Nautical (Evening)
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.evening.nautical_twilight_begin)} - {to12Hour(astronomy.astronomy.evening.nautical_twilight_end)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Astronomical (Morning)
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.morning.astronomical_twilight_begin)} - {to12Hour(astronomy.astronomy.morning.astronomical_twilight_end)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Astronomical (Evening)
                    </div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.evening.astronomical_twilight_begin)} - {to12Hour(astronomy.astronomy.evening.astronomical_twilight_end)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Moon Information */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  padding: "1rem",
                  borderRadius: "8px",
                }}
              >
                <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
                  🌙 Moon Information
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
                      Phase
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {astronomy.astronomy.moon_phase.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Illumination
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {Math.abs(parseFloat(astronomy.astronomy.moon_illumination_percentage)).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Moonrise
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.moonrise)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Moonset
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {to12Hour(astronomy.astronomy.moonset)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Altitude
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {astronomy.astronomy.moon_altitude.toFixed(2)}°
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Azimuth
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {astronomy.astronomy.moon_azimuth.toFixed(2)}°
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Distance
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {(astronomy.astronomy.moon_distance / 1000).toFixed(0)}k km
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Angle
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      {astronomy.astronomy.moon_angle.toFixed(2)}°
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}