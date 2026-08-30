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
> alunos, playbook e alertas. E é o canal de notificação: o campo Responsável é
> do tipo pessoa, e atribuir alguém dispara a notificação nativa. Escolhi Notion
> em vez de Airtable por isso e porque a coordenação já trabalha lá. Regra que
> vive onde a pessoa já escreve é regra que ela mantém.
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
> E o responsável está atribuído — o Notion notifica sozinho. Não escrevi
> integração de e-mail nenhuma.

---

## Bloco 4 — Desafios (3:00 – 3:30)

**Tela:** o terminal com `npm run testar`, 13 de 13.

Escolha **dois** e diga o que aprendeu, não que foi difícil.

> Dois desafios que mudaram o desenho.
>
> O primeiro foi descobrir que a forma errada de implementar essa regra passa em
> quase todo teste. Somar as fases e comparar com 60% funciona em todos os casos
> menos no limítrofe — que é o único que importa. Escrevi um teste específico
> para ele.
>
> O segundo foi de governança. O escopo de integração do Notion **falha aberto**:
> basta alguém compartilhar uma página nova com a mesma integração para o token
> alcançar mais coisa, sem aviso. Não dá para resolver em código. Documentei o
> limite na própria página raiz, em vez de afirmar um isolamento que a
> ferramenta não sustenta.

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

## Depois de gravar

- [ ] Assistir inteiro uma vez, no volume de fone.
- [ ] Confirmar que a duração ficou abaixo de 4:00.
- [ ] Subir como **não listado** no YouTube.
- [ ] **Abrir o link numa janela anônima** — link privado por engano é a forma
      mais comum de perder os 2 pontos inteiros.
