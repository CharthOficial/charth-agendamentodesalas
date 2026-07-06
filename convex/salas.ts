import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Lista todas as salas
export const listar = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("salas").collect();
  },
});

// Lista apenas salas ativas
export const listarAtivas = query({
  args: {},
  handler: async (ctx) => {
    const salas = await ctx.db.query("salas").collect();
    return salas.filter((s) => s.ativo);
  },
});

// Criar nova sala
export const criar = mutation({
  args: {
    nome: v.string(),
    local: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("salas", {
      nome: args.nome,
      local: args.local,
      ativo: true,
    });
  },
});

// Ativar/inativar sala
export const alternarAtivo = mutation({
  args: { id: v.id("salas") },
  handler: async (ctx, args) => {
    const sala = await ctx.db.get(args.id);
    if (!sala) throw new Error("Sala não encontrada");
    await ctx.db.patch(args.id, { ativo: !sala.ativo });
  },
});

// Editar nome/local da sala
export const editar = mutation({
  args: {
    id: v.id("salas"),
    nome: v.string(),
    local: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { nome: args.nome, local: args.local });
  },
});

// Seed inicial das salas da Charth
export const seedSalasCharth = mutation({
  args: {},
  handler: async (ctx) => {
    const existentes = await ctx.db.query("salas").collect();
    if (existentes.length > 0) return { ok: false, msg: "Salas já existem" };

    const salas = [
      { nome: "Sala Principal", local: "Showroom — 9º Andar" },
      { nome: "Sala Frente", local: "Showroom — 9º Andar" },
      { nome: "Sala Fundos", local: "Showroom — 9º Andar" },
      { nome: "Sala Principal", local: "Fábrica" },
      { nome: "Sala RH", local: "Fábrica" },
    ];

    for (const s of salas) {
      await ctx.db.insert("salas", { ...s, ativo: true });
    }
    return { ok: true, msg: `${salas.length} salas criadas` };
  },
});
