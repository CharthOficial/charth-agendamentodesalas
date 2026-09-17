import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";

// ATENÇÃO: Para produção, a senha deve ser validada com hash (bcrypt)
// rodando numa Convex Action, nunca em texto puro como neste exemplo de teste.

export const listar = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("usuariosAdmin").collect();
  },
});

export const login = query({
  args: { email: v.string(), senha: v.string() },
  handler: async (ctx, args) => {
    const usuario = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!usuario || !usuario.ativo) return null;
    if (usuario.senhaHash !== args.senha) return null; // simplificado p/ teste

    return {
      id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };
  },
});

export const criar = mutation({
  args: {
    nome: v.string(),
    email: v.string(),
    senha: v.string(),
    perfil: v.union(v.literal("admin"), v.literal("gestor")),
  },
  handler: async (ctx, args) => {
    const existente = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existente) throw new ConvexError("Este e-mail já está cadastrado.");

    return await ctx.db.insert("usuariosAdmin", {
      nome: args.nome,
      email: args.email,
      senhaHash: args.senha, // simplificado p/ teste
      perfil: args.perfil,
      ativo: true,
    });
  },
});

export const alternarAtivo = mutation({
  args: { id: v.id("usuariosAdmin") },
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.id);
    if (!usuario) throw new ConvexError("Usuário não encontrado");
    await ctx.db.patch(args.id, { ativo: !usuario.ativo });
  },
});

// Troca a senha de um usuário administrativo
export const alterarSenha = mutation({
  args: {
    id: v.id("usuariosAdmin"),
    novaSenha: v.string(),
  },
  handler: async (ctx, args) => {
    const usuario = await ctx.db.get(args.id);
    if (!usuario) throw new ConvexError("Usuário não encontrado");

    if (args.novaSenha.length < 6) {
      throw new ConvexError("A senha deve ter pelo menos 6 caracteres.");
    }

    await ctx.db.patch(args.id, { senhaHash: args.novaSenha }); // simplificado p/ teste
  },
});

// Seed inicial dos usuários de teste
export const seedUsuariosCharth = mutation({
  args: {},
  handler: async (ctx) => {
    const existentes = await ctx.db.query("usuariosAdmin").collect();
    if (existentes.length > 0) return { ok: false, msg: "Usuários já existem" };

    await ctx.db.insert("usuariosAdmin", {
      nome: "Admin Charth",
      email: "admin@charth.com.br",
      senhaHash: "admin123",
      perfil: "admin",
      ativo: true,
    });
    await ctx.db.insert("usuariosAdmin", {
      nome: "Ana Gestora",
      email: "ana@charth.com.br",
      senhaHash: "gestor123",
      perfil: "gestor",
      ativo: true,
    });

    return { ok: true, msg: "2 usuários criados" };
  },
});
