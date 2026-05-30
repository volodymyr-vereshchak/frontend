import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Load non-secret runtime config (GET /config) into window.APP_CONFIG before
// rendering, so global settings like the commercial-day contract hour are
// available everywhere. Best-effort: on failure the app uses built-in defaults.
async function loadRuntimeConfig() {
  const base = import.meta.env.VITE_API_URL || (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '/api'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${base}/config`, { credentials: 'include', signal: controller.signal })
    if (res.ok) {
      const cfg = await res.json()
      window.APP_CONFIG = window.APP_CONFIG || {}
      window.APP_CONFIG.GRS_CONFIG = {
        ...(window.APP_CONFIG.GRS_CONFIG || {}),
        ...(Number.isInteger(cfg.contract_hour) ? { CONTRACT_HOUR: cfg.contract_hour } : {}),
      }
    }
  } catch (_) {
    // ignore — fall back to built-in defaults (config/grsConfig.js)
  } finally {
    clearTimeout(timer)
  }
}

loadRuntimeConfig().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
