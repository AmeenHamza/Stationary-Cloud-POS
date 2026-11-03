/**
 * Values never written to logs (SYSTEM_DESIGN.md §9.4, INSTRUCTIONS.md §6): credentials, cookies,
 * keys and the request bodies that could contain them. pino replaces them with "[redacted]".
 */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.signupSecret',
  '*.SIGNUP_SECRET',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.apiKey',
  '*.token',
  '*.tokenHash',
  '*.passwordHash',
  '*.groqApiKeyCiphertext',
] as const;
