/**
 * A thin layer over the official Datastar SDK (@starfederation/datastar-sdk).
 *
 * The SDK does the real work: it formats `datastar-patch-elements` and
 * `datastar-patch-signals` server-sent events and parses the signals a request
 * carries. This file only adds a few conveniences for this app: html`…` values
 * can be patched directly, signals are passed as plain objects, and a stream
 * knows when its browser has gone away.
 */
import { ServerSentEventGenerator } from '@starfederation/datastar-sdk/web';
import type { PatchElementsOptions, PatchSignalsOptions } from '@starfederation/datastar-sdk/types';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Html } from './html.ts';
import { stats } from './stats.ts';

// Indentation is for people. Dropping it (and blank lines) before markup goes on
// the wire makes events smaller and much easier to read in the wire log.
const compact = (markup: string): string =>
  markup
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

export type Stream = {
  /** Morph elements into the page. They are matched by `id` unless a `selector` is given. */
  patchElements(elements: Html | string, options?: PatchElementsOptions): void;
  /** Merge values into the page's signals. */
  patchSignals(signals: Record<string, unknown>, options?: PatchSignalsOptions): void;
  /** Run JavaScript in the browser. */
  executeScript(script: string): void;
  /** End the response. Only needed for `keepalive` streams. */
  close(): void;
  /** Run a callback once the stream has ended, whichever side ended it. */
  onClose(callback: () => void): void;
  /** Aborts when the stream ends. Hand it to timers so work stops with the stream. */
  readonly signal: AbortSignal;
};

type StreamOptions = {
  /** Keep the response open after the callback returns, until the browser disconnects. */
  keepalive?: boolean;
};

/**
 * Answer a request with a stream of Datastar events.
 *
 * By default the response ends when `run` returns (or its promise settles), so
 * `run` can send one event or drip-feed many. With `keepalive` it stays open
 * for server push until the browser leaves.
 */
export function sse(run: (stream: Stream) => void | Promise<void>, { keepalive = false }: StreamOptions = {}): Response {
  const ended = new AbortController();
  stats.streams++;
  ended.signal.addEventListener('abort', () => stats.streams--, { once: true });

  return ServerSentEventGenerator.stream(
    async (generator) => {
      // Writing to a response the browser has already dropped throws, so writes
      // become no-ops once the stream has ended.
      const write = (send: () => unknown) => {
        if (ended.signal.aborted) return;
        try {
          send();
        } catch {
          ended.abort();
        }
      };

      const stream: Stream = {
        patchElements: (elements, options) => write(() => generator.patchElements(compact(String(elements)), options)),
        patchSignals: (signals, options) => write(() => generator.patchSignals(JSON.stringify(signals), options)),
        executeScript: (script) => write(() => generator.executeScript(script)),
        close: () => {
          generator.close();
          ended.abort();
        },
        onClose: (callback) => ended.signal.addEventListener('abort', callback, { once: true }),
        signal: ended.signal,
      };

      try {
        await run(stream);
      } catch (error) {
        // A timer cancelled by `stream.signal` rejects; that is the expected way out.
        if (!ended.signal.aborted) console.error('[sse] handler failed:', error);
      } finally {
        if (!keepalive) stream.close();
      }
    },
    // The SDK is told to keep every stream open so that closing is done in one
    // place, above. `onAbort` fires when the browser disconnects.
    { keepalive: true, onAbort: () => ended.abort() },
  );
}

/**
 * The signals sent with a Datastar request: the `datastar` query parameter for
 * GET and DELETE, the JSON body otherwise. They come from the browser, so treat
 * every value as untrusted input.
 */
export async function readSignals<T extends Record<string, unknown>>(c: Context): Promise<Partial<T>> {
  const result = await ServerSentEventGenerator.readSignals(c.req.raw);
  if (!result.success) throw new HTTPException(400, { message: `Could not read signals: ${result.error}` });
  return result.signals as Partial<T>;
}
