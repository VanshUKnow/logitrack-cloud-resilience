import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, Bell, Check, CheckCircle2, ChevronDown, Clock3, Command, LayoutDashboard, LoaderCircle, MapPin, Menu, Package, PackageCheck, Plus, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Truck, X } from 'lucide-react';

const API = '/api';
const STATUSES = ['Pending', 'In Transit', 'Delivered', 'Delayed'];

function normalise(item) {
  return { ...item, id: item.id ?? item.shipment_id ?? item.tracking_number, tracking_number: item.tracking_number ?? item.trackingNumber ?? '—', recipient: item.recipient ?? item.customer ?? 'Unknown recipient', destination: item.destination ?? '—', status: item.status ?? 'Pending', created_at: item.created_at ?? item.createdAt ?? item.timestamp ?? null };
}
function dateLabel(value) {
  if (!value) return 'Recently added';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}
function statusClass(status) { return `status-pill status-${String(status).toLowerCase().replace(/\s+/g, '-')}`; }
function StatusIcon({ status }) {
  if (status === 'Delivered') return <PackageCheck size={14} />;
  if (status === 'In Transit') return <Truck size={14} />;
  if (status === 'Delayed') return <AlertTriangle size={14} />;
  return <Clock3 size={14} />;
}

export default function App() {
  const [shipments, setShipments] = useState([]);
  const [health, setHealth] = useState('checking');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All shipments');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
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
    const timer = window.setInterval(() => loadData(true), 15000);
    return () => window.clearInterval(timer);
  }, [loadData]);

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
      const found = !term || [s.tracking_number, s.recipient, s.destination, s.status].some(v => String(v ?? '').toLowerCase().includes(term));
      return found && (filter === 'All shipments' || s.status === filter);
    });
  }, [shipments, query, filter]);

  async function createShipment(e) {
    e.preventDefault(); setSaving(true);
    try {
      const r = await fetch(`${API}/shipments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tracking_number: form.tracking_number.trim(), recipient: form.recipient.trim(), destination: form.destination.trim(), status: form.status }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || 'Shipment could not be created.');
      setForm({ tracking_number: '', recipient: '', destination: '', status: 'Pending' });
      setModalOpen(false); notify('Shipment created successfully.'); await loadData(true);
    } catch (e) { notify(e.message || 'Could not create shipment.', 'error'); }
    finally { setSaving(false); }
  }

  async function updateStatus(shipment, status) {
    try {
      const r = await fetch(`${API}/shipments/${encodeURIComponent(shipment.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || 'Status update failed.');
      notify(`${shipment.tracking_number} updated to ${status}.`); await loadData(true);
    } catch (e) { notify(e.message || 'Could not update shipment.', 'error'); }
  }

  return <div className="app-shell">
    {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand" href="/" aria-label="LogiTrack home"><span className="brand-mark"><Package size={22} /></span><span className="brand-copy"><strong>LogiTrack</strong><small>SHIPMENT CONTROL</small></span></a>
      <div className="workspace-switcher"><div className="workspace-avatar">LT</div><div className="workspace-copy"><strong>Logistics workspace</strong><span>Production environment</span></div><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="main-nav">
        <a className="nav-item nav-active" href="#overview" onClick={() => setMobileNav(false)}><LayoutDashboard size={18} />Overview</a>
        <a className="nav-item" href="#shipments" onClick={() => setMobileNav(false)}><Package size={18} />Shipments<span className="nav-count">{counts.total}</span></a>
        <a className="nav-item" href="#health" onClick={() => setMobileNav(false)}><Activity size={18} />System health</a>
      </nav>
      <div className="nav-label nav-label-spaced">SYSTEM</div>
      <div className="nav-item nav-muted"><ShieldCheck size={18} />Resilience</div>
      <div className="nav-item nav-muted"><Settings2 size={18} />Settings</div>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-icon"><ShieldCheck size={17} /></span><strong>Operations, in view.</strong><p>Keep shipment status and service health within reach.</p><a href="/api/health" target="_blank" rel="noreferrer">View API health <ArrowUpRight size={13} /></a></div>
        <div className="profile-row"><div className="profile-avatar">LT</div><div className="profile-copy"><strong>LogiTrack Admin</strong><span>Administrator</span></div><Command size={16} /></div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
        <div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>Overview</strong></div>
        <div className="topbar-actions">
          <div className={`system-chip ${health === 'healthy' ? 'system-ok' : health === 'checking' ? 'system-checking' : 'system-down'}`}><span className="live-dot" />{health === 'healthy' ? 'All systems operational' : health === 'checking' ? 'Checking systems' : 'Connection issue'}</div>
          <button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify('You are all caught up.')}><Bell size={18} /><span /></button><div className="topbar-divider" /><div className="topbar-avatar">LT</div>
        </div>
      </header>

      <div className="page-wrap">
        <section className="welcome-row" id="overview">
          <div><div className="eyebrow"><span className="eyebrow-line" />OPERATIONS OVERVIEW</div><h1>Shipment command center<span>.</span></h1><p className="page-subtitle">A clear view of shipments, delivery progress, and system health.</p></div>
          <div className="welcome-actions"><button className="button button-secondary" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />Refresh</button><button className="button button-primary" onClick={() => setModalOpen(true)}><Plus size={17} />Create shipment</button></div>
        </section>
        {error && <div className="error-banner"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => loadData(true)}>Retry</button></div>}

        <section className="metrics-grid">
          <article className="metric-card metric-total"><div className="metric-top"><span className="metric-label">Total shipments</span><span className="metric-icon"><Package size={18} /></span></div><div className="metric-number">{loading ? '—' : counts.total}</div><div className="metric-foot"><Activity size={14} />Across all shipment statuses</div></article>
          <article className="metric-card"><div className="metric-top"><span className="metric-label">In transit</span><span className="metric-icon icon-blue"><Truck size={18} /></span></div><div className="metric-number">{loading ? '—' : counts.transit}</div><div className="metric-foot"><span className="metric-trend trend-blue"><ArrowUpRight size={14} /></span>Currently on the move</div></article>
          <article className="metric-card"><div className="metric-top"><span className="metric-label">Delivered</span><span className="metric-icon icon-green"><CheckCircle2 size={18} /></span></div><div className="metric-number">{loading ? '—' : counts.delivered}</div><div className="metric-foot"><span className="metric-trend trend-green"><Check size={13} /></span>Successfully completed</div></article>
          <article className="metric-card"><div className="metric-top"><span className="metric-label">Delayed</span><span className="metric-icon icon-amber"><Clock3 size={18} /></span></div><div className="metric-number">{loading ? '—' : counts.delayed}</div><div className="metric-foot"><span className={`metric-trend ${counts.delayed ? 'trend-red' : 'trend-green'}`}>{counts.delayed ? <AlertTriangle size={13} /> : <Check size={13} />}</span>{counts.delayed ? 'Needs attention' : 'No delays reported'}</div></article>
        </section>

        <section className="content-grid">
          <div className="panel shipment-panel" id="shipments">
            <div className="panel-heading"><div><div className="panel-title-row"><h2>Shipment overview</h2><span className="count-badge">{counts.total}</span></div><p>Track and manage your latest deliveries.</p></div><button className="button button-primary button-small" onClick={() => setModalOpen(true)}><Plus size={15} />New shipment</button></div>
            <div className="table-toolbar">
              <label className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tracking ID, recipient..." aria-label="Search shipments" /><kbd>⌘ K</kbd></label>
              <label className="filter-select"><SlidersHorizontal size={15} /><select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter by status"><option>All shipments</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={14} /></label>
            </div>
            <div className="table-scroll"><table className="shipments-table">
              <thead><tr><th>Tracking ID</th><th>Recipient</th><th>Destination</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {loading && shipments.length === 0 ? <tr><td colSpan="6"><div className="table-loading"><LoaderCircle size={19} className="spin" />Loading shipments…</div></td></tr>
                : visible.length === 0 ? <tr><td colSpan="6"><div className="empty-state"><span className="empty-icon"><Package size={22} /></span><strong>{shipments.length ? 'No matching shipments' : 'Your shipment list is empty'}</strong><p>{shipments.length ? 'Try a different search or filter.' : 'Create your first shipment to get started.'}</p>{!shipments.length && <button className="button button-primary button-small" onClick={() => setModalOpen(true)}><Plus size={15} />Create shipment</button>}</div></td></tr>
                : visible.map(s => <tr key={s.id ?? s.tracking_number}><td><span className="tracking-cell"><span className="tracking-icon"><Package size={15} /></span><strong>{s.tracking_number}</strong></span></td><td><span className="recipient-name">{s.recipient}</span></td><td><span className="destination-cell"><MapPin size={14} />{s.destination}</span></td><td><span className={statusClass(s.status)}><StatusIcon status={s.status} />{s.status}</span></td><td><span className="date-cell">{dateLabel(s.created_at)}</span></td><td><label className="status-action"><span className="sr-only">Update status</span><select value={s.status} onChange={e => updateStatus(s, e.target.value)} aria-label={`Update ${s.tracking_number} status`}>{STATUSES.map(st => <option key={st}>{st}</option>)}</select><ChevronDown size={13} /></label></td></tr>)}
              </tbody>
            </table></div>
            <div className="panel-footer"><span>Showing <strong>{visible.length}</strong> of <strong>{shipments.length}</strong> shipments</span><span className="auto-refresh"><span className="live-dot" />Auto-refreshes every 15 seconds</span></div>
          </div>

          <aside className="right-rail">
            <section className="panel health-panel" id="health">
              <div className="rail-heading"><div><h2>System health</h2><p>Live service status</p></div><span className={`health-icon ${health === 'healthy' ? 'health-icon-ok' : 'health-icon-bad'}`}>{health === 'healthy' ? <ShieldCheck size={19} /> : <Activity size={19} />}</span></div>
              <div className={`health-status ${health === 'healthy' ? 'health-status-ok' : 'health-status-bad'}`}><span className="live-dot" /><strong>{health === 'healthy' ? 'All systems operational' : health === 'checking' ? 'Checking service…' : 'Service unavailable'}</strong></div>
              <div className="health-detail"><span>Shipment API</span><span className={`mini-status ${health === 'healthy' ? 'mini-ok' : 'mini-bad'}`}><span />{health === 'healthy' ? 'Healthy' : health === 'checking' ? 'Checking' : 'Unavailable'}</span></div>
              <div className="health-detail"><span>Dashboard refresh</span><span className="detail-value">15 seconds</span></div>
              <div className="health-detail"><span>API endpoint</span><a href="/api/health" target="_blank" rel="noreferrer">View response <ArrowUpRight size={13} /></a></div>
              <div className="health-note"><span className="note-check"><Check size={14} /></span><p>Health checks run automatically to keep this view current.</p></div>
            </section>
            <section className="panel distribution-panel"><div className="rail-heading"><div><h2>Shipment distribution</h2><p>Current status breakdown</p></div><span className="distribution-icon"><Activity size={18} /></span></div>
              {[{ label: 'In transit', count: counts.transit, color: 'bar-blue' }, { label: 'Delivered', count: counts.delivered, color: 'bar-green' }, { label: 'Pending', count: counts.pending, color: 'bar-slate' }, { label: 'Delayed', count: counts.delayed, color: 'bar-amber' }].map(item => <div className="distribution-row" key={item.label}><div className="distribution-label"><span>{item.label}</span><strong>{item.count}</strong></div><div className="distribution-track"><span className={item.color} style={{ width: `${counts.total ? item.count / counts.total * 100 : 0}%` }} /></div></div>)}
              <div className="distribution-foot"><span>Total shipments</span><strong>{counts.total}</strong></div>
            </section>
          </aside>
        </section>
        <footer className="page-footer"><span>© {new Date().getFullYear()} LogiTrack Operations</span><span><span className="footer-dot" />Cloud-connected shipment management</span></footer>
      </div>
    </main>

    {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}><section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-header"><div><span className="modal-kicker">SHIPMENT MANAGEMENT</span><h2 id="modal-title">Create a shipment</h2><p>Add a new package to your tracking workspace.</p></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Close dialog"><X size={19} /></button></div>
      <form onSubmit={createShipment}><div className="form-grid">
        <label className="form-field form-full"><span>Tracking ID <b>*</b></span><input required value={form.tracking_number} onChange={e => setForm({ ...form, tracking_number: e.target.value })} placeholder="e.g. LT1002" autoFocus /><small>Use a unique tracking number.</small></label>
        <label className="form-field"><span>Recipient <b>*</b></span><input required value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} placeholder="Recipient name" /></label>
        <label className="form-field"><span>Destination <b>*</b></span><input required value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="City or destination" /></label>
        <label className="form-field form-full"><span>Initial status</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
      </div><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <><LoaderCircle size={16} className="spin" />Creating…</> : <><Plus size={16} />Create shipment</>}</button></div></form>
    </section></div>}
    {toast && <div className={`toast toast-${toast.type}`} role="status"><span className="toast-icon">{toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
  </div>;
}
