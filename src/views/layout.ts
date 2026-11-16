import { demos } from '../demos/index.ts';
import { type Html, html } from '../lib/html.ts';

export const DATASTAR_VERSION = '1.0.5';

export type Page = {
  title: string;
  description: string;
  /** The current URL path, used to highlight the active link. */
  path: string;
  body: Html;
};

const groups = [...new Set(demos.map((demo) => demo.group))];

const sidebar = (path: string) => html`
  <nav class="sidebar" aria-label="Demos" data-class:open="$_menu">
    <a class="nav-link nav-home" href="/" ${path === '/' ? html`aria-current="page"` : ''}>Overview</a>
    ${groups.map(
      (group) => html`
        <h2 class="nav-group">${group}</h2>
        <ul class="nav-list">
          ${demos
            .filter((demo) => demo.group === group)
            .map((demo) => {
              const href = `/demos/${demo.slug}`;
              const number = String(demos.indexOf(demo) + 1).padStart(2, '0');
              return html`
                <li>
                  <a class="nav-link" href="${href}" ${path === href ? html`aria-current="page"` : ''}>
                    <span class="nav-number">${number}</span>${demo.title}
                  </a>
                </li>
              `;
            })}
        </ul>
      `,
    )}
    <p class="nav-foot">
      Built on Datastar v${DATASTAR_VERSION}.<br />
      An unofficial showcase.
    </p>
  </nav>
`;

/**
 * The page shell. Even the chrome is Datastar: the theme switch and the mobile
 * menu are two signals. Both start with an underscore, which keeps them local
 * to the browser, so they are never sent along with a demo's requests.
 */
export const layout = ({ title, description, path, body }: Page): Html => html`<!doctype html>
<html
  lang="en"
  data-signals:_dark="document.documentElement.classList.contains('dark')"
  data-class:dark="$_dark"
  data-class:light="!$_dark"
>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="/styles.css" />
    <script>
      // Apply the saved (or system) theme before first paint, so there is no
      // flash. Once Datastar loads, the data-class attributes above take over.
      (() => {
        let theme = null;
        try {
          theme = localStorage.getItem('theme');
        } catch {}
        theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.classList.add(theme);
      })();

      // The browser skips a view transition that is interrupted by a newer one,
      // or that starts while the window is being resized. The page still ends
      // up in the right state, so the rejected promise is not worth an error.
      addEventListener('unhandledrejection', (event) => {
        const { name, message = '' } = event.reason ?? {};
        if ((name === 'AbortError' || name === 'InvalidStateError') && /transition/i.test(message)) event.preventDefault();
      });
    </script>
    <script type="module" src="/vendor/datastar.js"></script>
  </head>
  <body data-signals:_menu="false" data-on:keydown="evt.key === 'Escape' && ($_menu = false)">
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="topbar">
      <button
        class="icon-button menu-button"
        type="button"
        aria-label="Toggle navigation"
        data-on:click="$_menu = !$_menu"
        data-attr:aria-expanded="$_menu ? 'true' : 'false'"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <a class="brand" href="/">
        <svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1.5c.9 5.6 4.9 9.6 10.5 10.5C16.9 12.9 12.9 16.9 12 22.5 11.1 16.9 7.1 12.9 1.5 12 7.1 11.1 11.1 7.1 12 1.5Z" />
        </svg>
        <span>Datastar <em>Showcase</em></span>
      </a>
      <span class="topbar-space"></span>
      <a class="topbar-link" href="https://data-star.dev/guide/getting_started" target="_blank" rel="noreferrer">Docs</a>
      <a class="topbar-link" href="https://data-star.dev/reference/attributes" target="_blank" rel="noreferrer">Reference</a>
      <a class="topbar-link" href="https://github.com/starfederation/datastar" target="_blank" rel="noreferrer">GitHub</a>
      <button
        class="icon-button"
        type="button"
        aria-label="Switch between light and dark theme"
        data-on:click="$_dark = !$_dark; localStorage.setItem('theme', $_dark ? 'dark' : 'light')"
      >
        <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
        </svg>
      </button>
    </header>

    <div class="shell">
      <div class="scrim" data-class:open="$_menu" data-on:click="$_menu = false"></div>
      ${sidebar(path)}
      <main id="main">${body}</main>
    </div>

    <script src="/wire-log.js"></script>
  </body>
</html>`;
