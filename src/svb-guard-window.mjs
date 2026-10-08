const MADRID = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(value){return Object.fromEntries(MADRID.formatToParts(new Date(value)).map(p=>[p.type,p.value]));}
function dayOffset(p,offset){const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day+offset));return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};}
function localInstant(p,hour){const civil=Date.UTC(+p.year,+p.month-1,+p.day,hour);let time=civil;for(let i=0;i<3;i++){const actual=parts(time);const observed=Date.UTC(+actual.year,+actual.month-1,+actual.day,+actual.hour,+actual.minute,+actual.second);time+=civil-observed;}return time;}
export function svbGuardPeriod(start){
 const time=Date.parse(start);if(!Number.isFinite(time))return null;
 const p=parts(time),hour=+p.hour;if(![7,8,9].includes(hour)||p.minute!=='00'||p.second!=='00'||time%1000)return null;
 const end=localInstant(hour===9?p:dayOffset(p,1),hour===9?21:hour);
 return{code:`${p.day}${p.month}${p.year.slice(-2)}`,start:new Date(time).toISOString(),end:new Date(end).toISOString()};
}
export function svbGuardOptions(shift,now=new Date()){
 if(!['07:00','08:00','09:00'].includes(shift))return{current:null,next:null};
 const time=+new Date(now),p=parts(time),hour=+shift.slice(0,2),today=localInstant(p,hour);
 const current=svbGuardPeriod(new Date(time<today&&hour!==9?localInstant(dayOffset(p,-1),hour):today).toISOString());
 const next=svbGuardPeriod(new Date(time<today?today:localInstant(dayOffset(p,1),hour)).toISOString());
 return{current:time>=Date.parse(current.start)&&time<Date.parse(current.end)-60*60000?current:null,next:time>=Date.parse(next.start)-60*60000&&time<Date.parse(next.start)?next:null};
}
export function svbAssignedGuard(shift,now=new Date()){const options=svbGuardOptions(shift,now);return options.next||options.current;}
export function svbGuardStatus(context,now=new Date()){
 const period=svbGuardPeriod(context?.guardStartedAt);if(!period||period.code!==context.guardCode)return'invalid';
 const time=+new Date(now);if(time>=Date.parse(period.end)-60*60000)return'expired';
 if(time<Date.parse(period.start)-60*60000)return'too-early';
 return time<Date.parse(period.start)?'upcoming':'current';
}
export function svbGuardLabel(context,now=new Date()){
 const status=svbGuardStatus(context,now),date=new Date(context?.guardStartedAt);
 if(status==='invalid')return'Vuelve a Registro de consumo para seleccionar la guardia.';
 const label=date.toLocaleString('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 if(status==='expired')return`Plazo de checklist finalizado · ${label}. Si no se envió, queda como no realizado. Vuelve a Registro de consumo.`;
 if(status==='too-early')return`La preparación de esta guardia todavía no está disponible · ${label}.`;
 return`${status==='upcoming'?'Próxima guardia':'Guardia actual'} · ${label}${status==='upcoming'?'. No se modificará el checklist del turno actual.':''}`;
}
