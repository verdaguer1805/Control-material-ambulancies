import {checklistReferenceSections} from './checklist-reference.mjs';

export function checklistReferenceWorkbook(XLSX,type){
 const sections=checklistReferenceSections(type);
 if(!sections.length)throw new Error('Selecciona un checklist con contenido definido.');
 const rows=[['Zona','Compartimento','Bolsa / apartado','Material y cantidad']];
 for(const section of sections)for(const group of section.groups)for(const item of group.items){
  rows.push([section.area,section.title,group.title,item]);
 }
 const sheet=XLSX.utils.aoa_to_sheet(rows);
 sheet['!cols']=[{wch:29},{wch:48},{wch:38},{wch:75}];
 sheet['!autofilter']={ref:sheet['!ref']};
 sheet['!rows']=rows.map((row,index)=>({hpt:index===0?28:Math.max(32,16*Math.max(...row.map((value,col)=>Math.ceil(String(value).length/[27,46,36,73][col]))))}));
 for(let r=0;r<rows.length;r++)for(let c=0;c<4;c++){
  const cell=sheet[XLSX.utils.encode_cell({r,c})];
  cell.s={font:{name:'Calibri',sz:11,bold:r===0,color:{rgb:r===0?'FFFFFF':'24343A'}},
   fill:{fgColor:{rgb:r===0?'006477':r%2?'F0F6F7':'FFFFFF'}},
   alignment:{vertical:'top',wrapText:true}};
 }
 const book=XLSX.utils.book_new();
 book.Props={Title:`Plantilla checklist ${type}`,Subject:type==='BP'?'BP en preparación. Fotografías pendientes.':'Plantilla de consulta, sin respuestas de unidades ni auditorías.'};
 XLSX.utils.book_append_sheet(book,sheet,`Checklist ${type}`);
 return book;
}

export async function downloadChecklistReference(type){
 const XLSX=await import('xlsx-js-style');
 const book=checklistReferenceWorkbook(XLSX,type);
 XLSX.writeFile(book,`Plantilla_checklist_${type}.xlsx`);
}
