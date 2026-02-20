import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

type ServerMsg =
  | { type: "WS_READY" }
  | { type: "POOL_JOINED" }
  | { type: "POOL_LEFT" }
  | { type: "MATCH_FOUND"; matchId: string; peerId: string; endsAt: number }
  | { type: "TIMER_UPDATE"; matchId: string; endsAt: number; by: string }
  | { type: "CHAT_MSG"; matchId: string; from: string; text: string; at: string }
  | { type: "PEER_STATUS"; matchId: string; peerId: string; status: "reconnecting" | "connected" }
  | { type: "MATCH_ENDED"; reason: "leave" | "disconnect" | "timeout" }
  | { type: "ERROR"; error: string };

type ClientMsg =
  | { type: "CHAT_SEND"; matchId: string; text: string }
  | { type: "POOL_LEAVE" }
  | { type: "MATCH_EXTEND"; matchId: string };

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
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
    return existing;
  }

  const devUser = getOrCreateDevUserId();
  const wsUrl = `${wsBase}?token=dev&user=${encodeURIComponent(devUser)}`;

  const ws = new WebSocket(wsUrl);
  w.__rush_ws = ws;
  return ws;
}

type ChatItem = { from: string; text: string; at: string };

export default function Match() {
  const navigate = useNavigate();
  const { matchId: matchIdParam } = useParams();
  const location = useLocation();

  const matchId = String(matchIdParam ?? "");
  const initialPeerId = (location.state as any)?.peerId ? String((location.state as any).peerId) : "someone";
  const initialEndsAt = (location.state as any)?.endsAt ? Number((location.state as any).endsAt) : null;

  const WS_BASE = (import.meta as any).env?.VITE_WS_URL || "ws://127.0.0.1:3001/ws";

  const wsRef = useRef<WebSocket | null>(null);

  const [peerId, setPeerId] = useState<string>(initialPeerId);
  const [endsAt, setEndsAt] = useState<number | null>(initialEndsAt);

  const [ended, setEnded] = useState<null | { reason: string }>(null);
  const [peerReconnecting, setPeerReconnecting] = useState(false);

  const [chat, setChat] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");

  const [decisionSeconds, setDecisionSeconds] = useState<number>(10);
  const [extendPressed, setExtendPressed] = useState(false);

  // ✅ Persistent extended banner
  const [extendedActive, setExtendedActive] = useState(false);
  const [extendedBy, setExtendedBy] = useState<string>("");

  const [secondsLeft, setSecondsLeft] = useState<number>(
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0
  );

  // Countdown derived from endsAt
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!endsAt) return;
      const remainingSec = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remainingSec);
    }, 250);

    return () => window.clearInterval(id);
  }, [endsAt]);

  // Safety: if time runs out again, extended banner should not persist
  useEffect(() => {
    if (secondsLeft <= 0) {
      // We keep ended menu logic controlled by server MATCH_ENDED,
      // but this ensures the banner doesn't stick around forever.
      setExtendedActive(false);
      setExtendedBy("");
    }
  }, [secondsLeft]);

  // WebSocket wiring
  useEffect(() => {
    const ws = getOrCreateWs(WS_BASE);
    wsRef.current = ws;

    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;

        if (msg.type === "MATCH_FOUND") {
          if (msg.matchId !== matchId) return;
          setPeerId(msg.peerId);
          setEndsAt(msg.endsAt);
          return;
        }

        if (msg.type === "TIMER_UPDATE") {
          if (msg.matchId !== matchId) return;

          // Update timer
          setEndsAt(msg.endsAt);

          // Resume match UI (close end menu)
          setEnded(null);
          setDecisionSeconds(10);
          setExtendPressed(false);

          // ✅ Persistent banner until match ends
          setExtendedActive(true);
          setExtendedBy(msg.by || "");

          return;
        }

        if (msg.type === "PEER_STATUS") {
          if (msg.matchId !== matchId) return;
          if (msg.status === "reconnecting") setPeerReconnecting(true);
          if (msg.status === "connected") setPeerReconnecting(false);
          return;
        }

        if (msg.type === "CHAT_MSG") {
          if (msg.matchId !== matchId) return;
          setChat((prev) => [...prev, { from: msg.from, text: msg.text, at: msg.at }]);
          return;
        }

        if (msg.type === "MATCH_ENDED") {
          setEnded({ reason: msg.reason });
          setPeerReconnecting(false);
          setDecisionSeconds(10);
          setExtendPressed(false);

          // If the match ended again, extension is no longer active
          setExtendedActive(false);
          setExtendedBy("");

          return;
        }

        if (msg.type === "ERROR") {
          // Extend errors etc.
          setExtendPressed(false);
          return;
        }
      } catch {
        // ignore
      }
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [WS_BASE, matchId]);

  // 10-second decision countdown once ended
  useEffect(() => {
    if (!ended) return;

    const id = window.setInterval(() => {
      setDecisionSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [ended]);

  // Auto-return when decision countdown hits 0
  useEffect(() => {
    if (!ended) return;
    if (decisionSeconds !== 0) return;

    navigate("/queue");
  }, [ended, decisionSeconds, navigate]);

  const timeLabel = useMemo(() => formatSeconds(secondsLeft), [secondsLeft]);

  function wsSend(payload: ClientMsg) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }

  function sendChat() {
    const text = draft.trim();
    if (!text) return;
    if (ended) return;

    const ok = wsSend({ type: "CHAT_SEND", matchId, text });
    if (!ok) return;
    setDraft("");
  }

  function leaveMatch() {
    wsSend({ type: "POOL_LEAVE" });
    navigate("/queue");
  }

  const endedTitle =
    ended?.reason === "timeout"
      ? "Time’s up!"
      : ended?.reason === "disconnect"
        ? "They disconnected."
        : ended?.reason === "leave"
          ? "Match ended."
          : "Match ended.";

  function onExtend() {
    if (!ended || ended.reason !== "timeout") return;
    if (extendPressed) return;

    setExtendPressed(true);

    const ok = wsSend({ type: "MATCH_EXTEND", matchId });
    if (!ok) setExtendPressed(false);
  }

  function onReport() {
    navigate("/post-chat", { state: { matchId, peerId } });
  }

  function onBackToQueue() {
    navigate("/queue");
  }

  const extendedLabel = extendedBy ? `Extended 💎 (by ${extendedBy})` : "Extended 💎";

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Match</h1>

        <p style={styles.subtitle}>
          You’re matched with <strong>{peerId}</strong>
        </p>

        {peerReconnecting && !ended ? (
          <div style={styles.banner}>
            <strong style={styles.bannerStrong}>Peer reconnecting…</strong>
            <span style={styles.bannerSub}>Hold on a sec.</span>
          </div>
        ) : null}

        {/* ✅ Persistent extended banner */}
        {extendedActive && !ended ? (
          <div style={styles.extendedBanner}>
            <strong style={styles.extendedStrong}>{extendedLabel}</strong>
            <span style={styles.extendedSub}>This match has extra time.</span>
          </div>
        ) : null}

        <div style={styles.timerRow}>
          <span style={styles.timerLabel}>Time left</span>
          <span style={styles.timerValue}>{endsAt ? timeLabel : "syncing…"}</span>
        </div>

        {ended ? (
          <div style={styles.endMenu}>
            <div style={styles.endTitle}>{endedTitle}</div>
            <div style={styles.endSub}>Choose an option ({decisionSeconds}s)…</div>

            <div style={styles.endBtns}>
              <button
                style={{
                  ...styles.primaryBtn,
                  opacity: ended.reason === "timeout" ? 1 : 0.5,
                  cursor: ended.reason === "timeout" ? "pointer" : "not-allowed",
                }}
                onClick={onExtend}
                disabled={ended.reason !== "timeout" || extendPressed}
              >
                {extendPressed ? "Extending…" : "Extend 💎"}
              </button>

              <button style={styles.secondaryBtn} onClick={onReport}>
                Report
              </button>

              <button style={styles.secondaryBtn} onClick={onBackToQueue}>
                Back to Queue
              </button>
            </div>

            <div style={styles.endHint}>
              If you don’t choose, you’ll be returned to the queue automatically.
            </div>
          </div>
        ) : (
          <>
            <div style={styles.chatBox}>
              {chat.length === 0 ? (
                <div style={styles.chatEmpty}>Say hi 👋</div>
              ) : (
                chat.map((m, idx) => (
                  <div key={idx} style={styles.chatLine}>
                    <span style={styles.chatFrom}>{m.from}:</span>{" "}
                    <span style={styles.chatText}>{m.text}</span>
                  </div>
                ))
              )}
            </div>

            <div style={styles.inputRow}>
              <input
                style={styles.input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
              />
              <button style={styles.sendBtn} onClick={sendChat}>
                Send
              </button>
            </div>

            <button style={styles.secondaryBtn} onClick={leaveMatch}>
              Leave Match
            </button>
          </>
        )}

        <Link to="/queue" style={styles.back}>
          ← Back to Queue
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
    maxWidth: 720,
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
  subtitle: { opacity: 0.85, margin: 0 },

  banner: {
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.15)",
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  bannerStrong: { fontWeight: 900 },
  bannerSub: { opacity: 0.8 },

  extendedBanner: {
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  extendedStrong: { fontWeight: 950 },
  extendedSub: { opacity: 0.8, fontSize: 13 },

  timerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
  },
  timerLabel: { opacity: 0.7 },
  timerValue: { fontWeight: 900, fontSize: 18 },

  chatBox: {
    minHeight: 240,
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.06)",
    overflow: "auto",
  },
  chatEmpty: { opacity: 0.6, fontStyle: "italic" },
  chatLine: { marginBottom: 8, lineHeight: 1.35 },
  chatFrom: { fontWeight: 800, opacity: 0.9 },
  chatText: { opacity: 0.95 },

  inputRow: { display: "flex", gap: 10 },
  input: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.15)",
    color: "white",
    outline: "none",
  },
  sendBtn: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "white",
    color: "#0f0f1a",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },

  endMenu: {
    padding: 16,
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  endTitle: { fontWeight: 950, fontSize: 22 },
  endSub: { opacity: 0.8 },
  endBtns: { display: "flex", flexDirection: "column", gap: 10 },
  endHint: { opacity: 0.65, fontSize: 13 },

  primaryBtn: {
    padding: "14px",
    borderRadius: 14,
    background: "white",
    color: "#0f0f1a",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "14px",
    borderRadius: 14,
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.25)",
    fontWeight: 800,
    cursor: "pointer",
  },

  back: { color: "rgba(255,255,255,0.7)", textDecoration: "none" },
};