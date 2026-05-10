import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_STELLAR_NETWORK ?? 'testnet',
  tracesSampleRate: 0.2,
  release: 'palengkepay@1.0.0',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
