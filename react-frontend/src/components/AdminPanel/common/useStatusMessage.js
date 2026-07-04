import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Статус-повідомлення адмін-вкладок ({ ok, msg }) з автоприховуванням.
 * Повертає [status, showStatus]; рендериться як
 *   {status && <div className={`admin-status ${status.ok ? 'ok' : 'error'}`}>{status.msg}</div>}
 */
export function useStatusMessage(timeout = 3000) {
  const [status, setStatus] = useState(null);
  const timer = useRef(null);

  const showStatus = useCallback((ok, msg) => {
    setStatus({ ok, msg });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), timeout);
  }, [timeout]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return [status, showStatus];
}
