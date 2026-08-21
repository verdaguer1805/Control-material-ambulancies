import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
const FALCK_PDF_LOGO =
  "data:image/png;base64,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";
import {
  UNITS,
  SUPERVISIONS,
  LOTS,
  MATERIALS,
  CRITICAL_KEYWORDS,
  SUPERVISOR_ONLY_MATERIALS,
} from "./data";
import {
  ensureAnonymousSession,
  hasSupabaseConnection,
  supabase,
} from "./supabase";
import "./styles.css";
import "./material-selection.css";
import "./stock-demo.css";
const KEY = {
  unit: "cma_unit",
  lot: "cma_lot",
  shift: "cma_shift_start",
  records: "cma_records",
};
const STOCK_DEMO_KEY = "cma_stock_demo_olot_v1";
const STOCK_DEMO_CENTRAL = "Almacén central Olot";
const STOCK_DEMO_LOCATIONS = [
  STOCK_DEMO_CENTRAL,
  "Subalmacén Olot",
  "Subalmacén Banyoles",
  "Subalmacén Campdevànol",
  "Subalmacén Camprodon",
  "Subalmacén Sant Joan de les Abadesses",
];
const STOCK_DEMO_MATERIALS = [
  "Guantes M (caja)",
  "Suero fisiológico 250 ml",
  "Empapador",
  "Venda crep 10cm x 4m",
  "Lancetas (caja)",
  "Pañuelos de papel (caja)",
];
const STOCK_DEMO_UNITS = {
  G205: "Subalmacén Olot",
  G450: "Subalmacén Olot",
  G451: "Subalmacén Olot",
  BP52: "Subalmacén Olot",
  G413: "Subalmacén Banyoles",
  G215: "Subalmacén Campdevànol",
  G452: "Subalmacén Campdevànol",
  G453: "Subalmacén Camprodon",
  G305: "Subalmacén Sant Joan de les Abadesses",
  "Material supervisor Olot": STOCK_DEMO_CENTRAL,
};
const createStockDemo = () => ({
  levels: {
    [STOCK_DEMO_CENTRAL]: {
      "Guantes M (caja)": 50,
      "Suero fisiológico 250 ml": 80,
      Empapador: 40,
      "Venda crep 10cm x 4m": 30,
      "Lancetas (caja)": 15,
      "Pañuelos de papel (caja)": 20,
    },
    "Subalmacén Olot": {
      "Guantes M (caja)": 12,
      "Suero fisiológico 250 ml": 18,
      Empapador: 10,
      "Venda crep 10cm x 4m": 8,
      "Lancetas (caja)": 4,
      "Pañuelos de papel (caja)": 5,
    },
    "Subalmacén Banyoles": {
      "Guantes M (caja)": 8,
      "Suero fisiológico 250 ml": 12,
      Empapador: 6,
      "Venda crep 10cm x 4m": 5,
      "Lancetas (caja)": 3,
      "Pañuelos de papel (caja)": 4,
    },
    "Subalmacén Campdevànol": {
      "Guantes M (caja)": 10,
      "Suero fisiológico 250 ml": 14,
      Empapador: 7,
      "Venda crep 10cm x 4m": 6,
      "Lancetas (caja)": 3,
      "Pañuelos de papel (caja)": 4,
    },
    "Subalmacén Camprodon": {
      "Guantes M (caja)": 6,
      "Suero fisiológico 250 ml": 8,
      Empapador: 4,
      "Venda crep 10cm x 4m": 4,
      "Lancetas (caja)": 2,
      "Pañuelos de papel (caja)": 3,
    },
    "Subalmacén Sant Joan de les Abadesses": {
      "Guantes M (caja)": 7,
      "Suero fisiológico 250 ml": 9,
      Empapador: 5,
      "Venda crep 10cm x 4m": 4,
      "Lancetas (caja)": 2,
      "Pañuelos de papel (caja)": 3,
    },
  },
  movements: [
    {
      at: "Datos ficticios",
      type: "Inventario inicial",
      detail: "Piloto de Supervisión Olot",
    },
  ],
});
const getStockDemo = () => {
  try {
    return JSON.parse(localStorage.getItem(STOCK_DEMO_KEY)) || createStockDemo();
  } catch {
    return createStockDemo();
  }
};
const nowParts = () => {
  const d = new Date(),
    p = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
};
const isSupervisorMaterial = (u) =>
  /^SUPERVISOR_/i.test(String(u || "")) ||
  /^Material supervisor(?:\s*·|$)/i.test(String(u || ""));
const supervisorZone = (u) =>
  u.replace("SUPERVISOR_", "").charAt(0) +
  u.replace("SUPERVISOR_", "").slice(1).toLowerCase();
const sortUnits = (units) =>
  Object.keys(units).sort((a, b) =>
    isSupervisorMaterial(a)
      ? 1
      : isSupervisorMaterial(b)
        ? -1
        : units[a].localeCompare(units[b]),
  );
const unitZone = (u) =>
  isSupervisorMaterial(u)
    ? supervisorZone(u)
    : Object.keys(SUPERVISIONS).find((z) =>
        Object.hasOwn(SUPERVISIONS[z], u),
      ) || "";
const recordZone = (r) => {
  const match = /^Material supervisor · (.+)$/i.exec(r.unit);
  if (!match) return unitZone(r.unit);
  const zone = match[1].trim();
  return (
    Object.keys(SUPERVISIONS).find(
      (name) => name.toLowerCase() === zone.toLowerCase(),
    ) || zone
  );
};
const displayUnit = (u) =>
  isSupervisorMaterial(u) ? `Material Supervisor · ${supervisorZone(u)}` : u;
const unitWarehouse = (u) =>
  isSupervisorMaterial(u)
    ? supervisorZone(u)
    : Object.values(SUPERVISIONS).find((units) => Object.hasOwn(units, u))?.[
        u
      ] || "";
const reportWarehouse = (w) =>
  String(w || "Sin almacén").replace(/^Supervisi\u00f3\s+/, "");
const getRecords = () => JSON.parse(localStorage.getItem(KEY.records) || "[]");
const saveRecords = (v) => localStorage.setItem(KEY.records, JSON.stringify(v));
const isCritical = (name) => {
  const n = name.toLowerCase();
  return CRITICAL_KEYWORDS.some((k) => n.includes(k));
};
const aggregate = (r) => {
  const o = {};
  (r.entries || []).forEach((e) =>
    Object.entries(e.materials || {}).forEach(
      ([m, n]) => (o[m] = (o[m] || 0) + Number(n)),
    ),
  );
  return o;
};
const recordCritical = (r) => Object.keys(aggregate(r)).some(isCritical);
function App() {
  const [mode, setMode] = useState(
      location.hash === "#admin" ? "admin" : "worker",
    ),
    [unit, setUnit] = useState(localStorage.getItem(KEY.unit) || ""),
    [lot, setLot] = useState(
      localStorage.getItem(KEY.lot) || "Lot 5 · Girona - Alt Maresme",
    ),
    [pinInput, setPinInput] = useState(""),
    [adminOk, setAdminOk] = useState(false),
    [incident, setIncident] = useState(""),
    [incidentConfirmed, setIncidentConfirmed] = useState(false),
    [search, setSearch] = useState(""),
    [quantities, setQuantities] = useState({}),
    [clock, setClock] = useState(nowParts()),
    [records, setRecords] = useState(getRecords()),
    [adminRecords, setAdminRecords] = useState([]),
    [adminLoaded, setAdminLoaded] = useState(false),
    [reportLoading, setReportLoading] = useState(false),
    [duplicateOpen, setDuplicateOpen] = useState(false),
    [conflictOpen, setConflictOpen] = useState(false),
    [conflictRecordId, setConflictRecordId] = useState(""),
    [conflictNewId, setConflictNewId] = useState(""),
    [missingIncidentOpen, setMissingIncidentOpen] = useState(false),
    [invalidIncidentOpen, setInvalidIncidentOpen] = useState(false),
    [pinDeniedOpen, setPinDeniedOpen] = useState(false),
    [coverageEditOpen, setCoverageEditOpen] = useState(false),
    [coverageCheckingOpen, setCoverageCheckingOpen] = useState(false),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState("draft"),
    sentScrollRef = React.useRef(null),
    [syncing, setSyncing] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [exportLotOpen, setExportLotOpen] = useState(false),
    [exportLot, setExportLot] = useState("Lot 5 · Girona - Alt Maresme"),
    [exportZoneOpen, setExportZoneOpen] = useState(false),
    [exportZone, setExportZone] = useState(""),
    [exportFrom, setExportFrom] = useState(""),
    [exportTo, setExportTo] = useState(""),
    [changeUnitOpen, setChangeUnitOpen] = useState(false),
    [changeUnitPin, setChangeUnitPin] = useState(""),
    [nextUnit, setNextUnit] = useState(""),
    [changeZone, setChangeZone] = useState(""),
    [changeLot, setChangeLot] = useState(""),
    [zoneOpen, setZoneOpen] = useState(false),
    [selectedZone, setSelectedZone] = useState(""),
    [selectedLot, setSelectedLot] = useState(""),
    [selectedShiftStart, setSelectedShiftStart] = useState(""),
    [changeShiftStart, setChangeShiftStart] = useState(""),
    [shiftPickerOpen, setShiftPickerOpen] = useState(false),
    [shiftPickerTarget, setShiftPickerTarget] = useState(""),
    [editingRecord, setEditingRecord] = useState(null),
    [stockDemoOpen, setStockDemoOpen] = useState(false),
    [stockDemo, setStockDemo] = useState(getStockDemo),
    [stockDemoLocation, setStockDemoLocation] = useState(STOCK_DEMO_CENTRAL),
    [stockDemoMaterial, setStockDemoMaterial] = useState(STOCK_DEMO_MATERIALS[0]),
    [stockDemoQuantity, setStockDemoQuantity] = useState(1),
    [stockDemoTarget, setStockDemoTarget] = useState("Subalmacén Camprodon"),
    [stockDemoUnit, setStockDemoUnit] = useState("G453");
  React.useEffect(() => {
    const h = () => {
      const next = location.hash === "#admin" ? "admin" : "worker";
      setMode(next);
      setPinInput("");
      setAdminOk(false);
      if (next === "admin") {
        setAdminRecords([]);
        setAdminLoaded(false);
      }
    };
    addEventListener("hashchange", h);
    return () => removeEventListener("hashchange", h);
  }, []);
  React.useEffect(() => {
    if (status !== "sent") return;
    const lockedY = sentScrollRef.current,
      keepPosition = () => {
        if (lockedY !== null && Math.abs(window.scrollY - lockedY) > 2)
          window.scrollTo(0, lockedY);
      };
    addEventListener("scroll", keepPosition, { passive: true });
    const timer = setTimeout(() => {
      removeEventListener("scroll", keepPosition);
      sentScrollRef.current = null;
      setStatus("draft");
      setIncident("");
      setIncidentConfirmed(false);
      setQuantities({});
      setSearch("");
      setClock(nowParts());
      setTimeout(() => {
        const root = document.scrollingElement;
        if (root) root.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 20);
    }, 2000);
    return () => {
      removeEventListener("scroll", keepPosition);
      clearTimeout(timer);
    };
  }, [status]);
  React.useEffect(() => {
    const retry = () => syncPending();
    addEventListener("online", retry);
    return () => removeEventListener("online", retry);
  }, []);
  const flash = (m, duration = 2000) => {
      setMessage(m);
      setTimeout(() => setMessage(""), duration);
    },
    duplicateIncident = () => {
      setIncident("");
      setIncidentConfirmed(false);
      setStatus("draft");
      setDuplicateOpen(true);
    },
    missingIncident = () => setMissingIncidentOpen(true),
    invalidIncident = () => {
      setIncidentConfirmed(false);
      setInvalidIncidentOpen(true);
    };
  const editDeadline = (record) => {
    const start = localStorage.getItem(KEY.shift);
    if (!/^(07|08|09):00$/.test(start || "")) return null;
    const original = new Date(`${record.date}T${record.time}`),
      deadline = new Date(original),
      hour = Number(start.slice(0, 2));
    deadline.setHours(hour, 0, 0, 0);
    if (original >= deadline) deadline.setDate(deadline.getDate() + 1);
    return deadline;
  };
  async function startEdit() {
    const currentUnit = localStorage.getItem(KEY.unit);
    if (!currentUnit || isSupervisorMaterial(currentUnit))
      return flash("Esta opción solo está disponible para unidades");
    setCoverageCheckingOpen(true);
    const hasCoverage = await hasSupabaseConnection();
    setCoverageCheckingOpen(false);
    if (!hasCoverage) return showCoverageRequired();
    if (!/^\d{9}$/.test(incident.trim())) return invalidIncident();
    const record = getRecords().find(
      (r) => r.id === incident.trim() && r.unit === currentUnit,
    );
    if (!record)
      return flash("No se ha encontrado esta incidencia en este móvil");
    if (!record.synced)
      return flash("Primero sincroniza la incidencia antes de modificarla");
    const deadline = editDeadline(record);
    if (!deadline)
      return flash(
        "Configura la hora de inicio de guardia al asignar la unidad",
      );
    if (Date.now() > deadline.getTime())
      return flash("El plazo de modificación de esta incidencia ha terminado");
    const loaded = aggregate(record);
    if (!Object.keys(loaded).length)
      return flash("Esta incidencia no tiene material guardado para modificar");
    setQuantities(loaded);
    setIncident(record.id);
    setIncidentConfirmed(true);
    setEditingRecord(record.createdAt);
    setSearch("");
    setStatus("draft");
    flash("Incidencia cargada para modificar");
  }
  function correctPendingId() {
    const next = conflictNewId.replace(/\D/g, "").slice(0, 9);
    if (!/^\d{9}$/.test(next)) return invalidIncident();
    let list = getRecords(),
      record = list.find((r) => r.createdAt === conflictRecordId);
    if (!record) return flash("No se ha encontrado el registro pendiente");
    if (record.id === next) return flash("Introduce un ID diferente");
    if (
      list.some((r) => r !== record && r.id === next && r.unit === record.unit)
    )
      return flash("Este ID ya existe en este móvil");
    record.id = next;
    record.conflict = false;
    record.synced = false;
    saveRecords(list);
    setRecords([...list]);
    setConflictOpen(false);
    setConflictRecordId("");
    setConflictNewId("");
    flash("ID corregido. Pulsa Sincronizar pendientes");
  }
  function showCoverageRequired() {
    setCoverageEditOpen(true);
    setTimeout(() => setCoverageEditOpen(false), 2000);
  }
  function denyPin(changeUnit = false) {
    setPinDeniedOpen(true);
    setTimeout(() => {
      setPinDeniedOpen(false);
      setPinInput("");
      if (changeUnit) {
        setChangeUnitPin("");
        setChangeZone("");
        setNextUnit("");
        setChangeUnitOpen(false);
      }
    }, 2000);
  }
  async function verifyAdminPin(value) {
    try {
      await ensureAnonymousSession();
      const { data, error } = await supabase.rpc("verify_admin_pin", {
        input_pin: value,
      });
      if (error) throw error;
      return data === true;
    } catch (error) {
      flash("No se puede verificar el PIN ahora");
      return null;
    }
  }
  async function verifyOwnerCode(value) {
    try {
      await ensureAnonymousSession();
      const { data, error } = await supabase.rpc("verify_owner_code", {
        input_owner_code: value,
      });
      if (error) throw error;
      return data === true;
    } catch (error) {
      flash("No se puede verificar la clave exclusiva ahora");
      return null;
    }
  }
  async function openZoneSelector() {
    const enteredPin = pinInput;
    setPinInput("");
    const valid = await verifyAdminPin(enteredPin);
    if (valid !== true) {
      if (valid === false) denyPin(false);
      return;
    }
    if (!selectedLot) return flash("Selecciona un lote");
    if (!Object.keys(LOTS[selectedLot] || {}).length)
      return flash("Este lote todavía no tiene supervisiones configuradas");
    setZoneOpen(true);
  }
  function saveUnit() {
    if (!unit) return flash("Selecciona una unidad");
    if (
      !isSupervisorMaterial(unit) &&
      !/^(07|08|09):00$/.test(selectedShiftStart)
    )
      return flash("Selecciona la hora de inicio de guardia");
    localStorage.setItem(KEY.unit, unit);
    localStorage.setItem(KEY.lot, selectedLot);
    localStorage.setItem(
      KEY.shift,
      isSupervisorMaterial(unit) ? "" : selectedShiftStart,
    );
    setLot(selectedLot);
    setPinInput("");
    flash("Móvil asignado correctamente");
  }
  const filtered = useMemo(
    () =>
      MATERIALS.filter(
        (m) =>
          (isSupervisorMaterial(unit) ||
            !SUPERVISOR_ONLY_MATERIALS.some(
              (x) => x.toLowerCase() === m.toLowerCase(),
            )) &&
          m.toLowerCase().includes(search.toLowerCase()),
      ).sort((a, b) => {
        const ga = /^(Guantes(?: estériles)?) (S|M|L|XL)$/.exec(a),
          gb = /^(Guantes(?: estériles)?) (S|M|L|XL)$/.exec(b),
          sa = /^Sonda de aspiración (\d+)$/.exec(a),
          sb = /^Sonda de aspiración (\d+)$/.exec(b),
          sfa = /^Suerofisiológico(\d+)ml$/i.exec(a.replace(/\s+/g, "")),
          sfb = /^Suerofisiológico(\d+)ml$/i.exec(b.replace(/\s+/g, "")),
          eca = /^Cable ECG (\d+) derivadas$/i.exec(a),
          ecb = /^Cable ECG (\d+) derivadas$/i.exec(b),
          apa = /^Apósito (\d+)x(\d+(?:,\d+)?)$/i.exec(a),
          apb = /^Apósito (\d+)x(\d+(?:,\d+)?)$/i.exec(b),
          bopa = /^Bolsas de objetos personales SEM (pequeñas|grandes)$/i.exec(
            a,
          ),
          bopb = /^Bolsas de objetos personales SEM (pequeñas|grandes)$/i.exec(
            b,
          ),
          ma = /^Mascarilla ambu (0|0a|2|3\/4|5|6)$/i.exec(a),
          mb = /^Mascarilla ambu (0|0a|2|3\/4|5|6)$/i.exec(b),
          sizes = { S: 0, M: 1, L: 2, XL: 3 },
          bagSizes = { pequeñas: 0, grandes: 1 },
          maskSizes = { 0: 0, "0a": 1, 2: 2, "3/4": 3, 5: 4, 6: 5 };
        return ga && gb && ga[1] === gb[1]
          ? sizes[ga[2]] - sizes[gb[2]]
          : sa && sb
            ? Number(sa[1]) - Number(sb[1])
            : sfa && sfb
              ? Number(sfa[1]) - Number(sfb[1])
              : eca && ecb
                ? Number(eca[1]) - Number(ecb[1])
                : apa && apb
                  ? Number(apa[1]) - Number(apb[1]) ||
                    Number(apa[2].replace(",", ".")) -
                      Number(apb[2].replace(",", "."))
                  : bopa && bopb
                    ? bagSizes[bopa[1].toLowerCase()] -
                      bagSizes[bopb[1].toLowerCase()]
                    : ma && mb
                      ? maskSizes[ma[1].toLowerCase()] -
                        maskSizes[mb[1].toLowerCase()]
                      : a.localeCompare(b, "es", {
                          sensitivity: "base",
                          numeric: true,
                        });
      }),
    [search, unit],
  );
  const inc = (m) => setQuantities((q) => ({ ...q, [m]: (q[m] || 0) + 1 }));
  const dec = (m) =>
    setQuantities((q) => ({ ...q, [m]: Math.max(0, (q[m] || 0) - 1) }));
  async function confirmIncident() {
    if (!incident.trim()) return flash("Falta el ID DE INCIDENCIA");
    if (!/^\d{9}$/.test(incident.trim())) return invalidIncident();
    const currentUnit = localStorage.getItem(KEY.unit);
    if (!currentUnit)
      return flash("Primero hay que asignar el móvil a una unidad");
    if (!isSupervisorMaterial(currentUnit)) {
      if (
        getRecords().some(
          (r) => r.id === incident.trim() && r.unit === currentUnit,
        )
      )
        return duplicateIncident();
      if (!navigator.onLine) {
        setIncidentConfirmed(true);
        document.activeElement?.blur();
        return;
      }
      try {
        await ensureAnonymousSession();
        const { data, error } = await supabase
          .from("incidents")
          .select("id")
          .eq("incident_code", incident.trim())
          .eq("unit", displayUnit(currentUnit))
          .limit(1);
        if (error) throw error;
        if (data?.length) return duplicateIncident();
      } catch (error) {
        flash("No se puede comprobar ahora; se verificará al enviar");
      }
    }
    setIncidentConfirmed(true);
    document.activeElement?.blur();
  }
  async function submit(noMaterial = false) {
    const currentUnit = localStorage.getItem(KEY.unit),
      supervisorMode = isSupervisorMaterial(currentUnit),
      id = supervisorMode ? "000000" : incident.trim();
    if (!id) return missingIncident();
    if (!supervisorMode && !incidentConfirmed)
      return flash("Confirma el ID DE INCIDENCIA con el botón OK");
    if (!currentUnit)
      return flash("Primero hay que asignar el móvil a una unidad");
    const used = noMaterial
      ? {}
      : Object.fromEntries(Object.entries(quantities).filter(([, n]) => n > 0));
    let list = getRecords(),
      rec = list.find((r) => r.id === id && r.unit === currentUnit);
    if (editingRecord) {
      rec = list.find(
        (r) =>
          r.createdAt === editingRecord &&
          r.id === id &&
          r.unit === currentUnit,
      );
      if (!rec) {
        setEditingRecord(null);
        return flash("No se ha encontrado la incidencia para modificar");
      }
      if (!rec.synced)
        return flash("Primero sincroniza la incidencia antes de modificarla");
      const hasCoverage = await hasSupabaseConnection();
      if (!hasCoverage) return showCoverageRequired();
      const deadline = editDeadline(rec);
      if (!deadline)
        return flash(
          "Configura la hora de inicio de guardia al asignar la unidad",
        );
      if (Date.now() > deadline.getTime())
        return flash(
          "El plazo de modificación de esta incidencia ha terminado",
        );
      const updatedAt = new Date().toISOString(),
        nextEntries = [
          {
            createdAt: rec.entries?.[0]?.createdAt || rec.createdAt,
            materials: used,
          },
        ];
      try {
        await ensureAnonymousSession();
        const { error } = await supabase
          .from("incidents")
          .update({ materials: used, updated_at: updatedAt })
          .eq("incident_code", id)
          .eq("unit", displayUnit(currentUnit));
        if (error) throw error;
        rec.entries = nextEntries;
        rec.updatedAt = updatedAt;
        rec.synced = true;
        rec.pendingUpdate = false;
        saveRecords(list);
        setRecords([...list]);
        setEditingRecord(null);
        sentScrollRef.current = window.scrollY;
        setStatus("sent");
      } catch (error) {
        flash(
          "No se ha podido modificar: comprueba la cobertura e inténtalo de nuevo",
        );
      }
      return;
    }
    if (rec && !supervisorMode) return duplicateIncident();
    const entry = { createdAt: new Date().toISOString(), materials: used };
    if (rec && supervisorMode) {
      rec.entries.push(entry);
      rec.updatedAt = new Date().toISOString();
    } else {
      rec = {
        id,
        unit: currentUnit,
        warehouse: unitWarehouse(currentUnit),
        date: clock.date,
        time: clock.time,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entries: [entry],
        synced: false,
      };
      list.push(rec);
    }
    saveRecords(list);
    setRecords([...list]);
    if (!navigator.onLine) {
      rec.synced = false;
      saveRecords(list);
      setRecords([...list]);
      setStatus("queued");
      flash("Sin cobertura: registro guardado en el móvil");
      setIncident("");
      setIncidentConfirmed(false);
      setQuantities({});
      setSearch("");
      setClock(nowParts());
      return;
    }
    try {
      await ensureAnonymousSession();
      const remoteUnit = displayUnit(currentUnit);
      if (!supervisorMode) {
        const { data: existing, error: checkError } = await supabase
          .from("incidents")
          .select("id")
          .eq("incident_code", id)
          .eq("unit", remoteUnit)
          .limit(1);
        if (checkError) throw checkError;
        if (existing?.length) {
          list = list.filter((item) => item !== rec);
          saveRecords(list);
          setRecords([...list]);
          return duplicateIncident();
        }
      }
      const occurredAt = new Date(`${clock.date}T${clock.time}`).toISOString(),
        { error } = await supabase
          .from("incidents")
          .insert({
            incident_code: id,
            unit: remoteUnit,
            warehouse: unitWarehouse(currentUnit),
            occurred_at: occurredAt,
            materials: used,
          });
      if (error) throw error;
      rec.synced = true;
      saveRecords(list);
      setRecords([...list]);
      sentScrollRef.current = window.scrollY;
      setStatus("sent");
    } catch (error) {
      rec.synced = false;
      saveRecords(list);
      setRecords([...list]);
      setStatus("queued");
      flash("Sin cobertura: registro guardado en el móvil");
      setIncident("");
      setIncidentConfirmed(false);
      setQuantities({});
      setSearch("");
      setClock(nowParts());
    }
  }
  async function syncPending() {
    if (syncing) return;
    let list = getRecords(),
      todo = list.filter((r) => !r.synced);
    if (!todo.length) return flash("No hay registros pendientes");
    setSyncing(true);
    try {
      await ensureAnonymousSession();
      let conflict = null;
      for (const rec of todo) {
        if (rec.conflict) {
          conflict = conflict || rec;
          continue;
        }
        if (rec.pendingUpdate) {
          const remoteUnit = displayUnit(rec.unit),
            { error } = await supabase
              .from("incidents")
              .update({
                materials: aggregate(rec),
                updated_at: rec.updatedAt || new Date().toISOString(),
              })
              .eq("incident_code", rec.id)
              .eq("unit", remoteUnit);
          if (error) throw error;
          rec.pendingUpdate = false;
          rec.synced = true;
          continue;
        }
        let synced = true;
        for (const entry of rec.entries || []) {
          const remoteUnit = displayUnit(rec.unit);
          if (!isSupervisorMaterial(rec.unit)) {
            const { data: existing, error: checkError } = await supabase
              .from("incidents")
              .select("id")
              .eq("incident_code", rec.id)
              .eq("unit", remoteUnit)
              .limit(1);
            if (checkError) throw checkError;
            if (existing?.length) {
              rec.conflict = true;
              rec.synced = false;
              conflict = conflict || rec;
              synced = false;
              break;
            }
          }
          const occurredAt =
              entry.createdAt ||
              new Date(`${rec.date}T${rec.time}`).toISOString(),
            { error } = await supabase
              .from("incidents")
              .insert({
                incident_code: rec.id,
                unit: remoteUnit,
                warehouse: rec.warehouse || unitWarehouse(rec.unit),
                occurred_at: occurredAt,
                materials: entry.materials || {},
              });
          if (error) throw error;
        }
        if (synced) rec.synced = true;
      }
      saveRecords(list);
      setRecords([...list]);
      if (conflict) {
        setConflictRecordId(conflict.createdAt);
        setConflictNewId(conflict.id);
        setConflictOpen(true);
        flash("Hay un ID duplicado pendiente de corregir");
      } else flash("Registros pendientes sincronizados");
    } catch (error) {
      saveRecords(list);
      setRecords([...list]);
      flash("No se han podido sincronizar: comprueba la cobertura");
    } finally {
      setSyncing(false);
    }
  }
  async function adminLogin() {
    const valid = await verifyAdminPin(pinInput);
    if (valid !== true) {
      if (valid === false) flash("PIN incorrecto");
      return;
    }
    setAdminRecords([]);
    setAdminLoaded(false);
    setAdminOk(true);
    setPinInput("");
  }
  const mapAdminRecords = (data) =>
    data.map((r) => {
      const d = new Date(r.occurred_at);
      return {
        id: r.incident_code,
        unit: r.unit,
        warehouse: r.warehouse,
        date: d.toISOString().slice(0, 10),
        time: d.toTimeString().slice(0, 5),
        createdAt: r.created_at,
        updatedAt: r.created_at,
        entries: [{ createdAt: r.created_at, materials: r.materials || {} }],
        synced: true,
      };
    });
  async function loadSelectedAdminRecords() {
    const units = Object.keys(SUPERVISIONS[exportZone] || {}),
      ambulances = units
        .filter((u) => !isSupervisorMaterial(u))
        .map(displayUnit),
      fields =
        "id,incident_code,unit,warehouse,occurred_at,created_at,materials",
      range = (query) =>
        query
          .gte("occurred_at", exportFrom + "T00:00:00")
          .lte("occurred_at", exportTo + "T23:59:59.999")
          .order("occurred_at", { ascending: false }),
      [ambulanceResult, supervisorResult] = await Promise.all([
        range(supabase.from("incidents").select(fields).in("unit", ambulances)),
        range(
          supabase
            .from("incidents")
            .select(fields)
            .ilike("unit", `Material supervisor · ${exportZone}`),
        ),
      ]);
    if (ambulanceResult.error) throw ambulanceResult.error;
    if (supervisorResult.error) throw supervisorResult.error;
    const merged = [
        ...(ambulanceResult.data || []),
        ...(supervisorResult.data || []),
      ],
      unique = [...new Map(merged.map((row) => [row.id, row])).values()];
    return mapAdminRecords(unique);
  }
  async function generateReport(type) {
    if (!exportZone) return flash("Selecciona una supervisión");
    if (!exportFrom || !exportTo)
      return flash("Selecciona la fecha inicial y final");
    if (exportFrom > exportTo)
      return flash("La fecha inicial no puede ser posterior a la final");
    setReportLoading(true);
    try {
      await ensureAnonymousSession();
      const selected = await loadSelectedAdminRecords();
      setAdminRecords([]);
      setAdminLoaded(false);
      if (type === "excel") exportExcel(selected);
      else exportPdf(selected);
    } catch (error) {
      flash("No se pueden cargar los datos seleccionados de Supabase");
    } finally {
      setReportLoading(false);
    }
  }
  async function changePin() {
    const ownerCode = prompt("Clave exclusiva para cambiar el PIN");
    if (ownerCode === null) return;
    const ownerValid = await verifyOwnerCode(ownerCode);
    if (ownerValid !== true) {
      if (ownerValid === false)
        flash("No tienes autorización para cambiar el PIN");
      return;
    }
    const currentPin = prompt("PIN actual");
    if (currentPin === null) return;
    const newPin = prompt("Nuevo PIN de 4 a 8 dígitos");
    if (!/^\d{4,8}$/.test(newPin || "")) return flash("PIN no válido");
    const repeatPin = prompt("Repite el nuevo PIN");
    if (newPin !== repeatPin) return flash("Los PIN no coinciden");
    try {
      await ensureAnonymousSession();
      const { data, error } = await supabase.rpc("change_admin_pin", {
        input_owner_code: ownerCode,
        input_current_pin: currentPin,
        input_new_pin: newPin,
      });
      if (error) throw error;
      if (!data) return flash("PIN actual incorrecto");
      flash("PIN cambiado para todos los dispositivos");
    } catch (error) {
      flash("No se puede cambiar el PIN ahora");
    }
  }
  async function changeAssignedUnit() {
    const enteredPin = changeUnitPin;
    setChangeUnitPin("");
    const valid = await verifyAdminPin(enteredPin);
    if (valid !== true) {
      if (valid === false) denyPin(true);
      return;
    }
    if (!changeZone) return flash("Selecciona una supervisión");
    if (!nextUnit) return flash("Selecciona una unidad");
    if (
      !isSupervisorMaterial(nextUnit) &&
      !/^(07|08|09):00$/.test(changeShiftStart)
    )
      return flash("Selecciona la hora de inicio de guardia");
    localStorage.setItem(KEY.unit, nextUnit);
    localStorage.setItem(KEY.lot, changeLot);
    localStorage.setItem(
      KEY.shift,
      isSupervisorMaterial(nextUnit) ? "" : changeShiftStart,
    );
    setUnit(nextUnit);
    setLot(changeLot);
    setChangeZone("");
    setNextUnit("");
    setChangeShiftStart("");
    setChangeUnitOpen(false);
    flash("Unidad cambiada correctamente", 2000);
  }
  async function unassignDevice() {
    const enteredPin = changeUnitPin;
    setChangeUnitPin("");
    const valid = await verifyAdminPin(enteredPin);
    if (valid !== true) {
      if (valid === false) denyPin(true);
      return;
    }
    if (records.some((record) => !record.synced)) {
      return flash(
        "No se puede retirar la asignación: hay registros pendientes de sincronizar",
      );
    }
    localStorage.removeItem(KEY.unit);
    localStorage.removeItem(KEY.lot);
    localStorage.removeItem(KEY.shift);
    setUnit("");
    setLot("");
    setSelectedLot("");
    setSelectedZone("");
    setSelectedShiftStart("");
    setChangeZone("");
    setNextUnit("");
    setChangeShiftStart("");
    setChangeUnitOpen(false);
    flash("Móvil sin asignar. Ya puedes configurarlo de nuevo");
  }
  function saveStockDemo(next) {
    localStorage.setItem(STOCK_DEMO_KEY, JSON.stringify(next));
    setStockDemo(next);
  }
  function stockDemoNumber() {
    return Math.floor(Number(stockDemoQuantity));
  }
  function addDemoMovement(next, type, detail) {
    next.movements.unshift({
      at: new Date().toLocaleString("es-ES"),
      type,
      detail,
    });
    next.movements = next.movements.slice(0, 20);
  }
  function demoEntry() {
    const quantity = stockDemoNumber();
    if (!Number.isFinite(quantity) || quantity <= 0)
      return flash("Introduce una cantidad válida");
    const next = JSON.parse(JSON.stringify(stockDemo));
    next.levels[STOCK_DEMO_CENTRAL][stockDemoMaterial] += quantity;
    addDemoMovement(
      next,
      "Entrada de pedido",
      `${quantity} ${stockDemoMaterial} → Olot central`,
    );
    saveStockDemo(next);
    flash("Entrada ficticia registrada en Olot central");
  }
  function demoTransfer() {
    const quantity = stockDemoNumber();
    if (!Number.isFinite(quantity) || quantity <= 0)
      return flash("Introduce una cantidad válida");
    const next = JSON.parse(JSON.stringify(stockDemo));
    const available = next.levels[STOCK_DEMO_CENTRAL][stockDemoMaterial] || 0;
    if (quantity > available)
      return flash("No hay suficiente stock en Olot central");
    next.levels[STOCK_DEMO_CENTRAL][stockDemoMaterial] -= quantity;
    next.levels[stockDemoTarget][stockDemoMaterial] += quantity;
    addDemoMovement(
      next,
      "Reposición a subalmacén",
      `${quantity} ${stockDemoMaterial}: Olot central → ${stockDemoTarget.replace("Subalmacén ", "")}`,
    );
    saveStockDemo(next);
    flash("Reposición ficticia confirmada");
  }
  function demoConsumption() {
    const quantity = stockDemoNumber();
    if (!Number.isFinite(quantity) || quantity <= 0)
      return flash("Introduce una cantidad válida");
    const location = STOCK_DEMO_UNITS[stockDemoUnit];
    const next = JSON.parse(JSON.stringify(stockDemo));
    const available = next.levels[location][stockDemoMaterial] || 0;
    if (quantity > available)
      return flash(`No hay suficiente stock en ${location}`);
    next.levels[location][stockDemoMaterial] -= quantity;
    addDemoMovement(
      next,
      "Consumo simulado",
      `${stockDemoUnit}: ${quantity} ${stockDemoMaterial} · ${location.replace("Subalmacén ", "")}`,
    );
    saveStockDemo(next);
    flash("Consumo ficticio registrado");
  }
  function resetStockDemo() {
    if (!confirm("¿Restablecer los datos ficticios del piloto de Olot?")) return;
    const next = createStockDemo();
    saveStockDemo(next);
    flash("Demostración restablecida");
  }
  function exportExcel(source = adminRecords) {
    if (!exportZone) return flash("Selecciona una supervisión");
    if (!exportFrom || !exportTo)
      return flash("Selecciona la fecha inicial y final");
    if (exportFrom > exportTo)
      return flash("La fecha inicial no puede ser posterior a la final");
    const selected = source.filter(
        (r) =>
          recordZone(r) === exportZone &&
          r.date >= exportFrom &&
          r.date <= exportTo,
      ),
      origin = (r) =>
        /^Material supervisor · /i.test(r.unit) ? "Supervisor" : "Unidad",
      rows = selected.map((r) => {
        const a = aggregate(r);
        return {
          "ID INCIDENT": r.id,
          Fecha: r.date,
          Hora: r.time,
          "Tipo de registro": origin(r),
          Unidad: r.unit,
          Almacén: reportWarehouse(r.warehouse),
          "Contiene material crítico": recordCritical(r) ? "Sí" : "No",
          "Resumen de material":
            Object.entries(a)
              .map(([m, n]) => `${n} ${m}`)
              .join(" · ") || "Sin material",
        };
      }),
      detail = [],
      critical = [],
      rep = {},
      servicesByDay = {};
    selected.forEach((r) => {
      const a = aggregate(r),
        base = {
          "ID INCIDENT": r.id,
          Fecha: r.date,
          Hora: r.time,
          "Tipo de registro": origin(r),
          Unidad: r.unit,
          Almacén: reportWarehouse(r.warehouse),
        };
      Object.entries(a).forEach(([m, n]) => {
        const row = {
          ...base,
          "Material crítico": isCritical(m) ? "Sí" : "No",
          Material: m,
          Cantidad: n,
        };
        detail.push(row);
        if (isCritical(m)) critical.push({ ...base, Material: m, Cantidad: n });
      });
      if (Object.keys(a).length === 0)
        detail.push({
          ...base,
          "Material crítico": "No",
          Material: "Sin material",
          Cantidad: 0,
        });
      const warehouse = reportWarehouse(r.warehouse);
      rep[warehouse] = rep[warehouse] || {};
      Object.entries(a).forEach(
        ([m, n]) => (rep[warehouse][m] = (rep[warehouse][m] || 0) + n),
      );
      if (origin(r) === "Unidad") {
        servicesByDay[r.date] = (servicesByDay[r.date] || 0) + 1;
      }
    });
    const dailyRows = [],
      currentDay = new Date(`${exportFrom}T12:00:00`),
      lastDay = new Date(`${exportTo}T12:00:00`);
    while (currentDay <= lastDay) {
      const date = currentDay.toISOString().slice(0, 10);
      dailyRows.push({
        Fecha: date,
        "Servicios de unidades": servicesByDay[date] || 0,
      });
      currentDay.setDate(currentDay.getDate() + 1);
    }
    dailyRows.push({
      Fecha: "TOTAL DEL PERIODO",
      "Servicios de unidades": dailyRows.reduce(
        (total, row) => total + row["Servicios de unidades"],
        0,
      ),
    });
    const repRows = Object.entries(rep)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([warehouse, items]) =>
          Object.entries(items)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([m, n]) => ({
              Almacén: warehouse,
              "Material crítico": isCritical(m) ? "Sí" : "No",
              Material: m,
              "Cantidad a reponer": n,
            })),
        ),
      wb = XLSX.utils.book_new(),
      ws1 = XLSX.utils.json_to_sheet(rows),
      ws2 = XLSX.utils.json_to_sheet(detail),
      ws3 = XLSX.utils.json_to_sheet(repRows),
      ws5 = XLSX.utils.json_to_sheet(dailyRows),
      criticalHeaders = [
        "ID INCIDENT",
        "Fecha",
        "Hora",
        "Tipo de registro",
        "Unidad",
        "Almacén",
        "Material",
        "Cantidad",
      ],
      ws4 = XLSX.utils.aoa_to_sheet([criticalHeaders]);
    if (critical.length)
      XLSX.utils.sheet_add_json(ws4, critical, {
        origin: "A2",
        skipHeader: true,
      });
    const configure = (ws, widths) => {
      if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
      ws["!cols"] = widths.map((w) => ({ wch: w }));
    };
    configure(ws1, [14, 12, 9, 18, 24, 22, 16, 55]);
    configure(ws2, [14, 12, 9, 18, 24, 22, 16, 42, 12]);
    configure(ws3, [24, 16, 42, 20]);
    configure(ws4, [14, 12, 9, 18, 24, 22, 42, 12]);
    configure(ws5, [20, 24]);
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen incidencias");
    XLSX.utils.book_append_sheet(wb, ws5, "Servicios por día");
    XLSX.utils.book_append_sheet(wb, ws2, "Detalle consumo");
    XLSX.utils.book_append_sheet(wb, ws3, "Reposición almacenes");
    XLSX.utils.book_append_sheet(wb, ws4, "Material crítico");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([out], { type: "application/octet-stream" }),
      "control_material_ambulancias.xlsx",
    );
    setExportOpen(false);
  }
  function exportPdf(source = adminRecords) {
    if (!exportZone) return flash("Selecciona una supervisión");
    if (!exportFrom || !exportTo)
      return flash("Selecciona la fecha inicial y final");
    if (exportFrom > exportTo)
      return flash("La fecha inicial no puede ser posterior a la final");
    const criticalCategory = (m) => {
        const name = m.toLowerCase();
        return name.includes("kit quemados")
          ? "Kit quemados"
          : name.includes("torniquet")
            ? "Torniquet"
            : name.includes("faixa") || name.includes("faja")
              ? "Faja p\u00e9lvica"
              : name.includes("dea")
                ? "Pegats DEA"
                : name.includes("schiller")
                  ? "Pegats Schiller"
                  : "";
      },
      unitWithBase = (u) =>
        /^Material supervisor · /i.test(u)
          ? u
          : u + " — " + (unitWarehouse(u) || ""),
      selected = source.filter(
        (r) =>
          recordZone(r) === exportZone &&
          r.date >= exportFrom &&
          r.date <= exportTo,
      ),
      services = {},
      materials = {},
      unitMaterials = {},
      supervisorMaterials = {},
      warehouses = {},
      criticalUnits = {},
      weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    selected.forEach((r) => {
      const isSupervisor = /^Material supervisor · /i.test(r.unit),
        used = aggregate(r);
      if (!isSupervisor) {
        services[r.unit] = (services[r.unit] || 0) + 1;
        weekdayTotals[(new Date(r.date + "T12:00:00").getDay() + 6) % 7]++;
      }
      const warehouse = reportWarehouse(r.warehouse);
      warehouses[warehouse] = warehouses[warehouse] || {};
      Object.entries(used).forEach(([m, n]) => {
        const quantity = Number(n);
        materials[m] = (materials[m] || 0) + quantity;
        if (!isSupervisor)
          unitMaterials[r.unit] = (unitMaterials[r.unit] || 0) + quantity;
        else supervisorMaterials[m] = (supervisorMaterials[m] || 0) + quantity;
        const critical = criticalCategory(m);
        if (critical) {
          criticalUnits[r.unit] = criticalUnits[r.unit] || {};
          criticalUnits[r.unit][critical] =
            (criticalUnits[r.unit][critical] || 0) + quantity;
        }
        warehouses[warehouse][m] = (warehouses[warehouse][m] || 0) + quantity;
      });
    });
    Object.keys(SUPERVISIONS[exportZone] || {})
      .filter((u) => !isSupervisorMaterial(u))
      .forEach((u) => {
        services[u] = services[u] || 0;
        unitMaterials[u] = unitMaterials[u] || 0;
      });
    const serviceRows = Object.entries(services).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
      weekdayRows = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ].map((day, index) => [day, weekdayTotals[index]]),
      materialRows = Object.entries(materials).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
      unitMaterialRows = Object.entries(unitMaterials).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      ),
      supervisorMaterialRows = Object.entries(supervisorMaterials).sort(
        ([a], [b]) => a.localeCompare(b),
      ),
      warehouseRows = Object.entries(warehouses)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([warehouse, items]) => [
          warehouse,
          Object.entries(items).sort(([a], [b]) => a.localeCompare(b)),
        ]),
      topMaterialRows = materialRows.slice(0, 12),
      serviceTotal = serviceRows.reduce((sum, [, value]) => sum + value, 0),
      totalMaterial = materialRows.reduce((sum, [, value]) => sum + value, 0),
      unitPercentRows = unitMaterialRows.map(([unit, value]) => [
        unit,
        value,
        totalMaterial ? (100 * value) / totalMaterial : 0,
      ]),
      topMaterialUnit = unitPercentRows[0],
      inactiveUnits = serviceRows
        .filter(([, value]) => value === 0)
        .map(([unit]) => unit),
      criticalMatrixRows = Object.entries(criticalUnits)
        .sort(
          ([a], [b]) =>
            unitWarehouse(a).localeCompare(unitWarehouse(b)) ||
            a.localeCompare(b),
        )
        .map(([unit, items]) => [
          unitWithBase(unit),
          items["Faja p\u00e9lvica"] || 0,
          items["Pegats DEA"] || 0,
          items["Pegats Schiller"] || 0,
          items["Torniquet"] || 0,
          items["Kit quemados"] || 0,
        ]),
      doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    let firstPage = true;
    const header = (page) => {
      doc.setFillColor(215, 25, 32);
      doc.rect(0, 0, 297, 18, "F");
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(270, 2, 12, 14, 2, 2, "F");
      doc.addImage(FALCK_PDF_LOGO, "PNG", 272, 2, 8, 14);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("FALCK | INFORME DE SUPERVISIÓN", 15, 7);
      doc.setFontSize(20);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.text(exportZone.toUpperCase(), 148.5, 15, {
        align: "center",
        renderingMode: "fillThenStroke",
      });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(22, 50, 58);
      doc.setFontSize(10);
      doc.text("Periodo: " + exportFrom + " a " + exportTo, 15, 27);
      doc.setFontSize(8);
      doc.text("Página " + page, 276, 27, { align: "right" });
    };
    const card = (x, label, value, rgb) => {
      doc.setFillColor(...rgb);
      doc.roundedRect(x, 42, 66, 18, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(label, x + 33, 49, { align: "center" });
      doc.setFontSize(15);
      doc.text(String(value), x + 33, 57, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(22, 50, 58);
    };
    const compactUnitCharts = (rows) => {
      doc.setFontSize(13);
      doc.text("Servicios por unidad", 15, 88);
      doc.text("Servicios por unidad", 151, 88);
      if (!rows.length) {
        doc.setFontSize(10);
        doc.text("No hay servicios en este periodo.", 15, 100);
        return;
      }
      const maximum = Math.max(...rows.map(([, value]) => value), 1);
      rows.slice(0, 24).forEach(([label, value], index) => {
        const column = Math.floor(index / 12),
          row = index % 12,
          x = 15 + column * 136,
          y = 95 + row * 8,
          width = (80 * value) / maximum;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(String(label), x, y + 4.5, { maxWidth: 27 });
        const labelEnd = Math.min(
          x + 27,
          x + doc.getTextWidth(String(label)) + 2,
        );
        doc.setDrawColor(120, 130, 134);
        doc.setLineWidth(0.45);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(labelEnd, y + 2.5, x + 23, y + 2.5);
        doc.setLineDashPattern([], 0);
        doc.setFillColor(232, 237, 239);
        doc.roundedRect(x + 24, y, 88, 5, 1, 1, "F");
        doc.setFillColor(215, 25, 32);
        doc.roundedRect(x + 24, y, width, 5, 1, 1, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(String(value), x + 118, y + 4);
      });
      if (rows.length > 24) {
        doc.setFontSize(8);
        doc.setTextColor(107, 125, 131);
        doc.text(
          "El resto de unidades continúa en las páginas siguientes.",
          15,
          196,
        );
        doc.setTextColor(22, 50, 58);
      }
    };
    const summary = () => {
      header(1);
      doc.setFontSize(15);
      doc.text("Resumenen operativo", 15, 37);
      card(79, "Registros de servicio", serviceTotal, [215, 25, 32]);
      card(
        153,
        "Unidades de la supervisión",
        serviceRows.length,
        [11, 95, 115],
      );
      doc.setFillColor(244, 246, 248);
      doc.roundedRect(15, 65, 267, 12, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(177, 85, 0);
      doc.text("UNIDADES SIN REGISTROS EN EL PERIODO:", 20, 72);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(22, 50, 58);
      doc.text(
        inactiveUnits.length ? inactiveUnits.join(" · ") : "Cap",
        85,
        72,
        { maxWidth: 190 },
      );
      compactUnitCharts(serviceRows);
      firstPage = false;
    };
    const chart = (title, rows, rgb) => {
      doc.setFontSize(14);
      doc.text(title, 15, 40);
      if (!rows.length) {
        doc.setFontSize(11);
        doc.text("No hay datos en este periodo.", 15, 54);
        return;
      }
      const maximum = Math.max(...rows.map(([, value]) => value), 1);
      rows.forEach(([label, value], index) => {
        const y = 51 + index * 11,
          width = (165 * value) / maximum;
        doc.setFontSize(8);
        doc.text(String(label), 15, y + 4, { maxWidth: 66 });
        doc.setFillColor(232, 237, 239);
        doc.roundedRect(86, y, 165, 7, 1, 1, "F");
        doc.setFillColor(...rgb);
        doc.roundedRect(86, y, width, 7, 1, 1, "F");
        doc.setFontSize(9);
        doc.text(String(value), 257, y + 5);
      });
      doc.setFontSize(8);
      doc.setTextColor(107, 125, 131);
      doc.text("Cantidad", 251, 47);
      doc.setTextColor(22, 50, 58);
    };
    const chartPages = (title, rows, rgb) => {
      const chunks = [];
      for (let i = 0; i < Math.max(rows.length, 1); i += 15)
        chunks.push(rows.slice(i, i + 15));
      chunks.forEach((chunk, index) => {
        if (!firstPage) doc.addPage();
        firstPage = false;
        header(doc.getNumberOfPages());
        chart(
          chunks.length > 1
            ? title + " (" + (index + 1) + "/" + chunks.length + ")"
            : title,
          chunk,
          rgb,
        );
      });
    };
    const percentagePages = (rows) => {
      const chunks = [];
      for (let i = 0; i < Math.max(rows.length, 1); i += 24)
        chunks.push(rows.slice(i, i + 24));
      chunks.forEach((chunk, index) => {
        doc.addPage();
        header(doc.getNumberOfPages());
        doc.setFontSize(14);
        doc.text(
          chunks.length > 1
            ? "Consumo de material por unidad (" +
                (index + 1) +
                "/" +
                chunks.length +
                ")"
            : "Consumo de material por unidad",
          15,
          40,
        );
        doc.setFontSize(9);
        doc.setTextColor(107, 125, 131);
        doc.text(
          "Porcentaje sobre todo el material consumido en la supervisión durante el periodo.",
          15,
          47,
        );
        doc.setTextColor(22, 50, 58);
        if (!chunk.length) {
          doc.setFontSize(11);
          doc.text("No hay consumo de unidades en este periodo.", 15, 62);
          return;
        }
        chunk.forEach(([unit, value, percent], row) => {
          const y = 54 + row * 6;
          if (row % 2 === 0) {
            doc.setFillColor(244, 246, 248);
            doc.rect(15, y - 3.5, 252, 5, "F");
          }
          doc.setFontSize(7);
          doc.text(String(unit), 19, y);
          doc.text(String(value), 212, y, { align: "right" });
          doc.setFontSize(8);
          doc.setTextColor(8, 122, 72);
          doc.text(percent.toFixed(1).replace(".", ",") + "%", 258, y, {
            align: "right",
          });
          doc.setTextColor(22, 50, 58);
        });
      });
    };
    const supervisorMaterialPages = (rows) => {
      if (!rows.length) return;
      const chunks = [];
      for (let i = 0; i < rows.length; i += 16)
        chunks.push(rows.slice(i, i + 16));
      chunks.forEach((chunk, index) => {
        doc.addPage();
        header(doc.getNumberOfPages());
        doc.setFontSize(14);
        doc.text(
          chunks.length > 1
            ? "Reposición de material de supervisión (" +
                (index + 1) +
                "/" +
                chunks.length +
                ")"
            : "Reposición de material de supervisión",
          15,
          40,
        );
        doc.setFillColor(255, 236, 204);
        doc.roundedRect(15, 46, 267, 16, 3, 3, "F");
        doc.setTextColor(177, 85, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("REPOSICIÓN NECESARIA EN EL ALMACÉN DE SUPERVISIÓN", 22, 53);
        doc.setTextColor(22, 50, 58);
        doc.setFontSize(12);
        doc.text("Almacén de Supervisión " + exportZone, 22, 59);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(107, 125, 131);
        doc.text(
          "Material introducido por Material Supervisor. No es un servicio de ambulancia, pero debe reponerse en el almacén indicado.",
          15,
          70,
        );
        doc.setTextColor(22, 50, 58);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Material que se debe reponer", 19, 81);
        doc.text("Cantidad", 258, 81, { align: "right" });
        doc.setFont("helvetica", "normal");
        chunk.forEach(([material, value], row) => {
          const y = 90 + row * 6.5;
          if (row % 2 === 0) {
            doc.setFillColor(244, 246, 248);
            doc.rect(15, y - 4.5, 252, 6, "F");
          }
          doc.setFontSize(9);
          doc.text(String(material), 19, y, { maxWidth: 205 });
          doc.setFontSize(10);
          doc.text(String(value), 258, y, { align: "right" });
        });
      });
    };
    const criticalPages = (rows) => {
      const chunks = [];
      for (let i = 0; i < Math.max(rows.length, 1); i += 14)
        chunks.push(rows.slice(i, i + 14));
      chunks.forEach((chunk, index) => {
        doc.addPage();
        header(doc.getNumberOfPages());
        doc.setFontSize(14);
        doc.text(
          chunks.length > 1
            ? "Material crítico por unidad (" +
                (index + 1) +
                "/" +
                chunks.length +
                ")"
            : "Material crítico por unidad",
          15,
          40,
        );
        doc.setFontSize(8);
        doc.setTextColor(107, 125, 131);
        doc.text(
          "Les variants adult i pediàtric estan sumades dins cada tipus de pegat.",
          15,
          47,
        );
        doc.setTextColor(22, 50, 58);
        if (!chunk.length) {
          doc.setFontSize(11);
          doc.text("No hay material crítico en este periodo.", 15, 62);
          return;
        }
        const columns = [
          [18, "Unidad / población", "left"],
          [102, "Ús", "center"],
          [126, "Faixa", "center"],
          [153, "Pegats DEA", "center"],
          [190, "Pegats Schiller", "center"],
          [226, "Torniquet", "center"],
          [253, "Kit quemados", "center"],
          [275, "Total", "center"],
        ];
        doc.setFontSize(8);
        columns.forEach(([x, label, align]) =>
          doc.text(label, x, 57, { align }),
        );
        chunk.forEach(
          ([unit, faixa, dea, schiller, torniquet, kitQuemados], row) => {
            const y = 64 + row * 9,
              total = torniquet + faixa + dea + schiller + kitQuemados;
            if (total > 0) {
              doc.setFillColor(255, 204, 128);
              doc.rect(15, y - 5, 267, 7, "F");
              doc.setDrawColor(232, 117, 0);
              doc.setLineWidth(1.2);
              doc.line(16, y - 5, 16, y + 2);
            } else if (row % 2 === 0) {
              doc.setFillColor(244, 246, 248);
              doc.rect(15, y - 5, 267, 7, "F");
            }
            doc.setFontSize(8);
            doc.text(String(unit), 18, y, { maxWidth: 88 });
            doc.setFont("helvetica", "bold");
            doc.setTextColor(
              total > 0 ? 232 : 125,
              total > 0 ? 117 : 135,
              total > 0 ? 0 : 140,
            );
            doc.text(total > 0 ? "SÍ" : "NO", 102, y, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(22, 50, 58);
            doc.setFontSize(9);
            doc.text(String(faixa), 126, y, { align: "center" });
            doc.text(String(dea), 153, y, { align: "center" });
            doc.text(String(schiller), 190, y, { align: "center" });
            doc.text(String(torniquet), 226, y, { align: "center" });
            doc.text(String(kitQuemados), 253, y, { align: "center" });
            doc.setTextColor(177, 24, 24);
            doc.text(String(total), 275, y, { align: "center" });
            doc.setTextColor(22, 50, 58);
          },
        );
      });
    };
    const replenishmentPages = (groups) => {
      if (!groups.length) groups = [["Sin almacén", []]];
      groups = [
        [
          "Almacén general",
          [...materialRows].sort(([a], [b]) => a.localeCompare(b)),
        ],
        ...groups,
      ];
      groups.forEach(([warehouse, rows]) => {
        const chunks = [];
        for (let i = 0; i < Math.max(rows.length, 1); i += 18)
          chunks.push(rows.slice(i, i + 18));
        chunks.forEach((chunk, index) => {
          doc.addPage();
          header(doc.getNumberOfPages());
          doc.setFontSize(14);
          doc.text(
            "Reposición - almacén: " +
              warehouse +
              (chunks.length > 1
                ? " (" + (index + 1) + "/" + chunks.length + ")"
                : ""),
            15,
            40,
          );
          doc.setFontSize(9);
          doc.setTextColor(107, 125, 131);
          doc.text(
            warehouse === "Almacén general"
              ? "Suma de todo el material que se debe reponer de la supervisión en este periodo."
              : "El/la supervisor/a debe solicitar este material para reponer este almacén.",
            15,
            47,
          );
          doc.setTextColor(22, 50, 58);
          if (!chunk.length) {
            doc.setFontSize(11);
            doc.text("No hay material consumido en este periodo.", 15, 62);
            return;
          }
          chunk.forEach(([label, value], row) => {
            const y = 54 + row * 10;
            if (row % 2 === 0) {
              doc.setFillColor(244, 246, 248);
              doc.rect(15, y - 4, 252, 8, "F");
            }
            doc.setFontSize(9);
            doc.text(String(label), 19, y + 1, { maxWidth: 205 });
            doc.setFontSize(10);
            doc.text(String(value), 255, y + 1, { align: "right" });
          });
        });
      });
    };
    summary();
    chartPages("Servicios por día de la semana", weekdayRows, [11, 95, 115]);
    percentagePages(unitPercentRows);
    supervisorMaterialPages(supervisorMaterialRows);
    criticalPages(criticalMatrixRows);
    chartPages(
      "Material m\u00e1s utilizado (incluye supervisión)",
      topMaterialRows,
      [232, 117, 0],
    );
    replenishmentPages(warehouseRows);
    doc.save("informe_supervisio_" + exportZone.toLowerCase() + ".pdf");
    setExportOpen(false);
  }
  const currentUnit = localStorage.getItem(KEY.unit),
    pending = records.filter((r) => !r.synced).length;
  return (
    <div className="app">
      <header className="header">
        <div className="header-copy">
          <h1>Control de material</h1>
          <small>
            {mode === "admin" ? "Administración" : "Registro de incidencias"}
          </small>
          {mode === "worker" && currentUnit && (
            <>
              <div className="unit-header">{displayUnit(currentUnit)}</div>
              <button
                className="change-unit-button"
                onClick={() => {
                  setChangeUnitPin("");
                  setChangeLot("");
                  setChangeZone("");
                  setNextUnit("");
                  setChangeShiftStart("");
                  setShiftPickerOpen(false);
                  setChangeUnitOpen(true);
                }}
              >
                Cambiar unidad
              </button>
              <div className="unit-supervision">{lot}</div>
              <div className="unit-supervision">
                Supervisión {unitZone(currentUnit)}
              </div>
            </>
          )}
        </div>
        <img
          className="falck-header-logo"
          src="./falck-header.png"
          alt="Falck"
        />
      </header>
      <main className="container">
        {status === "sent" && (
          <div className="sent-confirmation">
            <span className="sent-check">✓</span>
            <strong>ENVIADO</strong>
            <small>Registro guardado correctamente</small>
          </div>
        )}
        {zoneOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Elige la supervisión</h2>
              <p className="muted">
                Selecciona la zona antes de elegir la ambulancia.
              </p>
              <div className="zone-options">
                {Object.keys(LOTS[selectedLot] || {})
                  .sort((a, b) => a.localeCompare(b))
                  .map((zone) => (
                    <button
                      key={zone}
                      className="secondary full"
                      onClick={() => {
                        setSelectedZone(zone);
                        setUnit("");
                        setZoneOpen(false);
                      }}
                    >
                      Supervisión {zone}
                    </button>
                  ))}
              </div>
              <button
                className="secondary full"
                style={{ marginTop: 12 }}
                onClick={() => setZoneOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {changeUnitOpen && (
          <div className="modal-backdrop unit-backdrop">
            <div className="card export-modal unit-modal">
              <h2>Cambiar unidad</h2>
              <p className="muted">
                Introduce el PIN de administrador para reasignar este móvil.
              </p>
              <label>PIN administrador</label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                name="change-unit-pin"
                value={changeUnitPin}
                onChange={(e) => setChangeUnitPin(e.target.value)}
              />
              <label>Lot</label>
              <select
                value={changeLot}
                onChange={(e) => {
                  setChangeLot(e.target.value);
                  setChangeZone("");
                  setNextUnit("");
                }}
              >
                <option value="">Selecciona...</option>
                {Object.keys(LOTS).map((name) => (
                  <option
                    key={name}
                    value={name}
                    disabled={!Object.keys(LOTS[name] || {}).length}
                  >
                    {name}
                    {Object.keys(LOTS[name] || {}).length
                      ? ""
                      : " — próximamente"}
                  </option>
                ))}
              </select>
              <label>Supervisión</label>
              <select
                value={changeZone}
                onChange={(e) => {
                  setChangeZone(e.target.value);
                  setNextUnit("");
                }}
              >
                <option value="">Selecciona...</option>
                {Object.keys(LOTS[changeLot] || {})
                  .sort((a, b) => a.localeCompare(b))
                  .map((zone) => (
                    <option key={zone} value={zone}>
                      Supervisión {zone}
                    </option>
                  ))}
              </select>
              {changeZone && (
                <>
                  <label>Nueva unidad</label>
                  <div className="unit-choice-list">
                    {sortUnits(SUPERVISIONS[changeZone]).map((u) => (
                      <button
                        key={u}
                        className={`${nextUnit === u ? "unit-choice selected" : "unit-choice"}${isSupervisorMaterial(u) ? " supervisor-choice" : ""}`}
                        onClick={() => {
                          setNextUnit(u);
                          setChangeShiftStart("");
                          if (isSupervisorMaterial(u)) {
                            setShiftPickerOpen(false);
                          } else {
                            setShiftPickerTarget("change");
                            setShiftPickerOpen(true);
                          }
                        }}
                      >
                        <b>{isSupervisorMaterial(u) ? "Material" : u}</b>
                        <span>
                          {isSupervisorMaterial(u)
                            ? "supervisor"
                            : SUPERVISIONS[changeZone][u]}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {nextUnit && (
                <p className="selected-zone">
                  Inicio de guardia: {changeShiftStart || "pendiente"}
                </p>
              )}
              <div className="toolbar">
                <button
                  className="secondary"
                  onClick={() => {
                    setChangeUnitPin("");
                    setChangeZone("");
                    setNextUnit("");
                    setChangeUnitOpen(false);
                  }}
                >
                  Cancelar
                </button>
                <button className="primary" onClick={changeAssignedUnit}>
                  Asignar unidad
                </button>
              </div>
              <button
                className="secondary full"
                style={{ marginTop: 12 }}
                onClick={unassignDevice}
              >
                Dejar móvil sin asignar
              </button>
            </div>
          </div>
        )}
        {shiftPickerOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Inicio de guardia</h2>
              <p className="muted">
                Selecciona la hora a la que empieza la guardia de esta unidad.
              </p>
              <div className="zone-options">
                <button
                  className="primary full"
                  onClick={() => {
                    if (shiftPickerTarget === "change")
                      setChangeShiftStart("07:00");
                    else setSelectedShiftStart("07:00");
                    setShiftPickerOpen(false);
                  }}
                >
                  07:00
                </button>
                <button
                  className="primary full"
                  onClick={() => {
                    if (shiftPickerTarget === "change")
                      setChangeShiftStart("08:00");
                    else setSelectedShiftStart("08:00");
                    setShiftPickerOpen(false);
                  }}
                >
                  08:00
                </button>
                <button
                  className="primary full"
                  onClick={() => {
                    if (shiftPickerTarget === "change")
                      setChangeShiftStart("09:00");
                    else setSelectedShiftStart("09:00");
                    setShiftPickerOpen(false);
                  }}
                >
                  09:00
                </button>
              </div>
              <button
                className="secondary full"
                style={{ marginTop: 12 }}
                onClick={() => {
                  if (shiftPickerTarget === "change") {
                    setNextUnit("");
                    setChangeShiftStart("");
                  } else {
                    setUnit("");
                    setSelectedShiftStart("");
                  }
                  setShiftPickerOpen(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {exportLotOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Elige el lote</h2>
              <p className="muted">
                Selecciona el lote antes de elegir la supervisión.
              </p>
              <div className="zone-options">
                {Object.keys(LOTS).map((name) => (
                  <button
                    key={name}
                    className="secondary full"
                    disabled={!Object.keys(LOTS[name] || {}).length}
                    onClick={() => {
                      setExportLot(name);
                      setExportLotOpen(false);
                      setExportZoneOpen(true);
                    }}
                  >
                    {name}
                    {Object.keys(LOTS[name] || {}).length
                      ? ""
                      : " — próximamente"}
                  </button>
                ))}
              </div>
              <button
                className="secondary full"
                style={{ marginTop: 12 }}
                onClick={() => setExportLotOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {exportZoneOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Elige la supervisión</h2>
              <p className="muted">
                Este informe solo incluirá las unidades de esta zona.
              </p>
              <div className="zone-options">
                {Object.keys(SUPERVISIONS)
                  .sort((a, b) => a.localeCompare(b))
                  .map((zone) => (
                    <button
                      key={zone}
                      className="secondary full"
                      onClick={() => {
                        setExportZone(zone);
                        setExportZoneOpen(false);
                        setExportOpen(true);
                      }}
                    >
                      Supervisión {zone}
                    </button>
                  ))}
              </div>
              <button
                className="secondary full"
                style={{ marginTop: 12 }}
                onClick={() => setExportZoneOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {exportOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>
                Descargar informe - {exportLot} · Supervisión {exportZone}
              </h2>
              <p className="muted">
                Selecciona el periodo y después elige el formato que quieres
                descargar.
              </p>
              <label>Desde</label>
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
              />
              <label>Hasta</label>
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
              />
              <div className="toolbar">
                <button
                  className="secondary"
                  onClick={() => setExportOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="secondary"
                  onClick={() => generateReport("excel")}
                  disabled={reportLoading}
                >
                  {reportLoading ? "Cargando datos..." : "Descargar Excel"}
                </button>
                <button
                  className="primary"
                  onClick={() => generateReport("pdf")}
                  disabled={reportLoading}
                >
                  {reportLoading ? "Cargando datos..." : "Descargar PDF"}
                </button>
              </div>
            </div>
          </div>
        )}
        {pinDeniedOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Acceso no autorizado</h2>
              <p>Esta acción solo la puede realizar supervisión.</p>
            </div>
          </div>
        )}
        {coverageCheckingOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2 style={{ textAlign: "center" }}>Comprobando cobertura...</h2>
              <p>Un momento, por favor.</p>
            </div>
          </div>
        )}
        {coverageEditOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Sin cobertura</h2>
              <p>Para modificar una incidencia necesitas conexión.</p>
            </div>
          </div>
        )}
        {conflictOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>ID de incidencia duplicado</h2>
              <p>
                Este registro no se ha enviado para evitar duplicar un
                incidente.
              </p>
              <p className="muted">
                Corrige el ID. El material seleccionado se conservará.
              </p>
              <label>Nuevo ID de incidencia</label>
              <input
                value={conflictNewId}
                inputMode="numeric"
                maxLength={9}
                onChange={(e) =>
                  setConflictNewId(
                    e.target.value.replace(/\D/g, "").slice(0, 9),
                  )
                }
              />
              <div className="toolbar">
                <button
                  className="secondary"
                  onClick={() => setConflictOpen(false)}
                >
                  Cancelar
                </button>
                <button className="primary" onClick={correctPendingId}>
                  Guardar ID
                </button>
              </div>
            </div>
          </div>
        )}
        {duplicateOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Error</h2>
              <p>Este ID de incidencia ya existe en esta unidad.</p>
              <p className="muted">
                Comprueba el número o introduce un ID diferente.
              </p>
              <button
                className="primary full"
                onClick={() => setDuplicateOpen(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
        {missingIncidentOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Falta el ID de incidencia</h2>
              <p>
                Introduce y confirma el ID de la incidencia antes de enviar el
                registro.
              </p>
              <button
                className="primary full"
                onClick={() => {
                  setMissingIncidentOpen(false);
                  const input = document.querySelector("[data-incident-input]");
                  input?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  input?.focus();
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
        {invalidIncidentOpen && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2>Número de incidente incorrecto</h2>
              <p>El número debe contener exactamente 9 dígitos.</p>
              <p className="muted">
                Corrígelo y vuelve a confirmar el incidente.
              </p>
              <button
                className="primary full"
                onClick={() => {
                  setInvalidIncidentOpen(false);
                  document.querySelector("[data-incident-input]")?.focus();
                }}
              >
                Modificar número
              </button>
            </div>
          </div>
        )}
        {message && (
          <div className="modal-backdrop">
            <div className="card export-modal">
              <h2 style={{ textAlign: "center" }}>Aviso</h2>
              <p style={{ textAlign: "center" }}>{message}</p>
            </div>
          </div>
        )}
        {mode === "worker" && !currentUnit && (
          <div className="card">
            <h2>Configuración inicial del móvil</h2>
            <p className="muted">
              Solo la persona administradora puede asignar la unidad.
            </p>
            <label>PIN administrador</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              name="initial-unit-pin"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />
            <label>Lot</label>
            <select
              value={selectedLot}
              onChange={(e) => {
                setSelectedLot(e.target.value);
                setSelectedZone("");
                setUnit("");
              }}
            >
              <option value="">Selecciona...</option>
              {Object.keys(LOTS).map((name) => (
                <option
                  key={name}
                  value={name}
                  disabled={!Object.keys(LOTS[name] || {}).length}
                >
                  {name}
                  {Object.keys(LOTS[name] || {}).length
                    ? ""
                    : " — próximamente"}
                </option>
              ))}
            </select>
            {selectedZone && (
              <>
                <p className="selected-zone">
                  {selectedLot} · Supervisión {selectedZone}
                </p>
                <label>Unidad</label>
                <select
                  value={unit}
                  onChange={(e) => {
                    const next = e.target.value;
                    setUnit(next);
                    setSelectedShiftStart("");
                    if (next && !isSupervisorMaterial(next)) {
                      setShiftPickerTarget("initial");
                      setShiftPickerOpen(true);
                    } else {
                      setShiftPickerOpen(false);
                    }
                  }}
                >
                  <option value="">Selecciona...</option>
                  {sortUnits(LOTS[selectedLot][selectedZone]).map((u) => (
                    <option key={u} value={u}>
                      {isSupervisorMaterial(u)
                        ? SUPERVISIONS[selectedZone][u]
                        : `${u} - ${SUPERVISIONS[selectedZone][u]}`}
                    </option>
                  ))}
                </select>
                {unit && (
                  <p className="selected-zone">
                    Inicio de guardia: {selectedShiftStart || "pendiente"}
                  </p>
                )}
              </>
            )}
            <button
              className="primary full"
              style={{ marginTop: 12 }}
              onClick={selectedZone ? saveUnit : openZoneSelector}
            >
              {selectedZone ? "Asignar este móvil" : "Elegir supervisión"}
            </button>
          </div>
        )}
        {mode === "worker" && currentUnit && (
          <>
            <div className="card">
              <div className="section-title">
                <div>
                  <h2>Nueva incidencia</h2>
                </div>
                <div className="small muted">
                  Almacén: {unitWarehouse(currentUnit)}
                </div>
              </div>
              {!isSupervisorMaterial(currentUnit) && (
                <>
                  <label>ID INCIDENT</label>
                  <input
                    data-incident-input
                    value={incident}
                    inputMode="numeric"
                    maxLength={9}
                    pattern="[0-9]{9}"
                    onChange={(e) => {
                      const nextId = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 9);
                      setIncident(nextId);
                      setIncidentConfirmed(false);
                      setEditingRecord(null);
                      setStatus("draft");
                    }}
                    style={{
                      borderColor:
                        status === "sent"
                          ? "#087a48"
                          : status === "queued"
                            ? "#d97706"
                            : "#b42318",
                      color:
                        status === "sent"
                          ? "#087a48"
                          : status === "queued"
                            ? "#d97706"
                            : "#b42318",
                      fontWeight: 800,
                    }}
                    placeholder="Introduce el ID DE INCIDENCIA"
                  />
                  <button
                    className={`full ${editingRecord ? "secondary" : incidentConfirmed ? "success" : "secondary"}`}
                    style={{ marginTop: 8 }}
                    onClick={confirmIncident}
                  >
                    {incidentConfirmed
                      ? "✓ Incidencia confirmada"
                      : "OK - confirmar incidencia"}
                  </button>
                  <button
                    className={`full ${editingRecord ? "success" : "secondary"}`}
                    style={{ marginTop: 8 }}
                    disabled={!/^\d{9}$/.test(incident)}
                    onClick={startEdit}
                  >
                    {editingRecord
                      ? "✓ Modificar incidencia enviada"
                      : "Modificar incidencia enviada"}
                  </button>
                  {editingRecord && (
                    <p className="muted small">
                      Modificando incidencia {incident}. Puedes corregir el
                      material y guardar los cambios.
                    </p>
                  )}
                </>
              )}
              <div className="grid">
                <div>
                  <label>Fecha</label>
                  <input type="date" value={clock.date} disabled />
                </div>
                <div>
                  <label>Hora</label>
                  <input type="time" value={clock.time} disabled />
                </div>
              </div>
              <label>Buscar material</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Escribe el nombre del material..."
              />
            </div>
            <div className="card">
              <h3>Material consumido</h3>
              <p className="muted small">
                Todo comienza a 0. Solo se guardará el material con cantidad
                superior a cero.
              </p>
              {filtered.map((m) => (
                <div
                  className={`material${(quantities[m] || 0) > 0 ? " material-selected" : ""}`}
                  key={m}
                >
                  <span>
                    {m}
                    {isCritical(m) ? (
                      <span
                        className="critical-icon"
                        title="Material crítico"
                        aria-label="Material crítico"
                      >
                        ⚠
                      </span>
                    ) : (
                      ""
                    )}
                  </span>
                  <div className="counter">
                    <button onClick={() => dec(m)}>-</button>
                    <span className="qty">{quantities[m] || 0}</span>
                    <button onClick={() => inc(m)}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="send-actions">
              <button
                className="primary full send-button"
                onClick={() => submit(false)}
              >
                Enviar registro
              </button>
              <button
                className="secondary full sync-button"
                onClick={syncPending}
                disabled={syncing || pending === 0}
              >
                {syncing
                  ? "Sincronizando..."
                  : `Sincronizar pendientes (${pending})`}
              </button>
            </div>
          </>
        )}
        {mode === "admin" && !adminOk && (
          <div className="card">
            <h2>Administración</h2>
            <label>PIN</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              name="admin-access-code"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
            />
            <button
              className="primary full"
              style={{ marginTop: 12 }}
              onClick={adminLogin}
            >
              Entrar
            </button>
          </div>
        )}
        {mode === "admin" && adminOk && (
          <>
            <div className="card">
              <h2>Panel de administración</h2>
              <div className="toolbar">
                <button
                  className="secondary"
                  onClick={() => setExportLotOpen(true)}
                >
                  Descargar informe
                </button>
                <button className="secondary" onClick={changePin}>
                  Cambiar PIN
                </button>
                <button
                  className="secondary"
                  onClick={() => setStockDemoOpen((open) => !open)}
                >
                  {stockDemoOpen ? "Cerrar demo de stock" : "Demo stock Olot"}
                </button>
              </div>
            </div>
            {stockDemoOpen && (
              <section className="card stock-demo">
                <div className="stock-demo-title">
                  <div>
                    <h2>Stock · SupervisiÃ³n Olot</h2>
                    <p className="muted">
                      Modo demostraciÃ³n: datos ficticios guardados solo en este
                      navegador. No se conecta con Supabase ni modifica incidencias.
                    </p>
                  </div>
                  <span className="stock-demo-badge">PRUEBA</span>
                </div>
                <div className="stock-demo-cards">
                  <div>
                    <small>AlmacÃ©n central</small>
                    <strong>Olot</strong>
                    <span>{STOCK_DEMO_MATERIALS.length} artÃ­culos demo</span>
                  </div>
                  <div>
                    <small>Subalmacenes</small>
                    <strong>5</strong>
                    <span>Banyoles, Camprodon, CampdevÃ nol, Olot y Sant Joan</span>
                  </div>
                  <div>
                    <small>Unidades vinculadas</small>
                    <strong>9</strong>
                    <span>Consumo simulado por subalmacÃ©n</span>
                  </div>
                </div>
                <div className="stock-demo-actions">
                  <div className="stock-demo-action">
                    <h3>1. Recibir pedido</h3>
                    <p className="muted small">
                      Suma material al almacÃ©n central de Olot.
                    </p>
                    <label>Material</label>
                    <select
                      value={stockDemoMaterial}
                      onChange={(e) => setStockDemoMaterial(e.target.value)}
                    >
                      {STOCK_DEMO_MATERIALS.map((material) => (
                        <option key={material}>{material}</option>
                      ))}
                    </select>
                    <label>Cantidad recibida</label>
                    <input
                      type="number"
                      min="1"
                      value={stockDemoQuantity}
                      onChange={(e) => setStockDemoQuantity(e.target.value)}
                    />
                    <button className="primary full" onClick={demoEntry}>
                      Registrar entrada ficticia
                    </button>
                  </div>
                  <div className="stock-demo-action">
                    <h3>2. Reponer subalmacÃ©n</h3>
                    <p className="muted small">
                      Resta del central y suma en el destino elegido.
                    </p>
                    <label>Destino</label>
                    <select
                      value={stockDemoTarget}
                      onChange={(e) => setStockDemoTarget(e.target.value)}
                    >
                      {STOCK_DEMO_LOCATIONS.slice(1).map((location) => (
                        <option key={location}>{location}</option>
                      ))}
                    </select>
                    <label>Material y cantidad</label>
                    <p className="stock-demo-selection">
                      {stockDemoQuantity} {stockDemoMaterial}
                    </p>
                    <button className="primary full" onClick={demoTransfer}>
                      Confirmar reposiciÃ³n ficticia
                    </button>
                  </div>
                  <div className="stock-demo-action">
                    <h3>3. Simular consumo</h3>
                    <p className="muted small">
                      Demuestra cÃ³mo una unidad descuenta de su subalmacÃ©n.
                    </p>
                    <label>Unidad</label>
                    <select
                      value={stockDemoUnit}
                      onChange={(e) => setStockDemoUnit(e.target.value)}
                    >
                      {Object.keys(STOCK_DEMO_UNITS).map((unit) => (
                        <option key={unit}>{unit}</option>
                      ))}
                    </select>
                    <label>SubalmacÃ©n vinculado</label>
                    <p className="stock-demo-selection">
                      {STOCK_DEMO_UNITS[stockDemoUnit]}
                    </p>
                    <button className="secondary full" onClick={demoConsumption}>
                      Registrar consumo ficticio
                    </button>
                  </div>
                </div>
                <div className="stock-demo-bottom">
                  <div className="stock-demo-stock">
                    <div className="stock-demo-subtitle">
                      <h3>Existencias actuales</h3>
                      <select
                        value={stockDemoLocation}
                        onChange={(e) => setStockDemoLocation(e.target.value)}
                      >
                        {STOCK_DEMO_LOCATIONS.map((location) => (
                          <option key={location}>{location}</option>
                        ))}
                      </select>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {STOCK_DEMO_MATERIALS.map((material) => (
                          <tr key={material}>
                            <td>{material}</td>
                            <td>
                              {stockDemo.levels[stockDemoLocation][material]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="stock-demo-history">
                    <h3>Ãšltimos movimientos demo</h3>
                    {stockDemo.movements.slice(0, 6).map((movement, index) => (
                      <div className="stock-demo-movement" key={index}>
                        <b>{movement.type}</b>
                        <span>{movement.detail}</span>
                        <small>{movement.at}</small>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="danger" onClick={resetStockDemo}>
                  Restablecer datos ficticios
                </button>
              </section>
            )}
            <div className="card">
              <h3>Resumen</h3>
              {adminLoaded ? (
                <>
                  <p>
                    <b>Total de incidencias:</b> {adminRecords.length}
                  </p>
                  <p>
                    <b>Con material crítico:</b>{" "}
                    {adminRecords.filter(recordCritical).length}
                  </p>
                  <p className="muted">
                    Datos cargados: Supervisión {exportZone}, del {exportFrom}{" "}
                    al {exportTo}.
                  </p>
                </>
              ) : (
                <p className="muted">
                  Elige una supervisión y un periodo con «Descargar Excel» para
                  consultar solo esos datos.
                </p>
              )}
            </div>
            {adminLoaded && (
              <div className="card" style={{ overflowX: "auto" }}>
                <h3>Incidencias registradas</h3>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Fecha/hora</th>
                      <th>Unidad</th>
                      <th>Material crítico</th>
                      <th>Resumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminRecords.map((r) => {
                      const c = recordCritical(r),
                        s =
                          Object.entries(aggregate(r))
                            .map(([m, n]) => `${n} ${m}`)
                            .join(" · ") || "Sin material";
                      return (
                        <tr
                          key={r.id + "-" + r.unit}
                          className={c ? "yellow-row" : ""}
                        >
                          <td>{r.id}</td>
                          <td>
                            {r.date} {r.time}
                          </td>
                          <td>{r.unit}</td>
                          <td>{c ? "Sí" : "No"}</td>
                          <td>{s}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
if ("serviceWorker" in navigator)
  addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js?v=49", {
      updateViaCache: "none",
    }),
  );
