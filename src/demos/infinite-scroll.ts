import { setTimeout as sleep } from 'node:timers/promises';
import { Hono } from 'hono';
import { stars } from '../data/stars.ts';
import { sse } from '../lib/datastar.ts';
import { html } from '../lib/html.ts';

export const routes = new Hono();

const PAGE_SIZE = 20;
const pageCount = Math.ceil(stars.length / PAGE_SIZE);

const rows = (page: number) =>
  stars.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(
    (star) => html`
      <li>
        <i class="star-dot" style="--star: ${star.color}"></i>
        <span class="star-id">${star.id}</span>
        <span class="star-region">${star.region}</span>
        <span class="star-type">class ${star.type}</span>
        <span class="star-figure">mag ${star.magnitude}</span>
        <span class="star-figure">${star.distance.toLocaleString('en')} ly</span>
      </li>
    `,
  );

// The last element in the scroller. While there is more to load it carries a
// data-on-intersect attribute, which fires as soon as it scrolls into view.
const sentinel = (nextPage: number) =>
  nextPage < pageCount
    ? html`<p id="more" class="more" data-on-intersect="@get('/demos/infinite-scroll/page/${nextPage}')">Loading more stars…</p>`
    : html`<p id="more" class="more">That is all ${stars.length} of them.</p>`;

const progress = (pagesLoaded: number) => html`
  <p id="loaded" class="loaded">${Math.min(pagesLoaded * PAGE_SIZE, stars.length)} of ${stars.length} stars loaded</p>
`;

export const view = () => html`
  <div class="catalogue">
    ${progress(1)}
    <div class="sky">
      <ol id="stars">
        ${rows(0)}
      </ol>
      ${sentinel(1)}
    </div>
  </div>
`;

routes.get('/page/:page', async (c) => {
  const page = Number(c.req.param('page'));
  if (!Number.isInteger(page) || page < 1 || page >= pageCount) return c.notFound();
  await sleep(400); // long enough to see the loading row

  return sse((stream) => {
    // 1. Add the new rows to the end of the list.
    stream.patchElements(html`${rows(page)}`, { selector: '#stars', mode: 'append' });
    // 2. Morph the sentinel and the counter. The sentinel now points at the next
    //    page, so it will fire again the next time it comes into view.
    stream.patchElements(html`${sentinel(page + 1)}${progress(page + 1)}`);
  });
});
