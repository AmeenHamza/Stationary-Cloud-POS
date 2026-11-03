import { graphql } from '@/graphql/__generated__';

/** Shop profile and default Bill GST (Q26). `ShopSettings` is a cache singleton (keyFields: []). */
export const ShopSettingsDocument = graphql(`
  query ShopSettings {
    shopSettings {
      shopName
      address
      phone
      receiptFooter
      exchangeReturnPolicy
      logoDataUrl
      defaultBillGstRate
      version
    }
  }
`);

export const UpdateShopSettingsDocument = graphql(`
  mutation UpdateShopSettings($input: UpdateShopSettingsInput!) {
    updateShopSettings(input: $input) {
      shopName
      address
      phone
      receiptFooter
      exchangeReturnPolicy
      logoDataUrl
      defaultBillGstRate
      version
    }
  }
`);

/** Groq key status (F-30): admins only (SEC-03). Merges into the `ShopSettings` cache singleton. */
export const AiKeyStatusDocument = graphql(`
  query AiKeyStatus {
    shopSettings {
      aiKeyConfigured
      aiKeyLast4
    }
  }
`);

export const SetAiApiKeyDocument = graphql(`
  mutation SetAiApiKey($input: SetAiApiKeyInput!) {
    setAiApiKey(input: $input) {
      aiKeyConfigured
      aiKeyLast4
    }
  }
`);

export const ClearAiApiKeyDocument = graphql(`
  mutation ClearAiApiKey {
    clearAiApiKey {
      aiKeyConfigured
      aiKeyLast4
    }
  }
`);
