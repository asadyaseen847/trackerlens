import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from '../config/env.js';
import type { Database } from './database.types.js';

export type Db = SupabaseClient<Database>;

// Cached on globalThis so warm Vercel invocations (and tsx watch reloads) reuse one client.
const globalForDb = globalThis as typeof globalThis & { __supabase?: Db };

/**
 * Server-side Supabase client using the service-role key. It bypasses RLS, so every query
 * must be scoped to the signed-in user's workspace in our own code (§10). Never expose this
 * key to the browser.
 */
export function getDb(): Db {
  if (globalForDb.__supabase) return globalForDb.__supabase;

  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  globalForDb.__supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return globalForDb.__supabase;
}
