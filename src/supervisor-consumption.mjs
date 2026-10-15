// Supervisors enter each withdrawal separately; the transport keeps a daily total
// so existing server retries remain idempotent and reports retain their history.
export function supervisorDraft(record) {
  return record && !record.synced ? {...record.supervisorPendingBatch} : {};
}

const draftKey=(lot,unit)=>`cma_supervisor_unsent_v1:${encodeURIComponent(lot)}:${encodeURIComponent(unit)}`;
export function readSupervisorUnsent(storage,lot,unit) {
  try {
    const value=JSON.parse(storage.getItem(draftKey(lot,unit)) || '{}');
    return Object.fromEntries(Object.entries(value).filter(([,quantity])=>Number.isInteger(quantity)&&quantity>0));
  } catch { return {}; }
}
export function saveSupervisorUnsent(storage,lot,unit,materials) {
  storage.setItem(draftKey(lot,unit),JSON.stringify(materials));
}
export function clearSupervisorUnsent(storage,lot,unit) {
  storage.removeItem(draftKey(lot,unit));
}

export function appendSupervisorConsumption(record, materials, createdAt) {
  if (record && !record.synced) throw new Error('SUPERVISOR_PENDING_CONSUMPTION');
  if (!Object.values(materials).some(value=>value>0)) throw new Error('EMPTY_SUPERVISOR_CONSUMPTION');
  return {
    entries:[...(record?.entries || []),{createdAt,materials:{...materials}}],
    supervisorPendingBatch:{...materials},
  };
}
