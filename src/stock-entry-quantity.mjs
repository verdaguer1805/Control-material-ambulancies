// Keep an empty field while editing, but never accept fractional/negative stock.
export function stockEntryQuantity(text) {
  if (text === "") return "";
  if (!/^\d+$/.test(text)) return null;
  const quantity = Number(text);
  return Number.isSafeInteger(quantity) ? quantity : null;
}
