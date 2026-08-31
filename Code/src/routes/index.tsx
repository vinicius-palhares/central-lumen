import { useCallback, useEffect, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ehBloqueio, ehNaoAutorizado } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Cabecalho } from "@/components/Cabecalho";
import { FaixaIndicadores } from "@/components/FaixaIndicadores";
import { ListaAlertas } from "@/components/ListaAlertas";
import { ListaAlunos } from "@/components/ListaAlunos";
import { DetalheAluno } from "@/components/DetalheAluno";
import { PerguntaPlaybook } from "@/components/PerguntaPlaybook";
import { PerfilBloqueado } from "@/components/PerfilBloqueado";

export const Route = createFileRoute("/")({
  // A sessão do Supabase vive no navegador: o servidor não a enxerga.
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "Central Lumen — painel de monitoramento da coordenação" },
      {
        name: "description",
        content:
          "Painel operacional da coordenação: alertas por severidade, acesso dos alunos, elegibilidade de extensão e consulta ao playbook.",
      },
      { property: "og:title", content: "Central Lumen — painel da coordenação" },
      {
        property: "og:description",
        content:
          "Alertas por severidade, prazos de acesso, avaliação de extensão e consulta ao playbook.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [alunoAberto, setAlunoAberto] = useState<number | null>(null);
  const [bloqueado, setBloqueado] = useState(false);

  // Debounce da busca: uma tecla não vira uma chamada.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const sair = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }, [navigate, queryClient]);

  const tratarErro = useCallback(
    (erro: unknown) => {
      if (ehBloqueio(erro)) {
        setBloqueado(true);
        return;
      }
      if (ehNaoAutorizado(erro)) {
        // A sessão já foi derrubada no cliente de API.
        void queryClient.cancelQueries();
        queryClient.clear();
        navigate({ to: "/login", replace: true });
      }
    },
    [navigate, queryClient],
  );

  const resumo = useQuery({ queryKey: ["resumo"], queryFn: api.resumo, retry: false });
  const alertas = useQuery({ queryKey: ["alertas"], queryFn: api.alertas, retry: false });
  const alunos = useQuery({
    queryKey: ["alunos", buscaAplicada],
    queryFn: () => api.alunos(buscaAplicada, null),
    retry: false,
  });

  useEffect(() => {
    for (const erro of [resumo.error, alertas.error, alunos.error]) {
      if (erro) tratarErro(erro);
    }
  }, [resumo.error, alertas.error, alunos.error, tratarErro]);

  if (bloqueado) {
    return <PerfilBloqueado aoSair={() => void sair()} />;
  }

  return (
    <div className="min-h-screen bg-fundo">
      <Cabecalho perfil={resumo.data?.perfil ?? null} aoSair={() => void sair()} />

      <main className="painel-container flex flex-col gap-secao py-secao">
        <FaixaIndicadores
          indicadores={resumo.data?.indicadores ?? null}
          carregando={resumo.isLoading}
        />

        {/* Duas colunas a partir de 900px, 3fr / 2fr. Abaixo empilha e alertas vêm primeiro. */}
        <div className="painel-principal">
          <ListaAlertas
            alertas={alertas.data?.alertas ?? null}
            carregando={alertas.isLoading}
            erro={alertas.isError ? (alertas.error as Error).message : null}
            aoTentarDeNovo={() => void alertas.refetch()}
          />

          <ListaAlunos
            alunos={alunos.data?.alunos ?? null}
            busca={busca}
            aoBuscar={setBusca}
            carregando={alunos.isLoading}
            erro={alunos.isError ? (alunos.error as Error).message : null}
            aoTentarDeNovo={() => void alunos.refetch()}
            aoAbrirAluno={setAlunoAberto}
          />
        </div>

        <PerguntaPlaybook aoErro={tratarErro} />
      </main>

      <DetalheAluno
        alunoId={alunoAberto}
        aoFechar={() => setAlunoAberto(null)}
        aoErro={tratarErro}
      />
    </div>
  );
}
