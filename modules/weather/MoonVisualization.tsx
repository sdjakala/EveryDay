import React, { useState } from 'react';

interface MoonVisualizationProps {
  astronomy: {
    moon_phase: string;
    moonrise: string;
    moonset: string;
    moon_status?: string;
    moon_altitude?: number;
    moon_distance?: number;
    moon_azimuth?: number;
    moon_parallactic_angle?: number;
    moon_illumination_percentage: string;
    moon_angle?: number;
  };
}

export function MoonVisualization({ astronomy }: MoonVisualizationProps) {
  const [selectedView, setSelectedView] = useState<'phase' | 'position' | 'details'>('phase');

  // Helper to convert 24-hour time to 12-hour format
  const to12Hour = (time24: string) => {
    if (!time24 || time24 === 'N/A') return 'N/A';
    const [hourStr, minute] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Get moon phase emoji and name
  const getMoonPhaseInfo = (phase: string) => {
    const phaseMap: Record<string, { emoji: string; name: string; description: string }> = {
      'new_moon': { 
        emoji: '🌑', 
        name: 'New Moon',
        description: 'Moon is between Earth and Sun'
      },
      'waxing_crescent': { 
        emoji: '🌒', 
        name: 'Waxing Crescent',
        description: 'Moon is growing'
      },
      'first_quarter': { 
        emoji: '🌓', 
        name: 'First Quarter',
        description: 'Half moon, waxing'
      },
      'waxing_gibbous': { 
        emoji: '🌔', 
        name: 'Waxing Gibbous',
        description: 'More than half illuminated'
      },
      'full_moon': { 
        emoji: '🌕', 
        name: 'Full Moon',
        description: 'Fully illuminated'
      },
      'waning_gibbous': { 
        emoji: '🌖', 
        name: 'Waning Gibbous',
        description: 'Decreasing from full'
      },
      'last_quarter': { 
        emoji: '🌗', 
        name: 'Last Quarter',
        description: 'Half moon, waning'
      },
      'waning_crescent': { 
        emoji: '🌘', 
        name: 'Waning Crescent',
        description: 'Thin crescent, waning'
      }
    };
    return phaseMap[phase] || { emoji: '🌕', name: phase.replace(/_/g, ' '), description: '' };
  };

  const moonPhase = getMoonPhaseInfo(astronomy.moon_phase);
  const illumination = Math.abs(parseFloat(astronomy.moon_illumination_percentage || '0'));

  // Render moon phase visual
  const renderMoonPhase = () => {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '1rem'
      }}>
        {/* Moon Visual */}
        <div style={{ 
          position: 'relative', 
          width: '160px', 
          height: '160px',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            <defs>
              {/* Shadow gradient for dark part */}
              <radialGradient id="shadowGradient">
                <stop offset="20%" stopColor="#3a3a3a" />
                <stop offset="80%" stopColor="#505050" />
                <stop offset="100%" stopColor="#5a5a5a" />
              </radialGradient>
              {/* Light gradient for illuminated part */}
              <radialGradient id="lightGradient">
                <stop offset="0%" stopColor="#f0f0f0" />
                <stop offset="70%" stopColor="#e5e5e5" />
                <stop offset="100%" stopColor="#d0d0d0" />
              </radialGradient>
            </defs>
            
            {/* Full moon circle (shadow part) */}
            <circle 
              cx="80" 
              cy="80" 
              r="75" 
              fill="url(#shadowGradient)"
            />
            
            {/* Illuminated crescent */}
            {(() => {
              // Determine if waxing or waning
              const isWaxing = astronomy.moon_phase.toLowerCase().includes('waxing') || 
                              astronomy.moon_phase.toLowerCase().includes('new') ||
                              astronomy.moon_phase === 'first_quarter';
              
              if (illumination < 1) {
                // New moon - all dark
                return null;
              } else if (illumination > 99) {
                // Full moon - cover entire circle
                return (
                  <circle 
                    cx="80" 
                    cy="80" 
                    r="75" 
                    fill="url(#lightGradient)"
                  />
                );
              }
              
              // Calculate the terminator line position
              // For waxing: light appears from right edge (0%) to center (50%) to left edge (100%)
              // For waning: light appears from left edge (100%) to center (50%) to right edge (0%)
              
              const phase = illumination / 100; // 0 to 1
              
              if (isWaxing) {
                // Waxing phases
                if (phase <= 0.5) {
                  // Waxing Crescent to First Quarter (0-50%)
                  // Crescent on the right side
                  const offset = (0.5 - phase) * 2; // 1 to 0
                  const width = 75 * (1 - offset);
                  
                  return (
                    <ellipse
                      cx={80 + 75 - width}
                      cy="80"
                      rx={width}
                      ry="75"
                      fill="url(#lightGradient)"
                    />
                  );
                } else {
                  // First Quarter to Full (50-100%)
                  // Most of moon illuminated, shadow on left shrinking
                  const offset = (phase - 0.5) * 2; // 0 to 1
                  const shadowWidth = 75 * (1 - offset);
                  
                  return (
                    <>
                      <circle cx="80" cy="80" r="75" fill="url(#lightGradient)" />
                      <ellipse
                        cx={80 - 75 + shadowWidth}
                        cy="80"
                        rx={shadowWidth}
                        ry="75"
                        fill="url(#shadowGradient)"
                      />
                    </>
                  );
                }
              } else {
                // Waning phases
                if (phase >= 0.5) {
                  // Full to Last Quarter (100-50%)
                  // Shadow appears on right
                  const offset = (phase - 0.5) * 2; // 1 to 0
                  const shadowWidth = 75 * (1 - offset);
                  
                  return (
                    <>
                      <circle cx="80" cy="80" r="75" fill="url(#lightGradient)" />
                      <ellipse
                        cx={80 + 75 - shadowWidth}
                        cy="80"
                        rx={shadowWidth}
                        ry="75"
                        fill="url(#shadowGradient)"
                      />
                    </>
                  );
                } else {
                  // Last Quarter to New Moon (50-0%)
                  // Crescent on left side
                  const offset = phase * 2; // 1 to 0
                  const width = 75 * offset;
                  
                  return (
                    <ellipse
                      cx={80 - 75 + width}
                      cy="80"
                      rx={width}
                      ry="75"
                      fill="url(#lightGradient)"
                    />
                  );
                }
              }
            })()}
            
            {/* Add subtle craters on illuminated parts only */}
            {illumination > 10 && (
              <>
                <circle cx="90" cy="70" r="6" fill="rgba(0,0,0,0.08)" />
                <circle cx="100" cy="95" r="4" fill="rgba(0,0,0,0.08)" />
                <circle cx="85" cy="105" r="5" fill="rgba(0,0,0,0.08)" />
              </>
            )}
          </svg>
        </div>

        {/* Phase Info */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '1.3rem', 
            fontWeight: '700',
            marginBottom: '0.25rem'
          }}>
            Moon: {illumination.toFixed(1)}%
          </div>
          <div style={{ 
            fontSize: '1rem', 
            fontWeight: '500',
            color: '#6b9bd1',
            marginBottom: '0.5rem'
          }}>
            {moonPhase.name}
          </div>
        </div>

        {/* Rise/Set Times */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          width: '100%',
          marginTop: '1rem'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--muted)',
              marginBottom: '0.25rem'
            }}>
              🌔 Moonrise
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
              {to12Hour(astronomy.moonrise)}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--muted)',
              marginBottom: '0.25rem'
            }}>
              🌘 Moonset
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
              {to12Hour(astronomy.moonset)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render position visualization
  const renderPosition = () => {
    const altitude = astronomy.moon_altitude || 0;
    const azimuth = astronomy.moon_azimuth || 0;
    const status = astronomy.moon_status || 'Unknown';

    // Convert azimuth to compass direction
    const getCompassDirection = (degrees: number) => {
      const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                         'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      const index = Math.round(degrees / 22.5) % 16;
      return directions[index];
    };

    // Calculate position on polar plot
    const angleRad = (azimuth - 90) * (Math.PI / 180); // -90 to start from top
    const radius = ((90 - altitude) / 90) * 70; // 0 at center (90°), 70 at edge (0°)
    const x = 90 + radius * Math.cos(angleRad);
    const y = 90 + radius * Math.sin(angleRad);

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: '1.5rem'
      }}>
        {/* Status Badge */}
        <div style={{
          background: status.toLowerCase().includes('above') 
            ? 'rgba(34, 197, 94, 0.2)' 
            : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${status.toLowerCase().includes('above') 
            ? 'rgba(34, 197, 94, 0.5)' 
            : 'rgba(239, 68, 68, 0.5)'}`,
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          fontSize: '0.9rem',
          fontWeight: '600'
        }}>
          {status}
        </div>

        {/* Polar Position Chart */}
        <div style={{ position: 'relative', width: '180px', height: '180px' }}>
          {/* Background circles */}
          <svg width="180" height="180" style={{ position: 'absolute' }}>
            {/* Circles for altitude */}
            <circle cx="90" cy="90" r="70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <circle cx="90" cy="90" r="47" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <circle cx="90" cy="90" r="23" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            
            {/* Cross lines for cardinal directions */}
            <line x1="90" y1="20" x2="90" y2="160" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <line x1="20" y1="90" x2="160" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            
            {/* Cardinal direction labels */}
            <text x="90" y="15" fill="var(--muted)" fontSize="10" textAnchor="middle">N</text>
            <text x="165" y="93" fill="var(--muted)" fontSize="10" textAnchor="middle">E</text>
            <text x="90" y="172" fill="var(--muted)" fontSize="10" textAnchor="middle">S</text>
            <text x="15" y="93" fill="var(--muted)" fontSize="10" textAnchor="middle">W</text>
            
            {/* Moon position marker */}
            <circle cx={x} cy={y} r="8" fill="#ffd700" stroke="white" strokeWidth="2" />
            <circle cx={x} cy={y} r="12" fill="none" stroke="#ffd700" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>

        {/* Position Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          width: '100%'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--muted)',
              marginBottom: '0.25rem'
            }}>
              ↑ Altitude
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '600' }}>
              {altitude.toFixed(1)}°
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--muted)',
              marginBottom: '0.25rem'
            }}>
              🧭 Azimuth
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '600' }}>
              {azimuth.toFixed(1)}°
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              color: 'var(--muted)',
              marginTop: '0.15rem'
            }}>
              {getCompassDirection(azimuth)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render detailed measurements
  const renderDetails = () => {
    const distance = astronomy.moon_distance || 384400;
    const parallacticAngle = astronomy.moon_parallactic_angle || 0;
    const moonAngle = astronomy.moon_angle || 0;

    // Calculate distance in miles
    const distanceMiles = distance * 0.621371;

    // Determine if moon is at perigee or apogee
    const avgDistance = 384400;
    const distancePercent = ((distance - avgDistance) / avgDistance) * 100;
    const distanceStatus = distancePercent > 2 
      ? 'Far (Apogee)' 
      : distancePercent < -2 
        ? 'Close (Perigee)' 
        : 'Average';

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem'
      }}>
        {/* Distance from Earth */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          padding: '1rem',
          borderRadius: '8px'
        }}>
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--muted)',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            🌍 Distance from Earth
          </div>
          <div style={{ 
            fontSize: '1.8rem', 
            fontWeight: '700',
            marginBottom: '0.25rem'
          }}>
            {distance.toLocaleString()} km
          </div>
          <div style={{ 
            fontSize: '1rem', 
            color: 'var(--muted)',
            marginBottom: '0.5rem'
          }}>
            {distanceMiles.toLocaleString(undefined, { maximumFractionDigits: 0 })} miles
          </div>
          <div style={{
            background: distanceStatus.includes('Close')
              ? 'rgba(239, 68, 68, 0.2)'
              : distanceStatus.includes('Far')
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(107, 114, 128, 0.2)',
            border: `1px solid ${distanceStatus.includes('Close')
              ? 'rgba(239, 68, 68, 0.5)'
              : distanceStatus.includes('Far')
                ? 'rgba(59, 130, 246, 0.5)'
                : 'rgba(107, 114, 128, 0.5)'}`,
            display: 'inline-block',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            {distanceStatus}
          </div>
        </div>

        {/* Angular Measurements */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '0.7rem', 
              color: 'var(--muted)',
              marginBottom: '0.25rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Parallactic Angle
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
              {parallacticAngle.toFixed(2)}°
            </div>
            <div style={{ 
              fontSize: '0.65rem', 
              color: 'var(--muted)',
              marginTop: '0.25rem'
            }}>
              Position angle
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            padding: '0.75rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '0.7rem', 
              color: 'var(--muted)',
              marginBottom: '0.25rem',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Moon Angle
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
              {moonAngle.toFixed(2)}°
            </div>
            <div style={{ 
              fontSize: '0.65rem', 
              color: 'var(--muted)',
              marginTop: '0.25rem'
            }}>
              Angular diameter
            </div>
          </div>
        </div>

        {/* Info about measurements */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          padding: '0.75rem',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: 'var(--muted)',
          lineHeight: '1.5'
        }}>
          <strong>💡 Did you know?</strong><br />
          The moon's distance varies by about 50,000 km throughout its orbit. When closest (perigee), 
          the moon appears about 14% larger than when farthest (apogee).
        </div>
      </div>
    );
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      padding: '1.25rem',
      borderRadius: '12px',
      marginBottom: '1rem',
      border: '1px solid var(--border)'
    }}>
      {/* Header with view tabs */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: '1.1rem',
          fontWeight: '700'
        }}>
          🌙 Lunar Observations
        </h4>
        
        {/* View Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '0.5rem'
        }}>
          <button
            onClick={() => setSelectedView('phase')}
            style={{
              background: selectedView === 'phase' 
                ? 'rgba(255,255,255,0.1)' 
                : 'transparent',
              border: selectedView === 'phase'
                ? '1px solid rgba(255,255,255,0.2)'
                : '1px solid transparent',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              color: selectedView === 'phase' ? 'white' : 'var(--muted)',
              fontWeight: selectedView === 'phase' ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            Phase & Illumination
          </button>
          <button
            onClick={() => setSelectedView('position')}
            style={{
              background: selectedView === 'position' 
                ? 'rgba(255,255,255,0.1)' 
                : 'transparent',
              border: selectedView === 'position'
                ? '1px solid rgba(255,255,255,0.2)'
                : '1px solid transparent',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              color: selectedView === 'position' ? 'white' : 'var(--muted)',
              fontWeight: selectedView === 'position' ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            Sky Position
          </button>
          <button
            onClick={() => setSelectedView('details')}
            style={{
              background: selectedView === 'details' 
                ? 'rgba(255,255,255,0.1)' 
                : 'transparent',
              border: selectedView === 'details'
                ? '1px solid rgba(255,255,255,0.2)'
                : '1px solid transparent',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              color: selectedView === 'details' ? 'white' : 'var(--muted)',
              fontWeight: selectedView === 'details' ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            Measurements
          </button>
        </div>
      </div>

      {/* Content based on selected view */}
      <div style={{ minHeight: '320px' }}>
        {selectedView === 'phase' && renderMoonPhase()}
        {selectedView === 'position' && renderPosition()}
        {selectedView === 'details' && renderDetails()}
      </div>
    </div>
  );
}