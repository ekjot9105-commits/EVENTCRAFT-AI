import { afterEach, describe, expect, it } from 'vitest';
import { isAuthEnabled, isClientSessionHeaderAllowed, isDemoMode, isProductionModeConfigured, validateDeploymentConfig } from '../../src/server/config';

const original = {
  auth: process.env['AUTH_ENABLED'],
  demo: process.env['DEMO_MODE'],
  node: process.env['NODE_ENV'],
  vercel: process.env['VERCEL'],
  clientSession: process.env['DEMO_ALLOW_CLIENT_SESSION_ID'],
};

afterEach(() => {
  process.env['AUTH_ENABLED'] = original.auth;
  process.env['DEMO_MODE'] = original.demo;
  process.env['NODE_ENV'] = original.node;
  process.env['VERCEL'] = original.vercel;
  process.env['DEMO_ALLOW_CLIENT_SESSION_ID'] = original.clientSession;
});

describe('deployment mode configuration', () => {
  it('recognizes explicit authentication mode', () => {
    process.env['AUTH_ENABLED'] = 'true';
    expect(isAuthEnabled()).toBe(true);
  });

  it('recognizes explicit demo mode', () => {
    process.env['DEMO_MODE'] = 'true';
    expect(isDemoMode()).toBe(true);
  });

  it('allows test mode without requiring production configuration', () => {
    process.env['NODE_ENV'] = 'test';
    process.env['AUTH_ENABLED'] = 'false';
    process.env['DEMO_MODE'] = 'false';
    expect(isProductionModeConfigured()).toBe(true);
  });

  it('rejects an unconfigured production mode', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['AUTH_ENABLED'] = 'false';
    process.env['DEMO_MODE'] = 'false';
    expect(isDemoMode()).toBe(false);
    expect(isProductionModeConfigured()).toBe(false);
  });

  it('supports legacy Vercel demo deployments without identity variables', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['VERCEL'] = '1';
    delete process.env['DEMO_MODE'];
    delete process.env['AUTH_ENABLED'];
    expect(isDemoMode()).toBe(true);
    expect(isProductionModeConfigured()).toBe(true);
    expect(() => validateDeploymentConfig({ NODE_ENV: 'production', VERCEL: '1' })).not.toThrow();
  });

  it('rejects ambiguous production identity modes', () => {
    expect(() => validateDeploymentConfig({ NODE_ENV: 'production', AUTH_ENABLED: 'false', DEMO_MODE: 'false' })).toThrow(/exactly one identity mode/i);
    expect(() => validateDeploymentConfig({ NODE_ENV: 'production', AUTH_ENABLED: 'true', DEMO_MODE: 'true' })).toThrow(/exactly one identity mode/i);
  });

  it('rejects authenticated SQLite production', () => {
    expect(() => validateDeploymentConfig({ NODE_ENV: 'production', AUTH_ENABLED: 'true', DEMO_MODE: 'false', DATABASE_PROVIDER: 'sqlite', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'placeholder' })).toThrow(/DATABASE_PROVIDER=supabase/i);
  });

  it('requires Supabase credentials for authenticated production', () => {
    expect(() => validateDeploymentConfig({ NODE_ENV: 'production', AUTH_ENABLED: 'true', DEMO_MODE: 'false', DATABASE_PROVIDER: 'supabase' })).toThrow(/SUPABASE_URL/i);
    expect(() => validateDeploymentConfig({ NODE_ENV: 'production', AUTH_ENABLED: 'true', DEMO_MODE: 'false', DATABASE_PROVIDER: 'supabase', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'placeholder' })).not.toThrow();
  });

  it('does not trust client-selected anonymous IDs in production', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DEMO_ALLOW_CLIENT_SESSION_ID'] = 'false';
    expect(isClientSessionHeaderAllowed()).toBe(false);
  });
});
