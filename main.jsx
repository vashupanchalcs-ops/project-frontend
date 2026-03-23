import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext.jsx'

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://swiftrescue-backend.onrender.com'
).replace(/\/+$/, '')

const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  if (typeof input === 'string' && input.startsWith('http://127.0.0.1:8000')) {
    input = input.replace('http://127.0.0.1:8000', API_BASE)
  }
  if (typeof input === 'string' && input.startsWith('http://localhost:8000')) {
    input = input.replace('http://localhost:8000', API_BASE)
  }
  return nativeFetch(input, init)
}

createRoot(document.getElementById('root')).render(
  <>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </>
)
