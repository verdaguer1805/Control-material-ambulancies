export const ASSIGNMENT_DEMO_KEY = "cma_checklist_assignment_demo_v1";
export const CHECKLIST_OPTIONS = {
  TSU: ["TSU", "Polivalente", "Logística"],
  TSNU: ["TSNU"],
};
// Compatibility rule for the prototype only. Never updates the real cma_unit keys.
export function resolveDemoAssignment(value) {
  const service = value.service || "TSU";
  if (!CHECKLIST_OPTIONS[service]) throw new Error("Tipo de servicio no válido");
  const checklist = value.checklist || (service === "TSNU" ? "TSNU" : "");
  if (checklist && !CHECKLIST_OPTIONS[service].includes(checklist)) throw new Error("Checklist incompatible con el servicio");
  return { ...value, service, checklist, shift: service === "TSNU" ? "" : value.shift, canConsume: service === "TSU" };
}
export function assignDemo(value) {
  const resolved=resolveDemoAssignment(value);
  if (!value.unit || !value.lot || !value.zone || !value.warehouse) throw new Error("Completa la asignación");
  if (resolved.service === "TSU" && !["07:00","08:00","09:00"].includes(value.shift)) throw new Error("Selecciona el horario de la TSU");
  if (!resolved.checklist) throw new Error("Selecciona un checklist");
  return resolved;
}
