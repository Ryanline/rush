import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { authFetch, buildWsUrl, clearAuth, getAuthUser } from "../lib/auth";

type ServerMsg =
  | { type: "WS_READY" }
  | { type: "POOL_JOINED" }
  | { type: "POOL_LEFT" }
  | { type: "MATCH_FOUND"; matchId: string; peerId: string; peerName: string; endsAt: number }
  | { type: "TIMER_UPDATE"; matchId: string; endsAt: number; by: string; byName: string }
  | { type: "CHAT_MSG"; matchId: string; from: string; fromName: string; text: string; at: string }
  | { type: "PEER_STATUS"; matchId: string; peerId: string; status: "reconnecting" | "connected" }
  | { type: "MATCH_ENDED"; reason: "leave" | "disconnect" | "timeout" }
  | { type: "ERROR"; error: string };

type ClientMsg =
  | { type: "CHAT_SEND"; matchId: string; text: string }
  | { type: "POOL_LEAVE" }
  | { type: "MATCH_EXTEND"; matchId: string };

type ChatItem = { fromId: string; fromName: string; text: string; at: string };
type MatchLocationState = { peerId?: string; peerName?: string; endsAt?: number };

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

export default function Match() {
  const navigate = useNavigate();
  const { matchId: matchIdParam } = useParams();
  const location = useLocation();
  const locationState = (location.state ?? {}) as MatchLocationState;
  const me = getAuthUser();

  const matchId = String(matchIdParam ?? "");
  const initialPeerId = locationState.peerId ? String(locationState.peerId) : "someone";
  const initialPeerName = locationState.peerName ? String(locationState.peerName) : initialPeerId;
  const initialEndsAt = locationState.endsAt ? Number(locationState.endsAt) : null;

  const wsRef = useRef<WebSocket | null>(null);
  const hasSyncedMatchRef = useRef<boolean>(!!initialEndsAt);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  const [peerId, setPeerId] = useState<string>(initialPeerId);
  const [peerName, setPeerName] = useState<string>(initialPeerName);
  const [endsAt, setEndsAt] = useState<number | null>(initialEndsAt);
  const [ended, setEnded] = useState<null | { reason: string }>(null);
  const [peerReconnecting, setPeerReconnecting] = useState(false);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [decisionSeconds, setDecisionSeconds] = useState<number>(10);
  const [extendPressed, setExtendPressed] = useState(false);
  const [extendedActive, setExtendedActive] = useState(false);
  const [gemBalance, setGemBalance] = useState<number | null>(null);
  const [gemMsg, setGemMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  const refreshGems = useCallback(async () => {
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
      if (data?.gems) setGemBalance(Number(data.gems.gems));
    } catch {
      // ignore gem refresh failures
    }
  }, [navigate]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!endsAt) return;
      const remainingSec = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remainingSec);
    }, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    const wsUrl = buildWsUrl();
    if (!wsUrl) {
      clearAuth();
      navigate("/login", { replace: true });
      return;
    }

    const ws = getOrCreateWs(wsUrl);
    wsRef.current = ws;

    const onClose = (ev: CloseEvent) => {
      if (ev.code === 4401 || ev.code === 4403) {
        clearAuth();
        navigate("/login", { replace: true });
      }
    };

    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;

        if (msg.type === "MATCH_FOUND") {
          if (msg.matchId !== matchId) return;
          hasSyncedMatchRef.current = true;
          setPeerId(msg.peerId);
          setPeerName(msg.peerName || msg.peerId);
          setEndsAt(msg.endsAt);
          return;
        }

        if (msg.type === "TIMER_UPDATE") {
          if (msg.matchId !== matchId) return;
          setEndsAt(msg.endsAt);
          setEnded(null);
          setDecisionSeconds(10);
          setExtendPressed(false);
          setExtendedActive(true);
          setGemMsg("");
          refreshGems();
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
          setChat((prev) => [...prev, { fromId: msg.from, fromName: msg.fromName || msg.from, text: msg.text, at: msg.at }]);
          return;
        }

        if (msg.type === "MATCH_ENDED") {
          setEnded({ reason: msg.reason });
          setPeerReconnecting(false);
          setDecisionSeconds(10);
          setExtendPressed(false);
          setExtendedActive(false);
          setGemMsg("");
          refreshGems();
          return;
        }

        if (msg.type === "ERROR") {
          if (msg.error === "EXTEND_PENDING") {
            setExtendPressed(false);
            return;
          }
          if (msg.error === "NOT_ENOUGH_GEMS") {
            setExtendPressed(false);
            setGemMsg("Not enough gems.");
            refreshGems();
            return;
          }
          setExtendPressed(false);
          return;
        }
      } catch {
        // ignore malformed socket message
      }
    };

    ws.addEventListener("close", onClose);
    ws.addEventListener("message", onMessage);
    const initialGemRefreshId = window.setTimeout(() => {
      void refreshGems();
    }, 0);

    // If this route is opened without an active match, return user to queue.
    const settleId = window.setTimeout(() => {
      if (!hasSyncedMatchRef.current) navigate("/queue", { replace: true });
    }, 2500);

    return () => {
      window.clearTimeout(initialGemRefreshId);
      window.clearTimeout(settleId);
      ws.removeEventListener("close", onClose);
      ws.removeEventListener("message", onMessage);
    };
  }, [matchId, navigate, refreshGems]);

  useEffect(() => {
    if (!ended) return;
    const id = window.setInterval(() => setDecisionSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [ended]);

  useEffect(() => {
    if (!ended) return;
    if (decisionSeconds !== 0) return;
    navigate("/queue");
  }, [ended, decisionSeconds, navigate]);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const timeLabel = useMemo(() => formatSeconds(secondsLeft), [secondsLeft]);

  function wsSend(payload: ClientMsg) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }

  function sendChat() {
    const text = draft.trim();
    if (!text || ended) return;
    const ok = wsSend({ type: "CHAT_SEND", matchId, text });
    if (ok) setDraft("");
  }

  function leaveMatch() {
    wsSend({ type: "POOL_LEAVE" });
    navigate("/queue");
  }

  const endedTitle =
    ended?.reason === "timeout"
      ? "Time's up!"
      : ended?.reason === "disconnect"
        ? "They disconnected."
        : ended?.reason === "leave"
          ? "Match ended."
          : "Match ended.";

  function onExtend() {
    if (!ended || ended.reason !== "timeout" || extendPressed) return;
    setGemMsg("");
    setExtendPressed(true);
    const ok = wsSend({ type: "MATCH_EXTEND", matchId });
    if (!ok) setExtendPressed(false);
  }

  const extendedLabel = "Extended";

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Match</h1>
        <p style={styles.subtitle}>
          You're matched with <strong>{peerName}</strong>
        </p>

        {peerReconnecting && !ended ? (
          <div style={styles.banner}>
            <strong style={styles.bannerStrong}>Peer reconnecting...</strong>
            <span style={styles.bannerSub}>Hold on a sec.</span>
          </div>
        ) : null}

        {extendedActive && !ended && secondsLeft > 0 ? (
          <div style={styles.extendedBanner}>
            <strong style={styles.extendedStrong}>{extendedLabel}</strong>
            <span style={styles.extendedSub}>This match has extra time.</span>
          </div>
        ) : null}

        <div style={styles.timerRow}>
          <span style={styles.timerLabel}>Time left</span>
          <span style={styles.timerValue}>{endsAt ? timeLabel : "syncing..."}</span>
        </div>

        {ended ? (
          <div style={styles.endMenu}>
            <div style={styles.endTitle}>{endedTitle}</div>
            <div style={styles.endSub}>Choose an option ({decisionSeconds}s)...</div>

            <div style={styles.gemRow}>
              <span style={styles.gemLabel}>Gems</span>
              <span style={styles.gemValue}>{gemBalance === null ? "..." : gemBalance}</span>
            </div>

            {gemMsg ? <div style={styles.gemMsg}>{gemMsg}</div> : null}

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
                {extendPressed ? "Extending..." : "Extend"}
              </button>

              <button style={styles.secondaryBtn} onClick={() => navigate("/post-chat", { state: { matchId, peerId, peerName } })}>
                Report
              </button>

              <button style={styles.secondaryBtn} onClick={() => navigate("/queue")}>
                Back to Queue
              </button>
            </div>

            <div style={styles.endHint}>If you don't choose, you'll return to queue automatically.</div>
          </div>
        ) : (
          <>
            <div ref={chatBoxRef} style={styles.chatBox}>
              {chat.length === 0 ? (
                <div style={styles.chatEmpty}>Say hi</div>
              ) : (
                chat.map((m, idx) => (
                  <div key={idx} style={{ ...styles.chatLine, justifyContent: m.fromId === me?.id ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        ...(m.fromId === me?.id ? styles.myBubble : styles.theirBubble),
                      }}
                    >
                      <div style={styles.chatFrom}>{m.fromName}</div>
                      <div style={styles.chatText}>{m.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={styles.inputRow}>
              <input
                style={styles.input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
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
          {"<-"} Back to Queue
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
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  bannerStrong: { fontSize: 14 },
  bannerSub: { opacity: 0.8, fontSize: 13 },
  extendedBanner: {
    border: "1px solid rgba(170,220,255,0.5)",
    background: "rgba(170,220,255,0.15)",
    borderRadius: 12,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  extendedStrong: { fontSize: 14 },
  extendedSub: { opacity: 0.85, fontSize: 13 },
  timerRow: {
    display: "flex",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.06)",
  },
  timerLabel: { opacity: 0.75 },
  timerValue: { fontWeight: 800 },
  chatBox: {
    minHeight: 220,
    maxHeight: 320,
    overflowY: "auto",
    borderRadius: 12,
    padding: 12,
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  chatEmpty: { opacity: 0.7 },
  chatLine: { lineHeight: 1.35, display: "flex", width: "100%" },
  chatFrom: { fontWeight: 700, opacity: 0.95, fontSize: 12, marginBottom: 2 },
  chatText: { opacity: 1, whiteSpace: "pre-wrap" },
  myBubble: {
    maxWidth: "80%",
    alignSelf: "flex-end",
    background: "#924DBF",
    color: "white",
    borderRadius: 14,
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  theirBubble: {
    maxWidth: "80%",
    alignSelf: "flex-start",
    background: "#2d2f39",
    color: "white",
    borderRadius: 14,
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  inputRow: { display: "flex", gap: 10 },
  input: {
    flex: 1,
    padding: "12px 12px",
    fontSize: 16,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.25)",
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
    borderRadius: 12,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  endTitle: { fontWeight: 900, fontSize: 20 },
  endSub: { opacity: 0.8 },
  gemRow: { display: "flex", justifyContent: "space-between" },
  gemLabel: { opacity: 0.8 },
  gemValue: { fontWeight: 900 },
  gemMsg: { color: "#ffb3b3", fontSize: 13 },
  endBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  endHint: { opacity: 0.7, fontSize: 13 },
  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "white",
    color: "#0f0f1a",
    border: "none",
    fontWeight: 900,
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.25)",
    fontWeight: 700,
    cursor: "pointer",
  },
  back: { color: "rgba(255,255,255,0.7)", textDecoration: "none" },
};
