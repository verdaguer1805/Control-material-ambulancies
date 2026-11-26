import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'dist-auditor-reopen-check',rollupOptions:{input:{main:'index.html',auditorDemo:'named-auditor-preview.html'}}}});
