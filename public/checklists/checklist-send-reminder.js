export function checklistFingerprint(value) {
  const ordered = item => Array.isArray(item) ? item.map(ordered) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, ordered(item[key])])) : item;
  return JSON.stringify(ordered(value));
}

export function checklistReminderKind({ complete, confirmed, snapshot, sentSnapshot, reviewingFinished = false }) {
  if (!complete) return '';
  if (!confirmed) return 'first';
  return reviewingFinished && sentSnapshot && snapshot !== sentSnapshot ? 'updated' : '';
}

// A native modal stays centered above compartment sheets, including on mobile.
export function showChecklistSendReminder(kind, send, onClose = () => {}) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', kind === 'updated' ? 'Enviar cambios del checklist' : 'Enviar checklist completado');
  dialog.style.cssText = 'position:fixed;inset:0;margin:auto;width:min(420px,calc(100% - 32px));max-height:85dvh;overflow:auto;padding:24px;border:2px solid #006477;border-radius:18px;background:white;color:#16323a;text-align:center;box-sizing:border-box;box-shadow:0 12px 48px #0005;font-family:Arial,sans-serif';
  const style = document.createElement('style');
  style.textContent = 'dialog[data-checklist-send]::backdrop{background:#0009}';
  dialog.dataset.checklistSend = '';
  const title = document.createElement('h2'); title.textContent = kind === 'updated' ? 'Has modificado el checklist' : 'Has completado el checklist';
  title.style.cssText = 'font-size:22px;margin:0 0 12px';
  const message = document.createElement('p'); message.textContent = kind === 'updated' ? '¿Quieres enviar los cambios?' : '¿Quieres enviarlo ahora?';
  const confirm = document.createElement('button'), later = document.createElement('button');
  confirm.type = later.type = 'button';
  confirm.textContent = kind === 'updated' ? 'Reenviar checklist' : 'Enviar checklist';
  later.textContent = 'Seguir revisando';
  for (const button of [confirm, later]) button.style.cssText = 'display:block;width:100%;min-height:48px;padding:12px;margin-top:12px;border-radius:10px;font-size:17px;font-weight:800;border:2px solid #006477';
  confirm.style.background = '#006477'; confirm.style.color = '#fff';
  later.style.background = '#fff'; later.style.color = '#006477';
  const close = () => { dialog.close(); dialog.remove(); style.remove(); onClose(); };
  confirm.onclick = () => { close(); void send(); };
  later.onclick = close;
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.append(title, message, confirm, later); document.head.append(style); document.body.append(dialog); dialog.showModal();
  return close;
}
