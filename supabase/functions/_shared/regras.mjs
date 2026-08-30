/**
 * Motor de regras da Central.
 *
 * Este arquivo NÃO contém regra de negócio. Contém a *aritmética* que as regras
 * do Playbook precisam para serem avaliadas, e o registro auditável de como
 * cada número foi obtido.
 *
 * A distinção importa e é o eixo do projeto:
 *
 *   - O TEXTO da regra ("mínimo de 4 mentorias do CARPA e 3 de Pilares") vive
 *     na base Playbook do Notion. A coordenação edita lá, sem deploy.
 *   - Os LIMIARES que a aritmética usa são extraídos do texto da regra em
 *     runtime, não fixados aqui.
 *   - O que este arquivo garante é que a conta seja feita do jeito certo:
 *     pisos separados por fase, nunca média.
 *
 * Por que a média está proibida: 4 de 5 no CARPA com 2 de 7 em Pilares dá 6 de
 * 12, ou 50%, e um sistema que agrega diria "você está quase lá". A regra
 * define pisos por fase justamente porque as duas fases não são substituíveis
 * entre si. Agregar destrói a informação de que a regra depende.
 */

/** Piso padrão, usado só quando o Playbook não declara os seus. */
export const PISOS_PADRAO = { carpa: 4, pilares: 3, modulosFaltantesMax: 2 }

/**
 * Extrai os limiares numéricos do texto da regra.
 *
 * Casa com as formas que a coordenação de fato escreve:
 *   "no mínimo 4 mentorias do CARPA e 3 de Pilares"
 *   "pelo menos 4 do CARPA"
 *   "faltam um ou dois módulos"  -> 2
 *
 * Se o texto não declara um limiar, o padrão entra e a origem é marcada como
 * 'padrão' no rastro. Um alerta sustentado por padrão em vez de texto é um
 * alerta que a coordenação precisa saber que está frouxo.
 */
export function extrairPisos(textoRegra = '') {
  const t = textoRegra.toLowerCase()
  const origem = { carpa: 'padrão', pilares: 'padrão', modulosFaltantesMax: 'padrão' }
  const pisos = { ...PISOS_PADRAO }

  const carpa = t.match(/(\d+)\s*(?:mentorias?\s*)?(?:do\s*|de\s*)?carpa/)
  if (carpa) {
    pisos.carpa = Number(carpa[1])
    origem.carpa = 'texto'
  }

  const pilares = t.match(/(\d+)\s*(?:mentorias?\s*)?(?:de\s*|do\s*)?pilares/)
  if (pilares) {
    pisos.pilares = Number(pilares[1])
    origem.pilares = 'texto'
  }

  // "um ou dois módulos" é a forma escrita; "2 módulos" é a forma numérica.
  if (/dois\s+m[óo]dulos/.test(t)) {
    pisos.modulosFaltantesMax = 2
    origem.modulosFaltantesMax = 'texto'
  } else {
    const mods = t.match(/(\d+)\s*m[óo]dulos?\s*(?:faltantes?|restantes?)?/)
    if (mods) {
      pisos.modulosFaltantesMax = Number(mods[1])
      origem.modulosFaltantesMax = 'texto'
    }
  }

  return { pisos, origem }
}

/**
 * Avalia a elegibilidade à extensão de acesso.
 *
 * Devolve sempre a conta completa, inclusive quando nega. O motivo é de
 * governança, não de estética: um alerta que diz "não elegível" sem mostrar
 * qual piso falhou não é auditável, e a coordenação não tem como contestar.
 *
 * `null` em qualquer contador significa "não informado", e não zero. Um aluno
 * sem turma não reprovou no piso — ele não tem piso a cumprir ainda.
 */
export function avaliarExtensao(aluno, textoRegra) {
  const { pisos, origem } = extrairPisos(textoRegra)

  const carpa = aluno.carpaPresente
  const pilares = aluno.pilaresPresente
  const modulos = aluno.modulosFaltantes

  const indeterminado = carpa == null || pilares == null

  const criterios = [
    {
      nome: 'Mentorias do CARPA',
      obtido: carpa,
      piso: pisos.carpa,
      total: aluno.carpaTotal,
      origemPiso: origem.carpa,
      atende: carpa == null ? null : carpa >= pisos.carpa,
    },
    {
      nome: 'Mentorias de Pilares',
      obtido: pilares,
      piso: pisos.pilares,
      total: aluno.pilaresTotal,
      origemPiso: origem.pilares,
      atende: pilares == null ? null : pilares >= pisos.pilares,
    },
    {
      nome: 'Módulos faltantes',
      obtido: modulos,
      piso: pisos.modulosFaltantesMax,
      total: null,
      origemPiso: origem.modulosFaltantesMax,
      // Este é um TETO, não um piso: falta no máximo N módulos.
      atende: modulos == null ? null : modulos <= pisos.modulosFaltantesMax,
      teto: true,
    },
  ]

  const reprovados = criterios.filter((c) => c.atende === false)
  const elegivel = indeterminado ? null : reprovados.length === 0

  return {
    elegivel,
    indeterminado,
    criterios,
    reprovados,
    conta: redigirConta(criterios, elegivel),
  }
}

/**
 * Transcreve os critérios em texto literal.
 *
 * Gerado em código de propósito. Esta string é a âncora de auditoria do alerta:
 * se o modelo escrever uma leitura que contradiga estes números, a divergência
 * fica visível lado a lado na mesma página do Notion.
 */
function redigirConta(criterios, elegivel) {
  const linhas = criterios.map((c) => {
    if (c.obtido == null) return `${c.nome}: não informado`
    const alvo = c.teto ? `no máximo ${c.piso}` : `mínimo ${c.piso}`
    const base = c.total == null ? `${c.obtido}` : `${c.obtido} de ${c.total}`
    const marca = c.atende ? 'cumpre' : 'NÃO cumpre'
    const nota = c.origemPiso === 'padrão' ? ' [limiar padrão, não declarado no Playbook]' : ''
    return `${c.nome}: ${base} — ${alvo}, ${marca}${nota}`
  })

  const veredito =
    elegivel === null
      ? 'Indeterminado: faltam dados de presença.'
      : elegivel
        ? 'Todos os critérios cumpridos.'
        : 'Reprovado por critério isolado — os pisos são independentes, não se compensam.'

  return [...linhas, veredito].join('\n')
}

/**
 * Certificação: turma 41 em diante exige plano de acompanhamento entregue.
 *
 * Separada da extensão porque são regras distintas com fontes distintas no
 * Playbook. Fundi-las numa função só faria um alerta citar a regra errada.
 */
export function avaliarCertificacao(aluno) {
  if (aluno.turmaNumero == null) return { bloqueada: null, motivo: 'Sem turma atribuída.' }
  if (aluno.turmaNumero < 41) return { bloqueada: false, motivo: 'Turma anterior à 41: plano não é exigido.' }

  const entregue = aluno.plano === 'Entregue' || aluno.plano === 'Entregue após prazo'
  return {
    bloqueada: !entregue,
    motivo: entregue
      ? `Turma ${aluno.turmaNumero}: plano de acompanhamento ${aluno.plano.toLowerCase()}.`
      : `Turma ${aluno.turmaNumero} exige plano de acompanhamento, e consta "${aluno.plano ?? 'não informado'}".`,
  }
}

/** Dias inteiros entre hoje e o fim do acesso. Negativo = já venceu. */
export function diasDeAcesso(acessoAte, hoje = new Date()) {
  if (!acessoAte) return null
  const fim = new Date(`${acessoAte}T00:00:00Z`)
  const ref = new Date(`${hoje.toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((fim - ref) / 86400000)
}
