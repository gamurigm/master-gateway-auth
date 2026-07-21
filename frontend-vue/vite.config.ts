import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4200,
    proxy: {
      // 127.0.0.1 en vez de localhost: en Windows `localhost` resuelve a ::1
      // (IPv6) primero, pero el backend escucha en 0.0.0.0 (IPv4), así que el
      // proxy daba ECONNREFUSED ::1:3000. Forzar IPv4 lo evita.
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/inventario': {
        target: 'http://127.0.0.1:3007',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
