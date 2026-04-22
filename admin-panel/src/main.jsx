import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { APP_BRAND_NAME, applyTheme, loadTheme } from './theme/theme'

applyTheme(loadTheme())
document.title = APP_BRAND_NAME

const rootElement = document.getElementById('root')

const renderFatalScreen = (title, message) => {
  if (!document.body) return

  document.body.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--jsm-bg, #fbf6f0);
      color: var(--jsm-text, #261c18);
      font-family: Inter, system-ui, sans-serif;
    ">
      <div style="
        width: min(640px, 100%);
        border: 1px solid var(--jsm-border, rgba(92, 70, 56, 0.14));
        border-radius: 28px;
        background: var(--jsm-panel-bg, rgba(255, 250, 245, 0.92));
        box-shadow: var(--jsm-shadow-premium, 0 16px 48px rgba(76, 53, 43, 0.1));
        padding: 32px;
      ">
        <div style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 999px;
          margin-bottom: 18px;
          background: rgba(185, 92, 88, 0.12);
          color: var(--jsm-gold-600, #b95c58);
          font-size: 24px;
          font-weight: 700;
        ">!</div>
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.3em; color: var(--jsm-text-muted, rgba(38, 28, 24, 0.64)); font-weight: 700; margin-bottom: 10px;">${APP_BRAND_NAME}</div>
        <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.15; color: var(--jsm-heading, #b95c58);">${title}</h1>
        <p style="margin: 0; font-size: 15px; line-height: 1.7; color: var(--jsm-text-muted, rgba(38, 28, 24, 0.64));">${message}</p>
      </div>
    </div>
  `
}

const handleFatalError = (event) => {
  const message = event?.error?.message || event?.message || 'An unexpected error occurred while loading the admin panel.'
  renderFatalScreen('Admin panel failed to load', message)
}

window.addEventListener('error', handleFatalError)
window.addEventListener('unhandledrejection', (event) => {
  const message =
    event?.reason?.message ||
    (typeof event?.reason === 'string' ? event.reason : null) ||
    'An unexpected promise rejection occurred while loading the admin panel.'
  renderFatalScreen('Admin panel failed to load', message)
})

if (!rootElement) {
  renderFatalScreen(
    'Mount point missing',
    'The application root element was not found in index.html. Check the Vite entry markup.',
  )
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  window.setTimeout(() => {
    if (rootElement.childElementCount === 0) {
      renderFatalScreen(
        'Nothing rendered',
        'React mounted without visible output. Check the browser console for the first runtime error.',
      )
    }
  }, 250)
}
