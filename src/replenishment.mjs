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
  return {version:2,id,destination,origin:destination===scope.central.id?'':scope.central.id,
    rows:Object.fromEntries(proposals.map(x=>[x.material,{quantity:String(x.replenish),checked:false}])),request:null};
}

export function validateReplenishmentDraft(scope,draft,destination){
  const origin=destination===scope.central.id?'':scope.central.id;
  const invalid=()=>{throw new Error('Borrador no válido para este almacén. No se ha borrado; solicita revisión.');};
  if(!scope.warehouseIds.includes(destination)||![1,2].includes(draft?.version)||
    draft.destination!==destination||draft.origin!==origin||!draft.id||
    !draft.rows||typeof draft.rows!=='object'||Array.isArray(draft.rows))invalid();
  const r=draft.request;
  if(r&&(r.p_request_id!==draft.id||r.p_lot!==scope.lot||r.p_zone!==scope.zone||
    r.p_origin_id!==(origin||null)||r.p_destination_id!==destination||
    !r.p_items||typeof r.p_items!=='object'||Array.isArray(r.p_items)||!Object.keys(r.p_items).length||
    Object.values(r.p_items).some(q=>typeof q!=='number'||!validReplenishmentQuantity(q))))invalid();
  return draft;
}

// One calculation for the screen, exports and the fresh check before delivery.
// A configured minimum always describes actual stock, never a future transfer.
// Supervisor supplies without a minimum retain their explicit consumption queue.
export function replenishmentGroups(locations,materials,levels,minimums,pending={},types={}){
  return locations.map((location,index)=>({location,items:materials.map(material=>{
    const quantity=Number(levels[location]?.[material]||0);
    const minimum=Number(minimums[location]?.[material]||0);
    const consumption=Number(pending[location]?.[material]||0);
    const supplyType=types[material]||'standard';
    const replenish=minimum>0?Math.max(0,minimum-quantity):
      index>0&&supplyType==='supervisor'?Math.max(0,consumption):0;
    return {material,quantity,minimum,pending:consumption,supplyType,replenish,urgent:replenish>0};
  }).filter(item=>item.replenish>0)}));
}

const rowBasis=(material,proposals,levels,minimums)=>JSON.stringify([
  Number(levels[material]||0),Number(minimums[material]||0),
  Number(proposals.find(item=>item.material===material)?.replenish||0),
]);

// Never rebase an uncertain send: its id and payload must survive refresh/reopen.
// Old v1 drafts have no basis, so automatic quantities are recalculated once.
// Explicit extras remain editable even when stock already meets the minimum.
export function reconcileReplenishment(draft,proposals,levels={},minimums={}){
  if(draft.request)return draft;
  const rows={};
  for(const [material,row] of Object.entries(draft.rows)){
    const basis=rowBasis(material,proposals,levels,minimums);
    const proposal=proposals.find(item=>item.material===material);
    if(row.registered){rows[material]=row;continue;}
    if(row.manual===true){rows[material]={...row,checked:false,basis};continue;}
    if(!proposal)continue;
    rows[material]={...row,manual:false,checked:false,basis,
      quantity:row.basis===basis?String(row.quantity):String(proposal.replenish)};
  }
  for(const proposal of proposals){
    if(!rows[proposal.material])rows[proposal.material]={quantity:String(proposal.replenish),
      checked:false,manual:false,basis:rowBasis(proposal.material,proposals,levels,minimums)};
  }
  // v285 must not reopen confirmed per-row deliveries as unchecked pending rows.
  const next={...draft,version:2,rows};
  return JSON.stringify(next)===JSON.stringify(draft)?draft:next;
}

export function replenishmentRowRequest(scope,draft,material,materials){
  const row=draft.rows[material];
  if(!row||row.registered)throw new Error('DELIVERY_ALREADY_REGISTERED');
  return replenishmentRequest(scope,{...draft,rows:{[material]:{...row,checked:true}}},materials);
}

export function completeReplenishment(draft,receipt,nextId){
  if(!draft.request||receipt?.request_id!==draft.request.p_request_id)throw new Error('UNCONFIRMED_RECEIPT');
  const rows={...draft.rows};
  // Use the immutable request, not the current checkbox/row state (legacy batches too).
  for(const [material,quantity] of Object.entries(draft.request.p_items)){
    rows[material]={...rows[material],quantity:String(quantity),checked:false,
      registered:{requestId:receipt.request_id,confirmedAt:receipt.confirmed_at||null}};
  }
  return {...draft,version:2,id:nextId,request:null,rows};
}

export function reopenReplenishment(draft){
  if(draft.request)return draft;
  return {...draft,rows:Object.fromEntries(Object.entries(draft.rows).filter(([,row])=>!row.registered))};
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
