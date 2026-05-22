import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { registerHealthRoutes } from '../routes/health.js';

function buildApp() {
  const app = express();
  const api = express.Router();

  app.use((_req, res, next) => {
    res.locals.identity = {
      username: 'alice',
      groups: ['users'],
      email: 'alice@example.com',
      name: 'Alice',
      uid: '1000',
    };
    next();
  });

  registerHealthRoutes(api, { requireAuth: true });
  app.use('/api', api);
  return app;
}

describe('health routes', () => {
  it('returns ok response from /health', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('returns auth configuration and identity from /auth/me', async () => {
    const app = buildApp();
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(200);
    expect(response.body.requireAuth).toBe(true);
    expect(response.body.identity).toEqual({
      username: 'alice',
      groups: ['users'],
      email: 'alice@example.com',
      name: 'Alice',
      uid: '1000',
    });
  });
});
