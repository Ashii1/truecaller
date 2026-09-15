import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { runVigilShieldTestSuite } from './tests/callerId.test';

// Run verification test suite
try {
  const testResults = runVigilShieldTestSuite();
  console.info('[VigilShield Test Suite] Validation results:', testResults);
} catch (e) {
  console.error('[VigilShield Test Suite] Execution error:', e);
}

// The Android wrapper loads the bundle from file:///android_asset/.
// Service-worker registration is a browser/PWA concern and can fail on the
// Android WebView file origin. Never let that failure interfere with React.
const isAndroidWrapper = typeof window !== 'undefined' &&
  typeof (window as Window & { AndroidTelephony?: unknown }).AndroidTelephony !== 'undefined';

if (!isAndroidWrapper && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.log('VigilShield is ready for offline and WebAPK install');
      },
    });
  } catch (e) {
    console.warn('[VigilShield PWA] Service worker unavailable:', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
