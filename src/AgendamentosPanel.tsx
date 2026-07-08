import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { fmtDate, fmtDatetime } from "./lib/helpers";
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

export default function AgendamentosPanel() {
  const { user } = useAuth();
  const agendamentos = useQuery(api.agendamentos.listar) ?? [];
  const salas = useQuery(api.salas.listar) ?? [];
  const criar = useMutation(api.agendamentos.criar);
  const editar = useMutation(api.agendamentos.editar);
  const excluir = useMutation(api.agendamentos.excluir);

  const [filterDate, setFilterDate] = useState("");
  const [filterSala, setFilterSala] = useState("");
  const [filterLocal, setFilterLocal] = useState("");
  const [modalNew, setModalNew] = useState(false);
  const [modalEdit, setModalEdit] = useState<any>(null);
  const [modalDetail, setModalDetail] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const locals = [...new Set(salas.map((r) => r.local))];

  const filtered = agendamentos
    .filter((a) => {
      if (filterDate && a.data !== filterDate) return false;
      if (filterSala && a.salaId !== filterSala) return false;
      if (filterLocal) {
        const sala = salas.find((s) => s._id === a.salaId);
        if (sala?.local !== filterLocal) return false;
      }
      return true;
    })
    .sort((a, b) => (a.data + a.horarioInicio).localeCompare(b.data + b.horarioInicio));

  const handleDelete = async (id: Id<"agendamentos">) => {
    if (!confirm("Excluir este agendamento?")) return;
    try {
      await excluir({ id, usuarioId: user!.id as Id<"usuariosAdmin"> });
      showToast("Agendamento excluído.");
    } catch (e: any) {
      showToast(cleanErrorMessage(e), "error");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="filter-row" style={{ flex: 1 }}>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          <select value={filterSala} onChange={(e) => setFilterSala(e.target.value)}>
            <option value="">Todas as salas</option>
            {salas.map((s) => (
              <option key={s._id} value={s._id}>
                {s.nome} — {s.local}
              </option>
            ))}
          </select>
          <select value={filterLocal} onChange={(e) => setFilterLocal(e.target.value)}>
            <option value="">Todos os locais</option>
            {locals.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setModalNew(true)}>
          + Novo agendamento
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["Data", "Horário", "Reunião", "Sala", "Responsável", "Setor", "Status", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-icon">📋</div>
                      <div className="empty-text">Nenhum agendamento encontrado</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const sala = salas.find((s) => s._id === a.salaId);
                  const statusBadge =
                    a.status === "agendado" ? "badge-green" : "badge-red";
                  const statusLabel = a.status === "agendado" ? "Agendado" : "Cancelado";
                  return (
                    <tr key={a._id}>
                      <td>{fmtDate(a.data)}</td>
                      <td>
                        {a.horarioInicio} – {a.horarioFim}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.nomeAgendamento}</div>
                        {a.descricao && (
                          <div style={{ fontSize: 11.5, color: "var(--text3)" }}>
                            {a.descricao.slice(0, 50)}
                            {a.descricao.length > 50 ? "…" : ""}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="room-tag">{sala?.nome || "—"}</span>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{sala?.local}</div>
                      </td>
                      <td>
                        {a.responsavelNome}
                        <div style={{ fontSize: 11.5, color: "var(--text3)" }}>
                          {a.criadoPorTipo === "publico" ? "(via link público)" : "(painel)"}
                        </div>
                      </td>
                      <td>{a.responsavelSetor}</td>
                      <td>
                        <span className={`badge ${statusBadge}`}>{statusLabel}</span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-secondary btn-sm" onClick={() => setModalDetail(a)}>
                            👁
                          </button>
                          {a.status !== "cancelado" && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setModalEdit(a)}>
                              ✏️
                            </button>
                          )}
                          {user?.perfil === "admin" && a.status !== "cancelado" && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(a._id)}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalNew && (
        <BookingFormModal
          title="Novo agendamento"
          salas={salas}
          onClose={() => setModalNew(false)}
          onSubmit={async (data) => {
            try {
              await criar({
                ...data,
                criadoPorTipo: user!.perfil,
                criadoPorUsuarioId: user!.id as Id<"usuariosAdmin">,
              });
              setModalNew(false);
              showToast("Agendamento criado com sucesso!");
            } catch (e: any) {
              throw new Error(cleanErrorMessage(e));
            }
          }}
          perfil={user!.perfil}
        />
      )}

      {modalEdit && (
        <BookingFormModal
          title="Editar agendamento"
          salas={salas}
          initial={modalEdit}
          editMode
          onClose={() => setModalEdit(null)}
          onSubmit={async (data) => {
            try {
              await editar({
                id: modalEdit._id,
                ...data,
                perfilEditor: user!.perfil as "admin" | "gestor",
                usuarioAlteracaoId: user!.id as Id<"usuariosAdmin">,
              });
              setModalEdit(null);
              showToast("Agendamento atualizado!");
            } catch (e: any) {
              throw new Error(cleanErrorMessage(e));
            }
          }}
          perfil={user!.perfil}
        />
      )}

      {modalDetail && (
        <Modal title="Detalhes do agendamento" onClose={() => setModalDetail(null)}>
          <DetailRow label="Reunião" value={modalDetail.nomeAgendamento} />
          <DetailRow label="Data" value={fmtDate(modalDetail.data)} />
          <DetailRow label="Horário" value={`${modalDetail.horarioInicio} – ${modalDetail.horarioFim}`} />
          <DetailRow
            label="Sala"
            value={`${salas.find((s) => s._id === modalDetail.salaId)?.nome} — ${
              salas.find((s) => s._id === modalDetail.salaId)?.local
            }`}
          />
          <DetailRow label="Responsável" value={modalDetail.responsavelNome} />
          <DetailRow label="Setor" value={modalDetail.responsavelSetor} />
          <DetailRow label="Participantes" value={modalDetail.emailsParticipantes || "—"} />
          <DetailRow label="Descrição" value={modalDetail.descricao || "—"} />
          <DetailRow label="Status" value={modalDetail.status} />
          <DetailRow label="Google Agenda ID" value={modalDetail.googleCalendarEventId || "—"} />
          <DetailRow label="Criado em" value={fmtDatetime(modalDetail._creationTime)} />
          <DetailRow
            label="Origem"
            value={modalDetail.criadoPorTipo === "publico" ? "Link público" : "Painel administrativo"}
          />
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{value}</div>
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className="toast-container">
      <div className={`toast toast-${type}`}>
        <span>{type === "success" ? "✓" : "✕"}</span>
        {msg}
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function BookingFormModal({
  title,
  salas,
  initial,
  editMode,
  perfil,
  onClose,
  onSubmit,
}: {
  title: string;
  salas: any[];
  initial?: any;
  editMode?: boolean;
  perfil: "admin" | "gestor";
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    nomeAgendamento: initial?.nomeAgendamento || "",
    responsavelNome: initial?.responsavelNome || "",
    responsavelSetor: initial?.responsavelSetor || "",
    salaId: initial?.salaId || "",
    data: initial?.data || new Date().toISOString().slice(0, 10),
    horarioInicio: initial?.horarioInicio || "",
    horarioFim: initial?.horarioFim || "",
    emailsParticipantes: initial?.emailsParticipantes || "",
    descricao: initial?.descricao || "",
  });
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const maxHours = perfil === "admin" ? Infinity : 3;

  const handleSubmit = async () => {
    setError("");
    if (
      !form.nomeAgendamento ||
      !form.responsavelNome ||
      !form.responsavelSetor ||
      !form.salaId ||
      !form.data ||
      !form.horarioInicio ||
      !form.horarioFim
    ) {
      return setError("Preencha todos os campos obrigatórios.");
    }
    try {
      await onSubmit(form);
    } catch (e: any) {
      setError(cleanErrorMessage(e));
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      {error && <div className="alert alert-error">⚠ {error}</div>}
      <div className="form-grid">
        <div className="form-group col-span-2">
          <label className="required">Nome do agendamento</label>
          <input value={form.nomeAgendamento} onChange={(e) => set("nomeAgendamento", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="required">Nome completo</label>
          <input value={form.responsavelNome} onChange={(e) => set("responsavelNome", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="required">Setor</label>
          <input value={form.responsavelSetor} onChange={(e) => set("responsavelSetor", e.target.value)} />
        </div>
        <div className="form-group col-span-2">
          <label className="required">Sala</label>
          <select value={form.salaId} onChange={(e) => set("salaId", e.target.value)}>
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
          <input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="required">Horário inicial</label>
          <input type="time" value={form.horarioInicio} onChange={(e) => set("horarioInicio", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="required">Horário final</label>
          <input type="time" value={form.horarioFim} onChange={(e) => set("horarioFim", e.target.value)} />
        </div>
        <div className="form-group">
          <label>
            Limite por perfil: <strong>{maxHours === Infinity ? "sem limite" : `${maxHours}h`}</strong>
          </label>
        </div>
        <div className="form-group col-span-2">
          <label>E-mails dos participantes</label>
          <input
            value={form.emailsParticipantes}
            onChange={(e) => set("emailsParticipantes", e.target.value)}
            placeholder="email1@..., email2@..."
          />
        </div>
        <div className="form-group col-span-2">
          <label>Descrição da reunião</label>
          <textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <button className="btn btn-primary btn-full" onClick={handleSubmit}>
          {editMode ? "💾 Salvar alterações" : "✔ Confirmar agendamento"}
        </button>
      </div>
    </Modal>
  );
}
