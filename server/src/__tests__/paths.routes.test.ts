import express from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerPathRoutes } from '../routes/paths.js';

type FakeDirent = { name: string; isDirectory: () => boolean };

function dir(name: string): FakeDirent {
  return { name, isDirectory: () => true };
}

function file(name: string): FakeDirent {
  return { name, isDirectory: () => false };
}

function buildApp() {
  const app = express();
  const api = express.Router();
  registerPathRoutes(api);
  app.use('/api', api);
  return app;
}

describe('path routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the filesystem root for an empty query', async () => {
    const rootDir = path.parse(process.cwd()).root || '/';
    vi.spyOn(fs, 'readdir').mockResolvedValue([dir('tmp')] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '' });

    expect(response.status).toBe(200);
    expect(fs.readdir).toHaveBeenCalledWith(rootDir, { withFileTypes: true });
    expect(response.body.suggestions).toEqual([path.join(rootDir, 'tmp')]);
  });

  it('uses slash when the parsed cwd root is empty', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('');
    vi.spyOn(fs, 'readdir').mockResolvedValue([dir('tmp')] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '' });

    expect(response.status).toBe(200);
    expect(fs.readdir).toHaveBeenCalledWith('/', { withFileTypes: true });
    expect(response.body.suggestions).toEqual(['/tmp']);
  });

  it('falls back to the filesystem root for a non-string query', async () => {
    const rootDir = path.parse(process.cwd()).root || '/';
    vi.spyOn(fs, 'readdir').mockResolvedValue([dir('var')] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest?q=bad&q=worse');

    expect(response.status).toBe(200);
    expect(fs.readdir).toHaveBeenCalledWith(rootDir, { withFileTypes: true });
    expect(response.body.suggestions).toEqual([path.join(rootDir, 'var')]);
  });

  it('suggests matching directories sorted alphabetically', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue([
      dir('alpha'),
      dir('app'),
      dir('apple'),
      dir('beta'),
      file('app.log'),
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '/tmp/ap' });

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toEqual(['/tmp/app', '/tmp/apple']);
  });

  it('resolves relative base directories before reading suggestions', async () => {
    const resolvedBaseDir = path.resolve('tmp');
    vi.spyOn(fs, 'readdir').mockResolvedValue([dir('app')] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: 'tmp/ap' });

    expect(response.status).toBe(200);
    expect(fs.readdir).toHaveBeenCalledWith(resolvedBaseDir, { withFileTypes: true });
    expect(response.body.suggestions).toEqual([path.join(resolvedBaseDir, 'app')]);
  });

  it('expands home path prefixes before directory lookup', async () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/home/tester');
    vi.spyOn(fs, 'readdir').mockResolvedValue([dir('Documents')] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '~/Doc' });

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toEqual(['/home/tester/Documents']);
  });

  it('uses a trailing separator query as the full base directory', async () => {
    vi.spyOn(fs, 'readdir').mockResolvedValue([dir('child')] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '/tmp/' });

    expect(response.status).toBe(200);
    expect(fs.readdir).toHaveBeenCalledWith('/tmp/', { withFileTypes: true });
    expect(response.body.suggestions).toEqual(['/tmp/child']);
  });

  it('returns an empty suggestion list when reading the directory fails', async () => {
    vi.spyOn(fs, 'readdir').mockRejectedValue(new Error('Permission denied'));

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '/root/' });

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toEqual([]);
  });

  it('returns an empty suggestion list when reading the directory throws a non-error value', async () => {
    vi.spyOn(fs, 'readdir').mockRejectedValue('boom');

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '/tmp/' });

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toEqual([]);
  });

  it('limits suggestions to 20 entries', async () => {
    const entries = Array.from({ length: 30 }, (_, index) => dir(`node-${index.toString().padStart(2, '0')}`));
    vi.spyOn(fs, 'readdir').mockResolvedValue(entries as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const app = buildApp();
    const response = await request(app).get('/api/paths/suggest').query({ q: '/tmp/node-' });

    expect(response.status).toBe(200);
    expect(response.body.suggestions).toHaveLength(20);
    expect(response.body.suggestions[0]).toBe(path.join('/tmp', 'node-00'));
  });
});
