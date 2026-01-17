import React, { useState, useEffect, useRef } from "react";
import Icon from "../../components/Icon";

type Game = {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  venue: {
    default: string;
  };
  neutralSite: boolean;
  startTimeUTC: string;
  easternUTCOffset: string;
  venueUTCOffset: string;
  tvBroadcasts: Array<{
    id: number;
    market: string;
    countryCode: string;
    network: string;
  }>;
  gameState: string;
  gameScheduleState: string;
  awayTeam: {
    id: number;
    placeName: {
      default: string;
    };
    abbrev: string;
    logo: string;
    darkLogo: string;
    hotelLink?: string;
    hotelDesc?: string;
    score?: number;
  };
  homeTeam: {
    id: number;
    placeName: {
      default: string;
    };
    abbrev: string;
    logo: string;
    darkLogo: string;
    score?: number;
  };
  periodDescriptor?: {
    number: number;
    periodType: string;
  };
  gameOutcome?: {
    lastPeriodType: string;
  };
  clock?: {
    timeRemaining: string;
    secondsRemaining: number;
    running: boolean;
    inIntermission: boolean;
  };
};

type ScheduleResponse = {
  games: Game[];
};

export default function WildScheduleModule() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hideScores, setHideScores] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSchedule();
    // Refresh every 2 minutes when a game is in progress
    const interval = setInterval(() => {
      if (games.some(g => g.gameState === "LIVE" || g.gameState === "CRIT")) {
        fetchSchedule();
      }
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  async function fetchSchedule() {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/wild-schedule/schedule?team=MIN&season=20252026");
      
      if (!res.ok) {
        throw new Error("Failed to fetch schedule");
      }
      
      const data: ScheduleResponse = await res.json();
      
      // Sort games by date
      const sortedGames = data.games.sort((a, b) => 
        new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime()
      );
      
      setGames(sortedGames);
      
      // Only auto-position on initial load (when games array is empty)
      // This preserves the user's scroll position on refresh
      if (games.length === 0) {
        // Find the index of the next game (or current game if in progress)
        const now = new Date();
        const nextGameIndex = sortedGames.findIndex(game => {
          const gameDate = new Date(game.gameDate);
          return gameDate >= now || game.gameState === "LIVE" || game.gameState === "CRIT";
        });
        
        // Set index to show the next/current game at the LEFT position (index 0 in view)
        // This means currentIndex should BE the next game index, not subtract from it
        if (nextGameIndex !== -1) {
          setCurrentIndex(nextGameIndex);
        } else {
          // All games are in the past, show the last 5
          setCurrentIndex(Math.max(0, sortedGames.length - 5));
        }
      }
      // If games.length > 0, we're refreshing, so keep currentIndex as-is
      
    } catch (e: any) {
      console.error("Failed to fetch schedule:", e);
      setError(e.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }

  function getVisibleGames(): Game[] {
    // Show 5 games: 2 previous, current/next, and 2 upcoming
    return games.slice(currentIndex, currentIndex + 5);
  }

  function slideLeft() {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }

  function slideRight() {
    if (currentIndex < games.length - 5) {
      setCurrentIndex(prev => prev + 1);
    }
  }

  function formatGameDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      weekday: "short", 
      month: "short", 
      day: "numeric" 
    });
  }

  function formatGameTime(utcString: string): string {
    const date = new Date(utcString);
    return date.toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit",
      hour12: true
    });
  }

  function getGameStatus(game: Game): string {
    if (game.gameState === "FUT") {
      return formatGameTime(game.startTimeUTC);
    }
    if (game.gameState === "LIVE" || game.gameState === "CRIT") {
      if (game.clock?.inIntermission) {
        return `INT ${game.periodDescriptor?.number || ""}`;
      }
      return `${game.periodDescriptor?.periodType || "P"}${game.periodDescriptor?.number || ""} ${game.clock?.timeRemaining || ""}`;
    }
    if (game.gameState === "OFF" || game.gameState === "FINAL") {
      if (game.gameOutcome?.lastPeriodType === "OT") {
        return "FINAL/OT";
      }
      if (game.gameOutcome?.lastPeriodType === "SO") {
        return "FINAL/SO";
      }
      return "FINAL";
    }
    return game.gameScheduleState;
  }

  function isWildHome(game: Game): boolean {
    return game.homeTeam.abbrev === "MIN";
  }

  function getOpponent(game: Game) {
    return isWildHome(game) ? game.awayTeam : game.homeTeam;
  }

  function getWildScore(game: Game): number | undefined {
    return isWildHome(game) ? game.homeTeam.score : game.awayTeam.score;
  }

  function getOpponentScore(game: Game): number | undefined {
    return isWildHome(game) ? game.awayTeam.score : game.homeTeam.score;
  }

  function shouldShowScore(game: Game): boolean {
    if (hideScores) return false;
    return game.gameState === "OFF" || game.gameState === "FINAL" || 
           game.gameState === "LIVE" || game.gameState === "CRIT";
  }

  function calculateRecord() {
    let wins = 0;
    let losses = 0;
    let otLosses = 0;
    
    games.forEach(game => {
      if (game.gameState === "OFF" || game.gameState === "FINAL") {
        const wildScore = getWildScore(game);
        const oppScore = getOpponentScore(game);
        
        if (wildScore !== undefined && oppScore !== undefined) {
          if (wildScore > oppScore) {
            wins++;
          } else {
            // Check if it was an OT/SO loss
            if (game.gameOutcome?.lastPeriodType === "OT" || game.gameOutcome?.lastPeriodType === "SO") {
              otLosses++;
            } else {
              losses++;
            }
          }
        }
      }
    });
    
    const totalGames = wins + losses + otLosses;
    const remainingGames = games.filter(g => g.gameState === "FUT").length;
    
    return { wins, losses, otLosses, totalGames, remainingGames };
  }

  function getGameResult(game: Game): 'W' | 'L' | 'OTL' | null {
    if (game.gameState !== "OFF" && game.gameState !== "FINAL") return null;
    
    const wildScore = getWildScore(game);
    const oppScore = getOpponentScore(game);
    
    if (wildScore === undefined || oppScore === undefined) return null;
    
    if (wildScore > oppScore) return 'W';
    if (game.gameOutcome?.lastPeriodType === "OT" || game.gameOutcome?.lastPeriodType === "SO") return 'OTL';
    return 'L';
  }

  if (loading && games.length === 0) {
    return (
      <div className="module-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <img 
            src="https://assets.nhle.com/logos/nhl/svg/MIN_light.svg" 
            alt="Minnesota Wild"
            style={{ width: "32px", height: "32px" }}
          />
          <h3 style={{ margin: 0 }}>Minnesota Wild</h3>
        </div>
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
          Loading schedule...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="module-card">
        <h3>🏒 Minnesota Wild Schedule</h3>
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
          <p>{error}</p>
          <button className="cal-btn" onClick={fetchSchedule} style={{ marginTop: "1rem" }}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const visibleGames = getVisibleGames();

  return (
    <div className="module-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img 
            src="https://assets.nhle.com/logos/nhl/svg/MIN_light.svg" 
            alt="Minnesota Wild"
            style={{ width: "32px", height: "32px" }}
          />
          <h3 style={{ margin: 0 }}>Minnesota Wild</h3>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className={`toggle-btn ${hideScores ? "active" : ""}`}
            title={hideScores ? "Scores hidden" : "Hide scores"}
            aria-pressed={hideScores}
            onClick={() => setHideScores(!hideScores)}
          >
            <span className="icon">
              <Icon name="check" />
            </span>
            <span style={{ fontSize: 13 }}>
              {hideScores ? "Show scores" : "Hide scores"}
            </span>
          </button>
          <button className="cal-btn" onClick={fetchSchedule} disabled={loading}>
            <Icon name="refresh" />
            {loading && <span style={{ marginLeft: "0.25rem", fontSize: "0.75rem" }}>...</span>}
          </button>
        </div>
      </div>

      {/* Season Record and Sparkline */}
      {games.length > 0 && (
        <div style={{ 
          marginBottom: "1rem", 
          padding: "0.75rem", 
          background: "rgba(255,255,255,0.02)",
          borderRadius: "8px",
          border: "1px solid var(--border)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Record
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", marginTop: "0.15rem" }}>
                  {calculateRecord().wins}-{calculateRecord().losses}-{calculateRecord().otLosses}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Points
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", marginTop: "0.15rem" }}>
                  {calculateRecord().wins * 2 + calculateRecord().otLosses}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Games
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: "700", marginTop: "0.15rem" }}>
                  {calculateRecord().totalGames} / {games.length}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {calculateRecord().remainingGames}
            </div>
          </div>
          
          {/* Sparkline */}
          <div style={{ 
            display: "flex", 
            height: "32px", 
            gap: "1px", 
            alignItems: "flex-end",
            marginTop: "0.5rem"
          }}>
            {games.map((game, idx) => {
              const result = getGameResult(game);
              let color = "rgba(100, 100, 100, 0.3)"; // Future games
              let height = "20%";
              
              if (result === 'W') {
                color = "#00bf63"; // Green for wins
                height = "100%";
              } else if (result === 'L') {
                color = "#ff6b6b"; // Red for regulation losses
                height = "60%";
              } else if (result === 'OTL') {
                color = "#ffa500"; // Orange for OT/SO losses
                height = "40%";
              }
              
              return (
                <div
                  key={game.id}
                  style={{
                    flex: 1,
                    height: height,
                    background: color,
                    borderRadius: "1px",
                    transition: "all 0.2s ease",
                    minWidth: "2px"
                  }}
                  title={`Game ${idx + 1}: ${result || 'Upcoming'}`}
                />
              );
            })}
          </div>
          
          {/* Legend */}
          <div style={{ 
            display: "flex", 
            gap: "1rem", 
            marginTop: "0.5rem", 
            fontSize: "0.7rem",
            color: "var(--muted)",
            justifyContent: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "#00bf63", borderRadius: "2px" }} />
              <span>Win</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "#ffa500", borderRadius: "2px" }} />
              <span>OT/SO Loss</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "#ff6b6b", borderRadius: "2px" }} />
              <span>Loss</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <div style={{ width: "12px", height: "12px", background: "rgba(100, 100, 100, 0.3)", borderRadius: "2px" }} />
              <span>Upcoming</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        {/* Slider Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={slideLeft}
            disabled={currentIndex === 0}
            style={{
              padding: "0.5rem",
              background: currentIndex === 0 ? "var(--surface)" : "var(--primary)",
              border: "none",
              borderRadius: "4px",
              cursor: currentIndex === 0 ? "not-allowed" : "pointer",
              opacity: currentIndex === 0 ? 0.5 : 1,
              color: "white",
              minWidth: "40px"
            }}
          >
            ‹
          </button>

          {/* Games Slider */}
          <div 
            ref={sliderRef}
            style={{ 
              flex: 1,
              overflow: "hidden",
              position: "relative"
            }}
          >
            <div style={{ 
              display: "flex", 
              gap: "0.75rem",
              transition: "transform 0.3s ease"
            }}>
              {visibleGames.map((game, idx) => {
                const opponent = getOpponent(game);
                const wildScore = getWildScore(game);
                const opponentScore = getOpponentScore(game);
                const showScore = shouldShowScore(game);
                const isLive = game.gameState === "LIVE" || game.gameState === "CRIT";
                const isWildWinning = showScore && wildScore !== undefined && opponentScore !== undefined && wildScore > opponentScore;
                const isWildLosing = showScore && wildScore !== undefined && opponentScore !== undefined && wildScore < opponentScore;
                
                // Check if this is the current/next game to highlight
                const gameIndex = currentIndex + idx;
                const now = new Date();
                const gameDate = new Date(game.gameDate);
                const isCurrentOrNext = (isLive || (game.gameState === "FUT" && gameDate >= now)) && 
                                       games.findIndex(g => {
                                         const gDate = new Date(g.gameDate);
                                         return gDate >= now || g.gameState === "LIVE" || g.gameState === "CRIT";
                                       }) === gameIndex;

                return (
                  <div
                    key={game.id}
                    style={{
                      flex: "0 0 calc(20% - 0.6rem)",
                      minWidth: "120px",
                      background: isLive ? "rgba(0, 191, 99, 0.1)" : isCurrentOrNext ? "rgba(59, 130, 246, 0.1)" : "var(--surface)",
                      border: isLive ? "2px solid #00bf63" : isCurrentOrNext ? "2px solid #3b82f6" : "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "0.75rem 0.5rem",
                      textAlign: "center",
                      position: "relative",
                      boxShadow: isCurrentOrNext && !isLive ? "0 2px 8px rgba(59, 130, 246, 0.2)" : "none"
                    }}
                  >
                    {/* Date */}
                    <div style={{ 
                      fontSize: "0.75rem", 
                      color: "var(--muted)", 
                      marginBottom: "0.5rem",
                      fontWeight: "500"
                    }}>
                      {formatGameDate(game.gameDate)}
                    </div>

                    {/* Opponent Logo & Name */}
                    <div style={{ marginBottom: "0.5rem" }}>
                      <img 
                        src={opponent.logo} 
                        alt={opponent.abbrev}
                        style={{ 
                          width: "40px", 
                          height: "40px",
                          marginBottom: "0.25rem"
                        }}
                      />
                      <div style={{ 
                        fontSize: "0.8rem", 
                        fontWeight: "600",
                        color: "var(--foreground)"
                      }}>
                        {isWildHome(game) ? "vs" : "@"} {opponent.abbrev}
                      </div>
                      {/* Start time for future games */}
                      {game.gameState === "FUT" && (
                        <div style={{ 
                          fontSize: "0.7rem", 
                          color: "var(--muted)",
                          marginTop: "0.15rem"
                        }}>
                          {formatGameTime(game.startTimeUTC)}
                        </div>
                      )}
                    </div>

                    {/* Score or Status */}
                    <div style={{ 
                      fontSize: "0.9rem",
                      fontWeight: "700",
                      color: isWildWinning ? "#00bf63" : isWildLosing ? "#ff6b6b" : "var(--foreground)",
                      marginBottom: "0.25rem"
                    }}>
                      {showScore ? (
                        <span>{wildScore} - {opponentScore}</span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "0.75rem", fontWeight: "500" }}>
                          {game.gameState === "FUT" ? "Upcoming" : "Score Hidden"}
                        </span>
                      )}
                    </div>

                    {/* Status - Always show for live/completed games */}
                    <div style={{ 
                      fontSize: "0.7rem",
                      color: isLive ? "#00bf63" : "var(--muted)",
                      fontWeight: isLive ? "600" : "normal"
                    }}>
                      {(isLive || game.gameState === "OFF" || game.gameState === "FINAL") && getGameStatus(game)}
                    </div>

                    {/* Live indicator */}
                    {isLive && (
                      <div style={{
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#00bf63",
                        animation: "pulse 2s infinite"
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={slideRight}
            disabled={currentIndex >= games.length - 5}
            style={{
              padding: "0.5rem",
              background: currentIndex >= games.length - 5 ? "var(--surface)" : "var(--primary)",
              border: "none",
              borderRadius: "4px",
              cursor: currentIndex >= games.length - 5 ? "not-allowed" : "pointer",
              opacity: currentIndex >= games.length - 5 ? 0.5 : 1,
              color: "white",
              minWidth: "40px"
            }}
          >
            ›
          </button>
        </div>

        {/* Game count indicator */}
        <div style={{ 
          textAlign: "center", 
          marginTop: "0.75rem",
          fontSize: "0.75rem",
          color: "var(--muted)"
        }}>
          Showing {currentIndex + 1}-{Math.min(currentIndex + 5, games.length)} of {games.length} games
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}