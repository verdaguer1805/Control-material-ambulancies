import { DEMO_ITEMS, checklistStatus } from "./checklist-demo.mjs";
// Browser export uses the application's existing Excel library, not a new dependency.
export function buildChecklistWorkbook(XLSX, records) {
  const wb = XLSX.utils.book_new();
  const groups = new Map();
  for (const r of records) {
    const key = JSON.stringify([r.lot,r.zone,r.warehouse]);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(r);
  }
  const colors = {Correcto:"D9EEDC",Incidencia:"FFE0B2","No realizado":"F8CDCD",Pendiente:"EEEEEE"};
  let index=0;
  for(const rows of groups.values()) {
    const first=rows[0];
    const values = [
      [`CHECKLIST DE PRUEBA · ${first.zone} · ${first.warehouse}`],
      [first.lot],
      ["Datos locales de simulación. Lista provisional. No incluye guardias reales."],
      ["Verde: correcto · Naranja: incidencia · Rojo: no realizado fuera de plazo · Gris: pendiente"],
      ["Fecha de guardia","Unidad","Estado",...DEMO_ITEMS,"Observaciones","Tipo de vehículo"],
      ...rows.map(r=>[new Date(`${r.date}T12:00:00`),r.unit,checklistStatus(r),...DEMO_ITEMS.map(m=>r.answers?.[m]==="ok"?"Correcto":r.answers?.[m]==="issue"?"X - Incidencia":"Sin revisar"),DEMO_ITEMS.filter(m=>r.answers?.[m]==="issue" && r.notes?.[m]).map(m=>`${m}: ${r.notes[m]}`).join("\n"),r.vehicleType || "TSU"])
    ];
    const ws=XLSX.utils.aoa_to_sheet(values,{cellDates:false,dateNF:"dd/mm/yyyy"});
    ws["!cols"]=[{wch:18},{wch:12},{wch:19},...DEMO_ITEMS.map(()=>({wch:23})),{wch:55},{wch:20}];
    ws["!merges"]=[0,1,2,3].map(r=>({s:{r,c:0},e:{r,c:7}}));
    ws["!rows"]=values.map((_,i)=>({hpt:i<4?30:i===4?36:72}));
    ws["!autofilter"]={ref:`A5:I${values.length}`};
    for(let r=0;r<values.length;r++) for(let c=0;c<9;c++) {
      const addr=XLSX.utils.encode_cell({r,c});
      if(!ws[addr]) continue;
      ws[addr].s={font:{name:"Arial",sz:11,color:{rgb:r===4?"FFFFFF":"222222"},bold:r===0||r===4},alignment:{vertical:"center",wrapText:true},fill:{fgColor:{rgb:r===4?"B91C1C":r>=5?colors[checklistStatus(rows[r-5])]:"FFFFFF"}}};
      if(r>=5&&c===0) ws[addr].z="dd/mm/yyyy";
    }
    XLSX.utils.book_append_sheet(wb,ws,`${++index} ${first.warehouse}`.replace(/[\\/?*\[\]:]/g," ").slice(0,31));
  }
  return wb;
}
export async function downloadChecklistDemo(records) {
  const module=await import("xlsx-js-style"), XLSX=module.default || module;
  const wb=buildChecklistWorkbook(XLSX,records);
  XLSX.writeFile(wb,"checklist_PRUEBA.xlsx");
}
