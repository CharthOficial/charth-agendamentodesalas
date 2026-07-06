import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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
      throw new Error("Apenas administradores podem criar bloqueios.");
    }

    const inicio = parseTime(args.horarioInicio);
    const fim = parseTime(args.horarioFim);
    if (fim <= inicio) {
      throw new Error("Horário final deve ser após o inicial.");
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
        throw new Error(
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
