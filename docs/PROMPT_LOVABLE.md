# Prompt para o Lovable

## Ordem de operações

A ordem importa e não é preferência.

1. Cole o conteúdo de `docs/TOKENS.css` como **primeira mensagem**, pedindo só
   para aplicar como tema. Nenhum componente ainda.
2. Cole o **Prompt inicial** abaixo.
3. Conecte a integração nativa do Supabase quando o Lovable pedir. **Diferente
   do projeto anterior, aqui ela é necessária** — o login usa Supabase Auth.
4. Rode os **prompts de refino**, um por vez, na ordem.

Se você pedir a interface antes do tema, o Lovable espalha classe de cor
literal (`bg-red-500`, `text-gray-600`) pelo código gerado e depois ignora
metade das variáveis. Corrigir isso custa mais prompt do que fazer na ordem.

---

## Prompt inicial

```
Construa uma aplicação React com Vite, Tailwind e shadcn/ui, em português do
Brasil, chamada Central Lumen. É um painel de monitoramento operacional usado
pela coordenação de uma escola.

Use a integração do Supabase para AUTENTICAÇÃO apenas (e-mail e senha).
NÃO crie tabelas. NÃO leia nem escreva no banco pelo cliente. Todo dado da tela
vem de uma Edge Function que já existe.

=== AUTENTICAÇÃO ===

Login com e-mail e senha via supabase.auth.signInWithPassword.
Sem tela de cadastro: contas são criadas pela coordenação. Se alguém tentar
entrar sem conta, mostre a mensagem de erro do Supabase, não invente fluxo.

Rota protegida: sem sessão ativa, qualquer rota redireciona para /login.
Ao sair, supabase.auth.signOut() e volta para /login.

=== API ===

Endpoint único, sempre POST:
  https://xyfyzghiajonvyrocqno.supabase.co/functions/v1/painel

Headers em toda chamada:
  Content-Type: application/json
  Authorization: Bearer <access_token da sessão do Supabase>
  apikey: sb_publishable_WP1XL-orbytZNRFYGC7N1Q_o4R4jDI4

O access_token sai de supabase.auth.getSession(). Se a API responder 401,
derrube a sessão e mande para /login. Se responder 403, mostre a mensagem
"Perfil ainda não liberado pela coordenação." numa tela própria, com botão de
sair — NÃO redirecione para /login, porque a credencial está correta e o laço
nunca resolveria.

Cinco ações, escolhidas pelo corpo:

1. { "acao": "resumo" }
   recebe: {
     perfil: "Nome do usuário",
     indicadores: { alunosAtivos, alunosTotal, acessoVencendo, acessoVencido,
                    semTurma, alertasAbertos, alertasAltos },
     alertasPorTipo: { "Acesso vencendo": 3, ... },
     playbook: [ { titulo, categoria, status, confianca } ]
   }

2. { "acao": "alertas" }
   recebe: { alertas: [ { id, titulo, tipo, severidade, status, prazo,
                          leitura, conta, geradoEm, url } ] }
   Já vem ordenado por severidade. NÃO reordene por outra coisa por padrão.
   - severidade: "Alta" | "Média" | "Baixa"
   - status: "Não iniciada" | "Em andamento" | "Concluído"
   - conta: texto de várias linhas, determinístico. Preserve as quebras.
   - leitura: texto gerado por IA.
   - url: link para a página no Notion. Abre em nova aba.

3. { "acao": "alunos", "busca": "", "jornada": null }
   recebe: { alunos: [ { alunoId, nome, email, jornada, formacao, turma,
                         turmaNumero, teoricoPct, modulosFaltantes,
                         carpaPresente, carpaTotal, pilaresPresente,
                         pilaresTotal, plano, acessoAte, certificado,
                         diasDeAcesso } ] }
   Já vem ordenado por urgência de acesso.

4. { "acao": "aluno", "alunoId": 1001 }
   recebe: { aluno: {...}, avaliacao: {
     extensao: { elegivel: true|false|null, indeterminado, conta,
                 criterios: [ { nome, obtido, piso, total, atende, teto } ],
                 reprovados: [...] },
     certificacao: { bloqueada: true|false|null, motivo },
     fonte: { titulo, status, confianca }
   } }

5. { "acao": "perguntar", "texto": "..." }
   recebe: { resposta, fonte: { titulo, categoria, status, confianca } | null }
   fonte pode ser null: significa que a resposta não se ancorou em nenhuma
   regra. Nesse caso mostre "sem fonte identificada", não esconda o campo.

QUALQUER campo pode vir null. Trate null como "não informado" e mostre um traço
"—". Nunca renderize a string "null", nunca "NaN", nunca "0" no lugar de vazio.
Um aluno sem turma tem carpaPresente null, e isso NÃO é zero de presença.

=== LAYOUT ===

Container central com max-width var(--largura-painel). Padding lateral de 16px,
subindo para 24px a partir de 640px e 32px a partir de 1024px. Use padding
lógico (padding-inline), não padding-left/right.

Escala de espaçamento, e ela é a regra do arquivo inteiro:
  - 8px  entre itens do MESMO grupo
  - 24px entre grupos distintos
  - 40px entre seções principais
Agrupe por ESPAÇO. Não use linha divisória onde o espaço já separa. Só use
borda quando o espaço sozinho não sustentar a estrutura — por exemplo, o
contorno de um card sobre o fundo.

Ordem vertical da página, e ela reflete importância, não conveniência:

1. CABEÇALHO fixo no topo. À esquerda "Central Lumen"; à direita o nome do
   perfil e o botão Sair. Fundo hsl(var(--superficie)), borda inferior de 1px.
   O cabeçalho flutua sobre o conteúdo, não empurra: use position sticky.

2. FAIXA DE INDICADORES. Seis cards, nesta ordem: Alunos ativos, Acesso
   vencendo (30d), Acesso vencido, Sem turma, Alertas abertos, Alertas de
   severidade alta.
   O sétimo campo, alunosTotal, NÃO ganha card próprio: ele aparece como
   denominador no card de Alunos ativos, no formato "35 de 40". Um número
   sozinho de "total" não responde a nenhuma pergunta da coordenação.
   Grade com grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)).
   NÃO use breakpoints de 768/1024 aqui: a quebra tem que vir do ponto em que
   o card deixa de caber, e o auto-fit resolve isso sozinho.
   Cada card: rótulo pequeno em --texto-suave, número grande com a classe
   "tabular". "Alertas de severidade alta" usa --alta quando for maior que
   zero, e --texto quando for zero.

3. ÁREA PRINCIPAL, duas colunas a partir de 900px, proporção 3fr / 2fr.
   Abaixo de 900px empilha, e ALERTAS vem primeiro. O ponto de 900px é onde a
   coluna de alunos deixa de caber sem truncar nome — não é preset de aparelho.

   COLUNA PRINCIPAL — Alertas:
   Título "Alertas abertos" e, ao lado, a contagem.
   Lista de cards, um por alerta:
     - Borda lateral inicial (border-inline-start) de 3px na cor da severidade:
       --alta, --media, --baixa. Fundo --superficie.
     - Linha 1: título do alerta, em peso médio. Deixe quebrar em duas linhas;
       não trunque nome de pessoa.
     - Linha 2: chip do tipo, chip da severidade, e o prazo quando existir.
       Chips com fundo --alta-suave / --media-suave / --baixa-suave.
     - O card é expansível. Fechado, mostra as duas linhas acima e as primeiras
       duas linhas de "leitura". Aberto, mostra "leitura" inteira, o bloco
       "conta" em fonte monoespaçada preservando quebras, e o link "Abrir no
       Notion".
     - O gatilho de expandir tem que PARECER controle: um botão com rótulo
       "Ver a conta" e um chevron. Não faça o card inteiro clicável sem
       affordance visível.
     - Espaçamento: 8px dentro do card entre linhas, 12px entre cards.

   COLUNA SECUNDÁRIA — Alunos:
   Campo de busca no topo, colado na coluna (não no cabeçalho da página).
   Lista de linhas: nome, turma ou "sem turma", e à direita o prazo de acesso.
   O prazo usa cor de estado: --alta se diasDeAcesso < 0 ou <= 7, --media se
   <= 30, --texto-suave acima disso, e "—" em --texto-fraco quando for null.
   Clicar numa linha abre o DETALHE.

4. PERGUNTA AO PLAYBOOK. Seção própria, abaixo da área principal.
   Campo de texto de uma linha, botão "Perguntar", e a resposta abaixo.
   Sob a resposta, sempre, uma linha de procedência: o título da regra citada
   e um chip de confiança — --confianca-alta para "Alta", --confianca-media
   para "Média". Quando fonte for null, escreva "sem fonte identificada" em
   --texto-fraco.
   Quando o status da fonte for "Para revisar", mostre acima da resposta um
   aviso em --media-suave: "Esta resposta se apoia em regra pendente de
   revisão."

=== DETALHE DO ALUNO ===

Abre num Sheet lateral em telas de 900px ou mais, e num Drawer de baixo para
cima abaixo disso.

Conteúdo, nesta ordem:
  - Nome, ID, formação, turma, jornada.
  - Prazo de acesso, com os dias restantes.
  - PROGRESSO: mostre CARPA e Pilares como DUAS barras SEPARADAS, cada uma
    "presente de total". NUNCA some as duas, nunca mostre uma média, nunca
    mostre uma barra única de "participação". Isto não é preferência visual:
    a regra da instituição define pisos independentes por fase, e uma barra
    agregada esconde exatamente a informação que decide o caso.
    Quando presente for null, mostre a barra vazia com o texto "não informado",
    e não uma barra em zero.
  - AVALIAÇÃO DA EXTENSÃO: uma linha por critério de avaliacao.extensao.criterios,
    com o nome, o valor obtido, o alvo, e um ícone de cumpre/não cumpre.
    Para criterios com teto=true, escreva "no máximo N"; para os demais,
    "mínimo N". Se atende for null, escreva "não avaliável".
    Abaixo, o veredito: "Elegível", "Não elegível" ou "Indeterminado".
    Quando não elegível, destaque os critérios reprovados — e apenas eles.
  - CERTIFICAÇÃO: o motivo, tal como veio.
  - PROCEDÊNCIA: título da regra usada e chip de confiança.

=== ESTADOS ===

Cada lista tem três estados, e os três precisam existir:
  - carregando: esqueleto com a mesma altura do conteúdo final, para a página
    não pular quando os dados chegam.
  - vazio: frase curta explicando por que está vazio. "Nenhum alerta aberto"
    é diferente de "Nenhum aluno encontrado para esta busca".
  - erro: a mensagem, e um botão "Tentar de novo".

=== RESPONSIVIDADE ===

Teste em 375px e em 1440px, nessa ordem.
Em 375px: nada de rolagem horizontal na página. O bloco "conta" do alerta é
monoespaçado e pode estourar — coloque-o num container com overflow-x auto
próprio, de modo que ele role sozinho sem arrastar a página.
Botões de largura total ficam DENTRO do padding lateral, com raio visível.
Nunca encoste um botão na borda da viewport.
```

---

## Prompts de refino

Rode um por vez, conferindo o resultado antes do próximo.

### 1. Nulo não é zero

```
Audite todo campo numérico vindo da API procurando confusão entre null e zero.

Regras:
- carpaPresente, pilaresPresente, modulosFaltantes, teoricoPct, turmaNumero e
  diasDeAcesso podem ser null.
- null renderiza "—" e nunca 0, nunca "null", nunca "NaN".
- Barra de progresso com valor null fica vazia e rotulada "não informado".
  Não desenhe uma barra em 0%, porque zero de presença e ausência de dado são
  situações diferentes e a coordenação age diferente em cada uma.
- Não use `valor || "—"`: isso transforma o número 0 legítimo em traço.
  Use `valor ?? "—"`, e para o caso de 0 confira explicitamente com === null.
```

### 2. Espaço no lugar de linha

```
Remova as linhas divisórias que só separam itens de uma mesma lista.
Onde houver borda entre itens irmãos, apague a borda e dobre o espaço.
Mantenha borda apenas onde ela delimita uma superfície contra o fundo — o
contorno do card, a borda inferior do cabeçalho fixo.
Confirme que o espaço entre grupos é pelo menos o dobro do espaço dentro do
grupo. Se estiver 8px dentro, tem que ser 16px ou mais fora.
```

### 3. Quebra pelo conteúdo, não pelo aparelho

```
Substitua os breakpoints herdados de preset (sm/md/lg padrão) nos seguintes
pontos:
- A faixa de indicadores usa grid auto-fit com minmax(9.5rem, 1fr), sem
  nenhuma media query.
- A área principal vira duas colunas exatamente em 900px, via container query
  se possível, e media query se não.
Verifique em 375, 700, 900, 1100 e 1440px. A quebra tem que acontecer onde o
conteúdo deixa de caber, não onde o preset manda.
```

### 4. Controles parecem controles

```
Percorra a tela procurando elemento clicável que se parece com texto estático.
Todo controle precisa de fundo, borda, ou uma zona de posicionamento
consistente que o identifique.
O gatilho de expandir do card de alerta precisa de rótulo textual e chevron,
não pode ser só o card inteiro clicável.
Garanta 12px de folga entre controles adjacentes com fundo ou borda, e 24px em
volta de controle só de ícone ou só de texto.
```

### 5. As duas barras não viram uma

```
Confirme, no detalhe do aluno, que CARPA e Pilares aparecem como duas barras
independentes com seus próprios "presente de total".
Se em algum lugar existir soma, média, "participação total" ou barra única
combinando as duas fases, remova.
A regra da instituição define pisos separados por fase, e um aluno com 4 de 5
no CARPA e 2 de 7 em Pilares tem 50% no agregado mas NÃO se qualifica. Uma
barra única mostraria "50%, quase lá" e induziria a decisão errada.
```

### 6. Crescimento de texto e 375px

```
Nenhum container de texto pode ter largura fixa. Use max-width e deixe quebrar.
Nome de pessoa não pode ser truncado com reticências no card de alerta nem na
lista de alunos — deixe ir para a segunda linha.
Em 375px, verifique que a página não rola horizontalmente. O bloco "conta",
que é monoespaçado, precisa do próprio container com overflow-x auto.
Verifique também que o botão Sair, no cabeçalho fixo, continua alcançável e não
fica atrás de nada em 375px.
```

### 7. Procedência sempre visível

```
Garanta que todo lugar que exibe uma resposta ou avaliação apoiada no Playbook
mostre a procedência junto: título da regra e chip de confiança.
O chip de confiança usa --confianca-alta e --confianca-media, que são cores
DIFERENTES das de severidade. Não reaproveite verde e amarelo de severidade:
confiança fala da fonte, severidade fala do caso, e um alerta grave apoiado em
fonte confiável precisa ser distinguível de um alerta leve apoiado em fonte
pendente.
Onde o status da fonte for "Para revisar", mostre o aviso de ressalva ANTES do
texto da resposta, não depois.
```
