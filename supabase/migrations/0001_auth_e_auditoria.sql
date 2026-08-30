-- Central Lumen — autenticação e trilha de auditoria.
--
-- Este banco NÃO guarda dado de aluno. O registro operacional vive no Notion,
-- e duplicá-lo aqui criaria duas fontes da verdade que divergem no primeiro
-- momento em que a coordenação editar uma delas.
--
-- O Supabase entra por dois motivos, e só por esses dois:
--   1. Autenticação. auth.users é gerido pelo próprio Supabase.
--   2. Trilha de auditoria de quem consultou o painel.

-- ─────────────────────────────────────────────────────────────────
-- Perfis
-- ─────────────────────────────────────────────────────────────────

-- Existir em auth.users prova identidade, não autorização. Um convite aceito
-- por engano, ou um cadastro aberto por descuido, cria usuário autenticado.
-- A liberação passa por esta tabela, que só o service role escreve.
create table perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  liberado   boolean not null default false,
  criado_em  timestamptz not null default now()
);

comment on column perfis.liberado is
  'Autorização, separada da autenticação. A Edge Function recusa a requisição '
  'de usuário autenticado cujo perfil não esteja liberado. Padrão false: um '
  'perfil criado sem revisão não enxerga nada.';

alter table perfis enable row level security;

-- O usuário lê o próprio perfil e nada além. Sem esta política a tabela ficaria
-- inacessível pelo cliente, o que é seguro mas impede a tela dizer quem está
-- logado sem passar pela Edge Function.
create policy "perfil próprio, leitura"
  on perfis for select
  using (auth.uid() = id);

-- Não há política de insert, update ou delete de propósito. Liberar o próprio
-- acesso não pode ser uma operação do cliente.

-- ─────────────────────────────────────────────────────────────────
-- Auditoria
-- ─────────────────────────────────────────────────────────────────

create table acessos (
  id         bigserial primary key,
  usuario_id uuid references auth.users(id) on delete set null,
  acao       text not null,
  detalhe    jsonb,
  em         timestamptz not null default now()
);

comment on table acessos is
  'Quem consultou o quê, e quando. Consulta a dado de aluno, mesmo sintético, '
  'é evento auditável. Registrar só a ação e o identificador consultado — '
  'nunca o conteúdo devolvido, que duplicaria o dado no log e alargaria a '
  'superfície que a minimização tenta reduzir.';

create index on acessos (usuario_id, em desc);
create index on acessos (em desc);

alter table acessos enable row level security;

-- Nenhuma política de leitura. O log de auditoria não é visível pelo cliente
-- em nenhuma hipótese: quem é auditado não edita nem lê a própria trilha.
-- A Edge Function escreve com service role, que ignora RLS.

-- ─────────────────────────────────────────────────────────────────
-- Criação automática do perfil
-- ─────────────────────────────────────────────────────────────────

-- security definer para poder escrever em perfis a partir de um gatilho em
-- auth.users. `set search_path = ''` é obrigatório aqui: sem isso, um schema
-- malicioso no search_path poderia sequestrar as referências não qualificadas
-- dentro de uma função que roda com os privilégios do dono.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, liberado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    false                                  -- liberação é ato deliberado
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();
