import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ServerConfig } from './config.js';
import { createAuthMiddleware, createUIAuthMiddleware } from './middleware/auth.js';
import { createLoggingMiddleware } from './middleware/logging.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerPathRoutes } from './routes/paths.js';
import { escapeRegExp } from './utils/path.js';

export function createApp(config: ServerConfig) {
  const app = express();
  const api = express.Router();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDistPath = path.resolve(__dirname, '../../client-dist');

  app.use(cors());
  app.use(express.json());
  app.use(createLoggingMiddleware());

  api.use(createAuthMiddleware(config));
  registerHealthRoutes(api);
  registerJobRoutes(api);
  registerPathRoutes(api);

  app.use(config.apiPrefix, api);

  if (existsSync(clientDistPath)) {
    const uiMountPath = config.normalizedBasePath || '/';
    app.use(uiMountPath, createUIAuthMiddleware(config));
    app.use(uiMountPath, express.static(clientDistPath));

    const uiMatcher =
      config.normalizedBasePath === ''
        ? /^\/(?!api(?:\/|$)).*/
        : new RegExp(`^${escapeRegExp(config.normalizedBasePath)}(?:\/.*)?$`);

    app.get(uiMatcher, (_req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  return app;
}