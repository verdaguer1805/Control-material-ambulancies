const sizes = { S: 0, M: 1, L: 2, XL: 3 };
const glove = (value) => /^(Guantes(?: estériles)?) (S|M|L|XL)(?: \(cajas?\))?$/i.exec(value);

export function compareMaterialLabels(a, b, label = (value) => value) {
  const ga = glove(a), gb = glove(b);
  const familyA = ga ? ga[1] : label(a);
  const familyB = gb ? gb[1] : label(b);
  return familyA.localeCompare(familyB, "es", { sensitivity: "base", numeric: true }) ||
    (ga && gb ? sizes[ga[2].toUpperCase()] - sizes[gb[2].toUpperCase()] : 0);
}
