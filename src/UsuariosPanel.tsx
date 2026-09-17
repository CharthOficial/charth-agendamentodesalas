import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useAuth } from "./lib/auth";

function cleanErrorMessage(e: any): string {
  if (e?.data && typeof e.data === "string") return e.data;
  if (e?.data?.message && typeof e.data.message === "string") return e.data.message;
  return "Erro ao processar a solicitação.";
}

export default function UsuariosPanel() {
  const { user } = useAuth();
  const usuarios = useQuery(api.usuarios.listar) ?? [];
  const criar = useMutation(api.usuarios.criar);
  const alternarAtivo = useMutation(api.usuarios.alternarAtivo);
  const alterarSenha = useMutation(api.usuarios.alterarSenha);

  const [modalNew, setModalNew] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", perfil: "gestor" as "admin" | "gestor" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [senhaUserId, setSenhaUserId] = useState<Id<"usuariosAdmin"> | null>(null);
  const [senhaUserNome, setSenhaUserNome] = useState("");
  const [senhaForm, setSenhaForm] = useState({ novaSenha: "", confirmar: "" });
  const [senhaError, setSenhaError] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  if (user?.perfil !== "admin") {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔒</div>
        <div className="empty-text">Apenas administradores podem gerenciar usuários.</div>
      </div>
    );
  }

  const handleCreate = async () => {
    setError("");
    if (!form.nome || !form.email || !form.senha) return setError("Preencha todos os campos.");
    try {
      await criar(form);
      setModalNew(false);
      setForm({ nome: "", email: "", senha: "", perfil: "gestor" });
      showToast("Usuário criado!");
    } catch (e: any) {
      setError(cleanErrorMessage(e));
    }
  };

  const toggleUser = async (id: Id<"usuariosAdmin">) => {
    await alternarAtivo({ id });
    showToast("Usuário atualizado.");
  };

  const openSenha = (id: Id<"usuariosAdmin">, nome: string) => {
    setSenhaUserId(id);
    setSenhaUserNome(nome);
    setSenhaForm({ novaSenha: "", confirmar: "" });
    setSenhaError("");
  };

  const handleAlterarSenha = async () => {
    setSenhaError("");
    if (!senhaUserId) return;
    if (senhaForm.novaSenha.length < 6) {
      return setSenhaError("A senha deve ter pelo menos 6 caracteres.");
    }
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      return setSenhaError("As senhas não coincidem.");
    }
    try {
      await alterarSenha({ id: senhaUserId, novaSenha: senhaForm.novaSenha });
      setSenhaUserId(null);
      showToast("Senha atualizada!");
    } catch (e: any) {
      setSenhaError(cleanErrorMessage(e));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div style={{ flex: 1, fontFamily: "Sora,sans-serif", fontSize: 16, fontWeight: 600 }}>
          Usuários administrativos
        </div>
        <button className="btn btn-primary" onClick={() => setModalNew(true)}>
          + Novo usuário
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              {["Nome", "E-mail", "Perfil", "Status", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u._id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${u.perfil === "admin" ? "badge-purple" : "badge-blue"}`}>
                    {u.perfil === "admin" ? "⭐ Admin" : "👔 Gestor"}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.ativo ? "badge-green" : "badge-gray"}`}>
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-sm btn-secondary" onClick={() => openSenha(u._id, u.nome)}>
                      Trocar senha
                    </button>
                    <button
                      className={`btn btn-sm ${u.ativo ? "btn-danger" : "btn-success"}`}
                      onClick={() => toggleUser(u._id)}
                    >
                      {u.ativo ? "Inativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalNew && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalNew(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Novo usuário administrativo</span>
              <button className="modal-close" onClick={() => setModalNew(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">⚠ {error}</div>}
              <div className="form-grid full">
                <div className="form-group">
                  <label className="required">Nome completo</label>
                  <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="required">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="required">Senha inicial</label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Perfil</label>
                  <select
                    value={form.perfil}
                    onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value as "admin" | "gestor" }))}
                  >
                    <option value="admin">Admin</option>
                    <option value="gestor">Gestor</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalNew(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Criar usuário
              </button>
            </div>
          </div>
        </div>
      )}

      {senhaUserId && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSenhaUserId(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Trocar senha — {senhaUserNome}</span>
              <button className="modal-close" onClick={() => setSenhaUserId(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {senhaError && <div className="alert alert-error">⚠ {senhaError}</div>}
              <div className="form-grid full">
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
              <button className="btn btn-secondary" onClick={() => setSenhaUserId(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleAlterarSenha}>
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
