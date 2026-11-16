import { setTimeout as sleep } from 'node:timers/promises';
import { Hono } from 'hono';
import { readSignals, sse } from '../lib/datastar.ts';
import { type Html, html } from '../lib/html.ts';

export const routes = new Hono();

type Signals = { username: string; email: string; _password: string };
type Verdict = { ok: boolean; message: string };

const TAKEN = new Set(['admin', 'root', 'datastar', 'apollo', 'houston']);

function checkUsername(name: string): Verdict {
  if (name.length < 3) return { ok: false, message: 'Use at least 3 characters.' };
  if (!/^[a-z0-9_]+$/i.test(name)) return { ok: false, message: 'Letters, numbers and underscores only.' };
  if (TAKEN.has(name.toLowerCase())) return { ok: false, message: `“${name}” is already taken.` };
  return { ok: true, message: `“${name}” is available.` };
}

function checkEmail(email: string): Verdict {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? { ok: true, message: 'Looks good.' }
    : { ok: false, message: 'That does not look like an email address.' };
}

function checkPassword(password: string): Verdict {
  return password.length >= 8
    ? { ok: true, message: 'Long enough.' }
    : { ok: false, message: 'Use at least 8 characters.' };
}

// A message under a field. The server sends these; the page finds them by id.
const hint = (field: string, verdict?: Verdict) => html`
  <p id="${field}-hint" class="hint${verdict ? (verdict.ok ? ' good' : ' bad') : ''}">${verdict?.message}</p>
`;

// Datastar leaves signals that start with an underscore out of every request.
// The submit action overrides that with filterSignals: `include` names the three
// fields to send, and `exclude` is replaced by a pattern that matches nothing.
const form = () => html`
  <form
    class="signup"
    novalidate
    data-signals="{username: '', email: '', _password: '', _reveal: false}"
    data-computed:_strength="[/.{8,}/, /[a-z]/, /[A-Z]/, /[0-9]/].filter((rule) => rule.test($_password)).length"
    data-indicator:_sending
    data-on:submit="@post('/demos/validation/signup', {filterSignals: {include: /^(username|email|_password)$/, exclude: /^$/}})"
  >
    <div class="signup-live" data-on:input__debounce.300ms="@post('/demos/validation/check')">
      <div class="field">
        <label for="username">Username</label>
        <input id="username" type="text" autocomplete="off" spellcheck="false" maxlength="24" aria-describedby="username-hint" data-bind:username />
        ${hint('username')}
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="off" aria-describedby="email-hint" data-bind:email />
        ${hint('email')}
      </div>
    </div>

    <div class="field">
      <label for="password">Password</label>
      <div class="reveal">
        <input id="password" type="password" autocomplete="new-password" aria-describedby="password-hint" data-bind:_password data-attr:type="$_reveal ? 'text' : 'password'" />
        <button type="button" class="button small quiet" data-on:click="$_reveal = !$_reveal" data-text="$_reveal ? 'Hide' : 'Show'">Show</button>
      </div>
      <div class="strength" aria-hidden="true">
        <i data-class:on="$_strength >= 1"></i>
        <i data-class:on="$_strength >= 2"></i>
        <i data-class:on="$_strength >= 3"></i>
        <i data-class:on="$_strength >= 4"></i>
        <span data-text="['', 'Weak', 'Fair', 'Good', 'Strong'][$_strength]"></span>
      </div>
      <p id="password-hint" class="hint">Use at least 8 characters.</p>
    </div>

    <button class="button primary" data-attr:disabled="$_sending || $_password.length < 8">Create account</button>
  </form>
`;

export const view = () => html`<div id="signup">${form()}</div>`;

// While typing: only the username and email are sent, because signals that
// start with an underscore stay in the browser. Both hints come back in one
// event, and each is morphed into the element with the matching id.
routes.post('/check', async (c) => {
  const { username, email } = await readSignals<Signals>(c);
  await sleep(150); // a pretend database lookup
  return sse((stream) =>
    stream.patchElements(html`
      ${hint('username', username ? checkUsername(String(username)) : undefined)}
      ${hint('email', email ? checkEmail(String(email)) : undefined)}
    `),
  );
});

// On submit the password arrives too, and everything is checked once more.
routes.post('/signup', async (c) => {
  const signals = await readSignals<Signals>(c);
  const username = String(signals.username ?? '');
  const verdicts = {
    username: checkUsername(username),
    email: checkEmail(String(signals.email ?? '')),
    password: checkPassword(String(signals._password ?? '')),
  };
  await sleep(400);

  return sse((stream) => {
    if (Object.values(verdicts).every((verdict) => verdict.ok)) {
      stream.patchElements(welcome(username));
      stream.patchSignals({ _password: '' });
    } else {
      stream.patchElements(
        html`${hint('username', verdicts.username)}${hint('email', verdicts.email)}${hint('password', verdicts.password)}`,
      );
    }
  });
});

const welcome = (username: string): Html => html`
  <div id="signup">
    <div class="signup-done">
      <p class="signup-check" aria-hidden="true">✓</p>
      <h3>Welcome aboard, ${username}.</h3>
      <p>The server validated everything once more and swapped the form for this message.</p>
      <button class="button" data-on:click="@get('/demos/validation/reset')">Start over</button>
    </div>
  </div>
`;

// A fresh form: its data-signals attribute runs again and resets the signals.
routes.get('/reset', () => sse((stream) => stream.patchElements(view())));
