-- Fecha a exposição de public.criar_perfil() como RPC.
--
-- O linter do Supabase apontou que a função, sendo SECURITY DEFINER e vivendo
-- no schema `public`, fica chamável por `anon` e `authenticated` via
-- /rest/v1/rpc/criar_perfil.
--
-- O risco prático é baixo: é uma função de GATILHO, referencia `new`, e o
-- Postgres recusa a chamada direta com "trigger functions can only be called
-- as triggers". Mas "não dá para explorar hoje" é um argumento frágil — ele
-- depende de um detalhe do Postgres, e não de uma decisão nossa. Função que
-- roda com os privilégios do dono não deve estar ao alcance de quem nem fez
-- login, e revogar custa uma linha.
--
-- O gatilho continua funcionando: gatilhos executam com o privilégio do dono
-- da tabela, e não pelo EXECUTE concedido aos papéis da API.

revoke execute on function public.criar_perfil() from public;
revoke execute on function public.criar_perfil() from anon;
revoke execute on function public.criar_perfil() from authenticated;
