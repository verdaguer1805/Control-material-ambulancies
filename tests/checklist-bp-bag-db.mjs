import {PGlite} from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {BP_ITEMS} from '../src/bp-operational.mjs';
const db=new PGlite();
const legacySql=fs.readFileSync('sql/bp-production-v1.sql','utf8');
const lines=legacySql.split('\n').filter(l=>l.includes('jsonb_array_length(p_items)<>222')||l.includes("bp-item-3"));
await db.exec(`create role anon; create role authenticated;
create function public.submit_bp_checklist(p_guard_code text,p_vehicle_label text,p_guard_started_at timestamptz,p_items jsonb) returns jsonb language plpgsql as $$ begin
 if p_guard_code='denied' then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;
 ${lines.join('\n').replaceAll(' then raise exception', ' then\r\n raise exception').replaceAll('; end if;', ';\r\n end if;').replaceAll("','bp-item-", "',\r\n'bp-item-")}
 if exists(select 1 from jsonb_array_elements(p_items)x where coalesce(x->>'status','') not in ('ok','issue')) then raise exception 'INCOMPLETE_BP_CHECKLIST'; end if;
 return p_items; end $$;
create function public.submit_tsnu_checklist(p_shift_id uuid,p_answers jsonb) returns jsonb language plpgsql as $$
declare v_shift record;v_required text[]:=array['DEA'];v_new text[]:=array['Linterna + cono'];v_allowed text[];
begin
 select p_answers->>'unit' as unit into v_shift;
 v_allowed:=v_required || array['Sabanas de un solo uso'] || v_new;
 if exists(select 1 from jsonb_object_keys(p_answers)x where x<>'unit' and not(x=any(v_allowed))) then raise exception 'INCOMPLETE_CHECKLIST'; end if;
 return p_answers;end $$;`);
const migration=fs.readFileSync('sql/checklist-bp-bag-tango-2026-11-19.sql','utf8');
await db.exec(migration);await db.exec(migration);
const legacy=[...legacySql.matchAll(/'bp-item-[0-9]+'/g)].map(m=>({id:m[0].slice(1,-1),status:'ok'}));
const current=BP_ITEMS.map(i=>({...i,status:'ok'}));
const submit=(items,guard='ok')=>db.query('select public.submit_bp_checklist($1,$2,now(),$3::jsonb)',[guard,'5438',JSON.stringify(items)]);
await submit(current);await submit(legacy);
await assert.rejects(submit(current.slice(1)),/INVALID_BP_CATALOG/);
await assert.rejects(submit([...current.slice(1),current[1]]),/INVALID_BP_CATALOG/);
await assert.rejects(submit([...current,{id:'bp-item-999',status:'ok'}]),/INVALID_BP_CATALOG/);
await assert.rejects(submit(current.map((x,i)=>i?x:{...x,status:'pending'})),/INCOMPLETE_BP_CHECKLIST/);
await assert.rejects(submit(current,'denied'),/DEVICE_NOT_AUTHORIZED/);
for(const family of ['T','K','KE','KB','VL']){
 const send=answers=>db.query('select public.submit_tsnu_checklist(null,$1::jsonb)',[JSON.stringify({unit:family+'999',DEA:'ok',...answers})]);
 await send({});
 if(family==='T')await send({'Martillo rompecristales':'ok'});
 else await assert.rejects(send({'Martillo rompecristales':'ok'}),/INCOMPLETE_CHECKLIST/);
}
await db.close();console.log('PASS: SQL idempotent; old/new complete BP accepted, missing/duplicate/unknown rejected; only T hammer; authorization retained.');
