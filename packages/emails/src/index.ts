export {
  escapeHtml,
  interpolate,
  placeholdersIn,
  unknownVariables,
  UnknownVariableError,
} from "./interpolate.ts";
export { EmailLayout, renderLayout, wrapText } from "./layout.tsx";
export {
  createResendProvider,
  resendProviderFromEnv,
  type EmailProvider,
  type OutboundEmail,
} from "./provider.ts";
export { renderTemplate, type RenderedEmail, type StoredTemplate } from "./render.ts";
export { sendTemplateEmail, type SendResult } from "./send.ts";
export {
  isTemplateKey,
  sampleContext,
  variablesFor,
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  TEMPLATE_VARIABLES,
  type TemplateContext,
  type TemplateKey,
  type TemplateVariable,
} from "./templates.ts";
