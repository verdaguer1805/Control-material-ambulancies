import {SVB_RIGHT_ZONE_SECTIONS} from './svb-right-zone-data.js?v=280';

export const isSvbChecklist = type => type === 'SVB' || type === 'SVB 4x4';
export const SVB_NORMAL_RIGHT = [
  ...SVB_RIGHT_ZONE_SECTIONS.filter(s => ['1','2','2a','3','4','5','6'].includes(String(s.id))),
  {id:7,title:'Compartimento 7',items:['Talla verde estéril · 2 unidades','Pinzas estériles · 4 unidades','Tijeras estériles · 4 unidades']},
  {id:8,title:'Compartimento 8',items:['Tiras reactivas · 1 bote','Lancetas · 20 unidades','Celulosa precortada · 20 unidades','Termómetro digital · 1 unidad']},
  {id:9,title:'Compartimento 9',items:['Bolsa de gel · 4 unidades','Inmovilizador de hombro · 1 unidad','Manta térmica · 4 unidades']},
  {id:10,title:'Compartimento 10',items:['Apósito 7,2x5 · 10 unidades','Apósito 10x8 · 10 unidades','Apósito 20x8 · 10 unidades','Sutura cutánea de papel 100x6 mm · 5 unidades']},
  {id:11,title:'Compartimento 11 · Armario inferior',items:['Cuña de cartón de un solo uso · 1 unidad','Botella de cartón de un solo uso · 1 unidad','Bolsa de basura · 1 rollo','Bolsa de residuos Grupo II · 1 rollo','Soporte para bombas de perfusión · 1 unidad']},
  {id:12,title:'Compartimento 12',items:['Extintor · 1 unidad','Cinta de balizamiento · 1 unidad']},
];
export const SVB_NORMAL_POSITIONS={1:[6,32],2:[27,28],'2a':[40,49],3:[56,23],4:[61,36],5:[61,44],6:[61,52],7:[59,60.2],8:[59,63.5],9:[61,67.7],10:[61.5,72.3],11:[64,81],12:[88,72]};
export const svbRightSections = type => type === 'SVB' ? SVB_NORMAL_RIGHT : SVB_RIGHT_ZONE_SECTIONS;
export function requestedSvbTemplate(context,vehicle) {
  if(context.lot==='Lot 5 · Girona - Alt Maresme') {
    if(['5538','5440','5441','5527'].includes(String(vehicle)))return 'SVB 4x4';
    if(['5439','5517','5413'].includes(String(vehicle)))return 'SVB';
    if(context.zone==='Olot' && ['G451','G452','G453'].includes(context.unit))return 'SVB 4x4';
  }
  return context.svbVariant==='SVB 4x4'?'SVB 4x4':'SVB';
}
// The old keys are intentionally retained: never migrate or delete live answers.
export function pinSvbTemplate(storage,context,vehicle) {
  const scope=`${context.unit}:${context.guardCode}:${vehicle}`;
  const key=`cma_svb_template_v1:${context.lot}:${scope}`;
  const saved=storage.getItem(key);
  if(saved!==null){if(!isSvbChecklist(saved))throw new Error('Plantilla guardada no válida. No se han modificado las respuestas.');return saved;}
  const legacy=['left','front','right','cabin','door'].some(zone=>storage.getItem(`cma_svb_${zone}_${zone==='right'?'zone':'wall'}_mobile_test_v1:${scope}`)!==null)
    || storage.getItem(`cma_svb_submitted_v1:${scope}`)!==null;
  const type=legacy?'SVB 4x4':requestedSvbTemplate(context,vehicle);
  storage.setItem(key,type);
  return type;
}
export function auditSvbTemplate(draft) {
  // Old drafts contain the catalog snapshot, not a version field.
  return draft?.catalog?.some(item=>item.id.startsWith('Zona derecha-7-'))?'SVB':'SVB 4x4';
}
