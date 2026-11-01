import { afterEach, describe, expect, it } from 'vitest';
import { isAuthEnabled, isDemoMode, isProductionModeConfigured } from '../../src/server/config';

const original = {
  auth: process.env['AUTH_ENABLED'],
  demo: process.env['DEMO_MODE'],
  node: process.env['NODE_ENV'],
};

afterEach(() => {
  process.env['AUTH_ENABLED'] = original.auth;
  process.env['DEMO_MODE'] = original.demo;
  process.env['NODE_ENV'] = original.node;
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
});
