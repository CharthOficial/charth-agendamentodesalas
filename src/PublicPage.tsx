import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import ParticipantesInput from "./components/ParticipantesInput";
import type { Id } from "../convex/_generated/dataModel";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function cleanErrorMessage(e: any): string {
  const raw = e?.data?.message || e?.message || "Erro ao processar a solicitação.";
  let msg = raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/Server Error\s*/gi, "")
    .replace(/Uncaught Error:\s*/gi, "")
    .replace(/\s*Called by client.*$/is, "")
    .replace(/\s*at handler.*$/is, "")
    .trim();
  return msg || "Erro ao processar a solicitação.";
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_START = 7; // 07:00
const DAY_END = 21; // 21:00
const SLOT_MINUTES = 60;

function getWeekDates(anchor: string): string[] {
  const d = new Date(anchor + "T12:00:00");
  const dow = d.getDay();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - dow + i);
    dates.push(dd.toISOString().slice(0, 10));
  }
  return dates;
}

export default function PublicPage() {
  const salas = useQuery(api.salas.listarAtivas) ?? [];
  const todosAgendamentos = useQuery(api.agendamentos.listar) ?? [];
  const bloqueios = useQuery(api.bloqueios.listar) ?? [];
  const criarAgendamento = useMutation(api.agendamentos.criar);

  const [view, setView] = useState<"rooms" | "calendar">("rooms");
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [weekAnchor, setWeekAnchor] = useState(todayStr());

  const [modalSlot, setModalSlot] = useState<{ data: string; horarioInicio: string; horarioFim: string } | null>(
    null
  );
  const [step, setStep] = useState<"calendar" | "success">("calendar");
  const [lastBooking, setLastBooking] = useState<any>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nomeAgendamento: "",
    responsavelNome: "",
    responsavelSetor: "",
    emailsParticipantes: "",
    descricao: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError("");
    if (!modalSlot) return;
    if (!form.nomeAgendamento || !form.responsavelNome || !form.responsavelSetor) {
      return setError("Preencha todos os campos obrigatórios.");
    }

    try {
      await criarAgendamento({
        salaId: selectedRoom._id as Id<"salas">,
        nomeAgendamento: form.nomeAgendamento,
        responsavelNome: form.responsavelNome,
        responsavelSetor: form.responsavelSetor,
        data: modalSlot.data,
        horarioInicio: modalSlot.horarioInicio,
        horarioFim: modalSlot.horarioFim,
        emailsParticipantes: form.emailsParticipantes,
        descricao: form.descricao,
        criadoPorTipo: "publico",
      });

      setLastBooking({
        ...form,
        data: modalSlot.data,
        horarioInicio: modalSlot.horarioInicio,
        horarioFim: modalSlot.horarioFim,
        salaNome: selectedRoom.nome,
        salaLocal: selectedRoom.local,
      });
      setModalSlot(null);
      setStep("success");
    } catch (e: any) {
      setError(cleanErrorMessage(e));
    }
  };

  const resetAndGoToRooms = () => {
    setStep("calendar");
    setView("rooms");
    setSelectedRoom(null);
    setForm({
      nomeAgendamento: "",
      responsavelNome: "",
      responsavelSetor: "",
      emailsParticipantes: "",
      descricao: "",
    });
  };

  // ── TELA DE SUCESSO ──
  if (step === "success") {
    return (
      <div className="public-page">
        <Header />
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div className="card-title" style={{ fontSize: 20 }}>
            Agendamento realizado com sucesso!
          </div>
          <div style={{ color: "var(--text2)", marginBottom: 24 }}>
            {lastBooking?.nomeAgendamento} — {lastBooking?.salaNome}, {lastBooking?.salaLocal}
          </div>
          <div
            style={{
              display: "flex",
              gap: 20,
              justifyContent: "center",
              flexWrap: "wrap",
              color: "var(--text2)",
              fontSize: 13,
            }}
          >
            <span>📅 {fmtDate(lastBooking?.data)}</span>
            <span>
              🕐 {lastBooking?.horarioInicio} – {lastBooking?.horarioFim}
            </span>
            <span>👤 {lastBooking?.responsavelNome}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--text3)" }}>
            Um evento foi criado no Google Agenda para os participantes.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={resetAndGoToRooms}>
            + Novo agendamento
          </button>
        </div>
      </div>
    );
  }

  // ── TELA 1: LISTA DE SALAS ──
  if (view === "rooms") {
    const hoje = todayStr();
    const agora = new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

    const roomCards = salas.map((r) => {
      const agendHoje = todosAgendamentos
        .filter((a) => a.salaId === r._id && a.data === hoje && a.status === "agendado")
        .sort((a, b) => parseTime(a.horarioInicio) - parseTime(b.horarioInicio));

      const bloqueioAgora = bloqueios.find(
        (b) =>
          b.salaId === r._id &&
          b.data === hoje &&
          parseTime(b.horarioInicio) <= minutosAgora &&
          parseTime(b.horarioFim) > minutosAgora
      );

      const ocupadoAgora = agendHoje.find(
        (a) => parseTime(a.horarioInicio) <= minutosAgora && parseTime(a.horarioFim) > minutosAgora
      );

      const proximo = agendHoje.find((a) => parseTime(a.horarioInicio) > minutosAgora);

      let statusLabel = "Livre agora";
      let statusClass = "free";
      if (bloqueioAgora) {
        statusLabel = "Bloqueada";
        statusClass = "blocked";
      } else if (ocupadoAgora) {
        statusLabel = `Ocupada até ${ocupadoAgora.horarioFim}`;
        statusClass = "busy";
      } else if (proximo) {
        const minutosFaltam = parseTime(proximo.horarioInicio) - minutosAgora;
        statusLabel =
          minutosFaltam <= 60
            ? `Livre — próxima reunião em ${minutosFaltam}min`
            : `Livre — próxima reunião às ${proximo.horarioInicio}`;
      }

      return { ...r, statusLabel, statusClass };
    });

    const locals = [...new Set(roomCards.map((r) => r.local))];

    return (
      <div className="public-page">
        <Header />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {locals.map((local) => (
            <div key={local} className="card" style={{ marginBottom: 0 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
              }}>
                <div style={{
                  background: "var(--accent)",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#F7F0F1",
                  fontFamily: "Sora, sans-serif",
                  letterSpacing: "0.2px",
                }}>
                  {local}
                </div>
              </div>
              <div className="avail-grid">
                {roomCards.filter((r) => r.local === local).map((r) => (
                  <div
                    key={r._id}
                    className={`avail-room ${r.statusClass}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedRoom(r);
                      setWeekAnchor(todayStr());
                      setView("calendar");
                    }}
                  >
                    <div className="avail-room-name">{r.nome}</div>
                    <div className="avail-room-status">● {r.statusLabel}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── TELA 2: CALENDÁRIO DA SALA SELECIONADA ──
  const weekDates = getWeekDates(weekAnchor);
  const slots: number[] = [];
  for (let m = DAY_START * 60; m < DAY_END * 60; m += SLOT_MINUTES) slots.push(m);

  const agendamentosNaSala = todosAgendamentos.filter(
    (a) => a.salaId === selectedRoom._id && a.status === "agendado" && weekDates.includes(a.data)
  );
  const bloqueiosNaSala = bloqueios.filter((b) => b.salaId === selectedRoom._id && weekDates.includes(b.data));

  const getCellInfo = (data: string, slotMin: number) => {
    const slotEnd = slotMin + SLOT_MINUTES;
    const agend = agendamentosNaSala.find(
      (a) => a.data === data && parseTime(a.horarioInicio) < slotEnd && parseTime(a.horarioFim) > slotMin
    );
    if (agend) return { status: "busy" as const, item: agend, isStart: parseTime(agend.horarioInicio) === slotMin };

    const bloqueio = bloqueiosNaSala.find(
      (b) => b.data === data && parseTime(b.horarioInicio) < slotEnd && parseTime(b.horarioFim) > slotMin
    );
    if (bloqueio) return { status: "blocked" as const, item: bloqueio, isStart: parseTime(bloqueio.horarioInicio) === slotMin };

    return { status: "free" as const, item: null, isStart: false };
  };

  const navigateWeek = (dir: number) => {
    const d = new Date(weekAnchor + "T12:00:00");
    d.setDate(d.getDate() + dir * 7);
    setWeekAnchor(d.toISOString().slice(0, 10));
  };

  const weekLabel = () => {
    const s = new Date(weekDates[0] + "T12:00:00");
    const e = new Date(weekDates[6] + "T12:00:00");
    return `${s.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  };

  return (
    <div className="public-page" style={{ maxWidth: 920 }}>
      <Header />

      <div className="flex items-center gap-2 mb-4">
        <button className="btn btn-secondary btn-sm" onClick={() => setView("rooms")}>
          ← Salas
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedRoom.nome}</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>{selectedRoom.local}</div>
        </div>
      </div>

      <div className="card">
        <div className="cal-header">
          <div className="cal-nav">
            <button className="btn btn-secondary btn-sm" onClick={() => navigateWeek(-1)}>
              ‹
            </button>
            <div className="cal-title" style={{ minWidth: 160 }}>
              {weekLabel()}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigateWeek(1)}>
              ›
            </button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekAnchor(todayStr())}>
            Hoje
          </button>
        </div>

        <div className="alert alert-info" style={{ fontSize: 12.5 }}>
          ⏱ Clique em um horário livre para marcar. Agendamentos via link público têm duração máxima de 1 hora.
        </div>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{
            borderCollapse: "collapse",
            width: "100%",
            minWidth: 420,
            tableLayout: "fixed",
          }}>
            <colgroup>
              <col style={{ width: 52 }} />
              {weekDates.map((d) => <col key={d} style={{ width: 80 }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  width: 52,
                  padding: 0,
                }} />
                {weekDates.map((d) => (
                  <th key={d} style={{
                    background: d === todayStr() ? "rgba(196,164,167,0.15)" : "var(--surface2)",
                    border: "1px solid var(--border)",
                    padding: "8px 4px",
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: 12,
                    color: "var(--text2)",
                  }}>
                    <div>{WEEK_DAYS[new Date(d + "T12:00:00").getDay()]}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: d === todayStr() ? "var(--accent2)" : "var(--text)" }}>
                      {new Date(d + "T12:00:00").getDate()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slotMin) => (
                <tr key={slotMin}>
                  <td style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    padding: "2px 6px",
                    fontSize: 10.5,
                    color: "var(--text3)",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    width: 52,
                  }}>
                    {slotMin % 60 === 0 ? minutesToHHMM(slotMin) : ""}
                  </td>
                  {weekDates.map((d) => {
                    const info = getCellInfo(d, slotMin);
                    const isPast =
                      d < todayStr() || (d === todayStr() && slotMin < new Date().getHours() * 60 + new Date().getMinutes());

                    if (info.status === "busy" && !info.isStart) {
                      return <td key={`${d}-${slotMin}`} style={{ background: "rgba(196,105,108,0.08)", border: "1px solid var(--border)", height: 28 }} />;
                    }
                    if (info.status === "blocked" && !info.isStart) {
                      return <td key={`${d}-${slotMin}`} style={{ background: "rgba(196,164,106,0.08)", border: "1px solid var(--border)", height: 28 }} />;
                    }
                    if (info.status === "busy" && info.item) {
                      const durationSlots = Math.round(
                        (parseTime(info.item.horarioFim) - parseTime(info.item.horarioInicio)) / SLOT_MINUTES
                      );
                      return (
                        <td key={`${d}-${slotMin}`}
                          rowSpan={durationSlots}
                          style={{
                            background: "rgba(196,105,108,0.12)",
                            borderLeft: "3px solid var(--red)",
                            border: "1px solid var(--border)",
                            padding: "3px 5px",
                            verticalAlign: "top",
                          }}
                          title={`${info.item.nomeAgendamento} (${info.item.horarioInicio}–${info.item.horarioFim})`}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--red)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {info.item.nomeAgendamento}
                          </div>
                          <div style={{ fontSize: 9.5, color: "var(--red)", opacity: 0.8 }}>
                            {info.item.horarioInicio}–{info.item.horarioFim}
                          </div>
                        </td>
                      );
                    }
                    if (info.status === "blocked" && info.item) {
                      const durationSlots = Math.round(
                        (parseTime(info.item.horarioFim) - parseTime(info.item.horarioInicio)) / SLOT_MINUTES
                      );
                      return (
                        <td key={`${d}-${slotMin}`}
                          rowSpan={durationSlots}
                          style={{
                            background: "rgba(196,164,106,0.12)",
                            borderLeft: "3px solid var(--yellow)",
                            border: "1px solid var(--border)",
                            padding: "3px 5px",
                            verticalAlign: "top",
                          }}
                          title={`Bloqueado: ${info.item.motivo || "sem motivo"}`}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8A7040" }}>⛔</div>
                        </td>
                      );
                    }
                    // free slot
                    return (
                      <td key={`${d}-${slotMin}`}
                        style={{
                          border: "1px solid var(--border)",
                          height: 28,
                          cursor: isPast ? "not-allowed" : "pointer",
                          opacity: isPast ? 0.35 : 1,
                          background: isPast ? "" : "rgba(123,175,158,0.03)",
                          transition: "background 0.1s",
                        }}
                        onClick={() => {
                          if (isPast) return;
                          setModalSlot({
                            data: d,
                            horarioInicio: minutesToHHMM(slotMin),
                            horarioFim: minutesToHHMM(slotMin + SLOT_MINUTES),
                          });
                          setError("");
                        }}
                        onMouseEnter={(e) => { if (!isPast) e.currentTarget.style.background = "rgba(123,175,158,0.12)"; }}
                        onMouseLeave={(e) => { if (!isPast) e.currentTarget.style.background = "rgba(123,175,158,0.03)"; }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalSlot && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalSlot(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Marcar horário</span>
              <button className="modal-close" onClick={() => setModalSlot(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">⚠ {error}</div>}
              <div className="alert alert-info" style={{ fontSize: 12.5 }}>
                📅 {fmtDate(modalSlot.data)} · {selectedRoom.nome} — {selectedRoom.local}
              </div>
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
                <div className="form-group">
                  <label className="required">Horário inicial</label>
                  <input
                    type="time"
                    value={modalSlot.horarioInicio}
                    onChange={(e) => setModalSlot((s) => (s ? { ...s, horarioInicio: e.target.value } : s))}
                  />
                </div>
                <div className="form-group">
                  <label className="required">Horário final</label>
                  <input
                    type="time"
                    value={modalSlot.horarioFim}
                    onChange={(e) => setModalSlot((s) => (s ? { ...s, horarioFim: e.target.value } : s))}
                  />
                </div>
                <div className="form-group col-span-2">
                  <label>Participantes</label>
                  <ParticipantesInput
                    value={form.emailsParticipantes}
                    onChange={(v) => set("emailsParticipantes", v)}
                  />
                </div>
                <div className="form-group col-span-2">
                  <label>Descrição da reunião</label>
                  <textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalSlot(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                ✔ Confirmar agendamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="public-header">
      <div className="public-logo">Charth</div>
      <div className="public-sub">Agendamento de Salas de Reunião</div>
    </div>
  );
}
