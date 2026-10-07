export const SVB_LEFT_WALL_SECTIONS = [
  { id: 1, title: "Compartimento 1", items: ["Mantas de un solo uso · 5 unidades", "Sabanas de un solo uso · 5 unidades"] },
  { id: 2, title: "Compartimento 2", items: [
    "Mascarillas FFP2 · 6 unidades", "Mascarillas FFP3 · 6 unidades", "Mascarillas quirúrgicas · 5 unidades",
    "Bata impermeable de un solo uso · talla S · 1 unidad", "Bata impermeable de un solo uso · talla M · 1 unidad",
    "Bata impermeable de un solo uso · talla L · 1 unidad", "Bata impermeable de un solo uso · talla XL · 1 unidad",
    "Bata impermeable de un solo uso · talla 2XL · 1 unidad", "Bolsa de residuos GII",
    "Guantes de nitrilo sin polvo · talla S", "Guantes de nitrilo sin polvo · talla M",
    "Guantes de nitrilo sin polvo · talla L", "Guantes de nitrilo sin polvo · talla XL",
    "Guantes esteriles · talla S · 1 par", "Guantes esteriles · talla M · 1 par", "Guantes esteriles · talla L · 1 par",
    "Cinta americana · 1 unidad", "Cubrebotas · 2 unidades"
  ] },
  { id: 3, title: "Compartimento 3", items: [
    "Chaqueta anticorte · talla S · 1 unidad", "Chaqueta anticorte · talla M · 1 unidad", "Chaqueta anticorte · talla L · 1 unidad",
    "Chaqueta anticorte · talla XL · 1 unidad", "Guantes anticorte · 3 pares"
  ] },
  { id: 4, title: "Compartimento 4", items: ["Bolsa para objetos personales grande · 5 unidades", "Bolsa para objetos personales pequeña · 5 unidades", "Colchón de vacío pediátrico · 1 unidad"] },
  { id: 5, title: "Compartimento 5", items: [
    "Correas de anclaje de guias · 2 unidades", "Correa para perro guia · 1 unidad", "Kit antipinchazos · 1 unidad",
    "Cadenas de nieve · 2 unidades", "Spray verde · 1 unidad",
    "Spray amarillo · 1 unidad", "Spray rojo · 1 unidad", "Bolsa IMA",
    "Bolsa IMA — Torniquete · 2 unidades",
    "Bolsa IMA — Cánula Guedel nº 3 · 2 unidades", "Bolsa IMA — Cánula Guedel nº 4 · 2 unidades",
    "Bolsa IMA — Chaleco responsable de aparcamiento de ambulancias (K3) · 1 unidad",
    "Bolsa IMA — Funda de casco K3 · 1 unidad", "Bolsa IMA — Chaleco responsable sanitario (K0) · 1 unidad",
    "Bolsa IMA — Lanyards verdes · 20 unidades", "Bolsa IMA — Lanyards amarillos · 10 unidades",
    "Bolsa IMA — Lanyards rojos · 10 unidades", "Bolsa IMA — Lanyards negros · 5 unidades"
  ] },
  { id: 7, title: "Compartimento 7", items: [
    "Empapador", "Toallas de papel", "Pañal · 1 unidad", "Gorro para recien nacido · 1 unidad", "Manta termica neonatal · 1 unidad",
    "Pera de goma de aspiracion de 35 ml · 1 unidad", "Gasas esteriles grandes · 2 unidades", "Talla verde esteril · 1 unidad",
    "Pinzas umbilicales · 2 unidades", "Tijera umbilical de un solo uso · 1 unidad", "Empapador del kit de parto · 1 unidad",
    "Compresa posparto · 1 unidad", "Bolsa para material de rechazo GII · 1 unidad"
  ] },
  { id: 8, title: "Compartimento 8", items: [
    "Tensiometro digital · 1 unidad", "Manguito infantil para tensiometro · 1 unidad", "Equipo de infusion para seroterapia · 1 unidad",
    "Detector de monoxido para alumno en practicas · 1 unidad", "Manguito adulto 42–57 cm para tensiómetro · 1 unidad"
  ] },
  { id: 9, title: "Compartimento 9", items: [
    "Sonda de aspiracion controlada nº 6 · 2 unidades", "Sonda de aspiracion controlada nº 8 · 2 unidades",
    "Sonda de aspiracion controlada nº 10 · 2 unidades", "Sonda de aspiracion controlada nº 12 · 2 unidades",
    "Sonda de aspiracion controlada nº 14 · 2 unidades", "Sonda de aspiracion controlada nº 16 · 2 unidades",
    "Sonda de aspiracion controlada nº 18 · 2 unidades", "Canula Yankauer · 3 unidades", "Bolsa de aspirador de un solo uso · 3 unidades"
  ] },
  { id: 10, title: "Bolsa de férulas", items: [
    "Férula Kramer · 3 unidades", "Funda para férula Kramer · 3 unidades",
    "Férula maleable digital · 2 unidades", "Férula maleable braquial · 2 unidades"
  ] }
];

export function sectionStatus(section, answers) {
  const values = section.items.map((item) => answers?.[section.id]?.[item]);
  if (!values.every((value) => value === "ok" || value === "issue")) return "pending";
  return values.includes("issue") ? "issue" : "ok";
}
