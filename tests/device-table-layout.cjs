const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const css=['styles','overrides','material-selection','stock-demo','guard','device-security'].map(n=>fs.readFileSync(`src/${n}.css`,'utf8')).join('\n');
  for(const width of [320,375,430,1280]){
   const page=await browser.newPage({viewport:{width,height:800}});
   await page.setContent(`<style>${css}</style><div class="device-table-scroll" style="width:calc(100vw - 32px);height:250px"><table class="device-management-table"><thead><tr><th>Unidad / dispositivo</th><th>Tipo</th><th>Lote / zona</th><th>Estado</th><th>Última conexión</th><th>Acción</th></tr></thead><tbody>${Array.from({length:12},(_,i)=>`<tr class="device-active-row"><td><strong>G453</strong><small>ID: prueba-${i}</small></td><td>TSU</td><td>Lot 5 · Girona - Alt Maresme</td><td>ACTIVO</td><td>17/09/2026 12:00</td><td><button>Revocar</button></td></tr>`).join('')}</tbody></table></div>`);
   await page.locator('.device-table-scroll').evaluate(e=>{e.removeAttribute('style');const backdrop=document.createElement('div');backdrop.className='modal-backdrop';const modal=document.createElement('div');modal.className='card export-modal device-manager-modal';e.replaceWith(backdrop);backdrop.append(modal);modal.append(e)});
   const modalBox=await page.locator('.device-manager-modal').boundingBox();
   assert(modalBox.width<=width && modalBox.width>=width-45);
   for(const scroll of (width>=1000?[0]:[10000])){
    await page.locator('.device-table-scroll').evaluate((e,x)=>{e.scrollLeft=x},scroll);
    const box=await page.locator('.device-table-scroll').boundingBox();
    const button=await page.getByRole('button',{name:'Revocar'}).first().boundingBox();
    assert(button.x>=box.x && button.x+button.width<=box.x+box.width,`Revocar outside viewport at ${width}, scroll ${scroll}`);
    assert(button.height>=44);
   }
   await page.close();
  }
  console.log('PASS: full CSS cascade; wider modal at 320/375/430/1280px; desktop action visible without scroll, mobile action reachable by scroll; 44px touch target. No live revocation.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
