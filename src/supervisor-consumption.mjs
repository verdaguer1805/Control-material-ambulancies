// Supervisors enter each withdrawal separately; the transport keeps a daily total
// so existing server retries remain idempotent and reports retain their history.
export function supervisorDraft(record) {
  return record && !record.synced ? {...record.supervisorPendingBatch} : {};
}

export function appendSupervisorConsumption(record, materials, createdAt) {
  if (record && !record.synced) throw new Error('SUPERVISOR_PENDING_CONSUMPTION');
  if (!Object.values(materials).some(value=>value>0)) throw new Error('EMPTY_SUPERVISOR_CONSUMPTION');
  return {
    entries:[...(record?.entries || []),{createdAt,materials:{...materials}}],
    supervisorPendingBatch:{...materials},
  };
}
