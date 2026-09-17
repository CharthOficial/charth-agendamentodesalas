import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAuth } from "./lib/auth";

export default function LoginPage({
  onLoginSuccess,
  onBack,
}: {
  onLoginSuccess: () => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedSenha, setSubmittedSenha] = useState("");
  const [error, setError] = useState("");
  const { setUser } = useAuth();

  const result = useQuery(
    api.usuarios.login,
    submittedEmail ? { email: submittedEmail, senha: submittedSenha } : "skip"
  );

  const handle = () => {
    setError("");
    if (!email || !senha) return setError("Preencha e-mail e senha.");
    setSubmittedEmail(email);
    setSubmittedSenha(senha);
  };

  // Quando o resultado da query chegar, verifica login
  if (submittedEmail && result !== undefined) {
    if (result === null && !error) {
      setError("E-mail ou senha incorretos.");
      setSubmittedEmail("");
    } else if (result) {
      setUser(result as any);
      onLoginSuccess();
    }
  }

  return (
    <div className="login-page">
      <div style={{ position: "fixed", top: 0, left: 0, padding: "16px 20px", zIndex: 100 }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Voltar
        </button>
      </div>
      <div className="login-box">
        <div className="login-box-header">
          <div className="login-logo">Charth</div>
          <div className="login-sub">Painel administrativo de salas</div>
        </div>
        <div className="login-box-body">
          {error && <div className="alert alert-error">⚠ {error}</div>}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@charth.com.br"
              onKeyDown={(e) => e.key === "Enter" && handle()}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handle()}
            />
          </div>
          <button className="btn btn-primary btn-full" onClick={handle}>
            Entrar
          </button>
         </div>
      </div>
    </div>
  );
}
