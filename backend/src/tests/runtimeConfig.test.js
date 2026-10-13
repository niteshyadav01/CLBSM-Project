import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeMongoUri } from '../config/db.js';
import { validateRuntimeConfig } from '../config/runtimeConfig.js';

const base = {
  MONGODB_URI: 'mongodb+srv://user:password@example.mongodb.net/clbsm',
  JWT_SECRET: 'a-secure-test-secret-with-at-least-32-characters',
  NODE_ENV: 'production',
  CLIENT_ORIGIN: 'https://clbsm.example.com',
};

describe('runtime configuration', () => {
  it('accepts a production configuration with HTTPS client origin', () => {
    assert.doesNotThrow(() => validateRuntimeConfig(base));
  });

  it('requires a strong JWT secret in production', () => {
    assert.throws(() => validateRuntimeConfig({ ...base, JWT_SECRET: 'too-short' }), /at least 32 characters/);
  });

  it('rejects a missing or public HTTP production client origin', () => {
    assert.throws(() => validateRuntimeConfig({ ...base, CLIENT_ORIGIN: '' }), /CLIENT_ORIGIN/);
    assert.throws(() => validateRuntimeConfig({ ...base, CLIENT_ORIGIN: 'http://clbsm.example.com' }), /HTTPS/);
  });

  it('accepts the Render service address when CLIENT_ORIGIN is not set', () => {
    const { CLIENT_ORIGIN, ...withoutClient } = base;
    assert.doesNotThrow(() => validateRuntimeConfig({ ...withoutClient, RENDER_EXTERNAL_URL: 'https://clbsm.onrender.com' }));
  });

  it('allows localhost while running production mode on this computer', () => {
    assert.doesNotThrow(() => validateRuntimeConfig({ ...base, CLIENT_ORIGIN: 'http://localhost:5173' }));
  });

  it('rejects a known local JWT secret in production', () => {
    assert.throws(
      () => validateRuntimeConfig({ ...base, JWT_SECRET: 'local-dev-secret-change-before-production-2026' }),
      /unique random value/
    );
  });

  it('uses the clbsm database when the connection string has no database name', () => {
    const normalized = new URL(normalizeMongoUri('mongodb+srv://user:password@cluster.mongodb.net/'));
    assert.equal(normalized.pathname, '/clbsm');
    assert.equal(normalized.username, 'user');
  });

  it('rejects a MongoDB URL with an unsupported scheme', () => {
    assert.throws(() => validateRuntimeConfig({ ...base, MONGODB_URI: 'https://example.com' }), /MongoDB connection string/);
  });
});