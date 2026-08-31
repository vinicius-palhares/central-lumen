export type Severidade = "Alta" | "Média" | "Baixa";
export type StatusAlerta = "Não iniciada" | "Em andamento" | "Concluído";

export interface Fonte {
  titulo: string | null;
  categoria?: string | null;
  status: string | null;
  confianca: string | null;
}

export interface Indicadores {
  alunosAtivos: number | null;
  alunosTotal: number | null;
  acessoVencendo: number | null;
  acessoVencido: number | null;
  semTurma: number | null;
  alertasAbertos: number | null;
  alertasAltos: number | null;
}

export interface RespostaResumo {
  perfil: string | null;
  indicadores: Indicadores | null;
  alertasPorTipo: Record<string, number> | null;
  playbook: Fonte[] | null;
}

export interface Alerta {
  id: string | number;
  titulo: string | null;
  tipo: string | null;
  severidade: Severidade | null;
  status: StatusAlerta | null;
  prazo: string | null;
  leitura: string | null;
  conta: string | null;
  geradoEm: string | null;
  url: string | null;
}

export interface RespostaAlertas {
  alertas: Alerta[] | null;
}

export interface Aluno {
  alunoId: number;
  nome: string | null;
  email: string | null;
  jornada: string | null;
  formacao: string | null;
  turma: string | null;
  turmaNumero: number | null;
  teoricoPct: number | null;
  modulosFaltantes: number | null;
  carpaPresente: number | null;
  carpaTotal: number | null;
  pilaresPresente: number | null;
  pilaresTotal: number | null;
  plano: string | null;
  acessoAte: string | null;
  certificado: string | null;
  diasDeAcesso: number | null;
}

export interface RespostaAlunos {
  alunos: Aluno[] | null;
}

export interface Criterio {
  nome: string | null;
  obtido: number | string | null;
  piso: number | null;
  total: number | null;
  atende: boolean | null;
  teto: boolean | null;
}

export interface Avaliacao {
  extensao: {
    elegivel: boolean | null;
    indeterminado?: boolean | null;
    conta: string | null;
    criterios: Criterio[] | null;
    reprovados: (string | Criterio)[] | null;
  } | null;
  certificacao: { bloqueada: boolean | null; motivo: string | null } | null;
  fonte: Fonte | null;
}

export interface RespostaAluno {
  aluno: Aluno | null;
  avaliacao: Avaliacao | null;
}

export interface RespostaPerguntar {
  resposta: string | null;
  fonte: Fonte | null;
}
