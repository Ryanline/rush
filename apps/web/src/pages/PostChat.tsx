import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function PostChat() {
  const match = useMemo(() => ({ firstName: "Avery" }), []);
  const [offered, setOffered] = useState(false);

  // Hardcoded gems for now
  const gems = 3;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Time’s up</h1>
        <p style={styles.subtitle}>
          Chat ended with <b>{match.firstName}</b>.
        </p>

        <div style={styles.row}>
          <div style={styles.gemsBox}>
            <span style={{ opacity: 0.7 }}>Gems</span>
            <span style={{ fontWeight: 900 }}>{gems}</span>
          </div>
        </div>

        <div style={styles.actions}>
          <button
            style={{
              ...styles.primaryBtn,
              opacity: gems > 0 ? 1 : 0.5,
              cursor: gems > 0 ? "pointer" : "not-allowed",
            }}
            disabled={gems <= 0}
            onClick={() => setOffered(true)}
          >
            Extend (spend 1 gem)
          </button>

          <button style={styles.secondaryBtn}>
            Pass
          </button>
        </div>

        {offered ? (
          <div style={styles.notice}>
            Offer sent. If they also spend a gem within 15 seconds, you’ll get +5 minutes.
          </div>
        ) : (
          <div style={styles.noticeMuted}>
            Pass is silent. They won’t be notified.
          </div>
        )}

        <Link to="/queue" style={styles.back}>
          Back to Queue
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
  title: { fontSize: "2rem", margin: 0 },
  subtitle: { opacity: 0.8 },
  row: { display: "flex", justifyContent: "space-between" },
  gemsBox: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
  },
  actions: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 },
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
    fontWeight: 800,
  },
  notice: {
    marginTop: 4,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    opacity: 0.95,
  },
  noticeMuted: { marginTop: 4, opacity: 0.65, fontSize: 13 },
  back: { marginTop: 8, color: "rgba(255,255,255,0.75)" },
};