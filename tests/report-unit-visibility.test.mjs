import test from 'node:test';
import assert from 'node:assert/strict';
import {reportUnitVisible,filterReportUnits} from '../src/report-unit-visibility.mjs';
const lot='Lot 5 · Girona - Alt Maresme';
test('temporary exclusions apply only to the requested report scope',()=>{
 for(const unit of ['G205','G215','G305']) {
  assert.equal(reportUnitVisible(lot,'Olot',unit),false);
  assert.equal(reportUnitVisible(lot,'Girona',unit),true);
  assert.equal(reportUnitVisible('Another lot','Olot',unit),true);
 }
 assert.equal(reportUnitVisible(lot,'Olot','G450'),true);
});
test('report filters hide both real and missing records without modifying history or audits',()=>{
 const records=[{unit:'G205'},{unit:'G450'},{unit:'G305'},{unit:'G215'}];
 const data={records,submissions:records,svbChecklists:records,svbRoster:records,vehicleAudits:[{vehicle:'5439'}],tsnu:{shifts:[{unit:'T1735'}],withdrawals:[],roster:[]}};
 const original=JSON.stringify(data),result=filterReportUnits(data,lot,'Olot');
 for(const key of ['records','submissions','svbChecklists','svbRoster'])assert.deepEqual(result[key],[{unit:'G450'}]);
 assert.equal(JSON.stringify(data),original);
 assert.deepEqual(result.vehicleAudits,data.vehicleAudits);
 assert.deepEqual(result.tsnu.shifts,[{unit:'T1735'}]);
 assert.equal(filterReportUnits({...data,svbRoster:null},lot,'Olot').svbRoster,null);
});
