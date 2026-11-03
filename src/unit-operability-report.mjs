import {madridDateTime} from './report-datetime.mjs';
import {INOPERABILITY_REASONS} from './unit-operability.mjs';
export function inoperabilityReportRows(records) {
  const timestamp=value=>{if(!value)return '';const {date,time}=madridDateTime(value);return `${date} ${time}`;};
  const names=Object.fromEntries(INOPERABILITY_REASONS);
  return records.map(row=>({
    'Lote':row.lot,'Zona':row.zone,'Inicio':timestamp(row.started_at),'Fin':timestamp(row.ended_at),
    'Tipo de inoperatividad':names[row.reason]||row.reason,'Indicativo CECOS / unidad':row.unit,
    'Indicativo vehículo':row.vehicle,'Matrícula vehículo':row.plate,
    'Descripción de la inoperatividad':row.description||'','Resolución':row.resolution||'',
    'Contexto de la pregunta':row.question_version>=2?'Activados, asistiendo o trasladando':'Asistiendo o trasladando',
    'Respuesta':row.has_patient?'Sí':'No','ID del incidente':row.external_incident_id||'',
    'Justificación':row.justification||'',
    'Comunicación recibida':timestamp(row.received_at),'Recuperación recibida':timestamp(row.closed_received_at),
  }));
}
export function madridDayStart(date,offset=0){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw new Error('Revisa las fechas del informe.');
  const d=new Date(`${date}T00:00:00Z`);if(d.toISOString().slice(0,10)!==date)throw new Error('Revisa las fechas del informe.');
  d.setUTCDate(d.getUTCDate()+offset);const wanted=d.getTime();let result=wanted;
  for(let i=0;i<3;i++){
    const local=madridDateTime(result);result+=wanted-Date.parse(`${local.date}T${local.time}Z`);
  }
  return new Date(result).toISOString();
}
