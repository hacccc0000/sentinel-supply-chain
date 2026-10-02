import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AccountInfo, AuthenticationResult, PublicClientApplication } from '@azure/msal-browser'
import {
  Activity,
  AlertOctagon,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Gauge,
  GitBranch,
  Layers3,
  LockKeyhole,
  LogIn,
  Menu,
  PackageCheck,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldEllipsis,
  ShieldX,
  Sparkles,
  TerminalSquare,
  ToggleLeft,
  ToggleRight,
  Workflow,
  X,
} from 'lucide-react'
import {
  config,
  request,
} from './api'
import type { Build, Overview, Policy, SapIntegration, SapTest, Worker } from './api'

type View = 'overview' | 'builds' | 'workers' | 'quarantine' | 'policies' | 'integrations'
type Mode = 'demo' | 'live'

const labels: Record<View, string> = {
  overview: 'Overview',
  builds: 'Build inventory',
  workers: 'Workers',
  quarantine: 'Quarantine',
  policies: 'Policy center',
  integrations: 'Integrations',
}

const navGroups: { title: string; items: { id: View; icon: typeof Gauge }[] }[] = [
  { title: 'OPERATIONS', items: [
    { id: 'overview', icon: Gauge },
    { id: 'builds', icon: Boxes },
    { id: 'workers', icon: Radio },
    { id: 'quarantine', icon: ShieldAlert },
  ] },
  { title: 'GOVERNANCE', items: [
    { id: 'policies', icon: FileCheck2 },
    { id: 'integrations', icon: Layers3 },
  ] },
]

const initialMode: Mode = config.entraClientId ? 'live' : 'demo'
function displayDate(value?: string) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  return <span className={`status-pill ${normalized.replaceAll(' ', '-')}`}><i />{value.replaceAll('_', ' ')}</span>
}

function IconTile({ icon: Icon, tone }: { icon: typeof ShieldCheck; tone: string }) {
  return <span className={`icon-tile ${tone}`}><Icon size={18} strokeWidth={1.8} /></span>
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><PackageCheck size={22} /></div><h3>{title}</h3><p>{text}</p>{action}</div>
}

function App() {
  const [view, setView] = useState<View>('overview')
  const [mode, setMode] = useState<Mode>(initialMode)
  const [msal, setMsal] = useState<PublicClientApplication | null>(null)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [authReady, setAuthReady] = useState(!config.entraClientId)
  const [data, setData] = useState<{ overview: Overview; builds: Build[]; workers: Worker[]; policies: Policy[]; sap: SapIntegration } | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [policyForm, setPolicyForm] = useState(false)
  const [buildForm, setBuildForm] = useState(false)
  const [workerForm, setWorkerForm] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [sapForm, setSapForm] = useState({ base_url: '', token_url: '', client_id: '', client_secret: '', api_path: '/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$top=1&$format=json', scopes: '', auth_method: 'client_secret_basic' })
  const [sapTest, setSapTest] = useState<SapTest | null>(null)
  const [policyDraft, setPolicyDraft] = useState({ name: '', rule: '', action: 'alert' })
  const [buildDraft, setBuildDraft] = useState({ name: '', source: '', status: 'review', risk: 'low', findings: 0, summary: '' })
  const [workerDraft, setWorkerDraft] = useState({ name: '', kind: '', version: '' })

  const accessToken = useCallback(async (force = false) => {
    if (!msal || !account || !config.apiScope) return undefined
    try {
      const result: AuthenticationResult = await msal.acquireTokenSilent({
        account,
        scopes: [config.apiScope],
        forceRefresh: force,
      })
      return result.accessToken
    } catch {
      const result = await msal.acquireTokenPopup({ account, scopes: [config.apiScope] })
      return result.accessToken
    }
  }, [account])

  const refresh = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const token = await accessToken()
      const requests = await Promise.all([
        request<Overview>('/api/v1/overview', mode, token),
        request<Build[]>('/api/v1/builds', mode, token),
        request<Worker[]>('/api/v1/workers', mode, token),
        request<Policy[]>('/api/v1/policies', mode, token),
        request<SapIntegration>('/api/v1/integrations/sap', mode, token),
      ])
      setData({ overview: requests[0], builds: requests[1], workers: requests[2], policies: requests[3], sap: requests[4] })
      if (mode === 'live' && requests[4].configured) {
        setSapForm((current) => ({
          ...current,
          base_url: requests[4].base_url || '',
          token_url: requests[4].token_url || '',
          client_id: requests[4].client_id || '',
          api_path: requests[4].api_path || current.api_path,
          scopes: requests[4].scopes || '',
          auth_method: requests[4].auth_method || current.auth_method,
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workspace')
    } finally {
      setBusy(false)
    }
  }, [accessToken, mode])

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      if (config.entraClientId) {
        const { PublicClientApplication: Client } = await import('@azure/msal-browser')
        const client = new Client({
          auth: {
            clientId: config.entraClientId,
            authority: config.entraAuthority || 'https://login.microsoftonline.com/organizations',
            redirectUri: window.location.origin,
          },
          cache: { cacheLocation: 'sessionStorage' },
        })
        await client.initialize()
        const result = await client.handleRedirectPromise()
        const currentAccount = result?.account || client.getActiveAccount() || client.getAllAccounts()[0] || null
        if (currentAccount) {
          client.setActiveAccount(currentAccount)
          if (!cancelled) setAccount(currentAccount)
        }
        if (!cancelled) setMsal(client)
      }
    }
    initialize().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to initialize organization sign-in')
    }).finally(() => {
      if (!cancelled) setAuthReady(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (authReady && (!msal || account)) void refresh()
  }, [account, authReady, refresh])

  const visibleBuilds = useMemo(() => {
    if (!data) return []
    const candidates = view === 'quarantine' ? data.builds.filter((item) => item.status === 'quarantined') : data.builds
    return candidates.filter((item) => `${item.name} ${item.source} ${item.status}`.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [data, searchTerm, view])

  async function login() {
    if (!msal) return
    if (!config.apiScope) {
      setError('Set the API delegated scope in the frontend runtime configuration before signing in.')
      return
    }
    const result = await msal.loginPopup({ scopes: [config.apiScope] })
    msal.setActiveAccount(result.account)
    setAccount(result.account)
  }

  async function logout() {
    if (!msal || !account) return
    await msal.logoutPopup({ account, postLogoutRedirectUri: window.location.origin })
    setAccount(null)
  }

  async function releaseBuild(build: Build) {
    try {
      const token = await accessToken()
      await request(`/api/v1/builds/${build.id}/release`, mode, token, { method: 'POST' })
      setNotice(`${build.name} released in the demo workspace.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to release build')
    }
  }

  async function savePolicy(event: React.FormEvent) {
    event.preventDefault()
    try {
      const token = await accessToken()
      await request('/api/v1/policies', mode, token, { method: 'POST', body: JSON.stringify(policyDraft) })
      setPolicyDraft({ name: '', rule: '', action: 'alert' })
      setPolicyForm(false)
      setNotice(mode === 'demo' ? 'Policy saved to the demo workspace.' : 'Policy saved. Live enforcement depends on connected control planes.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save policy')
    }
  }

  async function updatePolicy(policy: Policy) {
    try {
      const token = await accessToken()
      await request(`/api/v1/policies/${policy.id}`, mode, token, { method: 'PATCH', body: JSON.stringify({ enabled: !policy.enabled }) })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update policy')
    }
  }

  async function saveBuild(event: React.FormEvent) {
    event.preventDefault()
    try {
      const token = await accessToken()
      await request('/api/v1/builds', mode, token, { method: 'POST', body: JSON.stringify(buildDraft) })
      setBuildDraft({ name: '', source: '', status: 'review', risk: 'low', findings: 0, summary: '' })
      setBuildForm(false)
      setNotice(mode === 'demo' ? 'Build result added to the isolated demo workspace.' : 'Build result saved to the tenant workspace.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save build result')
    }
  }

  async function saveWorker(event: React.FormEvent) {
    event.preventDefault()
    try {
      const token = await accessToken()
      await request('/api/v1/workers', mode, token, { method: 'POST', body: JSON.stringify(workerDraft) })
      setWorkerDraft({ name: '', kind: '', version: '' })
      setWorkerForm(false)
      setNotice(mode === 'demo' ? 'Worker added to the isolated demo workspace.' : 'Worker registered in the tenant workspace.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register worker')
    }
  }

  async function saveSap(event: React.FormEvent) {
    event.preventDefault()
    try {
      const token = await accessToken()
      const { client_secret, ...rest } = sapForm
      await request('/api/v1/integrations/sap', mode, token, { method: 'PUT', body: JSON.stringify({ ...rest, client_secret }) })
      setSapForm((current) => ({ ...current, client_secret: '' }))
      setNotice('SAP connection settings were saved. Run the connection test to verify this system.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save SAP settings')
    }
  }

  async function testSap() {
    setBusy(true)
    setError('')
    setSapTest(null)
    try {
      const token = await accessToken()
      setSapTest(await request<SapTest>('/api/v1/integrations/sap/test', mode, token, { method: 'POST' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SAP connection test failed')
    } finally {
      setBusy(false)
    }
  }

  const title = labels[view]
  const name = account?.name || 'Workspace administrator'
  const quarantined = data?.builds.filter((item) => item.status === 'quarantined') || []

  return (
    <div className="app-shell">
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#overview" onClick={() => setView('overview')}>
          <span className="brand-mark"><Shield size={20} /></span>
          <span className="brand-copy"><strong>sentinel</strong><small>SUPPLY CHAIN SECURITY</small></span>
          <button className="mobile-close icon-button" onClick={(event) => { event.preventDefault(); setMobileNav(false) }} aria-label="Close menu"><X size={18} /></button>
        </a>
        <div className="workspace-picker">
          <div className="workspace-logo">A</div>
          <div className="workspace-label"><strong>Acme Manufacturing</strong><small>Enterprise workspace</small></div>
          <ChevronDown size={15} />
        </div>
        <div className="side-scroll">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <span className="nav-heading">{group.title}</span>
              {group.items.map(({ id, icon: Icon }) => (
                <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setView(id); setMobileNav(false) }}>
                  <Icon size={17} strokeWidth={1.8} /><span>{labels[id]}</span>
                  {id === 'quarantine' && quarantined.length > 0 && <i className="nav-count">{quarantined.length}</i>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="side-health"><span className="health-dot" /><span>All systems operational</span><ArrowUpRight size={14} /></div>
          <div className="user-row">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span className="user-copy"><strong>{name}</strong><small>{account ? 'Signed in with Entra ID' : 'Workspace operator'}</small></span>
            <button className="icon-button" title={account ? 'Sign out' : 'Sign in'} onClick={() => account ? void logout() : void login()}>{account ? <ChevronDown size={16} /> : <LogIn size={16} />}</button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-leading">
            <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
          </div>
          <div className="top-actions">
            <label className="mode-switch">
              <span className={`mode-chip ${mode === 'demo' ? 'selected' : ''}`}><Sparkles size={13} />Demo</span>
              <button aria-label={`Switch to ${mode === 'demo' ? 'live' : 'demo'} workspace`} onClick={() => { setMode(mode === 'demo' ? 'live' : 'demo'); setNotice('') }}>
                {mode === 'demo' ? <ToggleLeft size={23} /> : <ToggleRight size={23} />}
              </button>
              <span className={`mode-chip ${mode === 'live' ? 'selected live' : ''}`}><LockKeyhole size={13} />Live</span>
            </label>
            <span className="top-divider" />
            <span className="connection"><i className="health-dot" />Connected</span>
            <button className="icon-button help-button" title="Help and documentation"><CircleHelp size={17} /></button>
            {!account && msal && <button className="sign-in-button" onClick={() => void login().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Sign in failed'))}><LogIn size={15} />Sign in</button>}
          </div>
        </header>

        <section className="page-wrap">
          {mode === 'demo' && <div className="demo-banner"><Sparkles size={15} /><span><strong>DEMO WORKSPACE</strong> — actions and records are isolated from your SAP tenant. No SAP system is contacted by demo actions.</span><button onClick={() => setMode('live')}>Switch to live <ArrowRight size={14} /></button></div>}
          {error && <div className="alert-banner error-banner" role="alert"><AlertOctagon size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="alert-banner success-banner" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16} /></button></div>}

          <div className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-dot" />SAP LANDSCAPE · SECURITY OPERATIONS</div><h1>{title}</h1><p>{view === 'overview' ? 'Monitor supply-chain integrity and safeguard every build across your SAP landscape.' : view === 'integrations' ? 'Connect SAP systems and manage trusted data sources for this workspace.' : `Manage and review ${title.toLowerCase()} across your connected enterprise landscape.`}</p></div>
            <div className="heading-actions">
              <button className="button button-secondary" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} />Refresh</button>
              {view === 'policies' && <button className="button button-primary" onClick={() => setPolicyForm(true)}><Plus size={16} />New policy</button>}
              {view === 'builds' && <button className="button button-primary" onClick={() => setBuildForm(true)}><Plus size={16} />Register build</button>}
              {view === 'workers' && <button className="button button-primary" onClick={() => setWorkerForm(true)}><Plus size={16} />Register worker</button>}
              {view === 'integrations' && <span className="sap-brand"><span className="sap-brand-mark">SAP</span> S/4HANA Cloud</span>}
            </div>
          </div>

          {authReady && config.entraClientId && !account && <SignInGate signIn={() => void login().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Sign in failed'))} />}
          {authReady && (!config.entraClientId || account) && view === 'overview' && data && <OverviewView overview={data.overview} builds={data.builds} workers={data.workers} setView={setView} mode={mode} />}
          {authReady && (!config.entraClientId || account) && view === 'builds' && <BuildsView builds={visibleBuilds} searchTerm={searchTerm} setSearchTerm={setSearchTerm} busy={busy} />}
          {authReady && (!config.entraClientId || account) && view === 'quarantine' && <QuarantineView builds={visibleBuilds} busy={busy} releaseBuild={releaseBuild} mode={mode} />}
          {authReady && (!config.entraClientId || account) && view === 'workers' && <WorkersView workers={data?.workers || []} busy={busy} />}
          {authReady && (!config.entraClientId || account) && view === 'policies' && <PoliciesView policies={data?.policies || []} busy={busy} mode={mode} updatePolicy={updatePolicy} />}
          {authReady && (!config.entraClientId || account) && view === 'integrations' && <IntegrationsView integration={data?.sap || null} mode={mode} form={sapForm} setForm={setSapForm} save={saveSap} test={testSap} busy={busy} result={sapTest} />}

          <footer className="page-footer"><span>Sentinel Supply Chain <span className="footer-dot">·</span> API v1</span><span><span className="health-dot" /> Protected by organization sign-in <span className="footer-dot">·</span> <a href="https://learn.microsoft.com/azure/app-service/overview-authentication-authorization" target="_blank" rel="noreferrer">Security model <ExternalLink size={11} /></a></span></footer>
        </section>
      </main>
      {policyForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPolicyForm(false)}><form className="modal-card" onSubmit={(event) => void savePolicy(event)}><div className="modal-heading"><div><span className="eyebrow">POLICY CENTER</span><h2>Create policy</h2></div><button className="icon-button" type="button" onClick={() => setPolicyForm(false)} aria-label="Close"><X size={18} /></button></div><label>Policy name<input required minLength={2} maxLength={160} value={policyDraft.name} onChange={(event) => setPolicyDraft({ ...policyDraft, name: event.target.value })} placeholder="e.g. Require approved supplier" /></label><label>When this rule matches<input required minLength={4} maxLength={240} value={policyDraft.rule} onChange={(event) => setPolicyDraft({ ...policyDraft, rule: event.target.value })} placeholder="e.g. Supplier is not allowlisted" /></label><label>Action<select value={policyDraft.action} onChange={(event) => setPolicyDraft({ ...policyDraft, action: event.target.value })}><option value="alert">Alert security team</option><option value="quarantine">Quarantine build</option><option value="block">Block release</option></select></label><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setPolicyForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Check size={15} />Save policy</button></div></form></div>}
      {buildForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBuildForm(false)}><form className="modal-card" onSubmit={(event) => void saveBuild(event)}><div className="modal-heading"><div><span className="eyebrow">BUILD INVENTORY</span><h2>Register build result</h2></div><button className="icon-button" type="button" onClick={() => setBuildForm(false)} aria-label="Close"><X size={18} /></button></div><p className="modal-description">This records a result only; it does not start a scan or release a production build.</p><label>Build name<input required minLength={2} maxLength={160} value={buildDraft.name} onChange={(event) => setBuildDraft({ ...buildDraft, name: event.target.value })} placeholder="e.g. s4-integration-2.4.0" /></label><label>Source<input required minLength={2} maxLength={160} value={buildDraft.source} onChange={(event) => setBuildDraft({ ...buildDraft, source: event.target.value })} placeholder="e.g. GitHub Actions / SAP transport" /></label><div className="form-grid"><label>Risk<select value={buildDraft.risk} onChange={(event) => setBuildDraft({ ...buildDraft, risk: event.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Findings<input type="number" min="0" max="100000" value={buildDraft.findings} onChange={(event) => setBuildDraft({ ...buildDraft, findings: Number(event.target.value) })} /></label></div><label>Summary<textarea maxLength={4000} value={buildDraft.summary} onChange={(event) => setBuildDraft({ ...buildDraft, summary: event.target.value })} placeholder="Optional review context" /></label><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setBuildForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Check size={15} />Save result</button></div></form></div>}
      {workerForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setWorkerForm(false)}><form className="modal-card" onSubmit={(event) => void saveWorker(event)}><div className="modal-heading"><div><span className="eyebrow">AGENT FLEET</span><h2>Register worker</h2></div><button className="icon-button" type="button" onClick={() => setWorkerForm(false)} aria-label="Close"><X size={18} /></button></div><p className="modal-description">Worker registration creates a tenant-scoped record. Connect the worker to send authenticated heartbeats.</p><label>Worker name<input required minLength={2} maxLength={160} value={workerDraft.name} onChange={(event) => setWorkerDraft({ ...workerDraft, name: event.target.value })} placeholder="e.g. eu-s4-scanner-01" /></label><label>Worker type<input required minLength={2} maxLength={64} value={workerDraft.kind} onChange={(event) => setWorkerDraft({ ...workerDraft, kind: event.target.value })} placeholder="e.g. SAP system scanner" /></label><label>Version<input required minLength={1} maxLength={64} value={workerDraft.version} onChange={(event) => setWorkerDraft({ ...workerDraft, version: event.target.value })} placeholder="e.g. 1.0.0" /></label><div className="modal-actions"><button className="button button-secondary" type="button" onClick={() => setWorkerForm(false)}>Cancel</button><button className="button button-primary" type="submit"><Check size={15} />Register worker</button></div></form></div>}
    </div>
  )
}

function OverviewView({ overview, builds, workers, setView, mode }: { overview: Overview; builds: Build[]; workers: Worker[]; setView: (view: View) => void; mode: Mode }) {
  const riskCount = builds.filter((build) => build.risk === 'critical' || build.risk === 'high').length
  const metrics = [
    { label: 'Tracked builds', value: overview.builds, icon: Boxes, tone: 'blue', note: 'Across connected sources', trend: 'Current', positive: true },
    { label: 'Healthy workers', value: `${overview.active_workers}/${workers.length}`, icon: Radio, tone: 'green', note: 'Reporting in this workspace', trend: 'All healthy', positive: true },
    { label: 'Quarantined', value: overview.quarantined, icon: ShieldAlert, tone: 'amber', note: 'Awaiting security review', trend: overview.quarantined ? 'Needs review' : 'Clear', positive: !overview.quarantined },
    { label: 'Critical findings', value: overview.critical_findings, icon: Fingerprint, tone: 'red', note: 'Across all tracked builds', trend: riskCount ? `${riskCount} at-risk builds` : 'No high risk', positive: !riskCount },
  ]
  const recent = [...builds].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)

  return <div className="overview-content">
    <div className="metrics-grid">{metrics.map(({ label, value, icon, tone, note, trend, positive }) => <article className="metric-card" key={label}><div className="metric-top"><IconTile icon={icon} tone={tone} /><span className={`metric-trend ${positive ? 'trend-good' : 'trend-warn'}`}>{positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{trend}</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-note">{note}</div></article>)}</div>
    <div className="overview-grid">
      <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">ACTIVITY</span><h2>Recent builds</h2></div><button className="text-button" onClick={() => setView('builds')}>View all <ArrowRight size={14} /></button></div>
        {recent.length ? <div className="table-scroll"><table><thead><tr><th>BUILD</th><th>SOURCE</th><th>RISK</th><th>STATUS</th><th>UPDATED</th></tr></thead><tbody>{recent.map((build) => <tr key={build.id}><td><div className="build-cell"><span className={`build-icon ${build.status === 'quarantined' ? 'build-icon-warn' : ''}`}><GitBranch size={15} /></span><div><strong>{build.name}</strong><small>{build.findings ? `${build.findings} finding${build.findings === 1 ? '' : 's'}` : 'All checks passed'}</small></div></div></td><td className="muted-cell">{build.source}</td><td><span className={`risk-text risk-${build.risk}`}>{build.risk}</span></td><td><StatusPill value={build.status} /></td><td className="muted-cell">{shortDate(build.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="No builds yet" text="Builds connected to this workspace will appear here." />}</section>
      <div className="overview-right">
        <section className="panel posture-panel"><div className="panel-heading"><div><span className="panel-kicker">POSTURE</span><h2>Security posture</h2></div><span className="posture-score">{overview.builds ? Math.max(0, 100 - overview.critical_findings * 14 - overview.quarantined * 8) : '—'}<small>/100</small></span></div><div className="posture-bar"><span style={{ width: `${overview.builds ? Math.max(4, 100 - overview.critical_findings * 14 - overview.quarantined * 8) : 0}%` }} /></div><p>Indicative score from stored findings; not an SAP or compliance assessment.</p><div className="posture-list"><span><CheckCircle2 size={15} />Policy coverage <strong>{overview.builds ? 'Active' : 'Not set'}</strong></span><span><Radio size={15} />Worker coverage <strong>{workers.length ? `${workers.length} reporting` : 'No workers'}</strong></span><span><ShieldX size={15} />Open criticals <strong>{overview.critical_findings}</strong></span></div></section>
        <section className="panel connector-panel"><div className="panel-heading"><div><span className="panel-kicker">LANDSCAPE</span><h2>SAP connection</h2></div><StatusPill value={mode === 'demo' ? 'demo' : 'not configured'} /></div><div className="connector-detail"><div className="sap-mark-large">SAP</div><div><strong>S/4HANA Cloud</strong><small>{mode === 'demo' ? 'Simulated connection · no SAP calls' : 'Configure OAuth 2.0 OData access'}</small></div></div><button className="connector-link" onClick={() => setView('integrations')}>{mode === 'demo' ? 'Configure live connection' : 'Manage integration'}<ArrowRight size={14} /></button></section>
      </div>
    </div>
    <section className="panel workers-strip"><div className="panel-heading"><div><span className="panel-kicker">FLEET</span><h2>Workers</h2></div><button className="text-button" onClick={() => setView('workers')}>Manage workers <ArrowRight size={14} /></button></div><div className="worker-cards">{workers.slice(0, 3).map((worker) => <div className="worker-card" key={worker.id}><span className={`worker-avatar ${worker.status === 'healthy' ? '' : 'worker-avatar-warn'}`}><TerminalSquare size={17} /></span><div className="worker-main"><strong>{worker.name}</strong><small>{worker.kind} · v{worker.version}</small></div><StatusPill value={worker.status} /></div>)}</div></section>
    {mode === 'demo' && <div className="demo-note"><ShieldEllipsis size={15} /><span>Demo actions are persisted in an isolated demo workspace. They do not alter SAP, CI pipelines, or tenant production records.</span><button onClick={() => setView('integrations')}>About integrations <ArrowRight size={13} /></button></div>}
  </div>
}

function BuildsView({ builds, searchTerm, setSearchTerm, busy }: { builds: Build[]; searchTerm: string; setSearchTerm: (value: string) => void; busy: boolean }) {
  return <section className="panel list-panel"><div className="list-toolbar"><div><span className="panel-kicker">SUPPLY CHAIN</span><h2>Build inventory <span className="count-badge">{builds.length}</span></h2></div><div className="search-box"><Search size={15} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search builds..." aria-label="Search builds" /></div></div>
    {busy && !builds.length ? <Loading /> : builds.length ? <div className="table-scroll"><table><thead><tr><th>BUILD NAME</th><th>SOURCE</th><th>RISK</th><th>FINDINGS</th><th>STATUS</th><th>LAST UPDATED</th></tr></thead><tbody>{builds.map((build) => <tr key={build.id}><td><div className="build-cell"><span className={`build-icon ${build.status === 'quarantined' ? 'build-icon-warn' : ''}`}><GitBranch size={15} /></span><div><strong>{build.name}</strong><small className="build-id">{build.id}</small></div></div></td><td className="muted-cell">{build.source}</td><td><span className={`risk-text risk-${build.risk}`}>{build.risk}</span></td><td><span className={build.findings ? 'finding-count' : 'zero-count'}>{build.findings}</span></td><td><StatusPill value={build.status} /></td><td className="muted-cell">{displayDate(build.created_at)}</td></tr>)}</tbody></table></div> : <EmptyState title="No matching builds" text="Try a different search or connect a build source." />}</section>
}

function QuarantineView({ builds, busy, releaseBuild, mode }: { builds: Build[]; busy: boolean; releaseBuild: (build: Build) => void; mode: Mode }) {
  return <section className="panel list-panel"><div className="list-toolbar"><div><span className="panel-kicker">REQUIRES REVIEW</span><h2>Quarantine queue <span className="count-badge amber-badge">{builds.length}</span></h2></div><div className="queue-legend"><span><i className="legend-dot red" />Critical</span><span><i className="legend-dot amber" />High / medium</span></div></div>
    {busy && !builds.length ? <Loading /> : builds.length ? <div className="quarantine-list">{builds.map((build) => <article className="quarantine-card" key={build.id}><div className="quarantine-icon"><ShieldAlert size={19} /></div><div className="quarantine-body"><div className="quarantine-title"><strong>{build.name}</strong><StatusPill value={build.status} /></div><p>{build.summary}</p><div className="quarantine-meta"><span><GitBranch size={13} />{build.source}</span><span className={`risk-text risk-${build.risk}`}>{build.risk} risk</span><span><Clock3 size={13} />{displayDate(build.created_at)}</span><span>{build.findings} findings</span></div></div><button disabled={mode !== 'demo'} className="button button-secondary review-button" onClick={() => void releaseBuild(build)}><Check size={14} />Release (demo)</button></article>)}</div> : <EmptyState title="Quarantine is clear" text="Builds that violate an enabled supply-chain policy will appear here." />}</section>
}

function WorkersView({ workers, busy }: { workers: Worker[]; busy: boolean }) {
  return <section className="panel list-panel"><div className="list-toolbar"><div><span className="panel-kicker">AGENT FLEET</span><h2>Connected workers <span className="count-badge">{workers.length}</span></h2></div><div className="live-indicator"><i className="health-dot" />Live status</div></div>
    {busy && !workers.length ? <Loading /> : workers.length ? <div className="workers-table">{workers.map((worker) => <article className="fleet-row" key={worker.id}><span className={`worker-avatar ${worker.status === 'healthy' ? '' : 'worker-avatar-warn'}`}><TerminalSquare size={18} /></span><div className="worker-main"><strong>{worker.name}</strong><small>{worker.kind}</small></div><div className="fleet-field"><span>VERSION</span><strong>{worker.version}</strong></div><div className="fleet-field"><span>LAST CHECK-IN</span><strong>{displayDate(worker.last_seen)}</strong></div><StatusPill value={worker.status} /><button className="icon-button" title="Worker details"><ArrowRight size={16} /></button></article>)}</div> : <EmptyState title="No workers registered" text="Connect a supported scanner or build agent to start monitoring your landscape." />}</section>
}

function PoliciesView({ policies, busy, mode, updatePolicy }: { policies: Policy[]; busy: boolean; mode: Mode; updatePolicy: (policy: Policy) => void }) {
  return <div className="policy-layout"><section className="panel list-panel"><div className="list-toolbar"><div><span className="panel-kicker">GUARDRAILS</span><h2>Security policies <span className="count-badge">{policies.length}</span></h2></div><span className="info-pill"><LockKeyhole size={13} />{mode === 'demo' ? 'Demo policies' : 'Saved to tenant workspace'}</span></div>
    {busy && !policies.length ? <Loading /> : policies.length ? <div className="policy-list">{policies.map((policy) => <article className="policy-row" key={policy.id}><span className="policy-icon"><FileCheck2 size={17} /></span><div className="policy-main"><strong>{policy.name}</strong><small>IF {policy.rule}</small></div><span className={`action-tag action-${policy.action}`}>{policy.action}</span><button className="switch-button" onClick={() => void updatePolicy(policy)} aria-label={`${policy.enabled ? 'Disable' : 'Enable'} ${policy.name}`}>{policy.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}</button></article>)}</div> : <EmptyState title="No policies configured" text="Create a policy to define how risky artifacts should be handled." />}</section>
    <aside className="policy-aside"><div className="policy-aside-icon"><Workflow size={19} /></div><h3>Enforce secure by default</h3><p>These starter policies describe intended outcomes. Live enforcement requires connecting a supported build system and explicitly authorizing its control-plane actions.</p><div className="policy-aside-line"><span><CheckCircle2 size={14} />Audit history recorded</span><span><LockKeyhole size={14} />Tenant-isolated</span></div></aside></div>
}

function IntegrationsView({ integration, mode, form, setForm, save, test, busy, result }: { integration: SapIntegration | null; mode: Mode; form: { base_url: string; token_url: string; client_id: string; client_secret: string; api_path: string; scopes: string; auth_method: string }; setForm: (value: typeof form) => void; save: (event: React.FormEvent) => void; test: () => void; busy: boolean; result: SapTest | null }) {
  const demo = mode === 'demo'
  return <div className="integration-layout"><section className="panel integration-card"><div className="integration-title"><div className="integration-brand"><span className="sap-brand-mark">SAP</span><div><h2>S/4HANA Cloud</h2><p>OAuth 2.0 client credentials · OData v2/v4</p></div></div><StatusPill value={demo ? 'demo' : integration?.configured ? integration.connected_at ? 'connected' : 'configured' : 'not configured'} /></div>
    {demo ? <div className="integration-demo"><div className="demo-icon"><Sparkles size={18} /></div><div><strong>Demo connection only</strong><p>Sample data is synthetic. Demo connection tests never send requests to SAP. Switch to the live workspace to configure your own S/4HANA Cloud tenant.</p></div></div> :
      <form className="sap-form" onSubmit={(event) => void save(event)}>
        <div className="form-section-title"><span>CONNECTION</span><small>Use an SAP Communication Arrangement with an OAuth 2.0 client-credentials grant and read-only API scopes.</small></div>
        <div className="form-grid"><label className="span-2">SAP API base URL<input required type="url" value={form.base_url} onChange={(event) => setForm({ ...form, base_url: event.target.value })} placeholder="https://my-system.s4hana.ondemand.com" autoComplete="url" /><small>HTTPS system host only. Credentials are never placed in URLs.</small></label><label className="span-2">OAuth token endpoint<input required type="url" value={form.token_url} onChange={(event) => setForm({ ...form, token_url: event.target.value })} placeholder="https://tenant.authentication.region.hana.ondemand.com/oauth/token" autoComplete="url" /></label><label>OAuth client ID<input required value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })} autoComplete="off" /></label><label>Client authentication<select value={form.auth_method} onChange={(event) => setForm({ ...form, auth_method: event.target.value })}><option value="client_secret_basic">HTTP Basic (recommended)</option><option value="client_secret_post">Client secret in form body</option></select></label><label className="span-2">OAuth client secret<input required={!integration?.configured} type="password" value={form.client_secret} onChange={(event) => setForm({ ...form, client_secret: event.target.value })} autoComplete="new-password" placeholder={integration?.configured ? 'Saved securely — enter a new value only to rotate it' : 'Paste the secret from SAP BTP'} /><small>Stored in Azure Key Vault; it is never returned by this API.</small></label><label className="span-2">OData API path<input required value={form.api_path} onChange={(event) => setForm({ ...form, api_path: event.target.value })} placeholder="/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product?$top=1&$format=json" /><small>Use the path for an API activated in the SAP Communication Arrangement. Starts with /.</small></label><label className="span-2">OAuth scopes <span className="optional-label">OPTIONAL</span><input value={form.scopes} onChange={(event) => setForm({ ...form, scopes: event.target.value })} placeholder="Space-separated scopes, if required by your identity provider" /></label></div>
        <div className="integration-actions"><button className="button button-secondary" type="button" onClick={() => void test()} disabled={busy || !integration?.configured}><Activity size={15} />Test connection</button><button className="button button-primary" type="submit"><Check size={15} />Save configuration</button></div>
      </form>}
    {result && !demo && <div className={`connection-result ${result.connected ? 'result-ok' : 'result-fail'}`}><CheckCircle2 size={17} /><div><strong>{result.connected ? 'SAP connection verified' : 'Connection failed'}</strong><p>{result.message} {result.records_returned === null ? '' : `${result.records_returned} record(s) returned.`}</p><small>HTTP {result.http_status} · Checked {displayDate(result.checked_at)}</small></div></div>}
    <div className="integration-security"><span><LockKeyhole size={14} />TLS-only endpoint validation</span><span><Fingerprint size={14} />OAuth credentials stored in Key Vault</span><span><Database size={14} />Connection settings are tenant-scoped</span></div>
    </section>
    <aside className="integration-side"><div className="panel side-info"><div className="side-info-icon"><CircleHelp size={18} /></div><h3>Before you connect</h3><ol><li>Create an OAuth 2.0 client in SAP BTP / your identity provider.</li><li>Assign a read-only S/4HANA API Communication Arrangement.</li><li>Allow this app's outbound IPs in SAP, if required.</li><li>Use a dedicated technical user with least-privilege access.</li></ol><a href="https://help.sap.com/docs/SAP_S4HANA_CLOUD" target="_blank" rel="noreferrer">SAP S/4HANA Cloud documentation <ExternalLink size={13} /></a></div>
      <div className="connection-summary"><div className="summary-top"><span className="summary-icon"><ShieldCheck size={17} /></span><div><strong>Integration security</strong><small>Enterprise connection controls</small></div></div><span><Check size={14} />Secret never stored in app database</span><span><Check size={14} />Tokens held only in request memory</span><span><Check size={14} />Outbound URL and redirect validation</span><span><Check size={14} />Per-tenant configuration</span></div>
    </aside></div>
}

function Loading() {
  return <div className="loading-state"><span className="loader" />Loading workspace data…</div>
}

function SignInGate({ signIn }: { signIn: () => void }) {
  return <section className="panel sign-in-gate"><div className="empty-icon"><LockKeyhole size={22} /></div><h2>Sign in to your organization</h2><p>Workspace and SAP connection details are available only to an authenticated organization user.</p><button className="button button-primary" onClick={signIn}><LogIn size={15} />Continue with Microsoft Entra ID</button></section>
}

export { App }
