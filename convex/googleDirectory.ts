import { action } from "./_generated/server";
import { v } from "convex/values";

// Gera um JWT para autenticação com a Google API via Service Account
async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  // A API de Diretório exige que a conta impersonada tenha privilégio de
  // administrador no Workspace — diferente da API de Calendar, que aceita
  // qualquer conta. Por isso usa uma env var própria (GOOGLE_DIRECTORY_ADMIN_EMAIL),
  // em vez de reaproveitar GOOGLE_ADMIN_EMAIL (usada pelo Calendar).
  const adminEmail = process.env.GOOGLE_DIRECTORY_ADMIN_EMAIL || process.env.GOOGLE_ADMIN_EMAIL!;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY!;

  // Normaliza a chave privada (substitui \n literais por quebras de linha reais)
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    sub: adminEmail, // impersonar o admin para acessar o diretório
    scope: "https://www.googleapis.com/auth/admin.directory.user.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Importa a chave privada RSA
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

  // Troca o JWT por um access token
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

// Busca todos os usuários ativos do domínio
export const buscarColaboradores = action({
  args: { query: v.optional(v.string()) },
  handler: async (_, args) => {
    try {
      const accessToken = await getGoogleAccessToken();
      const directoryEmail = process.env.GOOGLE_DIRECTORY_ADMIN_EMAIL || process.env.GOOGLE_ADMIN_EMAIL!;
      const domain = directoryEmail.split("@")[1];

      // Busca todas as páginas de usuários do domínio (a API do Google
      // Admin SDK pagina em blocos de até 500; sem isso, domínios com
      // mais de 200 pessoas perdiam quem viesse depois na ordem alfabética)
      let allUsers: any[] = [];
      let pageToken: string | undefined;

      do {
        const url = new URL("https://admin.googleapis.com/admin/directory/v1/users");
        url.searchParams.set("domain", domain);
        url.searchParams.set("maxResults", "200");
        url.searchParams.set("orderBy", "givenName");
        url.searchParams.set("fields", "nextPageToken,users(primaryEmail,name/fullName,suspended)");
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Erro na API do Google: ${err}`);
        }

        const data = await response.json();
        allUsers = allUsers.concat(data.users || []);
        pageToken = data.nextPageToken;
      } while (pageToken);

      const users = allUsers
        .filter((u: any) => !u.suspended)
        .map((u: any) => ({
          nome: u.name?.fullName || u.primaryEmail,
          email: u.primaryEmail,
        }));

      // Filtra por query se fornecida — cada palavra digitada precisa
      // aparecer em algum lugar do nome ou e-mail (não exige que a frase
      // inteira apareça como sequência exata, o que falhava por qualquer
      // pequena diferença de espaçamento ou ordem das palavras).
      if (args.query && args.query.trim().length > 0) {
        const termos = args.query.toLowerCase().trim().split(/\s+/);
        return users.filter((u: any) => {
          const alvo = `${u.nome} ${u.email}`.toLowerCase();
          return termos.every((termo) => alvo.includes(termo));
        });
      }

      return users;
    } catch (error: any) {
      throw new Error(`Erro ao buscar colaboradores: ${error.message}`);
    }
  },
});
