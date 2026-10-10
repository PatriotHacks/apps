import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FormPage from './FormPage'
import { VOLUNTEER_FORM } from './config'
import '../index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormPage def={VOLUNTEER_FORM} />
  </StrictMode>,
)
