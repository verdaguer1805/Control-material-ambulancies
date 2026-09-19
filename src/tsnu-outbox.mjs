export const TSNU_OUTBOX_KEY = 'cma_tsnu_outbox_v1';
export const TSNU_SHIFT_KEY = 'cma_tsnu_active_shift_v1';
export function readTsnuOutbox(storage) {
  try { const value=JSON.parse(storage.getItem(TSNU_OUTBOX_KEY)||'[]');return Array.isArray(value)?value:[]; }
  catch { return []; }
}
export function queueTsnuOperation(storage, operation) {
  const rows=readTsnuOutbox(storage);
  if (!rows.some(row=>row.localId===operation.localId)) rows.push(operation);
  storage.setItem(TSNU_OUTBOX_KEY,JSON.stringify(rows));return rows;
}
export function removeTsnuOperation(storage, localId) {
  const rows=readTsnuOutbox(storage).filter(row=>row.localId!==localId);
  storage.setItem(TSNU_OUTBOX_KEY,JSON.stringify(rows));return rows;
}
export function readTsnuShift(storage, unit, lot) {
  try { const value=JSON.parse(storage.getItem(TSNU_SHIFT_KEY)||'null');return value?.unit===unit&&value?.lot===lot?value:null; }
  catch { return null; }
}
export function saveTsnuShift(storage, shift) {
  if (shift) storage.setItem(TSNU_SHIFT_KEY,JSON.stringify(shift)); else storage.removeItem(TSNU_SHIFT_KEY);
}
export const newOperationId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-4000-8000-${Math.random().toString(16).slice(2)}`;
export function rpcForTsnuOperation(operation) {
  if(operation.type==='start') return ['start_tsnu_shift',{p_shift_id:operation.shiftId,p_started_at:operation.at}];
  if(operation.type==='checklist') return ['submit_tsnu_checklist',{p_shift_id:operation.shiftId,p_answers:operation.answers}];
  if(operation.type==='withdrawal') return ['append_tsnu_withdrawal',{p_operation_id:operation.operationId,p_shift_id:operation.shiftId,p_materials:operation.materials}];
  if(operation.type==='finish') return ['finish_tsnu_shift',{p_shift_id:operation.shiftId,p_ended_at:operation.at}];
  throw new Error('Operación TSNU desconocida');
}
