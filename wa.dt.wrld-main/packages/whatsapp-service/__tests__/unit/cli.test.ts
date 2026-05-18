/**
 * CLI & Server Metadata Tests
 *
 * Tests server_meta.ts exports exhaustively — this is the source of truth
 * for --help output, route registration, and feature flag definitions.
 */

import {
  SERVER_NAME,
  SERVER_VERSION,
  DEFAULT_PORT,
  DEFAULTS,
  FEATURE_FLAGS,
  ROUTES,
  DEPENDENCIES,
  MODE_PRESETS,
} from '../../src/server_meta';

describe('server_meta — identity', () => {
  it('SERVER_NAME is azizi-wa', () => {
    expect(SERVER_NAME).toBe('azizi-wa');
  });

  it('SERVER_VERSION matches semver pattern', () => {
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('DEFAULT_PORT is 3001', () => {
    expect(DEFAULT_PORT).toBe(3001);
  });
});

describe('server_meta — feature flags', () => {
  it('has 9 feature flags', () => {
    expect(FEATURE_FLAGS).toHaveLength(9);
  });

  it('every flag has name, env, description, defaultValue', () => {
    for (const flag of FEATURE_FLAGS) {
      expect(flag).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          env: expect.any(String),
          description: expect.any(String),
          defaultValue: expect.any(String),
        })
      );
    }
  });

  it('all env vars start with ENABLE_', () => {
    for (const flag of FEATURE_FLAGS) {
      expect(flag.env).toMatch(/^ENABLE_/);
    }
  });

  it('all defaultValue is true or false', () => {
    for (const flag of FEATURE_FLAGS) {
      expect(['true', 'false']).toContain(flag.defaultValue);
    }
  });
});

describe('server_meta — routes', () => {
  it('has entries', () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it('every route has method, path, description, auth, tag', () => {
    for (const route of ROUTES) {
      expect(route).toEqual(
        expect.objectContaining({
          method: expect.any(String),
          path: expect.any(String),
          description: expect.any(String),
          auth: expect.any(String),
          tag: expect.any(String),
        })
      );
    }
  });

  it('all paths start with /service/ or /api-docs', () => {
    for (const route of ROUTES) {
      const valid = route.path.startsWith('/service/') || route.path.startsWith('/api-docs');
      expect(valid).toBe(true);
    }
  });

  it('all auth values are valid', () => {
    const validAuth = ['none', 'api_key', 'session', 'hmac'];
    for (const route of ROUTES) {
      expect(validAuth).toContain(route.auth);
    }
  });

  it('all tags are non-empty', () => {
    for (const route of ROUTES) {
      expect(route.tag.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate method+path combinations', () => {
    const seen = new Set<string>();
    for (const route of ROUTES) {
      const key = `${route.method} ${route.path}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe('server_meta — dependencies', () => {
  it('has entries', () => {
    expect(DEPENDENCIES.length).toBeGreaterThan(0);
  });

  it('every dependency has name, env, required', () => {
    for (const dep of DEPENDENCIES) {
      expect(dep).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          env: expect.any(String),
          required: expect.any(Boolean),
        })
      );
    }
  });
});

describe('server_meta — mode presets', () => {
  it('has dev, test, eval, prod keys', () => {
    expect(Object.keys(MODE_PRESETS).sort()).toEqual(['dev', 'eval', 'prod', 'test']);
  });

  it('prod enables all ENABLE_* flags as true', () => {
    const prodPreset = MODE_PRESETS['prod'];
    const enableKeys = Object.keys(prodPreset).filter(k => k.startsWith('ENABLE_'));
    expect(enableKeys.length).toBeGreaterThan(0);
    for (const key of enableKeys) {
      expect(prodPreset[key]).toBe('true');
    }
  });

  it('test disables all ENABLE_* flags as false', () => {
    const testPreset = MODE_PRESETS['test'];
    const enableKeys = Object.keys(testPreset).filter(k => k.startsWith('ENABLE_'));
    expect(enableKeys.length).toBeGreaterThan(0);
    for (const key of enableKeys) {
      expect(testPreset[key]).toBe('false');
    }
  });
});

describe('server_meta — defaults', () => {
  it('LLM_MODEL is openai/gpt-4o-mini', () => {
    expect(DEFAULTS.LLM_MODEL).toBe('openai/gpt-4o-mini');
  });

  it('EMBEDDING_MODEL is sentence-transformers/all-minilm-l6-v2', () => {
    expect(DEFAULTS.EMBEDDING_MODEL).toBe('sentence-transformers/all-minilm-l6-v2');
  });

  it('BRAND_NAME is Azizi Africa', () => {
    expect(DEFAULTS.BRAND_NAME).toBe('Azizi Africa');
  });
});
