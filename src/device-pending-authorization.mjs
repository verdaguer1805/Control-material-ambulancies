const normalized = (value) => String(value || "").trim().toUpperCase();

export function classifyPendingRecords(records, targetUnit, targetLot) {
  const unit = normalized(targetUnit);
  const lot = String(targetLot || "").trim();
  const pending = (records || []).filter((record) => !record.synced);
  const belongsToTarget = (record) =>
    normalized(record.unit) === unit &&
    (!record.lot || String(record.lot).trim() === lot);
  return {
    pending,
    matching: pending.filter(belongsToTarget),
    foreign: pending.filter((record) => !belongsToTarget(record)),
  };
}

export function pendingUnitsLabel(records) {
  return [...new Set((records || []).map((record) => normalized(record.unit)).filter(Boolean))].join(", ");
}
