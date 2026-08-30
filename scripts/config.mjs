/**
 * Configuração compartilhada pelos scripts.
 *
 * Os IDs das bases do Notion são constantes de infraestrutura, não segredo:
 * conhecer o ID não dá acesso. O acesso vem do token, e o token está no .env,
 * que está no .gitignore. Deixar os IDs versionados é o que permite clonar o
 * repositório e apontar para as mesmas bases sem um passo manual de descoberta.
 */

import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

export const BASES = {
  alunos: 'faea7225-c555-4199-b414-02f9baf7dd36',
  playbook: '61c60ce5-cd2a-4445-9b76-ccbc1ffa3d4b',
  alertas: '20f8a59d-97c7-42b1-bb00-47deeb868427',
}

export const PAGINA_RAIZ = '3ccea15e-737a-8101-a551-c195a7ebe92c'

/**
 * Lê o .env sem dependência externa.
 *
 * Só define o que ainda não existe em process.env, então variável já exportada
 * pelo ambiente vence o arquivo. É o que faz o mesmo script rodar em GitHub
 * Actions (onde os segredos vêm do ambiente) e na máquina (onde vêm do .env)
 * sem ramificação.
 */
export async function carregarEnv() {
  try {
    const bruto = await readFile(join(RAIZ, '.env'), 'utf8')
    for (const linha of bruto.split('\n')) {
      const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // Sem .env é o caso normal em CI. A validação de exigir() cobre a falta.
  }
}

/** Falha cedo e nomeia o que falta, em vez de estourar num 401 três passos depois. */
export function exigir(...nomes) {
  const faltando = nomes.filter((n) => !process.env[n])
  if (faltando.length) {
    console.error(`Faltam variáveis de ambiente: ${faltando.join(', ')}`)
    console.error('Copie .env.example para .env e preencha.')
    process.exit(1)
  }
  return Object.fromEntries(nomes.map((n) => [n, process.env[n]]))
}
