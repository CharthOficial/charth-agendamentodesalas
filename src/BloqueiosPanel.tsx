import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { fmtDate } from "./lib/helpers";
import { useAuth } from "./lib/auth";

function cleanErrorMessage(e: any): string {
  const candidates = [
    e?.data?.message,
    e?.message,
    typeof e?.toString === "function" ? e.toString() : null,
  ].filter(Boolean);
  for (const raw of candidates) {
    const match = raw.match(/Uncaught Error:\s*([^\n]+)/i);
    if (match?.[1]) {
      return match[1]
        .replace(/\s*at handler.*$/is, "")
        .replace(/\s*Called by.*$/is, "")
        .trim();
    }
    if (!raw.includes("[CONVEX") && !raw.includes("Server Error") && raw.length < 200) {
      return raw.trim();
    }
  }
  return "Erro ao processar a solicitação.";
}

export default function BloqueiosPanel() {
  const { user } = useAuth();
  const bloqueios = useQuery(api.bloqueios.listar) ?? [];
  const salas = useQuery(api.salas.listar) ?? [];
  const criar = useMutation(api.bloqueios.criar);
  const excluir = useMutation(api.bloqueios.excluir);

  const [modalNew, setModalNew] = useState(false);
  const [form, setForm] = useState({ salaId: "", data: "", horarioInicio: "", horarioFim: "", motivo: "" });
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
        <div className="empty-text">Apenas administradores podem gerenciar bloqueios.</div>
      </div>
    );
  }

  const handleCreate = async () => {
    setError("");
    if (!form.salaId || !form.data || !form.horarioInicio || !form.horarioFim) {
      return setError("Preencha todos os campos obrigatórios.");
    }
    try {
      await criar({
        salaId: form.salaId as Id<"salas">,
        data: form.data,
        horarioInicio: form.horarioInicio,
        horarioFim: form.horarioFim,
        motivo: form.motivo,
        criadoPorUsuarioId: user!.id as Id<"usuariosAdmin">,
      });
      setModalNew(false);
      setForm({ salaId: "", data: "", horarioInicio: "", horarioFim: "", motivo: "" });
      showToast("Bloqueio criado!");
    } catch (e: any) {
      setError(cleanErrorMessage(e));
    }
  };

  const handleDelete = async (id: Id<"bloqueiosSala">) => {
    if (!confirm("Remover este bloqueio?")) return;
    await excluir({ id });
    showToast("Bloqueio removido.");
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div style={{ flex: 1, fontFamily: "Sora,sans-serif", fontSize: 16, fontWeight: 600 }}>
          Bloqueios de sala
        </div>
        <button className="btn btn-primary" onClick={() => setModalNew(true)}>
          + Novo bloqueio
        </button>
      </div>

      {bloqueios.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🟡</div>
            <div className="empty-text">Nenhum bloqueio cadastrado</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                {["Data", "Horário", "Sala", "Motivo", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloqueios.map((b) => {
                const sala = salas.find((s) => s._id === b.salaId);
                return (
                  <tr key={b._id}>
                    <td>{fmtDate(b.data)}</td>
                    <td>
                      {b.horarioInicio} – {b.horarioFim}
                    </td>
                    <td>
                      <span className="room-tag">{sala?.nome || "—"}</span>
                      <div style={{ fontSize: 11, color: "var(--text3)" }}>{sala?.local}</div>
                    </td>
                    <td>{b.motivo || "—"}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b._id)}>
                        🗑 Remover
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalNew && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalNew(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Novo bloqueio</span>
              <button className="modal-close" onClick={() => setModalNew(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">⚠ {error}</div>}
              <div className="form-grid full">
                <div className="form-group">
                  <label className="required">Sala</label>
                  <select value={form.salaId} onChange={(e) => setForm((f) => ({ ...f, salaId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {salas.filter((s) => s.ativo).map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.nome} — {s.local}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="required">Data</label>
                  <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="required">Horário inicial</label>
                  <input
                    type="time"
                    value={form.horarioInicio}
                    onChange={(e) => setForm((f) => ({ ...f, horarioInicio: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="required">Horário final</label>
                  <input
                    type="time"
                    value={form.horarioFim}
                    onChange={(e) => setForm((f) => ({ ...f, horarioFim: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Motivo</label>
                  <input
                    value={form.motivo}
                    onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                    placeholder="Ex: Manutenção, evento interno..."
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalNew(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Criar bloqueio
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
