import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const start=source.indexOf('stockReplenishmentGroups = (() => {');
const end=source.indexOf('stockUrgentCount =',start);
const expression=source.slice(start,end).replace(/^stockReplenishmentGroups = /,'').trim().replace(/,$/,'');
function groups({quantity=12,minimum=12,type='standard',scope='lot5_olot',subQuantity=1}={}) {
  const central=scope+'_central',sub=scope+'_sub';
  return vm.runInNewContext(expression,{
    stockScopeAllowed:true,stockRemoteLoaded:true,
    STOCK_DEMO_CENTRAL:central,STOCK_DEMO_LOCATIONS:[central,sub],STOCK_DEMO_MATERIALS:['Test'],
    stockDemo:{levels:{[central]:{Test:quantity},[sub]:{Test:subQuantity}}},
    stockMinimums:{[central]:{Test:minimum},[sub]:{Test:2}},
    stockPendingReplenishment:{[central]:{Test:20},[sub]:{Test:1}},
    stockMaterialTypes:{Test:type}
  });
}
test('central orders use actual stock only for all material types, zones and lots',()=>{
  for(const scope of ['lot5_olot','lot5_figueres','lot7_other'])for(const type of ['standard','supervisor']){
    const result=groups({scope,type});
    assert.equal(result[0].items.length,0,'12 in stock / minimum 12 means no order, even when subwarehouse needs one');
    assert.equal(result[1].items[0].replenish,1,'subwarehouse need remains visible separately');
    const afterTransfer=groups({scope,type,quantity:11,subQuantity:2});
    assert.equal(afterTransfer[0].items[0].replenish,1,'only actual stock reduction creates central order');
    assert.equal(afterTransfer[0].items[0].urgent,true);
    assert.equal(groups({scope,type,quantity:13})[0].items.length,0);
    assert.equal(groups({scope,type,minimum:0})[0].items.length,0);
  }
});
