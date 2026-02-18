import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function formatSeconds(totalSeconds: number) {
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function Queue() {
  const navigate = useNavigate();

  const [inPool, setInPool] = useState(false);
  const [secondsSearching, setSecondsSearching] = useState(0);

  // For now: hardcoded gems. Later this comes from backend/user state.
  const gems = 3;
  const gemMax = 3;

  useEffect(() => {
    if (!inPool) return;

    const id = window.setInterval(() => {
      setSecondsSearching((s) => s + 1);
    }, 1000);

    // DEV SIMULATION: "found match" after 5 seconds
    const matchId = window.setTimeout(() => {
      setInPool(false);
      setSecondsSearching(0);
      navigate("/preview");
    }, 5000);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(matchId);
    };
  }, [inPool, navigate]);

  const searchingLabel = useMemo(() => {
    return `Searching: ${formatSeconds(secondsSearching)}`;
  }, [secondsSearching]);

  function enterPool() {
    setInPool(true);
    setSecondsSearching(0);
  }

  function cancelSearch() {
    setInPool(false);
    setSecondsSearching(0);
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{inPool ? "You’re in the Pool" : "Ready to Rush?"}</h1>

        <p style={styles.subtitle}>
          {inPool ? "Stay ready. Matches happen live." : "Live matching. Two minutes. No swiping."}
        </p>

        <div style={styles.gems}>
          <span style={styles.gemLabel}>Gems</span>
          <span style={styles.gemCount}>
            {gems} / {gemMax}
          </span>
        </div>

        {!inPool ? (
          <button style={styles.primaryBtn} onClick={enterPool}>
            Enter the Pool
          </button>
        ) : (
          <>
            <div style={styles.statusRow}>
              <span style={styles.pulseDot} />
              <span style={styles.statusText}>{searchingLabel}</span>
            </div>

            <button style={styles.secondaryBtn} onClick={cancelSearch}>
              Cancel Search
            </button>
          </>
        )}

        <p style={styles.micro}>
          {inPool
            ? "You can cancel while searching. Penalties only apply after you’re matched."
            : "Matches are live. Once matched, leaving early forces you to wait out the timer."}
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
  subtitle: { opacity: 0.8 },
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
    animation: "pulse 1.2s infinite ease-in-out",
  },
  statusText: { fontWeight: 700, opacity: 0.9 },

  micro: { opacity: 0.6, fontSize: 13 },
  back: { color: "rgba(255,255,255,0.7)", textDecoration: "none" },
};