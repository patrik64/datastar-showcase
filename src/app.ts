import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { demos, hello } from './demos/index.ts';
import { html } from './lib/html.ts';
import { type AppEnv, sessionMiddleware } from './lib/session.ts';
import { stats } from './lib/stats.ts';
import { demoPage } from './views/demo.ts';
import { homePage } from './views/home.ts';
import { layout } from './views/layout.ts';

export const app = new Hono<AppEnv>();

// Counted for the live dashboard demo.
app.use(async (_c, next) => {
  stats.requests++;
  await next();
});

app.use(
  serveStatic({
    root: fileURLToPath(new URL('../public', import.meta.url)),
    // Always revalidate, so an edited stylesheet shows up on the next reload.
    onFound: (_path, c) => c.header('Cache-Control', 'no-cache'),
  }),
);

app.use(sessionMiddleware);

app.get('/', async (c) =>
  c.html(
    String(
      layout({
        title: 'Datastar Showcase',
        description: `A hands-on tour of the Datastar hypermedia framework in ${demos.length} working demos.`,
        path: '/',
        body: await homePage(),
      }),
    ),
  ),
);

// The greeting on the home page is a demo too; it just has no page of its own.
app.route('/demos/hello', hello.routes);

for (const demo of demos) {
  const path = `/demos/${demo.slug}`;

  // The page itself…
  app.get(path, async (c) =>
    c.html(
      String(
        layout({
          title: `${demo.title} · Datastar Showcase`,
          description: demo.summary,
          path,
          body: await demoPage(demo, c),
        }),
      ),
    ),
  );

  // …and the endpoints its markup calls.
  app.route(path, demo.routes);
}

app.notFound((c) =>
  c.html(
    String(
      layout({
        title: 'Not found · Datastar Showcase',
        description: 'This page does not exist.',
        path: c.req.path,
        body: html`
          <div class="not-found">
            <p class="eyebrow">404</p>
            <h1>Lost in space</h1>
            <p class="lead">There is nothing at <code>${c.req.path}</code>.</p>
            <p><a class="button primary" href="/">Back to the overview</a></p>
          </div>
        `,
      }),
    ),
    404,
  ),
);

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error(error);
  return c.text('Internal Server Error', 500);
});

// Vercel runs the app from this file's default export. Locally, src/server.ts
// starts it on a port instead.
export default app;
