/**
 * Gera a base sintética de alunos e a carrega na base "Lumen · Alunos" do Notion.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ NENHUM DADO AQUI É REAL. Nomes são combinações de listas de primeiros │
 * │ nomes e sobrenomes comuns; e-mails usam @exemplo.com e não recebem    │
 * │ mensagem. Qualquer semelhança com pessoa real é coincidência de       │
 * │ amostragem. O schema espelha a estrutura de um CRM educacional; o     │
 * │ conteúdo, não.                                                        │
 * │                                                                       │
 * │ Este script é versionado justamente como prova de que a base é        │
 * │ GERADA, não extraída de sistema de produção.                          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Determinismo parcial, por desenho:
 *
 *   - Nomes, formações, progresso e presenças vêm de PRNG com semente fixa.
 *     Rodar duas vezes produz os mesmos 40 alunos.
 *   - As DATAS são ancoradas no dia da execução, não numa data fixa.
 *
 * A segunda decisão é deliberada e custou a reprodutibilidade byte a byte. O
 * motivo: a automação varre "acesso vencendo nos próximos 30 dias". Com datas
 * congeladas numa data fixa, os casos de teste viram "vencido há três meses"
 * algumas semanas depois, e a demonstração deixa de exercitar a regra que o
 * projeto existe para demonstrar.
 *
 *   node scripts/gerar_alunos.mjs [--secar]
 *
 *   --secar   imprime o que seria gravado e sai, sem tocar no Notion.
 */

import { Notion, prop } from '../supabase/functions/_shared/notion.mjs'
import { BASES, carregarEnv, exigir } from './config.mjs'

const TOTAL = 40
const SEMENTE = 20260804
const HOJE = new Date()
const SECAR = process.argv.includes('--secar')

await carregarEnv()

// ─── PRNG determinístico (mulberry32) ─────────────────────────────────

let estado = SEMENTE
function rand() {
  estado |= 0
  estado = (estado + 0x6d2b79f5) | 0
  let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const inteiro = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const escolher = (arr) => arr[Math.floor(rand() * arr.length)]

/**
 * Distingue "não especificado" de "explicitamente nulo".
 *
 * NÃO trocar por `??`: `null ?? padrao` devolve o padrão, então um caso que
 * pede `modulosFaltantes: null` receberia um número sorteado e deixaria de
 * testar o caminho de dado ausente. Só `undefined` cai no padrão.
 */
const pick = (valor, padrao) => (valor === undefined ? padrao : valor)

// ─── vocabulário ──────────────────────────────────────────────────────

const PRIMEIROS = [
  'Adriana', 'Bruno', 'Camila', 'Daniel', 'Eduarda', 'Fábio', 'Gabriela',
  'Henrique', 'Isabela', 'João', 'Karina', 'Leonardo', 'Mariana', 'Natália',
  'Otávio', 'Patrícia', 'Rafael', 'Sofia', 'Thiago', 'Vanessa', 'Wagner', 'Yara',
]
const SOBRENOMES = [
  'Albuquerque', 'Bastos', 'Cavalcanti', 'Dourado', 'Esteves', 'Fontoura',
  'Guimarães', 'Hollanda', 'Iglesias', 'Jardim', 'Klein', 'Lacerda',
  'Monteiro', 'Novaes', 'Peixoto', 'Queiroz', 'Rezende', 'Sampaio',
  'Tavares', 'Vasconcelos',
]

const FORMACOES = [
  'Formação Clínica', 'Formação em Gestão',
  'Formação em Ciência da Mudança', 'Trilha Prática',
]
const PREFIXO = {
  'Formação Clínica': 'CLI',
  'Formação em Gestão': 'BUS',
  'Formação em Ciência da Mudança': 'CHA',
  'Trilha Prática': 'FLO',
}

const JORNADAS = [
  ...Array(21).fill('Cursando'),
  ...Array(10).fill('Formado'),
  ...Array(3).fill('Churn'),
  'Aguardando início da turma', 'Abandonou', 'Em vias de conclusão',
  'Reembolsado', 'Acolhimento', 'On hold',
]

const CERTIFICADOS = [
  'Não qualificado', 'Enviar certificado digital', 'Certificado digital enviado',
  'Certificado físico solicitado', 'Enviar certificado físico', 'Envio completo',
]

// ─── casos obrigatórios ───────────────────────────────────────────────
// Cada um exercita uma regra do Playbook. Se um deles sair da base, a regra
// correspondente deixa de ser demonstrável — não são enfeite.

const OBRIGATORIOS = [
  {
    _caso: 'elegível à extensão de 30 dias',
    jornada: 'Cursando', formacao: 'Formação Clínica', semTurma: false,
    turmaNumero: 44, turmaOffset: -310,
    teoricoPct: 92.0, modulosFaltantes: 2,
    carpaPresente: 4, pilaresPresente: 3,
    plano: 'Entregue',
    acessoAte: dias(+18), certificado: 'Não qualificado',
  },
  {
    // 4 CARPA e 2 Pilares dá 6 de 12, ou 50%. Um sistema que calcula média diria
    // "você está quase lá". A regra define pisos POR FASE, e o de Pilares é 3.
    // Este é o caso que separa aplicar a regra de gerar texto plausível.
    _caso: 'um passo abaixo do corte — deve receber NEGATIVA',
    jornada: 'Cursando', formacao: 'Formação Clínica', semTurma: false,
    turmaNumero: 43, turmaOffset: -320,
    teoricoPct: 88.0, modulosFaltantes: 2,
    carpaPresente: 4, pilaresPresente: 2,
    plano: 'Não entregue',
    acessoAte: dias(+11), certificado: 'Não qualificado',
  },
  {
    _caso: 'muito atrasado — orientar renovação',
    jornada: 'Desengajado', formacao: 'Formação Clínica', semTurma: false,
    turmaNumero: 42, turmaOffset: -340,
    teoricoPct: 31.0, modulosFaltantes: 8,
    carpaPresente: 2, pilaresPresente: 1,
    plano: 'Não entregue',
    acessoAte: dias(+6), certificado: 'Não qualificado',
  },
  {
    _caso: 'sem turma — campos vazios não podem virar zero',
    jornada: 'Matriculado', formacao: 'Formação Clínica', semTurma: true,
    teoricoPct: 12.0, modulosFaltantes: null,
    carpaPresente: null, pilaresPresente: null,
    plano: null,
    acessoAte: null, certificado: 'Não qualificado',
  },
  {
    _caso: 'turma ainda não começou — não pode dividir por zero',
    jornada: 'Aguardando início da turma', formacao: 'Formação em Ciência da Mudança', semTurma: false,
    turmaNumero: 14, turmaOffset: +25,
    teoricoPct: 0.0, modulosFaltantes: null,
    carpaPresente: 0, pilaresPresente: 0,
    plano: null,
    acessoAte: dias(+390), certificado: 'Não qualificado',
  },
  {
    _caso: 'certificação travada pelo plano de acompanhamento (turma >= 41)',
    jornada: 'Em vias de conclusão', formacao: 'Formação Clínica', semTurma: false,
    turmaNumero: 44, turmaOffset: -330,
    teoricoPct: 100.0, modulosFaltantes: 0,
    carpaPresente: 5, pilaresPresente: 7,
    plano: 'Não entregue',
    acessoAte: dias(+40), certificado: 'Não qualificado',
  },
]

// ─── montagem ─────────────────────────────────────────────────────────

const usados = new Set()
function nome() {
  for (let i = 0; i < 200; i++) {
    const n = `${escolher(PRIMEIROS)} ${escolher(SOBRENOMES)}`
    if (!usados.has(n)) return usados.add(n), n
  }
  throw new Error('Sem combinações de nome disponíveis')
}

function montar(base, indice) {
  const n = nome()
  const formacao = pick(base.formacao, escolher(FORMACOES))
  const semTurma = pick(base.semTurma, rand() < 0.49)
  const turmaNumero = pick(base.turmaNumero, inteiro(30, 48))

  let turma = null
  if (!semTurma) {
    const inicio = new Date(HOJE)
    inicio.setDate(inicio.getDate() + pick(base.turmaOffset, -inteiro(20, 300)))
    turma = PREFIXO[formacao] + iso(inicio).slice(2).replaceAll('-', '')
  }

  return {
    alunoId: 1000 + indice,
    nome: n,
    email: `${slug(n)}@exemplo.com`,
    jornada: base.jornada,
    formacao,
    turma,
    turmaNumero: semTurma ? null : turmaNumero,
    teoricoPct: pick(base.teoricoPct, Number((rand() * 100).toFixed(1))),
    modulosFaltantes: pick(base.modulosFaltantes, inteiro(0, 10)),
    carpaTotal: 5,
    carpaPresente: pick(base.carpaPresente, inteiro(0, 5)),
    pilaresTotal: 7,
    pilaresPresente: pick(base.pilaresPresente, inteiro(0, 7)),
    plano: pick(base.plano, escolher(['Não entregue', 'Entregue', 'Entregue após prazo'])),
    acessoAte: pick(base.acessoAte, dias(inteiro(-90, 400))),
    certificado: pick(base.certificado, escolher(CERTIFICADOS)),
  }
}

const alunos = OBRIGATORIOS.map((caso, i) => montar(caso, i + 1))

// Garante massa para a varredura: alguns vencidos e alguns dentro da janela
// de 30 dias, além dos casos obrigatórios.
const FORCAR_ACESSO = [dias(-45), dias(-12), dias(-3), dias(+8), dias(+21), dias(+29)]
for (let i = alunos.length; i < TOTAL; i++) {
  const forcado = FORCAR_ACESSO[i - OBRIGATORIOS.length]
  alunos.push(montar({ jornada: JORNADAS[i % JORNADAS.length], ...(forcado && { acessoAte: forcado }) }, i + 1))
}

// ─── relatório ────────────────────────────────────────────────────────

console.log(`${alunos.length} alunos sintéticos montados.\n`)
console.log('Casos obrigatórios:')
OBRIGATORIOS.forEach((c, i) => {
  const a = alunos[i]
  console.log(`  ${a.alunoId}  ${a.nome.padEnd(24)} ${c._caso}`)
})
const semTurma = alunos.filter((a) => !a.turma).length
console.log(`\nSem turma: ${semTurma}/${TOTAL} (${Math.round((100 * semTurma) / TOTAL)}%)`)
console.log(`Acesso já vencido: ${alunos.filter((a) => a.acessoAte && a.acessoAte < iso(HOJE)).length}`)
console.log(`Vencendo em 30 dias: ${alunos.filter((a) => dentroDe30(a.acessoAte)).length}`)

if (SECAR) {
  console.log('\n--secar: nada foi gravado no Notion.')
  process.exit(0)
}

// ─── carga no Notion ──────────────────────────────────────────────────

const { NOTION_TOKEN } = exigir('NOTION_TOKEN')
const notion = new Notion(NOTION_TOKEN)

// Arquiva o que já existe. O Notion não tem "truncate": arquivar é o mais
// próximo, e mantém o histórico recuperável na lixeira por 30 dias.
const existentes = await notion.consultarTudo(BASES.alunos)
if (existentes.length) {
  console.log(`\nArquivando ${existentes.length} registros anteriores...`)
  for (const p of existentes) await notion.arquivarPagina(p.id)
}

console.log(`Gravando ${alunos.length} registros...`)
let n = 0
for (const a of alunos) {
  await notion.criarPagina(BASES.alunos, {
    'Nome': prop.titulo(a.nome),
    'Aluno ID': prop.numero(a.alunoId),
    'E-mail': prop.email(a.email),
    'Jornada': prop.select(a.jornada),
    'Formação': prop.select(a.formacao),
    'Turma': prop.texto(a.turma),
    'Turma nº': prop.numero(a.turmaNumero),
    'Teórico %': prop.numero(a.teoricoPct),
    'Módulos faltantes': prop.numero(a.modulosFaltantes),
    'CARPA presente': prop.numero(a.carpaPresente),
    'CARPA total': prop.numero(a.carpaTotal),
    'Pilares presente': prop.numero(a.pilaresPresente),
    'Pilares total': prop.numero(a.pilaresTotal),
    'Plano de acompanhamento': prop.select(a.plano),
    'Acesso até': prop.data(a.acessoAte),
    'Certificado': prop.select(a.certificado),
  })
  n++
  if (n % 10 === 0) console.log(`  ${n}/${alunos.length}`)
}

console.log(`\n${n} alunos gravados no Notion.`)

// ─── utilitários ──────────────────────────────────────────────────────

function dias(n) {
  const d = new Date(HOJE)
  d.setDate(d.getDate() + n)
  return iso(d)
}
function dentroDe30(data) {
  if (!data) return false
  const d = (new Date(`${data}T00:00:00Z`) - new Date(`${iso(HOJE)}T00:00:00Z`)) / 86400000
  return d >= 0 && d <= 30
}
function iso(d) {
  return d.toISOString().slice(0, 10)
}
function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.')
}
