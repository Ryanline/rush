import { Link, useNavigate } from "react-router-dom";
import { clearAuth, getAuthUser, isAuthenticated } from "../lib/auth";

export default function Landing() {
  const navigate = useNavigate();
  const authed = isAuthenticated();
  const user = getAuthUser();

  function logout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Rush</h1>
        <p style={styles.subtitle}>Electric, live speed-dating. Two minutes. Real connection.</p>

        <div style={styles.actions}>
          {authed ? (
            <>
              <Link to="/queue" style={styles.primaryBtn}>
                Continue as {user?.firstName ?? "User"}
              </Link>
              <button style={styles.secondaryBtn} onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/signup" style={styles.primaryBtn}>
                Create account
              </Link>
              <Link to="/login" style={styles.secondaryBtn}>
                Log in
              </Link>
            </>
          )}
        </div>

        <p style={styles.micro}>No swiping. No browsing. Just live chats.</p>
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
  },
  title: { fontSize: "3rem", margin: 0, letterSpacing: "0.5px" },
  subtitle: { marginTop: 10, opacity: 0.85, lineHeight: 1.4 },
  actions: { display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" },
  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 12,
    background: "white",
    color: "#0f0f1a",
    textDecoration: "none",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.25)",
    color: "white",
    textDecoration: "none",
    fontWeight: 600,
    background: "transparent",
    cursor: "pointer",
  },
  micro: { marginTop: 16, opacity: 0.65, fontSize: 13 },
};
