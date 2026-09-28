export const SVB_LEFT_WALL_SECTIONS = [
  { id: 1, title: "Compartimento 1", items: ["Mantas de un solo uso", "Sabanas de un solo uso"] },
  { id: 2, title: "Compartimento 2", items: [
    "Mascarillas FFP2", "Mascarillas FFP3", "Mascarillas quirúrgicas",
    "Bata impermeable de un solo uso · talla S", "Bata impermeable de un solo uso · talla M",
    "Bata impermeable de un solo uso · talla L", "Bata impermeable de un solo uso · talla XL",
    "Bata impermeable de un solo uso · talla 2XL", "Bolsa de residuos GII",
    "Guantes de nitrilo sin polvo · talla S", "Guantes de nitrilo sin polvo · talla M",
    "Guantes de nitrilo sin polvo · talla L", "Guantes de nitrilo sin polvo · talla XL",
    "Guantes esteriles · talla S", "Guantes esteriles · talla M", "Guantes esteriles · talla L",
    "Cinta americana", "Cubrebotas"
  ] },
  { id: 3, title: "Compartimento 3", items: [
    "Chaqueta anticorte · talla S", "Chaqueta anticorte · talla M", "Chaqueta anticorte · talla L",
    "Chaqueta anticorte · talla XL", "Guantes anticorte · talla S", "Guantes anticorte · talla M",
    "Guantes anticorte · talla L", "Guantes anticorte · talla XL"
  ] },
  { id: 4, title: "Compartimento 4", items: ["Bolsa para objetos personales grande", "Bolsa para objetos personales pequeña"] },
  { id: 5, title: "Compartimento 5", items: [
    "Correas de anclaje de guias", "Correa para perro guia", "Kit antipinchazos",
    "Cadenas de nieve", "Conos de señalizacion",
    "Esparadrapo verde", "Esparadrapo amarillo", "Esparadrapo rojo", "Torniquete",
    "Canula Guedel nº 3", "Canula Guedel nº 4", "Chaleco responsable de aparcamiento de ambulancias K3",
    "Funda de casco K3", "Chaleco responsable sanitario K10", "Lanyards verdes",
    "Lanyards amarillos", "Lanyards rojos", "Lanyards negros"
  ] },
  { id: 7, title: "Compartimento 7", items: [
    "Empapador", "Toallas de papel", "Pañal", "Gorro para recien nacido", "Manta termica neonatal",
    "Pera de goma de aspiracion de 35 ml", "Gasas esteriles grandes", "Talla verde esteril",
    "Pinzas umbilicales", "Tijera umbilical de un solo uso", "Empapador del kit de parto",
    "Compresa posparto", "Bolsa para material de rechazo GII"
  ] },
  { id: 8, title: "Compartimento 8", items: [
    "Tensiometro digital", "Manguito infantil para tensiometro", "Equipo de infusion para seroterapia",
    "Detector de monoxido para alumno en practicas"
  ] },
  { id: 9, title: "Compartimento 9", items: [
    "Filtro para aspirador LSU", "Sonda de aspiracion controlada nº 6", "Sonda de aspiracion controlada nº 8",
    "Sonda de aspiracion controlada nº 10", "Sonda de aspiracion controlada nº 12",
    "Sonda de aspiracion controlada nº 14", "Sonda de aspiracion controlada nº 16",
    "Sonda de aspiracion controlada nº 18", "Canula Yankauer", "Bolsa de aspirador de un solo uso"
  ] }
];

export function sectionStatus(section, answers) {
  const values = section.items.map((item) => answers?.[section.id]?.[item]);
  if (!values.every((value) => value === "ok" || value === "issue")) return "pending";
  return values.includes("issue") ? "issue" : "ok";
}
