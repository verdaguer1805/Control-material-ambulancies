export function madridDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return { date: "", time: "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

export function mapReportRecords(data, submissions = []) {
  return data.map(row => {
    const supervisor = /^Material supervisor(?:\s*·|$)/i.test(row.unit || "");
    const events = supervisor ? submissions.filter(event =>
      event.unit === row.unit && event.guard_code === row.incident_code
    ).sort((a,b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at)) : [];
    const registeredAt = events.at(-1)?.submitted_at || row.created_at;
    const guard = madridDateTime(row.occurred_at);
    const actual = madridDateTime(registeredAt || row.occurred_at);
    return {
      id: row.incident_code, unit: row.unit, warehouse: row.warehouse,
      date: guard.date, time: supervisor ? actual.time : guard.time.slice(0,5),
      createdAt: row.created_at, updatedAt: row.updated_at || row.created_at,
      entries: [{ createdAt: row.created_at, materials: row.materials || {} }], synced: true
    };
  });
}

export function supervisorReportEvents(submissions, zone, from, to) {
  return submissions.filter(event => {
    const match = /^Material supervisor · (.+)$/i.exec(event.unit || "");
    const day = madridDateTime(event.submitted_at).date;
    return match && match[1].trim().toLowerCase() === zone.toLowerCase() && day >= from && day <= to;
  }).sort((a,b) => Date.parse(a.submitted_at)-Date.parse(b.submitted_at))
    .flatMap(event => Object.entries(event.material_delta || {}).filter(([,qty])=>Number(qty)!==0)
      .map(([material,quantity])=>({
        ...madridDateTime(event.submitted_at), unit:event.unit, warehouse:event.warehouse,
        material, quantity:Number(quantity)
      })));
}
