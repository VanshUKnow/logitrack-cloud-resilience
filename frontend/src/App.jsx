import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, CheckCircle2, ChevronDown, Clock3,
  LayoutDashboard, LoaderCircle, MapPin, Menu, Package, PackageCheck, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Truck, X,
  Server, Database, RotateCcw, BellRing, Save, Gauge, CircleCheck, CircleX
} from 'lucide-react';

const API = '/api';
const STATUSES = ['Pending', 'In Transit', 'Delivered', 'Delayed'];
const PAGES = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'shipments', label: 'Shipments', icon: Package },
  { id: 'health', label: 'System health', icon: Activity },
  { id: 'resilience', label: 'Resilience', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

function normalise(item) {
  return {
    ...item,
    id: item.id ?? item.shipment_id ?? item.tracking_number,
    tracking_number: item.tracking_number ?? item.trackingNumber ?? '—',
    recipient: item.recipient ?? item.customer ?? 'Unknown recipient',
    destination: item.destination ?? '—',
    status: item.status ?? 'Pending',
    created_at: item.created_at ?? item.createdAt ?? item.timestamp ?? null,
  };
}
function dateLabel(value) {
  if (!value) return 'Recently added';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) :
    new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}
function statusClass(status) {
  return `status-pill status-${String(status).toLowerCase().replace(/\s+/g, '-')}`;
}
function StatusIcon({ status }) {
  if (status === 'Delivered') return <PackageCheck size={14} />;
  if (status === 'In Transit') return <Truck size={14} />;
  if (status === 'Delayed') return <AlertTriangle size={14} />;
  return <Clock3 size={14} />;
}

export default function App() {
  const [page, setPage] = useState(() => {
    const initial = window.location.hash.replace('#', '');
    return PAGES.some(p => p.id === initial) ? initial : 'overview';
  });
  const [shipments, setShipments] = useState([]);
  const [health, setHealth] = useState('checking');
  const [healthPayload, setHealthPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All shipments');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      return { autoRefresh: localStorage.getItem('lt-auto-refresh') !== 'false',
        refreshInterval: Number(localStorage.getItem('lt-refresh-interval') || 15),
        compactTable: localStorage.getItem('lt-compact-table') === 'true' };
    } catch { return { autoRefresh: true, refreshInterval: 15, compactTable: false }; }
  });
  const [form, setForm] = useState({ tracking_number: '', recipient: '', destination: '', status: 'Pending' });

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    try {
      const [hr, sr] = await Promise.all([
        fetch(`${API}/health`, { cache: 'no-store' }),
        fetch(`${API}/shipments`, { cache: 'no-store' }),
      ]);
      if (!hr.ok) throw new Error('Health endpoint returned an error.');
      if (!sr.ok) throw new Error('Could not load shipments.');
      const h = await hr.json();
      const data = await sr.json();
      setHealth(h.status === 'healthy' ? 'healthy' : 'unavailable');
      setHealthPayload(h);
      const rows = Array.isArray(data) ? data : (data.shipments ?? data.items ?? []);
      setShipments(rows.map(normalise));
      setError('');
    } catch (e) {
      setHealth('unavailable');
      setError(e.message || 'Unable to connect to LogiTrack.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    loadData();
    if (!settings.autoRefresh) return undefined;
    const timer = window.setInterval(() => loadData(true), Math.max(5, settings.refreshInterval) * 1000);
    return () => window.clearInterval(timer);
  }, [loadData, settings.autoRefresh, settings.refreshInterval]);

  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.replace('#', '');
      if (PAGES.some(p => p.id === next)) setPage(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(id) {
    setPage(id);
    window.location.hash = id;
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const counts = useMemo(() => ({
    total: shipments.length,
    transit: shipments.filter(s => s.status === 'In Transit').length,
    delivered: shipments.filter(s => s.status === 'Delivered').length,
    delayed: shipments.filter(s => s.status === 'Delayed').length,
    pending: shipments.filter(s => s.status === 'Pending').length,
  }), [shipments]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return shipments.filter(s => {
      const found = !term || [s.tracking_number, s.recipient, s.destination, s.status]
        .some(v => String(v ?? '').toLowerCase().includes(term));
      return found && (filter === 'All shipments' || s.status === filter);
    });
  }, [shipments, query, filter]);

  async function createShipment(e) {
    e.preventDefault(); setSaving(true);
    try {
      const r = await fetch(`${API}/shipments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_number: form.tracking_number.trim(), recipient: form.recipient.trim(),
          destination: form.destination.trim(), status: form.status,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || 'Shipment could not be created.');
      setForm({ tracking_number: '', recipient: '', destination: '', status: 'Pending' });
      setModalOpen(false); notify('Shipment created successfully.'); await loadData(true);
    } catch (e) { notify(e.message || 'Could not create shipment.', 'error'); }
    finally { setSaving(false); }
  }

  async function updateStatus(shipment, status) {
    try {
      const r = await fetch(`${API}/shipments/${encodeURIComponent(shipment.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || 'Status update failed.');
      notify(`${shipment.tracking_number} updated to ${status}.`); await loadData(true);
    } catch (e) { notify(e.message || 'Could not update shipment.', 'error'); }
  }

  function saveSettings() {
    try {
      localStorage.setItem('lt-auto-refresh', String(settings.autoRefresh));
      localStorage.setItem('lt-refresh-interval', String(settings.refreshInterval));
      localStorage.setItem('lt-compact-table', String(settings.compactTable));
      document.documentElement.dataset.compactTable = String(settings.compactTable);
      notify('Preferences saved on this browser.');
    } catch { notify('Could not save browser preferences.', 'error'); }
  }

  const current = PAGES.find(p => p.id === page) || PAGES[0];
  const PageIcon = current.icon;

  return <div className="app-shell">
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#overview" onClick={() => navigate('overview')} aria-label="LogiTrack home">
        <span className="brand-mark"><Package size={22} /></span>
        <span className="brand-copy"><strong>LogiTrack</strong><small>SHIPMENT CONTROL</small></span>
      </a>
      <div className="workspace-switcher"><div className="workspace-avatar">LT</div><div className="workspace-copy"><strong>Logistics workspace</strong><span>Production environment</span></div><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="main-nav">
        {PAGES.slice(0, 3).map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${page === item.id ? 'nav-active' : ''}`} onClick={() => navigate(item.id)}><Icon size={18} />{item.label}{item.id === 'shipments' && <span className="nav-count">{counts.total}</span>}</button>;
        })}
      </nav>
      <div className="nav-label nav-label-spaced">SYSTEM</div>
      <nav className="main-nav">
        {PAGES.slice(3).map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${page === item.id ? 'nav-active' : ''}`} onClick={() => navigate(item.id)}><Icon size={18} />{item.label}</button>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-icon"><ShieldCheck size={17} /></span><strong>Operations, in view.</strong><p>Shipment operations and resilience controls in separate workspaces.</p><a href="/api/health" target="_blank" rel="noreferrer">View API health <ArrowUpRight size={13} /></a></div>
        <div className="profile-row"><div className="profile-avatar">LT</div><div className="profile-copy"><strong>LogiTrack Admin</strong><span>Administrator</span></div><Settings2 size={16} /></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>{current.label}</strong></div>
        <div className="topbar-actions">
          <span className={`system-chip ${health === 'checking' ? 'system-checking' : health !== 'healthy' ? 'system-down' : ''}`}><span className="live-dot" />{health === 'healthy' ? 'Systems operational' : health === 'checking' ? 'Checking systems' : 'Service unavailable'}</span>
          <button className="icon-button" title="Refresh data" onClick={() => loadData(true)}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /></button>
          <span className="topbar-divider" /><span className="topbar-avatar">LT</span>
        </div>
      </header>

      <div className="page-wrap">
        {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => loadData()}>Retry</button></div>}

        {page === 'overview' && <OverviewPage counts={counts} shipments={shipments} loading={loading} health={health} navigate={navigate} setModalOpen={setModalOpen} />}
        {page === 'shipments' && <ShipmentsPage shipments={shipments} visible={visible} counts={counts} loading={loading} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} setModalOpen={setModalOpen} updateStatus={updateStatus} compact={settings.compactTable} />}
        {page === 'health' && <HealthPage health={health} payload={healthPayload} loading={loading} lastRefresh={settings.autoRefresh ? `${settings.refreshInterval} seconds` : 'Disabled'} refresh={() => loadData(true)} />}
        {page === 'resilience' && <ResiliencePage health={health} counts={counts} />}
        {page === 'settings' && <SettingsPage settings={settings} setSettings={setSettings} saveSettings={saveSettings} refresh={() => loadData(true)} />}
        <footer className="page-footer"><span>© {new Date().getFullYear()} LogiTrack Operations</span><span><span className="footer-dot" />Cloud-connected shipment management</span></footer>
      </div>
    </main>

    {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
      <section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><div><span className="modal-kicker">SHIPMENT MANAGEMENT</span><h2 id="modal-title">Create a shipment</h2><p>Add a new package to your tracking workspace.</p></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Close dialog"><X size={19} /></button></div>
        <form onSubmit={createShipment}><div className="form-grid">
          <label className="form-field form-full"><span>Tracking ID <b>*</b></span><input required value={form.tracking_number} onChange={e => setForm({ ...form, tracking_number: e.target.value })} placeholder="e.g. LT1002" autoFocus /><small>Use a unique tracking number.</small></label>
          <label className="form-field"><span>Recipient <b>*</b></span><input required value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} placeholder="Recipient name" /></label>
          <label className="form-field"><span>Destination <b>*</b></span><input required value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="City or destination" /></label>
          <label className="form-field form-full"><span>Initial status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
        </div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <><LoaderCircle size={16} className="spin" />Creating…</> : <><Plus size={16} />Create shipment</>}</button></div></form>
      </section>
    </div>}
    {toast && <div className={`toast toast-${toast.type}`} role="status"><span className="toast-icon">{toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
  </div>;
}

function PageHeading({ eyebrow, title, subtitle, actions }) {
  return <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div><h1>{title}<span>.</span></h1><p className="page-subtitle">{subtitle}</p></div>{actions && <div className="welcome-actions">{actions}</div>}</div>;
}
function Metric({ label, value, icon: Icon, tone = '', foot }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}><Icon size={18} /></span></div><div className="metric-number">{value}</div><div className="metric-foot">{foot}</div></div>;
}
function Panel({ title, subtitle, icon: Icon, children, className = '' }) {
  return <section className={`panel subpage-panel ${className}`}><div className="panel-heading"><div><div className="panel-title-row"><h2>{title}</h2></div>{subtitle && <p>{subtitle}</p>}</div>{Icon && <span className="distribution-icon"><Icon size={18} /></span>}</div>{children}</section>;
}
function OverviewPage({ counts, shipments, loading, health, navigate, setModalOpen }) {
  return <>
    <PageHeading eyebrow="OPERATIONS OVERVIEW" title="Shipment overview" subtitle="A high-level snapshot of shipment activity and platform status." actions={<><button className="button button-secondary" onClick={() => navigate('health')}><Activity size={15} />System health</button><button className="button button-primary" onClick={() => setModalOpen(true)}><Plus size={16} />New shipment</button></>} />
    <div className="metrics-grid">
      <Metric label="Total shipments" value={counts.total} icon={Package} foot={<><ArrowUpRight size={13} /> Records returned by API</>} />
      <Metric label="In transit" value={counts.transit} icon={Truck} tone="icon-blue" foot={<><Truck size={13} /> Currently in transit</>} />
      <Metric label="Delivered" value={counts.delivered} icon={PackageCheck} tone="icon-green" foot={<><CheckCircle2 size={13} /> Marked delivered</>} />
      <Metric label="Delayed" value={counts.delayed} icon={AlertTriangle} tone="icon-amber" foot={<><Clock3 size={13} /> Requires attention</>} />
    </div>
    <div className="page-columns">
      <Panel title="Recent shipments" subtitle="Latest records from the shipment API" icon={Package} className="recent-list-panel">
        {shipments.length ? <div className="subpage-list">{[...shipments].slice(-6).reverse().map(s => <div className="subpage-list-row" key={s.id ?? s.tracking_number}><span className="recent-icon"><StatusIcon status={s.status} /></span><div className="subpage-list-copy"><strong>{s.tracking_number}</strong><small>{s.recipient} · {s.destination}</small></div><span className={statusClass(s.status)}>{s.status}</span></div>)}</div> : <EmptyState loading={loading} title="No shipments yet" detail="Create a shipment to populate this overview." />}
        <div className="panel-inline-action"><button className="text-link" onClick={() => navigate('shipments')}>Open shipment management <ArrowUpRight size={14} /></button></div>
      </Panel>
      <Panel title="Platform status" subtitle="Current API health check" icon={ShieldCheck}>
        <div className="health-summary"><span className={`health-orb ${health === 'healthy' ? 'orb-ok' : 'orb-bad'}`}><Activity size={20} /></span><div><strong>{health === 'healthy' ? 'Operational' : health === 'checking' ? 'Checking service' : 'Unavailable'}</strong><p>{health === 'healthy' ? 'The health endpoint reports a healthy service.' : 'Check the health page for the latest response.'}</p></div></div>
        <div className="panel-inline-action"><button className="text-link" onClick={() => navigate('health')}>View system health <ArrowUpRight size={14} /></button></div>
      </Panel>
    </div>
    <Panel title="Shipment status distribution" subtitle="Calculated from the records currently returned by the API" icon={Gauge}>
      <div className="distribution-grid">{[{ label: 'Pending', count: counts.pending, color: 'bar-slate' }, { label: 'In transit', count: counts.transit, color: 'bar-blue' }, { label: 'Delivered', count: counts.delivered, color: 'bar-green' }, { label: 'Delayed', count: counts.delayed, color: 'bar-amber' }].map(item => <div className="distribution-row" key={item.label}><div className="distribution-label"><span>{item.label}</span><strong>{item.count}</strong></div><div className="distribution-track"><span className={item.color} style={{ width: `${counts.total ? item.count / counts.total * 100 : 0}%` }} /></div></div>)}</div>
    </Panel>
  </>;
}
function EmptyState({ loading, title, detail }) {
  return <div className="empty-state"><span className="empty-icon"><Package size={22} /></span><strong>{loading ? 'Loading records…' : title}</strong><p>{detail}</p></div>;
}
function ShipmentsPage({ shipments, visible, counts, loading, query, setQuery, filter, setFilter, setModalOpen, updateStatus, compact }) {
  return <>
    <PageHeading eyebrow="SHIPMENT MANAGEMENT" title="Shipments" subtitle="Search, filter, create, and update individual shipment records." actions={<button className="button button-primary" onClick={() => setModalOpen(true)}><Plus size={16} />New shipment</button>} />
    <Panel title="All shipments" subtitle={`${visible.length} visible of ${counts.total} total records`}>
      <div className="table-toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tracking ID, recipient, destination…" aria-label="Search shipments" /></label><label className="filter-select"><SlidersHorizontal size={15} /><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter by status"><option>All shipments</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={14} /></label></div>
      <div className="table-scroll"><table className={`shipments-table ${compact ? 'table-compact' : ''}`}><thead><tr><th>Tracking ID</th><th>Recipient</th><th>Destination</th><th>Status</th><th>Created</th><th>Update status</th></tr></thead><tbody>
        {loading && shipments.length === 0 ? <tr><td colSpan="6"><div className="table-loading"><LoaderCircle size={19} className="spin" />Loading shipments…</div></td></tr>
        : visible.length === 0 ? <tr><td colSpan="6"><EmptyState loading={false} title={shipments.length ? 'No matching shipments' : 'No shipments yet'} detail={shipments.length ? 'Try a different search or status filter.' : 'Create a shipment to get started.'} /></td></tr>
        : visible.map(s => <tr key={s.id ?? s.tracking_number}><td><span className="tracking-cell"><span className="tracking-icon"><Package size={15} /></span><strong>{s.tracking_number}</strong></span></td><td><span className="recipient-name">{s.recipient}</span></td><td><span className="destination-cell"><MapPin size={14} />{s.destination}</span></td><td><span className={statusClass(s.status)}><StatusIcon status={s.status} />{s.status}</span></td><td><span className="date-cell">{dateLabel(s.created_at)}</span></td><td><label className="status-action"><span className="sr-only">Update status</span><select value={s.status} onChange={e => updateStatus(s, e.target.value)} aria-label={`Update ${s.tracking_number} status`}>{STATUSES.map(st => <option key={st}>{st}</option>)}</select><ChevronDown size={13} /></label></td></tr>)}
      </tbody></table></div>
      <div className="panel-footer"><span>Showing <strong>{visible.length}</strong> of <strong>{shipments.length}</strong> shipments</span><span className="auto-refresh"><span className="live-dot" />{compact ? 'Compact table enabled' : 'Full table view'}</span></div>
    </Panel>
  </>;
}
function HealthPage({ health, payload, loading, lastRefresh, refresh }) {
  return <>
    <PageHeading eyebrow="OBSERVABILITY" title="System health" subtitle="Live health check from the deployed LogiTrack API." actions={<button className="button button-secondary" onClick={refresh}><RefreshCw size={15} />Refresh now</button>} />
    <div className="metrics-grid health-metrics">
      <Metric label="API status" value={health === 'healthy' ? 'Healthy' : health === 'checking' ? 'Checking' : 'Unavailable'} icon={health === 'healthy' ? CircleCheck : CircleX} tone={health === 'healthy' ? 'icon-green' : 'icon-amber'} foot={<><Activity size={13} />GET /api/health</>} />
      <Metric label="Shipment records" value={loading ? '…' : payload ? 'Connected' : '—'} icon={Database} foot={<><Package size={13} />GET /api/shipments</>} />
      <Metric label="Refresh interval" value={lastRefresh} icon={RefreshCw} tone="icon-blue" foot="Browser preference" />
      <Metric label="Last response" value={payload?.timestamp ? dateLabel(payload.timestamp) : 'Not available'} icon={Clock3} foot="From health response" />
    </div>
    <div className="page-columns">
      <Panel title="Health endpoint response" subtitle="Raw response returned by the API" icon={Server}>
        <div className={`service-banner ${health === 'healthy' ? 'service-ok' : 'service-down'}`}><span className="live-dot" /><div><strong>{health === 'healthy' ? 'API reports healthy' : health === 'checking' ? 'Checking API' : 'API health check failed'}</strong><p>{health === 'healthy' ? 'The health request completed successfully.' : 'Retry the request or inspect the backend container and logs.'}</p></div></div>
        <pre className="response-json">{payload ? JSON.stringify(payload, null, 2) : JSON.stringify({ status: health }, null, 2)}</pre>
      </Panel>
      <Panel title="Endpoints checked" subtitle="These are the browser-facing API routes used by this dashboard" icon={Activity}>
        <div className="endpoint-row"><span className="method-pill">GET</span><code>/api/health</code><span className={`endpoint-state ${health === 'healthy' ? 'endpoint-ok' : 'endpoint-bad'}`}>{health === 'healthy' ? 'Responding' : 'Unverified'}</span></div>
        <div className="endpoint-row"><span className="method-pill">GET</span><code>/api/shipments</code><span className="endpoint-state">Checked on refresh</span></div>
        <p className="muted-note">This page reports application endpoint checks. CPU, memory, disk, CloudWatch alarm state, and SNS delivery are not fetched by these API endpoints.</p>
      </Panel>
    </div>
  </>;
}
function ResiliencePage({ health, counts }) {
  const checks = [
    { title: 'API health endpoint', detail: 'Application health is read from GET /api/health.', state: health === 'healthy' ? 'Healthy' : health === 'checking' ? 'Checking' : 'Needs review', ok: health === 'healthy', icon: Activity },
    { title: 'Shipment persistence', detail: 'Shipment records are read from the existing shipment API. Persistence is only confirmed by successful create/read tests.', state: 'Verify with test', ok: false, icon: Database },
    { title: 'Container restart policy', detail: 'Docker Compose is configured to restart services after a process exits (deployment configuration).', state: 'Configured', ok: true, icon: RotateCcw },
    { title: 'Infrastructure monitoring', detail: 'EC2 metrics and alarms are managed in AWS CloudWatch, outside this application health endpoint.', state: 'AWS console', ok: true, icon: BellRing },
  ];
  return <>
    <PageHeading eyebrow="RELIABILITY & RECOVERY" title="Resilience" subtitle="A dedicated view of recovery design and the checks visible to this application." />
    <div className="resilience-banner"><span className="resilience-banner-icon"><ShieldCheck size={22} /></span><div><strong>Resilience overview</strong><p>This page separates application health from infrastructure recovery controls. Items not exposed by the API are labelled for verification rather than presented as live telemetry.</p></div></div>
    <div className="metrics-grid resilience-metrics">
      <Metric label="API health" value={health === 'healthy' ? 'Healthy' : health === 'checking' ? 'Checking' : 'Unavailable'} icon={Activity} tone={health === 'healthy' ? 'icon-green' : 'icon-amber'} foot="Live application check" />
      <Metric label="Shipment records" value={counts.total} icon={Database} foot="Current API response" />
      <Metric label="Recovery design" value="Docker" icon={RotateCcw} tone="icon-blue" foot="Restart policy configured" />
      <Metric label="Monitoring" value="CloudWatch" icon={Gauge} tone="icon-green" foot="Infrastructure monitoring" />
    </div>
    <Panel title="Resilience checks" subtitle="Live checks are distinguished from deployment configuration and manual verification." icon={ShieldCheck}>
      <div className="resilience-check-list">{checks.map(c => { const Icon = c.icon; return <div className="resilience-check" key={c.title}><span className={`resilience-check-icon ${c.ok ? 'check-ok' : 'check-neutral'}`}><Icon size={18} /></span><div className="resilience-check-copy"><strong>{c.title}</strong><p>{c.detail}</p></div><span className={`resilience-state ${c.ok ? 'state-ok' : 'state-neutral'}`}>{c.state}</span></div>; })}</div>
    </Panel>
    <div className="notice-card"><AlertTriangle size={17} /><p><strong>Scope note:</strong> CloudWatch alarms, SNS email delivery, and actual recovery timing are not queried by this frontend. Confirm those in AWS Console or add a secured backend integration before treating them as live status.</p></div>
  </>;
}
function SettingsPage({ settings, setSettings, saveSettings, refresh }) {
  return <>
    <PageHeading eyebrow="WORKSPACE PREFERENCES" title="Settings" subtitle="Configure this browser's dashboard behaviour." actions={<button className="button button-primary" onClick={saveSettings}><Save size={15} />Save preferences</button>} />
    <div className="page-columns settings-columns">
      <Panel title="Dashboard behaviour" subtitle="These preferences are stored locally in this browser." icon={Settings2}>
        <div className="settings-list">
          <div className="setting-row"><div><strong>Automatic refresh</strong><p>Refresh shipment and health data on a schedule.</p></div><label className="toggle-control"><input type="checkbox" checked={settings.autoRefresh} onChange={e => setSettings({ ...settings, autoRefresh: e.target.checked })} /><span /></label></div>
          <div className="setting-row"><div><strong>Refresh interval</strong><p>Choose how often the dashboard requests updated data.</p></div><select className="settings-select" value={settings.refreshInterval} onChange={e => setSettings({ ...settings, refreshInterval: Number(e.target.value) })}><option value={5}>5 seconds</option><option value={15}>15 seconds</option><option value={30}>30 seconds</option><option value={60}>60 seconds</option></select></div>
          <div className="setting-row"><div><strong>Compact shipment table</strong><p>Reduce row spacing on the shipment management page.</p></div><label className="toggle-control"><input type="checkbox" checked={settings.compactTable} onChange={e => setSettings({ ...settings, compactTable: e.target.checked })} /><span /></label></div>
        </div>
        <div className="settings-actions"><button className="button button-secondary" onClick={refresh}><RefreshCw size={15} />Refresh data now</button><button className="button button-primary" onClick={saveSettings}><Save size={15} />Save preferences</button></div>
      </Panel>
      <Panel title="Connection details" subtitle="Read-only information about the frontend's API routing." icon={Server}>
        <div className="settings-detail"><span>API base path</span><code>/api</code></div>
        <div className="settings-detail"><span>Health endpoint</span><code>/api/health</code></div>
        <div className="settings-detail"><span>Shipments endpoint</span><code>/api/shipments</code></div>
        <div className="settings-detail"><span>Preference storage</span><strong>This browser only</strong></div>
        <p className="muted-note">These settings do not change AWS infrastructure, backend configuration, database credentials, or CloudWatch alarms.</p>
      </Panel>
    </div>
  </>;
}
