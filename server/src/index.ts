import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobStore } from './jobs.js';

const PORT = Number(process.env.PORT ?? 3001);
const rawBasePath = process.env.BASE_PATH ?? '';
const normalizedBasePath =
  rawBasePath === '' || rawBasePath === '/'
    ? ''
    : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`;
const apiPrefix = `${normalizedBasePath}/api`;

const app = express();
const api = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client-dist');

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.use(cors());
app.use(express.json());

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});

api.post('/jobs/scan', (req, res) => {
  const scanPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';

  if (!scanPath) {
    res.status(400).json({ error: 'Body must contain a non-empty path field.' });
    return;
  }

  const job = jobStore.createScanJob(scanPath);
  res.status(202).json(job);
});

api.get('/jobs', (_req, res) => {
  res.json(jobStore.listJobs());
});

api.get('/jobs/:id', (req, res) => {
  const job = jobStore.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  res.json(job);
});

api.post('/jobs/:id/rerun', (req, res) => {
  const job = jobStore.rerunJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  res.status(202).json(job);
});

api.delete('/jobs/:id', (req, res) => {
  const removed = jobStore.removeJob(req.params.id);

  if (!removed) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  res.status(204).send();
});

app.use(apiPrefix, api);

if (existsSync(clientDistPath)) {
  const uiMountPath = normalizedBasePath || '/';
  app.use(uiMountPath, express.static(clientDistPath));

  const uiMatcher =
    normalizedBasePath === ''
      ? /^\/(?!api(?:\/|$)).*/
      : new RegExp(`^${escapeRegExp(normalizedBasePath)}(?:\/.*)?$`);

  app.get(uiMatcher, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Disk usage server listening on port ${PORT} with API at ${apiPrefix}`);
});

// Keep a strong reference so the process stays alive under tsx/VS Code debug sessions.
server.ref();

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
