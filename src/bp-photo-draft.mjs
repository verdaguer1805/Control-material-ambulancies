// Local proposal only. Positions and grouped source sections await user review.
import {BP_CHECKLIST_SECTIONS} from './bp-checklist-catalog.mjs';
export function bpPhotoSections(zone,point){
 const leftRows=[149,150,151];
 const sections=point[3].map(row=>{
  const section=BP_CHECKLIST_SECTIONS.find(s=>s.sourceRow===row);
  return row===147?{...section,items:section.items.filter(i=>leftRows.includes(i.sourceRow)).map(i=>i.sourceRow===151?{...i,label:'Bomba de vacío'}:i)}:section;
 });
 if(zone.id==='under-vacuum'&&point[0]===1)sections.push({id:'bp-under-vacuum-material',title:'Material complementario',items:BP_CHECKLIST_SECTIONS.find(s=>s.sourceRow===147).items.filter(i=>!leftRows.includes(i.sourceRow))});
 return sections;
}
export const BP_PHOTO_DRAFT=[
 {id:'left',title:'Zona izquierda',ratio:4/3,points:[
  [1,25,25,[1,22]],[2,27,41,[28,33,47]],
  [3,29,65,[147]],
  [4,58,29,[190]],[5,74,30,[195]],[6,90,31,[202]],
  [7,66,65,[210]],[8,57,47,[225]],[9,79,77,[229,235]]]},
 {id:'front',title:'Zona frontal',ratio:4/3,points:[
  [1,31,31,[246]],[2,25,55,[250]],[3,32,67,[254]],
  [4,34,81,[274]],[5,65,42,[278]]]},
 {id:'rear-left',title:'Puerta trasera izquierda',ratio:3/4,points:[
  [1,34,48,[161]],[2,82,75,[186]]]},
 {id:'rear-right',title:'Puerta trasera derecha',ratio:3/4,points:[[1,51,57,[167]]]},
 {id:'sliding-left',title:'Puerta corredera lateral izquierda',ratio:3/4,points:[
  [1,65,34,[287]],[2,24,66,[295]],[3,71,72,[300]]]},
 {id:'under-vacuum',title:'Debajo del colchón de vacío',ratio:3/4,points:[[1,49,48,[51,65,69,77,87,94,102,113,126,136]]]},
];
