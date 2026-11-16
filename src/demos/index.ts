/**
 * The demo registry: what each demo is called, what it teaches, and where its
 * code lives. Every demo is a single file exporting a `view` (the markup for
 * the stage) and `routes` (the endpoints that markup talks to). The words
 * around a demo live here, so that the demo files stay nothing but the demo.
 */
import type { Context, Hono } from 'hono';
import { type Html, html } from '../lib/html.ts';
import type { AppEnv } from '../lib/session.ts';
import * as counter from './counter.ts';
import * as dashboard from './dashboard.ts';
import * as hello from './hello.ts';
import * as infiniteScroll from './infinite-scroll.ts';
import * as launch from './launch.ts';
import * as pixels from './pixels.ts';
import * as search from './search.ts';
import * as signals from './signals.ts';
import * as todos from './todos.ts';
import * as validation from './validation.ts';
import * as viewTransitions from './view-transitions.ts';

export type Demo = {
  /** URL segment and file name: /demos/<slug>, src/demos/<slug>.ts */
  slug: string;
  title: string;
  group: 'Signals' | 'Round trips' | 'Streams' | 'Real-time';
  /** One line, for cards and the page description. */
  summary: string;
  /** Lead paragraph on the demo page. */
  intro: Html;
  /** Datastar features on show. Each becomes a link to the reference docs. */
  uses: string[];
  /** "How it works", one point per entry. */
  notes: Html[];
  /** Set to false for a demo that never talks to the server. */
  wire?: boolean;
  view: (c: Context<AppEnv>) => Html;
  routes: Hono<any>;
};

// The greeting on the home page. It is a demo like the others, without a page of its own.
export { hello };

export const demos: Demo[] = [
  {
    slug: 'signals',
    title: 'Signals and bindings',
    group: 'Signals',
    summary: 'Reactive state in plain HTML: bindings, computed values and conditional UI, with no server involved.',
    intro: html`Signals are Datastar's reactive state. This price calculator is made of attributes alone: the page has no
      script of its own, and nothing here ever talks to the server. Change anything and watch the rest keep up.`,
    uses: [
      'data-signals',
      'data-bind',
      'data-computed',
      'data-text',
      'data-show',
      'data-class',
      'data-attr',
      'data-style',
      'data-json-signals',
      '@setAll',
      '@toggleAll',
    ],
    notes: [
      html`<code>data-signals</code> declares the state. Each key becomes a signal that any expression can read with a
        <code>$</code> prefix, and nested objects work too: <code>$extras.sso</code>.`,
      html`<code>data-bind</code> ties a signal to a form control in both directions. The signal keeps its type, so
        the slider gives a number and each checkbox a boolean.`,
      html`<code>data-computed</code> derives a read-only signal from others. <code>$total</code> is recalculated
        whenever the seats, the billing period or an extra changes.`,
      html`The rest only reads: <code>data-text</code> sets text, <code>data-show</code> hides and shows,
        <code>data-class</code> and <code>data-attr</code> switch a class or an attribute (the button is disabled until
        the team has a name), and <code>data-style</code> drives the width of the meter.`,
      html`<code>@setAll()</code> and <code>@toggleAll()</code> change every signal whose path matches a pattern. Each
        of the All, None and Invert buttons is a single expression.`,
      html`The panel on the right is <code>&lt;pre data-json-signals&gt;</code>, a live view of the signals. It is the
        quickest way to see what a page thinks its state is.`,
    ],
    wire: false,
    ...signals,
  },
  {
    slug: 'counter',
    title: 'Counter, three ways',
    group: 'Round trips',
    summary: 'One click, three kinds of answer: patch elements, patch signals, or plain HTML.',
    intro: html`The smallest possible round trip. A click calls the server with <code>@post()</code>, and the server
      decides what changes on the page. There are three ways it can answer, and each lane below uses a different one.`,
    uses: ['data-on', '@post', 'data-signals', 'data-text', 'datastar-patch-elements', 'datastar-patch-signals', 'text/html'],
    notes: [
      html`<code>data-on:click="@post('…')"</code> sends a request when the button is clicked. Every Datastar request
        carries the page's signals, which is how the middle lane tells the server its current <code>$count</code>.`,
      html`<strong>Patch elements.</strong> The server replies with a <code>datastar-patch-elements</code> event holding
        an <code>&lt;output&gt;</code>. Datastar finds the element with the same <code>id</code> and morphs it, leaving
        everything else on the page untouched.`,
      html`<strong>Patch signals.</strong> The reply is a <code>datastar-patch-signals</code> event with a new value for
        <code>$count</code>. No HTML is sent: <code>data-text="$count"</code> notices the signal changed and re-renders.`,
      html`<strong>Plain HTML.</strong> Server-sent events are optional. A normal <code>text/html</code> response is
        treated as elements to morph, so an existing endpoint that renders a partial already works.`,
    ],
    ...counter,
  },
  {
    slug: 'search',
    title: 'Active search',
    group: 'Round trips',
    summary: 'Search as you type, with debounced requests, a loading indicator and stale requests cancelled for you.',
    intro: html`A search box that asks the server as you type. The filtering happens on the server; the browser only
      holds two signals and a results list that the server keeps replacing.`,
    uses: ['data-bind', 'data-on', 'data-indicator', 'data-ref', '@get', 'requestCancellation', 'datastar-patch-elements'],
    notes: [
      html`<code>data-bind</code> keeps <code>$query</code> and <code>$agency</code> in step with the two controls.`,
      html`One listener on the wrapper, <code>data-on:input__debounce.200ms</code>, hears both of them. The
        <code>__debounce</code> modifier waits for a pause in typing before it calls <code>@get()</code>.`,
      html`A GET request carries the signals in a <code>datastar</code> query parameter, which the wire log decodes for
        you. The server filters the list and patches <code>#results</code>.`,
      html`<code>data-indicator:_searching</code> creates a signal that is true while the request is in flight, and the
        spinner is bound to it. The underscore makes it a local signal, so it is never sent to the server.`,
      html`The server here is deliberately slow. Type another letter while a search is still running and the wire log
        marks the first request <em>cancelled</em>: when a new request starts, Datastar aborts the one in flight to the
        same URL, so an old answer can never overwrite a newer one.`,
      html`<code>data-ref:_box</code> stores the input element in a signal. The <code>data-on:keydown__window</code>
        listener uses it to focus the box when you press <kbd>/</kbd>.`,
    ],
    ...search,
  },
  {
    slug: 'validation',
    title: 'Inline validation',
    group: 'Round trips',
    summary: 'A sign-up form checked by the server as you type, with a password that stays in the browser until you submit.',
    intro: html`The server owns the rules, such as whether a username is taken, and answers while you type. The browser
      handles what needs no data, such as the password strength meter. Try the username <code>apollo</code>.`,
    uses: ['data-bind', 'data-computed', 'data-on', 'data-indicator', 'data-attr', 'data-class', '@post', 'filterSignals', 'datastar-patch-elements'],
    notes: [
      html`Username and email are sent to the server 300 ms after you stop typing. The reply is one event holding two
        elements, and each is morphed into the element with the matching <code>id</code>.`,
      html`The password is bound to <code>$_password</code>. Signals whose names start with an underscore are local:
        Datastar leaves them out of requests. Check the wire log, where the live checks never include it.`,
      html`The strength meter is <code>data-computed</code>, worked out in the browser on every keystroke, and
        <code>data-attr</code> keeps the button disabled until the password is long enough. Signals do the interface;
        the server does the rules.`,
      html`On submit, the <code>filterSignals</code> option opts in to sending the password as well.
        <code>data-on:submit</code> also stops the browser's own form submission.`,
      html`The server validates everything again, then answers with either the error hints or a welcome panel that
        replaces the form. <code>data-indicator</code> disables the button while that request is in flight.`,
    ],
    ...validation,
  },
  {
    slug: 'todos',
    title: 'To-do list',
    group: 'Round trips',
    summary: 'The classic to-do app with all of its state on the server: add, edit, complete, filter and clear.',
    intro: html`Every framework has one. This version keeps the list on the server, one per visitor. Each action is a
      request, and each response is the entire widget, freshly rendered.`,
    uses: ['data-on', 'data-bind', 'data-signals', 'data-class', 'data-effect', '@post', '@put', '@delete', 'contentType', 'datastar-patch-elements', 'datastar-patch-signals'],
    notes: [
      html`The widget is one function of the server's state. Every endpoint changes the state and sends the whole thing
        back. Datastar morphs it in, touching only what differs, so focus and half-typed text survive.`,
      html`The actions map onto HTTP methods: <code>@post()</code> to add or toggle, <code>@put()</code> to edit or
        filter, <code>@delete()</code> to remove.`,
      html`Adding sends the <code>$draft</code> signal. The response holds two events: the new list, then a signals
        patch that sets <code>draft</code> back to an empty string, which clears the input bound to it.`,
      html`Double-click a to-do to edit it. That only sets <code>$_editing</code>, a local signal:
        <code>data-class</code> swaps the label for an input and <code>data-effect</code> focuses it. The server hears
        nothing until you press Enter.`,
      html`Saving an edit uses <code>contentType: 'form'</code>, which sends the fields of the enclosing form as ordinary
        form data instead of signals. Escape, or clicking away, cancels.`,
    ],
    ...todos,
  },
  {
    slug: 'infinite-scroll',
    title: 'Infinite scroll',
    group: 'Streams',
    summary: 'A long list that fetches its next page when you reach the end, using data-on-intersect and append mode.',
    intro: html`Scroll the star catalogue to the bottom and more arrives. The browser keeps no page number and no
      scroll handler. A single element at the end of the list knows what to ask for next.`,
    uses: ['data-on-intersect', '@get', 'datastar-patch-elements'],
    notes: [
      html`The last element in the scroller carries <code>data-on-intersect</code>, which runs its expression when the
        element scrolls into view. Here that is a <code>@get()</code> for the next page.`,
      html`The response holds two events. The first uses <code>mode append</code> with <code>selector #stars</code> to
        add rows to the end of the list, without touching the ones already there.`,
      html`The second morphs the sentinel itself, and its attribute now names the following page. Changing a
        <code>data-*</code> attribute re-arms it, so it fires again the next time it comes into view.`,
      html`When the pages run out, the server sends a sentinel with no attribute at all, and the loading stops. The
        server is in charge of paging from start to finish.`,
    ],
    ...infiniteScroll,
  },
  {
    slug: 'launch',
    title: 'Streaming progress',
    group: 'Streams',
    summary: 'One request, many events: a long-running job reports progress as it goes, and can be stopped halfway.',
    intro: html`A response does not have to arrive all at once. Press Launch and a single request stays open for the
      whole countdown, while the server sends around sixty events down it as the work proceeds.`,
    uses: ['data-on', 'data-indicator', 'data-attr', 'data-show', 'data-style', 'data-signals', '@post', 'datastar-patch-elements', 'datastar-patch-signals'],
    notes: [
      html`One <code>@post()</code> starts the launch. The server answers with a stream and keeps writing to it: each
        event is applied the moment it arrives.`,
      html`The events are a mix. Checklist items are morphed by <code>id</code>, log lines are added with
        <code>mode append</code>, and the progress bar is a signal: <code>$progress</code> is patched ten times per step
        and bound to the bar with <code>data-style:width</code>.`,
      html`<code>data-indicator:_running</code> is true for as long as the response is open, which is the whole launch.
        It disables Launch and reveals Abort.`,
      html`Abort is a second, separate request. It stops the job on the server and gets an empty
        <code>204</code> back; the news reaches the page through the first stream, which is still open.`,
      html`The last event runs a script in the page, for a little camera shake. And if you close the tab halfway, the
        server notices the dropped connection and stops working.`,
    ],
    ...launch,
  },
  {
    slug: 'view-transitions',
    title: 'View transitions',
    group: 'Streams',
    summary: 'Reorder a grid on the server and let the browser animate every card to its new place.',
    intro: html`The server sorts, the browser animates. Each button fetches the planets in a new order, and one option
      on the patch turns a plain swap into a smooth rearrangement.`,
    uses: ['data-on', '@get', 'datastar-patch-elements'],
    notes: [
      html`Each button calls <code>@get()</code>, and the server answers with the whole grid in its new order. Nothing
        about the order is computed in the browser.`,
      html`The patch carries <code>useViewTransition true</code>. Datastar then wraps the morph in
        <code>document.startViewTransition()</code>, the browser's own API for animating between two states of a page.`,
      html`Every card has a <code>view-transition-name</code> of its own. That lets the browser follow each one from
        its old position to its new one. The morph helps too: cards are matched by <code>id</code> and moved, not
        rebuilt.`,
      html`Only the cards are animated. A transition that includes the root element freezes the whole page until it
        ends, so the stylesheet keeps the root out of in-page transitions. That is why the buttons still respond
        while the cards are moving.`,
      html`In a browser without view transitions the change is simply instant, and the stylesheet switches the
        animation off for anyone who prefers reduced motion.`,
    ],
    ...viewTransitions,
  },
  {
    slug: 'dashboard',
    title: 'Live dashboard',
    group: 'Real-time',
    summary: 'The server pushes a fresh view every second over one long-lived connection, charts included.',
    intro: html`These are the real vital signs of the Node process serving this page. The browser asked once; since
      then the server has been sending a new view every second. Press the button to give it something to show.`,
    uses: ['data-init', 'data-on', 'data-signals', 'data-show', 'data-text', 'data-class', '@get', '@post', 'datastar-patch-elements'],
    notes: [
      html`<code>data-init</code> runs <code>@get()</code> as soon as the element is on the page. The server never
        finishes that response. It keeps the connection open and writes an event to it every second.`,
      html`The server measures itself, renders the tiles, the chart and the table once, and sends the same markup to
        every tab that is watching. One event patches all three, each matched by <code>id</code>.`,
      html`The chart is HTML and SVG built on the server. There is no charting library in the browser, and even the
        readout that follows your pointer is plain CSS.`,
      html`Local state survives the updates. Switch to the table view, which is a local signal and
        <code>data-show</code>, and it stays put while the numbers under it keep changing.`,
      html`The Live badge listens for <code>datastar-fetch</code>, the event Datastar fires for each step of a request,
        so it is on only while events are really arriving.`,
      html`Switch to another browser tab and Datastar closes the stream, then reopens it when you come back. That is
        the default for GET requests. If the server goes away, it retries with increasing delays.`,
    ],
    ...dashboard,
  },
  {
    slug: 'pixels',
    title: 'Multiplayer pixels',
    group: 'Real-time',
    summary: 'A shared canvas: every open tab sees every click, with one stream for reads and tiny requests for writes.',
    intro: html`Open this page in a second window, put the two side by side, and paint. Every click travels to the
      server and back out to everyone who is watching.`,
    uses: ['data-init', 'data-on', 'data-bind', 'data-signals', '@get', '@post', 'datastar-patch-elements'],
    notes: [
      html`Reading and writing are kept apart. Each tab holds one long-lived <code>@get()</code> stream open for
        updates, and a click sends a small, separate <code>@post()</code>.`,
      html`The POST is answered with an empty <code>204</code>. The server changes the board and broadcasts the result
        to every open stream, so the tab that clicked sees its paint arrive the same way as everyone else.`,
      html`A patch can be as large or as small as you like. A tab that connects is sent the whole board; a click is
        sent as one cell, found by its <code>id</code> among 384.`,
      html`The grid has a single <code>data-on:click</code> listener. Expressions can use <code>evt</code>, so the
        click target's <code>id</code> says which cell to paint.`,
      html`The palette is a group of radio buttons bound to <code>$color</code>, which goes up with every POST. The
        count of painters is simply the number of open streams.`,
    ],
    ...pixels,
  },
];

const REFERENCE = 'https://data-star.dev/reference';

/** Where a feature named in `uses` is documented. */
export function referenceUrl(feature: string): string {
  if (feature.startsWith('data-')) return `${REFERENCE}/attributes#${feature}`;
  if (feature.startsWith('datastar-')) return `${REFERENCE}/sse_events#${feature}`;
  if (feature.startsWith('@')) return `${REFERENCE}/actions#${feature.slice(1).toLowerCase()}`;
  return `${REFERENCE}/actions#${feature}`;
}
