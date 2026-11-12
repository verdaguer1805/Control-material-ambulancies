export function bpQuantityLabel(quantity) {
  if (quantity == null) return 'Cantidad pendiente de definir';
  const text = String(quantity).trim();
  return /^\d+$/.test(text) ? `${text} ${Number(text) === 1 ? 'unidad' : 'unidades'}` : text;
}
