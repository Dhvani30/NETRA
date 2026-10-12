import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/ui/primitives.css'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import './theme.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const routeContent = path === '/'
  ? <LandingPage />
  : path === '/dashboard'
    ? <App />
    : (
      <main className="route-not-found">
        <h1>Page not found</h1>
        <p>This NETRA route does not exist.</p>
        <a href="/">Return to NETRA</a>
      </main>
    )

createRoot(document.getElementById('root')).render(
  <StrictMode>{routeContent}</StrictMode>,
)
