// Vehicle family depends only on the unit prefix, never on its lot or zone.
export function tsnuChecklistType(unit) {
  const value=String(unit || '').trim().toUpperCase();
  if (/^KE/.test(value)) return 'KE';
  if (/^K/.test(value)) return 'K';
  if (/^T/.test(value)) return 'T';
  return '';
}
export function tsnuChecklistLabel(unit) {
  return {T:'Tango (T)',K:'Kilo (K)',KE:'Kilo Eco (KE)'}[tsnuChecklistType(unit)] || 'TSNU';
}
const BASE_GROUPS=[
  ['Maleta de intervención',['Maleta de intervención precintada']],
  ['Cajón n.º 1',['DEA','Mantas de un solo uso']],
  ['Cajón n.º 2',['Contenedor de agujas grande','Bolsas de vómito','Sonda de aspiración','Aspirador manual','Empapadores']],
  ['Cajón n.º 3',['Cuña de hombre','Cuña de mujer']],
  ['Cajón n.º 4',['Bata EPI o mono de protección','Bolsas de residuos GII','Bolsas de basura negras','Gafas de protección EPI','Guantes de protección EPI']],
  ['Parte trasera del vehículo',['Oxígeno disponible y con carga suficiente']],
  ['Parte delantera del vehículo',['Guantes de nitrilo de diferentes tallas','Cadenas de nieve','Cizallas','Pata de cabra','Tarjeta de gasóleo','Tarjeta Trueta','Baliza V-16']],
];
const NO_KILO_TOOLS=new Set(['Cizallas','Pata de cabra']);
const cloneGroups=(withoutTools=false)=>BASE_GROUPS.map(([title,items])=>[title,items.filter(item=>!withoutTools || !NO_KILO_TOOLS.has(item))]);
// Independent catalogs: future changes to K must not silently change KE or T.
export const TSNU_CHECKLIST_CATALOGS={T:cloneGroups(),K:cloneGroups(true),KE:cloneGroups(true)};
export function tsnuChecklistGroups(unit) {
  const groups=TSNU_CHECKLIST_CATALOGS[tsnuChecklistType(unit) || 'T'];
  return groups.map(([title,items])=>[title,[...items]]);
}
export const tsnuChecklistItems=unit=>tsnuChecklistGroups(unit).flatMap(([,items])=>items);
export function currentTsnuAnswers(record) {
  const allowed=new Set(tsnuChecklistItems(record.unit));
  return Object.fromEntries(Object.entries(record.answers || {}).filter(([item])=>allowed.has(item)));
}
