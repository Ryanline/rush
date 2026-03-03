import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, authFetch, buildWsUrl, clearAuth } from "../lib/auth";

function formatSeconds(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function getOrCreateWs(wsUrl: string): WebSocket {
  const existing = window.__rush_ws;
  const existingUrl = window.__rush_ws_url;

  if (
    existing &&
    existingUrl === wsUrl &&
    (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
  ) {
    return existing;
  }

  if (existing && existing.readyState === WebSocket.OPEN) {
    try {
      existing.close(1000, "reconnect");
    } catch {
      // ignore close failures
    }
  }

  const ws = new WebSocket(wsUrl);
  window.__rush_ws = ws;
  window.__rush_ws_url = wsUrl;
  return ws;
}

export default function Queue() {
  const navigate = useNavigate();

  const [inPool, setInPool] = useState(false);
  const [secondsSearching, setSecondsSearching] = useState(0);
  const [apiConnected, setApiConnected] = useState<null | boolean>(null);

  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed" | "error">("connecting");
  const [wsCloseInfo, setWsCloseInfo] = useState<string>("");
  const [gems, setGems] = useState<number | null>(null);
  const [gemMax, setGemMax] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${API_BASE}/health/live`);
        if (!res.ok) throw new Error("bad status");
        if (!cancelled) setApiConnected(true);
      } catch {
        if (!cancelled) setApiConnected(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadGems() {
      try {
        const res = await authFetch("/gems");
        if (!res.ok) {
          if (res.status === 401) {
            clearAuth();
            navigate("/login", { replace: true });
          }
          return;
        }
        const data = await res.json();
        if (!cancelled && data?.gems) {
          setGems(Number(data.gems.gems));
          setGemMax(Number(data.gems.gemMax));
        }
      } catch {
        // ignore gem refresh failure
      }
    }

    loadGems();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const wsUrl = buildWsUrl();
    if (!wsUrl) {
      clearAuth();
      navigate("/login", { replace: true });
      return;
    }

    const ws = getOrCreateWs(wsUrl);
    wsRef.current = ws;

    const onOpen = () => {
      setWsStatus("open");
      setWsCloseInfo("");
    };

    const onError = () => setWsStatus("error");

    const onClose = (ev: CloseEvent) => {
      setWsStatus("closed");
      setWsCloseInfo(`code ${ev.code}${ev.reason ? `: ${ev.reason}` : ""}`);
      if (ev.code === 4401 || ev.code === 4403) {
        clearAuth();
        navigate("/login", { replace: true });
      }
    };

    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(String(ev.data));

        if (msg.type === "MATCH_FOUND") {
          setInPool(false);
          setSecondsSearching(0);
          navigate(`/match/${encodeURIComponent(msg.matchId)}`, {
            state: { matchId: msg.matchId, peerId: msg.peerId, peerName: msg.peerName, endsAt: msg.endsAt },
          });
          return;
        }

        if (msg.type === "MATCH_ENDED") {
          setInPool(false);
          setSecondsSearching(0);
        }
      } catch {
        // ignore malformed socket message
      }
    };

    if (ws.readyState === WebSocket.CONNECTING) setWsStatus("connecting");
    if (ws.readyState === WebSocket.OPEN) setWsStatus("open");
    if (ws.readyState === WebSocket.CLOSED) setWsStatus("closed");

    ws.addEventListener("open", onOpen);
    ws.addEventListener("error", onError);
    ws.addEventListener("close", onClose);
    ws.addEventListener("message", onMessage);

    return () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
      ws.removeEventListener("message", onMessage);
    };
  }, [navigate]);

  useEffect(() => {
    if (!inPool) return;
    const id = window.setInterval(() => setSecondsSearching((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [inPool]);

  const searchingLabel = useMemo(() => `Searching: ${formatSeconds(secondsSearching)}`, [secondsSearching]);

  function enterPool() {
    setInPool(true);
    setSecondsSearching(0);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "POOL_JOIN" }));
  }

  function leavePool() {
    setInPool(false);
    setSecondsSearching(0);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "POOL_LEAVE" }));
  }

  function logout() {
    leavePool();
    clearAuth();
    navigate("/login");
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{inPool ? "You're in the Pool" : "Ready to Rush?"}</h1>

        <p style={styles.subtitle}>{inPool ? "Stay ready. Matches happen live." : "Live matching. Two minutes. No swiping."}</p>

        <p style={styles.apiLine}>API: {apiConnected === null ? "checking..." : apiConnected ? "connected" : "not connected"}</p>

        <p style={styles.apiLine}>
          WS:{" "}
          {wsStatus === "connecting"
            ? "connecting..."
            : wsStatus === "open"
              ? "connected"
              : wsStatus === "error"
                ? "error"
                : `closed${wsCloseInfo ? ` (${wsCloseInfo})` : ""}`}
        </p>

        <div style={styles.gems}>
          <span style={styles.gemLabel}>Gems</span>
          <span style={styles.gemCount}>
            {gems === null ? "..." : gems} / {gemMax === null ? "..." : gemMax}
          </span>
        </div>

        {!inPool ? (
          <button style={styles.primaryBtn} onClick={enterPool} disabled={wsStatus !== "open"}>
            Enter the Pool
          </button>
        ) : (
          <>
            <div style={styles.statusRow}>
              <span style={styles.pulseDot} />
              <span style={styles.statusText}>{searchingLabel}</span>
            </div>
            <button style={styles.secondaryBtn} onClick={leavePool}>
              Cancel Search
            </button>
          </>
        )}

        <p style={styles.micro}>Matches are live. If you leave mid-room, you stay until the timer ends.</p>

        <button style={styles.secondaryBtn} onClick={logout}>
          Log out
        </button>

        <Link to="/" style={styles.back}>
          {"<-"} Back
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0f0f1a",
    color: "white",
    fontFamily: "system-ui, sans-serif",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 24,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  title: { fontSize: "2rem", margin: 0 },
  subtitle: { opacity: 0.8, margin: 0 },
  apiLine: { opacity: 0.7, margin: 0, fontSize: 13 },
  gems: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
  },
  gemLabel: { opacity: 0.7 },
  gemCount: { fontWeight: 800 },
  primaryBtn: {
    padding: "14px",
    borderRadius: 14,
    background: "white",
    color: "#0f0f1a",
    border: "none",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "14px",
    borderRadius: 14,
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.25)",
    fontWeight: 700,
    cursor: "pointer",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "white",
    boxShadow: "0 0 18px rgba(255,255,255,0.7)",
  },
  statusText: { fontWeight: 700, opacity: 0.9 },
  micro: { opacity: 0.6, fontSize: 13, margin: 0 },
  back: { color: "rgba(255,255,255,0.7)", textDecoration: "none" },
};
