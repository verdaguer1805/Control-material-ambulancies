// A draft belongs to an admin identity, lot, zone and destination, never a label alone.
export const replenishmentKey = (scope, actor, destination) =>
  `cma_replenishment_v1:${JSON.stringify([scope.lot,scope.zone,actor,destination])}`;
export const validReplenishmentQuantity = value => /^[0-9]+$/.test(String(value)) && Number(value)>=1 && Number(value)<=2147483647;
export function editReplenishmentRow(row,patch){
  const next={...row,...patch};
  if(!validReplenishmentQuantity(next.quantity))next.checked=false;
  return next;
}
export function canRemoveReplenishmentRow(draft,material,proposals=[]){
  return !draft?.request && draft?.rows[material]?.manual===true && !proposals.some(p=>p.material===material);
}
export function removeReplenishmentRow(draft,material,proposals=[]){
  if(!canRemoveReplenishmentRow(draft,material,proposals))return draft;
  const rows={...draft.rows};delete rows[material];
  return {...draft,rows};
}
export function replenishmentDraft(scope,destination,proposals,id) {
  if(!scope.warehouseIds.includes(destination))throw new Error('INVALID_DESTINATION');
  return {version:1,id,destination,origin:destination===scope.central.id?'':scope.central.id,
    rows:Object.fromEntries(proposals.map(x=>[x.material,{quantity:String(x.replenish),checked:false}])),request:null};
}
export function replenishmentItems(rows,materials) {
  const items={};
  for(const [material,row] of Object.entries(rows)){
    if(!row.checked)continue;
    if(!materials.includes(material))throw new Error('Material no disponible: '+material);
    if(!validReplenishmentQuantity(row.quantity))
      throw new Error('Indica una cantidad entera mayor que cero para '+material);
    items[material]=Number(row.quantity);
  }
  if(!Object.keys(items).length)throw new Error('Marca como «Dejado» al menos un material.');
  return items;
}
export function replenishmentRequest(scope,draft,materials) {
  if(!scope.warehouseIds.includes(draft.destination))throw new Error('INVALID_DESTINATION');
  if(draft.destination===scope.central.id ? draft.origin!=='' : draft.origin!==scope.central.id)
    throw new Error('INVALID_ORIGIN');
  return {p_request_id:draft.id,p_lot:scope.lot,p_zone:scope.zone,
    p_origin_id:draft.origin||null,p_destination_id:draft.destination,
    p_items:replenishmentItems(draft.rows,materials)};
}
export function replenishmentShortages(request,levels) {
  if(!request.p_origin_id)return [];
  return Object.entries(request.p_items).filter(([m,q])=>q>Number(levels[m]||0));
}
export async function boundedReplenishment(send,request,ms=20000){
  let timer;
  try{return await Promise.race([Promise.resolve().then(()=>send(request)),new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('REPLENISHMENT_TIMEOUT')),ms);
  })]);}finally{clearTimeout(timer);}
}
export const definitiveReplenishmentFailure = error =>
  /^(INVALID_QUANTITY|INVALID_ITEMS|INVALID_TRANSFER|INVALID_DESTINATION|INVALID_SCOPE|UNKNOWN_MATERIAL|Insufficient stock)/.test(error?.message||'');
