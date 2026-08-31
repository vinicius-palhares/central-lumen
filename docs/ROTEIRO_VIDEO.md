# Roteiro do vídeo pitch — 4 minutos

O enunciado pede sete itens: problema, arquitetura, APIs, demonstração, fluxo
de integração, desafios e benefícios. São 240 segundos para sete itens, o que
dá uma média de 34 segundos cada.

A média é a forma errada de distribuir. **A demonstração é o único item que os
outros seis não conseguem substituir** — arquitetura, fluxo e APIs podem ser
ditos sobre um slide; "aplica a regra em vez de gerar texto plausível" só se
prova rodando. Por isso a demonstração leva 100 segundos e o resto se aperta.

Grave a tela com o áudio junto, num take só por bloco. Se um bloco estourar
mais de 15 segundos, corte texto — não acelere a fala.

---

## Bloco 1 — Problema (0:00 – 0:35)

**Tela:** as duas abas do Notion lado a lado, Playbook e Alunos.

> Uma escola tem o cadastro do aluno num lugar e as regras que dizem o que
> fazer com esse cadastro em outro. O diagnóstico fácil é "falta integração", e
> a métrica fácil é tempo perdido trocando de aba.
>
> O custo real é outro. A regra e o dado nunca se encontram sozinhos. Ninguém
> varre mil e quinhentos alunos toda semana cruzando cada um contra o playbook.
> Então o aluno que vai perder o prazo por um critério só descobre quando o
> acesso já venceu.

*Não diga "vou falar sobre". Comece pelo problema.*

---

## Bloco 2 — Arquitetura e APIs (0:35 – 1:20)

**Tela:** o diagrama de fluxo do README.

> A Central resolve isso com duas APIs.
>
> O **Notion** faz dois papéis. É o banco no-code — três bases relacionadas:
> alunos, playbook e alertas. E é a fila de trabalho: cada alerta tem
> responsável, severidade e prazo.
>
> Escolhi Notion em vez de Airtable porque a coordenação já trabalha lá. Regra
> que vive onde a pessoa já escreve é regra que ela mantém — e isso eu demonstro
> daqui a pouco, editando a regra e vendo o comportamento mudar.
>
> O **Gemini** entra só para redigir. E aqui está a decisão de arquitetura do
> projeto: **o modelo não decide nada.**
>
> A regra vem do Notion. A conta é feita em código, determinística. O modelo só
> transforma a conta pronta em texto. Se o modelo avaliasse, duas execuções
> sobre o mesmo aluno poderiam divergir e não haveria como auditar qual estava
> certa.

---

## Bloco 3 — Demonstração (1:20 – 3:00)

O bloco mais longo, e tem três partes. **Ensaie esta parte.**

### 3a. O par que prova a tese (1:20 – 2:10)

**Tela:** painel logado, abrir o perfil 1001.

> A regra diz: mais 30 dias de acesso para quem participou de pelo menos 60% da
> formação, o que na prática significa no mínimo 4 mentorias do CARPA e 3 de
> Pilares.
>
> Isabela: 4 de 5 no CARPA, 3 de 7 em Pilares. Elegível.

**Tela:** abrir o perfil 1002. Deixe as duas barras visíveis.

> Otávio: os mesmos 4 de 5 no CARPA. E **2** de 7 em Pilares.
>
> Somando, ele tem 6 de 12 — cinquenta por cento. Um sistema que calculasse
> média diria "você está em 50%, quase lá".
>
> A Central nega. E diz por quê: o piso de Pilares é 3, e os pisos são
> independentes — não se compensam.
>
> Reparem que são duas barras separadas na tela. Não é escolha estética. Uma
> barra única de "participação" mostraria cinquenta por cento e esconderia
> exatamente a informação que decide o caso.

*Este é o momento do vídeo. Não corra.*

### 3b. A regra vive no Notion (2:10 – 2:35)

**Tela:** Notion, página da regra. Trocar "3 de Pilares" por "2 de Pilares".
Voltar ao painel, recarregar o perfil 1002.

> A regra não está em código nem em SQL. Está aqui, no Notion, e a coordenação
> edita.
>
> Mudo o piso de Pilares de 3 para 2. Volto ao painel. Mesmo aluno — agora
> elegível. Sem deploy, sem tocar em código.

*Desfaça a edição antes de gravar o próximo bloco.*

### 3c. A automação (2:35 – 3:00)

**Tela:** disparar o workflow no GitHub Actions, depois a base de Alertas.

> E isso roda sem ninguém pedir. A varredura é agendada, percorre a base, aplica
> as regras e abre alertas.
>
> Cada alerta traz duas coisas lado a lado: a conta determinística e a leitura
> gerada pelo modelo. Se as duas divergirem, está escrito no alerta que a conta
> prevalece.
>
> E cada alerta já sai com responsável, severidade e prazo. Não escrevi
> integração de e-mail nenhuma: o trabalho aparece na fila da coordenação, no
> Notion, que é onde ela já está.

---

## Bloco 4 — Desafios (3:00 – 3:30)

**Tela:** o terminal com `npm run testar`, 21 de 21.

Escolha **dois dos três** abaixo e diga o que aprendeu, não que foi difícil.
O terceiro é o mais forte se você tiver tempo de mostrar o log na tela.

> Dois desafios que mudaram o desenho.
>
> O primeiro foi descobrir que a forma errada de implementar essa regra passa em
> quase todo teste. Somar as fases e comparar com 60% funciona em todos os casos
> menos no limítrofe — que é o único que importa. Escrevi um teste específico
> para ele.
>
> O segundo foi de governança, e começou como um bug bobo: os alertas não
> notificavam ninguém. Minha primeira hipótese foi que o Notion não notifica
> ações de integração. Errada.
>
> A causa apareceu ao olhar quem o Notion registrou como autor: **eu**, não um
> bot. O token que eu estava usando não era de uma integração — era um Personal
> Access Token, que age como o próprio usuário e carrega o acesso dele ao
> workspace inteiro.
>
> Ou seja: eu tinha escrito no documento que o escopo era "por página
> compartilhada", e o escopo real era a minha conta. Corrigi o documento, porque
> afirmação errada sobre escopo de credencial é pior que credencial larga —
> credencial larga você conserta, afirmação errada faz o próximo confiar.

**Terceiro, opcional** — tela: o log com `finishReason: MAX_TOKENS`.

> O terceiro apareceu na primeira execução real. Os alertas foram gravados com
> a leitura cortada no meio da frase. Não era limite do Notion: o orçamento de
> tokens do Gemini é compartilhado com o raciocínio interno do modelo, e o
> raciocínio consumiu 383 dos 400 tokens. Sobraram 13 para a resposta.
>
> Aumentar o orçamento foi a correção fácil. A que importa foi outra: o código
> lia o texto, via que não estava vazio, e considerava sucesso. Passei a tratar
> `finishReason` diferente de `STOP` como falha — porque meia frase num campo
> que a coordenação lê como orientação é pior que nenhuma frase, já que parece
> completa.
>
> E repara que a conta determinística estava certa nos sete alertas. Só a
> redação quebrou. É exatamente o que a separação entre decidir e redigir
> deveria garantir.

---

## Bloco 5 — Benefício (3:30 – 4:00)

**Tela:** o painel, faixa de indicadores.

> O benefício não é o painel. É a inversão da iniciativa.
>
> Antes, o cruzamento entre regra e dado só acontecia quando alguém perguntava.
> Quem desengajou, por definição, não pergunta.
>
> Agora o sistema pergunta primeiro, e entrega um caso já instruído: a conta, a
> regra que a sustenta, e um responsável. A decisão continua sendo de uma pessoa
> — mas ela chega com a conta na mão, em vez de com uma intuição sobre
> porcentagem.

---

## Antes de gravar

- [ ] `npm run testar` passando, terminal limpo, na tela.
- [ ] `npm run seed` rodado, para os perfis 1001 e 1002 existirem com os
      números certos.
- [ ] `npm run varredura` rodado, para a base de Alertas não estar vazia.
- [ ] Sessão logada no painel, com o perfil já liberado. **Não grave a tela de
      login digitando senha.**
- [ ] Regra do Playbook no valor original (Pilares = 3) antes do bloco 3b.
- [ ] Zoom do navegador em 110–125%: o vídeo será visto em tela pequena.
- [ ] Notificações do sistema desligadas.
- [ ] Nenhuma aba com dado real da empresa aberta ao lado.
- [ ] **Barra lateral do Notion recolhida**, se aparecer alguma tela dele. A
      caixa de entrada mostra avisos de testes antigos, e um deles diz
      "Central Lumen mencionou você" — o que contradiz, na tela, o que o
      documento afirma sobre notificação.

## Depois de gravar

- [ ] Assistir inteiro uma vez, no volume de fone.
- [ ] Confirmar que a duração ficou abaixo de 4:00.
- [ ] Subir como **não listado** no YouTube.
- [ ] **Abrir o link numa janela anônima** — link privado por engano é a forma
      mais comum de perder os 2 pontos inteiros.
