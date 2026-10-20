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
  ['Cajón n.º 2',['Bolsas de vómito','Sonda de aspiración','Empapadores','Aspirador manual','Contenedor de agujas grande']],
  ['Cajón n.º 3',['Cuña de hombre','Cuña de mujer']],
  ['Cajón n.º 4',['Bata EPI o mono de protección','Bolsas de residuos GII','Bolsas de basura negras','Gafas de protección EPI','Guantes de protección EPI']],
  ['Parte trasera del vehículo',['Oxígeno disponible y con carga suficiente']],
  ['Parte delantera del vehículo',['Guantes de nitrilo de diferentes tallas','Cadenas de nieve','Cizallas','Pata de cabra','Tarjeta de gasóleo','Tarjeta Trueta','Baliza V-16','Cargador de teléfono','Carpeta con documentación','Linterna + cono']],
];
// Stable answer keys keep old records readable; presentation adds the equipment
// descriptions and quantities without renaming stock or consumption materials.
export const TSNU_NEW_FRONT_ITEMS=['Cargador de teléfono','Carpeta con documentación','Linterna + cono'];
const ITEM_LABELS={
  DEA:'DEA + parches + rasurador',
  'Mantas de un solo uso':'Mantas de un solo uso · 4 unidades',
  'Bolsas de vómito':'Bolsas de vómito · 4 unidades',
  'Sonda de aspiración':'Sonda de aspiración · 2 unidades',
  Empapadores:'Empapadores · 4 unidades',
  'Aspirador manual':'Aspirador manual · 1 unidad',
  'Contenedor de agujas grande':'Contenedor de agujas grande · 1 unidad',
  'Cuña de hombre':'Cuña de hombre · 2 unidades',
  'Cuña de mujer':'Cuña de mujer · 2 unidades',
  'Bata EPI o mono de protección':'Bata EPI o mono de protección · 2 unidades',
  'Gafas de protección EPI':'Gafas de protección EPI · 1 unidad',
  'Guantes de protección EPI':'Guantes de protección EPI · 1 unidad',
  'Baliza V-16':'Baliza V-16 + chaleco de tránsito · 1 unidad',
  'Cargador de teléfono':'Cargador de teléfono · 1 unidad',
  'Linterna + cono':'Linterna + cono · 1 unidad',
};
export const tsnuChecklistItemLabel=item=>ITEM_LABELS[item] || item;
// Do not retrospectively add current quantities/equipment to historical reports.
export const tsnuReportedItemLabel=(item,answers)=>TSNU_NEW_FRONT_ITEMS.every(key=>Object.hasOwn(answers || {},key)) ? tsnuChecklistItemLabel(item) : item;
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
