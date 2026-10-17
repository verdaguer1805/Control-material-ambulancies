// Keep historical stock keys stable; correct only the human-readable name.
export function materialDisplayName(value) {
  return String(value)
    .replace(/^Lancetas\s*\(\s*cajas?\s*\)/i, 'Lancetas (unidades)')
    .replace(/^Ap[oó]sito\s+7\s*[x×]\s*2[,.]5(?=$|\s|·)/i, 'Apósito 7,2x5');
}
