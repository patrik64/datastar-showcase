import type { Context } from 'hono';
import { type Demo, demos, referenceUrl } from '../demos/index.ts';
import { highlightFile } from '../lib/highlight.ts';
import { type Html, html } from '../lib/html.ts';
import type { AppEnv } from '../lib/session.ts';

/** A feature name that links to its entry in the Datastar reference. */
export const chip = (feature: string): Html => html`
  <li><a class="chip" href="${referenceUrl(feature)}" target="_blank" rel="noreferrer">${feature}</a></li>
`;

/**
 * The wire log panel. It starts empty; public/wire-log.js fills it with every
 * Datastar request made by the page and every event the server sends back.
 */
export const wireLog = (hint = 'Use the demo and every request and server-sent event will be listed here.'): Html => html`
  <aside class="wire" id="wire-log" aria-label="Wire log">
    <div class="wire-inner">
      <header class="wire-head">
        <h2>Wire log</h2>
        <span class="wire-legend"><b class="wire-up-mark">↑</b> sent <b class="wire-down-mark">↓</b> received</span>
        <button type="button" class="wire-clear">Clear</button>
      </header>
      <ol class="wire-list"></ol>
      <p class="wire-empty">${hint}</p>
    </div>
  </aside>
`;

const pagerLink = (demo: Demo | undefined, direction: 'previous' | 'next'): Html =>
  demo
    ? html`
        <a class="pager-link ${direction}" href="/demos/${demo.slug}">
          <small>${direction === 'next' ? 'Next' : 'Previous'}</small>
          <span>${demo.title}</span>
        </a>
      `
    : html`<span></span>`;

export async function demoPage(demo: Demo, c: Context<AppEnv>): Promise<Html> {
  const index = demos.indexOf(demo);
  const sourcePath = `src/demos/${demo.slug}.ts`;

  return html`
    <article class="demo">
      <header class="demo-head">
        <p class="eyebrow">${String(index + 1).padStart(2, '0')} / ${demo.group}</p>
        <h1>${demo.title}</h1>
        <p class="lead">${demo.intro}</p>
        <ul class="chips" aria-label="Datastar features used">
          ${demo.uses.map(chip)}
        </ul>
      </header>

      ${demo.wire === false
        ? html`
            <div class="workbench solo">
              <section class="stage" aria-label="Live demo">${demo.view(c)}</section>
            </div>
            <p class="solo-note">No wire log on this page: this demo never contacts the server, so there is nothing to log.</p>
          `
        : html`
            <div class="workbench">
              <section class="stage" aria-label="Live demo">${demo.view(c)}</section>
              ${wireLog()}
            </div>
          `}

      <section class="notes">
        <h2>How it works</h2>
        <ol>
          ${demo.notes.map((note) => html`<li>${note}</li>`)}
        </ol>
      </section>

      <section class="source">
        <header class="source-head">
          <h2>The whole demo</h2>
          <code>${sourcePath}</code>
        </header>
        ${await highlightFile(sourcePath)}
      </section>

      <nav class="pager" aria-label="More demos">
        ${pagerLink(demos[index - 1], 'previous')} ${pagerLink(demos[index + 1], 'next')}
      </nav>
    </article>
  `;
}
