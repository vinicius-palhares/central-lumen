import { createClient } from "@supabase/supabase-js";

/**
 * Projeto Supabase que hospeda a Edge Function `painel`. A chave publicável
 * pode viver no código do cliente; é ela que o endpoint espera no header
 * `apikey`.
 */
export const SUPABASE_URL = "https://xyfyzghiajonvyrocqno.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_WP1XL-orbytZNRFYGC7N1Q_o4R4jDI4";
export const ENDPOINT_PAINEL = `${SUPABASE_URL}/functions/v1/painel`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
