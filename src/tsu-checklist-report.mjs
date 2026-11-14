import {withMissingChecklists} from './checklist-report-format.mjs';
import {isBpUnit, BP_ZONES} from './bp-operational.mjs';

// Normalize received BP snapshots into the same report shape as SVB.
// Keep the received labels and notes, not today's catalogue contents.
export function combinedTsuChecklists(svb, bp, roster, from, to) {
  const normalized = bp.map(record => {
    const answers = {};
    for (const item of record.items || []) {
      const parts = String(item.section || '').split(' · ');
      const title = parts.shift() || 'BP';
      const zone = BP_ZONES.find(z => z.title === title)?.id || title;
      const section = parts.join(' · ') || 'Material';
      const label = item.label + (item.note ? ` — ${item.note}` : '');
      ((answers[zone] ||= {})[section] ||= {})[label] = item.status;
    }
    return {...record, answers, checklist_type:'BP · Polivalente'};
  });
  const units = (roster || []).map(entry => {
    const row = typeof entry === 'string' ? {unit:entry} : entry;
    return isBpUnit(row.unit)
      ? {...row, first_date:row.first_date > '2026-11-14' ? row.first_date : '2026-11-14'}
      : row;
  });
  return withMissingChecklists([...svb, ...normalized], units, from, to);
}
