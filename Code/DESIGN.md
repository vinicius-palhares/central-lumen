---
name: Central Lumen
description: Painel de monitoramento operacional onde toda afirmação vem acompanhada da conta que a sustenta.
colors:
  fundo: "hsl(0 0% 98%)"
  superficie: "hsl(0 0% 100%)"
  superficie-alta: "hsl(240 20% 97%)"
  borda: "hsl(240 6% 90%)"
  borda-forte: "hsl(240 6% 80%)"
  texto: "hsl(240 10% 12%)"
  texto-suave: "hsl(240 5% 42%)"
  texto-fraco: "hsl(240 5% 58%)"
  marca: "hsl(243 75% 58%)"
  marca-contraste: "hsl(0 0% 100%)"
  marca-suave: "hsl(243 75% 96%)"
  alta: "hsl(0 72% 48%)"
  alta-suave: "hsl(0 86% 96%)"
  media: "hsl(32 90% 44%)"
  media-suave: "hsl(36 92% 95%)"
  baixa: "hsl(240 5% 46%)"
  baixa-suave: "hsl(240 10% 95%)"
  ok: "hsl(152 62% 36%)"
  ok-suave: "hsl(152 60% 95%)"
  confianca-alta: "hsl(200 80% 38%)"
  confianca-media: "hsl(280 45% 50%)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  prova:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "0.375rem"
  md: "0.625rem"
  pill: "9999px"
spacing:
  grupo: "0.5rem"
  bloco: "1.5rem"
  secao: "2.5rem"
components:
  botao-primario:
    backgroundColor: "{colors.marca}"
    textColor: "{colors.marca-contraste}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    typography: "{typography.body}"
  botao-secundario:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
    typography: "{typography.body}"
  cartao:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.md}"
    padding: "1rem"
  campo:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
    typography: "{typography.body}"
  chip-severidade-alta:
    backgroundColor: "{colors.alta-suave}"
    textColor: "{colors.alta}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
  chip-confianca-alta:
    backgroundColor: "{colors.superficie-alta}"
    textColor: "{colors.confianca-alta}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
    typography: "{typography.label}"
---

# Design System: Central Lumen

## Overview

**Creative North Star: "O Livro de Ocorrências"**

Um livro de ocorrências registra fato, hora e responsável. Não opina, não
enfeita, e não pede que você acredite nele — ele mostra o registro. A Central
Lumen é construída sobre a mesma promessa: cada alerta traz a conta
determinística que o sustenta ao lado da leitura redigida por modelo, e o
próprio alerta declara que, havendo divergência, a conta prevalece. A interface
existe para tornar essa promessa visível.

Isso decide quase tudo. A tipografia é neutra porque a voz é do registro, não do
sistema. A cor é escassa porque, quando ela aparece, precisa significar algo. O
monoespaçado aparece exatamente uma vez — no bloco da conta — e essa raridade é
o que faz o bloco ler como evidência em vez de decoração.

O caráter buscado é **calmo, arejado e confiável**. Vale registrar uma tensão
honesta: a implementação atual é mais densa do que "arejada" — o painel usa
texto de 12 a 14px e 16px entre cards, e é legítimo para uma coordenação que
varre muitos casos. "Arejado" aqui é **direção**, não descrição. Quando houver
dúvida entre apertar e respirar numa tela nova, respire.

O sistema tem dois temas completos e equivalentes. O escuro não é uma inversão
mecânica do claro: as cores de estado foram ajustadas separadamente.

**Key Characteristics:**

- Cor é vocabulário, não enfeite. Nenhuma cor aparece sem significar estado, ação ou procedência.
- Duas escalas de cor coexistem e nunca se misturam: severidade e confiança.
- Ausência de dado é um estado próprio, distinto de zero, e tem tratamento visual próprio.
- Números que mudam usam algarismos tabulares, sempre.
- Nenhuma classe de cor literal do Tailwind. Toda cor sai de um token.

## Colors

Paleta neutra fria com um único anil institucional e duas escalas semânticas
independentes. Todos os valores vivem como triplas HSL em `src/styles.css` e são
consumidos por utilitários do Tailwind mapeados sobre elas.

### Primary

- **Anil Institucional** (`--marca`): a cor da ação. Botão de envio, link para o
  Notion, preenchimento da barra de presença, anel de foco. Aparece em pouco mais
  que isso, e a contenção é o que a mantém legível.
- **Anil Suave** (`--marca-suave`): fundo de apoio da mesma família, para
  superfície de destaque discreto.

### Secondary — a escala de severidade

Fala do **caso**. Cada tom tem um par suave usado como fundo do chip.

- **Vermelho de Urgência** (`--alta` / `--alta-suave`): acesso vencendo em até
  sete dias, certificação bloqueada, critério reprovado. Também colore o prazo
  na lista de alunos quando já venceu.
- **Âmbar de Atenção** (`--media` / `--media-suave`): a janela dos 30 dias, e o
  aviso de que a resposta se apoia em regra pendente de revisão.
- **Cinza de Registro** (`--baixa` / `--baixa-suave`): desengajamento e
  situações indeterminadas. Deliberadamente sem matiz: o que não é urgente não
  deve competir por atenção.
- **Verde de Conformidade** (`--ok` / `--ok-suave`): critério cumprido, veredito
  elegível. O uso mais raro da paleta.

### Tertiary — a escala de confiança da fonte

Fala da **fonte**, não do caso.

- **Ciano de Fonte Revisada** (`--confianca-alta`): a regra citada está publicada.
- **Violeta de Fonte Pendente** (`--confianca-media`): a regra está para revisar,
  e a resposta carrega ressalva.

### Neutral

- **Papel** (`--fundo`) e **Superfície** (`--superficie`): o fundo da página e o
  dos cards, separados por um degrau mínimo de luminosidade.
- **Superfície Alta** (`--superficie-alta`): blocos embutidos — a conta
  monoespaçada, o trilho da barra de presença, o fundo de botão secundário.
- **Borda** e **Borda Forte** (`--borda`, `--borda-forte`): contorno de card e
  contorno de controle, respectivamente. A borda forte marca o que é acionável.
- **Texto**, **Texto Suave**, **Texto Fraco**: conteúdo, rótulo, e ausência.
  `--texto-fraco` é a cor do traço `—` e de tudo que significa "não informado".

### Named Rules

**A Regra das Duas Escalas.** Severidade fala do CASO; confiança fala da FONTE.
As duas escalas nunca compartilham matiz, e essa separação é intencional: um
alerta grave apoiado em fonte revisada precisa ser distinguível de um alerta
leve apoiado em fonte pendente. Pintar o chip de confiança com verde ou âmbar
destrói a distinção sem que nada quebre. Teste: se você consegue confundir um
chip de confiança com um chip de severidade a três metros da tela, a regra foi
violada.

**A Regra do Traço.** Ausência de dado se escreve `—` em `--texto-fraco`, nunca
`0`, nunca `null`, nunca campo vazio. Um aluno sem turma não tem zero presenças:
ele não tem presença registrada, e a diferença muda a decisão da coordenação.
Barra de progresso sem dado fica vazia com o rótulo "não informado", e não em 0%.

## Typography

**Fonte de interface:** a pilha de sistema (`ui-sans-serif, system-ui`). Não há
fonte customizada, e a ausência é adequada: o registro não tem voz própria.

**Fonte de evidência:** a pilha monoespaçada de sistema (`ui-monospace`).

**Caráter:** neutro por escolha. A hierarquia vem de tamanho e peso, não de
família. A única troca de família no produto inteiro carrega significado.

### Hierarchy

- **Display** (600, 1.5rem, tabular): os números da faixa de indicadores. É o
  maior texto do painel, e é um número — o que diz o que a tela é.
- **Title** (600, 1rem): título de seção e nome no cabeçalho.
- **Body** (400–500, 0.875rem): conteúdo dos cards, leitura gerada, valores.
- **Label** (400, 0.75rem): rótulos, chips, prazos, metadados.
- **Prova** (400, 0.75rem, monoespaçada): exclusiva do bloco "conta que
  sustenta". Quebras preservadas, rolagem horizontal própria.

### Named Rules

**A Regra do Monoespaçado.** A fonte monoespaçada aparece em um lugar só: a
conta determinística. Ela não é escolha estética — é o sinal de que aquele texto
foi computado, não redigido. Usá-la em qualquer outro lugar gasta a distinção.

**A Regra dos Algarismos Tabulares.** Todo número que muda entre renderizações
usa `font-variant-numeric: tabular-nums`, via a classe `.tabular`. Vale para os
indicadores, contagens de seção, datas de prazo e presenças. Sem isso a faixa de
indicadores dança quando os valores atualizam.

## Layout

Container central de no máximo `88rem` (`--largura-painel`), centrado por
margem lógica, com recuo lateral de 16px que sobe para 24px em 640px e 32px em
1024px. Todo espaçamento direcional usa propriedades lógicas.

**Escala de espaçamento, com três degraus e nomes semânticos:** `grupo` (8px)
dentro de um grupo, `bloco` (24px) entre grupos, `secao` (40px) entre seções
principais.

A área principal é uma grade de coluna única que vira `3fr 2fr` a partir de
900px — alertas na coluna principal, alunos na secundária. Abaixo disso empilha,
e alertas vêm primeiro. A faixa de indicadores usa
`repeat(auto-fit, minmax(9.5rem, 1fr))`, sem nenhuma media query.

### Named Rules

**A Regra da Quebra pelo Conteúdo.** Os pontos de quebra vêm de onde o conteúdo
deixa de caber, nunca de preset de aparelho. Os 900px da área principal são o
ponto em que a coluna de alunos passa a truncar nome; a faixa de indicadores nem
tem breakpoint, porque `auto-fit` resolve. Se você escrever `md:` ou `lg:` numa
tela nova, justifique com o conteúdo.

**A Regra do Dobro.** O espaço entre grupos é no mínimo o dobro do espaço dentro
do grupo. Agrupe por espaço, não por linha divisória: só use borda onde o espaço
sozinho não sustenta a estrutura, como o contorno de um card sobre o fundo.

## Elevation & Depth

O sistema é **plano na prática**: não há nenhum `box-shadow` no código, e as
superfícies se separam por borda de 1px mais um degrau de luminosidade. Em três
níveis: fundo, superfície, superfície alta.

Isso é preferência, e não invariante. Sombra sutil é aceitável onde ajudar a
separar camada sobreposta — o Sheet de detalhe e o Drawer hoje se distinguem só
por cor de fundo, e são os candidatos naturais. O limite: sombra não pode virar
um segundo vocabulário de destaque competindo com a severidade.

## Shapes

Duas curvaturas. `0.625rem` (`--raio`, o `md`) para superfícies — cards, o Sheet,
o card de login. `0.375rem` (`sm`) para controles e blocos embutidos — botões,
campos, chips, o bloco da conta. A barra de presença é a única forma totalmente
arredondada.

O card de alerta é a única forma assimétrica do sistema: borda inicial de 3px na
cor da severidade, aplicada com `border-inline-start` para acompanhar a direção
do texto. É a marca de estado mais forte da interface e a única barra colorida.

## Components

### Botões

- **Forma:** cantos suaves (`0.375rem`).
- **Primário:** fundo anil, texto de contraste, `0.5rem 1rem`. Um por tela, no
  máximo: Entrar, Perguntar.
- **Secundário:** superfície com borda forte, texto padrão. Tentar de novo,
  Sair, Ver a conta, Limpar a busca.
- **Estados:** transição de cor ou opacidade, sempre com propriedade explícita —
  nunca `transition: all`. Desabilitado reduz a opacidade e mantém o rótulo.

### Chips

- **Estilo:** fundo suave da própria escala, texto na cor cheia, sem borda.
- **Severidade:** o par `--alta-suave`/`--alta` e equivalentes.
- **Confiança:** fundo `--superficie-alta` neutro com texto na cor da confiança.
  O fundo neutro é deliberado — reforça que a escala é outra.

### Cards

- **Curvatura:** `0.625rem`. **Fundo:** superfície. **Borda:** 1px.
- **Padding interno:** 16px nos cards de conteúdo, 12px nas linhas de lista.
- **Variante de alerta:** acrescenta a borda inicial de 3px na cor da severidade.

### Campos

- **Estilo:** superfície com borda de 1px, curvatura `sm`, `0.5rem 0.75rem`.
- **Foco:** anel visível de 2px em anil, via `focus-visible`, com deslocamento
  sobre a superfície.
- **Busca:** ícone de lupa embutido à esquerda, com o recuo compensado.

### Barra de fase

O componente que carrega a tese do produto. Trilho em `--superficie-alta`,
preenchimento em anil, com o par "presente de total" em tabular acima. Sem dado,
o trilho fica vazio e o rótulo diz "não informado".

**Nunca some duas fases numa barra só.** As regras da instituição definem pisos
independentes por fase, e uma barra agregada mostraria "50%, quase lá" escondendo
exatamente a informação que decide o caso.

## Do's and Don'ts

### Do:

- **Do** tirar toda cor de um token de `src/styles.css`.
- **Do** manter as duas escalas de cor separadas por matiz.
- **Do** escrever ausência como `—` em `--texto-fraco`, e barra vazia rotulada.
- **Do** aplicar `.tabular` em qualquer número que mude.
- **Do** derivar breakpoint do conteúdo, e preferir `auto-fit` a media query.
- **Do** dar ao espaço entre grupos ao menos o dobro do espaço interno.
- **Do** verificar toda mudança de cor nos dois temas.

### Don't:

- **Don't** usar classe de cor literal do Tailwind (`bg-red-500`, `text-gray-600`).
- **Don't** usar o anil para comunicar estado, nem cor de severidade para ação.
- **Don't** usar monoespaçado fora do bloco da conta.
- **Don't** renderizar `0` onde o dado é ausente, nem `null`, nem `NaN`.
- **Don't** somar ou tirar média das fases de presença numa barra única.
- **Don't** truncar nome de pessoa com reticências: deixe quebrar em duas linhas.
- **Don't** remover o anel de foco sem substituir por um anel visível equivalente.
- **Don't** escrever `transition: all`.
