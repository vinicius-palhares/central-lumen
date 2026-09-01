/**
 * Verifica na interface publicada os DOIS ramos da marcação de alertas novos.
 *
 * Existe porque um dos ramos não é alcançável com os dados reais. Enquanto
 * todos os alertas abertos vierem da mesma varredura, a API responde
 * `destacarNovos: false` e a tela nunca mostra um chip — o caminho positivo só
 * apareceria no dia seguinte à segunda varredura.
 *
 * Os testes de `alertas.test.mjs` cobrem a REGRA, offline. Este script cobre a
 * RENDERIZAÇÃO, e para isso intercepta a resposta da rota de alertas no
 * navegador. Nada é gravado: o servidor responde o que responderia, e a
 * alteração vive só na memória da página.
 *
 *   node scripts/verificar_novos.mjs
 */

import { chromium } from 'playwright'
import { carregarEnv, exigir } from './config.mjs'

await carregarEnv()
const env = exigir('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PRINTS_EMAIL')
const APP = process.env.APP_URL ?? 'https://centralumen.lovable.app'

// Mesma via sem senha do script de capturas.
const g = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ type: 'magiclink', email: env.PRINTS_EMAIL }),
})
const { hashed_token } = await g.json()
const v = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'magiclink', token_hash: hashed_token }),
})
const sessao = await v.json()
const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0]

const navegador = await chromium.launch()

/**
 * @param mexer  transforma a resposta de `alertas`; ausente = resposta real.
 */
async function inspecionar(mexer) {
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
  })
  await ctx.addInitScript(([k, val]) => window.localStorage.setItem(k, val), [
    `sb-${ref}-auth-token`,
    JSON.stringify(sessao),
  ])
  const pagina = await ctx.newPage()

  if (mexer) {
    await pagina.route('**/functions/v1/painel', async (rota) => {
      const corpo = JSON.parse(rota.request().postData() || '{}')
      if (corpo.acao !== 'alertas') return rota.continue()
      const resp = await rota.fetch()
      await rota.fulfill({ response: resp, body: JSON.stringify(mexer(await resp.json())) })
    })
  }

  await pagina.goto(APP, { waitUntil: 'networkidle' })

  // Espera os CARDS, não o título da seção. O título existe desde o primeiro
  // quadro, inclusive durante o esqueleto de carregamento, então esperar por
  // ele lê a tela vazia — foi o que aconteceu na primeira versão deste script,
  // e o mesmo erro já tinha custado um print capturado em "Carregando...".
  const secao = pagina.locator('section').filter({ hasText: 'Alertas abertos' }).first()
  await secao.locator('h3').first().waitFor()
  await pagina.waitForTimeout(1200)

  const lido = await pagina.evaluate(() => {
    const chips = [...document.querySelectorAll('*')].filter(
      (e) => e.children.length === 0 && /^novo$/i.test(e.textContent.trim()),
    )
    const sec = [...document.querySelectorAll('section')].find((s) =>
      /Alertas abertos/.test(s.querySelector('h2')?.textContent || ''),
    )
    return {
      chips: chips.length,
      titulo: sec.querySelector('h2').parentElement.textContent.trim(),
      ordem: [...sec.querySelectorAll('h3')].map((h) => h.textContent.trim()),
    }
  })

  await ctx.close()
  return lido
}

let falhas = 0
const conferir = (cond, msg, extra) => {
  console.log(`  ${cond ? 'ok   ' : 'FALHA'} ${msg}${extra !== undefined ? ` -> ${extra}` : ''}`)
  if (!cond) falhas++
}

console.log('\nramo real: todos os alertas da mesma varredura')
const real = await inspecionar(null)
conferir(real.chips === 0, 'nenhum chip "Novo"', real.chips)
conferir(/varredura de/.test(real.titulo), 'título cita a varredura', real.titulo)
conferir(!/novos/.test(real.titulo), 'título NÃO diz "novos"')

console.log('\nramo forçado: 2 de 7 vindos de uma varredura mais recente')
const forcado = await inspecionar((j) => ({
  ...j,
  alertas: j.alertas.map((a, i) => ({ ...a, novo: i < 2 })),
  novos: 2,
  destacarNovos: true,
}))
conferir(forcado.chips === 2, 'exatamente 2 chips', forcado.chips)
conferir(/2 novos/.test(forcado.titulo), 'título conta os novos', forcado.titulo)
conferir(
  JSON.stringify(real.ordem) === JSON.stringify(forcado.ordem),
  'a ordem por severidade NÃO muda com a marcação',
)

await navegador.close()
console.log(`\n${falhas === 0 ? 'os dois ramos se comportam.' : `${falhas} falha(s).`}`)
process.exit(falhas === 0 ? 0 : 1)
