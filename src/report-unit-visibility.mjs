// Temporary report-only exclusions. Operational assignments and history remain.
const hiddenByScope = {
  'Lot 5 · Girona - Alt Maresme': {Olot: new Set(['G205','G215','G305'])},
};
export function reportUnitVisible(lot,zone,unit) {
  return !hiddenByScope[lot]?.[zone]?.has(String(unit || '').trim().toUpperCase());
}
export function filterReportUnits(data,lot,zone) {
  const visible=rows=>rows==null?rows:rows.filter(row=>reportUnitVisible(lot,zone,row.unit));
  const tsnu=data.tsnu || {};
  return {...data,records:visible(data.records),submissions:visible(data.submissions),svbChecklists:visible(data.svbChecklists),svbRoster:visible(data.svbRoster),
    tsnu:{...tsnu,shifts:visible(tsnu.shifts),withdrawals:visible(tsnu.withdrawals),roster:visible(tsnu.roster)}};
}
