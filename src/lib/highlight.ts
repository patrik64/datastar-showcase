/**
 * Server-side syntax highlighting for the source panels, using Shiki.
 *
 * The `ts-tags` grammar is TypeScript that also understands html`…` tagged
 * templates, so the Datastar attributes inside a demo's markup are highlighted
 * as HTML. Each token carries a light and a dark colour as CSS variables and
 * the stylesheet picks one, so the output works in both themes.
 */
import { readFile } from 'node:fs/promises';
import { createHighlighter } from 'shiki';
import { type Html, raw } from './html.ts';

type Language = 'ts-tags' | 'html';

const highlighter = await createHighlighter({
  themes: ['github-light', 'github-dark'],
  langs: ['ts-tags', 'html'],
});

export function highlight(code: string, lang: Language = 'ts-tags'): Html {
  return raw(
    highlighter.codeToHtml(code.trim(), {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    }),
  );
}

const files = new Map<string, Html>();

/** Reads a source file (relative to the project root) and highlights it, once. */
export async function highlightFile(path: string): Promise<Html> {
  let cached = files.get(path);
  if (!cached) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    files.set(path, (cached = highlight(source)));
  }
  return cached;
}
