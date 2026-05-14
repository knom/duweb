import cors from 'cors';
import express from 'express';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request } from 'express';
import { jobStore } from './jobs.js';
import { redisCache } from './cache/redisCache.js';

const PORT = Number(process.env.PORT ?? 3001);
const rawBasePath = process.env.BASE_PATH ?? '';

// Auth configuration
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';
const authHeaders = {
  username: process.env.AUTH_HEADER_USERNAME ?? 'x-forwarded-user',
  groups:   process.env.AUTH_HEADER_GROUPS   ?? 'x-forwarded-groups',
  email:    process.env.AUTH_HEADER_EMAIL    ?? 'x-forwarded-email',
  name:     process.env.AUTH_HEADER_NAME     ?? 'x-forwarded-name',
  uid:      process.env.AUTH_HEADER_UID      ?? 'x-forwarded-uid',
};
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

interface ProxyIdentity {
  username?: string;
  groups: string[];
  email?: string;
  name?: string;
  uid?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expandHomePath(value: string): string {
  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function readHeader(req: Request, name: string): string | undefined {
  const value = req.header(name);
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseGroups(rawGroups: string | undefined): string[] {
  if (!rawGroups) {
    return [];
  }

  if (rawGroups.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawGroups) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
      }
    } catch {
      // Fall back to delimited parsing below.
    }
  }

  return rawGroups
    .split(/[,;]+/)
    .map((value) => value.trim())
    .filter((value) => value !== '');
}

function getProxyIdentity(req: Request): ProxyIdentity {
  const username = readHeader(req, authHeaders.username);
  const groupsHeader = readHeader(req, authHeaders.groups);
  const groups = parseGroups(groupsHeader);
  const email = readHeader(req, authHeaders.email);
  const name = readHeader(req, authHeaders.name);
  const uid = readHeader(req, authHeaders.uid);

  const identity: ProxyIdentity = { groups };
  if (username) {
    identity.username = username;
  }
  if (email) {
    identity.email = email;
  }
  if (name) {
    identity.name = name;
  }
  if (uid) {
    identity.uid = uid;
  }

  return identity;
}

app.use(cors());
app.use(express.json());

api.use((req, res, next) => {
  const identity = getProxyIdentity(req);
  res.locals.identity = identity;
  if (REQUIRE_AUTH && (!identity.username || identity.groups.length === 0)) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
});

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});

api.get('/auth/me', (_req, res) => {
  const identity = res.locals.identity as ProxyIdentity;
  res.json(identity);
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

api.get('/jobs/:id', async (req, res) => {
  const job = await jobStore.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  res.json(job);
});

api.get('/paths/suggest', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const expanded = expandHomePath(query);

  let baseDir = expanded;
  let fragment = '';

  if (!expanded) {
    baseDir = path.parse(process.cwd()).root || '/';
  } else if (expanded.endsWith(path.sep)) {
    baseDir = expanded;
  } else {
    baseDir = path.dirname(expanded);
    fragment = path.basename(expanded);
  }

  if (!path.isAbsolute(baseDir)) {
    baseDir = path.resolve(baseDir);
  }

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const search = fragment.toLowerCase();
    const suggestions = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name.toLowerCase().startsWith(search))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 20)
      .map((name) => path.join(baseDir, name));

    res.json({ suggestions });
  } catch {
    res.json({ suggestions: [] as string[] });
  }
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

// Initialize Redis cache
await redisCache.connect();

// Keep a strong reference so the process stays alive under tsx/VS Code debug sessions.
server.ref();

process.on('SIGINT', () => {
  server.close(async () => {
    await redisCache.disconnect();
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
