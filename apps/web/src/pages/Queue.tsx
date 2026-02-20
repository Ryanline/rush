import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function formatSeconds(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function getOrCreateDevUserId(): string {
  const key = "rush_dev_user";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const id = `dev_${Math.random().toString(16).slice(2, 8)}`;
  localStorage.setItem(key, id);
  return id;
}

function getOrCreateWs(wsBase: string): WebSocket {
  const w = window as any;

  const existing: WebSocket | undefined = w.__rush_ws;
  if (
    existing &&
    (existing.readyState === WebSocket.OPEN ||
      existing.readyState === WebSocket.CONNECTING)
  ) {
    return existing;
  }

  const devUser = getOrCreateDevUserId();
  const wsUrl = `${wsBase}?token=dev&user=${encodeURIComponent(devUser)}`;

  console.log("[ws] connecting to", wsUrl);
  const ws = new WebSocket(wsUrl);
  w.__rush_ws = ws;
  return ws;
}

export default function Queue() {
  const navigate = useNavigate();

  const [inPool, setInPool] = useState(false);
  const [secondsSearching, setSecondsSearching] = useState(0);
  const [apiConnected, setApiConnected] = useState<null | boolean>(null);

  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed" | "error">(
    "connecting"
  );
  const [wsCloseInfo, setWsCloseInfo] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);

  const gems = 3;
  const gemMax = 3;

  const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:3001";
  const WS_BASE = (import.meta as any).env?.VITE_WS_URL || "ws://127.0.0.1:3001/ws";

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
  }, [API_BASE]);

  useEffect(() => {
    const ws = getOrCreateWs(WS_BASE);
    wsRef.current = ws;

    const onOpen = () => {
      console.log("[ws] open");
      setWsStatus("open");
      setWsCloseInfo("");
    };

    const onError = (e: Event) => {
      console.log("[ws] error", e);
      setWsStatus("error");
    };

    const onClose = (ev: CloseEvent) => {
      console.log("[ws] closed", { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
      setWsStatus("closed");
      setWsCloseInfo(`code ${ev.code}${ev.reason ? `: ${ev.reason}` : ""}`);
    };

    const onMessage = (ev: MessageEvent) => {
      console.log("[ws] raw", ev.data);
      try {
        const msg = JSON.parse(String(ev.data));

        if (msg.type === "MATCH_FOUND") {
          setInPool(false);
          setSecondsSearching(0);

          navigate(`/match/${encodeURIComponent(msg.matchId)}`, {
            state: { matchId: msg.matchId, peerId: msg.peerId, endsAt: msg.endsAt },
          });
          return;
        }

        if (msg.type === "MATCH_ENDED") {
          setInPool(false);
          setSecondsSearching(0);
          return;
        }
      } catch {
        // ignore
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
  }, [WS_BASE, navigate]);

  useEffect(() => {
    if (!inPool) return;

    const id = window.setInterval(() => {
      setSecondsSearching((s) => s + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [inPool]);

  const searchingLabel = useMemo(() => {
    return `Searching: ${formatSeconds(secondsSearching)}`;
  }, [secondsSearching]);

  function enterPool() {
    setInPool(true);
    setSecondsSearching(0);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "POOL_JOIN" }));
      console.log("[ws] sent POOL_JOIN");
    } else {
      console.warn("WS not open yet", ws?.readyState);
    }
  }

  function leavePool() {
    setInPool(false);
    setSecondsSearching(0);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "POOL_LEAVE" }));
      console.log("[ws] sent POOL_LEAVE");
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{inPool ? "You’re in the Pool" : "Ready to Rush?"}</h1>

        <p style={styles.subtitle}>
          {inPool ? "Stay ready. Matches happen live." : "Live matching. Two minutes. No swiping."}
        </p>

        <p style={styles.apiLine}>
          API: {apiConnected === null ? "checking…" : apiConnected ? "connected" : "not connected"}
        </p>

        <p style={styles.apiLine}>
          WS:{" "}
          {wsStatus === "connecting"
            ? "connecting…"
            : wsStatus === "open"
              ? "connected"
              : wsStatus === "error"
                ? "error"
                : `closed${wsCloseInfo ? ` (${wsCloseInfo})` : ""}`}
        </p>

        <div style={styles.gems}>
          <span style={styles.gemLabel}>Gems</span>
          <span style={styles.gemCount}>
            {gems} / {gemMax}
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

        <p style={styles.micro}>
          Matches are live. If you leave mid-room, you stay until the timer ends.
        </p>

        <Link to="/" style={styles.back}>
          ← Back
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