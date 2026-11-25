import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Shown in Settings so it's easy to tell which version is running on a phone.
const commit = (process.env.GITHUB_SHA ?? (() => {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})()).slice(0, 7);
const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

// Relative base so the same build works on GitHub Pages (/lingo-ai-tutor/) and inside the Android app.
// Published next to the app so a running copy can tell a newer version is live.
const versionFile = (): Plugin => ({
  name: 'lingo-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ commit, builtAt }) });
  },
});

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(`${commit} · ${builtAt} UTC`),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    react(),
    versionFile(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        name: 'Lingo — AI Language Tutor',
        short_name: 'Lingo',
        description: 'Talk with a friendly AI tutor in real time and learn a language naturally.',
        lang: 'he',
        dir: 'auto',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fffaf0',
        theme_color: '#ffc93c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Push + notification-click handlers for daily reminders.
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2,mp4}'],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } },
          },
        ],
      },
    }),
  ],
  css: { modules: { localsConvention: 'camelCaseOnly' } },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
