import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'โปรแกรมจัดเรียงและตัดต่อเพลงแฟลชไดร์ฟ',
        short_name: 'จัดเรียงเพลง',
        description: 'จัดเรียงเพลงและบันทึกลงแฟลชไดร์ฟสำหรับลำโพง',
        theme_color: '#16a34a',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  base: './' // Allows running as static file or GitHub Pages subpath
});
