# Datastar Showcase

A hands-on tour of [Datastar](https://data-star.dev), the hypermedia framework that pairs
`data-*` attributes and signals in the browser with a backend that streams HTML.

Ten small demos, each a single file, running on one Node server with no build step.
Every demo page shows the demo, explains how it works, prints its complete source, and has
a **wire log** that lists each request and each server-sent event as it happens.

## Run it

You need Node 22.18 or newer, and pnpm.

```sh
pnpm install
pnpm dev
```

Then open <http://localhost:3000>. To use another port: `PORT=4000 pnpm dev`.

| Script           | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Starts the server and restarts it when a source file changes    |
| `pnpm start`     | Starts the server once                                          |
| `pnpm test`      | Runs the tests: every page, and what every endpoint streams back |
| `pnpm typecheck` | Type-checks the project                                         |

## The demos

| #   | Demo                 | What it shows                                                                     |
| --- | -------------------- | --------------------------------------------------------------------------------- |
| 01  | Signals and bindings | Reactive state with no server: `data-bind`, `data-computed`, `data-show`, and more |
| 02  | Counter, three ways  | One click answered by patched elements, patched signals, or plain HTML            |
| 03  | Active search        | Debounced requests, a loading indicator, and stale requests cancelled for you     |
| 04  | Inline validation    | Server-side checks while typing, and local signals that never leave the browser   |
| 05  | To-do list           | All state on the server, the whole widget morphed in after each action            |
| 06  | Infinite scroll      | `data-on-intersect` and append mode                                               |
| 07  | Streaming progress   | One request, sixty events, and a second request that aborts the first             |
| 08  | View transitions     | Server-side sorting animated by the browser                                       |
| 09  | Live dashboard       | A long-lived stream pushing a server-rendered chart every second                  |
| 10  | Multiplayer pixels   | A shared canvas: one stream for reads, tiny requests for writes                   |

The home page has an eleventh, the smallest of all: a greeting streamed one character at a time.

Two things worth knowing while you explore:

- **Open the multiplayer demo in two windows**, side by side. Two tabs in one window will not
  do, because Datastar closes `GET` streams in a hidden tab and reopens them when you return.
- **State lives in memory.** Each visitor gets their own counters and to-do list (a cookie tells
  them apart), the pixel board is shared by everyone, and restarting the server resets it all.

## How it is built

- **[Datastar](https://data-star.dev) 1.0.5** in the browser. The bundle is vendored in
  `public/vendor/`, so the showcase works offline. That one script is the only JavaScript the
  demos need.
- **[Hono](https://hono.dev)** for routing, on Node's own HTTP server.
- **The official Datastar SDK** (`@starfederation/datastar-sdk`) to format server-sent events
  and read the signals a request carries.
- **[Shiki](https://shiki.style)** to highlight the source panels on the server.
- **No build step.** Node runs the TypeScript files directly, and the CSS is plain CSS.

```
src/
  server.ts          starts the HTTP server
  app.ts             routes: static files, the pages, and each demo's endpoints
  demos/
    index.ts         the list of demos, with the text that surrounds each one
    counter.ts …     one file per demo
  lib/
    html.ts          html`…` templates that escape what you interpolate
    datastar.ts      sse() and readSignals(), a thin layer over the SDK
    session.ts       per-visitor state in memory
    chart.ts         the server-rendered line chart
    highlight.ts     syntax highlighting for the source panels
  views/             the page shell, the home page and the demo page
  data/              missions, planets, stars and the starting pixel art
public/
  styles.css         all of the styling
  wire-log.js        the wire log (see below)
  vendor/            the Datastar bundle and its licence
test/
  app.test.ts        the tests
```

### Anatomy of a demo

A demo exports two things: a `view` that returns the markup for the stage, and `routes` with
the endpoints that markup calls. Leaving out the surrounding layout, this is the first counter:

```ts
const elementsCount = (count: number) => html`<output id="count-elements" class="count">${count}</output>`;

export const view = (c) => html`
  ${elementsCount(state(c).elements)}
  <button data-on:click="@post('/demos/counter/elements')">Add one</button>
`;

routes.post('/elements', (c) => {
  const counter = state(c);
  counter.elements++;
  return sse((stream) => stream.patchElements(elementsCount(counter.elements)));
});
```

The button posts to the server. The server answers with a `datastar-patch-elements` event
holding the `<output>`, and Datastar morphs it into the element with the same `id`.

To add a demo of your own, create `src/demos/<name>.ts` with those two exports and add an
entry for it in `src/demos/index.ts`. The page, the navigation link, the source panel and
the wire log come for free.

### The wire log

`public/wire-log.js` is a teaching aid, not part of Datastar. Datastar makes its backend calls
with `fetch`, so the script wraps `fetch`, notes each request and the signals it carries, and
copies each response into the panel as it streams past. The demos do not depend on it.

### Updating Datastar

The bundle is a copy of the official build. To move to another version, replace the files and
update `DATASTAR_VERSION` in `src/views/layout.ts`:

```sh
V=v1.0.5
curl -L -o public/vendor/datastar.js     https://cdn.jsdelivr.net/gh/starfederation/datastar@$V/bundles/datastar.js
curl -L -o public/vendor/datastar.js.map https://cdn.jsdelivr.net/gh/starfederation/datastar@$V/bundles/datastar.js.map
```

## Credits

Datastar is made by [Star Federation](https://github.com/starfederation/datastar) and released
under the MIT licence, a copy of which is in `public/vendor/datastar.LICENSE.md`. This showcase
is unofficial and not affiliated with the Datastar project.
