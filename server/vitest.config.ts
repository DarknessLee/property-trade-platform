import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// NestJS 依赖 reflect-metadata 的装饰器元数据，esbuild 不生成；用 SWC 转换保证控制器/守卫可注入。
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    reporters: ['default'],
  },
});
