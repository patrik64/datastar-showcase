/**
 * Per-visitor state, kept in memory.
 *
 * A cookie identifies the browser, and each demo stores whatever it needs under
 * its own key. Nothing is persisted: restarting the server starts everyone
 * afresh, which is exactly what a showcase wants.
 */
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

export type AppEnv = { Variables: { sessionId: string } };

type Session = { lastSeen: number; data: Map<string, unknown> };

const COOKIE = 'showcase_session';
const MAX_IDLE_MS = 2 * 60 * 60 * 1000;
const sessions = new Map<string, Session>();

const isSessionId = (value: string | undefined): value is string => !!value && /^[0-9a-f-]{36}$/.test(value);

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  let id = getCookie(c, COOKIE);
  if (!isSessionId(id)) {
    id = crypto.randomUUID();
    setCookie(c, COOKIE, id, { path: '/', httpOnly: true, sameSite: 'Lax' });
  }
  c.set('sessionId', id);
  await next();
};

/** Returns this visitor's state for `key`, creating it with `init` on first use. */
export function sessionState<T>(c: Context<AppEnv>, key: string, init: () => T): T {
  const id = c.get('sessionId');
  let session = sessions.get(id);
  if (!session) sessions.set(id, (session = { lastSeen: 0, data: new Map() }));
  session.lastSeen = Date.now();
  if (!session.data.has(key)) session.data.set(key, init());
  return session.data.get(key) as T;
}

// Forget visitors who have been away for a while.
setInterval(() => {
  const cutoff = Date.now() - MAX_IDLE_MS;
  for (const [id, session] of sessions) {
    if (session.lastSeen < cutoff) sessions.delete(id);
  }
}, 10 * 60 * 1000).unref();
