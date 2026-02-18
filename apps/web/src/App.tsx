export default function App() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Rush</h1>
      <p style={styles.subtitle}>
        Live speed-dating. Two minutes. Real connection.
      </p>
    </div>
  )
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "#0f0f1a",
    color: "white",
    fontFamily: "system-ui, sans-serif"
  },
  title: {
    fontSize: "3rem",
    marginBottom: "1rem"
  },
  subtitle: {
    fontSize: "1.2rem",
    opacity: 0.8
  }
}