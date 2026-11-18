import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
          ['@babel/plugin-transform-class-properties', { loose: false }],
        ],
      },
    }),
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss({ content: ['./src/**/*.{ts,tsx}'], darkMode: 'class' }),
        autoprefixer(),
      ],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.message.includes('use client')
        )
          return;
        warn(warning);
      },
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
    esbuildOptions: { target: 'es2022' },
    include: [
      '@stardustai/annotation-client',
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-dom/server',
      'antd',
      'antd/es/form/FormItem',
      'antd/es/locale/zh_CN',
      'antd/es/locale/en_US',
      'antd/lib/checkbox/Checkbox',
      'mobx',
      'mobx-react',
      'i18next',
      'react-is',
    ],
  },
});
