import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

type Colaborador = { nome: string; email: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function ParticipantesInput({ value, onChange }: Props) {
  const buscarColaboradores = useAction(api.googleDirectory.buscarColaboradores);

  const [query, setQuery] = useState("");
  const [sugestoes, setSugestoes] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selecionados, setSelecionados] = useState<Colaborador[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  // Sincroniza selecionados com value externo na primeira renderização
  useEffect(() => {
    if (value && selecionados.length === 0) {
      const emails = value.split(",").map((e) => e.trim()).filter(Boolean);
      setSelecionados(emails.map((e) => ({ nome: e, email: e })));
    }
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setSugestoes([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await buscarColaboradores({ query: q });
        // Filtra os já selecionados
        const emails = selecionados.map((s) => s.email);
        setSugestoes(results.filter((r: Colaborador) => !emails.includes(r.email)));
      } catch {
        setSugestoes([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const addParticipant = (c: Colaborador) => {
    const novos = [...selecionados, c];
    setSelecionados(novos);
    onChange(novos.map((s) => s.email).join(", "));
    setQuery("");
    setSugestoes([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removeParticipant = (email: string) => {
    const novos = selecionados.filter((s) => s.email !== email);
    setSelecionados(novos);
    onChange(novos.map((s) => s.email).join(", "));
  };

  // Permite digitar e-mail manualmente (Enter ou vírgula)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && query.trim()) {
      e.preventDefault();
      const email = query.trim().replace(/,$/, "");
      if (email && !selecionados.find((s) => s.email === email)) {
        addParticipant({ nome: email, email });
      }
    }
    if (e.key === "Backspace" && query === "" && selecionados.length > 0) {
      removeParticipant(selecionados[selecionados.length - 1].email);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "6px 10px",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          minHeight: 42,
          cursor: "text",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {selecionados.map((s) => (
          <div
            key={s.email}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(196,164,167,0.2)",
              border: "1px solid rgba(196,164,167,0.35)",
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 12.5,
              color: "var(--text)",
              maxWidth: 220,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.nome !== s.email ? (
                <>
                  <span style={{ fontWeight: 600 }}>{s.nome}</span>
                  <span style={{ color: "var(--text3)", marginLeft: 4 }}>{s.email}</span>
                </>
              ) : (
                s.email
              )}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); removeParticipant(s.email); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text3)",
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder={selecionados.length === 0 ? "Digite nome ou e-mail..." : ""}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13.5,
            color: "var(--text)",
            flex: 1,
            minWidth: 140,
            padding: "2px 0",
          }}
        />
      </div>

      {showDropdown && (query.length >= 2) && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "var(--shadow)",
            zIndex: 200,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text3)" }}>
              Buscando...
            </div>
          )}
          {!loading && sugestoes.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text3)" }}>
              Nenhum colaborador encontrado. Pressione Enter para adicionar como e-mail.
            </div>
          )}
          {!loading && sugestoes.map((s) => (
            <div
              key={s.email}
              onClick={() => addParticipant(s)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                borderBottom: "1px solid rgba(226,208,211,0.4)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
                {s.nome}
              </span>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>{s.email}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
        Digite para buscar colaboradores Charth ou pressione Enter para adicionar um e-mail externo
      </div>
    </div>
  );
}
