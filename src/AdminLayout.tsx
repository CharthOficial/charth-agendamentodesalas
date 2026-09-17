import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "./lib/auth";
import Dashboard from "./Dashboard";
import AgendamentosPanel from "./AgendamentosPanel";
import SalasPanel from "./SalasPanel";
import BloqueiosPanel from "./BloqueiosPanel";
import UsuariosPanel from "./UsuariosPanel";

function cleanErrorMessage(e: any): string {
  if (e?.data && typeof e.data === "string") return e.data;
  if (e?.data?.message && typeof e.data.message === "string") return e.data.message;
  return "Erro ao processar a solicitação.";
}

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
  const trocarMinhaSenha = useMutation(api.usuarios.trocarMinhaSenha);

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalSenha, setModalSenha] = useState(false);
  const [senhaForm, setSenhaForm] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [senhaError, setSenhaError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const abrirTrocarSenha = () => {
    setMenuOpen(false);
    setSenhaForm({ senhaAtual: "", novaSenha: "", confirmar: "" });
    setSenhaError("");
    setModalSenha(true);
  };

  const handleTrocarSenha = async () => {
    setSenhaError("");
    if (!user) return;
    if (senhaForm.novaSenha.length < 6) {
      return setSenhaError("A nova senha deve ter pelo menos 6 caracteres.");
    }
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      return setSenhaError("As senhas não coincidem.");
    }
    try {
      await trocarMinhaSenha({
        id: user.id,
        senhaAtual: senhaForm.senhaAtual,
        novaSenha: senhaForm.novaSenha,
      });
      setModalSenha(false);
      showToast("Senha atualizada!");
    } catch (e: any) {
      setSenhaError(cleanErrorMessage(e));
    }
  };

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
          <div style={{ position: "relative" }}>
            <div
              className="admin-user-info"
              style={{ cursor: "pointer" }}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{user.nome[0]}</div>
              <span className="admin-user-name">{user.nome}</span>
            </div>
            {menuOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 199 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    boxShadow: "var(--shadow)",
                    minWidth: 180,
                    zIndex: 200,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={abrirTrocarSenha}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13.5,
                      color: "var(--text)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    🔑 Trocar minha senha
                  </button>
                </div>
              </>
            )}
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

      {modalSenha && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalSenha(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Trocar minha senha</span>
              <button className="modal-close" onClick={() => setModalSenha(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {senhaError && <div className="alert alert-error">⚠ {senhaError}</div>}
              <div className="form-grid full">
                <div className="form-group">
                  <label className="required">Senha atual</label>
                  <input
                    type="password"
                    value={senhaForm.senhaAtual}
                    onChange={(e) => setSenhaForm((f) => ({ ...f, senhaAtual: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="required">Nova senha</label>
                  <input
                    type="password"
                    value={senhaForm.novaSenha}
                    onChange={(e) => setSenhaForm((f) => ({ ...f, novaSenha: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="required">Confirmar nova senha</label>
                  <input
                    type="password"
                    value={senhaForm.confirmar}
                    onChange={(e) => setSenhaForm((f) => ({ ...f, confirmar: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalSenha(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleTrocarSenha}>
                Salvar nova senha
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className="toast toast-success">
            <span>✓</span>
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
