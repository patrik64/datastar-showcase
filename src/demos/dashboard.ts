import { Hono } from 'hono';
import { lineChart } from '../lib/chart.ts';
import { sse } from '../lib/datastar.ts';
import { type Html, html } from '../lib/html.ts';
import { stats } from '../lib/stats.ts';

export const routes = new Hono();

const WINDOW = 60; // seconds of history to keep

type Sample = { time: string; cpu: number; lag: number; memory: number; requests: number };

const samples: Sample[] = [];
// One callback per open browser tab.
const viewers = new Set<(view: Html) => void>();

// Event-loop lag: how late a short timer fires. A busy loop makes it very late.
let lag = 0;
let due = performance.now() + 20;
setInterval(() => {
  const now = performance.now();
  lag = Math.max(lag, now - due);
  due = now + 20;
}, 20).unref();

// Once a second: measure this Node process, then push the new view to everyone.
let cpu = process.cpuUsage();
let requests = stats.requests;
let measuredAt = performance.now();

setInterval(() => {
  const now = performance.now();
  const used = process.cpuUsage(cpu); // microseconds of CPU time since the last sample

  samples.push({
    time: new Date().toLocaleTimeString('en-GB'),
    cpu: Math.min(100, ((used.user + used.system) / 1000 / (now - measuredAt)) * 100),
    lag,
    memory: process.memoryUsage.rss() / 1024 / 1024,
    requests: stats.requests - requests,
  });
  if (samples.length > WINDOW) samples.shift();

  cpu = process.cpuUsage();
  requests = stats.requests;
  measuredAt = now;
  lag = 0;

  if (viewers.size > 0) {
    const view = live(); // rendered once, however many tabs are watching
    for (const send of viewers) send(view);
  }
}, 1000).unref();

const tile = (label: string, value: string | number, unit = '') => html`
  <div class="tile">
    <span class="tile-label">${label}</span>
    <strong class="tile-value">${value}<small>${unit}</small></strong>
  </div>
`;

const tiles = () => {
  const latest = samples.at(-1);
  return html`
    <div id="tiles" class="tiles">
      ${tile('Event loop lag', (latest?.lag ?? 0).toFixed(1), 'ms')}
      ${tile('Memory in use', Math.round(latest?.memory ?? 0), 'MB')}
      ${tile('Requests, last second', latest?.requests ?? 0)}
      ${tile('Open event streams', stats.streams)}
    </div>
  `;
};

const percent = (value: number) => `${Math.round(value)}%`;

const chart = () => html`
  <div id="cpu-chart">
    ${lineChart({
      points: samples.map((sample) => ({ label: sample.time, value: sample.cpu })),
      capacity: WINDOW,
      max: 100,
      ticks: [0, 25, 50, 75, 100],
      format: percent,
      xLabels: [`${WINDOW} s ago`, `${WINDOW / 2} s ago`, 'now'],
    })}
  </div>
`;

// The same numbers as the chart, for anyone who would rather read than hover.
const table = () => html`
  <table id="cpu-table">
    <thead>
      <tr><th>Time</th><th>CPU load</th><th>Event loop lag</th></tr>
    </thead>
    <tbody>
      ${samples.toReversed().map((sample) => html`<tr><td>${sample.time}</td><td>${percent(sample.cpu)}</td><td>${sample.lag.toFixed(1)} ms</td></tr>`)}
    </tbody>
  </table>
`;

// The three parts that change. Each has an id, so one event can patch them all.
const live = () => html`${tiles()}${chart()}${table()}`;

// data-init opens the stream as soon as the element is on the page. The
// datastar-fetch listener keeps $_live honest: it is true only while events
// from this element's own request are actually arriving.
export const view = () => html`
  <div
    class="dash"
    data-signals="{_live: false, _table: false}"
    data-on:datastar-fetch="evt.detail.el === el && ($_live = evt.detail.type.startsWith('datastar-patch'))"
    data-init="@get('/demos/dashboard/stream')"
  >
    <header class="dash-head">
      <span class="live-badge" data-class:on="$_live"><i></i><span data-text="$_live ? 'Live' : 'Waiting for the server'">Connecting</span></span>
      <button class="button small" data-on:click="@post('/demos/dashboard/spike')">Spike the CPU</button>
    </header>

    ${tiles()}

    <figure class="chart">
      <figcaption>
        <span><strong>CPU load</strong> of this server, as a share of one core</span>
        <button type="button" class="button small quiet" data-on:click="$_table = !$_table" data-text="$_table ? 'Show chart' : 'Show table'">
          Show table
        </button>
      </figcaption>
      <div data-show="!$_table">${chart()}</div>
      <div class="chart-table" style="display: none" data-show="$_table">${table()}</div>
    </figure>
  </div>
`;

// A long-lived response. It sends the current view at once, then stays open
// and receives every later one from the sampler above.
routes.get('/stream', () =>
  sse(
    (stream) => {
      const send = (view: Html) => stream.patchElements(view);
      viewers.add(send);
      stream.onClose(() => viewers.delete(send));
      send(live());
    },
    { keepalive: true },
  ),
);

// Blocks the event loop for a moment, to give the chart something to show.
// At most once a second, so the button cannot be used to freeze the server.
let lastSpike = 0;
routes.post('/spike', (c) => {
  if (performance.now() - lastSpike > 1000) {
    const until = performance.now() + 400;
    while (performance.now() < until) Math.sqrt(Math.random());
    lastSpike = performance.now();
  }
  return c.body(null, 204);
});
