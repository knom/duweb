import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { jobStore } from './jobs.js';
import { redisCache } from './cache/redisCache.js';
import { createAuthMiddleware, createUIAuthMiddleware, REQUIRE_AUTH } from './middleware/auth.js';
import { createLoggingMiddleware } from './middleware/logging.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerPathRoutes } from './routes/paths.js';
import { escapeRegExp } from './utils/path.js';

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(createLoggingMiddleware());

// API auth and routes
api.use(createAuthMiddleware());
registerHealthRoutes(api);
registerJobRoutes(api);
registerPathRoutes(api);

app.use(apiPrefix, api);

// Static UI serving with auth middleware
if (existsSync(clientDistPath)) {
  const uiMountPath = normalizedBasePath || '/';
  
  // Apply UI auth middleware before serving static files
  app.use(uiMountPath, createUIAuthMiddleware());
  app.use(uiMountPath, express.static(clientDistPath));

  const uiMatcher =
    normalizedBasePath === ''
      ? /^\/(?!api(?:\/|$)).*/
      : new RegExp(`^${escapeRegExp(normalizedBasePath)}(?:\/.*)?$`);

  app.get(uiMatcher, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Server startup
const server = app.listen(PORT, () => {
  console.log(`
   Disk Usage Web Server
   -----------------------------------
   Listening on port: ${PORT}
   API prefix: ${apiPrefix}
   Auth required: ${REQUIRE_AUTH ? 'YES' : 'NO '}
  `);
});

// Initialize Redis cache
console.log('[Init] Initializing Redis cache...');
await redisCache.connect();

// Keep a strong reference so the process stays alive under tsx/VS Code debug sessions.
server.ref();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Shutdown] Received SIGINT, shutting down gracefully...');
  server.close(async () => {
    console.log('[Shutdown] Disconnecting Redis...');
    await redisCache.disconnect();
    console.log('[Shutdown] Server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('[Shutdown] Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('[Shutdown] Server stopped');
    process.exit(0);
  });
});
