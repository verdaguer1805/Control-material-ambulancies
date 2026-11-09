import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/AuditorManager.jsx',import.meta.url),'utf8');
test('admin hides revoked phones without merging people or changing active device permissions',()=>{
 const expression=source.match(/setRows\((\(data\|\|\[\]\)\.filter\(row=>row.active===true\))\)/)?.[1];
 assert.ok(expression);
 const filter=new Function('data',`return ${expression}`);
 const one={user_id:'phone-one',full_name:'Same Person',active:true,zone:'Zone A',lot:'Lot 5'};
 const two={user_id:'phone-two',full_name:'Same Person',active:true,zone:'Zone B',lot:'Lot 7'};
 const old={user_id:'old-phone',full_name:'Same Person',active:false};
 assert.deepEqual(filter([old,one,two]),[one,two]);
 assert.deepEqual(filter([old]),[]);assert.deepEqual(filter(null),[]);
 assert.equal(one.active,true);assert.equal(two.active,true);
 assert.match(source,/key=\{row.user_id\}/);
 assert.match(source,/varios móviles autorizados/);
});
