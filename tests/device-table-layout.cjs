const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const css=fs.readFileSync('src/overrides.css','utf8');
  for(const width of [320,375,430,1280]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.setContent(`<style>${css}</style><div class="device-table-scroll" style="width:calc(100vw - 32px);height:250px"><table class="device-management-table"><thead><tr><th>Unidad / dispositivo</th><th>Tipo</th><th>Lote / zona</th><th>Estado</th><th>Última conexión</th><th>Acción</th></tr></thead><tbody>${Array.from({length:12},(_,i)=>`<tr class="device-active-row"><td><strong>G453</strong><small>ID: prueba-${i}</small></td><td>TSU</td><td>Lot 5 · Girona - Alt Maresme</td><td>ACTIVO</td><td>17/09/2026 12:00</td><td><button>Revocar</button></td></tr>`).join('')}</tbody></table></div>`);
   for(const scroll of [0,250,1000]){
    await page.locator('.device-table-scroll').evaluate((e,x)=>{e.scrollLeft=x},scroll);
    const box=await page.locator('.device-table-scroll').boundingBox();
    const button=await page.getByRole('button',{name:'Revocar'}).first().boundingBox();
    assert(button.x>=box.x && button.x+button.width<=box.x+box.width,`Revocar outside viewport at ${width}, scroll ${scroll}`);
    assert(button.height>=44);
   }
   await page.close();
  }
  console.log('PASS: Revocar visible at 320/375/430/1280px before and after horizontal scroll; 44px touch target. Layout fixture only; no live revocation.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
