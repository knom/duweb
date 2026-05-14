import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawBasePath = env.VITE_BASE_PATH ?? '/'
  const normalizedBasePath =
    rawBasePath === '/' ? '/' : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}/`
  const basePrefix = normalizedBasePath === '/' ? '' : normalizedBasePath.slice(0, -1)
  const subpathApiPrefix = `${basePrefix}/api`

  return {
    base: normalizedBasePath,
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        ...(subpathApiPrefix !== '/api'
          ? {
              [subpathApiPrefix]: {
                target: 'http://localhost:3001',
                changeOrigin: true,
                rewrite: (path) =>
                  path.startsWith(basePrefix) ? path.slice(basePrefix.length) : path,
              },
            }
          : {}),
      },
    },
  }
})
