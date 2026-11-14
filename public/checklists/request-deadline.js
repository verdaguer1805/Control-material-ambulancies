export const REQUEST_TIMEOUT_MS = 20000;
export const REQUEST_TIMEOUT_MESSAGE = 'No se ha recibido confirmación a tiempo. Los datos siguen guardados y pendientes de confirmar. Reintenta el envío; no inicies otro registro.';

// Aborting the browser request does not prove that the server rolled back.
// Callers must retain the same persistent operation ID/scope for every retry.
export async function withRequestDeadline(work, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('CHECKLIST_REQUEST_TIMEOUT'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => work(controller.signal)), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
