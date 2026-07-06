import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { todayStr, fmtDate } from "./lib/helpers";

export default function Dashboard() {
  const agendamentos = useQuery(api.agendamentos.listar) ?? [];
  const salas = useQuery(api.salas.listar) ?? [];
  const bloqueios = useQuery(api.bloqueios.listar) ?? [];

  const hoje = todayStr();
  const hojeCount = agendamentos.filter((a) => a.data === hoje && a.status === "agendado").length;
  const futuros = agendamentos.filter((a) => a.data >= hoje && a.status === "agendado").length;
  const blockCount = bloqueios.filter((b) => b.data >= hoje).length;
  const salasAtivas = salas.filter((s) => s.ativo).length;

  const proximos = agendamentos
    .filter((a) => a.data >= hoje && a.status === "agendado")
    .sort((a, b) => (a.data + a.horarioInicio).localeCompare(b.data + b.horarioInicio))
    .slice(0, 5);

  return (
    <div>
      <div className="stats-grid">
        <Stat label="Agendamentos hoje" value={hojeCount} sub="reuniões marcadas" colorClass="stat-accent" />
        <Stat label="Próximos agend." value={futuros} sub="a partir de hoje" colorClass="stat-green" />
        <Stat label="Bloqueios ativos" value={blockCount} sub="salas indisponíveis" colorClass="stat-yellow" />
        <Stat label="Salas ativas" value={salasAtivas} sub={`de ${salas.length} total`} />
      </div>

      <div className="card">
        <div className="card-title">Próximos agendamentos</div>
        {proximos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-text">Nenhum agendamento futuro</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {["Data", "Horário", "Sala", "Responsável", "Setor", "Status"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proximos.map((a) => {
                  const sala = salas.find((s) => s._id === a.salaId);
                  return (
                    <tr key={a._id}>
                      <td>{fmtDate(a.data)}</td>
                      <td>
                        {a.horarioInicio} – {a.horarioFim}
                      </td>
                      <td>
                        <span className="room-tag">{sala?.nome || "—"}</span>
                      </td>
                      <td>
                        {a.nomeAgendamento}
                        <div style={{ fontSize: 11.5, color: "var(--text3)" }}>{a.responsavelNome}</div>
                      </td>
                      <td>{a.responsavelSetor}</td>
                      <td>
                        <span className="badge badge-green">Agendado</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: number;
  sub: string;
  colorClass?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${colorClass || ""}`}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
