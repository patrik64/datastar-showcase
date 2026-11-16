import { serve } from '@hono/node-server';
import { app } from './app.ts';

const port = Number(process.env.PORT) || 3000;

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n  ✦ Datastar Showcase is running at http://localhost:${info.port}\n`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Pick another one: PORT=3001 pnpm dev`);
    process.exit(1);
  }
  throw error;
});

// Long-lived event streams would otherwise hold a graceful shutdown open
// forever, so open connections are dropped on the way out.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    if ('closeAllConnections' in server) server.closeAllConnections();
    process.exit(0);
  });
}
