import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The Android app is a WebView, so startup parse/compile time matters as much as
 * the final APK size. App.tsx historically imported every primary tab eagerly.
 * This build transform turns those five imports into React.lazy() imports while
 * keeping the source API unchanged. Only the active tab is downloaded/parsed.
 */
function lazyPrimaryTabs(): Plugin {
  const tabImports = [
    ['DialerTab', './components/DialerTab'],
    ['RecentsTab', './components/RecentsTab'],
    ['ContactsTab', './components/ContactsTab'],
    ['ProtectionTab', './components/ProtectionTab'],
    ['AssistantTab', './components/AssistantTab'],
  ] as const;

  return {
    name: 'vigilshield-lazy-primary-tabs',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/App.tsx') && !id.endsWith('\\src\\App.tsx')) return null;

      let next = code;
      let changed = false;

      for (const [name, modulePath] of tabImports) {
        const importLine = `import ${name} from '${modulePath}';`;
        if (next.includes(importLine)) {
          next = next.replace(importLine, `const ${name} = lazy(() => import('${modulePath}'));`);
          changed = true;
        }
      }

      if (!changed) return null;

      next = next.replace(
        "import { useEffect, useState, useRef, useCallback, useMemo } from 'react';",
        "import { lazy, Suspense, useEffect, useState, useRef, useCallback, useMemo } from 'react';",
      );

      // The primary tab region is the only place where lazy components are mounted.
      // A tiny fallback avoids a blank screen while the first tab chunk is parsed.
      const mainOpen = '<main className="mx-auto w-full max-w-4xl px-3 py-3 pb-28 sm:pb-32">';
      if (next.includes(mainOpen)) {
        next = next.replace(mainOpen, `${mainOpen}\n    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-xs text-slate-500">Loading…</div>}>`);
        const mainClose = '   </main>';
        next = next.replace(mainClose, '    </Suspense>\n   </main>');
      }

      return { code: next, map: null };
    },
  };
}

export default defineConfig(() => {
  return {
    // Android WebView loads the production bundle from file:///android_asset/.
    // Relative asset URLs are required; absolute /assets URLs resolve incorrectly.
    base: './',
    plugins: [
      lazyPrimaryTabs(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: './',
          name: 'VigilShield',
          short_name: 'VigilShield',
          description: 'Intelligent caller ID and spam protection.',
          theme_color: '#0f172a',
          background_color: '#020617',
          display: 'standalone',
          orientation: 'portrait',
          start_url: './',
          scope: './',
          categories: ['utilities', 'productivity'],
          icons: [
            { src: './pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: './pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: './pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-core': ['react', 'react-dom'],
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
