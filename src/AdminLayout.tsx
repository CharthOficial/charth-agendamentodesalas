import { useState } from "react";
import { useAuth } from "./lib/auth";
import Dashboard from "./Dashboard";
import AgendamentosPanel from "./AgendamentosPanel";
import SalasPanel from "./SalasPanel";
import BloqueiosPanel from "./BloqueiosPanel";
import UsuariosPanel from "./UsuariosPanel";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊", section: "Visão geral" },
  { id: "bookings", label: "Agendamentos", icon: "📋", section: "Gestão" },
  { id: "rooms", label: "Salas", icon: "🚪", section: "Gestão" },
  { id: "blocks", label: "Bloqueios", icon: "⛔", section: "Gestão", adminOnly: true },
  { id: "users", label: "Usuários", icon: "👥", section: "Configurações", adminOnly: true },
];

export default function AdminLayout({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const navItems = NAV.filter((n) => !n.adminOnly || user.perfil === "admin");
  const sections = [...new Set(navItems.map((n) => n.section))];
  const pageTitle = NAV.find((n) => n.id === page)?.label || "Painel";

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard />;
      case "bookings": return <AgendamentosPanel />;
      case "rooms": return <SalasPanel perfil={user.perfil} />;
      case "blocks": return <BloqueiosPanel />;
      case "users": return <UsuariosPanel />;
      default: return null;
    }
  };

  const navigate = (id: string) => {
    setPage(id);
    setSidebarOpen(false);
  };

  return (
    <div id="app">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(58,42,44,0.5)",
            zIndex: 40, display: "none",
          }}
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <nav className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">Charth</div>
          <div className="logo-sub">Agendamento de Salas</div>
        </div>
        <div className="sidebar-nav">
          {sections.map((section) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {navItems.filter((n) => n.section === section).map((n) => (
                <button
                  key={n.id}
                  className={`nav-item${page === n.id ? " active" : ""}`}
                  onClick={() => navigate(n.id)}
                >
                  <span className="icon">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-user">
          <div className="user-avatar">{user.nome[0]}</div>
          <div className="user-info">
            <div className="user-name">{user.nome}</div>
            <div className="user-role">{user.perfil === "admin" ? "Administrador" : "Gestor"}</div>
          </div>
          <button className="btn-logout" onClick={onLogout} title="Sair">↩</button>
        </div>
      </nav>

      {/* Main content */}
      <div className="main">
        <div className="topbar">
          {/* Hamburger menu — mobile only */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="topbar-title">{pageTitle}</div>
          <span className={`badge ${user.perfil === "admin" ? "badge-purple" : "badge-blue"}`}>
            {user.perfil === "admin" ? "⭐ Admin" : "👔 Gestor"}
          </span>
          <button className="btn-logout-top" onClick={onLogout} title="Sair">↩</button>
        </div>
        <div className="content">{renderPage()}</div>
      </div>

      {/* Bottom navigation — mobile only */}
      <nav className="bottom-nav">
        {navItems.slice(0, 5).map((n) => (
          <button
            key={n.id}
            className={`bottom-nav-item${page === n.id ? " active" : ""}`}
            onClick={() => setPage(n.id)}
          >
            <span className="bottom-nav-icon">{n.icon}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
