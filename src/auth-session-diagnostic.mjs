export const AUTH_IDENTITY_KEY = "cma_authorized_auth_identity_v1";
export const AUTH_DIAGNOSTIC_KEY = "cma_auth_session_diagnostic_v1";
const DEVICE_AUTH_CACHE = "cma_device_authorization_v1";

export function priorAuthorizedDevice(storage) {
  try {
    const assignment = storage.getItem("cma_unit");
    const cached = JSON.parse(storage.getItem(DEVICE_AUTH_CACHE) || "null");
    const identity = readAuthorizedIdentity(storage);
    return Boolean(assignment && (
      (cached?.authorized === true && cached?.unit === assignment) ||
      identity?.unit === assignment
    ));
  } catch {
    return false;
  }
}

export function rememberAuthorizedIdentity(storage, userId) {
  const unit = storage.getItem("cma_unit");
  if (userId && unit) storage.setItem(AUTH_IDENTITY_KEY, JSON.stringify({unit, userId}));
}

export function readAuthorizedIdentity(storage) {
  try {
    return JSON.parse(storage.getItem(AUTH_IDENTITY_KEY) || "null");
  } catch {
    return null;
  }
}

export function recordAuthDiagnostic(storage, reason, version = "v167") {
  try {
    const previous = JSON.parse(storage.getItem(AUTH_DIAGNOSTIC_KEY) || "null");
    const unit = storage.getItem("cma_unit") || "";
    if (previous?.reason === reason && previous?.unit === unit && !previous?.resolvedAt) return previous;
    const event = { reason, unit, detectedAt: new Date().toISOString(), version };
    storage.setItem(AUTH_DIAGNOSTIC_KEY, JSON.stringify(event));
    return event;
  } catch {
    return null;
  }
}

export function readAuthDiagnostic(storage) {
  try {
    return JSON.parse(storage.getItem(AUTH_DIAGNOSTIC_KEY) || "null");
  } catch {
    return null;
  }
}

export function resolveAuthDiagnostic(storage) {
  const event = readAuthDiagnostic(storage);
  if (event && !event.resolvedAt)
    storage.setItem(AUTH_DIAGNOSTIC_KEY, JSON.stringify({ ...event, resolvedAt: new Date().toISOString() }));
}

export function authDiagnosticLabel(reason) {
  if (reason === "session_missing") return "La sesión local de este móvil ha desaparecido.";
  if (reason === "session_error") return "No se ha podido verificar la sesión local de este móvil.";
  if (reason === "identity_changed") return "El móvil presenta una identidad distinta de la autorizada.";
  if (reason === "server_denied") return "Supabase no reconoce esta identidad como autorizada.";
  return "No se ha podido determinar el motivo de la desautorización.";
}
