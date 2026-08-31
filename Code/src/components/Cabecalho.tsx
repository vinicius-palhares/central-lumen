import { LogOut } from "lucide-react";
import { TRACO } from "@/lib/formato";
import { AlternarTema } from "@/components/AlternarTema";

export function Cabecalho({ perfil, aoSair }: { perfil?: string | null; aoSair: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-borda bg-superficie">
      <div className="painel-container grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3">
        <span className="truncate text-base font-semibold tracking-tight text-texto">
          Central Lumen
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="max-w-[8rem] truncate text-sm text-texto-suave sm:max-w-[14rem]">
            {perfil ? perfil : TRACO}
          </span>
          <AlternarTema />

          <button
            type="button"
            onClick={aoSair}
            className="inline-flex items-center gap-1.5 rounded-md border border-borda px-3 py-2 text-sm font-medium text-texto transition-colors hover:bg-superficie-alta"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
