/**
 * End-to-end tests for the server side of every demo.
 *
 * They call the Hono app directly (no port, no browser) and check what a
 * Datastar client would receive: the pages, and the server-sent events each
 * endpoint answers with. Run them with `pnpm test`.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { app } from '../src/app.ts';
import { demos } from '../src/demos/index.ts';
import { html, raw } from '../src/lib/html.ts';
import { DATASTAR_VERSION } from '../src/views/layout.ts';

type SseEvent = { event: string; [dataKey: string]: string };

/** Splits one block of an event stream into its event name and data lines, keyed the way Datastar reads them. */
function parseEvent(block: string): SseEvent {
  const parsed: SseEvent = { event: '' };
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) parsed.event = line.slice(7);
    if (!line.startsWith('data: ')) continue;
    const [key, ...rest] = line.slice(6).split(' ');
    parsed[key!] = key! in parsed ? `${parsed[key!]}\n${rest.join(' ')}` : rest.join(' ');
  }
  return parsed;
}

/** Yields events as they arrive. Leaving the loop early cancels the request, as closing a tab would. */
async function* eventsOf(response: Response): AsyncGenerator<SseEvent> {
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += value;
      for (let end; (end = buffer.indexOf('\n\n')) >= 0; buffer = buffer.slice(end + 2)) {
        yield parseEvent(buffer.slice(0, end));
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

const allEvents = async (response: Response) => Array.fromAsync(eventsOf(response));

/** A minimal stand-in for a browser: remembers the session cookie and sends signals the way Datastar does. */
function browser() {
  let cookie = '';
  return async (method: string, path: string, options: { signals?: object; form?: Record<string, string> } = {}) => {
    const headers = new Headers({ 'datastar-request': 'true' });
    if (cookie) headers.set('cookie', cookie);
    let body: string | undefined;

    if (options.form) {
      headers.set('content-type', 'application/x-www-form-urlencoded');
      body = new URLSearchParams(options.form).toString();
    } else if (method === 'GET' || method === 'DELETE') {
      path += `?datastar=${encodeURIComponent(JSON.stringify(options.signals ?? {}))}`;
    } else {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.signals ?? {});
    }

    const response = await app.request(path, { method, headers, body });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0]!;
    return response;
  };
}

describe('pages', () => {
  test('the home page renders with the hello demo and a card for every demo', async () => {
    const response = await app.request('/');
    const page = await response.text();
    assert.equal(response.status, 200);
    assert.match(page, /<script type="module" src="\/vendor\/datastar\.js">/);
    assert.match(page, /data-bind:name/);
    for (const demo of demos) assert.ok(page.includes(`href="/demos/${demo.slug}"`), `missing card for ${demo.slug}`);
  });

  for (const demo of demos) {
    test(`/demos/${demo.slug} renders its stage, notes and source`, async () => {
      const response = await app.request(`/demos/${demo.slug}`);
      const page = await response.text();
      assert.equal(response.status, 200);
      assert.ok(page.includes(`<h1>${demo.title}</h1>`));
      assert.ok(page.includes('class="stage"'));
      assert.ok(page.includes(`src/demos/${demo.slug}.ts`));
      assert.ok(page.includes('class="shiki'), 'source should be highlighted');
      assert.equal(page.includes('id="wire-log"'), demo.wire !== false);
    });
  }

  test('unknown paths get a 404 page', async () => {
    const response = await app.request('/demos/nope');
    assert.equal(response.status, 404);
    assert.match(await response.text(), /Lost in space/);
  });

  test('the vendored Datastar bundle is served, and is the version the pages say it is', async () => {
    const response = await app.request('/vendor/datastar.js');
    assert.equal(response.status, 200);
    assert.ok((await response.text()).startsWith(`// Datastar v${DATASTAR_VERSION}`));
  });
});

describe('html helper', () => {
  test('escapes interpolated values', () => {
    assert.equal(String(html`<p title="${'"quoted"'}">${'<script>&'}</p>`), '<p title="&quot;quoted&quot;">&lt;script&gt;&amp;</p>');
  });

  test('passes nested templates and raw markup through, joins arrays, and skips empty values', () => {
    const items = ['a', 'b'].map((item) => html`<li>${item}</li>`);
    assert.equal(String(html`<ul>${items}</ul>${raw('<hr>')}${null}${undefined}${false}${true}${0}`), '<ul><li>a</li><li>b</li></ul><hr>0');
  });

  test('keeps backslashes exactly as written', () => {
    assert.equal(String(html`<i data-x="/^a\./"></i>`), '<i data-x="/^a\\./"></i>');
  });
});

describe('hello', () => {
  test('streams the greeting one character at a time, escaping the name', async () => {
    const response = await browser()('GET', '/demos/hello/greet', { signals: { name: '<Ada>' } });
    const events = await allEvents(response);
    assert.ok(events.length > 20);
    assert.ok(events.every((event) => event.event === 'datastar-patch-elements'));
    assert.equal(events[0]!.elements, '<p id="greeting" class="greeting live">H</p>');
    assert.equal(events.at(-1)!.elements, '<p id="greeting" class="greeting live">Hello, &lt;Ada&gt;! The server is streaming this to you.</p>');
  });

  test('rejects a request without signals', async () => {
    const response = await app.request('/demos/hello/greet');
    assert.equal(response.status, 400);
  });
});

describe('counter', () => {
  test('patch elements: the count is kept per visitor', async () => {
    const ada = browser();
    const grace = browser();
    await ada('GET', '/demos/counter');
    await grace('GET', '/demos/counter');

    await ada('POST', '/demos/counter/elements');
    const [second] = await allEvents(await ada('POST', '/demos/counter/elements'));
    const [other] = await allEvents(await grace('POST', '/demos/counter/elements'));

    assert.equal(second!.elements, '<output id="count-elements" class="count">2</output>');
    assert.equal(other!.elements, '<output id="count-elements" class="count">1</output>');
    assert.match(await (await ada('GET', '/demos/counter')).text(), /<output id="count-elements" class="count">2<\/output>/);
  });

  test('patch signals: the server adds one to the signal it is sent', async () => {
    const [event] = await allEvents(await browser()('POST', '/demos/counter/signals', { signals: { count: 41 } }));
    assert.deepEqual(event, { event: 'datastar-patch-signals', signals: '{"count":42}' });
  });

  test('plain HTML: an ordinary text/html response', async () => {
    const response = await browser()('POST', '/demos/counter/plain');
    assert.match(response.headers.get('content-type')!, /^text\/html/);
    assert.equal(await response.text(), '<output id="count-plain" class="count">1</output>');
  });
});

describe('search', () => {
  const search = async (signals: object) => (await allEvents(await browser()('GET', '/demos/search/results', { signals })))[0]!.elements!;

  test('filters by text and marks the match', async () => {
    const results = await search({ query: 'voyager', agency: '' });
    assert.match(results, /2 of \d+ missions/);
    assert.match(results, /<mark>Voyager<\/mark> 1/);
    assert.doesNotMatch(results, /Apollo/);
  });

  test('filters by agency', async () => {
    const results = await search({ query: '', agency: 'ISRO' });
    assert.match(results, /Chandrayaan-3/);
    assert.doesNotMatch(results, /<span class="tag">NASA<\/span>/);
  });

  test('says so when nothing matches, without trusting the query', async () => {
    const results = await search({ query: '<img src=x>', agency: '' });
    assert.match(results, /Nothing matches “&lt;img src=x&gt;”/);
  });
});

describe('validation', () => {
  test('live check: both hints come back in a single event', async () => {
    const events = await allEvents(await browser()('POST', '/demos/validation/check', { signals: { username: 'apollo', email: 'ada@example.com' } }));
    assert.equal(events.length, 1);
    assert.match(events[0]!.elements!, /<p id="username-hint" class="hint bad">“apollo” is already taken\.<\/p>/);
    assert.match(events[0]!.elements!, /<p id="email-hint" class="hint good">Looks good\.<\/p>/);
  });

  test('live check: empty fields are left alone', async () => {
    const [event] = await allEvents(await browser()('POST', '/demos/validation/check', { signals: { username: '', email: '' } }));
    assert.match(event!.elements!, /<p id="username-hint" class="hint"><\/p>/);
  });

  test('signup: problems are reported, including a short password', async () => {
    const [event] = await allEvents(await browser()('POST', '/demos/validation/signup', { signals: { username: 'ab', email: 'nope', _password: 'short' } }));
    assert.match(event!.elements!, /id="username-hint" class="hint bad"/);
    assert.match(event!.elements!, /id="email-hint" class="hint bad"/);
    assert.match(event!.elements!, /id="password-hint" class="hint bad"/);
  });

  test('signup: success swaps the form for a welcome and clears the password signal', async () => {
    const events = await allEvents(
      await browser()('POST', '/demos/validation/signup', { signals: { username: 'ada', email: 'ada@example.com', _password: 'correct horse' } }),
    );
    assert.match(events[0]!.elements!, /Welcome aboard, ada\./);
    assert.deepEqual(events[1], { event: 'datastar-patch-signals', signals: '{"_password":""}' });
  });
});

describe('todos', () => {
  const texts = (markup: string) => [...markup.matchAll(/<label [^>]*>([^<]*)<\/label>/g)].map((match) => match[1]);

  test('add, toggle, edit, filter, delete and clear', async () => {
    const visit = browser();
    const act = async (method: string, path: string, options = {}) => allEvents(await visit(method, `/demos/todos${path}`, options));
    await visit('GET', '/demos/todos');

    // Add: the list comes back, then a signal patch that empties the input.
    const added = await act('POST', '', { signals: { draft: '  Write tests  ' } });
    assert.deepEqual(texts(added[0]!.elements!), ['Read the Datastar guide', 'Double-click me to edit', 'Ship something without a build step', 'Write tests']);
    assert.deepEqual(added[1], { event: 'datastar-patch-signals', signals: '{"draft":""}' });
    assert.match(added[0]!.elements!, /<strong>3<\/strong> items left/);

    // A blank draft adds nothing.
    assert.equal(texts((await act('POST', '', { signals: { draft: '   ' } }))[0]!.elements!).length, 4);

    // Toggle.
    const toggled = await act('POST', '/4/toggle');
    assert.match(toggled[0]!.elements!, /<li id="todo-4" class="todo done"/);

    // Edit arrives as form data. Text is escaped on the way back out.
    const edited = await act('PUT', '/2', { form: { text: 'Tom & <Jerry>' } });
    assert.ok(edited[0]!.elements!.includes('>Tom &amp; &lt;Jerry&gt;</label>'));
    assert.ok(edited[0]!.elements!.includes('value="Tom &amp; &lt;Jerry&gt;"'));

    // Filter.
    const active = await act('PUT', '/filter/active');
    assert.equal(texts(active[0]!.elements!).length, 2);
    const done = await act('PUT', '/filter/done');
    assert.deepEqual(texts(done[0]!.elements!), ['Read the Datastar guide', 'Write tests']);
    await act('PUT', '/filter/all');

    // Delete one, then clear what is done.
    assert.equal(texts((await act('DELETE', '/3'))[0]!.elements!).length, 3);
    const cleared = await act('DELETE', '/done');
    assert.deepEqual(texts(cleared[0]!.elements!), ['Tom & <Jerry>'.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')]);

    // Saving an empty edit removes the to-do.
    assert.match((await act('PUT', '/2', { form: { text: '' } }))[0]!.elements!, /Nothing here\./);
  });

  test('toggle-all completes everything, then un-completes everything', async () => {
    const visit = browser();
    await visit('GET', '/demos/todos');
    const first = await allEvents(await visit('POST', '/demos/todos/toggle-all'));
    assert.match(first[0]!.elements!, /<strong>0<\/strong> items left/);
    const second = await allEvents(await visit('POST', '/demos/todos/toggle-all'));
    assert.match(second[0]!.elements!, /<strong>3<\/strong> items left/);
  });
});

describe('infinite scroll', () => {
  test('a page appends rows, then re-arms the sentinel', async () => {
    const [rows, rest] = await allEvents(await browser()('GET', '/demos/infinite-scroll/page/1'));
    assert.equal(rows!.selector, '#stars');
    assert.equal(rows!.mode, 'append');
    assert.equal(rows!.elements!.match(/<li>/g)!.length, 20);
    assert.match(rows!.elements!, /DS-0021/);
    assert.match(rest!.elements!, /data-on-intersect="@get\('\/demos\/infinite-scroll\/page\/2'\)"/);
    assert.match(rest!.elements!, /40 of 300 stars loaded/);
  });

  test('the last page ends the scrolling', async () => {
    const [, rest] = await allEvents(await browser()('GET', '/demos/infinite-scroll/page/14'));
    assert.doesNotMatch(rest!.elements!, /data-on-intersect/);
    assert.match(rest!.elements!, /That is all 300 of them\./);
  });

  test('pages that do not exist are a 404', async () => {
    for (const page of ['0', '15', 'x']) {
      assert.equal((await browser()('GET', `/demos/infinite-scroll/page/${page}`)).status, 404);
    }
  });
});

describe('streaming progress', () => {
  test('a launch can be aborted through a second request', async () => {
    const visit = browser();
    await visit('GET', '/demos/launch');
    const seen: SseEvent[] = [];

    for await (const event of eventsOf(await visit('POST', '/demos/launch/start'))) {
      seen.push(event);
      // As soon as the first step is under way, abort from "another request".
      if (seen.length === 4) assert.equal((await visit('POST', '/demos/launch/abort')).status, 204);
    }

    assert.match(seen[0]!.elements!, /Countdown started\./);
    assert.deepEqual(seen[1], { event: 'datastar-patch-signals', signals: '{"progress":0}' });
    assert.equal(seen[3]!.mode, 'append');
    assert.match(seen.at(-2)!.elements!, /Launch scrubbed\./);
    assert.match(seen.at(-2)!.elements!, /<li id="step-0" class="scrubbed">/);
    assert.match(seen.at(-1)!.elements!, /Abort during “Load propellant”\./);
  });
});

describe('view transitions', () => {
  test('orders on the server and asks for a view transition', async () => {
    const [event] = await allEvents(await browser()('GET', '/demos/view-transitions/order/size'));
    const names = [...event!.elements!.matchAll(/<strong>(\w+)<\/strong>/g)].map((match) => match[1]);
    assert.equal(event!.useViewTransition, 'true');
    assert.deepEqual(names, ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Earth', 'Venus', 'Mars', 'Mercury']);
    assert.match(event!.elements!, /aria-pressed="true" data-on:click="@get\('\/demos\/view-transitions\/order\/size'\)"/);
  });

  test('shuffle keeps all eight planets', async () => {
    const [event] = await allEvents(await browser()('GET', '/demos/view-transitions/order/shuffle'));
    assert.equal(new Set(event!.elements!.match(/id="planet-\w+"/g)).size, 8);
  });
});

describe('live dashboard', () => {
  test('the stream opens with the current view and keeps going', async () => {
    const seen: SseEvent[] = [];
    for await (const event of eventsOf(await browser()('GET', '/demos/dashboard/stream'))) {
      seen.push(event);
      if (seen.length === 2) break; // the second event is pushed by the once-a-second sampler
    }
    for (const event of seen) {
      assert.equal(event.event, 'datastar-patch-elements');
      assert.match(event.elements!, /<div id="tiles" class="tiles">/);
      assert.match(event.elements!, /<div id="cpu-chart">/);
      assert.match(event.elements!, /<table id="cpu-table">/);
    }
    assert.match(seen[1]!.elements!, /class="plot-end"/);
  });
});

describe('multiplayer pixels', () => {
  test('a paint is broadcast to every open stream as a single cell', async () => {
    const watcher = eventsOf(await browser()('GET', '/demos/pixels/stream'));
    const board = (await watcher.next()).value!;
    const presence = (await watcher.next()).value!;
    assert.equal(board.elements!.match(/<i id="px\d+"/g)!.length, 384);
    assert.match(presence.elements!, /Only you are here/);

    const paint = await browser()('POST', '/demos/pixels/paint/5', { signals: { color: 3 } });
    assert.equal(paint.status, 204);
    assert.equal((await watcher.next()).value!.elements, '<i id="px5" class="c3"></i>');

    // A second tab joining is announced to the first.
    const second = eventsOf(await browser()('GET', '/demos/pixels/stream'));
    assert.match((await second.next()).value!.elements!, /<i id="px5" class="c3"><\/i>/);
    assert.match((await watcher.next()).value!.elements!, /2 tabs are painting/);

    // "Start over" restores the picture for everyone.
    assert.equal((await browser()('POST', '/demos/pixels/reset')).status, 204);
    assert.match((await watcher.next()).value!.elements!, /<i id="px5" class="c0"><\/i>/);

    // Leaving closes the stream, and the others hear about it.
    await second.return(undefined);
    assert.match((await watcher.next()).value!.elements!, /Only you are here/);
    await watcher.return(undefined);
  });

  test('paints outside the board or the palette are refused', async () => {
    const paint = browser();
    assert.equal((await paint('POST', '/demos/pixels/paint/384', { signals: { color: 1 } })).status, 400);
    assert.equal((await paint('POST', '/demos/pixels/paint/-1', { signals: { color: 1 } })).status, 400);
    assert.equal((await paint('POST', '/demos/pixels/paint/1.5', { signals: { color: 1 } })).status, 400);
    assert.equal((await paint('POST', '/demos/pixels/paint/1', { signals: { color: 9 } })).status, 400);
    assert.equal((await paint('POST', '/demos/pixels/paint/1', { signals: {} })).status, 400);
  });
});
