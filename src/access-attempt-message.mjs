export function accessAttemptMessage(data, fallback = 'Código incorrecto') {
  const seconds = Math.max(0, Math.ceil(Number(data?.retry_after_seconds) || 0));
  if (seconds > 0) {
    const minutes = Math.floor(seconds / 60), rest = seconds % 60;
    const wait = minutes ? `${minutes} min${rest ? ` ${rest} s` : ''}` : `${rest} s`;
    return `Demasiados intentos incorrectos. Vuelve a intentarlo en ${wait}.`;
  }
  const remaining = data?.attempts_remaining;
  return Number.isInteger(remaining) && remaining >= 1 && remaining <= 3
    ? `${fallback}. Quedan ${remaining} intentos antes del bloqueo temporal.` : fallback;
}
