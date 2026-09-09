export {
  escapeHtml,
  interpolate,
  placeholdersIn,
  unknownVariables,
  UnknownVariableError,
} from "./interpolate.ts";
export { EmailLayout, renderLayout, wrapText } from "./layout.tsx";
export {
  compileNewsletter,
  isSafeUrl,
  newsletterBlockSchema,
  newsletterBlocksSchema,
  parseNewsletterBlocks,
  type CompiledNewsletter,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterParseResult,
} from "./newsletter.ts";
export {
  createResendProvider,
  resendProviderFromEnv,
  type EmailProvider,
  type OutboundEmail,
} from "./provider.ts";
export { renderTemplate, type RenderedEmail, type StoredTemplate } from "./render.ts";
export { sendTemplateEmail, type SendResult } from "./send.ts";
export {
  customTemplateKey,
  isCustomTemplateKey,
  isTemplateKey,
  sampleContext,
  variablesFor,
  variablesForCustom,
  BROADCAST_KEY,
  BROADCAST_VARIABLES,
  CUSTOM_KEY_PREFIX,
  MESSAGE_VARIABLES,
  TEMPLATE_KEYS,
  TEMPLATE_LABELS,
  TEMPLATE_VARIABLES,
  type CustomTemplateKey,
  type MessageKey,
  type TemplateContext,
  type TemplateKey,
  type TemplateVariable,
} from "./templates.ts";
