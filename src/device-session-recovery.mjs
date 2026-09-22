import { readAuthorizedIdentity } from "./auth-session-diagnostic.mjs";

const DATABASE = "cma-device-session-recovery-v1";
const STORE = "sessions";
const KEY = "authorized-device";

function database() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function access(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function recoveryMatches(record, identity, unit, lot) {
  return Boolean(record && identity && unit && lot &&
    record.userId === identity.userId && identity.unit === unit &&
    record.unit === unit && record.lot === lot &&
    record.accessToken && record.refreshToken);
}

export async function rememberRecoverySession(session, storage = localStorage) {
  const identity = readAuthorizedIdentity(storage);
  const unit = storage.getItem("cma_unit");
  const lot = storage.getItem("cma_lot");
  if (!session?.user?.id || session.user.id !== identity?.userId ||
      identity.unit !== unit || !lot || !session.access_token || !session.refresh_token) return false;
  await access("readwrite", store => store.put({
    userId: session.user.id,
    unit,
    lot,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  }, KEY));
  return true;
}

export async function recoverAuthorizedSession(auth, storage = localStorage) {
  const identity = readAuthorizedIdentity(storage);
  const unit = storage.getItem("cma_unit");
  const lot = storage.getItem("cma_lot");
  const record = await access("readonly", store => store.get(KEY));
  if (!recoveryMatches(record, identity, unit, lot)) return null;
  const { data, error } = await auth.setSession({
    access_token: record.accessToken,
    refresh_token: record.refreshToken,
  });
  if (error || data?.session?.user?.id !== identity.userId) return null;
  return data.session;
}

export async function forgetRecoverySession() {
  await access("readwrite", store => store.delete(KEY));
}
