import React, { useEffect, useMemo, useState } from "react";

type ShotHand = "L" | "R";

type Player = {
  id: string;
  name: string;
  shotHand: ShotHand;
  totalIceSeconds: number;
  shiftCount: number;
  plusMinus: number;
  penaltyCount: number;
  isOnIce: boolean;
  onIceSince: number | null;
  currentShiftAccumulatedSeconds: number;
};

const STORAGE_KEY = "everyday-ice-time-state";

function formatDuration(seconds: number) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function IceTimeModule() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [criticalSeconds, setCriticalSeconds] = useState(45);
  const [nameInput, setNameInput] = useState("");
  const [handInput, setHandInput] = useState<ShotHand>("L");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalForCount, setGoalForCount] = useState(0);
  const [goalAgainstCount, setGoalAgainstCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string>("");
  const [playStopped, setPlayStopped] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [balancedPairEnabled, setBalancedPairEnabled] = useState(true);
  const [chartMetric, setChartMetric] = useState<"minutes" | "shifts" | "+/−">("minutes");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const saved = JSON.parse(raw);
      const loadedPlayers: Player[] = (saved.players || []).map((player: any) => ({
        id: player.id || createId(),
        name: player.name || "",
        shotHand: player.shotHand === "R" ? "R" : "L",
        totalIceSeconds: Number(player.totalIceSeconds || 0),
        shiftCount: Number(player.shiftCount || 0),
        plusMinus: Number(player.plusMinus || 0),
        penaltyCount: Number(player.penaltyCount || 0),
        isOnIce: Boolean(player.isOnIce),
        onIceSince: player.isOnIce ? Number(player.onIceSince || Date.now()) : null,
        currentShiftAccumulatedSeconds: Number(player.currentShiftAccumulatedSeconds || 0),
      }));
      setPlayers(loadedPlayers);
      setCriticalSeconds(Number(saved.criticalSeconds || 45));
      setGoalForCount(Number(saved.goalForCount || 0));
      setGoalAgainstCount(Number(saved.goalAgainstCount || 0));
      setPlayStopped(Boolean(saved.playStopped));
      setBalancedPairEnabled(
        saved.balancedPairEnabled === false ? false : true
      );
      setShowAdvancedConfig(Boolean(saved.showAdvancedConfig));
    } catch (e) {
      console.warn("Failed to load ice time state:", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          players,
          criticalSeconds,
          goalForCount,
          goalAgainstCount,
          playStopped,
          balancedPairEnabled,
          showAdvancedConfig,
        })
      );
    } catch (e) {
      console.warn("Failed to save ice time state:", e);
    }
  }, [hydrated, players, criticalSeconds, goalForCount, goalAgainstCount, playStopped, balancedPairEnabled, showAdvancedConfig]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const onIcePlayers = useMemo(
    () => players.filter((player) => player.isOnIce),
    [players]
  );

  const benchPlayers = useMemo(
    () => players.filter((player) => !player.isOnIce),
    [players]
  );

  const onIceLeft = onIcePlayers.filter((player) => player.shotHand === "L");
  const onIceRight = onIcePlayers.filter((player) => player.shotHand === "R");

  const sortedBenchPlayers = useMemo(() => {
    function pairPriority(player: Player) {
      if (!balancedPairEnabled || onIcePlayers.length === 0) {
        return 0;
      }
      if (onIcePlayers.length === 1) {
        return player.shotHand === onIcePlayers[0].shotHand ? 1 : 0;
      }
      if (onIcePlayers.length === 2) {
        if (onIceLeft.length === 2) {
          return player.shotHand === "R" ? 0 : 1;
        }
        if (onIceRight.length === 2) {
          return player.shotHand === "L" ? 0 : 1;
        }
      }
      return 0;
    }

    return [...benchPlayers].sort((a, b) => {
      const priorityA = pairPriority(a);
      const priorityB = pairPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      if (a.shiftCount !== b.shiftCount) return a.shiftCount - b.shiftCount;
      if (a.totalIceSeconds !== b.totalIceSeconds)
        return a.totalIceSeconds - b.totalIceSeconds;
      return a.name.localeCompare(b.name);
    });
  }, [benchPlayers, balancedPairEnabled, onIcePlayers, onIceLeft.length, onIceRight.length]);

  const benchHasOpposite = useMemo(() => {
    if (onIcePlayers.length !== 2) return false;
    if (onIceLeft.length === 2) {
      return benchPlayers.some((player) => player.shotHand === "R");
    }
    if (onIceRight.length === 2) {
      return benchPlayers.some((player) => player.shotHand === "L");
    }
    return false;
  }, [benchPlayers, onIceLeft.length, onIceRight.length, onIcePlayers.length]);

  const currentShiftSeconds = (player: Player) => {
    if (!player.isOnIce) return 0;
    const accumulated = player.currentShiftAccumulatedSeconds || 0;
    if (!player.onIceSince || playStopped) return accumulated;
    return accumulated + Math.max(0, Math.floor((now - player.onIceSince) / 1000));
  };

  const totalVisibleSeconds = (player: Player) =>
    player.totalIceSeconds + currentShiftSeconds(player);

  const visibleShiftCount = (player: Player) =>
    player.shiftCount + (player.isOnIce ? 1 : 0);

  const chartPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (chartMetric === "minutes") {
        return totalVisibleSeconds(b) - totalVisibleSeconds(a);
      }
      if (chartMetric === "shifts") {
        return visibleShiftCount(b) - visibleShiftCount(a);
      }
      return b.plusMinus - a.plusMinus;
    });
  }, [players, chartMetric, now, playStopped]);

  const chartMaxValue = useMemo(() => {
    if (chartMetric === "shifts") {
      return Math.max(1, ...players.map((player) => visibleShiftCount(player)));
    }
    if (chartMetric === "+/−") {
      return Math.max(1, ...players.map((player) => Math.abs(player.plusMinus)));
    }
    return Math.max(1, ...players.map((player) => totalVisibleSeconds(player)));
  }, [players, chartMetric, now, playStopped]);

  const showCriticalWarning = onIcePlayers.some(
    (player) => currentShiftSeconds(player) > criticalSeconds
  );

  const balanceAdvice = useMemo(() => {
    if (!balancedPairEnabled) {
      return "Pair balance mode is off. Sorting by shifts and ice time only.";
    }
    if (onIcePlayers.length !== 2) {
      return onIcePlayers.length === 1
        ? "Add a second defenseman to complete the pair."
        : "Put one or two defensemen on the ice to start tracking shifts.";
    }
    if (onIceLeft.length === 1 && onIceRight.length === 1) {
      return "Balanced pair: one left shot and one right shot.";
    }
    if (benchHasOpposite) {
      const needed = onIceLeft.length === 2 ? "right" : "left";
      return `Current pair is same-handed. Consider swapping in a ${needed}-shot player.`;
    }
    return "Current pair is same-handed, but no opposite-hand player is available on the bench.";
  }, [balancedPairEnabled, benchHasOpposite, onIceLeft.length, onIcePlayers.length, onIceRight.length]);

  function showTemporaryNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function togglePlayStopped() {
    if (playStopped) {
      setPlayers((current) =>
        current.map((player) =>
          player.isOnIce
            ? {
                ...player,
                onIceSince: player.onIceSince || Date.now(),
              }
            : player
        )
      );
      setPlayStopped(false);
      return;
    }

    setPlayers((current) =>
      current.map((player) => {
        if (!player.isOnIce || !player.onIceSince) return player;
        const shiftSeconds = Math.max(0, Math.floor((Date.now() - player.onIceSince) / 1000));
        return {
          ...player,
          currentShiftAccumulatedSeconds: player.currentShiftAccumulatedSeconds + shiftSeconds,
          onIceSince: null,
        };
      })
    );
    setPlayStopped(true);
  }

  function handleSavePlayer(e?: React.FormEvent) {
    e?.preventDefault();
    const name = nameInput.trim();
    if (!name) {
      showTemporaryNotice("Enter a player name before saving.");
      return;
    }

    if (editingId) {
      setPlayers((current) =>
        current.map((player) =>
          player.id === editingId
            ? { ...player, name, shotHand: handInput }
            : player
        )
      );
      setEditingId(null);
    } else {
      setPlayers((current) => [
        {
          id: createId(),
          name,
          shotHand: handInput,
          totalIceSeconds: 0,
          shiftCount: 0,
          plusMinus: 0,
          penaltyCount: 0,
          isOnIce: false,
          onIceSince: null,
          currentShiftAccumulatedSeconds: 0,
        },
        ...current,
      ]);
    }

    setNameInput("");
    setHandInput("L");
  }

  function handleEdit(player: Player) {
    setEditingId(player.id);
    setNameInput(player.name);
    setHandInput(player.shotHand);
  }

  function handleDelete(player: Player) {
    if (!window.confirm(`Remove ${player.name} from the bench?`)) return;
    setPlayers((current) => current.filter((item) => item.id !== player.id));
  }

  function benchPlayer(playerId: string) {
    setPlayers((current) =>
      current.map((player) => {
        if (player.id !== playerId || !player.isOnIce) return player;
        const shiftSeconds = currentShiftSeconds(player);
        return {
          ...player,
          isOnIce: false,
          onIceSince: null,
          currentShiftAccumulatedSeconds: 0,
          totalIceSeconds: player.totalIceSeconds + shiftSeconds,
          shiftCount: player.shiftCount + (shiftSeconds > 0 ? 1 : 0),
        };
      })
    );
  }

  function putOnIce(playerId: string) {
    if (onIcePlayers.length >= 2) {
      showTemporaryNotice("Bench a player first before putting a new one on ice.");
      return;
    }

    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? {
              ...player,
              isOnIce: true,
              onIceSince: playStopped ? null : player.onIceSince || Date.now(),
              currentShiftAccumulatedSeconds: player.currentShiftAccumulatedSeconds || 0,
            }
          : player
      )
    );
  }

  function addPenalty(playerId: string) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId
          ? { ...player, penaltyCount: player.penaltyCount + 1 }
          : player
      )
    );
  }

  function recordGoal(type: "for" | "against") {
    if (onIcePlayers.length === 0) {
      showTemporaryNotice("No players are currently on ice.");
      return;
    }

    setPlayers((current) =>
      current.map((player) =>
        player.isOnIce
          ? {
              ...player,
              plusMinus: player.plusMinus + (type === "for" ? 1 : -1),
            }
          : player
      )
    );

    if (type === "for") {
      setGoalForCount((value) => value + 1);
    } else {
      setGoalAgainstCount((value) => value + 1);
    }
  }

  function adjustGoal(type: "for" | "against", delta: 1 | -1) {
    const currentCount = type === "for" ? goalForCount : goalAgainstCount;
    if (delta < 0 && currentCount <= 0) {
      return;
    }
    if (delta > 0 && onIcePlayers.length === 0) {
      showTemporaryNotice("No players are currently on ice.");
      return;
    }

    if (onIcePlayers.length > 0) {
      setPlayers((current) =>
        current.map((player) =>
          player.isOnIce
            ? {
                ...player,
                plusMinus:
                  player.plusMinus + (type === "for" ? delta : -delta),
              }
            : player
        )
      );
    }

    if (type === "for") {
      setGoalForCount((value) => Math.max(0, value + delta));
    } else {
      setGoalAgainstCount((value) => Math.max(0, value + delta));
    }
  }

  function benchAll() {
    setPlayers((current) =>
      current.map((player) => {
        if (!player.isOnIce) return player;
        const shiftSeconds = currentShiftSeconds(player);
        return {
          ...player,
          isOnIce: false,
          onIceSince: null,
          currentShiftAccumulatedSeconds: 0,
          totalIceSeconds: player.totalIceSeconds + shiftSeconds,
          shiftCount: player.shiftCount + (shiftSeconds > 0 ? 1 : 0),
        };
      })
    );
  }

  return (
    <div className="module-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ margin: 0 }}>Ice Time Tracker</h3>
        <button className="btn secondary" onClick={benchAll}>
          Bench All
        </button>
      </div>

      {notice && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.85rem 0.95rem",
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#f5f3da",
          }}
        >
          {notice}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            padding: "1rem",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
              marginBottom: "0.75rem",
            }}
          >
            <h4 style={{ margin: 0 }}>Game Play</h4>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn secondary" onClick={() => setShowAdvancedConfig((value) => !value)}>
                {showAdvancedConfig ? "Hide options" : "Show options"}
              </button>
              <button
                className="btn secondary"
                onClick={togglePlayStopped}
                style={{
                  background: playStopped ? "#28a745" : "#dc3545",
                  borderColor: playStopped ? "#28a745" : "#dc3545",
                  color: "white",
                }}
              >
                {playStopped ? "Resume" : "Stop play"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "12px",
                background: "rgba(46, 125, 50, 0.08)",
                border: "1px solid rgba(46, 125, 50, 0.35)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, color: "#28a745", fontSize: "0.83rem" }}>
                    Goals For
                  </p>
                  <p style={{ fontSize: "1.5rem", margin: "0.35rem 0 0 0", color: "#28a745" }}>{goalForCount}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "54px" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => adjustGoal("for", -1)}
                    disabled={goalForCount <= 0}
                    style={{ width: "100%", minHeight: "34px" }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => adjustGoal("for", 1)}
                    style={{ width: "100%", minHeight: "34px" }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "12px",
                background: "rgba(220, 53, 69, 0.08)",
                border: "1px solid rgba(220, 53, 69, 0.35)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, color: "#dc3545", fontSize: "0.83rem" }}>
                    Goals Against
                  </p>
                  <p style={{ fontSize: "1.5rem", margin: "0.35rem 0 0 0", color: "#dc3545" }}>{goalAgainstCount}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "54px" }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => adjustGoal("against", -1)}
                    disabled={goalAgainstCount <= 0}
                    style={{ width: "100%", minHeight: "34px" }}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => adjustGoal("against", 1)}
                    style={{ width: "100%", minHeight: "34px" }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showAdvancedConfig && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.83rem" }}>
                    Critical shift threshold
                  </p>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={criticalSeconds}
                    onChange={(e) => setCriticalSeconds(Number(e.target.value) || 10)}
                    style={{
                      width: "88px",
                      borderRadius: "10px",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      background: "var(--card)",
                      color: "#eef2f5",
                      padding: "8px 10px",
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.83rem" }}>
                    Balanced pair mode
                  </p>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setBalancedPairEnabled((value) => !value)}
                  >
                    {balancedPairEnabled ? "On" : "Off"}
                  </button>
                </div>
                <p style={{ margin: "0.45rem 0 0 0", fontSize: "1rem", color: "#eef2f5" }}>
                  {balanceAdvice}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div
          style={{
            padding: "1rem",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div>
              <h4 style={{ margin: 0 }}>On Ice</h4>
              <p style={{ margin: "0.35rem 0 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                {onIcePlayers.length} / 2 defensemen on ice
              </p>
            </div>
            <div
              style={{
                color: showCriticalWarning ? "#ff7a7a" : "var(--muted)",
                fontSize: "0.9rem",
                textAlign: "right",
              }}
            >
              {showCriticalWarning ? "Critical shift reached" : "Shift timer active"}
            </div>
          </div>

          {onIcePlayers.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Put one or two defensemen on the ice to begin tracking time.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
              {onIcePlayers.map((player) => {
                const currentSeconds = currentShiftSeconds(player);
                return (
                  <div
                    key={player.id}
                    style={{
                      padding: "0.85rem",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${
                        currentSeconds > criticalSeconds
                          ? "#ff7a7a"
                          : "rgba(255,255,255,0.08)"
                      }`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                          <strong>{player.name}</strong>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              background: "rgba(255,255,255,0.04)",
                              color: "var(--muted)",
                            }}
                          >
                            {player.shotHand === "L" ? "Left shot" : "Right shot"}
                          </span>
                        </div>
                        <p style={{ margin: "0.45rem 0 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                          Shift {formatDuration(currentSeconds)}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button className="btn primary small" onClick={() => benchPlayer(player.id)}>
                          Change
                        </button>
                        <button className="btn secondary small" onClick={() => addPenalty(player.id)}>
                          Penalty
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "0.5rem",
                        marginTop: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          padding: "0.65rem 0.8rem",
                          borderRadius: "10px",
                          background: "rgba(0, 0, 0, 0.12)",
                          color: "var(--muted)",
                          fontSize: "0.83rem",
                        }}
                      >
                        Shifts {visibleShiftCount(player)}
                      </div>
                      <div
                        style={{
                          padding: "0.65rem 0.8rem",
                          borderRadius: "10px",
                          background: "rgba(0, 0, 0, 0.12)",
                          color: "var(--muted)",
                          fontSize: "0.83rem",
                        }}
                      >
                        Total {formatDuration(totalVisibleSeconds(player))}
                      </div>
                      <div
                        style={{
                          padding: "0.65rem 0.8rem",
                          borderRadius: "10px",
                          background: "rgba(0, 0, 0, 0.12)",
                          color: player.plusMinus > 0 ? "#28a745" : player.plusMinus < 0 ? "#ff7a7a" : "var(--muted)",
                          fontSize: "0.83rem",
                        }}
                      >
                        +/− {player.plusMinus >= 0 ? `+${player.plusMinus}` : player.plusMinus}
                      </div>
                      <div
                        style={{
                          padding: "0.65rem 0.8rem",
                          borderRadius: "10px",
                          background: "rgba(0, 0, 0, 0.12)",
                          color: "var(--muted)",
                          fontSize: "0.83rem",
                        }}
                      >
                        Pen {player.penaltyCount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          borderRadius: "12px",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h4 style={{ margin: 0 }}>Bench</h4>
          </div>
        </div>
        
        {sortedBenchPlayers.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No bench players yet. Add a defenseman to start.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {sortedBenchPlayers.map((player) => (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  padding: "0.9rem",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                    <strong>{player.name}</strong>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "999px",
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--muted)",
                        fontSize: "0.8rem",
                      }}
                    >
                      {player.shotHand === "L" ? "Left" : "Right"} shot
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button
                      className="btn primary small"
                      onClick={() => putOnIce(player.id)}
                      disabled={onIcePlayers.length >= 2}
                      style={{ minWidth: "60px" }}
                    >
                      Ice 
                    </button>
                    <button className="btn secondary small" onClick={() => addPenalty(player.id)}>
                      Penalty
                    </button>
                    <button className="btn secondary small" onClick={() => handleEdit(player)}>
                      Edit
                    </button>
                    <button className="btn secondary small" onClick={() => handleDelete(player)}>
                      Delete
                    </button>                    
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.55rem 0.75rem",
                      borderRadius: "10px",
                      background: "rgba(0, 0, 0, 0.12)",
                      color: "var(--muted)",
                      fontSize: "0.83rem",
                    }}
                  >
                    Shifts {player.shiftCount}
                  </div>
                  <div
                    style={{
                      padding: "0.55rem 0.75rem",
                      borderRadius: "10px",
                      background: "rgba(0, 0, 0, 0.12)",
                      color: "var(--muted)",
                      fontSize: "0.83rem",
                    }}
                  >
                    Total {formatDuration(player.totalIceSeconds)}
                  </div>
                  <div
                    style={{
                      padding: "0.55rem 0.75rem",
                      borderRadius: "10px",
                      background: "rgba(0, 0, 0, 0.12)",
                      color: player.plusMinus > 0 ? "#28a745" : player.plusMinus < 0 ? "#ff7a7a" : "var(--muted)",
                      fontSize: "0.83rem",
                    }}
                  >
                    +/− {player.plusMinus >= 0 ? `+${player.plusMinus}` : player.plusMinus}
                  </div>
                  <div
                    style={{
                      padding: "0.55rem 0.75rem",
                      borderRadius: "10px",
                      background: "rgba(0, 0, 0, 0.12)",
                      color: "var(--muted)",
                      fontSize: "0.83rem",
                    }}
                  >
                    Pen {player.penaltyCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSavePlayer} style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            <input
              type="text"
              placeholder="Player name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{
                minWidth: 0,
                flex: "1 1 220px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "var(--card)",
                color: "#eef2f5",
              }}
            />
            <div style={{ display: "grid", gap: "0.75rem", minWidth: 0, width: "min(260px, 100%)" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <select
                  value={handInput}
                  onChange={(e) => setHandInput(e.target.value as ShotHand)}
                  style={{
                    minWidth: 0,
                    flex: "1 1 120px",
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "var(--card)",
                    color: "#eef2f5",
                  }}
                >
                  <option value="L">Left shot</option>
                  <option value="R">Right shot</option>
                </select>
                <button type="submit" className="btn primary" style={{ minWidth: "110px" }}>
                  {editingId ? "Save Player" : "Add Player"}
                </button>
              </div>
              {editingId && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setEditingId(null);
                    setNameInput("");
                    setHandInput("L");
                  }}
                  style={{ width: "100%", minWidth: 0 }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div
          style={{
            padding: "0.85rem",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            marginTop: ".85rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >            
            <div>
              <h4 style={{ margin: 0, fontSize: "1rem" }}>
                Player metrics
              </h4>              
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {(["minutes", "shifts", "+/−"] as const).map((metric) => (
                <button
                  key={metric}
                  type="button"
                  className={"btn secondary small"}
                  onClick={() => setChartMetric(metric)}
                  style={{
                    minWidth: "64px",
                    background: chartMetric === metric ? "rgba(255,255,255,0.1)" : "transparent",
                    borderColor: chartMetric === metric ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)",
                    color: chartMetric === metric ? "#eef2f5" : "var(--muted)",
                  }}
                >
                  {metric === "+/−" ? "+/−" : metric.charAt(0).toUpperCase() + metric.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              {players.length} players
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gap: "0.55rem",
              maxHeight: "18rem",
              overflowY: "auto",
            }}
          >
            {chartPlayers.map((player) => {
              const value =
                chartMetric === "minutes"
                  ? totalVisibleSeconds(player)
                  : chartMetric === "shifts"
                  ? visibleShiftCount(player)
                  : player.plusMinus;
              const displayValue =
                chartMetric === "minutes"
                  ? formatDuration(Number(value))
                  : chartMetric === "shifts"
                  ? `${value}`
                  : value >= 0
                  ? `+${value}`
                  : `${value}`;
              const width = Math.max(
                4,
                ((chartMetric === "+/−" ? Math.abs(Number(value)) : Number(value)) / chartMaxValue) * 100
              );
              const barColor =
                chartMetric === "+/−"
                  ? value > 0
                    ? "#28a745"
                    : value < 0
                    ? "#dc3545"
                    : "#999"
                  : chartMetric === "shifts"
                  ? "#4b95ff"
                  : "#28a745";
              return (
                <div
                  key={player.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "0.75rem",
                    alignItems: "center",
                    minHeight: "28px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        color: "var(--muted)",
                        fontSize: "0.82rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                      }}
                    >
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden" }}>
                        {player.name}
                      </span>
                      <span>{displayValue}</span>
                    </div>
                    <div
                      style={{
                        marginTop: "0.35rem",
                        height: "8px",
                        borderRadius: "999px",
                        background: "rgba(255, 255, 255, 0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${width}%`,
                          height: "100%",
                          borderRadius: "999px",
                          background: "linear-gradient(90deg, #28a745, #7ed957)",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}
