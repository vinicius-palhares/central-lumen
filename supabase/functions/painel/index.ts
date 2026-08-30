/**
 * API do painel.
 *
 * É a única porta entre o navegador e as duas APIs integradas. Esse
 * estrangulamento é a decisão de segurança central do projeto:
 *
 *   - O token do Notion e a chave do Gemini vivem só aqui, como segredo da
 *     Edge Function. O navegador nunca os vê. Um front-end que falasse direto
 *     com a API do Notion precisaria embarcar o token no bundle, e bundle é
 *     público por definição.
 *   - Toda requisição carrega um JWT do Supabase Auth, validado no servidor.
 *     Autenticação é condição necessária; a autorização vem da tabela `perfis`.
 *   - Toda consulta a dado de aluno é registrada em `acessos`.
 *
 * Deploy:
 *   npx supabase functions deploy painel --project-ref <ref>
 *
 * Segredos, configurados no painel do Supabase em Edge Functions:
 *   NOTION_TOKEN, GEMINI_API_KEY, GEMINI_MODEL
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Notion, ler, textoDosBlocos } from '../_shared/notion.mjs'
import { avaliarExtensao, avaliarCertificacao, diasDeAcesso } from '../_shared/regras.mjs'

const BASES = {
  alunos: 'faea7225-c555-4199-b414-02f9baf7dd36',
  playbook: '61c60ce5-cd2a-4445-9b76-ccbc1ffa3d4b',
  alertas: '20f8a59d-97c7-42b1-bb00-47deeb868427',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash'
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!

const notion = new Notion(Deno.env.get('NOTION_TOKEN')!)
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ─── autenticação ────────────────────────────────────────────────
    const auth = req.headers.get('Authorization') ?? ''
    const usuario = await autenticar(auth)
    if (!usuario) return json({ erro: 'Não autenticado.' }, 401)

    const { data: perfil } = await admin
      .from('perfis')
      .select('nome, liberado')
      .eq('id', usuario.id)
      .maybeSingle()

    // Autenticado e não liberado é 403, não 401: a credencial é válida, o
    // acesso é que não foi concedido. Devolver 401 mandaria o cliente para a
    // tela de login num laço que nunca resolve.
    if (!perfil?.liberado) {
      return json({ erro: 'Perfil ainda não liberado pela coordenação.' }, 403)
    }

    const { acao, ...args } = await req.json()

    const rotas: Record<string, () => Promise<unknown>> = {
      resumo: () => resumo(),
      alunos: () => listarAlunos(args),
      aluno: () => detalharAluno(args),
      alertas: () => listarAlertas(),
      perguntar: () => perguntar(args),
    }

    const rota = rotas[acao]
    if (!rota) return json({ erro: `Ação desconhecida: ${acao}` }, 400)

    const resultado = await rota()

    // Auditoria depois do sucesso. Registrar antes produziria log de consulta
    // que falhou, e "quem viu o quê" deixaria de ser verdade.
    await admin.from('acessos').insert({
      usuario_id: usuario.id,
      acao,
      detalhe: args.alunoId ? { alunoId: args.alunoId } : null,
    })

    return json({ perfil: perfil.nome, ...(resultado as object) })
  } catch (e) {
    console.error(e)
    // Mensagem genérica ao cliente. O detalhe do erro do Notion nomeia
    // propriedades e IDs internos, e não é informação que o navegador precisa.
    return json({ erro: 'Falha ao processar a requisição.' }, 500)
  }
})

async function autenticar(cabecalho: string) {
  if (!cabecalho.startsWith('Bearer ')) return null
  const cliente = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: cabecalho } },
    auth: { persistSession: false },
  })
  const { data, error } = await cliente.auth.getUser()
  return error ? null : data.user
}

// ─── leitura das bases ────────────────────────────────────────────────

/**
 * Cache em memória do Playbook.
 *
 * A Edge Function é reciclada com frequência, então isto não é cache
 * duradouro — é economia dentro de uma mesma instância quente. O TTL curto é
 * deliberado: a promessa do projeto é que editar a regra no Notion muda o
 * comportamento sem deploy, e um cache longo transformaria "sem deploy" em
 * "sem deploy, mas espere uma hora".
 */
let playbookCache: { em: number; dados: Regra[] } | null = null
const TTL_MS = 60_000

interface Regra {
  id: string
  titulo: string
  categoria: string
  status: string
  confianca: string
  texto: string
}

async function lerPlaybook(): Promise<Regra[]> {
  if (playbookCache && Date.now() - playbookCache.em < TTL_MS) return playbookCache.dados

  const paginas = await notion.consultarTudo(BASES.playbook, {
    property: 'Ativa',
    checkbox: { equals: true },
  })

  const dados: Regra[] = []
  for (const p of paginas) {
    dados.push({
      id: p.id,
      titulo: ler(p, 'Regra'),
      categoria: ler(p, 'Categoria'),
      status: ler(p, 'Status de revisão'),
      confianca: ler(p, 'Confiança'),
      texto: textoDosBlocos(await notion.lerBlocos(p.id)),
    })
  }

  playbookCache = { em: Date.now(), dados }
  return dados
}

function mapearAluno(p: Record<string, unknown>) {
  return {
    pageId: p.id,
    alunoId: ler(p, 'Aluno ID'),
    nome: ler(p, 'Nome'),
    email: ler(p, 'E-mail'),
    jornada: ler(p, 'Jornada'),
    formacao: ler(p, 'Formação'),
    turma: ler(p, 'Turma'),
    turmaNumero: ler(p, 'Turma nº'),
    teoricoPct: ler(p, 'Teórico %'),
    modulosFaltantes: ler(p, 'Módulos faltantes'),
    carpaPresente: ler(p, 'CARPA presente'),
    carpaTotal: ler(p, 'CARPA total'),
    pilaresPresente: ler(p, 'Pilares presente'),
    pilaresTotal: ler(p, 'Pilares total'),
    plano: ler(p, 'Plano de acompanhamento'),
    acessoAte: ler(p, 'Acesso até'),
    certificado: ler(p, 'Certificado'),
    diasDeAcesso: diasDeAcesso(ler(p, 'Acesso até')),
  }
}

// ─── ações ────────────────────────────────────────────────────────────

async function resumo() {
  const [paginasAluno, paginasAlerta, playbook] = await Promise.all([
    notion.consultarTudo(BASES.alunos),
    notion.consultarTudo(BASES.alertas),
    lerPlaybook(),
  ])

  const alunos = paginasAluno.map(mapearAluno)
  const ativos = alunos.filter(
    (a) => !['Churn', 'Abandonou', 'Reembolsado'].includes(a.jornada as string),
  )

  const alertas = paginasAlerta.map((p) => ({
    severidade: ler(p, 'Severidade'),
    status: ler(p, 'Status'),
    tipo: ler(p, 'Tipo'),
  }))
  const abertos = alertas.filter((a) => a.status !== 'Concluído')

  return {
    indicadores: {
      alunosAtivos: ativos.length,
      alunosTotal: alunos.length,
      // Só conta quem tem data. Aluno sem turma não está "não vencendo" —
      // ele está fora da pergunta, e somá-lo ao denominador mente sobre a base.
      acessoVencendo: alunos.filter(
        (a) => a.diasDeAcesso !== null && a.diasDeAcesso >= 0 && a.diasDeAcesso <= 30,
      ).length,
      acessoVencido: alunos.filter((a) => a.diasDeAcesso !== null && a.diasDeAcesso < 0).length,
      semTurma: alunos.filter((a) => !a.turma).length,
      alertasAbertos: abertos.length,
      alertasAltos: abertos.filter((a) => a.severidade === 'Alta').length,
    },
    alertasPorTipo: contar(abertos.map((a) => a.tipo as string)),
    playbook: playbook.map((r) => ({
      titulo: r.titulo,
      categoria: r.categoria,
      status: r.status,
      confianca: r.confianca,
    })),
  }
}

async function listarAlunos({ busca, jornada }: { busca?: string; jornada?: string }) {
  const paginas = await notion.consultarTudo(BASES.alunos)
  let alunos = paginas.map(mapearAluno)

  // Filtro em memória, não no Notion. A base tem 40 registros e cabe numa
  // resposta; empurrar o filtro para a API custaria uma ida extra por
  // tecla digitada, e o Notion cobra latência, não o cliente.
  if (jornada) alunos = alunos.filter((a) => a.jornada === jornada)
  if (busca) {
    const q = normalizar(busca)
    alunos = alunos.filter(
      (a) => normalizar(String(a.nome ?? '')).includes(q) || String(a.alunoId ?? '').includes(q),
    )
  }

  alunos.sort((a, b) => ordemDeUrgencia(a) - ordemDeUrgencia(b))
  return { alunos }
}

/** Vencendo primeiro, vencido depois, sem data por último. */
function ordemDeUrgencia(a: { diasDeAcesso: number | null }) {
  if (a.diasDeAcesso === null) return 1e6
  return a.diasDeAcesso < 0 ? 1e5 - a.diasDeAcesso : a.diasDeAcesso
}

async function detalharAluno({ alunoId }: { alunoId: number }) {
  const paginas = await notion.consultarTudo(BASES.alunos, {
    property: 'Aluno ID',
    number: { equals: Number(alunoId) },
  })
  if (!paginas.length) return { erro: 'Aluno não encontrado.' }

  const aluno = mapearAluno(paginas[0])
  const playbook = await lerPlaybook()
  const regraAcesso = playbook.find((r) => r.categoria === 'Acesso e prazo')

  // A regra é aplicada AGORA, na leitura, e não lida de um campo gravado.
  // Editar a regra no Notion muda esta resposta na requisição seguinte.
  const extensao = regraAcesso ? avaliarExtensao(aluno, regraAcesso.texto) : null
  const certificacao = avaliarCertificacao(aluno)

  return {
    aluno,
    avaliacao: {
      extensao,
      certificacao,
      fonte: regraAcesso
        ? { titulo: regraAcesso.titulo, status: regraAcesso.status, confianca: regraAcesso.confianca }
        : null,
    },
  }
}

async function listarAlertas() {
  const paginas = await notion.consultarTudo(BASES.alertas)
  const alertas = paginas
    .map((p) => ({
      id: p.id,
      titulo: ler(p, 'Alerta'),
      tipo: ler(p, 'Tipo'),
      severidade: ler(p, 'Severidade'),
      status: ler(p, 'Status'),
      prazo: ler(p, 'Prazo'),
      leitura: ler(p, 'Leitura da coordenação'),
      conta: ler(p, 'Conta que sustenta'),
      geradoEm: ler(p, 'Gerado em'),
      url: (p as { url?: string }).url,
    }))
    .sort((a, b) => peso(a.severidade as string) - peso(b.severidade as string))

  return { alertas }
}

const peso = (s: string) => ({ Alta: 0, Média: 1, Baixa: 2 }[s] ?? 3)

/**
 * Pergunta em linguagem natural sobre o Playbook.
 *
 * Sem busca vetorial. O Playbook tem cinco regras e cabe inteiro no prompt, e
 * a recuperação por embeddings a esta escala só adiciona um passo que pode
 * errar. Se o Playbook crescer para além do que cabe na janela, aí sim a
 * recuperação passa a valer o custo.
 *
 * A confiança devolvida vem do status de revisão da regra citada, não de uma
 * autoavaliação do modelo. Modelo perguntado sobre a própria confiança responde
 * o que soa bem.
 */
async function perguntar({ texto }: { texto: string }) {
  if (!texto?.trim()) return { erro: 'Pergunta vazia.' }

  const playbook = await lerPlaybook()
  const contexto = playbook
    .map((r) => `### ${r.titulo}\n(categoria: ${r.categoria} | revisão: ${r.status})\n${r.texto}`)
    .join('\n\n')

  const prompt = [
    'Você responde dúvidas da coordenação de uma escola, usando SOMENTE o playbook abaixo.',
    '',
    '=== PLAYBOOK ===',
    contexto,
    '=== FIM DO PLAYBOOK ===',
    '',
    `PERGUNTA: ${texto}`,
    '',
    'Regras da resposta:',
    '- Use apenas o que está no playbook. Não complete com conhecimento geral.',
    '- Se o playbook não cobre a pergunta, diga exatamente que não há fonte para',
    '  responder e encaminhe ao canal oficial. Não estime, não aproxime.',
    '- Nunca estime valores, preços ou prazos contratuais.',
    '- Ao citar um requisito com números, reproduza os números do playbook.',
    '- Não some nem faça média de mentorias de fases diferentes: os pisos são',
    '  independentes.',
    '',
    'Responda em JSON, sem cerca de código:',
    '{"resposta": "...", "regraCitada": "título exato da regra usada, ou null"}',
  ].join('\n')

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
        },
      }),
    },
  )
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`)

  const j = await r.json()
  const bruto = j.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('') ?? ''

  let saida: { resposta?: string; regraCitada?: string | null }
  try {
    saida = JSON.parse(bruto)
  } catch {
    // JSON malformado não pode virar 500: o usuário perguntou algo legítimo.
    // Devolve o texto cru e marca a fonte como desconhecida, que é honesto.
    saida = { resposta: bruto.trim(), regraCitada: null }
  }

  const regra = playbook.find((x) => x.titulo === saida.regraCitada)

  return {
    resposta: saida.resposta ?? '',
    fonte: regra
      ? { titulo: regra.titulo, categoria: regra.categoria, status: regra.status, confianca: regra.confianca }
      : null,
  }
}

// ─── utilitários ──────────────────────────────────────────────────────

function contar(itens: string[]) {
  const m: Record<string, number> = {}
  for (const i of itens) if (i) m[i] = (m[i] ?? 0) + 1
  return m
}

function normalizar(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
