/**
 * Captura as imagens de `docs/prints/`.
 *
 * Existe como script, e não como um punhado de capturas manuais, por dois
 * motivos. As imagens do README precisam ser regeneráveis quando a interface
 * mudar — e mudou três vezes durante o trabalho. E cada captura fica presa a
 * um estado nomeado, então dá para saber depois o que cada arquivo deveria
 * mostrar sem abri-lo.
 *
 * AUTENTICAÇÃO SEM SENHA. O script obtém a sessão por magic link gerado pela
 * Admin API e injeta o resultado no localStorage antes da primeira navegação.
 * Em nenhum momento uma senha é digitada, guardada ou lida. É o mesmo caminho
 * usado para validar a cadeia de autenticação, e vale a pena aqui pelo mesmo
 * motivo: um script de captura não precisa da credencial do usuário.
 *
 *   node scripts/prints.mjs [--apenas 03,04]
 *
 * Exige APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e
 * PRINTS_EMAIL no .env.
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { RAIZ, carregarEnv, exigir } from './config.mjs'

const DESTINO = join(RAIZ, 'docs', 'prints')
const LARGURA = 1440
const ALTURA = 900

const i = process.argv.indexOf('--apenas')
const APENAS = i > -1 ? process.argv[i + 1].split(',').map((s) => s.trim()) : null

await carregarEnv()
const env = exigir('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PRINTS_EMAIL')
const APP = process.env.APP_URL ?? 'https://centralumen.lovable.app'

await mkdir(DESTINO, { recursive: true })

// ─── sessão sem senha ─────────────────────────────────────────────────

/**
 * Gera um magic link pela Admin API e o troca por uma sessão.
 *
 * O `verify` consome o token e devolve access e refresh. O formato gravado no
 * localStorage tem que ser o mesmo que o supabase-js grava, senão o cliente
 * ignora e manda para o login: a chave é `sb-<ref>-auth-token`.
 */
async function obterSessao() {
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email: env.PRINTS_EMAIL }),
  })
  if (!r.ok) throw new Error(`generate_link ${r.status}: ${await r.text()}`)
  const { hashed_token } = await r.json()

  const v = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed_token }),
  })
  if (!v.ok) throw new Error(`verify ${v.status}: ${await v.text()}`)
  return v.json()
}

const ref = new URL(env.SUPABASE_URL).hostname.split('.')[0]
const sessao = await obterSessao()
console.log(`Sessão obtida para ${env.PRINTS_EMAIL}, sem usar senha.\n`)

// ─── navegador ────────────────────────────────────────────────────────

const navegador = await chromium.launch()

async function novaAba({ largura = LARGURA, altura = ALTURA, autenticado = true } = {}) {
  const ctx = await navegador.newContext({
    viewport: { width: largura, height: altura },
    deviceScaleFactor: 2, // o PDF e o README são vistos em tela de alta densidade
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
  })

  if (autenticado) {
    await ctx.addInitScript(
      ([chave, valor]) => window.localStorage.setItem(chave, valor),
      [`sb-${ref}-auth-token`, JSON.stringify(sessao)],
    )
  }

  const pagina = await ctx.newPage()
  // O badge do Lovable aparece em toda captura e não faz parte do produto.
  await pagina.addStyleTag({ content: '' }).catch(() => {})
  return { ctx, pagina }
}

async function esconderBadge(pagina) {
  await pagina
    .addStyleTag({
      content: `[href*="lovable.dev"], [class*="lovable"] { display: none !important; }`,
    })
    .catch(() => {})
}

const capturas = []
function registrar(nome, fn) {
  capturas.push({ nome, fn })
}

const quer = (nome) => !APENAS || APENAS.some((a) => nome.startsWith(a))

// ─── as capturas ──────────────────────────────────────────────────────

registrar('01-login', async () => {
  const { ctx, pagina } = await novaAba({ autenticado: false })
  await pagina.goto(`${APP}/login`, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  await pagina.waitForSelector('input[type="password"]')
  await pagina.screenshot({ path: join(DESTINO, '01-login.png') })
  await ctx.close()
  return 'card centrado, campo de senha, sem cadastro'
})

registrar('02-painel', async () => {
  const { ctx, pagina } = await novaAba()
  await pagina.goto(APP, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  await pagina.waitForSelector('text=Alertas abertos')
  await pagina.waitForTimeout(1200)
  await pagina.screenshot({ path: join(DESTINO, '02-painel.png') })
  await ctx.close()
  return 'faixa de indicadores com um primário, alertas por severidade'
})

/**
 * Abre o detalhe de um aluno pela busca, e espera a avaliação carregar.
 *
 * O clique é escopado na seção que contém o campo de busca, e o texto casa por
 * IGUALDADE. Sem as duas coisas, `text=Otávio Peixoto` casa por substring com
 * o título do alerta "Otávio Peixoto — Extensão negada", que vem antes no DOM:
 * o script expandia o alerta e depois esperava para sempre por um painel que
 * nunca abriu.
 */
async function abrirAluno(pagina, nome) {
  const lista = pagina.locator('section').filter({ has: pagina.locator('input[type="search"]') })
  await pagina.fill('input[type="search"]', nome)
  await pagina.waitForTimeout(900) // debounce de 300ms mais a ida à API
  await lista.getByText(nome, { exact: true }).first().click()

  const painel = pagina.locator('[role="dialog"]')
  await painel.waitFor()

  // Espera o TÍTULO virar o nome do aluno. Esperar pelo texto "Avaliação da
  // extensão" não serve: a descrição do painel é "Detalhe do aluno e avaliação
  // da extensão", que já está presente no esqueleto de carregamento e satisfaz
  // a espera na hora. A primeira versão deste script capturou "Carregando...".
  await painel.getByRole('heading', { name: nome, exact: true }).waitFor()
  await painel.getByRole('heading', { name: 'Avaliação da extensão' }).waitFor()
  await pagina.waitForTimeout(700)
}

registrar('03-regra-concede', async () => {
  const { ctx, pagina } = await novaAba()
  await pagina.goto(APP, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  await abrirAluno(pagina, 'Isabela Fontoura')
  await pagina.screenshot({ path: join(DESTINO, '03-regra-concede.png') })
  await ctx.close()
  return '1001: CARPA 4 de 5 e Pilares 3 de 7, veredito Elegível'
})

registrar('04-regra-nega', async () => {
  const { ctx, pagina } = await novaAba()
  await pagina.goto(APP, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  await abrirAluno(pagina, 'Otávio Peixoto')
  await pagina.screenshot({ path: join(DESTINO, '04-regra-nega.png') })
  await ctx.close()
  return '1002: Pilares 2 de 7, Não elegível, critério reprovado destacado'
})

registrar('05-conta-do-alerta', async () => {
  const { ctx, pagina } = await novaAba()
  await pagina.goto(APP, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  await pagina.waitForSelector('text=Alertas abertos')
  // Expande o alerta do Otávio: é o que tem UM critério reprovado, que é o
  // caso limítrofe que o projeto existe para demonstrar.
  const card = pagina.locator('article, div').filter({ hasText: 'Otávio Peixoto — Extensão negada' }).last()
  await card.getByRole('button', { name: /conta completa/i }).click()
  await pagina.waitForTimeout(600)
  await card.scrollIntoViewIfNeeded()
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: join(DESTINO, '05-conta-do-alerta.png') })
  await ctx.close()
  return 'conta determinística aberta ao lado da leitura gerada'
})

registrar('06-confianca', async () => {
  const { ctx, pagina } = await novaAba()
  await pagina.goto(APP, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  const campo = pagina.locator('input[type="text"]').last()
  await campo.fill('Quanto custa a Formação Clínica?')
  await pagina.getByRole('button', { name: 'Perguntar' }).click()
  await pagina.waitForSelector('text=/Confiança/i', { timeout: 60000 })
  await pagina.waitForTimeout(800)

  // Captura a SEÇÃO, não a viewport. A coluna de alertas termina em 7 itens
  // enquanto a de alunos tem 40, então nessa altura de rolagem a metade
  // esquerda da tela fica vazia e a captura vira mais vazio do que assunto.
  const secao = pagina.locator('section').filter({ hasText: 'Pergunta ao playbook' }).last()
  await secao.screenshot({ path: join(DESTINO, '06-confianca.png') })
  await ctx.close()
  return 'guardrail de preço recusando, com procedência e chip de confiança'
})

registrar('08-mobile-375', async () => {
  const { ctx, pagina } = await novaAba({ largura: 375, altura: 812 })
  await pagina.goto(APP, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  await pagina.waitForSelector('text=Alertas abertos')
  await pagina.waitForTimeout(1200)

  // Prova, na própria captura, que não há rolagem horizontal.
  const estoura = await pagina.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  await pagina.screenshot({ path: join(DESTINO, '08-mobile-375.png') })
  await ctx.close()
  return estoura ? 'ATENÇÃO: a página rola horizontalmente em 375px' : '375px, sem rolagem horizontal'
})

registrar('09-perfil-bloqueado', async () => {
  const { ctx, pagina } = await novaAba()
  // Sessão válida, mas a API responde 403. Interceptar é mais honesto que
  // mexer no banco: o que a tela precisa provar é a REAÇÃO ao 403, e alterar
  // `perfis.liberado` numa captura arriscaria deixar o acesso derrubado se o
  // script falhasse no meio.
  await pagina.route('**/functions/v1/painel', (rota) =>
    rota.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ erro: 'Perfil ainda não liberado pela coordenação.' }),
    }),
  )
  await pagina.goto(APP, { waitUntil: 'networkidle' })
  await esconderBadge(pagina)
  await pagina.waitForSelector('text=/não liberado/i')
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: join(DESTINO, '09-perfil-bloqueado.png') })
  await ctx.close()
  return 'tela própria do 403, com saída explícita e sem laço para o login'
})

// ─── execução ─────────────────────────────────────────────────────────

let falhas = 0
for (const { nome, fn } of capturas) {
  if (!quer(nome)) continue
  try {
    const nota = await fn()
    console.log(`  ok    ${nome.padEnd(20)} ${nota}`)
  } catch (e) {
    falhas++
    console.log(`  FALHA ${nome.padEnd(20)} ${String(e.message).split('\n')[0].slice(0, 90)}`)
  }
}

await navegador.close()

console.log(`\n${falhas === 0 ? 'Todas as capturas concluídas.' : `${falhas} captura(s) falharam.`}`)
console.log('\n07-notion-alertas.png não é capturável por este script: a base de')
console.log('Alertas exige sessão do Notion, que o navegador do script não tem.')
console.log('Capture manualmente, mostrando a coluna Responsável preenchida.')

process.exit(falhas === 0 ? 0 : 1)
