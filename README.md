# Central Lumen

Central de monitoramento que integra a **API do Notion** e a **API do Gemini**
para consolidar indicadores operacionais de uma escola, aplicar as regras da
instituição sobre os dados e abrir alertas acionáveis automaticamente.

Trabalho da disciplina de Integração de APIs — UniFECAF.

> Projeto acadêmico. O **Instituto Lumen** é uma instituição fictícia. Os 40
> perfis de aluno são sintéticos, gerados por script versionado com semente
> fixa. Nenhum dado corresponde a pessoa real.

---

## O problema

Informação operacional de uma escola vive espalhada: cadastro do aluno num
sistema, regras de negócio num documento que alguém escreveu no Notion, e a
decisão de aplicar uma à outra na cabeça de quem atende.

O custo disso não é o tempo de abrir duas abas. É que **a regra e o dado nunca
se encontram sozinhos**. Ninguém varre 1.500 alunos cruzando cada um contra o
playbook toda semana, então o aluno que perdeu o prazo por um critério só
descobre quando o acesso já venceu.

## A solução

Uma varredura automática lê as regras no Notion, lê o cadastro no Notion,
aplica uma sobre o outro, e abre um alerta atribuído a um responsável. Um
painel autenticado consolida tudo numa tela.

O desenho em uma frase: **a regra vem do Notion, a conta é feita em código, e o
modelo só redige.**

| Camada | Responsabilidade | O que ela NÃO faz |
|---|---|---|
| Notion (Playbook) | guarda o texto da regra, com os limiares | não calcula |
| `_shared/regras.mjs` | faz a aritmética e registra a conta literal | não decide o texto da regra |
| Gemini | redige a leitura para a coordenação | **não decide elegibilidade** |
| Notion (Alertas) | registra o caso e notifica o responsável | não guarda regra |

Essa separação é a decisão de arquitetura do projeto. Se o modelo avaliasse a
elegibilidade, duas execuções sobre o mesmo aluno poderiam divergir e não
haveria como auditar qual estava certa. A decisão é determinística, fica
gravada no campo *Conta que sustenta*, e a leitura gerada aparece ao lado —
qualquer divergência entre as duas é visível na mesma tela.

### O comportamento que define o projeto

A regra documentada diz que o aluno que não terminou em 12 meses pode ganhar
mais 30 dias se participou de pelo menos 60% da formação, **o que na prática
significa no mínimo 4 mentorias do CARPA e 3 de Pilares**, e se faltam no
máximo dois módulos.

A aplicação não consulta uma coluna com a resposta:

| Perfil | CARPA | Pilares | Agregado | Resultado |
|---|---|---|---|---|
| Isabela Fontoura (1001) | 4 de 5 | 3 de 7 | 58% | **concede** |
| Otávio Peixoto (1002) | 4 de 5 | **2** de 7 | 50% | **nega** |

O segundo caso é o que importa. Um sistema que calculasse média diria "você
está em 50%, quase lá". O correto é identificar que a regra define **pisos por
fase**, e que eles não se compensam entre si.

A regra não existe em SQL nem no código. Vive na base Playbook do Notion, e é
aplicada em execução. A coordenação edita o texto lá e o comportamento muda na
chamada seguinte, sem deploy.

---

## APIs utilizadas

### 1. Notion API — `api.notion.com/v1`

Faz dois papéis, e é essa dupla função que justifica a escolha.

**Banco de dados no-code.** Três bases relacionadas: *Alunos* (registro
operacional), *Playbook* (regras) e *Alertas* (saída da automação). A relação
entre elas é nativa da ferramenta, não emulada em código.

**Canal de notificação.** O campo *Responsável* de um alerta é do tipo pessoa.
Atribuir dispara a notificação nativa do Notion, no app e por e-mail.

*Por que esta e não Airtable:* a coordenação já trabalha em Notion. Uma regra
que vive onde a coordenação já escreve é uma regra que ela mantém; uma regra
que vive num banco que ela não abre vira documentação morta em duas semanas.
Além disso, o Notion resolve a notificação sem serviço adicional — integrar um
Resend ou um Slack só para avisar alguém adicionaria uma credencial, uma fila
de retentativa e um segundo lugar por onde dado de aluno trafega.

**Autenticação:** integração interna, token `Bearer`, escopo por página
compartilhada. Versão da API fixada em `2022-06-28` no header.

### 2. Google Gemini API — `generativelanguage.googleapis.com/v1beta`

Dois usos, ambos de redação, nenhum de decisão:

- **Leitura da coordenação** no alerta: transforma a conta já resolvida em duas
  a quatro frases acionáveis. O prompt entrega o resultado pronto e proíbe
  recalcular.
- **Pergunta ao Playbook** no painel: responde dúvida em linguagem natural
  usando só as regras carregadas, e devolve qual regra citou.

*Por que sem busca vetorial:* o Playbook tem cinco regras e cabe inteiro no
prompt. Recuperação por embeddings nessa escala só adiciona um passo que pode
errar. Se o Playbook crescer além da janela de contexto, aí a recuperação passa
a valer o custo.

**Autenticação:** chave de API no header `x-goog-api-key`, guardada como
segredo da Edge Function e nunca exposta ao navegador.

### Supabase — infraestrutura, não integração

Entra por dois motivos e só por eles: **autenticação** (e-mail e senha, JWT) e
**trilha de auditoria**. Não guarda dado de aluno — duplicar o registro criaria
duas fontes da verdade que divergem na primeira edição.

---

## Fluxo de integração

```
                        ┌──────────────────────────┐
   coordenação  ─edita─▶│  Notion · Playbook       │
                        │  (regras em texto)       │
                        └────────────┬─────────────┘
                                     │ lê a regra
                                     ▼
  ┌────────────────┐         ┌───────────────────┐        ┌─────────────┐
  │ Notion · Alunos│──lê────▶│  varredura.mjs    │──pede─▶│   Gemini    │
  │  (cadastro)    │         │  aplica a regra   │◀─texto─│  (redação)  │
  └────────────────┘         └─────────┬─────────┘        └─────────────┘
                                       │ grava
                                       ▼
                             ┌───────────────────┐
                             │ Notion · Alertas  │──notifica──▶ responsável
                             └───────────────────┘
```

O painel percorre o mesmo grafo por leitura:

```
  navegador ──JWT──▶ Edge Function `painel` ──token──▶ Notion (3 bases)
                              │                └──chave──▶ Gemini
                              └──registra──▶ Supabase `acessos`
```

O navegador **nunca** fala com o Notion nem com o Gemini. As duas credenciais
vivem só na Edge Function. Um front-end que chamasse a API do Notion direto
precisaria embarcar o token no bundle, e bundle é público por definição.

### A automação

`scripts/varredura.mjs`, agendada em GitHub Actions de segunda a sexta às 09:00
de Brasília, e disparável à mão por `workflow_dispatch`.

Por aluno, avalia três situações:

| Situação | Condição | Severidade |
|---|---|---|
| Acesso vencendo / extensão | acesso encerra em até 30 dias | Alta se ≤ 7 dias |
| Certificação bloqueada | teórico em 100%, turma ≥ 41, plano não entregue | Alta |
| Desengajamento | turma ativa, teórico < 40% | Baixa |

Deduplicação por `alunoId : tipo : ciclo mensal`. Sem isso, uma varredura
diária reabriria o mesmo alerta todo dia e a coordenação pararia de olhar a
base.

Jornadas encerradas (Churn, Abandonou, Reembolsado) são puladas. Cobrar plano
de acompanhamento de quem pediu reembolso é o tipo de ruído que faz um painel
inteiro ser ignorado.

---

## Segurança e governança

**Autenticação separada de autorização.** Existir em `auth.users` prova
identidade, não permissão. A liberação passa pela tabela `perfis`, com padrão
`false`, escrita só pelo service role. Usuário autenticado e não liberado
recebe 403 com tela própria — nunca um laço de redirecionamento para o login.

**Credenciais em uma camada só.** Token do Notion e chave do Gemini vivem
apenas como segredo da Edge Function.

**Trilha de auditoria.** Toda consulta grava em `acessos` quem consultou, qual
ação e qual identificador. Não grava o conteúdo devolvido: duplicaria o dado no
log e alargaria a superfície que a minimização tenta reduzir. A tabela não tem
política de leitura — quem é auditado não lê a própria trilha.

**Fronteira de dados explícita.** As três bases vivem sob uma única página-raiz
no Notion, e a integração é compartilhada só com ela. **Escopo de integração no
Notion falha aberto:** compartilhar uma página nova com a mesma integração
amplia o alcance do token sem aviso. A fronteira só se sustenta enquanto for
decisão consciente de quem compartilha, e por isso está escrita na própria
página-raiz.

**Minimização por desenho.** O esquema carrega só campos que respondem alguma
pergunta do escopo. Documento de identificação, telefone e endereço ficaram de
fora — nem sintéticos, porque nenhuma resposta depende deles.

**O modelo não decide.** Detalhado acima. O campo *Conta que sustenta* é
computado, e o alerta carrega um aviso dizendo que, havendo divergência entre a
conta e a leitura gerada, a conta prevalece.

---

## Prints

> A preencher após o build no Lovable. Cada print abaixo corresponde a um
> comportamento que o projeto precisa demonstrar.

| Print | O que precisa mostrar |
|---|---|
| `01-login.png` | tela de login, e a tela de 403 para perfil não liberado |
| `02-painel.png` | faixa de indicadores e alertas ordenados por severidade |
| `03-regra-concede.png` | perfil 1001, as duas barras separadas, veredito Elegível |
| `04-regra-nega.png` | perfil 1002, 2 de 7 em Pilares, veredito Não elegível com o critério reprovado destacado |
| `05-conta-do-alerta.png` | card de alerta expandido, conta determinística ao lado da leitura gerada |
| `06-confianca.png` | resposta apoiada em regra "Para revisar", com a ressalva |
| `07-notion-alertas.png` | a base de Alertas no Notion, com responsável atribuído |
| `08-mobile-375.png` | 375px, sem rolagem horizontal |

O par 03/04 é a demonstração mais curta de que o sistema aplica a regra em vez
de gerar texto plausível.

---

## Como executar

```bash
npm install          # sem dependências de runtime; só valida o Node 20+
cp .env.example .env # preencher NOTION_TOKEN, GEMINI_API_KEY, ...
```

| Comando | O que faz |
|---|---|
| `npm run testar` | 15 testes do motor de regras. Sem rede, sem credencial. |
| `npm run semear-playbook` | carrega `regras/*.md` na base Playbook |
| `npm run gerar-alunos` | gera os 40 perfis sintéticos e carrega no Notion |
| `npm run seed` | os dois acima, na ordem |
| `npm run varredura:secar` | roda a avaliação e imprime, **sem** gravar e sem chamar o Gemini |
| `npm run varredura` | a automação completa |

`--secar` existe em ambos os scripts de carga porque a alternativa é descobrir
um erro de mapeamento depois de gravar 40 páginas no Notion.

### Preparar o Notion

1. Criar uma integração interna em notion.so/my-integrations.
2. Compartilhar **apenas** a página *Lumen · Central de Monitoramento* com ela.
3. Copiar o token para `NOTION_TOKEN`.
4. Pegar o próprio ID de usuário do Notion e pôr em `NOTION_RESPONSAVEL_ID` —
   sem ele os alertas são criados, mas ninguém é notificado.

Os IDs das três bases estão versionados em `scripts/config.mjs`. Conhecer o ID
não dá acesso; o acesso vem do token.

### Deploy da Edge Function

```bash
npx supabase functions deploy painel --project-ref <seu-project-ref>
```

Os segredos `NOTION_TOKEN`, `GEMINI_API_KEY` e `GEMINI_MODEL` são configurados
no painel do Supabase, em Edge Functions.

### Liberar um usuário

Cadastro não é aberto. Após criar o usuário no painel de Authentication:

```sql
update perfis set liberado = true where id = '<uuid do usuário>';
```

### Agendamento

`.github/workflows/varredura.yml`. Exige os segredos `NOTION_TOKEN`,
`NOTION_RESPONSAVEL_ID` e `GEMINI_API_KEY` no repositório.

---

## Estrutura

```
regras/                     as regras em markdown — estado inicial auditável
scripts/
  config.mjs                IDs das bases e carregamento de .env
  gerar_alunos.mjs          40 perfis sintéticos -> Notion
  semear_playbook.mjs       regras/*.md -> Notion
  varredura.mjs             A AUTOMAÇÃO
  regras.test.mjs           13 testes, sem rede
supabase/
  functions/
    _shared/notion.mjs      cliente REST, compartilhado Node e Deno
    _shared/regras.mjs      o motor de regras
    painel/index.ts         API autenticada do painel
  migrations/               perfis, auditoria, gatilho de perfil
docs/
  TOKENS.css                tema em variáveis CSS
  PROMPT_LOVABLE.md         especificação da interface
  DOCUMENTO_TEORICO.md      documento da disciplina
  ROTEIRO_VIDEO.md          roteiro do pitch de 4 minutos
```

`_shared/` guarda o que roda nos dois runtimes. O cliente do Notion foi escrito
à mão em vez de usar `@notionhq/client` justamente por isso: a mesma conversão
de propriedades precisa valer em Node e em Deno, e uma dependência a menos é um
caminho a menos para os dois divergirem.

---

## Origem

A infraestrutura deste projeto deriva do **Lumen**, copiloto de dúvidas do aluno
entregue na disciplina de IA Generativa Aplicada ao Desenvolvimento. Foram
reaproveitados o universo fictício, o gerador de perfis sintéticos e a
disciplina de governança.

O produto é outro. O Lumen respondia perguntas sob demanda; a Central varre a
base sem ninguém pedir, aplica a regra e abre trabalho. A regra migrou de
arquivo markdown fora do repositório para uma base no Notion que a coordenação
edita, e a persistência migrou de Postgres com `pgvector` para o banco no-code.
