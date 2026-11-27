// No local timestamp is used as evidence of an authorization.
export function auditorLastAuthorization(row){return row?.last_authorized_at || null;}

export async function auditorAdminRequest(client,name,args={},timeoutMs=20000){
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
  controller.abort();reject(new Error('AUDITOR_ADMIN_REQUEST_TIMEOUT'));
 },timeoutMs);});
 try{
  return await Promise.race([(async()=>{
   const {data,error}=await client.rpc(name,args).abortSignal(controller.signal);
   if(error)throw error;if(data?.error)throw new Error(data.error);return data;
  })(),timeout]);
 }finally{clearTimeout(timer);}
}

export function auditorAdminError(error){
 const message=String(error?.message||error||'');
 if(message.includes('AUDITOR_ACCESS_CHANGED'))return 'El permiso de este móvil ha cambiado desde que abriste la lista. Actualízala y comprueba de nuevo el móvil antes de revocar.';
 if(message.includes('AUDITOR_ADMIN_REQUEST_TIMEOUT'))return 'El servidor no ha confirmado la operación a tiempo. No repitas la revocación sin actualizar primero la lista.';
 if(message.includes('ADMIN_ROLE_ACCESS_DENIED')||message.includes('ADMIN_ZONE_ACCESS_DENIED'))return 'Tu sesión no tiene permiso para gestionar este móvil. Verifica de nuevo tu acceso a administración.';
 if(message.includes('revoke_mobile_auditor_checked')||error?.code==='PGRST202')return 'Falta instalar la actualización de permisos en el servidor. No se ha enviado una revocación sin la comprobación de seguridad.';
 return 'No se ha podido confirmar la operación. Actualiza la lista para comprobar el estado real del permiso.';
}
