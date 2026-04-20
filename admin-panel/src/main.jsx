import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { APP_BRAND_NAME, applyTheme, loadTheme } from './theme/theme'

applyTheme(loadTheme())
document.title = APP_BRAND_NAME

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
