import { TSNU_CHECKLIST_GROUPS } from './checklist-demo.mjs';
import { SVB_LEFT_WALL_SECTIONS } from './svb-left-wall-data.mjs';
import { SVB_FRONT_WALL_SECTIONS } from './svb-front-wall-data.mjs';
import { SVB_RIGHT_ZONE_SECTIONS } from './svb-right-zone-data.mjs';
import { SVB_CABIN_ITEMS } from './svb-cabin-data.mjs';

export const AUDIT_TYPES = ['TSNU', 'SVB', 'Polivalente', 'Logística'];
export const AUDIT_STORAGE_KEY = 'cma_supervisor_vehicle_audits_v1';
export const normalizeAuditVehicle = value => String(value || '').trim().toUpperCase();
export const validAuditVehicle = value => /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(normalizeAuditVehicle(value));
export const isAuditSupervisor = value => /^Material supervisor\s*·\s*\S/i.test(value || '') || /^SUPERVISOR_\S/i.test(value || '');
export function auditGroups(type) {
  if (type === 'TSNU') return TSNU_CHECKLIST_GROUPS.map(([title, items], index) => ({id:`tsnu-${index}`, title, items}));
  if (type !== 'SVB') return [];
  const groups = [];
  for (const [zone, sections] of [['Zona izquierda', SVB_LEFT_WALL_SECTIONS], ['Zona frontal', SVB_FRONT_WALL_SECTIONS], ['Zona derecha', SVB_RIGHT_ZONE_SECTIONS]]) {
    for (const section of sections.filter(s => !s.pendingDefinition)) {
      const children = section.groups || [{title:'', items:section.items}];
      children.forEach((child, index) => groups.push({id:`${zone}-${section.id}-${index}`, title:`${zone} · ${section.title}${child.title ? ` · ${child.title}` : ''}`, items:child.items}));
    }
  }
  groups.push({id:'cabin', title:'Cabina de conducción', items:SVB_CABIN_ITEMS});
  return groups;
}
export function auditItems(type) {
  return auditGroups(type).flatMap(group => group.items.map((label, index) => ({id:`${group.id}:${index}`, label, section:group.title})));
}
export function auditComplete(draft) {
  const items = draft?.catalog || [];
  return validAuditVehicle(draft?.vehicle) && ['TSNU','SVB'].includes(draft?.type) && items.length > 0 && items.every(item => ['ok','issue'].includes(draft.answers?.[item.id]));
}
export function refreshPendingAudit(draft) {
  if (draft.confirmedAt) return draft;
  const known=new Set(draft.catalog.map(item=>item.id));
  return {...draft,catalog:[...draft.catalog,...auditItems(draft.type).filter(item=>!known.has(item.id))]};
}
export function markAuditGroupCorrect(draft, groupId) {
  const answers = {...draft.answers};
  for (const item of draft.catalog.filter(item => item.id.startsWith(`${groupId}:`))) {
    if (answers[item.id] !== 'issue') answers[item.id] = 'ok';
  }
  return {...draft, answers, confirmedAt:null};
}
export function readAudits(storage) {
  const raw = storage.getItem(AUDIT_STORAGE_KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('No se pueden leer las auditorías guardadas. No se han sobrescrito.');
  return value;
}
export function saveAudit(storage, draft) {
  const rows = readAudits(storage);
  storage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([...rows.filter(row => row.id !== draft.id), draft]));
}
export function auditRequest(draft) {
  if (!auditComplete(draft)) throw new Error('Revisa todos los materiales antes de enviar.');
  return {p_id:draft.id, p_vehicle:normalizeAuditVehicle(draft.vehicle), p_type:draft.type,
    p_items:draft.catalog.map(item => ({...item, status:draft.answers[item.id], note:String(draft.notes?.[item.id] || '').slice(0,1000)}))};
}
