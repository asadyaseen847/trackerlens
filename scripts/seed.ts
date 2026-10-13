import { createClient } from '@supabase/supabase-js';

// TODO(Phase 3, §15): demo@example.com / demo1234 (dev only), 3 sites, 18 months of
// deterministic sessions and pageviews with weekday patterns, growth and viral spikes.
async function main() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in apps/api/.env)');
  }
  if (process.env['NODE_ENV'] === 'production') throw new Error('Refusing to seed in production');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from('workspaces').select('id', { head: true, count: 'exact' });
  if (error) throw new Error(`Could not reach Supabase: ${error.message}`);

  console.log('Connected to Supabase. TODO(Phase 3): seed demo data.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
