# Central Lumen — painel de monitoramento operacional

Aplicação em português do Brasil, com autenticação por e-mail e senha e todos os dados vindos da Edge Function `painel` já existente. Nenhuma tabela será criada e o cliente não lê nem escreve no banco.

## Pré-requisito de conexão

O login precisa acontecer no mesmo projeto Supabase da Edge Function (`xyfyzghiajonvyrocqno`), senão o token não é aceito. Ao aprovar o plano eu abro o fluxo de conexão do Supabase para você apontar esse projeto existente. Enquanto isso não estiver conectado, o login não funcionará.

## Tema

Aplico o `TOKENS.css` enviado como base do tema: superfícies, texto, marca, severidade (alta/média/baixa/ok), confiança da fonte, `--raio`, `--largura-painel` e a classe `.tabular`. Claro/escuro seguem a preferência do sistema, sem botão de alternância. Nenhuma cor literal do Tailwind é usada em componente algum — toda cor sai dessas variáveis, registradas como utilitários semânticos.

## Telas

**/login** — e-mail, senha, botão Entrar. Sem cadastro. Erro do Supabase exibido tal como vem.

**Rota protegida** — sem sessão, qualquer rota vai para /login. Sair encerra a sessão e volta para /login.

**Bloqueio de perfil (403)** — tela própria com "Perfil ainda não liberado pela coordenação." e botão Sair. Sem redirecionar para /login.

**Painel** (ordem vertical = importância):

1. Cabeçalho `sticky`: "Central Lumen" à esquerda; nome do perfil e Sair à direita. Superfície com borda inferior de 1px.
2. Faixa de indicadores: seis cards em `repeat(auto-fit, minmax(9.5rem, 1fr))`, sem breakpoints. "Alunos ativos" mostra "35 de 40" usando `alunosTotal` como denominador. "Alertas de severidade alta" em `--alta` quando > 0.
3. Área principal: duas colunas 3fr/2fr a partir de 900px; abaixo empilha com Alertas primeiro.
   - **Alertas**: cards com borda lateral inicial de 3px na cor da severidade, título em duas linhas quando preciso, chips de tipo e severidade, prazo quando houver. Fechado mostra duas linhas de `leitura`; botão "Ver a conta" com chevron abre `leitura` completa, o bloco `conta` monoespaçado com quebras preservadas e rolagem horizontal própria, e o link "Abrir no Notion" em nova aba. Ordem da API preservada.
   - **Alunos**: busca no topo da coluna; linhas com nome, turma ou "sem turma", e prazo de acesso colorido por dias restantes (< 0 ou <= 7 em `--alta`, <= 30 em `--media`, acima em `--texto-suave`, nulo como "—" em `--texto-fraco`). Clique abre o detalhe.
4. **Pergunta ao playbook**: campo de uma linha, botão "Perguntar", resposta abaixo, e sempre uma linha de procedência com título da regra e chip de confiança. `fonte: null` vira "sem fonte identificada". Status "Para revisar" exibe aviso acima da resposta.

**Detalhe do aluno** — Sheet lateral a partir de 900px, Drawer de baixo para cima abaixo disso. Ordem: identificação; prazo de acesso com dias restantes; progresso com CARPA e Pilares em duas barras separadas ("presente de total", nunca somadas nem média, barra vazia com "não informado" quando nulo); avaliação da extensão critério por critério ("no máximo N" para teto, "mínimo N" nos demais, "não avaliável" quando `atende` é nulo) com veredito e destaque apenas dos reprovados; certificação com o motivo tal como veio; procedência com chip de confiança.

## Regras transversais

- Qualquer campo nulo vira "—". Nunca "null", "NaN" nem "0" no lugar de vazio. Aluno sem turma tem presença não informada, não zero.
- Espaçamento: 8px dentro de grupo, 24px entre grupos, 40px entre seções. Agrupamento por espaço; borda só quando o espaço não sustenta a estrutura.
- Container central com `max-width: var(--largura-painel)` e `padding-inline` de 16 / 24 (640px) / 32px (1024px).
- Três estados por lista: esqueleto com a altura do conteúdo final, vazio com frase específica ("Nenhum alerta aberto" ≠ "Nenhum aluno encontrado para esta busca"), erro com mensagem e "Tentar de novo".
- Verifico em 375px e 1440px: sem rolagem horizontal na página, botões de largura total dentro do padding lateral e com raio visível.

## Detalhes técnicos

- Cliente único de API: POST no endpoint `painel` com `Content-Type`, `Authorization: Bearer` do `getSession()` e `apikey` publicável. 401 encerra a sessão e vai para /login; 403 aciona a tela de bloqueio.
- TanStack Query para as cinco ações (`resumo`, `alertas`, `alunos`, `aluno`, `perguntar`), com estados de carregamento/erro por lista e `mutation` para a pergunta.
- Rotas TanStack: `/login` pública e o painel sob o layout protegido da integração; detalhe do aluno controlado por estado com `Sheet`/`Drawer` conforme largura.
- Componentes shadcn/ui já presentes no projeto (Sheet, Drawer, Progress, Input, Button, Skeleton), estilizados pelos tokens.
- Metadados de `head()` próprios por rota, em português.
