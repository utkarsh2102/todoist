import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

describe('GET /api/health', () => {
  it('reports ok with the app name and commit', async () => {
    const app = createApp(loadConfig({ APP_ENV: 'test', COMMIT_SHA: 'abc123' }));

    const res = await app.request('/api/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', app: "Utkarsh's To-Do", commit: 'abc123' });
  });
});

describe('loadConfig', () => {
  it('applies local defaults', () => {
    expect(loadConfig({})).toEqual({
      appEnv: 'development',
      port: 8787,
      appOrigin: 'http://localhost:5173',
      commitSha: 'dev',
    });
  });

  it('rejects invalid values with a readable error', () => {
    expect(() => loadConfig({ APP_ENV: 'staging', PORT: 'abc' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
