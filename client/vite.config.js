import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function spaFallback() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        const [pathname, search = ''] = String(req.url || '').split('?')
        if (
          pathname.startsWith('/@') ||
          pathname.startsWith('/__') ||
          pathname.startsWith('/src/') ||
          pathname.startsWith('/node_modules/') ||
          pathname.startsWith('/api/') ||
          pathname === '/ws' ||
          pathname.includes('.')
        ) {
          return next()
        }
        if (pathname !== '/' && pathname !== '/index.html') {
          req.url = '/index.html' + (search ? '?' + search : '')
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  appType: 'spa',
  plugins: [spaFallback(), react()],
  // Клиент ходит на свой origin (как через nginx на 8081), поэтому в dev API проксируется.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: '../proxy/html',
    emptyOutDir: true,
  },
})
