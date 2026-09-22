import {StrictMode, Component, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ThemeBootstrap from './components/ThemeBootstrap';
import { LanguageProvider } from './i18n/LanguageContext';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { runCallShieldTestSuite } from './tests/callerId.test';

const RECOVERABLE_STORAGE_KEYS = [
  'callshield_settings',
  'callshield_rules',
  'callshield_whitelist',
  'callshield_contacts',
  'callshield_calls',
  'callshield_timeline',
  'callshield_autocancel',
];

class AppErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  declare readonly props: {children: ReactNode};
  state = {error: null as Error | null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CallShield fatal UI error]', error, info.componentStack);
  }

  private safeStart = () => {
    // Only remove app-local persisted state. Never touch contacts, Android CallLog,
    // recordings, or other device data. This is a recovery path for corrupt cache/state.
    for (const key of RECOVERABLE_STORAGE_KEYS) {
      try { localStorage.removeItem(key); } catch (storageError) {
        console.warn('[CallShield recovery] Could not clear', key, storageError);
      }
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || 'Unknown application error';
    return (
      <div role="alert" style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, sans-serif'}}>
        <div style={{maxWidth: 520, width: '100%', textAlign: 'center', background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 10px 35px rgba(15,23,42,.12)'}}>
          <div style={{fontSize: 42, marginBottom: 12}}>⚠️</div>
          <h1 style={{fontSize: 24, margin: '0 0 10px'}}>CallShield needs to restart</h1>
          <p style={{fontSize: 15, lineHeight: 1.5, color: '#475569', margin: '0 0 20px'}}>{message}</p>
          <div style={{display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap'}}>
            <button onClick={() => window.location.reload()} style={{border: 0, borderRadius: 12, padding: '12px 20px', fontSize: 16, fontWeight: 700, background: '#0f172a', color: '#fff'}}>Reload</button>
            <button onClick={this.safeStart} style={{border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 20px', fontSize: 16, fontWeight: 700, background: '#fff', color: '#0f172a'}}>Safe start</button>
          </div>
          <p style={{fontSize: 12, color: '#64748b', marginTop: 16}}>Safe start resets only CallShield's local app state. Device contacts and call records are not deleted.</p>
        </div>
      </div>
    );
  }
}

window.addEventListener('error', (event) => {
  const msg = String(event.error?.message || event.message || '');
  if (msg.includes('vite') || msg.includes('websocket') || msg.includes('ResizeObserver')) {
    event.preventDefault();
    return;
  }
  console.warn('[CallShield window error]', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const reasonStr = String(reason?.message || reason || '');
  // Gracefully handle expected preview sandbox, websocket, audio, or service worker restrictions
  if (
    reasonStr.includes('ServiceWorker') ||
    reasonStr.includes('SecurityError') ||
    reasonStr.includes('operation is insecure') ||
    reasonStr.includes('websocket') ||
    reasonStr.includes('vite') ||
    reasonStr.includes('AbortError') ||
    reasonStr.includes('Failed to fetch') ||
    reasonStr.includes('AudioContext') ||
    reasonStr.includes('play()')
  ) {
    event.preventDefault();
    return;
  }
  console.warn('[CallShield unhandled rejection]', reason);
  event.preventDefault();
});

try {
  const testResults = runCallShieldTestSuite();
  console.info('[CallShield Test Suite] Validation results:', testResults);
} catch (e) {
  console.warn('[CallShield Test Suite] Execution notice:', e);
}

const isAndroidWrapper = typeof window !== 'undefined' &&
  typeof (window as Window & { AndroidTelecomBridge?: unknown }).AndroidTelecomBridge !== 'undefined';
const isIframe = typeof window !== 'undefined' && window.self !== window.top;

if (!isAndroidWrapper && !isIframe && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onOfflineReady() {
        console.log('CallShield is ready for offline and WebAPK install');
      },
      onRegisterError(error) {
        console.warn('[CallShield PWA] Service worker registration notice:', error);
      },
    });
  } catch (e) {
    console.warn('[CallShield PWA] Service worker unavailable:', e);
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('CallShield startup failed: root element is missing');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <LanguageProvider>
        <ThemeBootstrap />
        <App />
      </LanguageProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
