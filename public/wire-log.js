/**
 * Wire log
 *
 * Lists the raw Datastar traffic of the current page: every request with the
 * signals it carried, and every server-sent event (or plain response body)
 * that came back, as it arrives.
 *
 * Datastar makes all of its backend calls through window.fetch, so wrapping
 * fetch is enough to see them. Requests go out untouched, and each response
 * body is passed through a tap that copies what flows past into the log; the
 * bytes Datastar receives are exactly the bytes the server sent. This script
 * is a teaching aid for the showcase. Datastar itself does not need it, and
 * nothing in the demos depends on it.
 */
(() => {
  const panel = document.getElementById('wire-log');
  if (!panel) return;

  const list = panel.querySelector('.wire-list');
  const MAX_REQUESTS = 40; // older requests are dropped
  const MAX_EVENTS = 10; // per request; long streams keep only their latest events

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // Keep the newest entry in view, unless the reader has scrolled up to look at something.
  const append = (parent, node) => {
    const pinned = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    parent.append(node);
    if (pinned) list.scrollTop = list.scrollHeight;
  };

  const duration = (since) => {
    const ms = performance.now() - since;
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
  };

  /** Pulls the interesting parts out of a fetch call: method, path and payload. */
  function describe(input, init) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const method = (init.method ?? 'GET').toUpperCase();
    let payload = null;
    let kind = 'signals';

    if (url.searchParams.has('datastar')) {
      // GET and DELETE carry the signals in a `datastar` query parameter.
      payload = url.searchParams.get('datastar');
      url.searchParams.delete('datastar');
    } else if (typeof init.body === 'string') {
      // Other methods send them as a JSON body.
      payload = init.body;
    } else if (init.body instanceof URLSearchParams) {
      // contentType: 'form' sends a regular form body instead of signals.
      payload = init.body.toString();
      kind = 'form';
    } else if (init.body instanceof FormData) {
      payload = [...init.body].map(([key, value]) => `${key}=${typeof value === 'string' ? value : value.name}`).join('&');
      kind = 'form';
    }

    return { method, path: url.pathname + url.search, payload, kind };
  }

  /** Renders one block of the response with the SSE field names picked out. */
  function block(text) {
    const pre = el('pre', 'wire-down');
    text.split('\n').forEach((line, i) => {
      if (i) pre.append('\n');
      const field = /^(event|data|id|retry): ?(.*)$/.exec(line);
      if (!field) return pre.append(line);

      const [, name, value] = field;
      pre.append(el('span', 'wire-field', `${name}: `));
      if (name === 'event') {
        pre.append(el('span', 'wire-event', value));
      } else if (name === 'data') {
        // Datastar data lines start with a keyword: elements, signals, selector, mode…
        const space = value.indexOf(' ');
        pre.append(el('span', 'wire-arg', space < 0 ? value : value.slice(0, space)), space < 0 ? '' : value.slice(space));
      } else {
        pre.append(value);
      }
    });
    return pre;
  }

  /** Long payloads are clipped; a button reveals the rest. */
  function clip(pre) {
    if (pre.scrollHeight <= pre.clientHeight + 4) return;
    const more = el('button', 'wire-more', 'Show all');
    more.type = 'button';
    more.addEventListener('click', () => {
      const open = pre.classList.toggle('is-expanded');
      more.textContent = open ? 'Show less' : 'Show all';
    });
    pre.after(more);
  }

  /** Adds a request to the log and returns the handles used to update it. */
  function track(input, init) {
    const { method, path, payload, kind } = describe(input, init);
    const started = performance.now();

    const item = el('li', 'wire-request is-open');
    const head = el('div', 'wire-line');
    const status = el('span', 'wire-status', 'sending');
    head.append(el('span', 'wire-method', method), el('span', 'wire-path', path), status);
    item.append(head);

    if (payload && payload !== '{}') {
      const up = el('pre', 'wire-up');
      up.append(el('span', 'wire-field', `${kind} `), payload);
      item.append(up);
    }

    const events = el('div', 'wire-events');
    const earlier = el('p', 'wire-earlier');
    earlier.hidden = true;
    events.append(earlier);
    item.append(events);

    append(list, item);
    while (list.children.length > MAX_REQUESTS) list.firstElementChild.remove();

    let dropped = 0;
    let code = '';

    const add = (pre) => {
      append(events, pre);
      clip(pre);
      // A long-lived stream would grow without bound, so only its tail is kept.
      while (events.querySelectorAll('.wire-down').length > MAX_EVENTS) {
        const oldest = events.querySelector('.wire-down');
        if (oldest.nextElementSibling?.classList.contains('wire-more')) oldest.nextElementSibling.remove();
        oldest.remove();
        dropped++;
      }
      if (dropped) {
        earlier.hidden = false;
        earlier.textContent = `${dropped} earlier ${dropped === 1 ? 'event' : 'events'} not shown`;
      }
    };

    return {
      opened(response) {
        code = String(response.status);
        status.textContent = `${code} · open`;
      },
      event: (text) => add(block(text)),
      body(type, text) {
        const pre = block(text);
        pre.prepend(el('span', 'wire-field', `${type}\n`));
        add(pre);
      },
      close(note) {
        item.classList.remove('is-open');
        if (note) item.classList.add('is-cut');
        status.textContent = [code, note, duration(started)].filter(Boolean).join(' · ');
      },
    };
  }

  /**
   * Returns a response whose body is the original body passed through a tap.
   * Every chunk is handed on unchanged, and logged on the way past. Tapping the
   * stream (rather than reading a clone of it) means the log knows for certain
   * whether a response ran to its end or was cut short.
   */
  function tap(response, entry) {
    // Statuses such as 204 No Content have no body to read.
    if (!response.body || [101, 204, 205, 304].includes(response.status)) {
      entry.close();
      return response;
    }

    const type = (response.headers.get('content-type') ?? '').split(';')[0];
    const isEventStream = type === 'text/event-stream';
    const decoder = new TextDecoder();
    let buffer = '';

    const { readable, writable } = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        try {
          buffer += decoder.decode(chunk, { stream: true });
          if (!isEventStream) return;
          // Server-sent events are separated by a blank line.
          for (let end; (end = buffer.indexOf('\n\n')) >= 0; buffer = buffer.slice(end + 2)) {
            entry.event(buffer.slice(0, end));
          }
        } catch (error) {
          console.warn('[wire log]', error); // logging must never break the stream
        }
      },
    });

    // Built before the body is touched: if this throws, the original response
    // is still unread and can be handed to Datastar as it is.
    const tapped = new Response(readable, { status: response.status, statusText: response.statusText, headers: response.headers });

    response.body.pipeTo(writable).then(
      () => {
        if (!isEventStream && buffer.trim()) entry.body(type, buffer.trim());
        entry.close();
      },
      // Datastar aborts a request when a newer one replaces it or the tab is
      // hidden; anything else means the connection dropped.
      (error) => entry.close(error?.name === 'AbortError' ? 'cancelled' : 'connection lost'),
    );

    return tapped;
  }

  const nativeFetch = window.fetch;

  window.fetch = function (input, init = {}) {
    // Only Datastar's own requests are logged; they all carry this header.
    if (!new Headers(init.headers).has('datastar-request')) return nativeFetch.call(this, input, init);

    // Whatever goes wrong in the logging, the request itself must carry on.
    let entry;
    try {
      entry = track(input, init);
    } catch (error) {
      console.warn('[wire log]', error);
      return nativeFetch.call(this, input, init);
    }

    return nativeFetch.call(this, input, init).then(
      (response) => {
        try {
          entry.opened(response);
          return tap(response, entry);
        } catch (error) {
          console.warn('[wire log]', error);
          return response;
        }
      },
      (error) => {
        entry.close(error?.name === 'AbortError' ? 'cancelled' : 'failed');
        throw error;
      },
    );
  };

  // "Clear" removes finished requests and empties the ones that are still streaming.
  panel.querySelector('.wire-clear')?.addEventListener('click', () => {
    for (const item of [...list.children]) {
      if (!item.classList.contains('is-open')) item.remove();
      else item.querySelectorAll('.wire-down, .wire-more').forEach((node) => node.remove());
    }
  });
})();
