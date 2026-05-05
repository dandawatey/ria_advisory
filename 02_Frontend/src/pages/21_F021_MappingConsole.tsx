/**
 * F021 — Mapping Console
 * Tab 1: GL account → canonical category mapping (auto-suggest)
 * Tab 2: Account Groups — user-defined GL groupings for custom reporting
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { get, post, del } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MappingRow {
  gl_account_no: string;
  gl_account_name: string | null;
  entity_count: number;
  total_amount: number;
  suggestedCanonical: string;
  mappingStatus: 'mapped' | 'unmapped' | 'pending';
}

interface AccountGroup {
  group_id: string;
  group_name: string;
  description: string | null;
  color: string;
  sort_order: number;
  member_count: number;
}

interface GroupMember {
  account_no: string;
  account_name: string | null;
  account_category: string | null;
  label_override: string | null;
}

interface AvailableAccount {
  account_no: string;
  account_name: string | null;
  account_category: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function suggestCanonical(acct: string, name: string | null): string {
  const n = (name ?? '').toLowerCase();
  if (acct.startsWith('1')) return n.includes('cash') ? '1000 — Cash & Cash Equivalents' : n.includes('receiv') ? '1100 — Accounts Receivable' : '1xxx — Asset';
  if (acct.startsWith('2')) return n.includes('payable') ? '2000 — Accounts Payable' : '2xxx — Liability';
  if (acct.startsWith('3')) return '3xxx — Equity';
  if (acct.startsWith('4')) return n.includes('advisory') ? '4100 — Advisory Fee Revenue' : n.includes('management') ? '4200 — Management Fee Revenue' : '4xxx — Revenue';
  if (acct.startsWith('5')) return '5xxx — Cost of Sales';
  if (acct.startsWith('6')) {
    if (n.includes('salary') || n.includes('salaries') || n.includes('payroll')) return '6100 — Compensation & Benefits';
    if (n.includes('tech') || n.includes('software')) return '6200 — Technology';
    if (n.includes('rent') || n.includes('occupancy')) return '6300 — Occupancy';
    return '6xxx — Operating Expenses';
  }
  if (acct.startsWith('7')) return '7xxx — Other Income';
  if (acct.startsWith('8')) return '8xxx — Income Tax';
  if (acct === '999999') return 'SUSPENSE — Opening Balance Upload';
  return 'UNMAPPED';
}

function fmtUSD(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

const PRESET_COLORS = [
  '#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6',
];

// ── Tab 1: Mapping Console ────────────────────────────────────────────────────

function MappingTab() {
  const [rows, setRows]         = useState<MappingRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [apiError, setApiError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'mapped' | 'unmapped' | 'pending'>('all');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    api.gl.accounts()
      .then((accounts) => {
        const mapped: MappingRow[] = accounts.map((a) => {
          const canonical = suggestCanonical(a.gl_account_no, a.gl_account_name);
          return {
            ...a,
            suggestedCanonical: canonical,
            mappingStatus: canonical === 'UNMAPPED' ? 'unmapped' : a.entity_count >= 3 ? 'mapped' : 'pending',
          };
        });
        setRows(mapped);
      })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.mappingStatus === statusFilter;
    const matchSearch = !search || r.gl_account_no.includes(search) || (r.gl_account_name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const mappedCount   = rows.filter((r) => r.mappingStatus === 'mapped').length;
  const pendingCount  = rows.filter((r) => r.mappingStatus === 'pending').length;
  const unmappedCount = rows.filter((r) => r.mappingStatus === 'unmapped').length;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Auto-mapped',   count: mappedCount,   color: 'var(--color-success)', status: 'mapped'   as const },
          { label: 'Pending Review',count: pendingCount,  color: 'var(--color-warning)', status: 'pending'  as const },
          { label: 'Unmapped',      count: unmappedCount, color: 'var(--color-error)',   status: 'unmapped' as const },
        ].map(({ label, count, color, status }) => (
          <div
            key={label}
            className="card"
            style={{ padding: '14px 16px', cursor: 'pointer', border: statusFilter === status ? `2px solid ${color}` : '1px solid var(--color-border)' }}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{loading ? '…' : count}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-12">
          <div className="card-title" style={{ margin: 0 }}>Account Mappings ({filtered.length})</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {apiError && <span style={{ color: 'var(--color-warning)', fontSize: 12 }}>⚠ API offline</span>}
            <input className="form-input" style={{ width: 200 }} placeholder="Search account…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {statusFilter !== 'all' && <button className="btn btn-secondary btn-sm" onClick={() => setStatusFilter('all')}>Show All</button>}
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 540, overflowY: 'auto' }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Account No</th><th>BC Account Name</th><th>Entities</th>
                <th>Suggested Canonical</th><th style={{ textAlign: 'right' }}>Net Balance</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.gl_account_no}>
                  <td className="table-mono" style={{ fontWeight: 600 }}>{r.gl_account_no}</td>
                  <td>{r.gl_account_name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                  <td style={{ textAlign: 'center' }}>{r.entity_count}</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{r.suggestedCanonical}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtUSD(r.total_amount)}</td>
                  <td>
                    <span className={`badge ${r.mappingStatus === 'mapped' ? 'badge-success' : r.mappingStatus === 'pending' ? 'badge-warning' : 'badge-error'}`}>
                      {r.mappingStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Tab 2: Account Groups ─────────────────────────────────────────────────────

function AccountGroupsTab() {
  const [groups,       setGroups]       = useState<AccountGroup[]>([]);
  const [selectedGrp,  setSelectedGrp]  = useState<AccountGroup | null>(null);
  const [members,      setMembers]      = useState<GroupMember[]>([]);
  const [available,    setAvailable]    = useState<AvailableAccount[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [memberLoading,setMemberLoading]= useState(false);
  const [error,        setError]        = useState('');
  const [acctSearch,   setAcctSearch]   = useState('');
  const [showCreate,   setShowCreate]   = useState(false);
  const [newName,      setNewName]      = useState('');
  const [newDesc,      setNewDesc]      = useState('');
  const [newColor,     setNewColor]     = useState(PRESET_COLORS[0]);
  const [saving,       setSaving]       = useState(false);

  const loadGroups = useCallback(() => {
    setLoading(true);
    get<AccountGroup[]>('/api/gl/groups')
      .then(setGroups)
      .catch(() => setError('Could not load groups'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  async function selectGroup(g: AccountGroup) {
    setSelectedGrp(g);
    setMemberLoading(true);
    setAcctSearch('');
    try {
      const [mem, avail] = await Promise.all([
        get<GroupMember[]>(`/api/gl/groups/${g.group_id}/members`),
        get<AvailableAccount[]>(`/api/gl/groups/${g.group_id}/available-accounts`),
      ]);
      setMembers(mem);
      setAvailable(avail);
    } catch {
      setError('Could not load group members');
    } finally {
      setMemberLoading(false);
    }
  }

  async function handleCreateGroup() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await post('/api/gl/groups', { group_name: newName.trim(), description: newDesc || null, color: newColor });
      setNewName(''); setNewDesc(''); setNewColor(PRESET_COLORS[0]);
      setShowCreate(false);
      loadGroups();
    } catch {
      setError('Create failed — name may already exist');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(g: AccountGroup) {
    if (!confirm(`Delete group "${g.group_name}" and all its account assignments?`)) return;
    try {
      await del(`/api/gl/groups/${g.group_id}`);
      if (selectedGrp?.group_id === g.group_id) setSelectedGrp(null);
      loadGroups();
    } catch {
      setError('Delete failed');
    }
  }

  async function addAccount(acct: AvailableAccount) {
    if (!selectedGrp) return;
    try {
      await post(`/api/gl/groups/${selectedGrp.group_id}/members`, { account_no: acct.account_no });
      setMembers((prev) => [...prev, { account_no: acct.account_no, account_name: acct.account_name, account_category: acct.account_category, label_override: null }]);
      setAvailable((prev) => prev.filter((a) => a.account_no !== acct.account_no));
      setGroups((prev) => prev.map((g) => g.group_id === selectedGrp.group_id ? { ...g, member_count: g.member_count + 1 } : g));
    } catch {
      setError('Add account failed');
    }
  }

  async function removeAccount(account_no: string) {
    if (!selectedGrp) return;
    try {
      await del(`/api/gl/groups/${selectedGrp.group_id}/members/${account_no}`);
      const removed = members.find((m) => m.account_no === account_no);
      setMembers((prev) => prev.filter((m) => m.account_no !== account_no));
      if (removed) setAvailable((prev) => [...prev, { account_no: removed.account_no, account_name: removed.account_name, account_category: removed.account_category }].sort((a, b) => a.account_no.localeCompare(b.account_no)));
      setGroups((prev) => prev.map((g) => g.group_id === selectedGrp.group_id ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g));
    } catch {
      setError('Remove account failed');
    }
  }

  const inp: React.CSSProperties = {
    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
    borderRadius: 6, color: 'var(--color-text)', padding: '5px 10px', fontSize: 13, width: '100%',
  };

  const filteredAvail = available.filter((a) =>
    !acctSearch || a.account_no.includes(acctSearch) || (a.account_name ?? '').toLowerCase().includes(acctSearch.toLowerCase())
  );

  return (
    <>
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 10, color: '#dc2626', marginBottom: 12, fontSize: 13 }}>
          {error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Left: group list */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Groups ({groups.length})</div>
            <button
              onClick={() => setShowCreate((v) => !v)}
              style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
            >
              + New
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>Group Name *</label>
                <input style={inp} placeholder="e.g. Total Revenue" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 3 }}>Description</label>
                <input style={inp} placeholder="Optional" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>Color</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: newColor === c ? '2px solid white' : '2px solid transparent', outline: newColor === c ? `2px solid ${c}` : 'none', cursor: 'pointer' }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCreateGroup}
                  disabled={saving || !newName.trim()}
                  style={{ flex: 1, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 0', fontSize: 12, cursor: 'pointer', opacity: saving || !newName.trim() ? 0.6 : 1 }}
                >
                  {saving ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Group cards */}
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>Loading…</div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>No groups yet. Create one above.</div>
          ) : (
            groups.map((g) => (
              <div
                key={g.group_id}
                onClick={() => selectGroup(g)}
                style={{
                  background: 'var(--color-surface)',
                  border: selectedGrp?.group_id === g.group_id ? `2px solid ${g.color}` : '1px solid var(--color-border)',
                  borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
                  borderLeft: `4px solid ${g.color}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{g.group_name}</div>
                    {g.description && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{g.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      <span style={{ background: `${g.color}22`, color: g.color, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {g.member_count} account{g.member_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1 }}
                    aria-label={`Delete group ${g.group_name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: group editor */}
        <div>
          {!selectedGrp ? (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 48, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⊞</div>
              <div style={{ fontSize: 14 }}>Select a group to manage its accounts</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Or create a new group on the left</div>
            </div>
          ) : (
            <div style={{ background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: 8, padding: 16, borderTop: `3px solid ${selectedGrp.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedGrp.group_name}</div>
                  {selectedGrp.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{selectedGrp.description}</div>}
                </div>
                <span style={{ background: `${selectedGrp.color}22`, color: selectedGrp.color, padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                  {members.length} account{members.length !== 1 ? 's' : ''}
                </span>
              </div>

              {memberLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>Loading accounts…</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Members */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      In Group ({members.length})
                    </div>
                    {members.length === 0 ? (
                      <div style={{ padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>No accounts yet. Add from the right.</div>
                    ) : (
                      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        {members.map((m) => (
                          <div key={m.account_no} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, marginBottom: 4, background: 'var(--color-surface-2)' }}>
                            <div>
                              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{m.account_no}</span>
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>{m.label_override ?? m.account_name ?? '—'}</span>
                              {m.account_category && (
                                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{m.account_category}</div>
                              )}
                            </div>
                            <button
                              onClick={() => removeAccount(m.account_no)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 4px' }}
                              aria-label={`Remove ${m.account_no}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Available accounts */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Available ({filteredAvail.length})
                    </div>
                    <input
                      style={{ ...inp, marginBottom: 8 }}
                      placeholder="Search accounts…"
                      value={acctSearch}
                      onChange={(e) => setAcctSearch(e.target.value)}
                    />
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      {filteredAvail.map((a) => (
                        <div
                          key={a.account_no}
                          onClick={() => addAccount(a)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 6, marginBottom: 4, background: 'var(--color-surface-2)', cursor: 'pointer' }}
                        >
                          <div>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{a.account_no}</span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>{a.account_name ?? '—'}</span>
                            {a.account_category && (
                              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{a.account_category}</div>
                            )}
                          </div>
                          <span style={{ color: selectedGrp.color, fontSize: 16, fontWeight: 700 }}>+</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MappingConsole() {
  const [activeTab, setActiveTab] = useState<'mappings' | 'groups'>('mappings');

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', borderBottom: activeTab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
    background: 'none', color: activeTab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
  });

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Mapping Console</h1>
            <p className="page-subtitle">GL account mapping · user-defined groupings for custom reporting</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
        <button style={tabStyle('mappings')} onClick={() => setActiveTab('mappings')}>Account Mappings</button>
        <button style={tabStyle('groups')}   onClick={() => setActiveTab('groups')}>Account Groups</button>
      </div>

      {activeTab === 'mappings' ? <MappingTab /> : <AccountGroupsTab />}
    </div>
  );
}
