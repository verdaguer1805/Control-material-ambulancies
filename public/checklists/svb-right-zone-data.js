export const SVB_RIGHT_ZONE_SECTIONS = [
  { id: 1, title: "Compartimento 1", items: ["Sábana de un solo uso · 5 unidades"] },
  { id: 2, title: "Compartimento 2", items: ["Guantes talla M · 1 caja", "Guantes talla L · 1 caja"] },
  { id: 3, title: "Compartimento 3", items: ["Suero fisiológico de irrigación 100 ml · 4 unidades", "Suero fisiológico de irrigación 250 ml · 2 unidades"] },
  { id: 4, title: "Compartimento 4", items: ["Gel hidroalcohólico 100 ml · 1 unidad", "Clorhexidina acuosa 2 % 100 ml · 5 unidades", "Suero fisiológico 5 ml · 10 unidades", "Contenedor de agujas pequeño · 1 unidad"] },
  { id: 5, title: "Compartimento 5", items: ["Venda de crepé 4 × 7 · 4 unidades", "Venda de crepé 10 × 10 · 4 unidades", "Venda de gasa 10 cm · 5 unidades", "Venda cohesiva 10 × 10 · 4 unidades", "Esparadrapo 5 × 2,5 · 4 unidades"] },
  { id: 6, title: "Compartimento 6", items: ["Gasa estéril 20 × 20 · 20 unidades", "Gasa estéril 40 × 20 · 20 unidades"] },
  { id: 8, title: "Compartimento 8", items: ["Talla verde estéril · 2 unidades", "Pinzas estériles · 2 unidades", "Tijeras estériles · 2 unidades", "Rasuradoras · 4 unidades"] },
  { id: 9, title: "Compartimento 9", items: ["Inmovilizador de hombro · 1 unidad", "Manta térmica · 4 unidades", "Tiras reactivas · 1 bote", "Lancetas · 20 unidades", "Termómetro digital · 1 unidad", "Sutura cutánea de papel 100 × 12 mm · 5 unidades", "Sutura cutánea de papel 100 × 6 mm · 5 unidades"] },
  { id: 10, title: "Compartimento 10", items: ["Apósito 7 × 2,5 · 4 unidades", "Apósito 10 × 8 · 4 unidades", "Apósito 20 × 8 · 4 unidades", "Bolsas de hielo · 4 unidades"] },
  { id: 11, title: "Compartimento 11", items: ["Cuña de cartón de un solo uso · 1 unidad", "Botella de cartón de un solo uso · 1 unidad", "Bolsa de basura · 1 paquete", "Bolsa para residuos GII · 1 rollo"] },
  { id: 12, title: "Seguridad y balizamiento", items: ["Extintor · 1 unidad", "Cinta de balizar · 1 unidad"] },
];

export function rightZoneStatus(section, answers) {
  const values = section.items.map((item) => answers?.[section.id]?.[item]);
  if (!values.length || !values.every((value) => value === "ok" || value === "issue")) return "pending";
  return values.includes("issue") ? "issue" : "ok";
}
