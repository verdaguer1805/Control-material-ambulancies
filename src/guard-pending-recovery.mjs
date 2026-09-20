const normalized = (value) => String(value || "").trim().toUpperCase();

export function belongsToGuard(record, scope) {
  if (!record || record.synced) return false;
  const recordLot = String(record.lot || scope.lot || "").trim();
  return normalized(record.unit) === normalized(scope.unit) &&
    recordLot === String(scope.lot || "").trim() &&
    String(record.id || "") === String(scope.guardCode || "");
}

export function isolateGuardPending(records, scope) {
  const affected = [];
  const kept = [];
  for (const record of records || []) {
    (belongsToGuard(record, scope) ? affected : kept).push(record);
  }
  return { affected, kept };
}
