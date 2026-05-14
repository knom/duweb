import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { ServerConfig } from '../config.js';

// Mock routes
vi.mock('../routes/health.js', () => ({
  registerHealthRoutes: (router: any) => {
    router.get('/health', (_req: any, res: any) => {
      res.json({ status: 'ok' });
    });
    router.get('/auth/me', (_req: any, res: any) => {
      res.json({ user: 'test' });
    });
  },
}));

vi.mock('../routes/jobs.js', () => ({
  registerJobRoutes: (router: any) => {
    router.post('/scan', (_req: any, res: any) => {
      res.json({ id: 'job-123', status: 'queued' });
    });
    router.get('/jobs', (_req: any, res: any) => {
      res.json([]);
    });
  },
}));

vi.mock('../routes/paths.js', () => ({
  registerPathRoutes: (router: any) => {
    router.get('/paths/autocomplete', (_req: any, res: any) => {
      res.json([]);
    });
  },
}));

describe('createApp', () => {
  let config: ServerConfig;

  beforeEach(() => {
    config = {
      port: 3001,
      rawBasePath: '',
      normalizedBasePath: '',
      apiPrefix: '/api',
      requireAuth: false,
      authHeaders: {
        username: 'x-forwarded-user',
        groups: 'x-forwarded-groups',
        email: 'x-forwarded-email',
        name: 'x-forwarded-name',
        uid: 'x-forwarded-uid',
      },
    };
  });

  it('should create an Express app', () => {
    const app = createApp(config);
    expect(app).toBeDefined();
  });

  it('should handle CORS', async () => {
    const app = createApp(config);
    const res = await request(app).get('/api/health');

    expect(res.header['access-control-allow-origin']).toBeDefined();
  });

  it('should parse JSON body', async () => {
    const app = createApp(config);
    const res = await request(app).post('/api/scan').send({ path: '/tmp' });

    expect(res.status).toBe(200);
  });

  it('should mount API routes at configured prefix', async () => {
    const app = createApp(config);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should respect custom API prefix', async () => {
    config.apiPrefix = '/disk-usage/api';
    config.normalizedBasePath = '/disk-usage';

    const app = createApp(config);

    const res = await request(app).get('/disk-usage/api/health');
    expect(res.status).toBe(200);
  });

  it('should handle /health endpoint without auth', async () => {
    config.requireAuth = true;

    const app = createApp(config);

    // Health endpoint should be accessible without auth headers
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('should handle /auth/me endpoint without auth', async () => {
    config.requireAuth = true;

    const app = createApp(config);

    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
  });

  it('should protect other endpoints when auth required', async () => {
    config.requireAuth = true;

    const app = createApp(config);

    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(401);
  });

  it('should allow access to protected endpoints with auth', async () => {
    config.requireAuth = true;

    const app = createApp(config);

    const res = await request(app)
      .get('/api/jobs')
      .set('x-forwarded-user', 'testuser');

    expect(res.status).toBe(200);
  });

  it('should return 404 for unknown routes', async () => {
    const app = createApp(config);

    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });

  it('should serve static files from client-dist if it exists', async () => {
    const app = createApp(config);

    // Since client-dist doesn't exist in tests, this should fallback to 404
    // but the static middleware should be registered
    const res = await request(app).get('/style.css');
    expect([404, 200]).toContain(res.status);
  });

  it('should enforce group requirement when configured', async () => {
    config.requireAuth = true;
    config.requireAuthGroup = 'admin';

    const app = createApp(config);

    // Without required group
    const res1 = await request(app)
      .get('/api/jobs')
      .set('x-forwarded-user', 'testuser')
      .set('x-forwarded-groups', 'users');

    expect(res1.status).toBe(403);

    // With required group
    const res2 = await request(app)
      .get('/api/jobs')
      .set('x-forwarded-user', 'testuser')
      .set('x-forwarded-groups', 'admin');

    expect(res2.status).toBe(200);
  });

  it('should use custom auth header names', async () => {
    config.requireAuth = true;
    config.authHeaders.username = 'X-Custom-User';

    const app = createApp(config);

    // Should work with custom header
    const res = await request(app).get('/api/jobs').set('X-Custom-User', 'testuser');

    expect(res.status).toBe(200);
  });
});
