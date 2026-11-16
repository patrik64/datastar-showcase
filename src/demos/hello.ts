import { setTimeout as sleep } from 'node:timers/promises';
import { Hono } from 'hono';
import { readSignals, sse } from '../lib/datastar.ts';
import { html } from '../lib/html.ts';

export const routes = new Hono();

// The page: an input bound to a signal, and a button that calls the server.
export const view = () => html`
  <div class="hello" data-signals:name="''">
    <div class="hello-form">
      <input type="text" placeholder="Your name" aria-label="Your name" maxlength="24" data-bind:name />
      <button class="button primary" data-on:click="@get('/demos/hello/greet')">Say hello</button>
    </div>
    <p id="greeting" class="greeting">Type a name, then ask the server to greet you.</p>
  </div>
`;

// The server: read the signal, then stream the greeting back one character at
// a time. Each event carries the whole <p>, which Datastar morphs in by id.
routes.get('/greet', async (c) => {
  const { name } = await readSignals<{ name: string }>(c);
  const who = String(name ?? '').trim().slice(0, 24) || 'stranger';
  const message = `Hello, ${who}! The server is streaming this to you.`;

  return sse(async (stream) => {
    for (let length = 1; length <= message.length; length++) {
      stream.patchElements(html`<p id="greeting" class="greeting live">${message.slice(0, length)}</p>`);
      await sleep(30, undefined, { signal: stream.signal });
    }
  });
});
