import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { LOCAL_DATABASE_URL, loadConfig } from '../src/config';
import { createTestDb, testConfig } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('reports ok with the app name and commit when the database answers', async () => {
    const { db } = await createTestDb();
    const app = createApp({ config: testConfig({ COMMIT_SHA: 'abc123' }), db });

    const res = await app.request('/api/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', app: "Utkarsh's To-Do", commit: 'abc123' });
  });

  it('returns 503 when the database is unavailable', async () => {
    const handle = await createTestDb();
    handle.close();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({ config: testConfig(), db: handle.db });

    const res = await app.request('/api/health');

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'error' });
    expect(errors).toHaveBeenCalled();
  });
});

describe('loadConfig', () => {
  it('applies local defaults', () => {
    expect(loadConfig({})).toEqual({
      appEnv: 'development',
      port: 8787,
      appOrigin: 'http://localhost:5173',
      commitSha: 'dev',
      databaseUrl: LOCAL_DATABASE_URL,
      databaseAuthToken: undefined,
      ownerEmail: undefined,
    });
    expect(LOCAL_DATABASE_URL).toMatch(/^file:\/.*\/\.data\/todist\.db$/);
  });

  it('normalises the owner email', () => {
    expect(loadConfig({ OWNER_EMAIL: 'Someone@Example.COM' }).ownerEmail).toBe(
      'someone@example.com',
    );
  });

  it('requires an explicit database in production', () => {
    expect(() => loadConfig({ APP_ENV: 'production' })).toThrow(/TURSO_DATABASE_URL/);
    expect(
      loadConfig({ APP_ENV: 'production', TURSO_DATABASE_URL: 'libsql://db.example.turso.io' })
        .databaseUrl,
    ).toBe('libsql://db.example.turso.io');
  });

  it('rejects invalid values with a readable error', () => {
    expect(() => loadConfig({ APP_ENV: 'staging', PORT: 'abc' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
