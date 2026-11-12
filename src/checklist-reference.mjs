import { SVB_LEFT_WALL_SECTIONS } from './svb-left-wall-data.mjs';
import { SVB_FRONT_WALL_SECTIONS } from './svb-front-wall-data.mjs';
import { SVB_RIGHT_ZONE_SECTIONS } from './svb-right-zone-data.mjs';
import { SVB_DOOR_SECTIONS } from './svb-door-data.mjs';
import { SVB_CABIN_ITEMS } from './svb-cabin-data.mjs';
import { TSNU_CHECKLIST_CATALOGS, tsnuChecklistItemLabel } from './tsnu-checklist-catalog.mjs';
import { BP_CHECKLIST_SECTIONS } from './bp-checklist-catalog.mjs';
import { bpQuantityLabel } from './bp-quantity.mjs';

export const canReadChecklistReference = access => ['owner', 'supervisor', 'logistics'].includes(access?.role);
export const CHECKLIST_REFERENCE_TYPES = [
  ['SVB', 'SVB'], ['T', 'TSNU · Tango (T)'], ['K', 'TSNU · Kilo (K)'], ['KE', 'TSNU · Kilo Eco (KE)'],
  ['BP', 'BP'], ['Polivalente', 'Polivalente'], ['Logística', 'Logística'],
];
const svbAreas = [
  ['Zona izquierda', SVB_LEFT_WALL_SECTIONS], ['Zona frontal', SVB_FRONT_WALL_SECTIONS],
  ['Zona derecha', SVB_RIGHT_ZONE_SECTIONS], ['Puerta corredera izquierda', SVB_DOOR_SECTIONS],
  ['Cabina de conducción', [{ id: 'cabina', title: 'Cabina de conducción', items: SVB_CABIN_ITEMS }]],
];
export function checklistReferenceSections(type) {
  if(type==='BP')return BP_CHECKLIST_SECTIONS.map(section=>({
    key:section.id,area:section.area,title:section.title,
    groups:[{title:'',items:section.items.map(item=>`${item.label} · ${bpQuantityLabel(item.quantity)}`)}],
  }));
  if (type === 'SVB') return svbAreas.flatMap(([area, sections]) =>
    sections.filter(section => !section.pendingDefinition).map(section => ({
      key: `${area}:${section.id}`, area,
      title: /^(Compartimento\b|Cabina\b)/i.test(section.title)
        ? section.title : `Compartimento ${section.id} · ${section.title}`,
      groups: section.groups || (section.kit ? [
        { title: '', items: section.items.filter(item => !section.kit.items.includes(item)) },
        section.kit,
      ] : [{ title: '', items: section.items }]),
    })));
  if (!Object.hasOwn(TSNU_CHECKLIST_CATALOGS, type)) return [];
  return TSNU_CHECKLIST_CATALOGS[type].map(([title, items], index) => ({
    key: `${type}:${index}`, area: '', title, groups: [{ title: '', items: items.map(tsnuChecklistItemLabel) }],
  }));
}
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterChecklistReference(sections, area, query) {
  const normalized = normalize(query).trim();
  const numbered = normalized.match(/\b(compartiment(?:o)?|cajon)\s+(\d+[a-z]?)\b/);
  const terms = (numbered ? normalized.replace(numbered[0], '') : normalized).split(/\s+/).filter(Boolean);
  return sections.filter(section => (!area || section.area === area)
    && (!numbered || new RegExp(`^${numbered[1] === 'cajon' ? 'cajon n\\.[oº]' : 'compartimento'} ${numbered[2]}(?:\\s|$)`).test(normalize(section.title)))
    && terms.every(term =>
    normalize([section.area, section.title, ...section.groups.flatMap(group => [group.title, ...group.items])].join(' ')).includes(term)));
}
