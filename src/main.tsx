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

// Register service worker for offline capabilities and WebAPK install
registerSW({
  immediate: true,
  onOfflineReady() {
    console.log('SpamShield is ready for offline and WebAPK install');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
