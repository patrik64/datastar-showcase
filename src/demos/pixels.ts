import { Hono } from 'hono';
import { COLOURS, COLUMNS, startingBoard } from '../data/pixel-art.ts';
import { readSignals, sse } from '../lib/datastar.ts';
import { type Html, html } from '../lib/html.ts';

export const routes = new Hono();

// One board for everybody, and one callback per browser tab that is watching.
const board = startingBoard();
const viewers = new Set<(patch: Html) => void>();
const broadcast = (patch: Html) => viewers.forEach((send) => send(patch));

const cell = (index: number) => html`<i id="px${index}" class="c${board[index]}"></i>`;

// One listener on the grid handles every cell: the click target's id says which.
const grid = () => html`
  <div
    id="board"
    class="board"
    style="--columns: ${COLUMNS}"
    aria-label="Shared pixel board"
    data-on:click="evt.target.id.startsWith('px') && @post('/demos/pixels/paint/' + evt.target.id.slice(2))"
  >
    ${board.map((_, index) => cell(index))}
  </div>
`;

const presence = () => html`
  <p id="presence" class="presence">${viewers.size === 1 ? 'Only you are here' : `${viewers.size} tabs are painting`}</p>
`;

export const view = () => html`
  <div class="pixels" data-signals:color="1" data-init="@get('/demos/pixels/stream')">
    <div class="pixels-bar">
      <div class="palette" role="radiogroup" aria-label="Colour">
        ${COLOURS.map(
          (name, index) => html`
            <label class="c${index}" title="${name}">
              <input type="radio" value="${index}" aria-label="${name}" data-bind:color />
            </label>
          `,
        )}
      </div>
      ${presence()}
      <button class="button small" data-on:click="@post('/demos/pixels/reset')">Start over</button>
    </div>
    ${grid()}
  </div>
`;

// Reads: every tab holds this stream open. It gets the whole board when it
// connects, and after that only the pieces that change.
routes.get('/stream', () =>
  sse(
    (stream) => {
      const send = (patch: Html) => stream.patchElements(patch);
      viewers.add(send);
      stream.onClose(() => {
        viewers.delete(send);
        broadcast(presence());
      });
      send(grid());
      broadcast(presence());
    },
    { keepalive: true },
  ),
);

// Writes: a click posts the cell and the chosen colour (the $color signal). The
// reply is empty. The change reaches every tab, this one included, through the
// stream: a patch holding the single cell that changed.
routes.post('/paint/:index', async (c) => {
  const index = Number(c.req.param('index'));
  const colour = Number((await readSignals<{ color: number }>(c)).color);
  if (!(index in board) || !(colour in COLOURS)) return c.body(null, 400);

  board[index] = colour;
  broadcast(cell(index));
  return c.body(null, 204);
});

routes.post('/reset', (c) => {
  board.splice(0, board.length, ...startingBoard());
  broadcast(grid());
  return c.body(null, 204);
});
