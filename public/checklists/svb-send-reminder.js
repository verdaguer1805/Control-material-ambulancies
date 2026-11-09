import { checklistFingerprint, checklistReminderKind, showChecklistSendReminder } from './checklist-send-reminder.js?v=259';
import { SVB_LEFT_WALL_SECTIONS, sectionStatus, leftRequiredSections } from './svb-left-wall-data.js?v=259';
import { SVB_FRONT_WALL_SECTIONS, frontSectionStatus, frontRequiredSections } from './svb-front-wall-data.js?v=259';
import { SVB_RIGHT_ZONE_SECTIONS, rightZoneStatus } from './svb-right-zone-data.js?v=259';
import { SVB_DOOR_SECTIONS, doorSectionStatus, doorRequired } from './svb-door-data.js?v=259';
import { cabinStatus } from './svb-cabin-data.js?v=259';
import { svbGuardStatus } from './svb-guard-window.js?v=259';
import { readSvbVehicleAssignment } from './svb-vehicle-assignment.js?v=259';

const read = (storage, key) => { try { return JSON.parse(storage.getItem(key) || '{}'); } catch { return {}; } };
const scopeOf = (context, vehicle) => `${context.unit}:${context.guardCode}:${vehicle}`;
export const svbSentSnapshotKey = (context, vehicle) => `cma_svb_sent_snapshot_v1:${scopeOf(context, vehicle)}`;
export function svbAnswerSnapshot(storage, context, vehicle) {
  return Object.fromEntries(['left', 'front', 'right', 'cabin', 'door'].map(zone => [zone,
    read(storage, `cma_svb_${zone}_${zone === 'right' ? 'zone' : 'wall'}_mobile_test_v1:${scopeOf(context, vehicle)}`)]));
}
export function svbReviewComplete(answers, confirmed) {
  const sectionsComplete = (sections, status, values) => sections.every(section => status(section, values) !== 'pending');
  return sectionsComplete(leftRequiredSections(SVB_LEFT_WALL_SECTIONS, answers.left, confirmed), sectionStatus, answers.left)
    && sectionsComplete(frontRequiredSections(SVB_FRONT_WALL_SECTIONS, answers.front, confirmed), frontSectionStatus, answers.front)
    && sectionsComplete(SVB_RIGHT_ZONE_SECTIONS, rightZoneStatus, answers.right)
    && cabinStatus(answers.cabin) !== 'pending'
    && (!doorRequired(answers.door, confirmed) || sectionsComplete(SVB_DOOR_SECTIONS, doorSectionStatus, answers.door));
}
export function rememberSvbSubmission(storage, context, vehicle, answers) {
  storage.setItem(svbSentSnapshotKey(context, vehicle), checklistFingerprint(answers));
}

export function installSvbSendReminder({ overview = false, send, canPrompt = () => true } = {}) {
  let shownThisVisit = false, closeModal = null;
  function check() {
    if (!canPrompt()) return;
    const context = read(localStorage, 'cma_svb_checklist_context_v1');
    const vehicle = readSvbVehicleAssignment(localStorage, context.unit, context.guardCode);
    if (context.checklist !== 'SVB' || !context.lot || !context.zone || !/^\d{4}$/.test(vehicle) || !['current', 'upcoming'].includes(svbGuardStatus(context))) {
      closeModal?.(); closeModal = null; return;
    }
    const scope = scopeOf(context, vehicle), answers = svbAnswerSnapshot(localStorage, context, vehicle);
    const confirmed = Boolean(localStorage.getItem(`cma_svb_submitted_v1:${scope}`));
    const snapshot = checklistFingerprint(answers), sentKey = svbSentSnapshotKey(context, vehicle);
    // Old confirmed checklists have no baseline. Adopt one without inventing an edit.
    if (confirmed && !localStorage.getItem(sentKey)) rememberSvbSubmission(localStorage, context, vehicle, answers);
    const complete = svbReviewComplete(answers, confirmed);
    const kind = checklistReminderKind({ complete, confirmed, snapshot, sentSnapshot: localStorage.getItem(sentKey), reviewingFinished: overview });
    if (overview) {
      const intentKey = `cma_svb_send_intent_v1:${scope}`;
      const intent = sessionStorage.getItem(intentKey); sessionStorage.removeItem(intentKey);
      if (intent === snapshot && complete) { void send(); return; }
    }
    const notifiedKey = `cma_svb_prompt_seen_v1:${scope}`;
    if (!kind || closeModal || (!overview && shownThisVisit) || sessionStorage.getItem(notifiedKey) === snapshot) return;
    shownThisVisit = true; sessionStorage.setItem(notifiedKey, snapshot);
    closeModal = showChecklistSendReminder(kind, () => {
      closeModal = null;
      // Recheck context/completeness in the existing submit handler; never send a different guard.
      if (overview) return send();
      sessionStorage.setItem(`cma_svb_send_intent_v1:${scope}`, snapshot);
      location.assign('./svb-zones.html?v=259');
    }, () => { closeModal = null; });
  }
  addEventListener('cma:svb-answers-changed', () => queueMicrotask(check));
  document.addEventListener('click', () => queueMicrotask(check));
  addEventListener('pageshow', check);
  addEventListener('focus', check);
  addEventListener('storage', check);
  setTimeout(check, 0);
}
