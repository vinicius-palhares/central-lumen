/**
 * A camada de dados do painel.
 *
 * Vive em `_shared/` e não dentro de `painel/index.ts` por um motivo prático:
 * a Edge Function só executa depois de um deploy, e um erro de nome de
 * propriedade do Notion — `'Turma nº'` escrito como `'Turma no'` — só apareceria
 * em produção, como campo silenciosamente vazio. Aqui, o mesmo código roda no
 * Node contra o Notion real (`npm run testar:consultas`) antes de qualquer
 * deploy.
 *
 * A função recebe suas dependências por parâmetro em vez de ler `Deno.env` ou
 * `process.env` diretamente. É o que permite os dois runtimes usarem o mesmo
 * arquivo sem ramificação.
 */

import { ler, textoDosBlocos } from './notion.mjs'
import { avaliarExtensao, avaliarCertificacao, diasDeAcesso } from './regras.mjs'

const TTL_CACHE_MS = 60_000

export function criarConsultas({ notion, bases, geminiKey, modelo }) {
  /**
   * Cache do Playbook, em memória.
   *
   * TTL curto de propósito. A promessa do projeto é que editar a regra no
   * Notion muda o comportamento sem deploy; um cache longo transformaria "sem
   * deploy" em "sem deploy, mas espere uma hora".
   */
  let cache = null

  async function lerPlaybook() {
    if (cache && Date.now() - cache.em < TTL_CACHE_MS) return cache.dados

    const paginas = await notion.consultarTudo(bases.playbook, {
      property: 'Ativa',
      checkbox: { equals: true },
    })

    const dados = []
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

    cache = { em: Date.now(), dados }
    return dados
  }

  function mapearAluno(p) {
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

  async function resumo() {
    const [paginasAluno, paginasAlerta, playbook] = await Promise.all([
      notion.consultarTudo(bases.alunos),
      notion.consultarTudo(bases.alertas),
      lerPlaybook(),
    ])

    const alunos = paginasAluno.map(mapearAluno)
    const ativos = alunos.filter((a) => !['Churn', 'Abandonou', 'Reembolsado'].includes(a.jornada))

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
        // Só conta quem TEM data. Aluno sem turma não está "não vencendo" —
        // ele está fora da pergunta, e somá-lo ao denominador mente sobre a base.
        acessoVencendo: alunos.filter(
          (a) => a.diasDeAcesso !== null && a.diasDeAcesso >= 0 && a.diasDeAcesso <= 30,
        ).length,
        acessoVencido: alunos.filter((a) => a.diasDeAcesso !== null && a.diasDeAcesso < 0).length,
        semTurma: alunos.filter((a) => !a.turma).length,
        alertasAbertos: abertos.length,
        alertasAltos: abertos.filter((a) => a.severidade === 'Alta').length,
      },
      alertasPorTipo: contar(abertos.map((a) => a.tipo)),
      playbook: playbook.map((r) => ({
        titulo: r.titulo,
        categoria: r.categoria,
        status: r.status,
        confianca: r.confianca,
      })),
    }
  }

  async function listarAlunos({ busca, jornada } = {}) {
    const paginas = await notion.consultarTudo(bases.alunos)
    let alunos = paginas.map(mapearAluno)

    // Filtro em memória, não no Notion. A base tem 40 registros e cabe numa
    // resposta; empurrar o filtro para a API custaria uma ida extra por tecla
    // digitada, e a latência é do Notion, não do cliente.
    if (jornada) alunos = alunos.filter((a) => a.jornada === jornada)
    if (busca) {
      const q = normalizar(busca)
      alunos = alunos.filter(
        (a) => normalizar(String(a.nome ?? '')).includes(q) || String(a.alunoId ?? '').includes(q),
      )
    }

    alunos.sort((a, b) => urgencia(a) - urgencia(b))
    return { alunos }
  }

  async function detalharAluno({ alunoId }) {
    const paginas = await notion.consultarTudo(bases.alunos, {
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

    return {
      aluno,
      avaliacao: {
        extensao,
        certificacao: avaliarCertificacao(aluno),
        fonte: regraAcesso
          ? {
              titulo: regraAcesso.titulo,
              status: regraAcesso.status,
              confianca: regraAcesso.confianca,
            }
          : null,
      },
    }
  }

  /**
   * Janela que agrupa os alertas de uma mesma varredura.
   *
   * Uma varredura sobre 40 alunos leva um a dois minutos, e duas varreduras
   * ficam a pelo menos 24 horas de distância. Dez minutos separa as duas coisas
   * com folga larga dos dois lados.
   *
   * A alternativa seria carimbar um identificador de execução em cada alerta,
   * o que é mais explícito — mas exigiria uma propriedade nova na base e
   * regravar o que já existe. Agrupar por proximidade de tempo é suficiente
   * enquanto a varredura for o ÚNICO produtor de alertas, que é o caso: não há
   * caminho de código que crie alerta fora dela.
   */
  const JANELA_DA_VARREDURA_MS = 10 * 60 * 1000

  async function listarAlertas() {
    const paginas = await notion.consultarTudo(bases.alertas)
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
        url: p.url,
      }))
      .sort((a, b) => peso(a.severidade) - peso(b.severidade))

    // "Novo" é o que saiu na varredura mais recente, e não o que a pessoa ainda
    // não viu. A diferença é deliberada: por visita, abrir o painel duas vezes
    // seguidas zeraria a marcação na segunda, o que num painel operacional lê
    // como defeito. Por varredura, a marcação é estável até a próxima execução.
    const carimbos = alertas.map((a) => (a.geradoEm ? Date.parse(a.geradoEm) : NaN)).filter(Number.isFinite)
    const ultimaVarredura = carimbos.length ? Math.max(...carimbos) : null

    for (const a of alertas) {
      const t = a.geradoEm ? Date.parse(a.geradoEm) : NaN
      a.novo = Number.isFinite(t) && ultimaVarredura !== null
        && ultimaVarredura - t <= JANELA_DA_VARREDURA_MS
    }

    const novos = alertas.filter((a) => a.novo).length

    return {
      alertas,
      // O carimbo permite à interface dizer QUANDO foi a varredura, em vez de
      // um "novos" solto que não se ancora em nada.
      ultimaVarredura: ultimaVarredura ? new Date(ultimaVarredura).toISOString() : null,
      novos,
      /**
       * Se destacar os novos acrescenta informação.
       *
       * Quando TODOS os alertas abertos vieram da mesma varredura, marcar cada
       * um de "novo" não distingue nada — só repete a contagem total com outra
       * palavra, e sete marcadores idênticos numa lista de sete itens são ruído
       * puro. Nesse caso a interface mostra a data da varredura, que informa, e
       * omite a marcação, que não informa.
       *
       * A regra vive aqui e não na interface porque é semântica, não
       * apresentação: a pergunta "isto distingue alguma coisa?" se responde
       * onde os dados estão.
       */
      destacarNovos: novos > 0 && novos < alertas.length,
    }
  }

  /**
   * Pergunta em linguagem natural sobre o Playbook.
   *
   * Sem busca vetorial: cinco regras cabem inteiras no prompt, e recuperação
   * por embeddings nessa escala só adiciona um passo que pode errar.
   *
   * A confiança devolvida vem do status de revisão da regra citada, e não de
   * uma autoavaliação do modelo. Modelo perguntado sobre a própria confiança
   * responde o que soa bem.
   */
  async function perguntar({ texto }) {
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
      '- Se o playbook não cobre a pergunta, diga que não há fonte para responder e',
      '  encaminhe ao canal oficial. Não estime, não aproxime.',
      '- Nunca estime valores, preços ou prazos contratuais.',
      '- Ao citar um requisito com números, reproduza os números do playbook.',
      '- Não some nem faça média de mentorias de fases diferentes: os pisos são',
      '  independentes e não se compensam.',
      '',
      'Responda em JSON, sem cerca de código:',
      '{"resposta": "...", "regraCitada": "título exato da regra usada, ou null"}',
    ].join('\n')

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            // Orçamento COMPARTILHADO com o raciocínio interno do modelo, que
            // consome a maior parte. Ver a nota em varredura.mjs. Aqui o corte
            // é pior que lá, porque a resposta é JSON: truncar produz JSON
            // inválido. `thinkingBudget: 0` devolve resposta vazia neste modelo.
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      },
    )
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`)

    const j = await r.json()
    const candidato = j.candidates?.[0]

    if (candidato?.finishReason && candidato.finishReason !== 'STOP') {
      throw new Error(`Gemini interrompeu a geração (${candidato.finishReason})`)
    }

    const bruto = candidato?.content?.parts?.map((p) => p.text).join('') ?? ''

    let saida
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
        ? {
            titulo: regra.titulo,
            categoria: regra.categoria,
            status: regra.status,
            confianca: regra.confianca,
          }
        : null,
    }
  }

  return { resumo, listarAlunos, detalharAluno, listarAlertas, perguntar, lerPlaybook, mapearAluno }
}

// ─── utilitários ──────────────────────────────────────────────────────

/** Vencendo primeiro, vencido depois, sem data por último. */
function urgencia(a) {
  if (a.diasDeAcesso === null) return 1e6
  return a.diasDeAcesso < 0 ? 1e5 - a.diasDeAcesso : a.diasDeAcesso
}

const peso = (s) => ({ Alta: 0, Média: 1, Baixa: 2 })[s] ?? 3

function contar(itens) {
  const m = {}
  for (const i of itens) if (i) m[i] = (m[i] ?? 0) + 1
  return m
}

function normalizar(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
