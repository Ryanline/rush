import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function formatSeconds(s: number) {
  return s.toString().padStart(2, "0");
}

export default function Preview() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(10);

  // Fake matched profile (later comes from backend)
  const match = useMemo(() => {
    return {
      firstName: "Avery",
      age: 26,
      tags: ["anime", "coffee", "hiking"],
      photoUrl: "https://picsum.photos/200?random=7",
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate("/chat", { replace: true });
    }
  }, [secondsLeft, navigate]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.topRow}>
          <div>
            <div style={styles.kicker}>Get ready!</div>
            <h1 style={styles.title}>in 10…</h1>
            <div style={styles.count}>{formatSeconds(Math.max(0, secondsLeft))}</div>
          </div>

          <div style={styles.avatarWrap}>
            <img src={match.photoUrl} alt="Match" style={styles.avatar} />
          </div>
        </div>

        <div style={styles.nameRow}>
          <div style={styles.name}>
            {match.firstName} <span style={styles.meta}>• {match.age}</span>
          </div>
        </div>

        <div style={styles.tags}>
          {match.tags.map((t) => (
            <span key={t} style={styles.tag}>
              {t}
            </span>
          ))}
        </div>

        <p style={styles.micro}>
          You’ll have 2 minutes to chat. Leaving after match starts will lock you out until the timer ends.
        </p>

        <button
          style={styles.secondaryBtn}
          onClick={() => navigate("/queue")}
          title="This is allowed during preview for now (we can decide later)."
        >
          Back to Queue
        </button>
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
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 24,
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
  },
  kicker: { opacity: 0.8, fontWeight: 700 },
  title: { fontSize: "2.2rem", margin: 0 },
  count: { marginTop: 6, fontSize: "1.4rem", opacity: 0.85, fontWeight: 800 },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  avatar: { width: "100%", height: "100%", objectFit: "cover" },
  nameRow: { marginTop: 4 },
  name: { fontSize: "1.2rem", fontWeight: 800 },
  meta: { opacity: 0.7, fontWeight: 600 },
  tags: { display: "flex", gap: 8, flexWrap: "wrap" },
  tag: {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 13,
    opacity: 0.9,
  },
  micro: { opacity: 0.65, fontSize: 13, lineHeight: 1.35, marginTop: 6 },
  secondaryBtn: {
    marginTop: 4,
    padding: "12px 14px",
    borderRadius: 14,
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.25)",
    fontWeight: 700,
    cursor: "pointer",
  },
};