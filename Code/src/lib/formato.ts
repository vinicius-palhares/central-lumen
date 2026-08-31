export const TRACO = "—";

/** Nunca renderiza "null", "NaN" ou "0" no lugar de vazio. */
export function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return TRACO;
  if (typeof valor === "number") return Number.isFinite(valor) ? String(valor) : TRACO;
  const s = String(valor).trim();
  if (s === "" || s === "null" || s === "undefined" || s === "NaN") return TRACO;
  return s;
}

export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return TRACO;
  return valor.toLocaleString("pt-BR");
}

export function data(valor: string | null | undefined): string {
  if (!valor) return TRACO;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return texto(valor);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Cor de estado do prazo de acesso, conforme dias restantes. */
export function corDoPrazo(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || !Number.isFinite(dias)) return "text-texto-fraco";
  if (dias < 0 || dias <= 7) return "text-alta";
  if (dias <= 30) return "text-media";
  return "text-texto-suave";
}

export function diasEmPalavras(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || !Number.isFinite(dias)) return TRACO;
  if (dias < 0) return `vencido há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "vence hoje";
  return `${dias} ${dias === 1 ? "dia" : "dias"} restantes`;
}

export function classeSeveridade(severidade: string | null | undefined) {
  switch (severidade) {
    case "Alta":
      return { barra: "bg-alta", chip: "bg-alta-suave text-alta", texto: "text-alta" };
    case "Média":
      return { barra: "bg-media", chip: "bg-media-suave text-media", texto: "text-media" };
    default:
      return { barra: "bg-baixa", chip: "bg-baixa-suave text-baixa", texto: "text-baixa" };
  }
}

export function classeConfianca(confianca: string | null | undefined) {
  if (confianca === "Alta") return "bg-superficie-alta text-confianca-alta";
  if (confianca === "Média") return "bg-superficie-alta text-confianca-media";
  return "bg-superficie-alta text-texto-fraco";
}

/**
 * Traduz o erro do Supabase Auth para uma instrução em português.
 *
 * O cliente do Supabase devolve mensagens em inglês ("Invalid login
 * credentials"). Repassá-las cruas numa interface em português falha duas
 * vezes: o texto está no idioma errado, e ele descreve o problema sem dizer o
 * que fazer. Um erro de interface é uma instrução.
 *
 * O que não estiver mapeado cai num texto genérico com um próximo passo, nunca
 * na mensagem original — que pode citar detalhe interno do provedor.
 */
export function erroDeLogin(mensagem: string): string {
  const m = mensagem.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dois e tente de novo.";
  }
  if (m.includes("email not confirmed")) {
    return "Este e-mail ainda não foi confirmado. Peça a confirmação à coordenação.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Tentativas demais em pouco tempo. Espere um minuto e tente de novo.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Não foi possível conectar. Verifique sua conexão e tente de novo.";
  }
  if (m.includes("user not found")) {
    // Não confirmar se o e-mail existe: a mesma resposta de credencial inválida.
    return "E-mail ou senha incorretos. Confira os dois e tente de novo.";
  }
  return "Não foi possível entrar. Tente de novo em alguns instantes.";
}
