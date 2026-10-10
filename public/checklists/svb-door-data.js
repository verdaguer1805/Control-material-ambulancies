export const SVB_DOOR_SECTIONS = [
  { id: 1, title: "Compartimento 1", items: [
    "Base del inmovilizador de cabeza · 1 unidad",
    "Soportes laterales del inmovilizador de cabeza · 2 unidades",
    "Inmovilizador cervical y de columna pediátrico · 1 unidad",
    "Correas de camilla · 3 unidades",
    "Correas tipo araña · 1 unidad",
    "Sistema de retención infantil · 1 unidad",
    "Bolsa de contenciones para paciente agitado · 1 unidad",
    "Dispositivo de extracción de vehículos (Ferno) · 1 unidad",
    "Señal de punto de estacionamiento (trípode) · 1 unidad"
  ] },
  { id: 2, title: "Compartimento 2", items: [
    "Cizalla · 1 unidad", "Pata de cabra · 1 unidad", "Martillo rompecristales · 1 unidad"
  ] },
  { id: 3, title: "Compartimento 3 · Colchón de vacío", items: ["Colchón de vacío · 1 unidad"] },
  { id: 4, title: "Compartimento 4", items: ["Silla de evacuación · 1 unidad", "Botella de oxígeno 10 L · 2 unidades"] }
];

export function doorSectionStatus(section, answers) {
  const values = section.items.map(item => answers?.[section.id]?.[item]);
  if (!values.length || values.some(value => !["ok", "issue"].includes(value))) return "pending";
  return values.includes("issue") ? "issue" : "ok";
}

// An already submitted checklist keeps its original scope; new drafts require the door.
export function doorRequired(answers, confirmed) {
  return !confirmed || Object.keys(answers || {}).length > 0;
}
