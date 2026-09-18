import { query, mutation, internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { api } from "./_generated/api";

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Trabalha em UTC de propósito, pra "YYYY-MM-DD" nunca deslizar de dia
// por causa de fuso horário (evita o bug clássico de toISOString()).
function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Lista todos os agendamentos (painel admin)
export const listar = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agendamentos").collect();
  },
});

// Lista agendamentos filtrados por data
export const listarPorData = query({
  args: { data: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agendamentos")
      .withIndex("by_data", (q) => q.eq("data", args.data))
      .collect();
  },
});

// Lista agendamentos de uma sala numa data (usado para disponibilidade)
export const listarPorSalaData = query({
  args: { salaId: v.id("salas"), data: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agendamentos")
      .withIndex("by_sala_data", (q) =>
        q.eq("salaId", args.salaId).eq("data", args.data)
      )
      .collect();
  },
});

// Verifica conflito de horário para uma sala/data/intervalo
async function verificarConflito(
  ctx: any,
  salaId: any,
  data: string,
  horarioInicio: string,
  horarioFim: string,
  excludeId?: any
) {
  const s = parseTime(horarioInicio);
  const e = parseTime(horarioFim);

  // Checa agendamentos existentes
  const agendamentos = await ctx.db
    .query("agendamentos")
    .withIndex("by_sala_data", (q: any) => q.eq("salaId", salaId).eq("data", data))
    .collect();

  for (const a of agendamentos) {
    if (excludeId && a._id === excludeId) continue;
    if (a.status === "cancelado") continue;
    const as = parseTime(a.horarioInicio);
    const ae = parseTime(a.horarioFim);
    if (s < ae && e > as) {
      return { tipo: "agendamento" as const, item: a };
    }
  }

  // Checa bloqueios
  const bloqueios = await ctx.db
    .query("bloqueiosSala")
    .withIndex("by_sala_data", (q: any) => q.eq("salaId", salaId).eq("data", data))
    .collect();

  for (const b of bloqueios) {
    const bs = parseTime(b.horarioInicio);
    const be = parseTime(b.horarioFim);
    if (s < be && e > bs) {
      return { tipo: "bloqueio" as const, item: b };
    }
  }

  return null;
}

// Cria um novo agendamento (com todas as validações de negócio)
export const criar = mutation({
  args: {
    salaId: v.id("salas"),
    nomeAgendamento: v.string(),
    responsavelNome: v.string(),
    responsavelSetor: v.string(),
    data: v.string(),
    horarioInicio: v.string(),
    horarioFim: v.string(),
    emailsParticipantes: v.optional(v.string()),
    descricao: v.optional(v.string()),
    criadoPorTipo: v.union(v.literal("publico"), v.literal("admin"), v.literal("gestor")),
    criadoPorUsuarioId: v.optional(v.id("usuariosAdmin")),
  },
  handler: async (ctx, args) => {
    // Validação de horário
    const inicio = parseTime(args.horarioInicio);
    const fim = parseTime(args.horarioFim);
    if (fim <= inicio) {
      throw new ConvexError("O horário final deve ser após o horário inicial.");
    }

    // Validação de limite por perfil
    const duracaoHoras = (fim - inicio) / 60;
    const limites: Record<string, number> = {
      publico: 1,
      gestor: 3,
      admin: Infinity,
    };
    const limite = limites[args.criadoPorTipo];
    if (duracaoHoras > limite) {
      const labels: Record<string, string> = {
        publico: "Usuários comuns podem criar agendamentos de no máximo 1 hora.",
        gestor: "Gestores podem criar agendamentos de no máximo 3 horas.",
        admin: "",
      };
      throw new ConvexError(labels[args.criadoPorTipo]);
    }

    // Validação de conflito
    const conflito = await verificarConflito(
      ctx,
      args.salaId,
      args.data,
      args.horarioInicio,
      args.horarioFim
    );
    if (conflito) {
      if (conflito.tipo === "bloqueio") {
        throw new ConvexError(
          `Esta sala está bloqueada neste horário. Motivo: ${conflito.item.motivo || "não informado"}`
        );
      }
      throw new ConvexError(
        `Conflito de horário: já existe o agendamento "${conflito.item.nomeAgendamento}" das ${conflito.item.horarioInicio} às ${conflito.item.horarioFim}.`
      );
    }

    // Cria o agendamento — em produção, o evento do Google Agenda seria
    // criado aqui via Convex Action (chamada HTTP externa)
    const id = await ctx.db.insert("agendamentos", {
      salaId: args.salaId,
      nomeAgendamento: args.nomeAgendamento,
      responsavelNome: args.responsavelNome,
      responsavelSetor: args.responsavelSetor,
      data: args.data,
      horarioInicio: args.horarioInicio,
      horarioFim: args.horarioFim,
      emailsParticipantes: args.emailsParticipantes,
      descricao: args.descricao,
      status: "agendado",
      criadoPorTipo: args.criadoPorTipo,
      criadoPorUsuarioId: args.criadoPorUsuarioId,
      googleCalendarEventId: `evt_${Date.now()}`, // placeholder
    });

    return id;
  },
});

// Edita um agendamento existente
export const editar = mutation({
  args: {
    id: v.id("agendamentos"),
    salaId: v.id("salas"),
    nomeAgendamento: v.string(),
    responsavelNome: v.string(),
    responsavelSetor: v.string(),
    data: v.string(),
    horarioInicio: v.string(),
    horarioFim: v.string(),
    emailsParticipantes: v.optional(v.string()),
    descricao: v.optional(v.string()),
    perfilEditor: v.union(v.literal("admin"), v.literal("gestor")),
    usuarioAlteracaoId: v.optional(v.id("usuariosAdmin")),
  },
  handler: async (ctx, args) => {
    const inicio = parseTime(args.horarioInicio);
    const fim = parseTime(args.horarioFim);
    if (fim <= inicio) {
      throw new ConvexError("O horário final deve ser após o horário inicial.");
    }

    const duracaoHoras = (fim - inicio) / 60;
    if (args.perfilEditor === "gestor" && duracaoHoras > 3) {
      throw new ConvexError("Gestores podem criar agendamentos de no máximo 3 horas.");
    }

    const conflito = await verificarConflito(
      ctx,
      args.salaId,
      args.data,
      args.horarioInicio,
      args.horarioFim,
      args.id
    );
    if (conflito) {
      if (conflito.tipo === "bloqueio") {
        throw new ConvexError(
          `Esta sala está bloqueada neste horário. Motivo: ${conflito.item.motivo || "não informado"}`
        );
      }
      throw new ConvexError(
        `Conflito de horário: já existe o agendamento "${conflito.item.nomeAgendamento}".`
      );
    }

    await ctx.db.patch(args.id, {
      salaId: args.salaId,
      nomeAgendamento: args.nomeAgendamento,
      responsavelNome: args.responsavelNome,
      responsavelSetor: args.responsavelSetor,
      data: args.data,
      horarioInicio: args.horarioInicio,
      horarioFim: args.horarioFim,
      emailsParticipantes: args.emailsParticipantes,
      descricao: args.descricao,
      usuarioAlteracaoId: args.usuarioAlteracaoId,
    });
  },
});

// Exclui (cancela) um agendamento — apenas Admin
export const excluir = mutation({
  args: {
    id: v.id("agendamentos"),
    usuarioId: v.id("usuariosAdmin"),
  },
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.usuarioId);
    if (!usuario || usuario.perfil !== "admin") {
      throw new ConvexError("Apenas administradores podem excluir agendamentos.");
    }
    await ctx.db.patch(args.id, {
      status: "cancelado",
      usuarioAlteracaoId: args.usuarioId,
    });
  },
});
// Cria um agendamento recorrente: gera uma ocorrência em agendamentos
// pra cada dia dentro do intervalo que cair nos dias da semana escolhidos.
// Restrito a administradores (sem limite de duração, diferente do fluxo avulso).
export const criarRecorrencia = mutation({
  args: {
    salaId: v.id("salas"),
    nomeAgendamento: v.string(),
    responsavelNome: v.string(),
    responsavelSetor: v.string(),
    diasDaSemana: v.array(v.number()), // 0=domingo ... 6=sábado
    horarioInicio: v.string(),
    horarioFim: v.string(),
    dataInicio: v.string(), // YYYY-MM-DD
    dataFim: v.string(), // YYYY-MM-DD
    emailsParticipantes: v.optional(v.string()),
    descricao: v.optional(v.string()),
    criadoPorUsuarioId: v.id("usuariosAdmin"),
  },
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.criadoPorUsuarioId);
    if (!usuario || (usuario.perfil !== "admin" && usuario.perfil !== "gestor")) {
      throw new ConvexError("Apenas administradores e gestores podem criar agendamentos recorrentes.");
    }

    const inicio = parseTime(args.horarioInicio);
    const fim = parseTime(args.horarioFim);
    if (fim <= inicio) {
      throw new ConvexError("O horário final deve ser após o horário inicial.");
    }

    const duracaoHoras = (fim - inicio) / 60;
    if (usuario.perfil === "gestor" && duracaoHoras > 3) {
      throw new ConvexError("Gestores podem criar agendamentos de no máximo 3 horas por ocorrência.");
    }

    if (args.diasDaSemana.length === 0) {
      throw new ConvexError("Selecione pelo menos um dia da semana.");
    }

    const dataInicioObj = parseDateUTC(args.dataInicio);
    const dataFimObj = parseDateUTC(args.dataFim);
    if (dataFimObj < dataInicioObj) {
      throw new ConvexError("Data final deve ser igual ou após a data inicial.");
    }

    const sala = await ctx.db.get(args.salaId);

    const recorrenciaId = await ctx.db.insert("recorrencias", {
      tipo: "agendamento",
      salaId: args.salaId,
      diasDaSemana: args.diasDaSemana,
      horarioInicio: args.horarioInicio,
      horarioFim: args.horarioFim,
      dataInicio: args.dataInicio,
      dataFim: args.dataFim,
      nomeAgendamento: args.nomeAgendamento,
      responsavelNome: args.responsavelNome,
      responsavelSetor: args.responsavelSetor,
      emailsParticipantes: args.emailsParticipantes,
      descricao: args.descricao,
      criadoPorUsuarioId: args.criadoPorUsuarioId,
      ativa: true,
      geradoAte: args.dataFim,
    });

    let criados = 0;
    const pulados: string[] = [];
    const cursor = new Date(dataInicioObj);

    while (cursor.getTime() <= dataFimObj.getTime()) {
      if (args.diasDaSemana.includes(cursor.getUTCDay())) {
        const dataStr = formatDateUTC(cursor);

        const conflito = await verificarConflito(
          ctx,
          args.salaId,
          dataStr,
          args.horarioInicio,
          args.horarioFim
        );

        if (conflito) {
          pulados.push(dataStr);
        } else {
          const agendamentoId = await ctx.db.insert("agendamentos", {
            salaId: args.salaId,
            nomeAgendamento: args.nomeAgendamento,
            responsavelNome: args.responsavelNome,
            responsavelSetor: args.responsavelSetor,
            data: dataStr,
            horarioInicio: args.horarioInicio,
            horarioFim: args.horarioFim,
            emailsParticipantes: args.emailsParticipantes,
            descricao: args.descricao,
            status: "agendado",
            criadoPorTipo: usuario.perfil,
            criadoPorUsuarioId: args.criadoPorUsuarioId,
            googleCalendarEventId: `evt_${Date.now()}_${dataStr}`, // placeholder
            recorrenciaId,
          });

          // Agenda a criação do evento no Google Calendar de forma assíncrona
          // (mutations não podem chamar fetch diretamente; o scheduler roda
          // isso como uma Action logo após o commit desta mutation, sem
          // bloquear a criação das demais ocorrências caso uma falhe).
          await ctx.scheduler.runAfter(0, api.googleCalendar.criarEvento, {
            agendamentoId,
            nomeAgendamento: args.nomeAgendamento,
            responsavelNome: args.responsavelNome,
            data: dataStr,
            horarioInicio: args.horarioInicio,
            horarioFim: args.horarioFim,
            emailsParticipantes: args.emailsParticipantes,
            descricao: args.descricao,
            salaNome: sala?.nome ?? "",
            salaLocal: sala?.local ?? "",
          });

          criados++;
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { ok: true, recorrenciaId, criados, pulados };
  },
});

// Salva o ID do evento Google Calendar (chamado internamente)
export const salvarGoogleEventId = internalMutation({
  args: {
    id: v.id("agendamentos"),
    googleCalendarEventId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      googleCalendarEventId: args.googleCalendarEventId,
    });
  },
});