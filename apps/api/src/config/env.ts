import { z } from 'zod';

/**
 * BUILD_PROMPT §16, with Supabase replacing MONGODB_URI (docs/decisions.md).
 * Which variables are required depends on NODE_ENV (see loadEnv).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Set automatically on Vercel by the Supabase integration.
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),
  APP_URL: z.url().default('http://localhost:5173'),
  CRON_SECRET: z.string().min(1).optional(),
  SOCIAL_MOCK: z.stringbool().default(true),

  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  /** LinkedIn Marketing API version (YYYYMM); each version is supported for about a year. */
  LINKEDIN_API_VERSION: z
    .string()
    .regex(/^\d{6}$/)
    .default('202609'),
  /** Space-separated OAuth scopes; the app must be approved for them. */
  LINKEDIN_SCOPES: z.string().default('r_organization_admin rw_organization_admin'),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),

  // Optional: Slack/Discord incoming webhook that receives server errors (utils/logger.ts).
  ERROR_WEBHOOK_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const REQUIRED: Record<Env['NODE_ENV'], ReadonlyArray<keyof Env>> = {
  development: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  test: [],
  production: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'APP_URL',
    'CRON_SECRET',
  ],
};

let cached: Env | undefined;

/** Parses process.env once. Throws a readable error listing every missing or invalid variable. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;

  // Treat empty strings (from copied .env.example lines) as unset.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${issues.join('\n')}`);
  }

  const env = parsed.data;
  const missing = REQUIRED[env.NODE_ENV].filter((key) => env[key] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for NODE_ENV=${env.NODE_ENV}: ${missing.join(', ')}.\n` +
        'Copy apps/api/.env.example to apps/api/.env and fill them in.',
    );
  }

  if (source === process.env) cached = env;
  return env;
}

/** LinkedIn app settings, or undefined while LINKEDIN_CLIENT_ID / _SECRET are not set. */
export function linkedinFromEnv(env: Env) {
  if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) return undefined;
  return {
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    apiVersion: env.LINKEDIN_API_VERSION,
    scopes: env.LINKEDIN_SCOPES.split(/[\s,]+/).filter(Boolean),
  };
}
