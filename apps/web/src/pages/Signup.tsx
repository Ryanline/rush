import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, isAuthenticated, saveAuth } from "../lib/auth";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated()) navigate("/queue", { replace: true });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          birthYear: Number(birthYear),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token || !data?.user) {
        setError(data?.error || "Signup failed");
        return;
      }

      saveAuth({ token: data.token, user: data.user });
      navigate("/queue");
    } catch {
      setError("Unable to reach server");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={onSubmit}>
        <h1 style={styles.title}>Create account</h1>

        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          placeholder="password (8+ chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <label style={styles.label}>First name</label>
        <input
          style={styles.input}
          placeholder="Ryan"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
        />

        <label style={styles.label}>Birth year</label>
        <input
          style={styles.input}
          placeholder="1999"
          inputMode="numeric"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
        />

        {error ? <p style={styles.error}>{error}</p> : null}

        <button style={styles.primaryBtn} disabled={pending}>
          {pending ? "Creating account..." : "Continue"}
        </button>

        <p style={styles.micro}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>
            Log in
          </Link>
        </p>

        <Link to="/" style={styles.back}>
          {"<-"} Back
        </Link>
      </form>
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
    gap: 10,
  },
  title: { fontSize: "2rem", margin: 0 },
  label: { fontSize: 13, opacity: 0.8, marginTop: 8 },
  input: {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    outline: "none",
  },
  primaryBtn: {
    marginTop: 14,
    padding: "12px 16px",
    borderRadius: 12,
    background: "white",
    color: "#0f0f1a",
    border: "none",
    fontWeight: 800,
    cursor: "pointer",
  },
  error: {
    margin: 0,
    color: "#ffb3b3",
    fontSize: 13,
  },
  micro: { marginTop: 10, opacity: 0.7, fontSize: 13 },
  link: { color: "white" },
  back: {
    marginTop: 8,
    color: "rgba(255,255,255,0.7)",
    textDecoration: "none",
  },
};
