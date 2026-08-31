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
 * Este arquivo cuida SÓ disso. A camada de dados vive em `_shared/consultas.mjs`
 * porque Edge Function só executa depois de deploy, e um erro de nome de
 * propriedade do Notion apareceria em produção como campo vazio. Lá, o mesmo
 * código roda no Node contra o Notion real antes de qualquer deploy.
 *
 * Deploy:
 *   npx supabase functions deploy painel --project-ref <ref>
 *
 * Segredos, no painel do Supabase em Edge Functions:
 *   NOTION_TOKEN, GEMINI_API_KEY, GEMINI_MODEL
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { Notion } from '../_shared/notion.mjs'
import { criarConsultas } from '../_shared/consultas.mjs'

const BASES = {
  alunos: 'faea7225-c555-4199-b414-02f9baf7dd36',
  playbook: '61c60ce5-cd2a-4445-9b76-ccbc1ffa3d4b',
  alertas: '20f8a59d-97c7-42b1-bb00-47deeb868427',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

const consultas = criarConsultas({
  notion: new Notion(Deno.env.get('NOTION_TOKEN')!),
  bases: BASES,
  geminiKey: Deno.env.get('GEMINI_API_KEY')!,
  modelo: Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash',
})

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

// Mapa fechado. Ação fora dele devolve 400 antes de tocar em qualquer dado.
const ROTAS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  resumo: () => consultas.resumo(),
  alunos: (a) => consultas.listarAlunos(a),
  aluno: (a) => consultas.detalharAluno(a as { alunoId: number }),
  alertas: () => consultas.listarAlertas(),
  perguntar: (a) => consultas.perguntar(a as { texto: string }),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const usuario = await autenticar(req.headers.get('Authorization') ?? '')
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
    const rota = ROTAS[acao]
    if (!rota) return json({ erro: `Ação desconhecida: ${acao}` }, 400)

    const resultado = await rota(args)

    // Auditoria DEPOIS do sucesso. Registrar antes produziria log de consulta
    // que falhou, e "quem viu o quê" deixaria de ser verdade.
    await admin.from('acessos').insert({
      usuario_id: usuario.id,
      acao,
      detalhe: args.alunoId ? { alunoId: args.alunoId } : null,
    })

    return json({ perfil: perfil.nome, ...(resultado as object) })
  } catch (e) {
    console.error(e)
    // Mensagem genérica ao cliente. O corpo de erro do Notion nomeia
    // propriedades e identificadores internos, e isso não é informação que o
    // navegador precisa.
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
