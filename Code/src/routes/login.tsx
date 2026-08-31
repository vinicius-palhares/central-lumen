import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { erroDeLogin } from "@/lib/formato";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Central Lumen" },
      {
        name: "description",
        content: "Acesso da coordenação ao painel de monitoramento operacional Central Lumen.",
      },
      { property: "og:title", content: "Entrar — Central Lumen" },
      {
        property: "og:description",
        content: "Acesso da coordenação ao painel de monitoramento operacional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (ativo && data.session) navigate({ to: "/", replace: true });
    });
    return () => {
      ativo = false;
    };
  }, [navigate]);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) {
      // A mensagem do Supabase vem em inglês e descreve o problema sem dizer o
      // que fazer. Traduzida para uma instrução — ver erroDeLogin.
      setErro(erroDeLogin(error.message));
      return;
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-fundo px-4 py-bloco">
      {/* Card centrado nos dois eixos: 24rem no máximo, nunca encostando na viewport. */}
      <div className="w-full max-w-[24rem] rounded-lg border border-borda bg-superficie p-bloco">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Central Lumen</h1>
        <p className="mt-2 text-sm text-texto-suave">
          Entre com o e-mail e a senha cadastrados pela coordenação.
        </p>

        <form onSubmit={entrar} className="mt-bloco flex flex-col gap-bloco">
          <div className="flex flex-col gap-grupo">
            <label htmlFor="email" className="text-xs text-texto-suave">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-texto placeholder:text-texto-fraco focus:border-marca focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-grupo">
            <label htmlFor="senha" className="text-xs text-texto-suave">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-md border border-borda bg-superficie px-3 py-2 text-sm text-texto placeholder:text-texto-fraco focus:border-marca focus:outline-none"
            />
          </div>

          {erro ? (
            <p role="alert" className="rounded-md bg-alta-suave px-3 py-2 text-sm text-alta">
              {erro}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-marca px-4 py-2 text-sm font-medium text-marca-contraste transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
