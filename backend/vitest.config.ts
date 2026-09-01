import { defineConfig } from 'vitest/config';

// 纯函数单测：不连数据库、不起服务，可在 CI 里跑
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
});
