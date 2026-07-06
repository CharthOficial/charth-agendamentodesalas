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
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          padding: "12px 20px",
          zIndex: 100,
        }}
      >
        <button className="btn btn-secondary btn-sm" onClick={() => setView("login")}>
          🔑 Acesso administrativo
        </button>
      </div>
      <div style={{ padding: "70px 20px 40px" }}>
        <PublicPage />
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
