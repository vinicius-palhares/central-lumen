/**
 * A automação da Central.
 *
 * Percorre a base de alunos, aplica as regras do Playbook, e abre um alerta no
 * Notion para cada situação que exige ação da coordenação.
 *
 * O desenho em uma frase: **a regra vem do Notion, a conta é feita em código, e
 * o modelo só redige.** Nenhuma das três camadas faz o trabalho da outra.
 *
 *   Notion (Playbook)  ->  texto da regra, com os limiares embutidos
 *   scripts/regras.mjs ->  aritmética dos pisos, e o rastro literal da conta
 *   Gemini             ->  redação da leitura para a coordenação
 *   Notion (Alertas)   ->  registro acionável, com responsável atribuído
 *
 * Por que o modelo não decide: se o Gemini avaliasse a elegibilidade, duas
 * execuções sobre o mesmo aluno poderiam divergir, e não haveria como auditar
 * qual das duas estava certa. A decisão é determinística e fica gravada no campo
 * "Conta que sustenta". A leitura gerada aparece ao lado, e qualquer divergência
 * entre as duas é visível na mesma tela.
 *
 * Por que não existe envio de e-mail: o Notion notifica nativamente quem está
 * no campo Responsável. Construir um canal de envio próprio adicionaria um
 * serviço, uma credencial e uma fila de retentativa para reproduzir o que a
 * ferramenta já faz — e criaria um segundo lugar onde dado de aluno trafega.
 *
 *   node scripts/varredura.mjs [--secar] [--limite N]
 *
 *   --secar     avalia e imprime, sem criar alerta e sem chamar o Gemini.
 *   --limite N  processa só os N primeiros alunos. Para depuração.
 */

import { Notion, prop, ler, textoDosBlocos } from '../supabase/functions/_shared/notion.mjs'
import { BASES, carregarEnv, exigir } from './config.mjs'
import { avaliarExtensao, avaliarCertificacao, diasDeAcesso } from '../supabase/functions/_shared/regras.mjs'

const JANELA_DIAS = 30
const SECAR = process.argv.includes('--secar')
const LIMITE = Number(process.argv[process.argv.indexOf('--limite') + 1]) || Infinity

await carregarEnv()
const { NOTION_TOKEN } = exigir('NOTION_TOKEN')
const GEMINI_KEY = process.env.GEMINI_API_KEY
const MODELO = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'
const RESPONSAVEL = process.env.NOTION_RESPONSAVEL_ID

if (!SECAR && !GEMINI_KEY) {
  console.error('Falta GEMINI_API_KEY. Use --secar para rodar só a avaliação.')
  process.exit(1)
}
if (!SECAR && !RESPONSAVEL) {
  console.warn(
    'AVISO: NOTION_RESPONSAVEL_ID não definido.\n' +
      'Os alertas serão criados sem responsável, e o Notion NÃO vai notificar ninguém.\n',
  )
}

const notion = new Notion(NOTION_TOKEN)
const HOJE = new Date()
const CICLO = HOJE.toISOString().slice(0, 7) // YYYY-MM

// ─── 1. Playbook ──────────────────────────────────────────────────────

console.log('Lendo o Playbook...')
const paginasRegra = await notion.consultarTudo(BASES.playbook, {
  property: 'Ativa',
  checkbox: { equals: true },
})

const regras = {}
for (const p of paginasRegra) {
  const categoria = ler(p, 'Categoria')
  const texto = textoDosBlocos(await notion.lerBlocos(p.id))
  regras[categoria] = {
    id: p.id,
    titulo: ler(p, 'Regra'),
    categoria,
    status: ler(p, 'Status de revisão'),
    confianca: ler(p, 'Confiança'),
    texto,
  }
  console.log(`  ${categoria}: "${ler(p, 'Regra')}" [${ler(p, 'Confiança')}]`)
}

const regraAcesso = regras['Acesso e prazo']
const regraCertificacao = regras['Certificação']
const regraDesengajamento = regras['Onboarding']

if (!regraAcesso) {
  console.error('\nRegra de "Acesso e prazo" ausente ou inativa no Playbook. Nada a avaliar.')
  process.exit(1)
}

// ─── 2. Alunos ────────────────────────────────────────────────────────

console.log('\nLendo a base de alunos...')
const paginas = await notion.consultarTudo(BASES.alunos)
console.log(`  ${paginas.length} registros.`)

const alunos = paginas.slice(0, LIMITE).map((p) => ({
  pageId: p.id,
  alunoId: ler(p, 'Aluno ID'),
  nome: ler(p, 'Nome'),
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
}))

// ─── 3. Deduplicação ──────────────────────────────────────────────────
// Sem isto, uma varredura diária reabre o mesmo alerta todo dia e a coordenação
// para de olhar a base. A chave é aluno + tipo + ciclo mensal.

const abertos = await notion.consultarTudo(BASES.alertas)
const jaExiste = new Set(abertos.map((p) => ler(p, 'Chave de deduplicação')).filter(Boolean))
console.log(`  ${abertos.length} alertas já registrados.`)

// ─── 4. Avaliação ─────────────────────────────────────────────────────

const achados = []

for (const a of alunos) {
  const dias = diasDeAcesso(a.acessoAte, HOJE)

  // Jornadas encerradas não geram alerta. Cobrar plano de acompanhamento de
  // quem pediu reembolso é ruído que faz a coordenação ignorar a base inteira.
  const encerrada = ['Churn', 'Abandonou', 'Reembolsado', 'Certificado'].includes(a.jornada)
  if (encerrada) continue

  // 4a. Acesso vencendo, e a decisão sobre a extensão.
  if (dias !== null && dias >= 0 && dias <= JANELA_DIAS) {
    const v = avaliarExtensao(a, regraAcesso.texto)

    const tipo = v.elegivel === null
      ? 'Acesso vencendo'
      : v.elegivel
        ? 'Elegível a extensão'
        : 'Extensão negada'

    achados.push({
      aluno: a,
      regra: regraAcesso,
      tipo,
      // Vencendo em uma semana é alta; o resto da janela é média.
      severidade: dias <= 7 ? 'Alta' : 'Média',
      prazo: a.acessoAte,
      conta: `Acesso encerra em ${dias} dia(s), em ${a.acessoAte}.\n\n${v.conta}`,
      contexto:
        `O acesso do aluno encerra em ${dias} dia(s). ` +
        (v.elegivel === null
          ? 'Não há dados de presença suficientes para avaliar a extensão.'
          : v.elegivel
            ? 'Ele cumpre todos os critérios da extensão de 30 dias.'
            : `Ele NÃO cumpre: ${v.reprovados.map((c) => c.nome).join(' e ')}.`),
    })
  }

  // 4b. Certificação bloqueada pelo plano de acompanhamento.
  if (regraCertificacao && a.teoricoPct === 100 && a.certificado === 'Não qualificado') {
    const c = avaliarCertificacao(a)
    if (c.bloqueada) {
      achados.push({
        aluno: a,
        regra: regraCertificacao,
        tipo: 'Certificação bloqueada',
        severidade: 'Alta',
        prazo: null,
        conta: `Teórico em 100%, certificado consta "Não qualificado".\n${c.motivo}`,
        contexto: `Conteúdo teórico concluído, mas a certificação está bloqueada. ${c.motivo}`,
      })
    }
  }

  // 4c. Desengajamento. A regra está "Para revisar", e isso precisa aparecer
  // no alerta — não pode ser tratada com a mesma autoridade das demais.
  if (regraDesengajamento && a.turma && a.teoricoPct != null && a.teoricoPct < 40) {
    if (dias !== null && dias > JANELA_DIAS && dias < 180) {
      achados.push({
        aluno: a,
        regra: regraDesengajamento,
        tipo: 'Desengajamento',
        severidade: 'Baixa',
        prazo: null,
        conta:
          `Teórico em ${a.teoricoPct}%, abaixo do limiar de 40%.\n` +
          `Restam ${dias} dias de acesso.\n` +
          `ATENÇÃO: regra "${regraDesengajamento.titulo}" está ${regraDesengajamento.status}, ` +
          `confiança ${regraDesengajamento.confianca}.`,
        contexto:
          `Progresso teórico em ${a.teoricoPct}% com ${dias} dias de acesso restantes. ` +
          'A regra que sustenta este alerta está pendente de revisão.',
      })
    }
  }
}

// ─── 5. Filtro de duplicatas ──────────────────────────────────────────

const novos = achados.filter((f) => {
  f.chave = `${f.aluno.alunoId}:${f.tipo}:${CICLO}`
  return !jaExiste.has(f.chave)
})

console.log(`\n${achados.length} situações detectadas, ${novos.length} novas neste ciclo (${CICLO}).`)

const porTipo = {}
for (const f of novos) porTipo[f.tipo] = (porTipo[f.tipo] ?? 0) + 1
for (const [tipo, n] of Object.entries(porTipo)) console.log(`  ${tipo}: ${n}`)

if (SECAR) {
  console.log('\n--secar: detalhamento das primeiras 5 situações\n')
  for (const f of novos.slice(0, 5)) {
    console.log(`─ ${f.aluno.alunoId} ${f.aluno.nome} — ${f.tipo} [${f.severidade}]`)
    console.log(`${f.conta}\n`)
  }
  console.log('Nada foi gravado no Notion e o Gemini não foi chamado.')
  process.exit(0)
}

// ─── 6. Redação e gravação ────────────────────────────────────────────

console.log('\nGerando leituras e abrindo alertas...')
let criados = 0

for (const f of novos) {
  const leitura = await redigir(f)

  await notion.criarPagina(
    BASES.alertas,
    {
      'Alerta': prop.titulo(`${f.aluno.nome} — ${f.tipo}`),
      'Aluno': prop.relacao([f.aluno.pageId]),
      'Regra aplicada': prop.relacao([f.regra.id]),
      'Tipo': prop.select(f.tipo),
      'Severidade': prop.select(f.severidade),
      'Status': prop.status('Não iniciada'),
      'Responsável': prop.pessoas(RESPONSAVEL ? [RESPONSAVEL] : []),
      'Prazo': prop.data(f.prazo),
      'Leitura da coordenação': prop.texto(leitura),
      'Conta que sustenta': prop.texto(f.conta),
      'Chave de deduplicação': prop.texto(f.chave),
    },
    [
      bloco('heading_2', 'Conta que sustenta o alerta'),
      bloco('paragraph', f.conta),
      bloco('heading_2', 'Leitura sugerida'),
      bloco('paragraph', leitura),
      bloco('callout',
        `Gerado automaticamente pela varredura de ${HOJE.toISOString().slice(0, 10)}. ` +
        `Regra: "${f.regra.titulo}" (${f.regra.status}, confiança ${f.regra.confianca}). ` +
        'A leitura é sugestão redigida por modelo de linguagem; a conta acima é determinística. ' +
        'Em caso de divergência entre as duas, a conta prevalece.'),
    ],
  )

  criados++
  console.log(`  ${f.aluno.alunoId} ${f.aluno.nome.padEnd(24)} ${f.tipo}`)
}

console.log(`\n${criados} alertas abertos no Notion.`)
if (RESPONSAVEL) console.log('Responsável atribuído — o Notion notifica.')

// ─── Gemini ───────────────────────────────────────────────────────────

/**
 * Redige a leitura para a coordenação.
 *
 * O prompt entrega a regra e a conta já resolvida, e proíbe recalcular. Não é
 * excesso de zelo: pedir para um modelo "verificar se o aluno se qualifica" com
 * os números na mão convida exatamente o erro de média que a regra existe para
 * evitar — 4 de 5 e 2 de 7 soam como "quase lá" em linguagem natural.
 *
 * Falha na geração não derruba a varredura. O alerta é aberto com a conta, que
 * é a parte que a coordenação precisa. Perder a redação é degradação; perder o
 * alerta seria falha.
 */
async function redigir(f) {
  const prompt = [
    'Você redige notas curtas para a coordenação de uma escola.',
    '',
    'REGRA APLICÁVEL (fonte: Playbook da instituição):',
    f.regra.texto,
    '',
    'SITUAÇÃO DO ALUNO:',
    `Nome: ${f.aluno.nome}`,
    `Formação: ${f.aluno.formacao ?? 'não informada'}`,
    `Turma: ${f.aluno.turma ?? 'sem turma'}`,
    `Jornada: ${f.aluno.jornada}`,
    '',
    'AVALIAÇÃO JÁ REALIZADA (determinística, não recalcule):',
    f.conta,
    '',
    'CONTEXTO:',
    f.contexto,
    '',
    'Escreva de 2 a 4 frases em português do Brasil dizendo o que a coordenação',
    'deve fazer. Regras da redação:',
    '- NÃO recalcule nada nem discuta os números. Eles já estão decididos.',
    '- NÃO some ou faça média das mentorias de fases diferentes.',
    '- Se a avaliação nega algo, diga qual critério falhou, sem suavizar.',
    f.regra.status === 'Para revisar'
      ? '- A regra está PENDENTE DE REVISÃO. Diga isso explicitamente na nota.'
      : '',
    '- Sem saudação, sem assinatura, sem markdown. Só o texto.',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      },
    )
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
    const j = await r.json()
    const texto = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim()
    if (!texto) throw new Error('resposta vazia')
    return texto
  } catch (e) {
    console.warn(`    [aviso] geração falhou para ${f.aluno.alunoId}: ${e.message}`)
    return '(leitura não gerada — consulte a conta que sustenta o alerta)'
  }
}

function bloco(tipo, texto) {
  return {
    object: 'block',
    type: tipo,
    [tipo]: { rich_text: [{ type: 'text', text: { content: texto.slice(0, 1900) } }] },
  }
}
