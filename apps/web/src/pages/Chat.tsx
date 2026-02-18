import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const CHAT_SECONDS = 120; // later: configurable
const LS_CHAT_LOCK_UNTIL = "rush_chat_lock_until_ms";

function formatSeconds(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

type Msg = { id: string; who: "me" | "them"; text: string; at: number };

export default function Chat() {
  const navigate = useNavigate();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(CHAT_SECONDS);

  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: "t1", who: "them", text: "Hey! What’s your day been like?", at: Date.now() },
  ]);

  // Fake match identity for header (later from backend)
  const match = useMemo(() => ({ firstName: "Avery", age: 26 }), []);

  // Lockout check (if user left early last time)
  const lockUntilMs = Number(localStorage.getItem(LS_CHAT_LOCK_UNTIL) || "0");
  const locked = nowMs < lockUntilMs;
  const lockSecondsLeft = Math.max(0, Math.ceil((lockUntilMs - nowMs) / 1000));

  // Tick "now" for lock countdown
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Chat countdown only runs if not locked
  useEffect(() => {
    if (locked) return;

    const id = window.setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [locked]);

  // When timer ends, go to post-chat screen
  useEffect(() => {
    if (locked) return;
    if (secondsLeft <= 0) {
      navigate("/post-chat", { replace: true });
    }
  }, [secondsLeft, locked, navigate]);

  // Auto-scroll to bottom
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  function send() {
    const text = input.trim();
    if (!text) return;

    setMsgs((m) => [
      ...m,
      { id: crypto.randomUUID(), who: "me", text, at: Date.now() },
    ]);
    setInput("");

    // Fake response
    window.setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          who: "them",
          text: "Nice — tell me more 👀",
          at: Date.now(),
        },
      ]);
    }, 700);
  }

  function leaveEarly() {
    // If you leave, you must wait out whatever time remains in the 2:00 chat.
    const remaining = Math.max(0, secondsLeft);
    const untilMs = Date.now() + remaining * 1000;
    localStorage.setItem(LS_CHAT_LOCK_UNTIL, String(untilMs));
    navigate("/queue", { replace: true });
  }

  if (locked) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Cooldown</h1>
          <p style={styles.subtitle}>
            You left a chat early. You can re-enter the pool in{" "}
            <b>{formatSeconds(lockSecondsLeft)}</b>.
          </p>
          <Link to="/queue" style={styles.linkBtn}>
            Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.chatShell}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.matchName}>
              {match.firstName} <span style={styles.meta}>• {match.age}</span>
            </div>
            <div style={styles.timer}>{formatSeconds(Math.max(0, secondsLeft))}</div>
          </div>

          <button style={styles.leaveBtn} onClick={leaveEarly}>
            Leave
          </button>
        </div>

        <div style={styles.messages}>
          {msgs.map((m) => (
            <div
              key={m.id}
              style={{
                ...styles.bubble,
                ...(m.who === "me" ? styles.meBubble : styles.themBubble),
              }}
            >
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div style={styles.composer}>
          <input
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type fast. Keep it fun."
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button style={styles.sendBtn} onClick={send}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "#0f0f1a",
    color: "white",
    fontFamily: "system-ui, sans-serif",
    padding: 16,
    display: "grid",
    placeItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 24,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },
  title: { margin: 0, fontSize: "2rem" },
  subtitle: { opacity: 0.75, lineHeight: 1.4, marginTop: 10 },
  linkBtn: {
    display: "inline-block",
    marginTop: 16,
    padding: "12px 14px",
    borderRadius: 14,
    background: "white",
    color: "#0f0f1a",
    textDecoration: "none",
    fontWeight: 800,
  },

  chatShell: {
    width: "100%",
    maxWidth: 640,
    height: "min(80vh, 720px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: 14,
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: { display: "flex", flexDirection: "column", gap: 4 },
  matchName: { fontWeight: 900, fontSize: 16 },
  meta: { opacity: 0.7, fontWeight: 600 },
  timer: { opacity: 0.85, fontWeight: 800 },
  leaveBtn: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.25)",
    fontWeight: 700,
    cursor: "pointer",
  },
  messages: {
    flex: 1,
    padding: 14,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  bubble: {
    maxWidth: "78%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    lineHeight: 1.35,
  },
  meBubble: {
    alignSelf: "flex-end",
    background: "rgba(255,255,255,0.12)",
  },
  themBubble: {
    alignSelf: "flex-start",
    background: "rgba(0,0,0,0.25)",
  },
  composer: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    gap: 10,
  },
  input: {
    flex: 1,
    padding: "12px 12px",
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
};