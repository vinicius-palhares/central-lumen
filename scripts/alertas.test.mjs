/**
 * Testes da marcação de alertas novos.
 *
 * Offline: o cliente do Notion é substituído por um duplo que devolve páginas
 * fabricadas. O que está sob teste é a REGRA de agrupamento por varredura, e
 * ela não precisa de rede para ser exercitada — precisa de controle sobre os
 * carimbos de tempo, que a rede não dá.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarConsultas } from '../supabase/functions/_shared/consultas.mjs'

/** Monta uma página do Notion com só o que listarAlertas() lê. */
function alerta(titulo, geradoEm, severidade = 'Média') {
  return {
    id: titulo,
    url: 'https://notion.so/x',
    properties: {
      Alerta: { type: 'title', title: [{ plain_text: titulo }] },
      'Gerado em': { type: 'created_time', created_time: geradoEm },
      Severidade: { type: 'select', select: { name: severidade } },
    },
  }
}

const consultasCom = (paginas) =>
  criarConsultas({
    notion: { consultarTudo: async () => paginas, lerBlocos: async () => ({ results: [] }) },
    bases: { alunos: 'a', playbook: 'p', alertas: 'x' },
    geminiKey: 'nao-usado',
    modelo: 'nao-usado',
  })

test('agrupa por proximidade: a mesma varredura leva minutos, não segundos', async () => {
  const r = await consultasCom([
    alerta('A', '2026-08-31T02:09:00.000Z'),
    alerta('B', '2026-08-31T02:10:00.000Z'),
    alerta('C', '2026-08-30T02:10:00.000Z'), // véspera
  ]).listarAlertas()

  assert.equal(r.novos, 2)
  assert.equal(r.alertas.find((a) => a.titulo === 'C').novo, false)
})

test('não destaca quando TODOS vieram da mesma varredura', async () => {
  // Sete marcadores idênticos numa lista de sete itens não distinguem nada:
  // só repetem a contagem total com outra palavra.
  const r = await consultasCom([
    alerta('A', '2026-08-31T02:09:00.000Z'),
    alerta('B', '2026-08-31T02:10:00.000Z'),
  ]).listarAlertas()

  assert.equal(r.novos, 2)
  assert.equal(r.destacarNovos, false)
})

test('destaca quando os novos são um subconjunto próprio', async () => {
  const r = await consultasCom([
    alerta('A', '2026-08-31T02:10:00.000Z'),
    alerta('B', '2026-08-29T02:10:00.000Z'),
  ]).listarAlertas()

  assert.equal(r.novos, 1)
  assert.equal(r.destacarNovos, true)
})

test('base vazia não quebra nem inventa varredura', async () => {
  const r = await consultasCom([]).listarAlertas()
  assert.equal(r.alertas.length, 0)
  assert.equal(r.ultimaVarredura, null)
  assert.equal(r.novos, 0)
  assert.equal(r.destacarNovos, false)
})

test('alerta sem carimbo de criação não é marcado como novo', async () => {
  const semCarimbo = alerta('Sem data', '2026-08-31T02:10:00.000Z')
  semCarimbo.properties['Gerado em'] = { type: 'created_time', created_time: null }

  const r = await consultasCom([alerta('A', '2026-08-31T02:10:00.000Z'), semCarimbo]).listarAlertas()
  assert.equal(r.alertas.find((a) => a.titulo === 'Sem data').novo, false)
})
