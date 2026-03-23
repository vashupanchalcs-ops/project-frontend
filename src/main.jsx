import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext.jsx'
import SmoothScrollProvider from './providers/SmoothScrollProvider_.jsx'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  if (typeof input === 'string' && input.startsWith('http://127.0.0.1:8000')) {
    input = input.replace('http://127.0.0.1:8000', API_BASE)
  }
  return nativeFetch(input, init)
}

createRoot(document.getElementById('root')).render(
  <>
    <BrowserRouter>
      <ThemeProvider>
        <SmoothScrollProvider>
          <App />
        </SmoothScrollProvider>
      </ThemeProvider>
    </BrowserRouter>
  </>
)
