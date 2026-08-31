import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { classeSeveridade, data, texto, TRACO } from "@/lib/formato";
import { Cartao, Chip, Esqueleto, ListaComErro, ListaVazia, TituloSecao } from "./comuns";
import type { Alerta } from "@/lib/tipos";

function corDaSeveridade(severidade: string | null | undefined) {
  if (severidade === "Alta") return "hsl(var(--alta))";
  if (severidade === "Média") return "hsl(var(--media))";
  return "hsl(var(--baixa))";
}

function CardAlerta({ alerta }: { alerta: Alerta }) {
  const [aberto, setAberto] = useState(false);
  const cores = classeSeveridade(alerta.severidade);

  return (
    <Cartao
      className="flex min-w-0 flex-col gap-grupo p-4"
      style={{
        borderInlineStartWidth: 3,
        borderInlineStartColor: corDaSeveridade(alerta.severidade),
      }}
    >
      {/* Sem largura fixa e sem reticências: nome de pessoa quebra em duas linhas. */}
      <h3 className="max-w-full break-words text-sm font-medium text-texto">
        {texto(alerta.titulo)}
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        {alerta.tipo ? (
          <Chip className="bg-superficie-alta text-texto-suave">{alerta.tipo}</Chip>
        ) : null}
        <Chip className={cores.chip}>{texto(alerta.severidade)}</Chip>
        {alerta.prazo ? (
          <span className="text-xs text-texto-suave">Prazo {data(alerta.prazo)}</span>
        ) : null}
        {alerta.status ? <span className="text-xs text-texto-fraco">{alerta.status}</span> : null}
      </div>

      <p className={cn("text-sm text-texto-suave", !aberto && "linhas-duas")}>
        {texto(alerta.leitura)}
      </p>

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-borda bg-superficie-alta px-3 py-1.5 text-xs font-medium text-texto transition-colors hover:bg-superficie"
      >
        {aberto ? "Ocultar a conta" : "Ver a conta"}
        <ChevronDown
          className={cn("size-4 transition-transform", aberto && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {aberto ? (
        <>
          {/* Monoespaçado e determinístico: rola sozinho, sem arrastar a página. */}
          <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-md bg-superficie-alta p-3">
            <pre className="whitespace-pre font-mono text-xs text-texto">
              {alerta.conta ? alerta.conta : TRACO}
            </pre>
          </div>
          {alerta.url ? (
            <a
              href={alerta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-marca hover:underline"
            >
              Abrir no Notion
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="text-xs text-texto-fraco">Sem link no Notion</span>
          )}
        </>
      ) : null}
    </Cartao>
  );
}

export function ListaAlertas({
  alertas,
  carregando,
  erro,
  aoTentarDeNovo,
}: {
  alertas?: Alerta[] | null;
  carregando: boolean;
  erro: string | null;
  aoTentarDeNovo: () => void;
}) {
  const itens = alertas ?? [];
  const mostrarContagem = !carregando && !erro;

  return (
    <section className="flex min-w-0 flex-col gap-bloco">
      {mostrarContagem ? (
        <TituloSecao contagem={String(itens.length)}>Alertas abertos</TituloSecao>
      ) : (
        <TituloSecao>Alertas abertos</TituloSecao>
      )}

      {carregando ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Cartao key={i} className="p-4" style={{ borderInlineStartWidth: 3 }}>
              <Esqueleto className="h-5 w-3/4" />
              <Esqueleto className="mt-2 h-5 w-40" />
              <Esqueleto className="mt-2 h-9 w-full" />
              <Esqueleto className="mt-2 h-7 w-28" />
            </Cartao>
          ))}
        </div>
      ) : erro ? (
        <ListaComErro mensagem={erro} aoTentarDeNovo={aoTentarDeNovo} />
      ) : itens.length === 0 ? (
        <ListaVazia
          mensagem="Nenhum alerta aberto"
          detalhe="A varredura roda de segunda a sexta e abre um alerta sempre que encontra um caso que exige ação da coordenação."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Já vem ordenado por severidade: a ordem da API é preservada. */}
          {itens.map((alerta) => (
            <CardAlerta key={String(alerta.id)} alerta={alerta} />
          ))}
        </div>
      )}
    </section>
  );
}
