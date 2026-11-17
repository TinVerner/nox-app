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
})
