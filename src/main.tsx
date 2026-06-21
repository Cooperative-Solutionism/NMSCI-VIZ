import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary label="Application failed">
    <App />
  </ErrorBoundary>,
)
