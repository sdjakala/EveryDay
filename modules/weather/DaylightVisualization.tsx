import React, { useState, useEffect } from 'react';

interface DaylightVisualizationProps {
  astronomy: any;
  hourlyForecast: any[];
}

export function DaylightVisualization({ astronomy, hourlyForecast }: DaylightVisualizationProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<{
    name: string;
    start: string;
    end: string;
    cloudCover?: number;
    x: number;
    y: number;
  } | null>(null);

  // Helper to calculate duration between two times
  const calculateDuration = (startTime: string, endTime: string) => {
    const parseTime = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    
    let startMinutes = parseTime(startTime);
    let endMinutes = parseTime(endTime);
    
    // Handle midnight rollover
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    
    const totalMinutes = endMinutes - startMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };

  // Convert 24-hour time to 12-hour format
  const to12Hour = (time24: string) => {
    const [hourStr, minute] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setSelectedPeriod(null);
    if (selectedPeriod) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [selectedPeriod]);

  return (
    <div style={{ marginBottom: "1rem", position: "relative" }}>
      <div style={{ 
        height: "40px", 
        position: "relative",
        borderRadius: "4px",
        overflow: "hidden"
      }}>
        {/* Render daylight periods as colored bands based on exact times */}
        {(() => {
          // Get the time range from hourly forecast (first and last hour)
          const firstHour = new Date(hourlyForecast[0].time);
          const lastHour = new Date(hourlyForecast[hourlyForecast.length - 1].time);
          
          // Use actual timestamps to handle midnight rollover
          // Adjust by -30 minutes to center on hour markers (since labels are centered)
          const startTimestamp = firstHour.getTime() - (30 * 60 * 1000);
          const endTimestamp = lastHour.getTime() + (30 * 60 * 1000);
          const totalMilliseconds = endTimestamp - startTimestamp;
          
          // Check if we cross midnight (next day periods needed)
          const crossesMidnight = lastHour.getDate() !== firstHour.getDate();
          
          // Helper to convert a time string to position in our display
          const getPositionPercent = (timeStr: string, useNextDay: boolean = false) => {
            const [h, m] = timeStr.split(':').map(Number);
            
            // Create a date for this time
            let eventDate = new Date(firstHour);
            eventDate.setHours(h, m, 0, 0);
            
            // If useNextDay is true, explicitly use next day
            if (useNextDay) {
              eventDate.setDate(eventDate.getDate() + 1);
            }
            
            const eventTimestamp = eventDate.getTime();
            const offsetMilliseconds = eventTimestamp - startTimestamp;
            
            return (offsetMilliseconds / totalMilliseconds) * 100;
          };
          
          // Define periods for TODAY (current day)
          const todayPeriods = [
            {
              name: "Astronomical Twilight (Morning)",
              start: astronomy.astronomy.morning.astronomical_twilight_begin,
              end: astronomy.astronomy.morning.astronomical_twilight_end,
              color: "#1e293b",
              zIndex: 2,
              useNextDay: false
            },
            {
              name: "Nautical Twilight (Morning)",
              start: astronomy.astronomy.morning.nautical_twilight_begin,
              end: astronomy.astronomy.morning.nautical_twilight_end,
              color: "#334155",
              zIndex: 3,
              useNextDay: false
            },
            {
              name: "Civil Twilight (Morning)",
              start: astronomy.astronomy.morning.civil_twilight_begin,
              end: astronomy.astronomy.morning.civil_twilight_end,
              color: "#64748b",
              zIndex: 4,
              useNextDay: false
            },
            {
              name: "Daylight",
              start: astronomy.astronomy.sunrise,
              end: astronomy.astronomy.sunset,
              color: "#87ceeb",
              zIndex: 5,
              useNextDay: false
            },
            {
              name: "Civil Twilight (Evening)",
              start: astronomy.astronomy.evening.civil_twilight_begin,
              end: astronomy.astronomy.evening.civil_twilight_end,
              color: "#64748b",
              zIndex: 4,
              useNextDay: false
            },
            {
              name: "Nautical Twilight (Evening)",
              start: astronomy.astronomy.evening.nautical_twilight_begin,
              end: astronomy.astronomy.evening.nautical_twilight_end,
              color: "#334155",
              zIndex: 3,
              useNextDay: false
            },
            {
              name: "Astronomical Twilight (Evening)",
              start: astronomy.astronomy.evening.astronomical_twilight_begin,
              end: astronomy.astronomy.evening.astronomical_twilight_end,
              color: "#1e293b",
              zIndex: 2,
              useNextDay: false
            }
          ];
          
          // Add TOMORROW's morning periods if we cross midnight
          const allPeriods = [...todayPeriods];
          
          if (crossesMidnight) {
            // Add tomorrow's morning periods
            allPeriods.push(
              {
                name: "Astronomical Twilight (Morning)",
                start: astronomy.astronomy.morning.astronomical_twilight_begin,
                end: astronomy.astronomy.morning.astronomical_twilight_end,
                color: "#1e293b",
                zIndex: 2,
                useNextDay: true
              },
              {
                name: "Nautical Twilight (Morning)",
                start: astronomy.astronomy.morning.nautical_twilight_begin,
                end: astronomy.astronomy.morning.nautical_twilight_end,
                color: "#334155",
                zIndex: 3,
                useNextDay: true
              },
              {
                name: "Civil Twilight (Morning)",
                start: astronomy.astronomy.morning.civil_twilight_begin,
                end: astronomy.astronomy.morning.civil_twilight_end,
                color: "#64748b",
                zIndex: 4,
                useNextDay: true
              },
              {
                name: "Daylight (Next Day)",
                start: astronomy.astronomy.sunrise,
                end: astronomy.astronomy.sunset,
                color: "#87ceeb",
                zIndex: 5,
                useNextDay: true
              }
            );
          }
          
          // Render all periods
          const renderedPeriods = allPeriods.map((period, idx) => {
            const startPercent = getPositionPercent(period.start, period.useNextDay);
            const endPercent = getPositionPercent(period.end, period.useNextDay);
            
            // Clamp to visible range [0, 100]
            const leftPercent = Math.max(0, Math.min(100, startPercent));
            const rightPercent = Math.max(0, Math.min(100, endPercent));
            const widthPercent = rightPercent - leftPercent;
            
            // Don't render if width is zero or negative, or completely outside range
            if (widthPercent <= 0 || endPercent < 0 || startPercent > 100) {
              return null;
            }
            
            return (
              <div
                key={`${period.name}-${idx}-${period.useNextDay ? 'next' : 'today'}`}
                style={{
                  position: "absolute",
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  height: "100%",
                  background: period.color,
                  borderRight: "1px solid rgba(255,255,255,0.05)",
                  zIndex: period.zIndex,
                  cursor: "pointer"
                }}
                title={`${period.name} (${period.start}-${period.end})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod({
                    name: period.name,
                    start: period.start,
                    end: period.end,
                    x: e.clientX,
                    y: e.clientY
                  });
                }}
              />
            );
          });
          
          // Calculate night period
          const nightStart = astronomy.astronomy.evening.astronomical_twilight_end;
          const nightEnd = astronomy.astronomy.morning.astronomical_twilight_begin;
          
          // Night background - fills the entire chart
          return (
            <>
              {/* Night background - fills the entire chart */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  width: "100%",
                  height: "100%",
                  background: "#0f172a",
                  zIndex: 1,
                  cursor: "pointer"
                }}
                title={`Night (${nightStart}-${nightEnd})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod({
                    name: "Night",
                    start: nightStart,
                    end: nightEnd,
                    x: e.clientX,
                    y: e.clientY
                  });
                }}
              />
              {/* Specific periods render on top */}
              {renderedPeriods}
            </>
          );
        })()}
        
        {/* Time labels at key hours */}
        {hourlyForecast.slice(0, 24).map((hour, idx) => {
          if (idx % 3 !== 0) return null;
          
          const hourTime = new Date(hour.time);
          const hours = hourTime.getHours();
          const displayTime = hours === 0 ? "12A" : hours < 12 ? `${hours}A` : hours === 12 ? "12P" : `${hours - 12}P`;
          
          return (
            <div
              key={`time-${idx}`}
              style={{
                position: "absolute",
                left: `${(idx / 24) * 100}%`,
                top: "100%",
                transform: "translateX(-50%)",
                fontSize: "0.6rem",
                color: "var(--muted)",
                marginTop: "2px",
                fontWeight: "600"
              }}
            >
              {displayTime}
            </div>
          );
        })}
        
        {/* Add event markers: sunrise, sunset, solar noon, moonrise, moonset */}
        {(() => {
          const firstHour = new Date(hourlyForecast[0].time);
          const lastHour = new Date(hourlyForecast[hourlyForecast.length - 1].time);
          const startTimestamp = firstHour.getTime() - (30 * 60 * 1000);
          const endTimestamp = lastHour.getTime() + (30 * 60 * 1000);
          const totalMilliseconds = endTimestamp - startTimestamp;
          const crossesMidnight = lastHour.getDate() !== firstHour.getDate();
          
          const getPositionPercent = (timeStr: string, useNextDay: boolean = false) => {
            const [h, m] = timeStr.split(':').map(Number);
            let eventDate = new Date(firstHour);
            eventDate.setHours(h, m, 0, 0);
            
            if (useNextDay) {
              eventDate.setDate(eventDate.getDate() + 1);
            }
            
            const eventTimestamp = eventDate.getTime();
            const offsetMilliseconds = eventTimestamp - startTimestamp;
            
            return (offsetMilliseconds / totalMilliseconds) * 100;
          };
          
          const todayEvents = [
            { time: astronomy.astronomy.sunrise, text: "Sunrise", color: "#fb923c", useNextDay: false },
            { time: astronomy.astronomy.solar_noon, text: "Solar Noon", color: "#fbbf24", useNextDay: false },
            { time: astronomy.astronomy.sunset, text: "Sunset", color: "#fb923c", useNextDay: false },
            { time: astronomy.astronomy.moonrise, text: "Moonrise", color: "#9333ea", useNextDay: false },
            { time: astronomy.astronomy.moonset, text: "Moonset", color: "#9333ea", useNextDay: false },
          ];
          
          const allEvents = [...todayEvents];
          
          // Add tomorrow's sunrise if we cross midnight
          if (crossesMidnight) {
            allEvents.push(
              { time: astronomy.astronomy.sunrise, text: "Sunrise", color: "#fb923c", useNextDay: true }
            );
          }
          
          return allEvents.map((event, idx) => {
            const leftPercent = getPositionPercent(event.time, event.useNextDay);
            
            if (leftPercent < 0 || leftPercent > 100) {
              return null;
            }
            
            return (
              <div
                key={`event-${idx}-${event.useNextDay ? 'next' : 'today'}`}
                style={{
                  position: "absolute",
                  left: `${leftPercent}%`,
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  background: event.color,
                  zIndex: 10
                }}
                title={`${event.text} ${event.time}`}
              >
                <div style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%) rotate(-90deg)",
                  fontSize: "0.55rem",
                  color: event.color,
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1px",
                  pointerEvents: "none"
                }}>
                  <span>{event.text}</span>
                  <span style={{ opacity: 0.9, fontSize: "0.5rem" }}>{to12Hour(event.time)}</span>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Cloud Cover Bar */}
      <div style={{
        height: "10px",
        position: "relative",
        marginTop: "2px",
        borderRadius: "2px",
        overflow: "hidden",
        background: "transparent"
      }}>
        <div style={{ display: "flex", height: "100%" }}>
          {hourlyForecast.slice(0, 24).map((hour, idx) => {
            const cloudCover = hour.cloudCover || 0;
            const opacity = cloudCover / 100;
            const hourTime = new Date(hour.time);
            const hours = hourTime.getHours();
            const displayTime = hours === 0 ? "12A" : hours < 12 ? `${hours}A` : hours === 12 ? "12P" : `${hours - 12}P`;
            
            return (
              <div
                key={`cloud-${idx}`}
                style={{
                  flex: "0 0 60px",
                  background: `rgba(128, 128, 128, ${opacity})`,
                  borderRight: idx < 23 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  cursor: "pointer"
                }}
                title={`${displayTime}: ${cloudCover}% cloud cover`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod({
                    name: `${displayTime} Cloud Cover`,
                    start: `${hours.toString().padStart(2, '0')}:00`,
                    end: `${((hours + 1) % 24).toString().padStart(2, '0')}:00`,
                    x: e.clientX,
                    y: e.clientY,
                    cloudCover: cloudCover
                  });
                }}
              />
            );
          })}
        </div>
      </div>

      
      
      {/* Popup for period details */}
      {selectedPeriod && (
        <div
          style={{
            position: "fixed",
            left: selectedPeriod.x + 10,
            top: selectedPeriod.y + 10,
            background: "rgba(0, 0, 0, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "8px",
            padding: "0.75rem",
            zIndex: 1000,
            minWidth: "180px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: "600", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            {selectedPeriod.name}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {!selectedPeriod.name.includes("Cloud Cover") && (
              <>
                <div>Start: {to12Hour(selectedPeriod.start)}</div>
                <div>End: {to12Hour(selectedPeriod.end)}</div>
                <div style={{ marginTop: "0.25rem", paddingTop: "0.25rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                  Duration: {calculateDuration(selectedPeriod.start, selectedPeriod.end)}
                </div>
              </>                
            )}
            
            {selectedPeriod.cloudCover !== undefined && (
              <div style={{ 
                marginTop: "0.5rem", 
                paddingTop: "0.5rem", 
                borderTop: "1px solid rgba(255,255,255,0.1)" 
              }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  marginBottom: "0.35rem"
                }}>
                  <span>☁️ Cloud Cover:</span>
                  <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                    {selectedPeriod.cloudCover}%
                  </span>
                </div>
                <div style={{ 
                  fontSize: "0.75rem", 
                  color: "var(--muted)",
                  fontStyle: "italic"
                }}>
                  {selectedPeriod.cloudCover === 0 ? "Clear skies" :
                   selectedPeriod.cloudCover < 25 ? "Mostly clear" :
                   selectedPeriod.cloudCover < 50 ? "Partly cloudy" :
                   selectedPeriod.cloudCover < 75 ? "Mostly cloudy" :
                   selectedPeriod.cloudCover < 90 ? "Cloudy" :
                   "Overcast"}
                </div>
                <div style={{
                  marginTop: "0.35rem",
                  height: "4px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "2px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    height: "100%",
                    width: `${selectedPeriod.cloudCover}%`,
                    background: "linear-gradient(90deg, #94a3b8, #64748b)",
                    transition: "width 0.3s ease"
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}