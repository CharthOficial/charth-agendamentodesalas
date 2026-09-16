import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

async function getGoogleAccessToken(scope: string): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL!;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY!;
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    sub: adminEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const pemBody = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Falha ao obter token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// Cria um evento no Google Calendar
export const criarEvento = action({
  args: {
    agendamentoId: v.id("agendamentos"),
    nomeAgendamento: v.string(),
    responsavelNome: v.string(),
    responsavelEmail: v.optional(v.string()),
    data: v.string(), // YYYY-MM-DD
    horarioInicio: v.string(), // HH:MM
    horarioFim: v.string(),
    emailsParticipantes: v.optional(v.string()),
    descricao: v.optional(v.string()),
    salaNome: v.string(),
    salaLocal: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const accessToken = await getGoogleAccessToken(
        "https://www.googleapis.com/auth/calendar"
      );

      // Monta a lista de participantes
      const attendees: { email: string }[] = [];

      if (args.responsavelEmail) {
        attendees.push({ email: args.responsavelEmail });
      }

      if (args.emailsParticipantes) {
        const emails = args.emailsParticipantes
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        for (const email of emails) {
          if (!attendees.find((a) => a.email === email)) {
            attendees.push({ email });
          }
        }
      }

      // Monta o evento
      const evento = {
        summary: args.nomeAgendamento,
        location: `${args.salaNome} — ${args.salaLocal}`,
        description: args.descricao
          ? `${args.descricao}\n\nAgendado via Portal Charth`
          : `Agendado via Portal Charth\nResponsável: ${args.responsavelNome}`,
        start: {
          dateTime: `${args.data}T${args.horarioInicio}:00`,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: `${args.data}T${args.horarioFim}:00`,
          timeZone: "America/Sao_Paulo",
        },
        attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 },
            { method: "popup", minutes: 15 },
          ],
        },
        guestsCanModify: false,
        guestsCanInviteOthers: false,
      };

      // Usa o calendário do admin como organizador
      const calendarId = process.env.GOOGLE_ADMIN_EMAIL!;

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(evento),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Erro ao criar evento no Google Calendar:", data);
        return { ok: false, error: JSON.stringify(data) };
      }

      // Salva o ID do evento no agendamento
      await ctx.runMutation(internal.agendamentos.salvarGoogleEventId, {
        id: args.agendamentoId,
        googleCalendarEventId: data.id,
      });

      return { ok: true, eventId: data.id };
    } catch (error: any) {
      console.error("Erro ao criar evento Google Calendar:", error.message);
      return { ok: false, error: error.message };
    }
  },
});

// Cancela um evento no Google Calendar
export const cancelarEvento = action({
  args: {
    googleCalendarEventId: v.string(),
  },
  handler: async (_, args) => {
    try {
      const accessToken = await getGoogleAccessToken(
        "https://www.googleapis.com/auth/calendar"
      );

      const calendarId = process.env.GOOGLE_ADMIN_EMAIL!;

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events/${args.googleCalendarEventId}?sendUpdates=all`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.status === 204 || response.status === 200) {
        return { ok: true };
      }

      const data = await response.json().catch(() => ({}));
      return { ok: false, error: JSON.stringify(data) };
    } catch (error: any) {
      return { ok: false, error: error.message };
    }
  },
});
