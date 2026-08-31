/**
 * Gera docs/DOCUMENTO_TEORICO.pdf a partir do markdown.
 *
 * O PDF é artefato derivado, então nada de editar o .pdf à mão: mexe no .md e
 * roda de novo. Usa o Chromium do Playwright que já está instalado para os
 * prints, e nenhuma fonte remota, para o resultado não depender de rede.
 *
 *   node scripts/pdf.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { marked } from 'marked'
import { chromium } from 'playwright'

const ENTRADA = 'docs/DOCUMENTO_TEORICO.md'
const SAIDA = 'docs/DOCUMENTO_TEORICO.pdf'

const md = await readFile(ENTRADA, 'utf8')

// As linhas de identificação são um único parágrafo no markdown, e markdown
// ignora quebra simples: sem isto saem grudadas. O rótulo entra na alternância
// SEM exigir dois-pontos logo depois, porque "Disciplina de Integração de APIs"
// não tem — foi o que fez a primeira geração colapsar as duas linhas.
const preparado = md.replace(
  /^((?:(?:Disciplina|Aplicação|Autor|Entrega)[^\n]*\n){2,})/m,
  // `parseInline` em cada linha, e não texto cru: o bloco vira HTML, e HTML
  // bruto no markdown não passa mais pelo parser. Sem isto, "**Central Lumen**"
  // sai com os asteriscos à mostra em vez de negrito.
  (_, bloco) =>
    '<div class="meta">' +
    bloco
      .trimEnd()
      .split('\n')
      .map((l) => `<div>${marked.parseInline(l)}</div>`)
      .join('') +
    '</div>\n',
)

const bruto = marked.parse(preparado, { mangle: false, headerIds: false })

/**
 * Caminho de arquivo em `code` não tem ponto de quebra, e num parágrafo
 * justificado um token desses joga a linha anterior cheia de buraco. `<wbr>`
 * autoriza a quebra depois da barra sem inserir hífen nenhum.
 *
 * O lookbehind exclui o `<code>` que vem dentro de `<pre>`: ali a quebra é
 * proibida, o bloco é diagrama e depende do alinhamento das colunas.
 */
const corpo = bruto.replace(
  /(?<!<pre>)<code>([^<]*)<\/code>/g,
  (inteiro, texto) =>
    texto.includes('/') ? `<code>${texto.replaceAll('/', '/<wbr>')}</code>` : inteiro,
)

const ESTILO = `
  @page { size: A4; margin: 20mm 18mm 18mm 18mm; }

  :root {
    --tinta: #1C1917;
    --tinta-fraca: #57534E;
    --linha: #E7E5E4;
    --primaria: #4338CA;
    --fundo-suave: #F5F5F4;
  }

  body {
    font: 10.5pt/1.62 Georgia, "Times New Roman", serif;
    color: var(--tinta);
    margin: 0;
    text-align: justify;
    hyphens: auto;
  }

  /* Hifenização serve para prosa justificada. Em título, identificador de código
     e célula de tabela ela inventa hífen onde não existe: "pg-vector" e
     "Resul-tado" apareceram na primeira prova. */
  h1, h2, h3, code, table { hyphens: none; }

  h1, h2, h3 { font-family: "Segoe UI Semibold", "Segoe UI", Calibri, sans-serif; }

  h1 {
    font-size: 21pt;
    line-height: 1.25;
    margin: 0 0 14pt;
    color: var(--primaria);
    text-align: left;
    text-wrap: balance;
  }

  /* As seções NÃO abrem página. A primeira prova abria, e o preço foi meia
     página em branco no pé de quase toda seção. O texto flui, e a régua
     colorida mais o respiro acima já marcam o começo de cada tópico. */
  h2 {
    font-size: 14pt;
    margin: 22pt 0 12pt;
    padding-bottom: 5pt;
    border-bottom: 1.5pt solid var(--primaria);
    color: var(--primaria);
    text-align: left;
    break-after: avoid;
  }

  h2:first-of-type { margin-top: 6pt; }

  h3 {
    font-size: 11.5pt;
    margin: 16pt 0 6pt;
    text-align: left;
    break-after: avoid;
  }

  p { margin: 0 0 9pt; orphans: 2; widows: 2; }

  .meta {
    font-family: "Segoe UI", Calibri, sans-serif;
    font-size: 10pt;
    color: var(--tinta-fraca);
    margin-bottom: 16pt;
  }
  .meta div { margin-bottom: 1pt; }

  blockquote {
    margin: 12pt 0;
    padding: 9pt 12pt;
    border-left: 2.5pt solid var(--primaria);
    background: var(--fundo-suave);
    font-size: 9.8pt;
    break-inside: avoid;
  }
  blockquote p:last-child { margin-bottom: 0; }

  /* Os travessões do markdown separam as seções, e o h2 já traz régua colorida
     e respiro acima. Manter os dois deixaria um traço órfão no pé da página. */
  hr { display: none; }

  ul { margin: 0 0 9pt; padding-left: 16pt; }
  li { margin-bottom: 3pt; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-family: "Segoe UI", Calibri, sans-serif;
    font-size: 9pt;
    margin: 10pt 0 12pt;
    text-align: left;
  }
  thead { display: table-header-group; }
  th {
    background: var(--fundo-suave);
    font-weight: 600;
    border-bottom: 1pt solid var(--primaria);
  }
  th, td {
    padding: 4.5pt 6pt;
    border-bottom: 0.5pt solid var(--linha);
    vertical-align: top;
  }
  tr { break-inside: avoid; }

  pre {
    background: var(--fundo-suave);
    border: 0.5pt solid var(--linha);
    border-radius: 3pt;
    padding: 8pt 10pt;
    margin: 10pt 0 12pt;
    font: 8.5pt/1.45 Consolas, "Courier New", monospace;
    white-space: pre;
    break-inside: avoid;
  }

  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 0.9em;
  }
  p code, li code, td code, blockquote code {
    background: var(--fundo-suave);
    padding: 0.5pt 2.5pt;
    border-radius: 2pt;
  }
  pre code { background: none; padding: 0; }

  strong { font-weight: 600; }
  a { color: var(--primaria); text-decoration: none; }
`

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Documento teórico</title><style>${ESTILO}</style></head><body>${corpo}</body></html>`

// `--html caminho.html` grava o intermediário. Serve para conferir tipografia,
// tabelas e bloco de código num navegador, que é mais fácil de inspecionar que
// o PDF pronto.
const iHtml = process.argv.indexOf('--html')
if (iHtml !== -1 && process.argv[iHtml + 1]) {
  await writeFile(process.argv[iHtml + 1], html, 'utf8')
  console.log(`html intermediário em ${process.argv[iHtml + 1]}`)
}

const navegador = await chromium.launch()
const pagina = await navegador.newPage()
await pagina.setContent(html, { waitUntil: 'load' })

const rodape = `
  <div style="width:100%;padding:0 18mm;font:8pt 'Segoe UI',Calibri,sans-serif;
              color:#78716C;display:flex;justify-content:space-between;">
    <span>Central Lumen — Central Inteligente de Monitoramento</span>
    <span><span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`

const pdf = await pagina.pdf({
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: rodape,
  margin: { top: '20mm', bottom: '18mm', left: '0', right: '0' },
})

await navegador.close()
await writeFile(SAIDA, pdf)

console.log(`${SAIDA}, ${(pdf.length / 1024).toFixed(0)} KB`)
