import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// 纯函数单测（打印模板 / 金额大写 / Excel 读写）：不需要浏览器与后端，可在 CI 里跑
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',   // 打印模板依赖 print-service，后者在模块级引用 jspdf/html2canvas
    testTimeout: 20000,
  },
});
