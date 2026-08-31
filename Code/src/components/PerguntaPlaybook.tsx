import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { texto } from "@/lib/formato";
import { Cartao, Esqueleto, Procedencia, TituloSecao } from "./comuns";

export function PerguntaPlaybook({ aoErro }: { aoErro: (erro: unknown) => void }) {
  const [pergunta, setPergunta] = useState("");

  const mutacao = useMutation({
    mutationFn: (texto: string) => api.perguntar(texto),
    onError: aoErro,
  });

  const fonte = mutacao.data?.fonte ?? null;
  const paraRevisar = fonte?.status === "Para revisar";

  return (
    <section className="flex min-w-0 flex-col gap-bloco">
      <TituloSecao>Pergunta ao playbook</TituloSecao>

      {/* Quebra pelo conteúdo: o botão desce quando o campo deixa de caber. */}
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const valor = pergunta.trim();
          if (valor) mutacao.mutate(valor);
        }}
      >
        <input
          type="text"
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Ex.: quais são os pisos de presença para a extensão?"
          aria-label="Pergunta ao playbook"
          className="min-w-[16rem] flex-1 rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-texto placeholder:text-texto-fraco focus:border-marca focus:outline-none"
        />
        <button
          type="submit"
          disabled={mutacao.isPending || !pergunta.trim()}
          className="shrink-0 rounded-md bg-marca px-4 py-2 text-sm font-medium text-marca-contraste transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {mutacao.isPending ? "Perguntando…" : "Perguntar"}
        </button>
      </form>

      {mutacao.isPending ? (
        <Cartao className="flex flex-col gap-2 p-4">
          <Esqueleto className="h-4 w-full" />
          <Esqueleto className="h-4 w-5/6" />
          <Esqueleto className="h-4 w-2/3" />
          <Esqueleto className="mt-2 h-4 w-48" />
        </Cartao>
      ) : mutacao.isError ? (
        <Cartao className="p-4">
          <p className="text-sm text-texto">{(mutacao.error as Error).message}</p>
          <button
            type="button"
            onClick={() => mutacao.mutate(pergunta.trim())}
            className="mt-2 rounded-md border border-borda-forte bg-superficie-alta px-3 py-2 text-sm font-medium text-texto"
          >
            Tentar de novo
          </button>
        </Cartao>
      ) : mutacao.data ? (
        <Cartao className="flex flex-col gap-2 p-4">
          {paraRevisar ? (
            <p className="rounded-md bg-media-suave px-3 py-2 text-xs text-media">
              Esta resposta se apoia em regra pendente de revisão.
            </p>
          ) : null}
          <p className="whitespace-pre-wrap text-sm text-texto">{texto(mutacao.data.resposta)}</p>
          <Procedencia fonte={fonte} />
        </Cartao>
      ) : null}
    </section>
  );
}
