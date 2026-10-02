export type Build = {
  id: string
  name: string
  source: string
  status: string
  risk: string
  findings: number
  created_at: string
  summary: string
}

export type Worker = {
  id: string
  name: string
  kind: string
  status: string
  last_seen: string
  version: string
}

export type Policy = {
  id: string
  name: string
  rule: string
  action: 'alert' | 'quarantine' | 'block'
  enabled: boolean
  updated_at: string
}

export type Overview = {
  builds: number
  active_workers: number
  quarantined: number
  critical_findings: number
  recent_builds: Build[]
}

export type SapIntegration = {
  configured: boolean
  base_url?: string
  token_url?: string
  client_id?: string
  api_path?: string
  scopes?: string
  auth_method?: string
  connected_at?: string | null
}

export type SapTest = {
  connected: boolean
  http_status: number
  sap_service: string
  records_returned: number | null
  checked_at: string
  message: string
}

const config = window.__APP_CONFIG__ ?? {}
const baseUrl = (config.apiUrl || 'http://localhost:8000').replace(/\/$/, '')

export async function request<T>(
  path: string,
  mode: 'demo' | 'live',
  accessToken?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('X-Workspace-Mode', mode)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export { config }
