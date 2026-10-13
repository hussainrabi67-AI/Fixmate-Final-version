/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_N8N_AI_CHAT_WEBHOOK?: string
  readonly VITE_N8N_CHAT_WEBHOOK?: string
  readonly VITE_N8N_WEBHOOK_URL?: string
  readonly VITE_N8N_NEW_SERVICE_REQUEST_WEBHOOK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
