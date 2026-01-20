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
  timeZone: { id: string };
  isDaytime: boolean;
  weatherCondition: {
    iconBaseUri: string;
    description: { text: string; languageCode: string };
    type: string;
  };
  temperature: { degrees: number; unit: string };
  feelsLikeTemperature: { degrees: number; unit: string };
  dewPoint: { degrees: number; unit: string };
  heatIndex: { degrees: number; unit: string };
  windChill: { degrees: number; unit: string };
  relativeHumidity: number;
  uvIndex: number;
  precipitation: {
    probability: { percent: number; type: string };
    snowQpf: { quantity: number; unit: string };
    qpf: { quantity: number; unit: string };
  };
  thunderstormProbability: number;
  airPressure: { meanSeaLevelMillibars: number };
  wind: {
    direction: { degrees: number; cardinal: string };
    speed: { value: number; unit: string };
    gust: { value: number; unit: string };
  };
  visibility: { distance: number; unit: string };
  cloudCover: number;
  currentConditionsHistory: {
    temperatureChange: { degrees: number; unit: string };
    maxTemperature: { degrees: number; unit: string };
    minTemperature: { degrees: number; unit: string };
    snowQpf: { quantity: number; unit: string };
    qpf: { quantity: number; unit: string };
  };
};

type HourlyForecast = {
  time: string;
  temperature: { degrees: number; unit: string };
  condition: string;
  precipProbability: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  icon: string;
};

type WeatherAlert = {
  event: string;
  severity: string;
  headline: string;
  description: string;
  instruction: string;
  onset: string;
  expires: string;
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
    sunrise: string;
    sunset: string;
    solar_noon: string;
    day_length: string;
    sun_altitude: number;
    moon_phase: string;
    moonrise: string;
    moonset: string;
    moon_illumination_percentage: string;
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
  };
};

export default function WeatherModule() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [astronomy, setAstronomy] = useState<AstronomyData | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("current");
  const [showLocationManager, setShowLocationManager] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<number | null>(null);

  useEffect(() => {
    fetchSavedLocations();
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
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

      // Fetch all weather data in parallel
      const [weatherRes, astronomyRes, hourlyRes, alertsRes] = await Promise.all([
        fetch(`/api/weather/current?latitude=${latitude}&longitude=${longitude}`),
        fetch(`/api/weather/astronomy?latitude=${latitude}&longitude=${longitude}`),
        fetch(`/api/weather/hourly?latitude=${latitude}&longitude=${longitude}`),
        fetch(`/api/weather/alerts?latitude=${latitude}&longitude=${longitude}`)
      ]);

      if (!weatherRes.ok) {
        const errorData = await weatherRes.json();
        throw new Error(errorData.error || "Failed to fetch weather");
      }

      const weatherData = await weatherRes.json();
      setWeather(weatherData);

      // Optional data - don't fail if unavailable
      if (astronomyRes.ok) {
        const astronomyData = await astronomyRes.json();
        setAstronomy(astronomyData);
      } else {
        console.warn("Failed to fetch astronomy data");
        setAstronomy(null);
      }

      if (hourlyRes.ok) {
        const hourlyData = await hourlyRes.json();
        setHourlyForecast(hourlyData.forecast || []);
      } else {
        console.warn("Failed to fetch hourly forecast");
        setHourlyForecast([]);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      } else {
        console.warn("Failed to fetch weather alerts");
        setAlerts([]);
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
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }

  function getSeverityColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case "extreme": return "#d63031";
      case "severe": return "#e17055";
      case "moderate": return "#fdcb6e";
      case "minor": return "#74b9ff";
      default: return "#dfe6e9";
    }
  }

  if (loading && !weather) {
    return (
      <div className="module-card">
        <h3>🌤️ Weather</h3>
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
          Loading weather data...
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="module-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>🌤️ Weather</h3>
        </div>
        
        {error && (
          <div style={{
            background: "rgba(255, 107, 107, 0.1)",
            border: "1px solid rgba(255, 107, 107, 0.3)",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1rem",
            fontSize: "0.9rem"
          }}>
            <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>⚠️ Location Access</div>
            <div style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
              {error}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              To use current location, please enable location permissions in your browser settings.
            </div>
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <button 
            className="btn primary"
            onClick={fetchWeatherForLocation} 
            style={{ width: "100%", marginBottom: "0.75rem" }}
          >
            <Icon name="crosshair" /> Try Current Location Again
          </button>
          
          <button 
            className="btn secondary"
            onClick={() => setShowLocationManager(true)}
            style={{ width: "100%" }}
          >
            <Icon name="map-pin" /> Add a Location Manually
          </button>
        </div>

        {savedLocations.length > 0 && (
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
              Or select a saved location:
            </div>
            {savedLocations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => setSelectedLocationId(loc.id)}
                style={{ 
                  width: "100%", 
                  marginBottom: "0.5rem",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
                  border: "1px solid rgba(255,255,255,0.03)",
                  borderRadius: "8px",
                  justifyContent: "flex-start",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem",
                  color: "#eef2f5",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(37, 244, 238, 0.3)";
                  e.currentTarget.style.background = "linear-gradient(180deg, rgba(37, 244, 238, 0.08), rgba(37, 244, 238, 0.04))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.background = "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))";
                }}
              >
                <Icon name="map-pin" />
                <span>{loc.city}, {loc.state}</span>
              </button>
            ))}
          </div>
        )}

        {/* Location Manager Modal */}
        {showLocationManager && (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem",
            borderRadius: "8px",
            marginTop: "1rem",
            border: "1px solid var(--border)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h4 style={{ margin: 0 }}>Add Location</h4>
              <button 
                className="cal-btn"
                onClick={() => setShowLocationManager(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={geocodeAndSaveLocation}>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="City"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  style={{
                    flex: "1 1 0",
                    minWidth: "0",
                    padding: "0.5rem",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "inherit",
                  }}
                />
                <input
                  type="text"
                  placeholder="State"
                  value={newState}
                  onChange={(e) => setNewState(e.target.value)}
                  style={{
                    flex: "0 0 80px",
                    minWidth: "0",
                    padding: "0.5rem",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "inherit",
                  }}
                />
              </div>
              <button type="submit" className="btn primary" disabled={geocoding} style={{ width: "100%" }}>
                {geocoding ? "Adding..." : "Add Location"}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const maxTemp = weather.currentConditionsHistory.maxTemperature.degrees;
  const minTemp = weather.currentConditionsHistory.minTemperature.degrees;
  const currentTemp = weather.temperature.degrees;

  return (
    <div className="module-card">
      {/* Header with Location Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
          <h3 style={{ margin: 0 }}>🌤️ Weather</h3>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "6px 10px",
              color: "inherit",
              fontSize: "0.85rem",
              cursor: "pointer",
              minWidth: "150px"
            }}
          >
            <option value="current">Current Location</option>
            {savedLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.city}, {loc.state}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button 
            className="cal-btn" 
            onClick={() => setShowLocationManager(!showLocationManager)}
            title={showLocationManager ? "Close" : "Add location"}
          >
            {showLocationManager ? "×" : <Icon name="plus" />}
          </button>
          <button 
            className="cal-btn" 
            onClick={fetchWeatherForLocation} 
            disabled={loading}
            title="Refresh weather"
          >
            <Icon name="refresh" />
          </button>
        </div>
      </div>

      {/* Location Manager Modal */}
      {showLocationManager && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
          border: "1px solid var(--border)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h4 style={{ margin: 0 }}>Add Location</h4>
            <button 
              className="cal-btn"
              onClick={() => setShowLocationManager(false)}
            >
              ×
            </button>
          </div>
          
          <form onSubmit={geocodeAndSaveLocation} style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                type="text"
                placeholder="City"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                style={{
                  flex: "1 1 0",
                  minWidth: "0",
                  padding: "0.5rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "inherit",
                }}
              />
              <input
                type="text"
                placeholder="State"
                value={newState}
                onChange={(e) => setNewState(e.target.value)}
                style={{
                  flex: "0 0 80px",
                  minWidth: "0",
                  padding: "0.5rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "inherit",
                }}
              />
            </div>
            <button type="submit" className="btn primary" disabled={geocoding} style={{ width: "100%" }}>
              {geocoding ? "Adding..." : "Add Location"}
            </button>
          </form>

          {savedLocations.length > 0 && (
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                Saved Locations:
              </div>
              {savedLocations.map((loc) => (
                <div
                  key={loc.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "6px",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "0.9rem" }}>
                    {loc.city}, {loc.state}
                  </span>
                  <button
                    className="btn secondary"
                    onClick={() => deleteLocation(loc.id)}
                    style={{ 
                      background: "rgba(214, 48, 49, 0.1)",
                      borderColor: "rgba(214, 48, 49, 0.3)",
                      color: "#d63031"
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weather Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              style={{
                background: `${getSeverityColor(alert.severity)}20`,
                border: `2px solid ${getSeverityColor(alert.severity)}`,
                borderRadius: "8px",
                padding: "0.75rem",
                marginBottom: "0.5rem",
                cursor: "pointer",
              }}
              onClick={() => setExpandedAlert(expandedAlert === idx ? null : idx)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "0.95rem", color: getSeverityColor(alert.severity) }}>
                    ⚠️ {alert.event}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                    Until {new Date(alert.expires).toLocaleString()}
                  </div>
                </div>
                <Icon name={expandedAlert === idx ? "chevron-up" : "chevron-down"} />
              </div>
              
              {expandedAlert === idx && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.85rem", lineHeight: "1.5" }}>
                  <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>{alert.headline}</div>
                  <div style={{ marginBottom: "0.5rem" }}>{alert.description}</div>
                  {alert.instruction && (
                    <div style={{ 
                      background: "rgba(255,255,255,0.05)", 
                      padding: "0.5rem", 
                      borderRadius: "4px",
                      marginTop: "0.5rem" 
                    }}>
                      <strong>Instructions:</strong> {alert.instruction}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current Conditions - Hero Section */}
      <div style={{
        background: "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))",
        padding: "1.5rem",
        borderRadius: "12px",
        marginBottom: "1rem",
        border: "1px solid rgba(59, 130, 246, 0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "4rem", fontWeight: "700", lineHeight: "1" }}>
              {Math.round(currentTemp)}°
            </div>
            <div style={{ fontSize: "1.1rem", marginTop: "0.5rem", color: "var(--muted)" }}>
              {weather.weatherCondition.description.text}
            </div>
            <div style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
              Feels like {formatTemperature(weather.feelsLikeTemperature)}
            </div>
            <div style={{ 
              marginTop: "0.75rem", 
              display: "flex", 
              gap: "1rem", 
              fontSize: "0.9rem" 
            }}>
              <span>H: {Math.round(maxTemp)}°</span>
              <span>L: {Math.round(minTemp)}°</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <img 
              src={`${weather.weatherCondition.iconBaseUri}.svg`}
              alt={weather.weatherCondition.description.text}
              style={{ width: "100px", height: "100px" }}
            />
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
              {weather.isDaytime ? "☀️ Day" : "🌙 Night"}
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Forecast Chart */}
      {hourlyForecast.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
          border: "1px solid var(--border)"
        }}>
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
            24-Hour Forecast
          </h4>
          
          {/* Horizontal scrollable chart container */}
          <div style={{
            overflowX: "auto",
            overflowY: "hidden",
            marginBottom: "1rem",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.2) rgba(255,255,255,0.05)"
          }}>
            <div style={{ minWidth: `${hourlyForecast.length * 60}px` }}>
              {/* Time labels at top */}
              <div style={{ display: "flex", marginBottom: "0.25rem" }}>
                {hourlyForecast.slice(0, 24).map((hour, idx) => {
                  const time = new Date(hour.time);
                  const hours = time.getHours();
                  const displayTime = hours === 0 ? "12A" : hours < 12 ? `${hours}A` : hours === 12 ? "12P" : `${hours - 12}P`;
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: "0 0 60px",
                        textAlign: "center",
                        fontSize: "0.7rem",
                        color: "var(--muted)",
                        fontWeight: hours % 3 === 0 ? "600" : "400"
                      }}
                    >
                      {displayTime}
                    </div>
                  );
                })}
              </div>

              {/* Weather icons row */}
              <div style={{ marginBottom: "0.5rem" }}>                
                <div style={{ display: "flex", height: "30px" }}>
                  {hourlyForecast.slice(0, 24).map((hour, idx) => (
                    <div
                      key={idx}
                      style={{
                        flex: "0 0 60px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center"
                      }}
                    >
                      <img 
                        src={hour.icon}
                        alt={hour.condition}
                        style={{ width: "28px", height: "28px" }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Temperature row */}
              <div style={{ marginBottom: "0.15rem" }}>                
                <div style={{ position: "relative", height: "60px" }}>
                  <div style={{ display: "flex" }}>
                    {hourlyForecast.slice(0, 24).map((hour, idx) => (
                      <div
                        key={idx}
                        style={{
                          flex: "0 0 60px",
                          textAlign: "center",
                          fontSize: "0.85rem",
                          fontWeight: "700",
                          color: "#fff"
                        }}
                      >
                        {Math.round(hour.temperature.degrees)}°
                      </div>
                    ))}
                  </div>
                  <svg style={{ position: "absolute", top: "20px", left: 0, width: "100%", height: "40px" }}>
                    <polyline
                      points={hourlyForecast.slice(0, 24).map((hour, idx) => {
                        const x = idx * 60 + 30;
                        const temp = hour.temperature.degrees;
                        const temps = hourlyForecast.slice(0, 24).map(h => h.temperature.degrees);
                        const maxTemp = Math.max(...temps);
                        const minTemp = Math.min(...temps);
                        const tempRange = maxTemp - minTemp || 1;
                        const y = 35 - ((temp - minTemp) / tempRange) * 30;
                        return `${x},${y}`;
                      }).join(" ")}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {hourlyForecast.slice(0, 24).map((hour, idx) => {
                      const x = idx * 60 + 30;
                      const temp = hour.temperature.degrees;
                      const temps = hourlyForecast.slice(0, 24).map(h => h.temperature.degrees);
                      const maxTemp = Math.max(...temps);
                      const minTemp = Math.min(...temps);
                      const tempRange = maxTemp - minTemp || 1;
                      const y = 35 - ((temp - minTemp) / tempRange) * 30;
                      return (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r="3"
                          fill="#3b82f6"
                        />
                      );
                    })}
                  </svg>
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.15rem", paddingLeft: "4px" }}>
                  🌡️ Temperature
                </div>
              </div>

              {/* Precipitation row */}
              <div style={{ marginBottom: "0.75rem" }}>                
                <div style={{ display: "flex", alignItems: "flex-end", height: "64px" }}>
                  {hourlyForecast.slice(0, 24).map((hour, idx) => {
                    const precip = hour.precipProbability || 0;
                    const height = Math.max(precip, 3);
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: "0 0 60px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          height: "100%"
                        }}
                      >
                        <div style={{
                          width: "30px",
                          height: `${height}%`,
                          background: `rgba(59, 130, 246, ${Math.max(0.2, 0.3 + (precip / 100) * 0.7)})`,
                          borderRadius: "2px 2px 0 0",
                          minHeight: "3px"
                        }} />
                        {precip > 0 && (
                          <div style={{ fontSize: "0.65rem", color: "#4dabf7", marginTop: "2px", height: "14px" }}>
                            {precip}%
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.25rem", paddingLeft: "4px" }}>
                  💧 Precipitation
                </div>
              </div>

              {/* Wind row */}
              <div style={{ marginBottom: "0.75rem" }}>                
                <div style={{ display: "flex", alignItems: "flex-end", height: "84px" }}>
                  {hourlyForecast.slice(0, 24).map((hour, idx) => {
                    const maxWind = Math.max(...hourlyForecast.slice(0, 24).map(h => h.windSpeed || 0), 1);
                    const windSpeed = hour.windSpeed || 0;
                    const height = (windSpeed / maxWind) * 100;
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: "0 0 60px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          height: "100%"
                        }}
                      >
                        {/* Wind direction arrow at top */}
                        <div style={{ 
                          fontSize: "1rem", 
                          height: "16px",
                          marginBottom: "2px",
                          transform: `rotate(${(hour.windDirection || 0)}deg)`,
                          color: "#84cc16",
                          opacity: windSpeed > 0 ? 1 : 0.3
                        }}>
                          ↓
                        </div>
                        {/* Wind speed bar */}
                        <div style={{
                          width: "30px",
                          height: `${Math.max(height, 5)}%`,
                          background: `rgba(132, 204, 22, ${Math.max(0.3, 0.3 + (height / 100) * 0.7)})`,
                          borderRadius: "2px 2px 0 0",
                          minHeight: "4px"
                        }} />
                        {/* Speed value */}
                        <div style={{ fontSize: "0.65rem", color: "#84cc16", marginTop: "2px", height: "14px" }}>
                          {Math.round(windSpeed)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.25rem", paddingLeft: "4px" }}>
                  🌬️ Wind
                </div>
              </div>

              {/* Humidity row */}
              <div style={{ marginBottom: "0.75rem" }}>                
                <div style={{ display: "flex", alignItems: "flex-end", height: "64px" }}>
                  {hourlyForecast.slice(0, 24).map((hour, idx) => {
                    const humidity = hour.humidity || 0;
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: "0 0 60px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          height: "100%"
                        }}
                      >
                        <div style={{
                          width: "30px",
                          height: `${humidity}%`,
                          background: `rgba(168, 85, 247, ${0.3 + (humidity / 100) * 0.7})`,
                          borderRadius: "2px 2px 0 0",
                          minHeight: "3px"
                        }} />
                        <div style={{ fontSize: "0.65rem", color: "#a855f7", marginTop: "2px", height: "14px" }}>
                          {humidity}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginBottom: "0.25rem", paddingLeft: "4px" }}>
                  💧 Humidity
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            fontSize: "0.7rem",
            color: "var(--muted)",
            justifyContent: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "#3b82f6", borderRadius: "2px" }} />
              <span>Temperature</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "rgba(59, 130, 246, 0.6)", borderRadius: "2px" }} />
              <span>Precipitation</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "rgba(132, 204, 22, 0.6)", borderRadius: "2px" }} />
              <span>Wind</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "rgba(168, 85, 247, 0.6)", borderRadius: "2px" }} />
              <span>Humidity</span>
            </div>
          </div>
        </div>
      )}

{/* Detailed Conditions Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1rem"
      }}>
        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            💧 Humidity
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {weather.relativeHumidity}%
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            🌬️ Wind
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {weather.wind.speed.value} mph
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            {weather.wind.direction.cardinal}
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            👁️ Visibility
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {weather.visibility.distance} mi
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            ☀️ UV Index
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {weather.uvIndex}
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            💨 Pressure
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {weather.airPressure.meanSeaLevelMillibars.toFixed(0)}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            mb
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            💧 Dew Point
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {Math.round(weather.dewPoint.degrees)}°
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            ☁️ Cloud Cover
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {weather.cloudCover}%
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", padding: "0.75rem", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
            🌧️ Rain Chance
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: "600" }}>
            {weather.precipitation.probability.percent}%
          </div>
        </div>
      </div>

      {/* Sun & Moon Information */}
      {astronomy && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
          border: "1px solid var(--border)"
        }}>
          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem" }}>
            ☀️ Sun & Moon
          </h4>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "0.75rem"
          }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Sunrise</div>
              <div style={{ fontSize: "1rem", fontWeight: "600" }}>
                {to12Hour(astronomy.astronomy.sunrise)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Sunset</div>
              <div style={{ fontSize: "1rem", fontWeight: "600" }}>
                {to12Hour(astronomy.astronomy.sunset)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Day Length</div>
              <div style={{ fontSize: "1rem", fontWeight: "600" }}>
                {astronomy.astronomy.day_length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Moon Phase</div>
              <div style={{ fontSize: "1rem", fontWeight: "600" }}>
                {astronomy.astronomy.moon_phase.replace(/_/g, " ")}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Moonrise</div>
              <div style={{ fontSize: "1rem", fontWeight: "600" }}>
                {to12Hour(astronomy.astronomy.moonrise)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Moon Illum.</div>
              <div style={{ fontSize: "1rem", fontWeight: "600" }}>
                {Math.abs(parseFloat(astronomy.astronomy.moon_illumination_percentage)).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div style={{ 
        textAlign: "center", 
        fontSize: "0.75rem", 
        color: "var(--muted)",
        marginTop: "1rem" 
      }}>
        Last updated: {formatTime(weather.currentTime)}
      </div>
    </div>
  );
}