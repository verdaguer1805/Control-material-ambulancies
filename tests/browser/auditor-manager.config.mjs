import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'dist-auditor-manager-check',rollupOptions:{input:'tests/browser/auditor-manager-preview.html'}}});
