import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";

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

export const listar = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("bloqueiosSala").collect();
  },
});

export const criar = mutation({
  args: {
    salaId: v.id("salas"),
    data: v.string(),
    horarioInicio: v.string(),
    horarioFim: v.string(),
    motivo: v.optional(v.string()),
    criadoPorUsuarioId: v.id("usuariosAdmin"),
  },
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.criadoPorUsuarioId);
    if (!usuario || usuario.perfil !== "admin") {
      throw new ConvexError("Apenas administradores podem criar bloqueios.");
    }

    const inicio = parseTime(args.horarioInicio);
    const fim = parseTime(args.horarioFim);
    if (fim <= inicio) {
      throw new ConvexError("Horário final deve ser após o inicial.");
    }

    // Verifica conflito com agendamentos existentes
    const agendamentos = await ctx.db
      .query("agendamentos")
      .withIndex("by_sala_data", (q) =>
        q.eq("salaId", args.salaId).eq("data", args.data)
      )
      .collect();

    for (const a of agendamentos) {
      if (a.status === "cancelado") continue;
      const as = parseTime(a.horarioInicio);
      const ae = parseTime(a.horarioFim);
      if (inicio < ae && fim > as) {
        throw new ConvexError(
          `Já existe um agendamento neste horário: ${a.nomeAgendamento}`
        );
      }
    }

    return await ctx.db.insert("bloqueiosSala", {
      salaId: args.salaId,
      data: args.data,
      horarioInicio: args.horarioInicio,
      horarioFim: args.horarioFim,
      motivo: args.motivo,
      criadoPorUsuarioId: args.criadoPorUsuarioId,
    });
  },
});

export const excluir = mutation({
  args: { id: v.id("bloqueiosSala") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Cria um bloqueio recorrente: gera uma ocorrência em bloqueiosSala
// pra cada dia dentro do intervalo que cair nos dias da semana escolhidos.
// Ex: diário = diasDaSemana: [0,1,2,3,4,5,6]
export const criarRecorrencia = mutation({
  args: {
    salaId: v.id("salas"),
    diasDaSemana: v.array(v.number()), // 0=domingo ... 6=sábado
    horarioInicio: v.string(),
    horarioFim: v.string(),
    dataInicio: v.string(), // YYYY-MM-DD
    dataFim: v.string(), // YYYY-MM-DD
    motivo: v.optional(v.string()),
    criadoPorUsuarioId: v.id("usuariosAdmin"),
  },
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.criadoPorUsuarioId);
    if (!usuario || usuario.perfil !== "admin") {
      throw new ConvexError("Apenas administradores podem criar bloqueios.");
    }

    const inicio = parseTime(args.horarioInicio);
    const fim = parseTime(args.horarioFim);
    if (fim <= inicio) {
      throw new ConvexError("Horário final deve ser após o inicial.");
    }

    if (args.diasDaSemana.length === 0) {
      throw new ConvexError("Selecione pelo menos um dia da semana.");
    }

    const dataInicioObj = parseDateUTC(args.dataInicio);
    const dataFimObj = parseDateUTC(args.dataFim);
    if (dataFimObj < dataInicioObj) {
      throw new ConvexError("Data final deve ser igual ou após a data inicial.");
    }

    const recorrenciaId = await ctx.db.insert("recorrencias", {
      tipo: "bloqueio",
      salaId: args.salaId,
      diasDaSemana: args.diasDaSemana,
      horarioInicio: args.horarioInicio,
      horarioFim: args.horarioFim,
      dataInicio: args.dataInicio,
      dataFim: args.dataFim,
      motivo: args.motivo,
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

        const agendamentos = await ctx.db
          .query("agendamentos")
          .withIndex("by_sala_data", (q) =>
            q.eq("salaId", args.salaId).eq("data", dataStr)
          )
          .collect();

        let conflito = false;
        for (const a of agendamentos) {
          if (a.status === "cancelado") continue;
          const as = parseTime(a.horarioInicio);
          const ae = parseTime(a.horarioFim);
          if (inicio < ae && fim > as) {
            conflito = true;
            break;
          }
        }

        if (conflito) {
          pulados.push(dataStr);
        } else {
          await ctx.db.insert("bloqueiosSala", {
            salaId: args.salaId,
            data: dataStr,
            horarioInicio: args.horarioInicio,
            horarioFim: args.horarioFim,
            motivo: args.motivo,
            criadoPorUsuarioId: args.criadoPorUsuarioId,
            recorrenciaId,
          });
          criados++;
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { ok: true, recorrenciaId, criados, pulados };
  },
});
