import { setTimeout as sleep } from 'node:timers/promises';
import { Hono } from 'hono';
import { agencies, missions } from '../data/missions.ts';
import { readSignals, sse } from '../lib/datastar.ts';
import { type Html, html } from '../lib/html.ts';

export const routes = new Hono();

const LIMIT = 20;

// Wraps the part of `text` that matches the query in <mark>.
function mark(text: string, query: string): Html | string {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  const end = at + query.length;
  return html`${text.slice(0, at)}<mark>${text.slice(at, end)}</mark>${text.slice(end)}`;
}

function results(query: string, agency: string): Html {
  const needle = query.toLowerCase();
  const found = missions.filter(
    (mission) =>
      (!agency || mission.agency === agency) &&
      `${mission.name} ${mission.note} ${mission.target} ${mission.year}`.toLowerCase().includes(needle),
  );

  return html`
    <div id="results" class="results">
      <p class="results-count" aria-live="polite">
        ${found.length} of ${missions.length} missions${found.length > LIMIT ? `, showing the first ${LIMIT}` : ''}
      </p>
      <ul>
        ${found.slice(0, LIMIT).map(
          (mission) => html`
            <li>
              <span class="year">${mark(String(mission.year), query)}</span>
              <span class="what"><strong>${mark(mission.name, query)}</strong> ${mark(mission.note, query)}</span>
              <span class="where">${mark(mission.target, query)}</span>
              <span class="tag">${mission.agency}</span>
            </li>
          `,
        )}
      </ul>
      ${found.length === 0 && html`<p class="results-empty">Nothing matches “${query}”.</p>`}
    </div>
  `;
}

// One debounced listener on the wrapper catches input from both controls. The
// ref makes the "/" shortcut work; its underscore keeps it out of requests.
export const view = () => html`
  <div
    class="search"
    data-signals="{query: '', agency: ''}"
    data-indicator:_searching
    data-on:input__debounce.200ms="@get('/demos/search/results')"
    data-on:keydown__window="evt.key === '/' && !evt.target.closest('input, select') && (evt.preventDefault(), $_box.focus())"
  >
    <div class="search-bar">
      <input type="search" placeholder="Search missions, e.g. moon, rover, 1977" aria-label="Search missions" autocomplete="off" data-bind:query data-ref:_box />
      <select aria-label="Agency" data-bind:agency>
        <option value="">Every agency</option>
        ${agencies.map((agency) => html`<option>${agency}</option>`)}
      </select>
      <span class="spinner" data-class:on="$_searching" aria-hidden="true"></span>
    </div>
    <p class="search-tip">Press <kbd>/</kbd> to jump to the search box.</p>
    ${results('', '')}
  </div>
`;

routes.get('/results', async (c) => {
  const { query, agency } = await readSignals<{ query: string; agency: string }>(c);
  await sleep(450); // a pretend slow database: time to see the spinner, and to interrupt
  return sse((stream) => stream.patchElements(results(String(query ?? '').trim(), String(agency ?? ''))));
});
