/**
 * Cliente REST do Notion.
 *
 * Escrito à mão em vez de usar @notionhq/client por um motivo específico: a
 * mesma conversão de propriedades precisa rodar na Edge Function (Deno), e uma
 * dependência npm a menos é um caminho a menos para divergir entre os dois
 * runtimes. São ~150 linhas contra uma dependência transitiva inteira.
 *
 * Versão da API fixada. Notion versiona por header, e deixar sem fixar
 * significa aceitar mudança de contrato em deploy que ninguém fez.
 */

const VERSAO_API = '2022-06-28'
const BASE = 'https://api.notion.com/v1'

export class Notion {
  constructor(token) {
    if (!token) throw new Error('Token do Notion ausente.')
    this.token = token
  }

  async req(caminho, { metodo = 'GET', corpo } = {}) {
    const r = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': VERSAO_API,
        'Content-Type': 'application/json',
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })

    if (!r.ok) {
      const detalhe = await r.text()
      // O corpo do erro do Notion nomeia a propriedade que falhou. Engolir isso
      // e lançar só o status transforma "nome de coluna errado" em meia hora de
      // depuração.
      throw new Error(`Notion ${metodo} ${caminho} => ${r.status}\n${detalhe}`)
    }
    return r.json()
  }

  /**
   * Percorre TODAS as páginas de um database.
   *
   * A paginação não é opcional: o Notion devolve no máximo 100 por vez, e a
   * base de alunos já nasce com 40. Uma varredura que só lê a primeira página
   * silenciosamente deixa de gerar alerta para quem está na segunda.
   */
  async consultarTudo(databaseId, filtro) {
    const itens = []
    let cursor
    do {
      const pagina = await this.req(`/databases/${databaseId}/query`, {
        metodo: 'POST',
        corpo: { page_size: 100, ...(cursor && { start_cursor: cursor }), ...(filtro && { filter: filtro }) },
      })
      itens.push(...pagina.results)
      cursor = pagina.has_more ? pagina.next_cursor : null
    } while (cursor)
    return itens
  }

  criarPagina(databaseId, propriedades, filhos) {
    return this.req('/pages', {
      metodo: 'POST',
      corpo: {
        parent: { database_id: databaseId },
        properties: propriedades,
        ...(filhos && { children: filhos }),
      },
    })
  }

  atualizarPagina(pageId, propriedades) {
    return this.req(`/pages/${pageId}`, { metodo: 'PATCH', corpo: { properties: propriedades } })
  }

  arquivarPagina(pageId) {
    return this.req(`/pages/${pageId}`, { metodo: 'PATCH', corpo: { archived: true } })
  }

  lerBlocos(pageId) {
    return this.req(`/blocks/${pageId}/children?page_size=100`)
  }
}

// ─── conversão de propriedades ────────────────────────────────────────
// Notion representa cada tipo de propriedade com uma forma diferente. Estas
// duas funções são o único lugar do projeto que conhece essas formas.

/** Valor JS -> propriedade do Notion. `null` limpa o campo. */
export const prop = {
  titulo: (v) => ({ title: v == null ? [] : [{ text: { content: String(v) } }] }),
  texto: (v) => ({ rich_text: v == null ? [] : [{ text: { content: recortar(String(v)) } }] }),
  numero: (v) => ({ number: v == null ? null : Number(v) }),
  select: (v) => ({ select: v == null ? null : { name: String(v) } }),
  status: (v) => ({ status: v == null ? null : { name: String(v) } }),
  data: (v) => ({ date: v == null ? null : { start: v } }),
  checkbox: (v) => ({ checkbox: Boolean(v) }),
  email: (v) => ({ email: v == null ? null : String(v) }),
  relacao: (ids) => ({ relation: (ids ?? []).filter(Boolean).map((id) => ({ id })) }),
  pessoas: (ids) => ({ people: (ids ?? []).filter(Boolean).map((id) => ({ id })) }),
}

/**
 * Rich text no Notion tem teto de 2000 caracteres por bloco de texto.
 * Estourar devolve 400 com mensagem genérica, e o texto que estoura é sempre o
 * gerado pelo modelo — ou seja, falha em produção, nunca em teste.
 */
function recortar(s, max = 1900) {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

/** Propriedade do Notion -> valor JS. Devolve `null` para campo vazio. */
export function ler(pagina, nome) {
  const p = pagina.properties?.[nome]
  if (!p) return null

  switch (p.type) {
    case 'title':
    case 'rich_text': {
      const t = p[p.type].map((x) => x.plain_text).join('')
      return t === '' ? null : t
    }
    case 'number':
      return p.number
    case 'select':
      return p.select?.name ?? null
    case 'status':
      return p.status?.name ?? null
    case 'date':
      return p.date?.start ?? null
    case 'checkbox':
      return p.checkbox
    case 'email':
      return p.email ?? null
    case 'created_time':
      return p.created_time
    case 'relation':
      return p.relation.map((r) => r.id)
    case 'people':
      return p.people.map((u) => u.id)
    default:
      return null
  }
}

/** Concatena o texto do corpo de uma página, para ler a regra completa. */
export function textoDosBlocos(blocos) {
  return (blocos.results ?? [])
    .map((b) => {
      const conteudo = b[b.type]
      if (!conteudo?.rich_text) return ''
      return conteudo.rich_text.map((t) => t.plain_text).join('')
    })
    .filter(Boolean)
    .join('\n')
}
