import type { Router } from 'express';
import type { ProxyIdentity } from '../middleware/auth.js';
import type { ServerConfig } from '../config.js';

export function registerHealthRoutes(api: Router, config: Pick<ServerConfig, 'requireAuth'>) {
  api.get('/health', (_req, res) => {
    console.debug('[Health] Health check');
    res.json({ ok: true });
  });

  api.get('/auth/me', (_req, res) => {
    const identity = res.locals.identity as ProxyIdentity;
    console.debug('[Auth] Identity request');
    res.json({
      requireAuth: config.requireAuth,
      identity,
    });
  });
}
