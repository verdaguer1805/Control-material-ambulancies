import test from "node:test";
import assert from "node:assert/strict";
import { madridDateTime, mapReportRecords, supervisorReportEvents } from "../src/report-datetime.mjs";
import { guardSaveRequest } from "../src/guard-recovery-client.mjs";
const unit="Material Supervisor · Olot";
test("Madrid natural midnight is not attributed to the previous UTC date",()=>{
  assert.deepEqual(madridDateTime("2026-10-06T22:00:00Z"),{date:"2026-10-07",time:"00:00:00"});
  assert.deepEqual(madridDateTime("2026-12-06T23:00:00Z"),{date:"2026-12-07",time:"00:00:00"});
});
test("supervisor report uses actual submission time and natural guard day",()=>{
  const row={incident_code:"071026",unit,occurred_at:"2026-10-06T22:00:00Z",created_at:"2026-10-07T10:15:34Z",materials:{"Bobina de papel":1}};
  const reports=mapReportRecords([row],[{unit,guard_code:"071026",submitted_at:"2026-10-07T11:20:36Z"}]);
  assert.equal(reports[0].date,"2026-10-07");assert.equal(reports[0].time,"13:20:36");
  assert.equal(mapReportRecords([row])[0].time,"12:15:34");
});
test("units retain their shift start and use Madrid date",()=>{
  const row={incident_code:"071026",unit:"G450",occurred_at:"2026-10-07T06:00:00Z",created_at:"2026-10-07T11:00:00Z"};
  assert.equal(mapReportRecords([row])[0].time,"08:00");
});
test("supervisor event detail uses deltas and exact time without duplicate totals",()=>{
  const events=[
    {unit,submitted_at:"2026-10-07T10:15:34Z",material_delta:{"Bobina de papel":1}},
    {unit,submitted_at:"2026-10-07T11:20:36Z",material_delta:{"Bobina de papel":1}},
    {unit,submitted_at:"2026-10-07T12:00:00Z",material_delta:{}},
    {unit:"Material Supervisor · Girona",submitted_at:"2026-10-07T12:00:00Z",material_delta:{X:5}}
  ];
  const rows=supervisorReportEvents(events,"Olot","2026-10-07","2026-10-07");
  assert.equal(rows.length,2);assert.equal(rows[0].time,"12:15:34");assert.equal(rows[1].time,"13:20:36");
  assert.equal(rows.reduce((total,row)=>total+row.quantity,0),2);
});
test("actual displayed consumption time does not change the stable guard timestamp sent to server",()=>{
  const record={id:"071026",date:"2026-10-07",time:"12:15:34",guardOccurredAt:"2026-10-06T22:00:00Z",entries:[{materials:{"Bobina de papel":1}}]};
  assert.equal(guardSaveRequest(record,unit,"Olot").args.p_occurred_at,"2026-10-06T22:00:00Z");
});
