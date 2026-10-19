import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
test('current owner-approved Falck symbol is shared by the app, admin icons, offline cache and PDF',()=>{
 const main=read('src/main.jsx');
 assert.ok(main.includes('src="./falck-symbol-2026.png"'));
 assert.ok(main.includes("import FALCK_PDF_LOGO from './assets/falck-symbol-2026.png?inline'"));
 assert.ok(main.includes('doc.addImage(FALCK_PDF_LOGO, "PNG", 270, 2, 14, 14)'));
 assert.ok(!main.includes('falck-header.png'));
 assert.ok(!main.includes('const FALCK_PDF_LOGO ='));
 const publicIcon=fs.readFileSync(new URL('../public/falck-symbol-2026.png',import.meta.url));
 const pdfIcon=fs.readFileSync(new URL('../src/assets/falck-symbol-2026.png',import.meta.url));
 assert.deepEqual(publicIcon,pdfIcon);
 assert.equal(publicIcon.readUInt32BE(16),240);assert.equal(publicIcon.readUInt32BE(20),240);
 for(const file of ['public/admin/index.html','public/admin.html','public/admin/manifest.webmanifest','public/admin-manifest.webmanifest','public/sw.js']){
  const code=read(file);assert.ok(code.includes('falck-symbol-2026.png'),file);assert.ok(!code.includes('falck-eagle-admin.png'),file);
 }
 const admin=JSON.parse(read('public/admin/manifest.webmanifest'));
 assert.equal(admin.id,'/Control-material-ambulancies/admin/');
 assert.equal(admin.scope,'/Control-material-ambulancies/admin/');
 assert.equal(admin.start_url,'/Control-material-ambulancies/admin/');
 assert.equal(admin.icons[0].sizes,'240x240');
 const css=read('src/falck-brand.css');
 assert.match(css,/width:112px/);assert.match(css,/height:112px/);assert.match(css,/object-fit:contain/);
 assert.ok(main.indexOf("import './falck-brand.css'")>main.indexOf('import "./styles.css"'));
});
