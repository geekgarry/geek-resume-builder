import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // build: {
    //   rollupOptions: {
    //     output: {
    //       format: 'esm', // 对于模块化输出
    //     },
    //   },
    // },
    worker: {
      format: 'esm', // 确保这是正确的格式，如果你的 Worker 是模块化的
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // host: '0.0.0.0',
      // port: 3000,
      proxy: {
        '/resume-app': {
          target: 'http://localhost:9901',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/resume-app/, ''),
          // 代理配置中增加请求体大小限制
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // 设置较大的请求体大小限制
              req.headers['content-length'] = req.headers['content-length'] || '52428800'; // 50MB
            });
          }
        },
      },
    },
  };
});
