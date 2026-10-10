import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FormPage from './FormPage'
import { JUDGE_FORM } from './config'
import '../index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FormPage def={JUDGE_FORM} />
  </StrictMode>,
)
