import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Tema = "claro" | "escuro";

const CHAVE = "central-lumen-tema";

function temaDoSistema(): Tema {
  if (typeof window === "undefined") return "claro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

export function AlternarTema() {
  const [tema, setTema] = useState<Tema | null>(null);

  // Só depois da hidratação: o servidor não conhece a preferência do usuário.
  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE);
    setTema(salvo === "claro" || salvo === "escuro" ? salvo : temaDoSistema());
  }, []);

  useEffect(() => {
    if (!tema) return;
    document.documentElement.setAttribute("data-tema", tema);
    window.localStorage.setItem(CHAVE, tema);
  }, [tema]);

  const proximo: Tema = tema === "escuro" ? "claro" : "escuro";

  return (
    <button
      type="button"
      onClick={() => setTema(proximo)}
      aria-label={proximo === "escuro" ? "Usar tema escuro" : "Usar tema claro"}
      title={proximo === "escuro" ? "Usar tema escuro" : "Usar tema claro"}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-borda text-texto-suave transition-colors hover:bg-superficie-alta hover:text-texto"
    >
      {tema === "escuro" ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
