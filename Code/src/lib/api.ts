import { ENDPOINT_PAINEL, SUPABASE_PUBLISHABLE_KEY, supabase } from "./supabase";
import type {
  RespostaAluno,
  RespostaAlunos,
  RespostaAlertas,
  RespostaPerguntar,
  RespostaResumo,
} from "./tipos";

export class ErroApi extends Error {
  status: number;
  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = status;
  }
}

/** Verdadeiro quando o erro é o 403 de perfil não liberado pela coordenação. */
export function ehBloqueio(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 403;
}

export function ehNaoAutorizado(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 401;
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new ErroApi("Sessão expirada.", 401);
  }

  let resposta: Response;
  try {
    resposta = await fetch(ENDPOINT_PAINEL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi("Não foi possível falar com o servidor.", 0);
  }

  if (resposta.status === 401) {
    // Credencial inválida: derruba a sessão. A rota protegida leva ao /login.
    await supabase.auth.signOut();
    throw new ErroApi("Sessão encerrada.", 401);
  }

  if (resposta.status === 403) {
    throw new ErroApi("Perfil ainda não liberado pela coordenação.", 403);
  }

  if (!resposta.ok) {
    let mensagem = `O servidor respondeu com erro ${resposta.status}.`;
    try {
      const json = (await resposta.json()) as { error?: string; message?: string };
      if (json?.error || json?.message) mensagem = String(json.error ?? json.message);
    } catch {
      /* corpo não é JSON; mantém a mensagem padrão */
    }
    throw new ErroApi(mensagem, resposta.status);
  }

  return (await resposta.json()) as T;
}

export const api = {
  resumo: () => chamar<RespostaResumo>({ acao: "resumo" }),
  alertas: () => chamar<RespostaAlertas>({ acao: "alertas" }),
  alunos: (busca: string, jornada: string | null = null) =>
    chamar<RespostaAlunos>({ acao: "alunos", busca, jornada }),
  aluno: (alunoId: number) => chamar<RespostaAluno>({ acao: "aluno", alunoId }),
  perguntar: (texto: string) => chamar<RespostaPerguntar>({ acao: "perguntar", texto }),
};
