import {BP_PHOTO_DRAFT,bpPhotoSections} from './bp-photo-draft.mjs';
import {BP_CHECKLIST_SECTIONS} from './bp-checklist-catalog.mjs';
import {bpItemLabel} from './bp-quantity.mjs';
export const isBpUnit = unit => /^BP[0-9]+$/i.test(String(unit||'').trim());
export const BP_ZONES = [...BP_PHOTO_DRAFT.map(z=>({...z,groups:z.points.flatMap(p=>bpPhotoSections(z,p).map(s=>({...s,point:p[0]})))})),
 {id:'cabin',title:'Cabina de conducción',points:[],groups:BP_CHECKLIST_SECTIONS.filter(s=>s.sourceRow===311).map(s=>({...s,point:1}))}];
export const BP_ITEMS=BP_ZONES.flatMap(z=>z.groups.flatMap(s=>s.items.map(i=>({id:i.id,label:bpItemLabel(i),section:`${z.title} · ${s.title}`}))));
export function bpPointItems(zone,point){return zone.groups.filter(g=>point==null||g.point===point).flatMap(g=>g.items.map(i=>i.id));}
export function bpStatus(answers,ids){return !ids.length||ids.some(id=>!['ok','issue'].includes(answers?.[id]))?'pending':ids.some(id=>answers[id]==='issue')?'issue':'ok';}
export function bpDraftKey({lot,zone,unit,guardCode,vehicle}){
 return 'cma_bp_review_v1:'+JSON.stringify([lot,zone,unit,guardCode,vehicle]);
}
export function bpPayload(draft){
 if(bpStatus(draft.answers,BP_ITEMS.map(i=>i.id))==='pending')throw new Error('Completa todos los puntos antes de enviar.');
 return {p_guard_code:draft.guardCode,p_vehicle_label:draft.vehicle,p_guard_started_at:draft.guardStartedAt,
 p_items:BP_ITEMS.map(i=>({...i,status:draft.answers[i.id],note:String(draft.notes?.[i.id]||'').slice(0,1000)}))};
}
export const bpSnapshot = draft => JSON.stringify(BP_ITEMS.map(i=>[i.id,draft.answers?.[i.id]||'',draft.notes?.[i.id]||'']));
