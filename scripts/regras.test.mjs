/**
 * Testes do motor de regras.
 *
 * Rodam sem rede e sem credencial: `node --test scripts/regras.test.mjs`.
 *
 * O caso que importa é o `nega por piso isolado`. Ele existe porque a forma
 * errada de implementar esta regra — somar as duas fases e comparar com 60% —
 * passa em todos os outros testes e falha só nele.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avaliarExtensao, avaliarCertificacao, extrairPisos, diasDeAcesso } from '../supabase/functions/_shared/regras.mjs'

const REGRA = `
O acesso dura 12 meses. O aluno que não concluir pode receber mais 30 dias sem
custo desde que tenha participação de no mínimo 60% da formação, o que na
prática significa no mínimo 4 mentorias do CARPA e 3 de Pilares, e desde que
falte no máximo dois módulos para a conclusão do teórico.
`

const base = { carpaTotal: 5, pilaresTotal: 7 }

test('extrai os limiares do texto da regra, não de constante no código', () => {
  const { pisos, origem } = extrairPisos(REGRA)
  assert.equal(pisos.carpa, 4)
  assert.equal(pisos.pilares, 3)
  assert.equal(pisos.modulosFaltantesMax, 2)
  assert.equal(origem.carpa, 'texto')
  assert.equal(origem.pilares, 'texto')
})

test('marca o limiar como padrão quando a regra não o declara', () => {
  const { origem } = extrairPisos('O acesso dura 12 meses e pode ser estendido.')
  assert.equal(origem.carpa, 'padrão')
  assert.equal(origem.pilares, 'padrão')
})

test('concede quando todos os pisos são cumpridos', () => {
  const v = avaliarExtensao(
    { ...base, carpaPresente: 4, pilaresPresente: 3, modulosFaltantes: 2 },
    REGRA,
  )
  assert.equal(v.elegivel, true)
  assert.equal(v.reprovados.length, 0)
})

test('nega por piso isolado, mesmo com a soma das fases acima de 60%', () => {
  // 4 de 5 no CARPA + 2 de 7 em Pilares = 6 de 12 = 50%.
  // Uma implementação por média diria "quase lá". O piso de Pilares é 3.
  const v = avaliarExtensao(
    { ...base, carpaPresente: 4, pilaresPresente: 2, modulosFaltantes: 2 },
    REGRA,
  )
  assert.equal(v.elegivel, false)
  assert.equal(v.reprovados.length, 1)
  assert.equal(v.reprovados[0].nome, 'Mentorias de Pilares')
  assert.match(v.conta, /não se compensam/i)
})

test('nega mesmo com presença perfeita se faltam módulos demais', () => {
  const v = avaliarExtensao(
    { ...base, carpaPresente: 5, pilaresPresente: 7, modulosFaltantes: 5 },
    REGRA,
  )
  assert.equal(v.elegivel, false)
  assert.equal(v.reprovados[0].nome, 'Módulos faltantes')
})

test('módulos faltantes é teto, não piso', () => {
  const v = avaliarExtensao(
    { ...base, carpaPresente: 4, pilaresPresente: 3, modulosFaltantes: 0 },
    REGRA,
  )
  assert.equal(v.elegivel, true)
})

test('dado ausente vira indeterminado, nunca zero', () => {
  // Aluno sem turma não reprovou no piso: ele não tem piso a cumprir ainda.
  // Tratar null como 0 produziria uma negativa falsa.
  const v = avaliarExtensao(
    { ...base, carpaPresente: null, pilaresPresente: null, modulosFaltantes: null },
    REGRA,
  )
  assert.equal(v.elegivel, null)
  assert.equal(v.indeterminado, true)
  assert.equal(v.reprovados.length, 0)
  assert.match(v.conta, /não informado/i)
})

test('a conta transcreve os números literais, e nomeia o critério que falhou', () => {
  const v = avaliarExtensao(
    { ...base, carpaPresente: 4, pilaresPresente: 2, modulosFaltantes: 2 },
    REGRA,
  )
  assert.match(v.conta, /CARPA: 4 de 5/)
  assert.match(v.conta, /Pilares: 2 de 7/)
  assert.match(v.conta, /NÃO cumpre/)
})

test('certificação: turma anterior à 41 não exige plano', () => {
  const c = avaliarCertificacao({ turmaNumero: 38, plano: 'Não entregue' })
  assert.equal(c.bloqueada, false)
})

test('certificação: turma 41 em diante trava sem o plano', () => {
  const c = avaliarCertificacao({ turmaNumero: 44, plano: 'Não entregue' })
  assert.equal(c.bloqueada, true)
})

test('certificação: entrega após o prazo conta como entregue', () => {
  const c = avaliarCertificacao({ turmaNumero: 44, plano: 'Entregue após prazo' })
  assert.equal(c.bloqueada, false)
})

test('certificação: sem turma é indeterminado, não bloqueado', () => {
  const c = avaliarCertificacao({ turmaNumero: null, plano: null })
  assert.equal(c.bloqueada, null)
})

test('dias de acesso conta em dias inteiros e aceita passado', () => {
  const hoje = new Date('2026-08-30T15:00:00Z')
  assert.equal(diasDeAcesso('2026-09-09', hoje), 10)
  assert.equal(diasDeAcesso('2026-08-30', hoje), 0)
  assert.equal(diasDeAcesso('2026-08-20', hoje), -10)
  assert.equal(diasDeAcesso(null, hoje), null)
})

// ─── contra o arquivo real ────────────────────────────────────────────
// Os testes acima usam uma REGRA inline, o que verifica a aritmética mas não
// verifica que o texto realmente escrito em regras/ é legível pelo extrator.
// Uma reescrita editorial da regra que trocasse "4 mentorias do CARPA" por
// "quatro mentorias do CARPA" faria todos os testes acima continuarem passando
// enquanto o sistema silenciosamente cairia nos limiares padrão.

test('os limiares saem do texto do arquivo real, sem cair no padrão', async () => {
  const { readFile } = await import('node:fs/promises')
  const bruto = await readFile(new URL('../regras/01-extensao-de-acesso.md', import.meta.url), 'utf8')
  const texto = bruto.split('---')[2]

  const { pisos, origem } = extrairPisos(texto)
  assert.equal(pisos.carpa, 4)
  assert.equal(pisos.pilares, 3)
  assert.equal(pisos.modulosFaltantesMax, 2)

  // O ponto do teste: nenhum limiar pode vir de constante do código.
  assert.deepEqual(origem, { carpa: 'texto', pilares: 'texto', modulosFaltantesMax: 'texto' })
})

test('o perfil 1002 é negado pelo texto real da regra', async () => {
  const { readFile } = await import('node:fs/promises')
  const bruto = await readFile(new URL('../regras/01-extensao-de-acesso.md', import.meta.url), 'utf8')
  const texto = bruto.split('---')[2]

  const v = avaliarExtensao(
    { carpaPresente: 4, pilaresPresente: 2, modulosFaltantes: 2, carpaTotal: 5, pilaresTotal: 7 },
    texto,
  )
  assert.equal(v.elegivel, false)
  assert.equal(v.reprovados.length, 1)
  assert.equal(v.reprovados[0].nome, 'Mentorias de Pilares')
})

test('o veredito distingue um critério reprovado de vários', () => {
  const um = avaliarExtensao(
    { ...base, carpaPresente: 4, pilaresPresente: 2, modulosFaltantes: 2 },
    REGRA,
  )
  assert.match(um.conta, /um único critério \(Mentorias de Pilares\)/)
  assert.match(um.conta, /não se compensam/)

  const varios = avaliarExtensao(
    { ...base, carpaPresente: 2, pilaresPresente: 1, modulosFaltantes: 8 },
    REGRA,
  )
  assert.match(varios.conta, /Reprovado em 3 critérios/)
  // A frase do caso limítrofe não pode aparecer aqui: ela descreveria mal a
  // situação e gastaria o argumento onde ele não é necessário.
  assert.doesNotMatch(varios.conta, /único critério/)
})
