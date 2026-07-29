import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Разрешаем доступ через туннель localtunnel для тестирования
    // Telegram-виджета (он требует реальный домен, не localhost).
    // Домен меняется при каждом перезапуске localtunnel — обновляйте здесь.
    allowedHosts: ['sad-animals-bake.loca.lt'],
  },
})
