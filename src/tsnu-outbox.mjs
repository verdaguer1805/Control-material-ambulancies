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
export function updateTsnuOperation(storage, localId, changes) {
  const rows=readTsnuOutbox(storage).map(row=>row.localId===localId?{...row,...changes}:row);
  storage.setItem(TSNU_OUTBOX_KEY,JSON.stringify(rows));return rows;
}
export function removeTsnuShiftOperations(storage, shiftId) {
  const rows=readTsnuOutbox(storage).filter(row=>row.shiftId!==shiftId);
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

const errorMessage = error => String(error?.message || error?.details || error || '');

export const isTsnuAuthorizationError = error =>
  /DEVICE_NOT_AUTHORIZED|MULTIPLE_ACTIVE_DEVICES|TSNU_UNIT_NOT_CONFIGURED|TSNU_ASSIGNMENT_REQUIRED/.test(errorMessage(error));

export const isTsnuConnectivityError = error =>
  /Failed to fetch|Load failed|NetworkError|network request|fetch failed|ERR_NETWORK|timeout/i.test(errorMessage(error));

export const isTsnuSessionError = error =>
  /INVALID_SHIFT|INVALID_OPEN_SHIFT|SHIFT_ID_CONFLICT|OPEN_SHIFT_EXISTS|INCOMPLETE_CHECKLIST|CHECKLIST_ALREADY_SUBMITTED|CHECKLIST_REQUIRED|INVALID_END_TIME|INVALID_WITHDRAWAL|INVALID_MATERIAL_QUANTITY|MATERIAL_NOT_IN_INVENTORY|OPERATION_ID_CONFLICT/.test(errorMessage(error));

/**
 * Synchronizes the TSNU outbox without allowing a damaged previous session to
 * block later independent sessions. Ordering is still strict inside each
 * session and an operation is removed only after Supabase confirms success.
 */
export async function syncTsnuOutbox(storage, sendOperation) {
  const result={synced:[],failed:[],skipped:[],stopped:null};
  const blockedShifts=new Set();

  for(const operation of readTsnuOutbox(storage)) {
    if(blockedShifts.has(operation.shiftId)) {
      result.skipped.push(operation);
      continue;
    }
    try {
      await sendOperation(operation);
      removeTsnuOperation(storage,operation.localId);
      result.synced.push(operation);
    } catch(error) {
      const message=errorMessage(error)||'TSNU_SYNC_FAILED';
      updateTsnuOperation(storage,operation.localId,{lastSyncError:message});
      result.failed.push({operation,error});

      if(isTsnuAuthorizationError(error)||isTsnuConnectivityError(error)||!isTsnuSessionError(error)) {
        result.stopped=error;
        break;
      }

      // The remaining dependent operations of this session stay untouched,
      // while another session can still synchronize independently.
      blockedShifts.add(operation.shiftId);
    }
  }
  return result;
}
