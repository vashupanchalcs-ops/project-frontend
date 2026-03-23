import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './ThemeContext.jsx'
import SmoothScrollProvider from './providers/SmoothScrollProvider_.jsx'


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
