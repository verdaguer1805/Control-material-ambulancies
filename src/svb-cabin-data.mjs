export const SVB_CABIN_ITEMS = [
  "Baliza V-16 · 1 unidad",
  "Chaleco reflectante · 1 unidad",
  "Cargador base Sepura · 2 unidades",
  "Batería de repuesto Sepura · 2 unidades",
  "Cargador de 12 V Sepura · 1 unidad",
  "Linterna con cono · 1 unidad",
  "Casco · 3 unidades",
  "Tarjeta de repostaje · 1 unidad",
  "Carpeta con toda la documentación del vehículo",
  "Cable cargador de tablet · 1 unidad",
  "Detector de monóxido · 2 unidades"
];

export function cabinStatus(answers) {
  const values = SVB_CABIN_ITEMS.map(item => answers?.[1]?.[item]);
  if (!values.every(value => value === "ok" || value === "issue")) return "pending";
  return values.includes("issue") ? "issue" : "ok";
}

