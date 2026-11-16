import { Hono } from 'hono';
import type { Context } from 'hono';
import { readSignals, sse } from '../lib/datastar.ts';
import { html } from '../lib/html.ts';
import { type AppEnv, sessionState } from '../lib/session.ts';

export const routes = new Hono<AppEnv>();

type Todo = { id: number; text: string; done: boolean };
type Filter = 'all' | 'active' | 'done';
type State = { todos: Todo[]; filter: Filter; nextId: number };

const FILTERS: Filter[] = ['all', 'active', 'done'];
const MAX_TODOS = 50;

// Each visitor gets a list of their own, kept in memory on the server.
const state = (c: Context<AppEnv>) =>
  sessionState<State>(c, 'todos', () => ({
    todos: [
      { id: 1, text: 'Read the Datastar guide', done: true },
      { id: 2, text: 'Double-click me to edit', done: false },
      { id: 3, text: 'Ship something without a build step', done: false },
    ],
    filter: 'all',
    nextId: 4,
  }));

// One row. $_editing holds the id of the row being edited (0 for none). It is a
// local signal, so entering and leaving edit mode never touches the server.
const row = (todo: Todo) => html`
  <li id="todo-${todo.id}" class="todo${todo.done ? ' done' : ''}" data-class:editing="$_editing === ${todo.id}">
    <input type="checkbox" aria-label="Done" ${todo.done ? 'checked' : ''} data-on:change="@post('/demos/todos/${todo.id}/toggle')" />
    <label data-on:dblclick="$_editing = ${todo.id}">${todo.text}</label>
    <form data-on:submit="@put('/demos/todos/${todo.id}', {contentType: 'form'}); $_editing = 0">
      <input
        name="text"
        value="${todo.text}"
        aria-label="Edit to-do"
        data-effect="$_editing === ${todo.id} && (el.focus(), el.select())"
        data-on:keydown="evt.key === 'Escape' && el.blur()"
        data-on:blur="$_editing = 0; el.value = el.defaultValue"
      />
    </form>
    <button class="remove" aria-label="Delete" data-on:click="@delete('/demos/todos/${todo.id}')">×</button>
  </li>
`;

// The whole widget is a function of the state. Every change re-renders all of
// it, and Datastar morphs the difference into the page.
const todoList = ({ todos, filter }: State) => {
  const shown = todos.filter((todo) => filter === 'all' || todo.done === (filter === 'done'));
  const left = todos.filter((todo) => !todo.done).length;

  return html`
    <section id="todos" class="todos" data-signals="{draft: '', _editing: 0}">
      <form class="todos-new" data-on:submit="$draft.trim() && @post('/demos/todos')">
        <button type="button" class="toggle-all" aria-label="Mark all as done" data-on:click="@post('/demos/todos/toggle-all')">✓</button>
        <input placeholder="What needs doing?" aria-label="New to-do" autocomplete="off" data-bind:draft />
      </form>

      <ul class="todos-list">
        ${shown.map(row)}
      </ul>
      ${shown.length === 0 && html`<p class="todos-empty">Nothing here.</p>`}

      <footer class="todos-foot">
        <span><strong>${left}</strong> ${left === 1 ? 'item' : 'items'} left</span>
        <span class="todos-filters">
          ${FILTERS.map(
            (name) => html`
              <button aria-pressed="${String(name === filter)}" data-on:click="@put('/demos/todos/filter/${name}')">${name}</button>
            `,
          )}
        </span>
        <button data-on:click="@delete('/demos/todos/done')" ${left === todos.length ? 'disabled' : ''}>Clear done</button>
      </footer>
    </section>
  `;
};

export const view = (c: Context<AppEnv>) => todoList(state(c));

// Every endpoint changes the state, then answers with the freshly rendered list.
const render = (c: Context<AppEnv>) => sse((stream) => stream.patchElements(todoList(state(c))));

routes.post('/', async (c) => {
  const list = state(c);
  const { draft } = await readSignals<{ draft: string }>(c);
  const text = String(draft ?? '').trim().slice(0, 80);
  if (text && list.todos.length < MAX_TODOS) list.todos.push({ id: list.nextId++, text, done: false });

  return sse((stream) => {
    stream.patchElements(todoList(list));
    stream.patchSignals({ draft: '' }); // empty the input by resetting its signal
  });
});

routes.post('/toggle-all', (c) => {
  const { todos } = state(c);
  const allDone = todos.every((todo) => todo.done);
  for (const todo of todos) todo.done = !allDone;
  return render(c);
});

routes.post('/:id/toggle', (c) => {
  const todo = state(c).todos.find((todo) => todo.id === Number(c.req.param('id')));
  if (todo) todo.done = !todo.done;
  return render(c);
});

routes.put('/filter/:filter', (c) => {
  const filter = c.req.param('filter') as Filter;
  if (FILTERS.includes(filter)) state(c).filter = filter;
  return render(c);
});

// Edits arrive as ordinary form data, because the action used contentType: 'form'.
routes.put('/:id', async (c) => {
  const list = state(c);
  const id = Number(c.req.param('id'));
  const text = String((await c.req.parseBody()).text ?? '').trim().slice(0, 80);
  const todo = list.todos.find((todo) => todo.id === id);
  if (todo && text) todo.text = text;
  if (todo && !text) list.todos = list.todos.filter((todo) => todo.id !== id);
  return render(c);
});

routes.delete('/done', (c) => {
  const list = state(c);
  list.todos = list.todos.filter((todo) => !todo.done);
  return render(c);
});

routes.delete('/:id', (c) => {
  const list = state(c);
  list.todos = list.todos.filter((todo) => todo.id !== Number(c.req.param('id')));
  return render(c);
});
