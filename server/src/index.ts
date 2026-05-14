import cors from 'cors';
import express from 'express';
import { jobStore } from './jobs.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/jobs/scan', (req, res) => {
  const scanPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';

  if (!scanPath) {
    res.status(400).json({ error: 'Body must contain a non-empty path field.' });
    return;
  }

  const job = jobStore.createScanJob(scanPath);
  res.status(202).json(job);
});

app.get('/api/jobs', (_req, res) => {
  res.json(jobStore.listJobs());
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobStore.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  res.json(job);
});

const server = app.listen(PORT, () => {
  console.log(`Disk usage server listening on port ${PORT}`);
});

// Keep a strong reference so the process stays alive under tsx/VS Code debug sessions.
server.ref();
globalThis.__diskScopeServer = server;

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
