import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Salas de reunião
  salas: defineTable({
    nome: v.string(),
    local: v.string(),
    ativo: v.boolean(),
  }),

  // Usuários administrativos (admin / gestor)
  usuariosAdmin: defineTable({
    nome: v.string(),
    email: v.string(),
    senhaHash: v.string(), // em produção: usar hash real (bcrypt) via action
    perfil: v.union(v.literal("admin"), v.literal("gestor")),
    ativo: v.boolean(),
  }).index("by_email", ["email"]),

  // Agendamentos
  agendamentos: defineTable({
    salaId: v.id("salas"),
    nomeAgendamento: v.string(),
    responsavelNome: v.string(),
    responsavelSetor: v.string(),
    data: v.string(), // formato YYYY-MM-DD
    horarioInicio: v.string(), // formato HH:MM
    horarioFim: v.string(),
    emailsParticipantes: v.optional(v.string()),
    descricao: v.optional(v.string()),
    status: v.union(
      v.literal("agendado"),
      v.literal("cancelado")
    ),
    criadoPorTipo: v.union(v.literal("publico"), v.literal("admin"), v.literal("gestor")),
    criadoPorUsuarioId: v.optional(v.id("usuariosAdmin")),
    googleCalendarEventId: v.optional(v.string()),
    usuarioAlteracaoId: v.optional(v.id("usuariosAdmin")),
  })
    .index("by_sala_data", ["salaId", "data"])
    .index("by_data", ["data"])
    .index("by_status", ["status"]),

  // Bloqueios de sala
  bloqueiosSala: defineTable({
    salaId: v.id("salas"),
    data: v.string(),
    horarioInicio: v.string(),
    horarioFim: v.string(),
    motivo: v.optional(v.string()),
    criadoPorUsuarioId: v.optional(v.id("usuariosAdmin")),
  })
    .index("by_sala_data", ["salaId", "data"])
    .index("by_data", ["data"]),
});
