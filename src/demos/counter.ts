import { Hono } from 'hono';
import type { Context } from 'hono';
import { readSignals, sse } from '../lib/datastar.ts';
import { html } from '../lib/html.ts';
import { type AppEnv, sessionState } from '../lib/session.ts';

export const routes = new Hono<AppEnv>();

// Two of the three counters live on the server, one per visitor.
const state = (c: Context<AppEnv>) => sessionState(c, 'counter', () => ({ elements: 0, plain: 0 }));

const elementsCount = (count: number) => html`<output id="count-elements" class="count">${count}</output>`;
const plainCount = (count: number) => html`<output id="count-plain" class="count">${count}</output>`;

export const view = (c: Context<AppEnv>) => html`
  <div class="lanes">
    <section class="lane">
      <h3>Patch elements</h3>
      <p>The server keeps the count and sends back the element that shows it.</p>
      ${elementsCount(state(c).elements)}
      <button class="button" data-on:click="@post('/demos/counter/elements')">Add one</button>
    </section>

    <section class="lane" data-signals:count="0">
      <h3>Patch signals</h3>
      <p>The browser keeps the count in a signal. The server only does the maths.</p>
      <output class="count" data-text="$count"></output>
      <button class="button" data-on:click="@post('/demos/counter/signals')">Add one</button>
    </section>

    <section class="lane">
      <h3>Plain HTML</h3>
      <p>No event stream at all: an ordinary <code>text/html</code> response.</p>
      ${plainCount(state(c).plain)}
      <button class="button" data-on:click="@post('/demos/counter/plain')">Add one</button>
    </section>
  </div>
`;

// 1. Patch elements: Datastar morphs the <output> into place, matching by id.
routes.post('/elements', (c) => {
  const counter = state(c);
  counter.elements++;
  return sse((stream) => stream.patchElements(elementsCount(counter.elements)));
});

// 2. Patch signals: $count arrives in the request body, and a new value goes
//    back. data-text re-renders by itself, and the server stores nothing.
routes.post('/signals', async (c) => {
  const { count } = await readSignals<{ count: number }>(c);
  return sse((stream) => stream.patchSignals({ count: (Number(count) || 0) + 1 }));
});

// 3. Plain HTML: Datastar treats a text/html response as elements to morph,
//    so any backend that can render a template can drive the page.
routes.post('/plain', (c) => {
  const counter = state(c);
  counter.plain++;
  return c.html(String(plainCount(counter.plain)));
});
