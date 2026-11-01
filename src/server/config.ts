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
  return !isProduction() || isAuthEnabled() || isDemoMode();
}
