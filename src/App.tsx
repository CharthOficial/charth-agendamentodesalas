import { useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import PublicPage from "./PublicPage";
import LoginPage from "./LoginPage";
import AdminLayout from "./AdminLayout";

function AppInner() {
  const [view, setView] = useState<"public" | "login" | "admin">("public");
  const { setUser } = useAuth();

  const handleLogout = () => {
    setUser(null);
    setView("public");
  };

  if (view === "login") {
    return <LoginPage onLoginSuccess={() => setView("admin")} onBack={() => setView("public")} />;
  }

  if (view === "admin") {
    return <AdminLayout onLogout={handleLogout} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "28px 20px 0" }}>
        <PublicPage />
      </div>
      <div style={{
        padding: "20px",
        display: "flex",
        justifyContent: "center",
        borderTop: "1px solid var(--border)",
        marginTop: 32,
        background: "var(--surface)",
      }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setView("login")}>
          🔑 Acesso administrativo
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
