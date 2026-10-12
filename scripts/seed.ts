import mongoose from 'mongoose';

// TODO(Phase 3, §15): demo@example.com / demo1234 (dev only), 3 sites, 18 months of
// deterministic sessions and pageviews with weekday patterns, growth and viral spikes.
async function main() {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI is not set (put it in apps/api/.env)');
  if (process.env['NODE_ENV'] === 'production') throw new Error('Refusing to seed in production');

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected to MongoDB. TODO(Phase 3): seed demo data.');
  await mongoose.disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
