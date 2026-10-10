import { SVB_CABIN_ITEMS, cabinStatus } from "./svb-cabin-data.js?v=223";
import { readSvbVehicleAssignment } from "./svb-vehicle-assignment.js?v=223";
const read = key => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; } };
const context = read("cma_svb_checklist_context_v1");
const scope = `${context.unit || "TSU"}:${context.guardCode || "guardia"}`;
const vehicle = readSvbVehicleAssignment(localStorage, context.unit, context.guardCode);
if (!context.unit || !context.guardCode || !vehicle) location.replace("./svb-zones.html?v=223");
const key = `cma_svb_cabin_wall_mobile_test_v1:${scope}:${vehicle}`;
let answers = read(key);
const byId = id => document.getElementById(id);
function save() { localStorage.setItem(key, JSON.stringify(answers)); render(); }
function mark(item, value) { answers[1] = { ...answers[1], [item]: value }; save(); }
function render() {
  const state = cabinStatus(answers);
  byId("state").textContent = state === "ok" ? "Cabina correcta" : state === "issue" ? "Cabina con incidencia" : "Faltan elementos por revisar";
  byId("all").textContent = state === "ok" ? "✓ Todo marcado como correcto" : "✓ Marcar todo correcto";
  byId("items").replaceChildren();
  for (const item of SVB_CABIN_ITEMS) {
    const value = answers[1]?.[item] || "", row = document.createElement("div");
    row.className = `item ${value}`;
    const title = document.createElement("strong"); title.textContent = item; row.append(title);
    const choices = document.createElement("div"); choices.className = "choices";
    for (const [status, label, css] of [["ok", "✓", "yes"], ["issue", "✕", "no"]]) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label;
      button.className = `${css} ${value === status ? "active" : ""}`;
      button.setAttribute("aria-label", `${status === "ok" ? "Correcto" : "Incidencia"}: ${item}`);
      button.setAttribute("aria-pressed", String(value === status)); button.onclick = () => mark(item, status);
      choices.append(button);
    }
    row.append(choices); byId("items").append(row);
  }
}
byId("all").onclick = () => { answers[1] = Object.fromEntries(SVB_CABIN_ITEMS.map(item => [item, "ok"])); save(); };
render();

