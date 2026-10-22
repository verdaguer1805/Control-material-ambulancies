import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('central receipt correction uses real quantities and server-side actor for every warehouse',()=>{
 const sql=fs.readFileSync(new URL('../sql/central-receipt-traceability-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/perform public.require_admin_warehouse\(p_warehouse_id\)/);
 assert.match(sql,/where user_id=auth.uid\(\) and expires_at>now\(\)/);
 assert.match(sql,/set default 0/);
 assert.match(sql,/values\(p_warehouse_id,v_material,v_quantity,now\(\)\)/);
 assert.match(sql,/operation_id,performed_role,performed_zone,actor_user_id/);
 assert.match(sql,/v_operation,v_role,v_zone,auth.uid\(\)/);
 assert.doesNotMatch(sql,/300|lot5_olot|grant execute|delete from/i);
 assert.doesNotMatch(sql,/^update public\./m);
 const legacy=fs.readFileSync(new URL('../supabase_stock_olot.sql',import.meta.url),'utf8');
 const receive=legacy.slice(legacy.indexOf('create or replace function public.receive_central_stock('),legacy.indexOf('create or replace function public.transfer_stock('));
 assert.doesNotMatch(receive,/300/);
});
