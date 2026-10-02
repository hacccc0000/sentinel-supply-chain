/// <reference types="vite/client" />

interface Window {
  __APP_CONFIG__?: {
    apiUrl?: string
    entraClientId?: string
    entraAuthority?: string
    apiScope?: string
  }
}
