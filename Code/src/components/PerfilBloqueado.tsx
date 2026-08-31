import { LogOut, ShieldAlert } from "lucide-react";

/**
 * 403: a credencial está correta, então NÃO redirecionamos para /login — o laço
 * nunca resolveria. Tela própria com saída explícita.
 */
export function PerfilBloqueado({ aoSair }: { aoSair: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo">
      <div className="painel-container max-w-md py-secao text-center">
        <ShieldAlert className="mx-auto size-8 text-media" aria-hidden="true" />
        <h1 className="mt-bloco text-lg font-semibold text-texto">
          Perfil ainda não liberado pela coordenação.
        </h1>
        <p className="mt-2 text-sm text-texto-suave">
          Sua conta existe, mas o acesso ao painel depende da liberação da coordenação.
        </p>
        <button
          type="button"
          onClick={aoSair}
          className="mt-bloco inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-borda bg-superficie px-4 py-2 text-sm font-medium text-texto transition-colors hover:bg-superficie-alta"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </button>
      </div>
    </div>
  );
}
