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
        height: "50px", 
        position: "relative",
        borderRadius: "4px",
        overflow: "hidden"
      }}>
        {/* Render daylight periods as colored bands based on exact times */}
        {(() => {
          // Helper function to parse HH:MM time string to minutes since midnight
          const parseTime = (time: string) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
          };
          
          // Get the time range from hourly forecast (first and last hour)
          const firstHour = new Date(hourlyForecast[0].time);
          const lastHour = new Date(hourlyForecast[hourlyForecast.length - 1].time);
          
          // Use actual timestamps to handle midnight rollover
          // Adjust by -30 minutes to center on hour markers (since labels are centered)
          const startTimestamp = firstHour.getTime() - (30 * 60 * 1000);
          const endTimestamp = lastHour.getTime() + (30 * 60 * 1000);
          const totalMilliseconds = endTimestamp - startTimestamp;
          
          // Helper to convert a time string to position in our display
          const getPositionPercent = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            
            // Create a date for this time, handling which day it's on
            let eventDate = new Date(firstHour);
            eventDate.setHours(h, m, 0, 0);
            
            // If the event time is before the start time, it must be on the next day
            if (eventDate.getTime() < startTimestamp) {
              eventDate.setDate(eventDate.getDate() + 1);
            }
            
            const eventTimestamp = eventDate.getTime();
            const offsetMilliseconds = eventTimestamp - startTimestamp;
            
            return (offsetMilliseconds / totalMilliseconds) * 100;
          };
          
          // Define all the specific twilight/day periods with their exact times
          const specificPeriods = [
            {
              name: "Astronomical Twilight",
              start: astronomy.astronomy.morning.astronomical_twilight_begin,
              end: astronomy.astronomy.morning.astronomical_twilight_end,
              color: "#1e293b"
            },
            {
              name: "Nautical Twilight",
              start: astronomy.astronomy.morning.nautical_twilight_begin,
              end: astronomy.astronomy.morning.nautical_twilight_end,
              color: "#334155"
            },
            {
              name: "Civil Twilight",
              start: astronomy.astronomy.morning.civil_twilight_begin,
              end: astronomy.astronomy.morning.civil_twilight_end,
              color: "#64748b"
            },
            {
              name: "Daylight",
              start: astronomy.astronomy.sunrise,
              end: astronomy.astronomy.sunset,
              color: "#87ceeb"
            },
            {
              name: "Civil Twilight",
              start: astronomy.astronomy.evening.civil_twilight_begin,
              end: astronomy.astronomy.evening.civil_twilight_end,
              color: "#64748b"
            },
            {
              name: "Nautical Twilight",
              start: astronomy.astronomy.evening.nautical_twilight_begin,
              end: astronomy.astronomy.evening.nautical_twilight_end,
              color: "#334155"
            },
            {
              name: "Astronomical Twilight",
              start: astronomy.astronomy.evening.astronomical_twilight_begin,
              end: astronomy.astronomy.evening.astronomical_twilight_end,
              color: "#1e293b"
            }
          ];
          
          // First, render all specific periods
          const renderedPeriods = specificPeriods.map((period, idx) => {
            const startPercent = getPositionPercent(period.start);
            const endPercent = getPositionPercent(period.end);
            
            // Only render if the period is visible in our range
            if (endPercent < 0 || startPercent > 100) return null;
            
            const leftPercent = Math.max(0, startPercent);
            const rightPercent = Math.min(100, endPercent);
            const widthPercent = rightPercent - leftPercent;
            
            if (widthPercent <= 0) return null;
            
            return (
              <div
                key={`${period.name}-${idx}`}
                style={{
                  position: "absolute",
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  height: "100%",
                  background: period.color,
                  borderRight: "1px solid rgba(255,255,255,0.05)",
                  zIndex: 1,
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
          
          // Now add Night as the background for everything else
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
                  zIndex: 0,
                  cursor: "pointer"
                }}
                title="Night"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPeriod({
                    name: "Night",
                    start: astronomy.astronomy.evening.astronomical_twilight_end,
                    end: astronomy.astronomy.morning.astronomical_twilight_begin,
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
          if (idx % 3 !== 0) return null; // Show every 3 hours
          
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
          // Adjust by -30 minutes to center on hour markers
          const startTimestamp = firstHour.getTime() - (30 * 60 * 1000);
          const endTimestamp = lastHour.getTime() + (30 * 60 * 1000);
          const totalMilliseconds = endTimestamp - startTimestamp;
          
          const getPositionPercent = (timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            let eventDate = new Date(firstHour);
            eventDate.setHours(h, m, 0, 0);
            
            if (eventDate.getTime() < startTimestamp) {
              eventDate.setDate(eventDate.getDate() + 1);
            }
            
            const eventTimestamp = eventDate.getTime();
            const offsetMilliseconds = eventTimestamp - startTimestamp;
            
            return (offsetMilliseconds / totalMilliseconds) * 100;
          };
          
          const events = [
            { time: astronomy.astronomy.sunrise, text: "Sunrise", color: "#fb923c" },
            { time: astronomy.astronomy.solar_noon, text: "Solar Noon", color: "#fbbf24" },
            { time: astronomy.astronomy.sunset, text: "Sunset", color: "#fb923c" },
            { time: astronomy.astronomy.moonrise, text: "Moonrise", color: "#000000" },
            { time: astronomy.astronomy.moonset, text: "Moonset", color: "#000000" },
          ];
          
          return events.map((event, idx) => {
            const leftPercent = getPositionPercent(event.time);
            
            // Only render if event is within visible range
            if (leftPercent < 0 || leftPercent > 100) {
              return null;
            }
            
            return (
              <div
                key={`event-${idx}`}
                style={{
                  position: "absolute",
                  left: `${leftPercent}%`,
                  top: 0,
                  bottom: 0,
                  width: "2px",
                  background: event.color,
                  zIndex: 2
                }}
                title={`${event.text} ${event.time}`}
              >
                {/* Label in the middle of the chart - vertical stacked text */}
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
                  gap: "1px"
                }}>
                  <span>{event.text}</span>
                  <span style={{ opacity: 0.9, fontSize: "0.5rem" }}>{to12Hour(event.time)}</span>
                </div>
              </div>
            );
          });
        })()}
      </div>
      
      {/* Context Menu */}
      {selectedPeriod && (
        <div
          style={{
            position: "fixed",
            left: `${selectedPeriod.x}px`,
            top: `${selectedPeriod.y}px`,
            background: "rgba(0, 0, 0, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "6px",
            padding: "0.75rem",
            zIndex: 1000,
            minWidth: "180px",
            fontSize: "0.75rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
            transform: "translate(-50%, -100%) translateY(-10px)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: "600", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
            {selectedPeriod.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", color: "var(--muted)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Start:</span>
              <span style={{ color: "#fff" }}>{to12Hour(selectedPeriod.start)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>End:</span>
              <span style={{ color: "#fff" }}>{to12Hour(selectedPeriod.end)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", paddingTop: "0.25rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <span>Duration:</span>
              <span style={{ color: "#fff", fontWeight: "600" }}>
                {calculateDuration(selectedPeriod.start, selectedPeriod.end)}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Legend - only twilight periods */}
      {/* <div style={{ 
        display: "flex", 
        flexWrap: "wrap",
        gap: "0.5rem",
        marginTop: "0.75rem",
        fontSize: "0.65rem",
        justifyContent: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "12px", height: "12px", background: "#0f172a", borderRadius: "2px", border: "1px solid rgba(255,255,255,0.3)" }} />
          <span>Night</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "12px", height: "12px", background: "#1e293b", borderRadius: "2px", border: "1px solid rgba(255,255,255,0.3)" }} />
          <span>Astronomical</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "12px", height: "12px", background: "#334155", borderRadius: "2px", border: "1px solid rgba(255,255,255,0.3)" }} />
          <span>Nautical</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "12px", height: "12px", background: "#64748b", borderRadius: "2px", border: "1px solid rgba(255,255,255,0.3)" }} />
          <span>Civil</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: "12px", height: "12px", background: "#87ceeb", borderRadius: "2px", border: "1px solid rgba(255,255,255,0.3)" }} />
          <span>Daylight</span>
        </div>
      </div> */}
    </div>
  );
}