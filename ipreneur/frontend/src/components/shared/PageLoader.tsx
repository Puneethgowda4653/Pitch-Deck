export function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--surface-page)" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2.5px solid var(--violet-600)", borderTopColor: "transparent", animation: "spin 0.75s linear infinite" }} />
    </div>
  );
}
