import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export default function SalasPanel({ perfil }: { perfil: "admin" | "gestor" }) {
  const salas = useQuery(api.salas.listar) ?? [];
  const criar = useMutation(api.salas.criar);
  const alternarAtivo = useMutation(api.salas.alternarAtivo);
  const editar = useMutation(api.salas.editar);

  const [modalNew, setModalNew] = useState(false);
  const [form, setForm] = useState({ nome: "", local: "" });
  const [editingId, setEditingId] = useState<Id<"salas"> | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", local: "" });
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const toggle = async (id: Id<"salas">) => {
    await alternarAtivo({ id });
    showToast("Sala atualizada.");
  };

  const handleCreate = async () => {
    if (!form.nome || !form.local) return;
    await criar({ nome: form.nome, local: form.local });
    setModalNew(false);
    setForm({ nome: "", local: "" });
    showToast("Sala criada!");
  };

  const openEdit = (id: Id<"salas">, nome: string, local: string) => {
    setEditingId(id);
    setEditForm({ nome, local });
  };

  const handleEdit = async () => {
    if (!editingId || !editForm.nome || !editForm.local) return;
    await editar({ id: editingId, nome: editForm.nome, local: editForm.local });
    setEditingId(null);
    showToast("Sala atualizada!");
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div style={{ flex: 1, fontFamily: "Sora,sans-serif", fontSize: 16, fontWeight: 600 }}>
          Salas cadastradas
        </div>
        {perfil === "admin" && (
          <button className="btn btn-primary" onClick={() => setModalNew(true)}>
            + Nova sala
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {salas.map((r) => (
          <div key={r._id} className="card" style={{ marginBottom: 0, opacity: r.ativo ? 1 : 0.55 }}>
            <div className="flex items-center gap-2">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.nome}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>{r.local}</div>
              </div>
              <span className={`badge ${r.ativo ? "badge-green" : "badge-gray"}`}>
                {r.ativo ? "Ativa" : "Inativa"}
              </span>
              {perfil === "admin" && (
                <>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => openEdit(r._id, r.nome, r.local)}
                  >
                    Editar
                  </button>
                  <button
                    className={`btn btn-sm ${r.ativo ? "btn-secondary" : "btn-success"}`}
                    onClick={() => toggle(r._id)}
                  >
                    {r.ativo ? "Inativar" : "Ativar"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {modalNew && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalNew(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nova sala</span>
              <button className="modal-close" onClick={() => setModalNew(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid full">
                <div className="form-group">
                  <label className="required">Nome da sala</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Sala Principal"
                  />
                </div>
                <div className="form-group">
                  <label className="required">Local / Unidade</label>
                  <input
                    value={form.local}
                    onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                    placeholder="Ex: Showroom — 9º Andar"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalNew(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Criar sala
              </button>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingId(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Editar sala</span>
              <button className="modal-close" onClick={() => setEditingId(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid full">
                <div className="form-group">
                  <label className="required">Nome da sala</label>
                  <input
                    value={editForm.nome}
                    onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: Sala Principal"
                  />
                </div>
                <div className="form-group">
                  <label className="required">Local / Unidade</label>
                  <input
                    value={editForm.local}
                    onChange={(e) => setEditForm((f) => ({ ...f, local: e.target.value }))}
                    placeholder="Ex: Showroom — 9º Andar"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleEdit}>
                Salvar
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
