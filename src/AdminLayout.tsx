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

  return (
    <div className="admin-layout">
      {/* Top bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <div className="admin-logo">Charth</div>
          <div className="admin-logo-sub">Agendamento de Salas</div>
        </div>
        <div className="admin-topbar-title">{pageTitle}</div>
        <div className="admin-topbar-right">
          <span className={`badge ${user.perfil === "admin" ? "badge-purple" : "badge-blue"}`}>
            {user.perfil === "admin" ? "⭐ Admin" : "👔 Gestor"}
          </span>
          <div className="admin-user-info">
            <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{user.nome[0]}</div>
            <span className="admin-user-name">{user.nome}</span>
          </div>
          <button className="btn-logout" onClick={onLogout} title="Sair">↩</button>
        </div>
      </header>

      {/* Content */}
      <main className="admin-main">
        {renderPage()}
      </main>

      {/* Bottom navigation */}
      <nav className="admin-bottom-nav">
        {navItems.map((n) => (
          <button
            key={n.id}
            className={`admin-nav-item${page === n.id ? " active" : ""}`}
            onClick={() => setPage(n.id)}
          >
            <span className="admin-nav-icon">{n.icon}</span>
            <span className="admin-nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
