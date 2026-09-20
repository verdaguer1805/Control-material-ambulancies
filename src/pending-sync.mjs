const messageOf = (error) => String(error?.message || error || "");

export const isAuthorizationSyncError = (error) =>
  /DEVICE_NOT_AUTHORIZED|MULTIPLE_ACTIVE_DEVICES/.test(messageOf(error));

export async function syncPendingIndependently(records, sendRecord) {
  const result = { synced: [], failed: [], conflict: null, stopped: null };

  for (const record of records.filter((item) => !item.synced)) {
    if (record.conflict) {
      result.conflict ||= record;
      continue;
    }

    try {
      await sendRecord(record);
      record.pendingUpdate = false;
      record.synced = true;
      delete record.lastSyncError;
      result.synced.push(record);
    } catch (error) {
      record.synced = false;
      record.lastSyncError = messageOf(error) || "SYNC_FAILED";
      result.failed.push({ record, error });

      // An authorization failure affects every later request from this device.
      // Guard-specific failures are isolated so a previous guard can never
      // prevent a newer, valid guard from being synchronized.
      if (isAuthorizationSyncError(error)) {
        result.stopped = error;
        break;
      }
    }
  }

  return result;
}
