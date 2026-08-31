# Prompt de revisão de interface — Central Lumen

Cole o bloco abaixo **inteiro, de uma vez**, no Lovable.

## Antes de colar, leia isto

Este prompt junta **duas coisas**:

1. **Parte A** — correções que já foram aplicadas na cópia local do código
   (`Code/`), mas que **o Lovable ainda não tem**. Sem elas, o projeto no
   Lovable e o repositório divergem.
2. **Parte B** — os achados da revisão cruzada de interface, cobrindo
   acessibilidade, layout, escrita, tipografia, cor e polimento.

Os achados estão ordenados por impacto. Os dois primeiros são sistêmicos e de
alta alavancagem: consertam um token ou um padrão repetido, não um componente
isolado.

Se preferir dividir, corte na linha marcada `━━━ CORTE OPCIONAL ━━━`. O que vem
antes é o que mais importa.

---

```
Revisão de interface do Central Lumen. Aplique tudo abaixo, na ordem.

Preserve o sistema existente: tokens HSL em src/styles.css, utilitários do
Tailwind, componentes do shadcn/ui, e a escala de espaçamento --spacing-grupo
(8px) / --spacing-bloco (24px) / --spacing-secao (40px). Não introduza uma
segunda forma de escrever cor nem uma segunda biblioteca de ícones.


═══════════════════════════════════════════════════════════════════
PARTE A — sincronizar com o que já foi corrigido fora do Lovable
═══════════════════════════════════════════════════════════════════

A1. ERRO DE LOGIN EM PORTUGUÊS, COMO INSTRUÇÃO

Hoje o erro do Supabase é repassado cru: "Invalid login credentials", em inglês,
num app em português, dizendo o problema e não o que fazer.

Crie em src/lib/formato.ts:

export function erroDeLogin(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos. Confira os dois e tente de novo.";
  if (m.includes("email not confirmed"))
    return "Este e-mail ainda não foi confirmado. Peça a confirmação à coordenação.";
  if (m.includes("too many requests") || m.includes("rate limit"))
    return "Tentativas demais em pouco tempo. Espere um minuto e tente de novo.";
  if (m.includes("network") || m.includes("fetch"))
    return "Não foi possível conectar. Verifique sua conexão e tente de novo.";
  if (m.includes("user not found"))
    return "E-mail ou senha incorretos. Confira os dois e tente de novo.";
  return "Não foi possível entrar. Tente de novo em alguns instantes.";
}

Use em src/routes/login.tsx: setErro(erroDeLogin(error.message)).

"user not found" devolve a MESMA mensagem de credencial inválida, de propósito:
respostas diferentes revelam quais e-mails existem no sistema.

A2. O BOTÃO DO CARD DE ALERTA ACOMPANHA O ESTADO

Em src/components/ListaAlertas.tsx o rótulo é "Ver a conta" mesmo com a conta
aberta. Troque por: {aberto ? "Ocultar a conta" : "Ver a conta"}

A3. ESTADOS VAZIOS QUE ORIENTAM

Dê ao componente ListaVazia (src/components/comuns.tsx) duas props opcionais:
`detalhe?: string` e `acao?: { rotulo: string; aoClicar: () => void }`.
A mensagem vira o título (font-medium, text-texto), o detalhe vem abaixo com
mt-grupo em text-texto-suave, e a ação vira um botão com mt-bloco.

Aplique:
- Alertas vazio: mensagem "Nenhum alerta aberto", detalhe "A varredura roda de
  segunda a sexta e abre um alerta sempre que encontra um caso que exige ação
  da coordenação."
- Alunos, com busca ativa: mensagem `Nenhum aluno encontrado para "{termo}"`,
  detalhe "A busca olha nome e e-mail.", ação { rotulo: "Limpar a busca" } que
  esvazia o campo.
- Alunos, sem busca: mensagem "Nenhum aluno cadastrado", detalhe "Rode o script
  de carga para popular a base de alunos no Notion."

O vazio de busca PRECISA da saída: ele é consequência de um filtro que a pessoa
aplicou, e sem botão ela tem que descobrir sozinha como voltar.

A4. TÍTULO DO 403

Em src/components/PerfilBloqueado.tsx o h1 é uma frase com ponto final que
repete o corpo. Troque o h1 por "Acesso ainda não liberado" e o parágrafo por:
"Sua conta existe e a senha está correta. Falta a coordenação liberar o acesso
ao painel. Procure quem administra a Central para pedir a liberação."

A5. UMA CAPITALIZAÇÃO SÓ

- Chip de procedência: "confiança Alta" vira "Confiança alta" — capitalize a
  primeira palavra e baixe o valor: `Confiança ${confianca.toLowerCase()}`.
  Sem confiança: "Confiança não informada".
- "sem fonte identificada" vira "Sem fonte identificada".
- "sem turma" vira "Sem turma" (ListaAlunos e DetalheAluno).

A6. ESPAÇAMENTO E AGRUPAMENTO

- Card de alerta (ListaAlertas): o gap interno era 12px e o gap entre cards
  16px — razão de 1,33. O espaço entre grupos precisa ser pelo menos o DOBRO do
  espaço interno, senão o agrupamento não é lido. Use gap-grupo (8px) dentro do
  card e mantenha 16px entre cards.
- Remova as classes mt-3 do link "Abrir no Notion" e do texto "Sem link no
  Notion": elas empilham com o gap do container e criam uma borda solta. O
  espaço vem do container.
- ListaAlunos: envolva o título e o campo de busca num div com gap-grupo, para
  que formem um grupo separado da lista (que fica a 24px do pai).

A7. NOME DO PERFIL NO CELULAR

Em src/components/Cabecalho.tsx o nome do perfil tem `hidden ... sm:inline`,
então no celular não dá para saber quem está logado. Troque por
`max-w-[8rem] truncate ... sm:max-w-[14rem]`, sem hidden.


═══════════════════════════════════════════════════════════════════
PARTE B — achados da revisão de interface
═══════════════════════════════════════════════════════════════════

B1. [CRÍTICO — acessibilidade] FOCO INVISÍVEL NOS CAMPOS

Os quatro campos de texto usam `focus:outline-none` e substituem o anel apenas
por uma troca de cor de borda:

  src/routes/login.tsx  — campo de e-mail e campo de senha
  src/components/ListaAlunos.tsx — campo de busca
  src/components/PerguntaPlaybook.tsx — campo de pergunta

Isso falha duas vezes: quem navega por teclado perde a indicação de onde está,
e a única pista restante é cor, que não serve sozinha.

Em TODOS os quatro, remova `focus:outline-none` e `focus:border-marca`, e use:

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-[hsl(var(--marca))]
  focus-visible:ring-offset-2
  focus-visible:ring-offset-[hsl(var(--superficie))]

`focus-visible` e não `focus`: quem clica com o mouse não vê o anel, quem usa
teclado vê. Verifique o anel nos dois temas.

B2. [CRÍTICO — cor] CONTRASTE DO TEMA CLARO

Medi os pares renderizados no tema claro. Cinco falham o mínimo de 4,5:1 para
texto, e o pior é o chip "Média", que é o mais frequente do painel:

  media sobre media-suave              2,99:1   ← chip Média e aviso de ressalva
  texto-fraco sobre superficie         3,22:1   ← traços, status, "Sem link"
  media sobre superficie               3,24:1   ← data de prazo na lista
  ok sobre ok-suave                    3,53:1   ← selo "Elegível"
  baixa sobre baixa-suave              4,37:1
  confianca-alta sobre superficie-alta 4,36:1

O tema escuro passa em todos — o problema é só do claro.

Em src/styles.css, no bloco :root (tema claro), ajuste APENAS a luminosidade,
preservando matiz e saturação:

  --media:           32 90% 35%;    /* era 44% */
  --texto-fraco:     240 5% 49%;    /* era 58% */
  --ok:              152 62% 31%;   /* era 36% */
  --baixa:           240 5% 45%;    /* era 46% */
  --confianca-alta:  200 80% 37%;   /* era 38% */

Não mexa no bloco do tema escuro. Depois de aplicar, confira os mesmos pares.

B3. [tipografia] CAMPOS A 14px DÃO ZOOM NO iOS

Os mesmos quatro campos do B1 usam `text-sm` (14px). O Safari no iPhone dá
zoom na página inteira quando um campo tem texto abaixo de 16px, e o usuário
fica com o layout deslocado.

Troque `text-sm` por `text-base sm:text-sm` nos quatro. Não use
`maximum-scale=1` para resolver: isso bloqueia o zoom e é pior.

B4. [acessibilidade] A PÁGINA DO PAINEL NÃO TEM h1

src/routes/index.tsx só tem h2 (os títulos de seção). O "Central Lumen" do
cabeçalho é um span. Quem navega por cabeçalhos com leitor de tela não tem um
ponto de entrada.

Transforme o "Central Lumen" do Cabecalho.tsx num h1 (mantendo o tamanho visual
atual — semântica e tamanho são decisões separadas).

Adicione também um link "Pular para o conteúdo" como primeiro elemento
focalizável da página, visível só quando recebe foco, apontando para o <main>
(dê id="conteudo" ao main). O cabeçalho fixo se repete em toda navegação.

B5. [acessibilidade] O BLOCO DA CONTA NÃO É ALCANÇÁVEL POR TECLADO

Em ListaAlertas.tsx o bloco monoespaçado tem `overflow-x-auto`. Região que rola
precisa ser focalizável, senão quem usa só teclado não consegue rolá-la.

Adicione ao div que rola: tabIndex={0} role="region" aria-label="Conta que
sustenta o alerta", e o mesmo estilo de foco do B1.

B6. [acessibilidade] MOVIMENTO SEM RESPEITAR A PREFERÊNCIA

Os esqueletos de carregamento usam `animate-pulse`, que é movimento contínuo, e
não há nenhuma regra de prefers-reduced-motion no projeto.

Adicione em src/styles.css:

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

B7. [acessibilidade] O ERRO DE LOGIN NÃO SE LIGA AOS CAMPOS

O parágrafo de erro tem role="alert", mas os campos não apontam para ele.

Dê id="erro-login" ao parágrafo. Quando houver erro, ponha nos dois campos
aria-invalid={true} e aria-describedby="erro-login", e mova o foco para o campo
de e-mail. Mantenha o botão de enviar habilitado — validação acontece no envio.

B8. [tipografia] LINHA LONGA DEMAIS NO TEXTO DO ALERTA

Em 1440px a coluna de alertas tem cerca de 800px. O parágrafo da leitura, a 14px,
passa de 100 caracteres por linha; o olho perde a linha seguinte. O confortável
fica entre 60 e 75.

Adicione `max-w-[68ch]` ao parágrafo da leitura no CardAlerta. A largura do card
não muda — só a do texto dentro dele.

B9. [polimento] SEM RETORNO TÁTIL NO CLIQUE

Nenhum botão do projeto tem feedback de pressão. Adicione
`active:scale-[0.96] transition-transform` aos botões de ação: Entrar, Sair,
Perguntar, Ver a conta, Tentar de novo, Limpar a busca, e o alternador de tema.

Use exatamente 0.96. Abaixo de 0.95 o efeito fica exagerado.

B10. [tipografia] SUAVIZAÇÃO DE FONTE NA RAIZ

No macOS o texto renderiza mais pesado que o pretendido. Adicione a classe
`antialiased` ao <body> em src/routes/__root.tsx. Uma vez na raiz cobre tudo.


═══════════════════════════════════════════════════════════════════
VERIFICAÇÃO — faça antes de dizer que terminou
═══════════════════════════════════════════════════════════════════

1. Navegue a tela inteira só com Tab, sem mouse, nos dois temas. Todo controle
   focalizado precisa mostrar um anel visível — inclusive os quatro campos e o
   bloco da conta.
2. Tema claro: o chip "Média" e o selo "Elegível" precisam estar legíveis.
3. Em 375px, nenhum campo pode dar zoom ao receber foco no iOS.
4. Em 375px e 1440px: sem rolagem horizontal na página.
5. Estados vazios: force a busca por um termo inexistente e confirme que o botão
   "Limpar a busca" aparece e funciona.
6. O erro de login precisa aparecer em português.
```

---

━━━ CORTE OPCIONAL ━━━

Se dividir em dois prompts, mande **Parte A + B1 + B2** primeiro. São as
correções sistêmicas. O resto pode ir depois sem risco de conflito.

---

## O que ficou de fora, e por quê

| Candidato | Rejeitado porque |
|---|---|
| Converter os tokens HSL para OKLCH | O sistema HSL é consistente e cobre os dois temas. Trocar a notação por causa de um ajuste isolado introduz uma segunda forma de escrever cor sem ganho para quem usa. |
| Raio concêntrico nos cards | `rounded-lg` externo com `rounded-md` interno e 16px de padding. A regra vale para elementos muito próximos; a essa distância a diferença não é perceptível. |
| Trocar `role="img"` da barra por `role="progressbar"` | Os números já estão em texto logo acima da barra. `progressbar` faria o leitor de tela anunciar o valor duas vezes. |
| Rótulo visível no campo de busca | Ícone de lupa mais placeholder é padrão estabelecido de busca, e o `aria-label` já dá o nome acessível. |
| Reduzir a espessura dos ícones para 1,5px | Os ícones ficam ao lado de texto `font-medium`. A espessura padrão de 2px do lucide está dentro da faixa aceitável, e mudar exigiria tocar em todos os usos. |

## Cobertura da revisão

| Domínio | Evidência | Resultado |
|---|---|---|
| Acessibilidade | 4 campos, 7 botões, cabeçalho, `styles.css`, estrutura de cabeçalhos | 5 achados |
| Layout | `styles.css` (container, grade, faixa), 3 listas, card de alerta | 1 achado (A6) |
| Escrita | login, 403, vazios, chips, rótulos de botão | 5 achados (A1–A5) |
| Tipografia | tamanhos de campo, medida de linha, `tabular`, raiz | 3 achados |
| Cor | 12 pares medidos nos dois temas | 1 achado sistêmico (5 pares) |
| Polimento | transições, raio, estados de pressão, ícones | 1 achado |

**Não verificado:** leitor de tela real (NVDA/VoiceOver) e navegação por teclado
no app publicado — as mudanças da Parte A ainda não estão no Lovable, então o
que está no ar não corresponde ao código revisado.

**Veredito:** `Block` — os achados B1 e B2 são de severidade alta.
