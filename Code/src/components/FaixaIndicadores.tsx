import { cn } from "@/lib/utils";
import { numero } from "@/lib/formato";
import { Cartao, Esqueleto } from "./comuns";
import type { Indicadores } from "@/lib/tipos";

function CardIndicador({
  rotulo,
  valor,
  className,
}: {
  rotulo: string;
  valor: string;
  className?: string;
}) {
  return (
    <Cartao className="p-4">
      <p className="text-xs text-texto-suave">{rotulo}</p>
      <p className={cn("tabular mt-2 text-2xl font-semibold text-texto", className)}>{valor}</p>
    </Cartao>
  );
}

export function FaixaIndicadores({
  indicadores,
  carregando,
}: {
  indicadores?: Indicadores | null;
  carregando: boolean;
}) {
  if (carregando) {
    return (
      <div className="faixa-indicadores">
        {Array.from({ length: 6 }).map((_, i) => (
          <Cartao key={i} className="p-4">
            <Esqueleto className="h-4 w-24" />
            <Esqueleto className="mt-2 h-8 w-16" />
          </Cartao>
        ))}
      </div>
    );
  }

  const i = indicadores ?? null;
  const ativos = numero(i?.alunosAtivos ?? null);
  const total = numero(i?.alunosTotal ?? null);
  const altos = i?.alertasAltos ?? null;

  return (
    <div className="faixa-indicadores">
      {/* alunosTotal não ganha card próprio: aparece como denominador. */}
      <CardIndicador rotulo="Alunos ativos" valor={`${ativos} de ${total}`} />
      <CardIndicador rotulo="Acesso vencendo (30d)" valor={numero(i?.acessoVencendo ?? null)} />
      <CardIndicador rotulo="Acesso vencido" valor={numero(i?.acessoVencido ?? null)} />
      <CardIndicador rotulo="Sem turma" valor={numero(i?.semTurma ?? null)} />
      <CardIndicador rotulo="Alertas abertos" valor={numero(i?.alertasAbertos ?? null)} />
      <CardIndicador
        rotulo="Alertas de severidade alta"
        valor={numero(altos)}
        className={altos !== null && altos > 0 ? "text-alta" : "text-texto"}
      />
    </div>
  );
}
