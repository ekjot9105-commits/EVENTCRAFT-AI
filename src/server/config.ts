/**
 * Centralized deployment-mode flags. Keeping these decisions in one module
 * prevents individual middleware from interpreting environment variables
 * differently.
 */
export function isAuthEnabled(): boolean {
  return process.env['AUTH_ENABLED'] === 'true';
}

export function isDemoMode(): boolean {
  return process.env['DEMO_MODE'] === 'true' || process.env['NODE_ENV'] === 'test';
}

export function isProduction(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

export function isProductionModeConfigured(): boolean {
  return !isProduction() || isAuthEnabled() !== isDemoMode();
}

/** Client-selected anonymous IDs are allowed only for local test/dev adapters. */
export function isClientSessionHeaderAllowed(): boolean {
  return !isProduction() || process.env['DEMO_ALLOW_CLIENT_SESSION_ID'] === 'true';
}

/** Fail fast on ambiguous or unsafe production configuration. */
export function validateDeploymentConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env['NODE_ENV'] !== 'production') return;

  const auth = env['AUTH_ENABLED'] === 'true';
  const demo = env['DEMO_MODE'] === 'true';
  if (auth === demo) {
    throw new Error('Production must select exactly one identity mode: AUTH_ENABLED=true or DEMO_MODE=true.');
  }

  if (auth) {
    if (env['DATABASE_PROVIDER'] === 'sqlite') {
      throw new Error('AUTH_ENABLED=true requires DATABASE_PROVIDER=supabase.');
    }
    if (!env['SUPABASE_URL'] || (!env['SUPABASE_SERVICE_ROLE_KEY'] && !env['SUPABASE_ANON_KEY'])) {
      throw new Error('AUTH_ENABLED=true requires SUPABASE_URL and a Supabase key.');
    }
  } else if (env['DEMO_ALLOW_CLIENT_SESSION_ID'] === 'true') {
    throw new Error('Production demo mode must use the server-issued anonymous cookie.');
  }
}
