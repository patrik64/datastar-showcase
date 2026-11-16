import { Hono } from 'hono';
import { type Planet, planets } from '../data/planets.ts';
import { sse } from '../lib/datastar.ts';
import { html } from '../lib/html.ts';

export const routes = new Hono();

const ORDERS: Record<string, { label: string; compare: (a: Planet, b: Planet) => number }> = {
  distance: { label: 'Distance from the Sun', compare: (a, b) => a.distance - b.distance },
  size: { label: 'Size', compare: (a, b) => b.diameter - a.diameter },
  day: { label: 'Length of day', compare: (a, b) => a.day - b.day },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
};

const formatDay = (hours: number) => (hours < 48 ? `${hours} hours` : `${Math.round(hours / 24)} days`);

// Discs are drawn on a square-root scale, or Mercury would be a speck next to Jupiter.
const discSize = (planet: Planet) => Math.round(Math.sqrt(planet.diameter) / 4.2);

// Each card has its own view-transition-name. That is what lets the browser
// track a card from its old position to its new one and animate the move.
const system = (list: Planet[], active: string) => html`
  <div id="system" class="system">
    <div class="system-orders" role="group" aria-label="Order planets by">
      ${Object.entries(ORDERS).map(
        ([key, order]) => html`
          <button class="button small" aria-pressed="${String(key === active)}" data-on:click="@get('/demos/view-transitions/order/${key}')">
            ${order.label}
          </button>
        `,
      )}
      <button class="button small" data-on:click="@get('/demos/view-transitions/order/shuffle')">Shuffle</button>
    </div>
    <ul class="planets">
      ${list.map(
        (planet) => html`
          <li id="planet-${planet.id}" style="view-transition-name: planet-${planet.id}">
            <span class="disc" style="--size: ${discSize(planet)}px; --color: ${planet.color}"></span>
            <strong>${planet.name}</strong>
            <small>${planet.diameter.toLocaleString('en')} km wide</small>
            <small>${planet.distance} AU from the Sun</small>
            <small>A day lasts ${formatDay(planet.day)}</small>
          </li>
        `,
      )}
    </ul>
  </div>
`;

export const view = () => system(planets, 'distance');

routes.get('/order/:by', (c) => {
  const by = c.req.param('by');
  const ordered = ORDERS[by]
    ? planets.toSorted(ORDERS[by].compare)
    : planets.map((planet) => ({ planet, at: Math.random() })).sort((a, b) => a.at - b.at).map(({ planet }) => planet);

  // The same patch as always, with one extra option: Datastar wraps the morph
  // in document.startViewTransition(), and the browser animates the change.
  return sse((stream) => stream.patchElements(system(ordered, by), { useViewTransition: true }));
});
