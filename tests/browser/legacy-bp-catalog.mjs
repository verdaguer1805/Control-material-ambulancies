import {execFileSync} from 'node:child_process';
// Exact catalog and photo mapping from v274, before the intervention-bag expansion.
export async function legacyBpCatalog(){
 const get=file=>execFileSync('git',['show',`3ff566f:src/${file}`],{encoding:'utf8'});
 const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const catalog=url(get('bp-checklist-catalog.mjs'));
 const photos=url(get('bp-photo-draft.mjs').replace("'./bp-checklist-catalog.mjs'",JSON.stringify(catalog)));
 const quantity=url(get('bp-quantity.mjs'));
 const operational=get('bp-operational.mjs').replace("'./bp-photo-draft.mjs'",JSON.stringify(photos)).replace("'./bp-checklist-catalog.mjs'",JSON.stringify(catalog)).replace("'./bp-quantity.mjs'",JSON.stringify(quantity));
 return (await import(url(operational))).BP_ITEMS;
}
