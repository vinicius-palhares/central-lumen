/**
 * Carrega as regras de `regras/*.md` na base "Lumen · Playbook" do Notion.
 *
 * Este script é um *seed*, não uma sincronização contínua. Depois da carga
 * inicial, a fonte da verdade passa a ser o Notion: a coordenação edita a regra
 * lá, e a aplicação passa a se comportar de acordo na chamada seguinte, sem
 * deploy e sem tocar em código.
 *
 * Os arquivos markdown continuam versionados porque são o estado inicial
 * auditável — dá para ver no histórico do git o que a regra dizia quando o
 * trabalho foi entregue.
 *
 * A confiança NÃO é um campo editável à mão. Ela é derivada do status de
 * revisão. Deixar as duas coisas independentes permitiria uma regra pendente de
 * revisão carregar o rótulo "Alta", que é exatamente a mentira que o rótulo
 * existe para impedir.
 *
 *   node scripts/semear_playbook.mjs
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Notion, prop } from '../supabase/functions/_shared/notion.mjs'
import { BASES, RAIZ, carregarEnv, exigir } from './config.mjs'

const CONFIANCA_POR_STATUS = {
  'Publicado': 'Alta',
  'Para revisar': 'Média',
}

await carregarEnv()
const { NOTION_TOKEN } = exigir('NOTION_TOKEN')
const notion = new Notion(NOTION_TOKEN)

const dir = join(RAIZ, 'regras')
const arquivos = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort()

if (!arquivos.length) {
  console.error(`Nenhuma regra encontrada em ${dir}`)
  process.exit(1)
}

// Manifesto explícito, sem varredura recursiva. A varredura recursiva é o
// caminho pelo qual um arquivo que ninguém pretendia publicar acaba publicado.
console.log(`${arquivos.length} regras encontradas:\n${arquivos.map((f) => `  ${f}`).join('\n')}\n`)

const existentes = await notion.consultarTudo(BASES.playbook)
if (existentes.length) {
  console.log(`Arquivando ${existentes.length} regras anteriores...`)
  for (const p of existentes) await notion.arquivarPagina(p.id)
}

for (const arquivo of arquivos) {
  const bruto = await readFile(join(dir, arquivo), 'utf8')
  const { meta, corpo } = separar(bruto, arquivo)

  const confianca = CONFIANCA_POR_STATUS[meta.status]
  if (!confianca) {
    throw new Error(`${arquivo}: status "${meta.status}" não mapeia para nenhuma confiança.`)
  }

  await notion.criarPagina(
    BASES.playbook,
    {
      'Regra': prop.titulo(meta.regra),
      'Categoria': prop.select(meta.categoria),
      'Status de revisão': prop.select(meta.status),
      'Confiança': prop.select(confianca),
      'Revisado em': prop.data(meta.revisado_em ?? null),
      'Ativa': prop.checkbox(meta.ativa !== 'false'),
    },
    blocos(corpo),
  )

  console.log(`  ${meta.regra}  [${meta.status} -> confiança ${confianca}]`)
}

console.log(`\n${arquivos.length} regras carregadas no Playbook.`)

// ─── parsing ──────────────────────────────────────────────────────────

/**
 * Separa o cabeçalho YAML simples do corpo.
 *
 * Não usa parser de YAML de propósito: o cabeçalho aceita só `chave: valor` em
 * uma linha, e uma dependência de YAML abriria a porta para regra com estrutura
 * aninhada que o resto do pipeline não sabe ler.
 */
function separar(bruto, arquivo) {
  const m = bruto.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!m) throw new Error(`${arquivo}: cabeçalho --- ausente ou malformado.`)

  const meta = {}
  for (const linha of m[1].split('\n')) {
    const kv = linha.match(/^\s*([a-z_]+)\s*:\s*(.*)$/)
    if (kv) meta[kv[1]] = kv[2].trim()
  }

  for (const obrigatorio of ['regra', 'categoria', 'status']) {
    if (!meta[obrigatorio]) throw new Error(`${arquivo}: falta "${obrigatorio}" no cabeçalho.`)
  }

  return { meta, corpo: m[2].trim() }
}

/**
 * Corpo em parágrafos -> blocos do Notion.
 *
 * Cada bloco de rich text tem teto de 2000 caracteres. Parágrafos maiores são
 * partidos, e não truncados: truncar uma regra apagaria silenciosamente a parte
 * final dela, que costuma ser justamente a exceção.
 */
function blocos(corpo) {
  return corpo
    .split(/\n\s*\n/)
    .flatMap((p) => partir(p.replace(/\n/g, ' ').trim(), 1900))
    .filter(Boolean)
    .map((texto) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: texto } }] },
    }))
}

function partir(s, max) {
  const partes = []
  while (s.length > max) {
    const corte = s.lastIndexOf(' ', max)
    partes.push(s.slice(0, corte > 0 ? corte : max))
    s = s.slice(corte > 0 ? corte + 1 : max)
  }
  partes.push(s)
  return partes
}
