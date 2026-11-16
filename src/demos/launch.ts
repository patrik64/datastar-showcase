import { setTimeout as sleep } from 'node:timers/promises';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { sse } from '../lib/datastar.ts';
import { html } from '../lib/html.ts';
import { type AppEnv, sessionState } from '../lib/session.ts';

export const routes = new Hono<AppEnv>();

const STEPS = ['Load propellant', 'Check avionics', 'Clear the range', 'Chill the engines', 'Ignition'];
const STEP_MS = 1200;

// The launch in progress for this visitor, if any, so that "Abort" can stop it.
const state = (c: Context<AppEnv>) => sessionState<{ run?: AbortController }>(c, 'launch', () => ({}));

const step = (index: number, status: 'waiting' | 'active' | 'done' | 'scrubbed' = 'waiting') => html`
  <li id="step-${index}" class="${status}">${STEPS[index]}</li>
`;

const headline = (text: string, mood = 'calm') => html`<p id="headline" class="headline ${mood}">${text}</p>`;

const logLine = (text: string) => html`<li>${new Date().toLocaleTimeString('en-GB')} ${text}</li>`;

const rocket = (flying = false) => html`<span id="rocket" class="rocket${flying ? ' flying' : ''}">🚀</span>`;

// The parts that a launch resets: the checklist, the log and the rocket.
const board = () => html`
  <div id="board" class="launch-board">
    <ol class="steps-list">
      ${STEPS.map((_, index) => step(index))}
    </ol>
    <ol id="log" class="launch-log" aria-live="polite"></ol>
    <div class="pad">${rocket()}</div>
  </div>
`;

// data-indicator turns $_running on for as long as the launch request is open,
// which is the whole launch: the response is the stream of progress.
export const view = () => html`
  <div class="launch" data-signals:progress="0">
    <div class="launch-top">
      ${headline('Ready on the pad.')}
      <button class="button primary" data-indicator:_running data-attr:disabled="$_running" data-on:click="@post('/demos/launch/start')">
        Launch
      </button>
      <button class="button" style="display: none" data-show="$_running" data-on:click="@post('/demos/launch/abort')">Abort</button>
    </div>
    <div class="progress" role="progressbar" aria-label="Launch progress" data-attr:aria-valuenow="$progress">
      <i data-style:width="$progress + '%'"></i>
    </div>
    ${board()}
  </div>
`;

// One request, many events. The handler works through the checklist and reports
// as it goes; the browser applies each event the moment it arrives.
routes.post('/start', (c) => {
  const launch = state(c);
  launch.run?.abort();
  const run = (launch.run = new AbortController());

  return sse(async (stream) => {
    // Stop waiting if "Abort" is pressed, or if the browser goes away.
    const signal = AbortSignal.any([run.signal, stream.signal]);
    let current = 0;

    stream.patchElements(html`${headline('Countdown started.')}${board()}`);
    stream.patchSignals({ progress: 0 });

    try {
      for (; current < STEPS.length; current++) {
        stream.patchElements(step(current, 'active'));
        stream.patchElements(logLine(`${STEPS[current]}…`), { selector: '#log', mode: 'append' });

        // Progress is a signal: ten small updates per step, no HTML involved.
        for (let tick = 1; tick <= 10; tick++) {
          await sleep(STEP_MS / 10, undefined, { signal });
          stream.patchSignals({ progress: Math.round(((current + tick / 10) / STEPS.length) * 100) });
        }
        stream.patchElements(step(current, 'done'));
      }

      stream.patchElements(html`${headline('Liftoff!', 'good')}${rocket(true)}`);
      stream.patchElements(logLine('Liftoff.'), { selector: '#log', mode: 'append' });
      // The server can also run script in the page: here, a little camera shake.
      stream.executeScript(
        `document.querySelector('.launch').animate({ translate: ['0 0', '2px -2px', '-2px 1px', '1px 2px', '0 0'] }, { duration: 140, iterations: 6 })`,
      );
    } catch (error) {
      if (!signal.aborted) throw error;
      // The wait was interrupted. If the browser is still there, tell it why.
      stream.patchElements(html`${headline('Launch scrubbed.', 'bad')}${step(current, 'scrubbed')}`);
      stream.patchElements(logLine(`Abort during “${STEPS[current]}”.`), { selector: '#log', mode: 'append' });
    } finally {
      if (launch.run === run) launch.run = undefined;
    }
  });
});

// A second request stops the first. Nothing needs to come back: the news
// reaches the page through the launch stream that is still open.
routes.post('/abort', (c) => {
  state(c).run?.abort();
  return c.body(null, 204);
});
