import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Log in</h1>

        <label style={styles.label}>Email</label>
        <input style={styles.input} placeholder="you@example.com" />

        <label style={styles.label}>Password</label>
        <input style={styles.input} placeholder="••••••••" type="password" />

        <button
          style={styles.primaryBtn}
          onClick={() => navigate("/queue")}
        >
          Log in
        </button>

        <p style={styles.micro}>
          New here?{" "}
          <Link to="/signup" style={styles.link}>
            Create an account
          </Link>
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
  micro: { marginTop: 10, opacity: 0.7, fontSize: 13 },
  link: { color: "white" },
  back: {
    marginTop: 8,
    color: "rgba(255,255,255,0.7)",
    textDecoration: "none",
  },
};