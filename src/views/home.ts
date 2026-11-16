import { demos, hello } from '../demos/index.ts';
import { highlight, highlightFile } from '../lib/highlight.ts';
import { type Html, html } from '../lib/html.ts';
import { wireLog } from './demo.ts';
import { DATASTAR_VERSION } from './layout.ts';

const steps: { title: string; text: Html; code: Html }[] = [
  {
    title: 'Declare',
    text: html`Add <code>data-*</code> attributes to ordinary HTML. They create <em>signals</em>, bind them to inputs
      and keep text, classes and attributes in sync, with no script to write.`,
    code: highlight(`<input data-bind:name />\n<h1 data-text="$name"></h1>\n<p data-show="$name == ''">\n  Who are you?\n</p>`, 'html'),
  },
  {
    title: 'Act',
    text: html`Call your backend with an action such as <code>@get()</code> or <code>@post()</code>. The page's
      signals travel with the request, so the server knows the state of the UI.`,
    code: highlight(`<button\n  data-on:click="@post('/hi')"\n>\n  Say hello\n</button>`, 'html'),
  },
  {
    title: 'Patch',
    text: html`The server answers with server-sent events. Each one morphs HTML into the page or updates signals,
      and a response can carry one event or a stream of them.`,
    code: html`<pre class="plain-code"><code><span class="tok-key">event:</span> datastar-patch-elements
<span class="tok-key">data:</span> elements &lt;h1 id="hi"&gt;Hello&lt;/h1&gt;

<span class="tok-key">event:</span> datastar-patch-signals
<span class="tok-key">data:</span> signals {"name": ""}</code></pre>`,
  },
];

export async function homePage(): Promise<Html> {
  return html`
    <div class="home">
      <header class="hero">
        <p class="eyebrow">Datastar v${DATASTAR_VERSION} / hypermedia + signals</p>
        <h1>Reactive pages,<br />driven by your backend.</h1>
        <p class="lead">
          <a href="https://data-star.dev" target="_blank" rel="noreferrer">Datastar</a> is a small hypermedia framework:
          one script, a handful of <code>data-*</code> attributes, and a server that streams HTML. This is a hands-on
          tour of it in ${demos.length} working demos. Each is a single file, and each shows its traffic as you use it.
        </p>
        <p class="hero-actions">
          <a class="button primary" href="/demos/${demos[0]!.slug}">Start the tour</a>
          <a class="button" href="#demos">Browse all ${demos.length} demos</a>
        </p>
      </header>

      <section class="home-section" aria-labelledby="try-it">
        <h2 id="try-it">Try it right here</h2>
        <p class="section-lead">
          The input is bound to a signal. The button sends that signal to the server, which streams a greeting back one
          character at a time. Watch the wire log: that is all Datastar ever puts on the network.
        </p>
        <div class="workbench">
          <section class="stage" aria-label="Live demo">${hello.view()}</section>
          ${wireLog('Press “Say hello” to see the request go up and the events come down.')}
        </div>
        <div class="source">
          <header class="source-head">
            <h3>All of the code for that</h3>
            <code>src/demos/hello.ts</code>
          </header>
          ${await highlightFile('src/demos/hello.ts')}
        </div>
      </section>

      <section class="home-section" aria-labelledby="how">
        <h2 id="how">The whole idea, in three steps</h2>
        <ol class="steps">
          ${steps.map(
            (step, i) => html`
              <li class="step">
                <span class="step-number">${i + 1}</span>
                <h3>${step.title}</h3>
                <p>${step.text}</p>
                ${step.code}
              </li>
            `,
          )}
        </ol>
      </section>

      <section class="home-section" aria-labelledby="demos">
        <h2 id="demos">The demos</h2>
        <ul class="cards">
          ${demos.map(
            (demo, i) => html`
              <li>
                <a class="card" href="/demos/${demo.slug}">
                  <span class="card-meta">${String(i + 1).padStart(2, '0')} / ${demo.group}</span>
                  <h3>${demo.title}</h3>
                  <p>${demo.summary}</p>
                </a>
              </li>
            `,
          )}
        </ul>
      </section>
    </div>
  `;
}
