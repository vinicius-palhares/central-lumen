/**
 * Teste de fumaça da camada de dados do painel, contra o Notion REAL.
 *
 * Separado da bateria de `regras.test.mjs`, que roda offline. Este script gasta
 * rede e cota, e por isso não entra no `npm run testar`.
 *
 * O que ele pega, e que nenhum teste offline pegaria: nome de propriedade do
 * Notion escrito errado. `ler(p, 'Turma no')` em vez de `'Turma nº'` não lança
 * exceção — devolve `null`. Em produção isso vira um campo vazio na tela, que
 * é indistinguível de um aluno que realmente não tem turma.
 *
 *   node scripts/testar_consultas.mjs [--com-gemini]
 *
 *   --com-gemini  inclui a rota `perguntar`, que consome cota.
 */

import { Notion } from '../supabase/functions/_shared/notion.mjs'
import { criarConsultas } from '../supabase/functions/_shared/consultas.mjs'
import { BASES, carregarEnv, exigir } from './config.mjs'

const COM_GEMINI = process.argv.includes('--com-gemini')

await carregarEnv()
const { NOTION_TOKEN } = exigir('NOTION_TOKEN')

const consultas = criarConsultas({
  notion: new Notion(NOTION_TOKEN),
  bases: BASES,
  geminiKey: process.env.GEMINI_API_KEY,
  modelo: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
})

let falhas = 0
const ok = (cond, msg, extra) => {
  console.log(`  ${cond ? 'ok  ' : 'FALHA'} ${msg}${extra !== undefined ? ` -> ${extra}` : ''}`)
  if (!cond) falhas++
}

// ─── resumo ───────────────────────────────────────────────────────────

console.log('\nresumo')
const r = await consultas.resumo()
const i = r.indicadores
ok(i.alunosTotal > 0, 'alunosTotal', i.alunosTotal)
ok(i.alunosAtivos > 0 && i.alunosAtivos <= i.alunosTotal, 'alunosAtivos <= total', i.alunosAtivos)
ok(i.semTurma > 0, 'semTurma', i.semTurma)
ok(i.acessoVencendo > 0, 'acessoVencendo (janela de 30 dias)', i.acessoVencendo)
ok(i.alertasAbertos > 0, 'alertasAbertos', i.alertasAbertos)
ok(r.playbook.length > 0, 'regras no playbook', r.playbook.length)
ok(
  r.playbook.some((x) => x.confianca === 'Média'),
  'existe regra com confiança Média (pendente de revisão)',
)

// ─── alunos ───────────────────────────────────────────────────────────

console.log('\nalunos')
const { alunos } = await consultas.listarAlunos()
ok(alunos.length > 0, 'lista não vazia', alunos.length)

// Toda propriedade mapeada precisa aparecer preenchida em ALGUM registro. Se
// uma delas vier null em todos, o nome da propriedade está errado no código —
// que é exatamente a falha silenciosa que este script existe para pegar.
const campos = [
  'alunoId', 'nome', 'email', 'jornada', 'formacao', 'turma', 'turmaNumero',
  'teoricoPct', 'modulosFaltantes', 'carpaPresente', 'carpaTotal',
  'pilaresPresente', 'pilaresTotal', 'plano', 'acessoAte', 'certificado',
]
const mortos = campos.filter((c) => alunos.every((a) => a[c] === null || a[c] === undefined))
ok(mortos.length === 0, 'nenhuma propriedade nula em todos os registros', mortos.join(', ') || 'ok')

// Ordenação por urgência: quem tem data vem antes de quem não tem.
const primeiroSemData = alunos.findIndex((a) => a.diasDeAcesso === null)
const ultimoComData = alunos.map((a) => a.diasDeAcesso).lastIndexOf.call(
  alunos.map((a) => (a.diasDeAcesso === null ? null : 1)), 1,
)
ok(primeiroSemData === -1 || primeiroSemData > ultimoComData, 'ordenado por urgência')

console.log('\nbusca')
const busca = await consultas.listarAlunos({ busca: 'otavio' })
ok(busca.alunos.length >= 1, 'busca sem acento acha nome acentuado', busca.alunos[0]?.nome)

// ─── detalhe, e os dois perfis que sustentam a demonstração ───────────

console.log('\ndetalhe — 1001, deve CONCEDER')
const d1 = await consultas.detalharAluno({ alunoId: 1001 })
ok(d1.aluno?.alunoId === 1001, 'encontrou o aluno', d1.aluno?.nome)
ok(d1.avaliacao.extensao.elegivel === true, 'elegível')
ok(d1.avaliacao.fonte?.confianca === 'Alta', 'fonte com confiança Alta')

console.log('\ndetalhe — 1002, deve NEGAR pelo piso de Pilares')
const d2 = await consultas.detalharAluno({ alunoId: 1002 })
ok(d2.avaliacao.extensao.elegivel === false, 'não elegível')
ok(d2.avaliacao.extensao.reprovados.length === 1, 'exatamente 1 critério reprovado')
ok(
  d2.avaliacao.extensao.reprovados[0]?.nome === 'Mentorias de Pilares',
  'o critério reprovado é Pilares',
  d2.avaliacao.extensao.reprovados[0]?.nome,
)
// A prova de que a regra veio do Notion, e não de constante no código.
const pilares = d2.avaliacao.extensao.criterios.find((c) => c.nome === 'Mentorias de Pilares')
ok(pilares?.origemPiso === 'texto', 'o piso saiu do texto da regra no Notion', pilares?.origemPiso)

console.log('\ndetalhe — 1004, sem turma: nulo não pode virar zero')
const d4 = await consultas.detalharAluno({ alunoId: 1004 })
ok(d4.aluno?.turma === null, 'turma nula')
ok(d4.aluno?.carpaPresente === null, 'carpaPresente nulo, não 0', String(d4.aluno?.carpaPresente))
ok(d4.avaliacao.extensao.elegivel === null, 'indeterminado, não negado')
ok(d4.avaliacao.certificacao.bloqueada === null, 'certificação indeterminada')

console.log('\ndetalhe — 1006, certificação travada pelo plano')
const d6 = await consultas.detalharAluno({ alunoId: 1006 })
ok(d6.avaliacao.certificacao.bloqueada === true, 'bloqueada')

// ─── alertas ──────────────────────────────────────────────────────────

console.log('\nalertas')
const { alertas } = await consultas.listarAlertas()
ok(alertas.length > 0, 'lista não vazia', alertas.length)
ok(
  alertas.every((a) => a.conta && a.conta.length > 20),
  'todo alerta tem a conta determinística',
)
// O truncamento de geração já passou por aqui uma vez. Uma leitura curta demais
// é o sintoma, e é barato continuar olhando.
const curtas = alertas.filter((a) => a.leitura && a.leitura.length < 80)
ok(curtas.length === 0, 'nenhuma leitura suspeita de truncamento', curtas.length)
ok(
  peso(alertas[0]?.severidade) <= peso(alertas.at(-1)?.severidade),
  'ordenado por severidade',
  `${alertas[0]?.severidade} ... ${alertas.at(-1)?.severidade}`,
)

// ─── perguntar ────────────────────────────────────────────────────────

if (COM_GEMINI) {
  console.log('\nperguntar (consome cota)')

  const p1 = await consultas.perguntar({
    texto: 'Quantas mentorias preciso ter para ganhar os 30 dias extras de acesso?',
  })
  ok(p1.resposta.length > 40, 'respondeu', p1.resposta.slice(0, 70) + '...')
  ok(p1.fonte !== null, 'citou uma regra', p1.fonte?.titulo)
  ok(/\b4\b/.test(p1.resposta) && /\b3\b/.test(p1.resposta), 'reproduziu os números 4 e 3')

  // O guardrail: preço não está em nenhuma fonte, e estimar seria inventar.
  const p2 = await consultas.perguntar({ texto: 'Quanto custa a Formação Clínica?' })
  const recusou = /não (há|tenho|existe|consta)|canal oficial|não (posso|é possível) (estimar|informar)/i
  ok(recusou.test(p2.resposta), 'recusou estimar preço', p2.resposta.slice(0, 90) + '...')
} else {
  console.log('\nperguntar: pulado (use --com-gemini)')
}

// ─── veredito ─────────────────────────────────────────────────────────

console.log(`\n${falhas === 0 ? 'tudo passou.' : `${falhas} falha(s).`}`)
process.exit(falhas === 0 ? 0 : 1)

function peso(s) {
  return { Alta: 0, Média: 1, Baixa: 2 }[s] ?? 3
}
