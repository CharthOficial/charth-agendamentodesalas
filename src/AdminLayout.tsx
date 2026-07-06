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

  if (!user) return null;

  const navItems = NAV.filter((n) => !n.adminOnly || user.perfil === "admin");
  const sections = [...new Set(navItems.map((n) => n.section))];
  const pageTitle = NAV.find((n) => n.id === page)?.label || "Painel";

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "bookings":
        return <AgendamentosPanel />;
      case "rooms":
        return <SalasPanel perfil={user.perfil} />;
      case "blocks":
        return <BloqueiosPanel />;
      case "users":
        return <UsuariosPanel />;
      default:
        return null;
    }
  };

  return (
    <div id="app">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">Charth</div>
          <div className="logo-sub">Agendamento de Salas</div>
        </div>
        <div className="sidebar-nav">
          {sections.map((section) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {navItems
                .filter((n) => n.section === section)
                .map((n) => (
                  <button
                    key={n.id}
                    className={`nav-item${page === n.id ? " active" : ""}`}
                    onClick={() => setPage(n.id)}
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
          <button className="btn-logout" onClick={onLogout} title="Sair">
            ↩
          </button>
        </div>
      </nav>

      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{pageTitle}</div>
          <span className={`badge ${user.perfil === "admin" ? "badge-purple" : "badge-blue"}`}>
            {user.perfil === "admin" ? "⭐ Admin" : "👔 Gestor"}
          </span>
        </div>
        <div className="content">{renderPage()}</div>
      </div>
    </div>
  );
}
