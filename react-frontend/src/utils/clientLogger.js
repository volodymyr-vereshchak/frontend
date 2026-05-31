// Browser-side error capture. Global error / unhandledrejection handlers and the
// React ErrorBoundary funnel errors here; we POST them to the backend so they end
// up in logs/frontend.log. Best-effort and self-limiting: deduplicated and capped
// per session so a render loop can't spam the server.

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.APP_CONFIG && window.APP_CONFIG.API_URL) ||
  '/api';
const ENDPOINT = `${API_BASE}/client-log`;

const MAX_PER_SESSION = 50;
const seen = new Set();
let sentCount = 0;

function send(entry) {
  if (sentCount >= MAX_PER_SESSION) return;

  const dedupKey =
    (entry.level || '') + '|' + (entry.message || '') + '|' + (entry.stack || '').slice(0, 200);
  if (seen.has(dedupKey)) return;
  seen.add(dedupKey);
  sentCount += 1;

  const payload = JSON.stringify({
    level: entry.level || 'error',
    message: String(entry.message || '').slice(0, 2000),
    stack: entry.stack ? String(entry.stack).slice(0, 8000) : undefined,
    url: entry.url || window.location.href,
    userAgent: navigator.userAgent,
  });

  try {
    // sendBeacon survives page unload and includes same-origin cookies.
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        credentials: 'include',
        keepalive: true,
      }).catch(() => {});
    }
  } catch (_) {
    // Never let logging throw.
  }
}

// Public helper for explicit reporting (used by ErrorBoundary and callers).
export function reportError(message, opts = {}) {
  send({ level: opts.level || 'error', message, stack: opts.stack, url: opts.url });
}

export function initClientLogging() {
  if (window.__clientLoggingInit) return;
  window.__clientLoggingInit = true;

  window.addEventListener('error', (event) => {
    // Resource-load errors (img/script 404) have no event.error.
    const message =
      event.message || (event.error && event.error.message) || 'Script error';
    const stack = event.error && event.error.stack;
    send({ level: 'error', message, stack, url: event.filename });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message =
      (reason && (reason.message || String(reason))) || 'Unhandled promise rejection';
    const stack = reason && reason.stack;
    send({ level: 'error', message: `unhandledrejection: ${message}`, stack });
  });
}
