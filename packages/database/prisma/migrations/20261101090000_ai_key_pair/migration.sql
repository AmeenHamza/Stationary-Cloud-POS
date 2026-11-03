-- F-30 (DATABASE.md §4.3): the Groq key ciphertext and its last 4 characters are set and cleared
-- together, so `groq_api_key_last4 IS NOT NULL` alone means "a key is configured". Additive only.
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_ai_key_ck" CHECK (
  ("groq_api_key_ciphertext" IS NULL) = ("groq_api_key_last4" IS NULL)
  AND ("groq_api_key_last4" IS NULL OR char_length("groq_api_key_last4") = 4)
);
