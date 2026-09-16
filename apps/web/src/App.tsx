import { useEffect, useState } from 'react';
import { APP_NAME } from '@todist/shared';

type ApiState = { kind: 'loading' } | { kind: 'ok'; commit: string } | { kind: 'error' };

// Phase 0 placeholder: proves the web app, the shared package and the API are wired together.
export function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((body: { commit: string }) => setApi({ kind: 'ok', commit: body.commit }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.error(err);
          setApi({ kind: 'error' });
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="placeholder">
      <h1>{APP_NAME}</h1>
      <p>
        API:{' '}
        {api.kind === 'loading'
          ? 'checking…'
          : api.kind === 'ok'
            ? `ok (${api.commit})`
            : 'unreachable — is `pnpm dev` running?'}
      </p>
    </main>
  );
}
