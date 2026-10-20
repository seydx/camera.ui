import type { Kernel } from '@camera.ui/transport';
import type { AxiosInstance } from '@camera.ui/transport/transports/http';

export function scopeRequestsToSession(client: AxiosInstance, kernel: Kernel): void {
  let scope = new AbortController();

  client.interceptors.request.use((config) => {
    config.signal ??= scope.signal;
    return config;
  });

  kernel.subscribe((next, prev) => {
    if (next.kind === prev.kind) return;
    if (next.kind !== 'idle' && next.kind !== 'needs-auth' && prev.kind !== 'needs-auth') return;
    scope.abort();
    scope = new AbortController();
  });
}
