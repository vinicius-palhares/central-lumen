import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { classeConfianca } from "@/lib/formato";
import type { Fonte } from "@/lib/tipos";

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Cartao({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-borda bg-superficie", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function TituloSecao({
  children,
  contagem,
}: {
  children: React.ReactNode;
  contagem?: string | undefined;
}) {

  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-base font-semibold text-texto">{children}</h2>
      {contagem !== undefined && (
        <span className="tabular text-sm text-texto-suave">{contagem}</span>
      )}
    </div>
  );
}

/** Procedência: título da regra usada e chip de confiança. */
export function Procedencia({ fonte }: { fonte: Fonte | null | undefined }) {
  if (!fonte || !fonte.titulo) {
    return <p className="text-xs text-texto-fraco">sem fonte identificada</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-texto-suave">{fonte.titulo}</span>
      <Chip className={classeConfianca(fonte.confianca)}>
        confiança {fonte.confianca ?? "não informada"}
      </Chip>
    </div>
  );
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-superficie-alta", className)} />;
}

export function ListaVazia({ mensagem }: { mensagem: string }) {
  return (
    <Cartao className="p-6">
      <p className="text-sm text-texto-suave">{mensagem}</p>
    </Cartao>
  );
}

export function ListaComErro({
  mensagem,
  aoTentarDeNovo,
}: {
  mensagem: string;
  aoTentarDeNovo: () => void;
}) {
  return (
    <Cartao className="p-6">
      <p className="text-sm text-texto">{mensagem}</p>
      <button
        type="button"
        onClick={aoTentarDeNovo}
        className="mt-2 inline-flex items-center justify-center rounded-md border border-borda-forte bg-superficie-alta px-3 py-2 text-sm font-medium text-texto transition-colors hover:bg-superficie"
      >
        Tentar de novo
      </button>
    </Cartao>
  );
}

/** Consulta de mídia sem preset de aparelho: o ponto vem do conteúdo. */
export function useMediaQuery(consulta: string): boolean {
  const [combina, setCombina] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(consulta);
    setCombina(mql.matches);
    const aoMudar = (e: MediaQueryListEvent) => setCombina(e.matches);
    mql.addEventListener("change", aoMudar);
    return () => mql.removeEventListener("change", aoMudar);
  }, [consulta]);

  return combina;
}
