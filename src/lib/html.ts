/**
 * A tiny HTML templating helper.
 *
 *   html`<p>${userInput}</p>`
 *
 * Every interpolated value is escaped, so templates are safe by default.
 * Values that are already markup (another html`…` result, or raw(…)) pass
 * through untouched, arrays are joined, and null / undefined / booleans render
 * as nothing, which makes `${condition && html`…`}` work as expected.
 */
export class Html {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return this.value;
  }
}

export type Renderable = Html | string | number | boolean | null | undefined | Renderable[];

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => ENTITIES[char]!);

const render = (value: Renderable): string => {
  if (value == null || typeof value === 'boolean') return '';
  if (value instanceof Html) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(String(value));
};

/**
 * Tagged template for HTML. The raw template text is used, so a backslash in a
 * Datastar expression (a regex such as /^addons\./, say) reaches the browser
 * exactly as it is written in the source.
 */
export function html(strings: TemplateStringsArray, ...values: Renderable[]): Html {
  let out = strings.raw[0]!;
  values.forEach((value, i) => {
    out += render(value) + strings.raw[i + 1]!;
  });
  return new Html(out);
}

/** Marks a string as trusted markup. Never pass user input to this. */
export const raw = (markup: string): Html => new Html(markup);
