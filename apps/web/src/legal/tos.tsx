import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LegalPage from './LegalPage'
import source from '../../content/TERMS.md?raw'
import '../index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LegalPage source={source} />
  </StrictMode>,
)
