import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight,
  CheckCircle2, ChevronDown, Clock3, Cloud, LoaderCircle,
  Menu, Package, PackageCheck, Plus, RefreshCw, Search,
  Server, ShieldCheck, Truck, X
} from 'lucide-react';

const API = '/api';
const STATUSES = ['Pending', 'In Transit', 'Delivered', 'Delayed'];

function App() {
  const [shipments, setShipments] = useState([]);
  const [health, setHealth] = useState('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    tracking_number: '', recipient: '', destination: '', status: 'Pending'
  });

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [healthResponse, shipmentsResponse] = await Promise.all([
        fetch(`${API}/health`),
        fetch(`${API}/shipments`)
      ]);

      if (!healthResponse.ok) throw new Error('Health check failed');
      if (!shipmentsResponse.ok) throw new Error('Could not load shipments');

      const healthData = await healthResponse.json();
      const shipmentData = await shipmentsResponse.json();

      setHealth(healthData.status === 'healthy' ? 'healthy' : 'unhealthy');
      setShipments(Array.isArray(shipmentData) ? shipmentData : []);
      setError('');
    } catch {
      setHealth('unhealthy');
      setError('Unable to connect to the API. Check the service and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh(true), 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  const counts = useMemo(() => ({
    total: shipments.length,
    transit: shipments.filter(s => s.status === 'In Transit').length,
    delivered: shipments.filter(s => s.status === 'Delivered').length,
    delayed: shipments.filter(s => s.status === 'Delayed').length
  }), [shipments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shipments.filter(s => {
      const matchesSearch = !q || [
        s.tracking_number, s.recipient, s.destination, s.status
      ].some(value => String(value ?? '').toLowerCase().includes(q));
      return matchesSearch &&
        (statusFilter === 'All' || s.status === statusFilter);
    });
  }, [shipments, search, statusFilter]);

  async function createShipment(event) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch(`${API}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail
          ? (typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail))
          : 'Could not create shipment');
      }
      setForm({ tracking_number: '', recipient: '', destination: '', status: 'Pending' });
      setShowForm(false);
      setNotice('Shipment created successfully.');
      await refresh(true);
    } catch (err) {
      setNotice(err.message || 'Request failed.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(shipment, status) {
    if (status === shipment.status) return;
    setNotice('');
    try {
      const response = await fetch(`${API}/shipments/${shipment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail
          ? (typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail))
          : 'Could not update status');
      }
      setNotice(`Shipment ${shipment.tracking_number} updated.`);
      await refresh(true);
    } catch (err) {
      setNotice(err.message || 'Status update failed.');
      await refresh(true);
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-icon"><PackageCheck size={24} /></span>
          <span>Logi<span className="brand-light">Track</span><small>CLOUD OPERATIONS</small></span>
        </a>

        <div className="nav-label">WORKSPACE</div>
        <a className="nav-item active" href="#dashboard"><Activity size={18} /> Overview</a>
        <a className="nav-item" href="#shipments"><Package size={18} /> Shipments <span className="nav-count">{counts.total}</span></a>

        <div className="nav-label nav-label-spaced">INFRASTRUCTURE</div>
        <a className="nav-item" href="#system"><Server size={18} /> System health</a>
        <a className="nav-item" href="https://ap-southeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-southeast-2#alarmsV2:" target="_blank" rel="noreferrer"><Cloud size={18} /> CloudWatch <ArrowUpRight size={14} className="external-icon" /></a>

        <div className="sidebar-bottom">
          <div className="side-status">
            <span className={`pulse ${health === 'healthy' ? 'pulse-green' : ''}`} />
            <div><strong>{health === 'healthy' ? 'API operational' : health === 'checking' ? 'Checking API…' : 'API unavailable'}</strong><small>Auto-refresh every 15 sec</small></div>
          </div>
          <div className="version">LOGITRACK · CLOUD RESILIENCE</div>
        </div>
      </aside>

      <main className="main" id="dashboard">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span>/</span><strong>Overview</strong></div>
          <div className="topbar-right">
            <span className={`health-pill ${health === 'healthy' ? 'is-healthy' : ''}`}>
              <span className="pill-dot" />{health === 'healthy' ? 'Systems operational' : health === 'checking' ? 'Connecting' : 'Connection issue'}
            </span>
            <button className="icon-button" onClick={() => refresh()} title="Refresh data"><RefreshCw size={17} /></button>
          </div>
        </header>

        <section className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> LOGISTICS CONTROL CENTER</div>
              <h1>Shipment overview<span className="heading-period">.</span></h1>
              <p className="subtitle">Monitor deliveries, manage shipment records, and check service health.</p>
            </div>
            <button className="primary-button" onClick={() => { setNotice(''); setShowForm(true); }}>
              <Plus size={18} /> New shipment
            </button>
          </div>

          {error && <div className="alert alert-error"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => refresh()}><RefreshCw size={15} /> Retry</button></div>}
          {notice && <div className={`alert ${notice.toLowerCase().includes('successfully') || notice.toLowerCase().includes('updated') ? 'alert-success' : 'alert-info'}`}><span>{notice}</span><button className="alert-close" onClick={() => setNotice('')}><X size={16} /></button></div>}

          <div className="stats-grid">
            <StatCard label="Total shipments" value={counts.total} icon={<Package size={20} />} accent="blue" foot="All registered shipments" />
            <StatCard label="In transit" value={counts.transit} icon={<Truck size={20} />} accent="violet" foot="Currently moving" />
            <StatCard label="Delivered" value={counts.delivered} icon={<CheckCircle2 size={20} />} accent="green" foot="Successfully completed" />
            <StatCard label="Delayed" value={counts.delayed} icon={<Clock3 size={20} />} accent="amber" foot="Requires attention" />
          </div>

          <section className="system-panel" id="system">
            <div className="system-title">
              <div className="system-icon"><ShieldCheck size={20} /></div>
              <div><h2>Infrastructure status</h2><p>Live health check from the LogiTrack API</p></div>
            </div>
            <div className="system-indicator">
              <span className={`system-light ${health === 'healthy' ? 'light-green' : ''}`} />
              <div><strong>{health === 'healthy' ? 'API responding normally' : health === 'checking' ? 'Checking service…' : 'API connection unavailable'}</strong><small>{health === 'healthy' ? 'Health endpoint returned a healthy response' : 'Check the backend container and network connection'}</small></div>
            </div>
            <div className="system-footer"><span><span className="mini-dot" /> Polling interval: 15 seconds</span><a href="/api/health" target="_blank" rel="noreferrer">Health endpoint <ArrowUpRight size={13} /></a></div>
          </section>

          <section className="shipments-panel" id="shipments">
            <div className="table-heading">
              <div><h2>Shipment records</h2><p>Track and update every shipment in your system.</p></div>
              <button className="secondary-button" onClick={() => refresh()}><RefreshCw size={15} /> Refresh</button>
            </div>
            <div className="table-controls">
              <label className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracking ID, recipient, destination…" /><kbd>⌘ K</kbd></label>
              <label className="filter-box"><span>Status:</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={14} /></label>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>TRACKING ID</th><th>RECIPIENT</th><th>DESTINATION</th><th>STATUS</th><th>LAST UPDATED</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan="5" className="empty-state"><LoaderCircle className="spin" size={22} /><span>Loading shipment records…</span></td></tr>
                    : filtered.length === 0 ? <tr><td colSpan="5" className="empty-state"><Package size={24} /><strong>{shipments.length === 0 ? 'No shipments yet' : 'No matching shipments'}</strong><span>{shipments.length === 0 ? 'Create your first shipment to get started.' : 'Try changing your search or filter.'}</span></td></tr>
                    : filtered.map(s => <tr key={s.id}>
                      <td><div className="tracking-cell"><span className="tracking-icon"><Package size={15} /></span><strong>{s.tracking_number}</strong></div></td>
                      <td>{s.recipient}</td><td>{s.destination}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td><div className="date-cell">{formatDate(s.updated_at)}<select aria-label={`Update status for ${s.tracking_number}`} className="row-status" value={s.status} onChange={e => updateStatus(s, e.target.value)}><option value={s.status}>{s.status}</option>{STATUSES.filter(v => v !== s.status).map(v => <option key={v}>{v}</option>)}</select></div></td>
                    </tr>)}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing <strong>{filtered.length}</strong> of <strong>{shipments.length}</strong> shipments</span><span className="data-source"><span className="mini-dot" /> Live API data</span></div>
          </section>

          <footer className="footer"><span>© 2026 LogiTrack Cloud Operations</span><span>Built with FastAPI · Docker · AWS EC2</span></footer>
        </section>
      </main>

      {showForm && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading"><div><span className="modal-icon"><PackageCheck size={21} /></span><h2 id="modal-title">Create shipment</h2><p>Add a new shipment to the tracking system.</p></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close"><X size={19} /></button></div>
          <form onSubmit={createShipment}>
            <label className="form-label">Tracking number<input required maxLength="80" value={form.tracking_number} onChange={e => setForm({ ...form, tracking_number: e.target.value })} placeholder="e.g. LT1002" /></label>
            <label className="form-label">Recipient name<input required maxLength="120" value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} placeholder="Enter recipient name" /></label>
            <label className="form-label">Destination<input required maxLength="160" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="City or delivery location" /></label>
            <label className="form-label">Initial status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}{saving ? 'Creating…' : 'Create shipment'}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

function StatCard({ label, value, icon, accent, foot }) {
  return <article className={`stat-card accent-${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-foot"><span className="stat-foot-dot" />{foot}</div></article>;
}

function StatusBadge({ status }) {
  const cls = status === 'Delivered' ? 'delivered' : status === 'In Transit' ? 'transit' : status === 'Delayed' ? 'delayed' : 'pending';
  return <span className={`status-badge ${cls}`}><span />{status}</span>;
}

export default App;
