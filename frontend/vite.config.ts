import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// 版本号唯一来源：根目录 package.json（发版只需改一处）
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

export default defineConfig({
  base: './',
  // 打印附件正文时才按需加载 pdf.js：pre-bundle 避免首次打印时 Vite 发现新依赖触发整页重载
  optimizeDeps: { include: ['pdfjs-dist'] },
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: '@use "@/styles/variables.scss" as *;',
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 8000,
  },
});
