import { jobStore } from './jobs.js';
import { createApp } from './app.js';
import { redisCache } from './cache/redisCache.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp(config);

// Server startup
const server = app.listen(config.port, () => {
  console.log(`
   Disk Usage Web Server
   -----------------------------------
   Listening on port: ${config.port}
   API prefix: ${config.apiPrefix}
   Auth required: ${config.requireAuth ? 'YES' : 'NO '}
   Auth group: ${config.requireAuthGroup ?? '-'}
   Redis cache: ${config.redisUrl ? 'ENABLED' : 'DISABLED'}
  `);
});

// Initialize Redis cache
console.log('[Init] Initializing Redis cache...');
await redisCache.connect(config.redisUrl);

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
