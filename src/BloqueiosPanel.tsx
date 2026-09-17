import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { fmtDate } from "./lib/helpers";
import { useAuth } from "./lib/auth";

function cleanErrorMessage(e: any): string {
  if (e?.data && typeof e.data === "string") return e.data;
  if (e?.data?.message && typeof e.data.message === "string") return e.data.message;
  return "Erro ao processar a solicitação.";
}

const DIAS_SEMANA = [
  { valor: 0, label: "Dom" },
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb" },
];

export default function BloqueiosPanel() {
  const { user } = useAuth();
  const bloqueios = useQuery(api.bloqueios.listar) ?? [];
  const salas = useQuery(api.salas.listar) ?? [];
  const criar = useMutation(api.bloqueios.criar);
  const excluir = useMutation(api.bloqueios.excluir);
  const criarRecorrencia = useMutation(api.bloqueios.criarRecorrencia);

  const [modalNew, setModalNew] = useState(false);
  const [form, setForm] = useState({ salaId: "", data: "", horarioInicio: "", horarioFim: "", motivo: "" });
  const [repetir, setRepetir] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [dataFim, setDataFim] = useState("");
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

  const resetForm = () => {
    setForm({ salaId: "", data: "", horarioInicio: "", horarioFim: "", motivo: "" });
    setRepetir(false);
    setDiasSelecionados([0, 1, 2, 3, 4, 5, 6]);
    setDataFim("");
  };

  const toggleDia = (valor: number) => {
    setDiasSelecionados((prev) =>
      prev.includes(valor) ? prev.filter((d) => d !== valor) : [...prev, valor]
    );
  };

  const handleCreate = async () => {
    setError("");

    if (!form.salaId || !form.horarioInicio || !form.horarioFim) {
      return setError("Preencha todos os campos obrigatórios.");
    }

    if (!repetir) {
      if (!form.data) return setError("Preencha a data.");
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
        resetForm();
        showToast("Bloqueio criado!");
      } catch (e: any) {
        setError(cleanErrorMessage(e));
      }
      return;
    }

    // Fluxo de recorrência
    if (!form.data || !dataFim) return setError("Preencha data início e data fim.");
    if (diasSelecionados.length === 0) return setError("Selecione pelo menos um dia da semana.");

    try {
      const resultado = await criarRecorrencia({
        salaId: form.salaId as Id<"salas">,
        diasDaSemana: diasSelecionados,
        horarioInicio: form.horarioInicio,
        horarioFim: form.horarioFim,
        dataInicio: form.data,
        dataFim: dataFim,
        motivo: form.motivo,
        criadoPorUsuarioId: user!.id as Id<"usuariosAdmin">,
      });
      setModalNew(false);
      resetForm();
      const msgPulados = resultado.pulados.length > 0 ? ` (${resultado.pulados.length} pulado(s) por conflito)` : "";
      showToast(`${resultado.criados} bloqueios criados!${msgPulados}`);
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
                    <td>
                      {fmtDate(b.data)}
                      {b.recorrenciaId && (
                        <span title="Faz parte de uma recorrência" style={{ marginLeft: 6 }}>
                          🔁
                        </span>
                      )}
                    </td>
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
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && (setModalNew(false), resetForm())}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Novo bloqueio</span>
              <button className="modal-close" onClick={() => { setModalNew(false); resetForm(); }}>
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
                  <label className="required">{repetir ? "Data início" : "Data"}</label>
                  <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
                </div>

                <div className="form-group full" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    id="repetir-bloqueio"
                    checked={repetir}
                    onChange={(e) => setRepetir(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  <label htmlFor="repetir-bloqueio" style={{ margin: 0, cursor: "pointer" }}>
                    Repetir (bloqueio recorrente)
                  </label>
                </div>

                {repetir && (
                  <>
                    <div className="form-group full">
                      <label className="required">Repetir nos dias</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {DIAS_SEMANA.map((d) => (
                          <button
                            key={d.valor}
                            type="button"
                            onClick={() => toggleDia(d.valor)}
                            className={`btn btn-sm ${diasSelecionados.includes(d.valor) ? "btn-primary" : "btn-secondary"}`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                        Todos os dias marcados = bloqueio diário
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="required">Data fim</label>
                      <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                    </div>
                  </>
                )}
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
              <button className="btn btn-secondary" onClick={() => { setModalNew(false); resetForm(); }}>
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
