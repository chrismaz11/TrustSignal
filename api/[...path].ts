import type { IncomingMessage, ServerResponse } from 'node:http';

import { buildServer } from '../apps/api/src/server.js';

let appPromise: ReturnType<typeof buildServer> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = buildServer();
  }
  const app = await appPromise;
  await app.ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
