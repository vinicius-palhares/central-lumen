import { Search } from "lucide-react";
import { corDoPrazo, data, texto, TRACO } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Cartao, Esqueleto, ListaComErro, ListaVazia, TituloSecao } from "./comuns";
import type { Aluno } from "@/lib/tipos";

export function ListaAlunos({
  alunos,
  busca,
  aoBuscar,
  carregando,
  erro,
  aoTentarDeNovo,
  aoAbrirAluno,
}: {
  alunos?: Aluno[] | null;
  busca: string;
  aoBuscar: (valor: string) => void;
  carregando: boolean;
  erro: string | null;
  aoTentarDeNovo: () => void;
  aoAbrirAluno: (alunoId: number) => void;
}) {
  const itens = alunos ?? [];

  return (
    <section className="flex min-w-0 flex-col gap-bloco">
      {/* Título e busca formam um grupo (8px); a lista é outro (24px do pai). */}
      <div className="flex flex-col gap-grupo">
        <TituloSecao>Alunos</TituloSecao>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-fraco"
            aria-hidden="true"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => aoBuscar(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar aluno"
            className="w-full rounded-md border border-borda bg-superficie py-2 pl-9 pr-3 text-sm text-texto placeholder:text-texto-fraco focus:border-marca focus:outline-none"
          />
        </div>
      </div>

      {carregando ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Cartao key={i} className="p-3">
              <Esqueleto className="h-4 w-40" />
              <Esqueleto className="mt-2 h-3 w-24" />
            </Cartao>
          ))}
        </div>
      ) : erro ? (
        <ListaComErro mensagem={erro} aoTentarDeNovo={aoTentarDeNovo} />
      ) : itens.length === 0 ? (
        busca.trim() ? (
          <ListaVazia
            mensagem={`Nenhum aluno encontrado para "${busca.trim()}"`}
            detalhe="A busca olha nome e e-mail."
            acao={{ rotulo: "Limpar a busca", aoClicar: () => aoBuscar("") }}
          />
        ) : (
          <ListaVazia
            mensagem="Nenhum aluno cadastrado"
            detalhe="Rode o script de carga para popular a base de alunos no Notion."
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {/* Já vem ordenado por urgência de acesso. */}
          {itens.map((aluno) => (
            <Cartao key={aluno.alunoId} className="overflow-hidden">
              <button
                type="button"
                onClick={() => aoAbrirAluno(aluno.alunoId)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors hover:bg-superficie-alta"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="max-w-full break-words text-sm font-medium text-texto">
                    {texto(aluno.nome)}
                  </span>
                  <span className="max-w-full break-words text-xs text-texto-suave">
                    {aluno.turma ? aluno.turma : "Sem turma"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={cn(
                      "tabular block text-xs font-medium",
                      corDoPrazo(aluno.diasDeAcesso),
                    )}
                  >
                    {aluno.acessoAte ? data(aluno.acessoAte) : TRACO}
                  </span>
                </span>
              </button>
            </Cartao>
          ))}
        </div>
      )}
    </section>
  );
}
