import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { data, diasEmPalavras, numero, texto, TRACO } from "@/lib/formato";
import { Esqueleto, ListaComErro, Procedencia, useMediaQuery } from "./comuns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Aluno, Avaliacao, Criterio } from "@/lib/tipos";

function Rotulo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
      <span className="text-xs text-texto-suave">{rotulo}</span>
      <span className="text-right text-sm text-texto">{valor}</span>
    </div>
  );
}

/**
 * Barra de presença de UMA fase. CARPA e Pilares nunca se somam nem viram
 * média: a instituição define pisos independentes por fase.
 */
function BarraFase({
  nome,
  presente,
  total,
}: {
  nome: string;
  presente: number | null;
  total: number | null;
}) {
  const informado =
    presente !== null && presente !== undefined && Number.isFinite(presente) &&
    total !== null && total !== undefined && Number.isFinite(total) && total > 0;
  const pct = informado ? Math.min(100, Math.max(0, ((presente as number) / (total as number)) * 100)) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <span className="text-xs text-texto-suave">{nome}</span>
        <span className="tabular text-right text-sm text-texto">
          {informado
            ? `${numero(presente)} de ${numero(total)}`
            : presente === null || presente === undefined
              ? "não informado"
              : `${numero(presente)} de ${TRACO}`}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-superficie-alta"
        role="img"
        aria-label={`${nome}: ${informado ? `${presente} de ${total}` : "não informado"}`}
      >
        {informado ? (
          <div className="h-full rounded-full bg-marca" style={{ width: `${pct}%` }} />
        ) : null}
      </div>
    </div>
  );
}

function IconeCumpre({ atende }: { atende: boolean | null }) {
  if (atende === null || atende === undefined) {
    return <Minus className="size-4 shrink-0 text-texto-fraco" aria-hidden="true" />;
  }
  return atende ? (
    <Check className="size-4 shrink-0 text-ok" aria-hidden="true" />
  ) : (
    <X className="size-4 shrink-0 text-alta" aria-hidden="true" />
  );
}

function LinhaCriterio({ criterio, reprovado }: { criterio: Criterio; reprovado: boolean }) {
  const alvo =
    criterio.piso === null || criterio.piso === undefined
      ? TRACO
      : criterio.teto
        ? `no máximo ${numero(criterio.piso)}`
        : `mínimo ${numero(criterio.piso)}`;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 rounded-md p-2",
        reprovado && "bg-alta-suave",
      )}
    >
      <IconeCumpre atende={criterio.atende ?? null} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cn("text-sm text-texto", reprovado && "text-alta")}>
          {texto(criterio.nome)}
        </span>
        <span className="tabular text-xs text-texto-suave">
          obtido {texto(criterio.obtido)}
          {criterio.total !== null && criterio.total !== undefined
            ? ` de ${numero(criterio.total)}`
            : ""}
          {" · "}
          {alvo}
          {criterio.atende === null || criterio.atende === undefined ? " · não avaliável" : ""}
        </span>
      </div>
    </div>
  );
}

function Veredito({ extensao }: { extensao: NonNullable<Avaliacao["extensao"]> }) {
  const indeterminado =
    extensao.indeterminado === true ||
    extensao.elegivel === null ||
    extensao.elegivel === undefined;
  const rotulo = indeterminado ? "Indeterminado" : extensao.elegivel ? "Elegível" : "Não elegível";
  const classe = indeterminado
    ? "bg-baixa-suave text-baixa"
    : extensao.elegivel
      ? "bg-ok-suave text-ok"
      : "bg-alta-suave text-alta";

  return (
    <span className={cn("inline-flex w-fit rounded-md px-2 py-1 text-sm font-medium", classe)}>
      {rotulo}
    </span>
  );
}

function nomesReprovados(extensao: NonNullable<Avaliacao["extensao"]>): Set<string> {
  const nomes = new Set<string>();
  for (const r of extensao.reprovados ?? []) {
    if (typeof r === "string") nomes.add(r);
    else if (r && typeof r === "object" && r.nome) nomes.add(r.nome);
  }
  return nomes;
}

function Conteudo({
  aluno,
  avaliacao,
}: {
  aluno: Aluno | null;
  avaliacao: Avaliacao | null;
}) {
  const extensao = avaliacao?.extensao ?? null;
  const reprovados = extensao ? nomesReprovados(extensao) : new Set<string>();
  const naoElegivel = extensao?.elegivel === false;
  const paraRevisar = avaliacao?.fonte?.status === "Para revisar";

  return (
    <div className="flex flex-col gap-secao">
      {/* Ressalva antes do conteúdo: a coordenação lê a limitação da fonte primeiro. */}
      {paraRevisar ? (
        <p role="note" className="rounded-md bg-media-suave px-3 py-2 text-xs text-media">
          Esta avaliação se apoia em regra pendente de revisão.
        </p>
      ) : null}
      <div className="flex flex-col gap-grupo">
        <Rotulo rotulo="ID" valor={aluno ? texto(aluno.alunoId) : TRACO} />
        <Rotulo rotulo="Formação" valor={texto(aluno?.formacao)} />
        <Rotulo rotulo="Turma" valor={aluno?.turma ? aluno.turma : "Sem turma"} />
        <Rotulo rotulo="Jornada" valor={texto(aluno?.jornada)} />
        <Rotulo rotulo="E-mail" valor={texto(aluno?.email)} />
      </div>

      <div className="flex flex-col gap-grupo">
        <h3 className="text-sm font-semibold text-texto">Acesso</h3>
        <Rotulo rotulo="Acesso até" valor={aluno?.acessoAte ? data(aluno.acessoAte) : TRACO} />
        <Rotulo rotulo="Dias restantes" valor={diasEmPalavras(aluno?.diasDeAcesso)} />
        <Rotulo rotulo="Plano" valor={texto(aluno?.plano)} />
      </div>

      <div className="flex flex-col gap-grupo">
        <h3 className="text-sm font-semibold text-texto">Progresso</h3>
        <BarraFase
          nome="CARPA"
          presente={aluno?.carpaPresente ?? null}
          total={aluno?.carpaTotal ?? null}
        />
        <BarraFase
          nome="Pilares"
          presente={aluno?.pilaresPresente ?? null}
          total={aluno?.pilaresTotal ?? null}
        />
        <Rotulo
          rotulo="Teórico"
          valor={
            aluno?.teoricoPct === null || aluno?.teoricoPct === undefined
              ? TRACO
              : `${numero(aluno.teoricoPct)}%`
          }
        />
        <Rotulo rotulo="Módulos faltantes" valor={numero(aluno?.modulosFaltantes ?? null)} />
      </div>

      <div className="flex flex-col gap-grupo">
        <h3 className="text-sm font-semibold text-texto">Avaliação da extensão</h3>
        {extensao?.criterios && extensao.criterios.length > 0 ? (
          extensao.criterios.map((criterio, i) => (
            <LinhaCriterio
              key={`${criterio.nome ?? "criterio"}-${i}`}
              criterio={criterio}
              reprovado={naoElegivel && !!criterio.nome && reprovados.has(criterio.nome)}
            />
          ))
        ) : (
          <p className="text-sm text-texto-suave">Nenhum critério informado.</p>
        )}
        {extensao ? <Veredito extensao={extensao} /> : null}
        <Procedencia fonte={avaliacao?.fonte ?? null} />
        {extensao?.conta ? (
          <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-md bg-superficie-alta p-3">
            <pre className="whitespace-pre font-mono text-xs text-texto">{extensao.conta}</pre>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-grupo">
        <h3 className="text-sm font-semibold text-texto">Certificação</h3>
        <p className="text-sm text-texto-suave">{texto(avaliacao?.certificacao?.motivo)}</p>
        {/* Procedência junto de toda avaliação apoiada no playbook. */}
        <Procedencia fonte={avaliacao?.fonte ?? null} />
      </div>
    </div>
  );
}

function Esqueletos() {
  return (
    <div className="flex flex-col gap-bloco">
      {Array.from({ length: 8 }).map((_, i) => (
        <Esqueleto key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

export function DetalheAluno({
  alunoId,
  aoFechar,
  aoErro,
}: {
  alunoId: number | null;
  aoFechar: () => void;
  aoErro: (erro: unknown) => void;
}) {
  const lateral = useMediaQuery("(min-width: 900px)");

  const consulta = useQuery({
    queryKey: ["aluno", alunoId],
    queryFn: () => api.aluno(alunoId as number),
    enabled: alunoId !== null,
  });

  useEffect(() => {
    if (consulta.isError) aoErro(consulta.error);
  }, [consulta.isError, consulta.error, aoErro]);

  const aluno = consulta.data?.aluno ?? null;
  const titulo = consulta.isLoading ? "Carregando…" : texto(aluno?.nome);

  const corpo = consulta.isLoading ? (
    <Esqueletos />
  ) : consulta.isError ? (
    <ListaComErro
      mensagem={(consulta.error as Error).message}
      aoTentarDeNovo={() => consulta.refetch()}
    />
  ) : (
    <Conteudo aluno={aluno} avaliacao={consulta.data?.avaliacao ?? null} />
  );

  const aberto = alunoId !== null;

  if (lateral) {
    return (
      <Sheet open={aberto} onOpenChange={(v) => (!v ? aoFechar() : undefined)}>
        <SheetContent className="w-full overflow-y-auto bg-superficie sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-texto">{titulo}</SheetTitle>
            <SheetDescription className="text-texto-suave">
              Detalhe do aluno e avaliação da extensão.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-bloco pb-8">{corpo}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={aberto} onOpenChange={(v) => (!v ? aoFechar() : undefined)}>
      <DrawerContent className="max-h-[90vh] bg-superficie">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-texto">{titulo}</DrawerTitle>
          <DrawerDescription className="text-texto-suave">
            Detalhe do aluno e avaliação da extensão.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-8">{corpo}</div>
      </DrawerContent>
    </Drawer>
  );
}
