import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { useAuth } from "./lib/auth";

function cleanErrorMessage(e: any): string {
  const raw = e?.data?.message || e?.message || "Erro ao processar a solicitação.";
  let msg = raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/Server Error\s*/gi, "")
    .replace(/Uncaught Error:\s*/gi, "")
    .replace(/\s*at handler.*$/is, "")
    .trim();
  return msg || "Erro ao processar a solicitação.";
}

export default function UsuariosPanel() {
  const { user } = useAuth();
  const usuarios = useQuery(api.usuarios.listar) ?? [];
  const criar = useMutation(api.usuarios.criar);
  const alternarAtivo = useMutation(api.usuarios.alternarAtivo);

  const [modalNew, setModalNew] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", perfil: "gestor" as "admin" | "gestor" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

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
                  <button
                    className={`btn btn-sm ${u.ativo ? "btn-danger" : "btn-success"}`}
                    onClick={() => toggleUser(u._id)}
                  >
                    {u.ativo ? "Inativar" : "Ativar"}
                  </button>
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
