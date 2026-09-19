// Deliberately local-only. No production activation flag or Supabase client.
export const DEMO_KEY = "cma_checklist_simulation_v1";
export const VEHICLE_TYPES = ["TSU", "TSNU", "Polivalente", "Logística"];
export const DEMO_ITEMS = ["Gasas (ejemplo)", "Guantes (ejemplo)", "Suero fisiológico (ejemplo)", "Vendas (ejemplo)"];
export const TSNU_CHECKLIST_GROUPS = [
  ["Maleta de intervención", ["Maleta de intervención precintada"]],
  ["Cajón n.º 1", ["DEA", "Mantas de un solo uso", "Sabanas de un solo uso"]],
  ["Cajón n.º 2", ["Contenedor de agujas grande", "Bolsas de vómito", "Sonda de aspiración", "Aspirador manual", "Empapadores"]],
  ["Cajón n.º 3", ["Cuña de hombre", "Cuña de mujer"]],
  ["Cajón n.º 4", ["Bata EPI o mono de protección", "Bolsas de residuos GII", "Bolsas de basura negras", "Gafas de protección EPI", "Guantes de protección EPI"]],
  ["Parte trasera del vehículo", ["Oxígeno disponible y con carga suficiente"]],
  ["Parte delantera del vehículo", ["Guantes de nitrilo de diferentes tallas", "Cadenas de nieve", "Cizallas", "Pata de cabra", "Tarjeta de gasóleo", "Tarjeta Trueta"]],
];
export const TSNU_CHECKLIST_ITEMS = TSNU_CHECKLIST_GROUPS.flatMap(([, items]) => items);
export const canDemoChecklist = (auth, unit) => Boolean(auth?.checked && auth?.enforcement && !auth?.authorized && unit && !/^Material supervisor/i.test(unit));
export const demoKey = (r) => JSON.stringify([r.lot, r.zone, r.unit, r.date, r.vehicleType || "TSU", r.sessionId || "legacy"]);
export const checklistItems = (record) => isDailyChecklist(record) ? TSNU_CHECKLIST_ITEMS : DEMO_ITEMS;
export function validDemoDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function inChecklistWindow(start, now) {
  const elapsed = new Date(now).getTime() - new Date(start).getTime();
  return elapsed >= 0 && elapsed < 2 * 60 * 60 * 1000;
}
export const isDailyChecklist = (record) => record.service === "TSNU" || record.vehicleType === "TSNU";
export function checklistStatus(record, now = new Date()) {
  const items = checklistItems(record);
  if (record.completed && items.every((m) => ["ok", "issue"].includes(record.answers?.[m])))
    return items.some((m) => record.answers[m] === "issue") ? "Incidencia" : "Correcto";
  if (isDailyChecklist(record)) {
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    return record.date < today ? "No realizado" : "Pendiente";
  }
  return record.phase === "closed" ? "No realizado" : "Pendiente";
}
export function readDemo(storage) {
  const raw = storage.getItem(DEMO_KEY);
  if (!raw) return [];
  const records = JSON.parse(raw);
  if (!Array.isArray(records) || records.some((r) => !r || !validDemoDate(r.date) || typeof r.unit !== "string" || !r.lot || !r.zone))
    throw new Error("No se pueden leer las pruebas guardadas. No se han sobrescrito.");
  return records;
}
export function saveDemo(storage, record) {
  if (!validDemoDate(record.date)) throw new Error("Selecciona una fecha válida.");
  const records = readDemo(storage);
  const next = records.filter((r) => demoKey(r) !== demoKey(record));
  next.push(record);
  storage.setItem(DEMO_KEY, JSON.stringify(next));
  return next;
}
export function completeDemo(record) {
  if (!isDailyChecklist(record) && record.phase !== "open") throw new Error("El checklist solo puede realizarse durante las dos primeras horas de la guardia.");
  if (!checklistItems(record).every((m) => ["ok", "issue"].includes(record.answers?.[m]))) throw new Error("Revisa todos los materiales antes de guardar.");
  return { ...record, completed: true, savedAt: new Date().toISOString(), startedAt: record.startedAt || new Date().toISOString() };
}
export function closeDemoShift(record, pendingMaterial = false) {
  if (!record?.completed) throw new Error("Primero debes enviar el checklist.");
  if (record.endedAt) throw new Error("Esta guardia ya está finalizada.");
  if (pendingMaterial) throw new Error("Envía el consumo o deja las cantidades a cero antes de finalizar.");
  return { ...record, endedAt: new Date().toISOString() };
}
export function filterDemo(records, { lot, zone, warehouse, from, to }) {
  if (!validDemoDate(from) || !validDemoDate(to) || from > to) throw new Error("Revisa el período seleccionado.");
  return records.filter((r) => (!lot || r.lot === lot) && (!zone || r.zone === zone) && (!warehouse || r.warehouse === warehouse) && r.date >= from && r.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.warehouse.localeCompare(b.warehouse) || a.unit.localeCompare(b.unit));
}
